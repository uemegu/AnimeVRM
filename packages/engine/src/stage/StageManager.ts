import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

import type { LocationVisualPreset, TimeOfDayId, TimeOfDayPreset } from './visual';
import { CinematicAnimeShader } from '../postprocessing/CinematicAnimeShader';
import { GodRaysShader } from '../postprocessing/GodRaysShader';
import { SunEffect } from '../postprocessing/SunEffect';
import { SkyBackground } from '../scene/SkyBackground';
import { ScrollingBackground, type ScrollingBackgroundSettings } from './ScrollingBackground';
import { StageAvatar } from './StageAvatar';
import { resolveAssetUrl } from '../utils/path';
import { ScreenEffects } from './ScreenEffects';
import type { EffectPresetName } from '../effects/text/types';
import { disposeEnvironment, loadEnvironment, placeEnvironment } from './environments';
import { HairShadowRenderer } from '../shader/HairShadow';
import { CharacterMaskRenderer, LightWrapShader } from '../postprocessing/LightWrap';
import { ParaShader, DEFAULT_PARA_PARAMS, applyParaParams } from '../postprocessing/Para';
import { setHairRingTint } from '../shader/HairRing';
import {
  cutStateAt,
  DEFAULT_AVATAR_LOOK,
  DEFAULT_BACKDROP,
  DEFAULT_CAMERA_FOV,
  DEFAULT_SHOT_RIGS,
  DEFAULT_SLOT_POSITIONS,
  type CameraPose as CameraPoseSetting,
  type CameraShot,
  type LocationStage,
  type AvatarOneShot,
  type CutState,
  type ScenarioScene,
  type TextContent,
} from '@anime-vrm/scenario';
import type { StageCastMember } from './types';

const IDLE_ANIMATION_URL = '/animations/Standing Idle.fbx';
const CAMERA_TRANSITION_SEC = 0.6;

interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export interface StagePresets {
  /** 時間帯ごとの見た目（assets/studio/time-of-day.json） */
  timeOfDay: Record<string, TimeOfDayPreset>;
  /** 場所ごとの背景（assets/studio/locations.json） */
  locations: Record<string, LocationVisualPreset>;
}

export interface StageOptions {
  canvas: HTMLCanvasElement;
  presets: StagePresets;
  /** 話しているキャラの口の形（音声の解析結果）。なければ口パクしない */
  getSpeakerPhoneme?: () => string | undefined;
  /**
   * カット内の時刻（ボイスの再生位置など）。指定すると毎フレームこの時刻でタイムラインを進める。
   * undefined を返したときはカット開始からの経過秒数を使う（Studio のように自分で setCutTime する場合は指定しない）
   */
  getCutTime?: () => number | undefined;
  initialTimeOfDay?: TimeOfDayId;
  initialLocationId?: string;
  /** 文字演出などの言語（既定 ja） */
  language?: 'ja' | 'en';
}

export class StageManager {
  private canvas: HTMLCanvasElement;
  private presets: StagePresets;
  private readonly getSpeakerPhoneme?: () => string | undefined;
  private readonly getCutTime?: () => number | undefined;
  private cutStartedAt = 0;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;

  // ポストプロセスパス群
  private renderPass: RenderPass;
  private lightWrapPass: ShaderPass;
  private paraPass: ShaderPass;
  private bloomPass: UnrealBloomPass;
  private godRaysPass: ShaderPass;
  private cinematicAnimePass: ShaderPass;
  private smaaPass: SMAAPass;

  // 前髪の影（髪の深度マスク）
  private hairShadow: HairShadowRenderer;
  // キャラのマスク（ライトラップ用）
  private characterMask: CharacterMaskRenderer;

  // 光源・環境・空
  private directionalLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private skyBackground: SkyBackground;
  private scrollingBackground: ScrollingBackground;
  /** 場所の遠景（流れる背景を止めたときに戻す） */
  private locationBackgroundTexture: THREE.Texture | null = null;
  /** 3D空間に置く遠景（場所の backdrop.mode が world のとき） */
  private backdropMesh!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** 場所の3D背景（組み込みのセットや glb） */
  private environment: { model: string; object: THREE.Object3D | null } | null = null;
  /** 最後に指定された登場キャラ（場所が変わったら立ち位置を当て直す） */
  private castMembers: StageCastMember[] = [];
  private sunEffect: SunEffect;

  // 多層背景
  private textureLoader: THREE.TextureLoader;
  private midgroundMesh: THREE.Mesh | null = null;
  private neargroundMesh: THREE.Mesh | null = null;

  // アバター管理
  private loadedAvatars: Map<string, StageAvatar> = new Map();
  /** 登場中のキャラ（表示順） */
  private castIds: string[] = [];
  private castPositions: Map<string, number> = new Map();
  /** 登場中のキャラの奥行き（立ち位置の z） */
  private castDepths: Map<string, number> = new Map();
  /** 登場中のキャラの頭の高さ（構図をキャラの背丈に合わせる） */
  private castHeadHeights: Map<string, number> = new Map();
  /** 口パクさせるキャラ */
  private speakerId: string | null = null;
  /** setCast の呼び出し番号（非同期ロード中に次の指定が来たら古い指定を捨てる） */
  private castVersion = 0;
  private pendingAvatars: Map<string, Promise<StageAvatar>> = new Map();
  private avatarMotionUrls: Map<string, string> = new Map();
  private motionReturnTimers: Map<string, number> = new Map();

  // カメラ構図の補間
  private cameraShot: CameraShot = 'speaker';
  private cameraFocusId: string | null = null;
  /** カットで直接指定したカメラ（構図の自動決定より優先） */
  private basePose: CameraPoseSetting | null = null;
  /** タイムラインで切り替えた構図・カメラ（カットの指定より優先） */
  private timelineShot: CameraShot | null = null;
  private timelinePose: { pose: CameraPoseSetting; duration?: number } | null = null;
  private cameraTransitionSec = CAMERA_TRANSITION_SEC;
  /** Studio でカメラを手で動かしている間は、構図によるカメラの移動を止める */
  private freeCamera = false;

  // カット内のタイムライン（キーフレーム）
  private cutScene: ScenarioScene | null = null;
  private cutTime = 0;
  /** キャラごとに最後に当てた状態（差分だけ当てるため） */
  private appliedCut = new Map<string, string>();
  private appliedCutCamera = '';
  /** キャラごとの視線（キャストの指定をタイムラインで上書きしたもの） */
  private gaze = new Map<string, { target?: string; headTurn?: number }>();
  /** カット内で出し終えた1回きりの演出 */
  private firedOneShots = new Set<string>();
  /** 集中線・瞼・暗転（canvas の親要素に重ねる） */
  private screenEffects: ScreenEffects | null = null;
  private language: 'ja' | 'en';
  private cameraFrom: CameraPose = { position: new THREE.Vector3(0, 1.25, 1.6), target: new THREE.Vector3(0, 1.15, 0) };
  private cameraTo: CameraPose = { position: new THREE.Vector3(0, 1.25, 1.6), target: new THREE.Vector3(0, 1.15, 0) };
  private cameraCurrentTarget = new THREE.Vector3(0, 1.15, 0);
  private cameraElapsed = CAMERA_TRANSITION_SEC;
  private hasCameraPose = false;

  // 現在の状態
  private currentTimeOfDay: TimeOfDayId = 'day';
  private currentLocationId: string = 'classroom';

  private clock: THREE.Clock;
  private animationFrameId: number | null = null;
  private isDisposed: boolean = false;

  constructor(options: StageOptions) {
    this.canvas = options.canvas;
    this.presets = options.presets;
    this.getSpeakerPhoneme = options.getSpeakerPhoneme;
    this.getCutTime = options.getCutTime;
    this.language = options.language ?? 'ja';
    this.clock = new THREE.Clock();
    if (this.canvas.parentElement) this.screenEffects = new ScreenEffects(this.canvas.parentElement);

    // 1. シーン初期化
    this.scene = new THREE.Scene();

    // 2. カメラ初期化 (歪みの少ない画角32度、キャラのバスト〜ウェストアップが美しく収まる構図)
    const aspect = this.canvas.clientWidth / (this.canvas.clientHeight || 1);
    this.camera = new THREE.PerspectiveCamera(32, aspect, 0.1, 100);
    this.camera.position.set(0, 1.25, 1.6);
    this.camera.lookAt(new THREE.Vector3(0, 1.15, 0));

    // 3. レンダラー初期化
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const initialWidth = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const initialHeight = Math.max(1, this.canvas.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(initialWidth, initialHeight, false);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // 4. 空と雲の描画システム (SkyBackground)
    this.skyBackground = new SkyBackground(this.scene, { visible: true });
    this.scrollingBackground = new ScrollingBackground(this.scene, this.camera);

    // 5. ライト初期化
    this.directionalLight = new THREE.DirectionalLight('#ffffff', 3.2);
    this.directionalLight.position.set(-1.9, 1.5, 2.6);
    this.scene.add(this.directionalLight);

    this.ambientLight = new THREE.AmbientLight('#776e74', 0.8);
    this.scene.add(this.ambientLight);

    // 輪郭を縁取る補助光（プリセットの lighting.rim で制御）
    // visible を切り替えるとライト数が変わりシェーダーが再コンパイルされるため、無効時は強度0にする
    this.rimLight = new THREE.DirectionalLight('#ffffff', 0);
    this.scene.add(this.rimLight);

    // 6. 太陽・レンズフレア・オクルージョン効果 (SunEffect)
    this.sunEffect = new SunEffect(this.scene);

    // 7. ポストプロセス完全パイプラインの構築
    const targetW = Math.floor(initialWidth * pixelRatio);
    const targetH = Math.floor(initialHeight * pixelRatio);

    const composerRenderTarget = new THREE.WebGLRenderTarget(
      targetW,
      targetH,
      {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        samples: 4,
      }
    );
    this.composer = new EffectComposer(this.renderer, composerRenderTarget);
    this.composer.setPixelRatio(pixelRatio);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // ライトラップ（背景の光をキャラの輪郭の内側ににじませる。リニア空間で行う）
    this.characterMask = new CharacterMaskRenderer(targetW, targetH);
    this.lightWrapPass = new ShaderPass(LightWrapShader);
    this.lightWrapPass.uniforms['uResolution'].value.set(targetW, targetH);
    this.lightWrapPass.uniforms['tMask'].value = this.characterMask.texture;
    this.composer.addPass(this.lightWrapPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(targetW, targetH),
      0.01,
      0.06,
      0.9
    );
    this.composer.addPass(this.bloomPass);

    this.godRaysPass = new ShaderPass(GodRaysShader);
    // 光源として拾うのは背景だけ（服の明暗から筋が出ないように）
    this.godRaysPass.uniforms['tMask'].value = this.characterMask.texture;
    this.godRaysPass.uniforms['uUseMask'].value = 1.0;
    this.composer.addPass(this.godRaysPass);

    // ここまでリニア空間。OutputPass で表示用の sRGB に変換する
    this.composer.addPass(new OutputPass());

    // パラ（背景の空気の色をキャラの上だけにグラデーションで重ねる。スクリーン合成なので sRGB で行う）
    this.paraPass = new ShaderPass(ParaShader);
    this.paraPass.uniforms['tMask'].value = this.characterMask.texture;
    this.composer.addPass(this.paraPass);

    // 色調補正（明度0.5基準の影/ハイライト判定・S字カーブ）とSMAAのエッジ検出は sRGB 値を前提にする
    this.cinematicAnimePass = new ShaderPass(CinematicAnimeShader);
    this.cinematicAnimePass.uniforms['uResolution'].value.set(targetW, targetH);
    this.composer.addPass(this.cinematicAnimePass);

    this.smaaPass = new SMAAPass();
    this.smaaPass.setSize(targetW, targetH);
    this.composer.addPass(this.smaaPass);

    this.hairShadow = new HairShadowRenderer(targetW, targetH);
    // ライトラップで髪かどうかを判定するため、髪の深度を渡す
    this.lightWrapPass.uniforms['tHair'].value = this.hairShadow.depthTexture;

    // 8. ローダー & 多層背景メッシュ初期化
    this.textureLoader = new THREE.TextureLoader();
    this.initLayeredMeshes();

    // 9. 初期設定の適用
    this.setTimeOfDay(options.initialTimeOfDay || 'day');
    this.setLocation(options.initialLocationId || 'classroom');

    // 10. レンダリングループ開始
    this.startRenderLoop();
  }

  private initLayeredMeshes(): void {
    const geo = new THREE.PlaneGeometry(3.0, 2.0);

    // 中景 (renderOrder = -1: アバターの背後)
    const midMat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      visible: false,
    });
    this.midgroundMesh = new THREE.Mesh(geo, midMat);
    this.midgroundMesh.renderOrder = -1;
    this.scene.add(this.midgroundMesh);

    // 3D空間に置く遠景（中景よりさらに奥）
    this.backdropMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, toneMapped: false })
    );
    this.backdropMesh.name = 'Backdrop';
    this.backdropMesh.renderOrder = -2;
    this.backdropMesh.visible = false;
    this.scene.add(this.backdropMesh);

    // 近景 (renderOrder = 2: アバターの手前)
    const nearMat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      visible: false,
    });
    this.neargroundMesh = new THREE.Mesh(geo.clone(), nearMat);
    this.neargroundMesh.renderOrder = 2;
    this.scene.add(this.neargroundMesh);
  }

  /** シーン設定を差し替えて、今の時間帯・場所に当て直す（Studio での編集をその場で反映する） */
  public setPresets(presets: StagePresets): void {
    const previous = this.presets;
    this.presets = presets;
    this.setTimeOfDay(this.currentTimeOfDay);
    const location = this.currentLocationId;
    if (JSON.stringify(previous.locations[location]) !== JSON.stringify(presets.locations[location])) {
      this.setLocation(location);
    }
  }

  public getCurrentTimeOfDay(): TimeOfDayId {
    return this.currentTimeOfDay;
  }

  public getCurrentLocationId(): string {
    return this.currentLocationId;
  }

  /**
   * 時間帯設定の適用（ライト・空・太陽・ブルーム・ポストプロセス・マテリアル・フォグ）
   * ロケーションとは直交し、独立して更新
   */
  public setTimeOfDay(todId: TimeOfDayId): void {
    this.currentTimeOfDay = todId;
    const preset = this.presets.timeOfDay[todId] || this.presets.timeOfDay.day;

    // 1. 平行光
    this.directionalLight.color.set(preset.lighting.directional.color);
    this.directionalLight.intensity = preset.lighting.directional.intensity;
    this.directionalLight.position.set(
      preset.lighting.directional.position.x,
      preset.lighting.directional.position.y,
      preset.lighting.directional.position.z
    );

    // 2. 環境光
    this.ambientLight.color.set(preset.lighting.ambient.color);
    this.ambientLight.intensity = preset.lighting.ambient.intensity;

    // 2.4 天使の輪の色（時間帯の光になじませる）
    setHairRingTint(preset.lighting.hairRingTint);

    // 2.5 リムライト
    const rim = preset.lighting.rim;
    this.rimLight.intensity = rim?.enabled ? rim.intensity : 0;
    if (rim) {
      this.rimLight.color.set(rim.color);
      this.rimLight.position.set(rim.position.x, rim.position.y, rim.position.z);
    }

    // 3. 空と雲 (SkyBackground)
    this.skyBackground.setTimeOfDay(todId);

    // 4. ブルーム
    this.bloomPass.enabled = preset.postProcessing.bloom.enabled;
    this.bloomPass.strength = preset.postProcessing.bloom.strength;
    this.bloomPass.radius = preset.postProcessing.bloom.radius;
    this.bloomPass.threshold = preset.postProcessing.bloom.threshold;

    // 5. ゴッドレイ（サンシャフト）
    const sunShafts = preset.lighting.sunShafts;
    this.godRaysPass.enabled = sunShafts?.enabled ?? false;
    if (sunShafts) {
      this.godRaysPass.uniforms['uExposure'].value = sunShafts.exposure;
      this.godRaysPass.uniforms['uDecay'].value = sunShafts.decay;
      this.godRaysPass.uniforms['uDensity'].value = sunShafts.density;
      this.godRaysPass.uniforms['uWeight'].value = sunShafts.weight;
      (this.godRaysPass.uniforms['uRayColor'].value as THREE.Color).set(sunShafts.color);
      this.godRaysPass.uniforms['uShimmer'].value = sunShafts.shimmer;
    }

    // 5.5 パラ（divine のように逆光シルエットを締めたい時間帯はプリセットで切る）
    applyParaParams(this.paraPass.uniforms as typeof ParaShader.uniforms, {
      ...DEFAULT_PARA_PARAMS,
      ...preset.postProcessing.para,
    });

    // 6. CinematicAnimeShader (Uber Pass)
    const u = this.cinematicAnimePass.uniforms;
    const c = preset.postProcessing.cinematic;

    u.uDiffusionEnabled.value = c.diffusion.enabled ? 1.0 : 0.0;
    u.uDiffusionStrength.value = c.diffusion.strength;
    u.uDiffusionRadius.value = c.diffusion.radius;

    u.uColorGradingEnabled.value = c.colorGrading.enabled ? 1.0 : 0.0;
    // このパスは OutputPass の後（sRGB 空間）で動くため、色は sRGB の値のまま渡す
    u.uShadowTint.value.set(c.colorGrading.shadowTint).convertLinearToSRGB();
    u.uHighlightTint.value.set(c.colorGrading.highlightTint).convertLinearToSRGB();
    u.uGradingStrength.value = c.colorGrading.strength;
    u.uGradingContrast.value = c.colorGrading.contrast;
    u.uGamma.value = c.colorGrading.gamma;

    u.uSaturation.value = c.adjustments.saturation;
    u.uBrightness.value = c.adjustments.brightness;
    u.uContrast.value = c.adjustments.contrast;

    u.uVignetteEnabled.value = c.vignette.enabled ? 1.0 : 0.0;
    u.uVignetteOffset.value = c.vignette.offset;
    u.uVignetteDarkness.value = c.vignette.darkness;
    u.uVignetteColor.value.set(c.vignette.color).convertLinearToSRGB();

    u.uChromaticAberrationEnabled.value = c.chromaticAberration.enabled ? 1.0 : 0.0;
    u.uChromaticAberrationOffset.value = c.chromaticAberration.offset;

    u.uSharpenEnabled.value = c.sharpen.enabled ? 1.0 : 0.0;
    u.uSharpenAmount.value = c.sharpen.amount;

    // 7. フォグ
    if (preset.fog.enabled) {
      this.scene.fog = new THREE.FogExp2(preset.fog.color, preset.fog.density);
    } else {
      this.scene.fog = null;
    }

    // 8. ロード済みアバターのMToonマテリアルを一括更新
    this.loadedAvatars.forEach((avatar) => {
      avatar.updateMaterialPreset(preset.materials, preset.outline);
    });
  }

  /**
   * ロケーション設定の適用（多層背景の切り替え）
   * 時間帯とは直交し、独立して更新
   */
  public setLocation(locationId: string): void {
    this.currentLocationId = locationId;
    const locPreset = this.presets.locations[locationId] || this.presets.locations.classroom;

    // 1. 遠景画像 (SkyBackground の前面にアルファカット合成)
    if (locPreset.layers.background.url) {
      this.textureLoader.load(resolveAssetUrl(locPreset.layers.background.url), (texture) => {
        if (this.isDisposed || this.currentLocationId !== locationId) return;
        texture.colorSpace = THREE.SRGBColorSpace;
        this.locationBackgroundTexture = texture;
        this.applyBackdrop();
      });
    } else {
      this.locationBackgroundTexture = null;
      this.applyBackdrop();
    }

    this.applyEnvironment();

    // 立ち位置・カメラは場所ごとの設定に合わせる
    this.applyCameraSettings();
    this.applyCastLayout();

    // 2. 中景 (Midground: renderOrder = -1)
    if (this.midgroundMesh) {
      const mid = locPreset.layers.midground;
      if (mid && mid.url) {
        this.textureLoader.load(resolveAssetUrl(mid.url), (texture) => {
          if (this.isDisposed || !this.midgroundMesh) return;
          texture.colorSpace = THREE.SRGBColorSpace;
          const mat = this.midgroundMesh.material as THREE.MeshBasicMaterial;
          mat.map = texture;
          mat.opacity = mid.opacity ?? 1.0;
          mat.needsUpdate = true;
          mat.visible = true;
          this.updateLayerPlacement();
        });
      } else {
        (this.midgroundMesh.material as THREE.MeshBasicMaterial).visible = false;
      }
    }

    // 3. 近景 (Nearground: renderOrder = 2)
    if (this.neargroundMesh) {
      const near = locPreset.layers.nearground;
      if (near && near.url) {
        this.textureLoader.load(resolveAssetUrl(near.url), (texture) => {
          if (this.isDisposed || !this.neargroundMesh) return;
          texture.colorSpace = THREE.SRGBColorSpace;
          const mat = this.neargroundMesh.material as THREE.MeshBasicMaterial;
          mat.map = texture;
          mat.opacity = near.opacity ?? 1.0;
          mat.needsUpdate = true;
          mat.visible = true;
          this.updateLayerPlacement();
        });
      } else {
        (this.neargroundMesh.material as THREE.MeshBasicMaterial).visible = false;
      }
    }
  }

  /** Studio の俯瞰表示用：今のカメラ（読み取りだけに使う） */
  public get viewCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /** Studio の俯瞰表示用：登場中のキャラの立ち位置・向き・頭の高さ */
  public getCastLayout(): Array<{ id: string; position: [number, number, number]; rotationY: number; headHeight: number }> {
    return this.castIds.flatMap((id) => {
      const root = this.loadedAvatars.get(id)?.vrm?.scene;
      if (!root) return [];
      return [{ id, position: root.position.toArray() as [number, number, number], rotationY: root.rotation.y, headHeight: this.castHeadHeights.get(id) ?? 1.42 }];
    });
  }

  /** 今の場所の配置とカメラの設定 */
  private get locationStage(): LocationStage | undefined {
    return this.presets.locations[this.currentLocationId]?.stage;
  }

  /** 遠景を画面に貼るか、3D空間に置くか（流れる背景を出している間はどちらも出さない） */
  private applyBackdrop(): void {
    const texture = this.locationBackgroundTexture;
    const backdrop = { ...DEFAULT_BACKDROP, ...this.locationStage?.backdrop };
    const inWorld = backdrop.mode === 'world' && texture !== null;
    const scrolling = this.scrollingBackground.isVisible;
    this.skyBackground.setBackgroundTexture(scrolling || inWorld ? null : texture);
    // 遠景だけの明るさ（暗い室内から見た屋外など）
    const exposure = this.presets.locations[this.currentLocationId]?.layers.background.exposure ?? 1;
    this.skyBackground.material.uniforms.uExposure.value = exposure;
    this.backdropMesh.material.color.setScalar(exposure);
    this.backdropMesh.visible = inWorld && !scrolling;
    if (inWorld) {
      const image = texture.image as { width?: number; height?: number } | undefined;
      const aspect = image?.width && image?.height ? image.width / image.height : 16 / 9;
      this.backdropMesh.material.map = texture;
      this.backdropMesh.material.needsUpdate = true;
      this.backdropMesh.position.set(0, backdrop.offsetY, -backdrop.distance);
      this.backdropMesh.scale.set(backdrop.height * aspect, backdrop.height, 1);
    }
  }

  /**
   * 遠景を画面に貼るときは、中景・近景もカメラの前に貼り付ける（旧ルートと同じ置き方。
   * 中景は注視点の少し奥、近景は手前に置き、画面の高さに合わせて大きさを決める）。
   * 3D空間に置くときは場所の設定の座標に置く
   */
  private updateLayerPlacement(): void {
    const location = this.presets.locations[this.currentLocationId];
    if (!location) return;
    const backdrop = { ...DEFAULT_BACKDROP, ...this.locationStage?.backdrop };
    const onScreen = backdrop.mode !== 'world';
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    const targetDist = this.camera.position.distanceTo(this.cameraCurrentTarget);
    const frustumHeightAt = (dist: number) => 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const aspectMultiplier = Math.max(1, this.camera.aspect / (16 / 9));
    // 平面の元の大きさ（initLayeredMeshes の PlaneGeometry）
    const baseW = 3;
    const baseH = 2;

    const mid = location.layers.midground;
    if (this.midgroundMesh && mid?.url) {
      if (onScreen) {
        const dist = Math.max(targetDist + 0.3, 2.1);
        const height = frustumHeightAt(dist) * (mid.scale ?? 1.15) * aspectMultiplier;
        this.midgroundMesh.position
          .copy(this.camera.position)
          .addScaledVector(forward, dist)
          .addScaledVector(right, mid.position?.x ?? 0)
          .addScaledVector(up, (mid.position?.y ?? 1.35) - 1.35);
        this.midgroundMesh.quaternion.copy(this.camera.quaternion);
        this.midgroundMesh.scale.set((height * 16) / 9 / baseW, height / baseH, 1);
      } else {
        const pos = mid.position ?? { x: 0, y: 1.35, z: -0.25 };
        this.midgroundMesh.position.set(pos.x, pos.y, pos.z);
        this.midgroundMesh.quaternion.identity();
        this.midgroundMesh.scale.set(mid.scale ?? 1, mid.scale ?? 1, 1);
      }
    }

    const near = location.layers.nearground;
    if (this.neargroundMesh && near?.url) {
      if (onScreen) {
        const dist = Math.max(targetDist * 0.65, 0.4);
        const frustumHeight = frustumHeightAt(dist);
        const image = (this.neargroundMesh.material as THREE.MeshBasicMaterial).map?.image as { width?: number; height?: number } | undefined;
        const imageAspect = image?.width && image?.height ? image.width / image.height : 4 / 3;
        const width = ((frustumHeight * 16) / 9) * (near.scale ?? 1);
        this.neargroundMesh.position
          .copy(this.camera.position)
          .addScaledVector(forward, dist)
          .addScaledVector(right, near.position?.x ?? 0)
          .addScaledVector(up, -0.0852 * frustumHeight + (near.position?.y ?? 0));
        this.neargroundMesh.quaternion.copy(this.camera.quaternion);
        this.neargroundMesh.scale.set(width / baseW, width / imageAspect / baseH, 1);
      } else {
        const pos = near.position ?? { x: 0, y: 0.8, z: 0.6 };
        this.neargroundMesh.position.set(pos.x, pos.y, pos.z);
        this.neargroundMesh.quaternion.identity();
        this.neargroundMesh.scale.set(near.scale ?? 1, near.scale ?? 1, 1);
      }
    }
  }

  /** 3D背景を読み込んで置く（同じモデルなら置き直すだけ） */
  private applyEnvironment(): void {
    const settings = this.presets.locations[this.currentLocationId]?.environment;
    if (this.environment && this.environment.model !== settings?.model) {
      if (this.environment.object) {
        this.scene.remove(this.environment.object);
        disposeEnvironment(this.environment.model, this.environment.object);
      }
      this.environment = null;
    }
    if (!settings) return;
    if (this.environment) {
      if (this.environment.object) placeEnvironment(this.environment.object, settings);
      return;
    }
    const entry = { model: settings.model, object: null as THREE.Object3D | null };
    this.environment = entry;
    loadEnvironment(settings.model)
      .then((object) => {
        // 読み込み中に場所が変わった・破棄された
        if (this.environment !== entry || this.isDisposed) {
          disposeEnvironment(settings.model, object);
          return;
        }
        entry.object = object;
        placeEnvironment(object, this.presets.locations[this.currentLocationId]?.environment ?? settings);
        this.scene.add(object);
      })
      .catch((err) => console.error(`3D背景を読み込めません: ${settings.model}`, err));
  }

  private applyCameraSettings(): void {
    const fov = this.locationStage?.camera?.fov ?? DEFAULT_CAMERA_FOV;
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.updateCameraTarget();
  }

  /** 立ち位置（座標の指定がなければ、場所の設定か既定のスロット位置） */
  private resolvePosition(member: StageCastMember): [number, number, number] {
    if (member.position) return member.position;
    const slot = member.slot ?? 'center';
    return this.locationStage?.slots?.[slot] ?? DEFAULT_SLOT_POSITIONS[slot];
  }

  /** 登場中のキャラを立ち位置に置き直す（場所の設定が変わったとき） */
  private applyCastLayout(): void {
    for (const member of this.castMembers) {
      const avatar = this.loadedAvatars.get(member.id);
      if (!avatar?.vrm || !this.castIds.includes(member.id)) continue;
      const position = this.resolvePosition(member);
      avatar.vrm.scene.position.set(...position);
      avatar.vrm.scene.rotation.y = member.rotationY ?? -position[0] * 0.5;
      this.castPositions.set(member.id, position[0]);
      this.castDepths.set(member.id, position[2]);
    }
    this.updateCameraTarget();
  }

  /**
   * アバターの非同期ロード
   */
  public loadAvatar(id: string, modelUrl: string): Promise<StageAvatar> {
    const loaded = this.loadedAvatars.get(id);
    if (loaded?.modelUrl === modelUrl) return Promise.resolve(loaded);
    // 同じキャラでモデル（服装など）が変わったら作り直す
    if (loaded) {
      loaded.dispose();
      this.loadedAvatars.delete(id);
      this.avatarMotionUrls.delete(id);
      const timer = this.motionReturnTimers.get(id);
      if (timer !== undefined) window.clearTimeout(timer);
      this.motionReturnTimers.delete(id);
    }
    // 読み込み中なら同じ Promise を返す（同じキャラを二重に作らない）
    const pending = this.pendingAvatars.get(id);
    if (pending) {
      return pending.then((avatar) => (avatar.modelUrl === modelUrl ? avatar : this.loadAvatar(id, modelUrl)));
    }

    const promise = this.createAvatar(id, modelUrl).finally(() => this.pendingAvatars.delete(id));
    this.pendingAvatars.set(id, promise);
    return promise;
  }

  private async createAvatar(id: string, modelUrl: string): Promise<StageAvatar> {
    const avatar = new StageAvatar({
      id,
      modelUrl,
      scene: this.scene,
      camera: this.camera,
      hairShadow: this.hairShadow.uniforms,
    });

    await avatar.load(modelUrl);

    // 現在の時間帯マテリアル設定を初期反映
    const currentPreset = this.presets.timeOfDay[this.currentTimeOfDay] || this.presets.timeOfDay.day;
    avatar.updateMaterialPreset(currentPreset.materials, currentPreset.outline);

    this.loadedAvatars.set(id, avatar);
    return avatar;
  }

  /**
   * 登場キャラの配置（モデルの読み込み・位置・向き・表情・モーション）。
   * 指定にないキャラは隠す
   */
  public async setCast(members: StageCastMember[]): Promise<void> {
    const version = ++this.castVersion;
    this.castMembers = members;
    const avatars = await Promise.all(
      members.map((member) => this.loadAvatar(member.id, member.modelUrl).catch((err) => {
        console.error(`Failed to load avatar ${member.id}:`, err);
        return null;
      }))
    );
    if (version !== this.castVersion || this.isDisposed) return;

    const ids = new Set(members.map((member) => member.id));
    this.loadedAvatars.forEach((avatar, id) => {
      if (!ids.has(id) && avatar.vrm) {
        avatar.vrm.scene.visible = false;
        avatar.effects?.clearOneShots();
      }
    });

    this.castIds = [];
    this.castPositions.clear();
    this.castDepths.clear();
    this.castHeadHeights.clear();
    members.forEach((member, index) => {
      const avatar = avatars[index];
      if (!avatar?.vrm) return;
      const position = this.resolvePosition(member);
      avatar.vrm.scene.position.set(...position);
      avatar.vrm.scene.rotation.y = member.rotationY ?? -position[0] * 0.5;
      avatar.vrm.scene.visible = true;
      avatar.setDaylight(member.daylight ?? 0);
      avatar.setExpression(member.expression, member.expressionWeight);
      this.playMotion(member.id, avatar, member.motion, member.motionLoop, member.motionCue);
      this.castIds.push(member.id);
      this.castPositions.set(member.id, position[0]);
      this.castDepths.set(member.id, position[2]);
      this.castHeadHeights.set(member.id, this.getHeadHeight(avatar));
    });

    // キャラの位置が決まったので構図を取り直す
    this.updateCameraTarget();
    // カットのタイムラインを、読み込んだキャラに当て直す（同じモーションは続けて再生する）
    this.appliedCut.clear();
    this.applyCutState(false);
  }

  /** 頭の高さ（直立時）。取得できなければ標準的な背丈を返す */
  private getHeadHeight(avatar: StageAvatar): number {
    const head = avatar.vrm?.humanoid?.getRawBoneNode('head');
    if (!head) return 1.4;
    avatar.vrm!.scene.updateMatrixWorld(true);
    const y = head.getWorldPosition(new THREE.Vector3()).y - avatar.vrm!.scene.position.y;
    return y > 0.8 && y < 2.2 ? y : 1.4;
  }

  /** モーション再生。1回きりのモーションは終わったら待機モーションへ戻す */
  private playMotion(id: string, avatar: StageAvatar, motion: string | undefined, loop: boolean, cue = '', offsetSec = 0): void {
    const url = motion ? `/animations/${motion}.fbx` : IDLE_ANIMATION_URL;
    // 指定が変わった時だけ再生する（1回きりの身振りが待機に戻った後、同じ指定で再生し直さない）
    const key = `${url}|${loop}|${cue}`;
    if (this.avatarMotionUrls.get(id) === key) return;
    this.avatarMotionUrls.set(id, key);

    const pending = this.motionReturnTimers.get(id);
    if (pending !== undefined) window.clearTimeout(pending);
    this.motionReturnTimers.delete(id);

    avatar.playAnimation(url, loop).then((action) => {
      // 頭出しでは途中から再生する
      if (action && offsetSec > 0) action.time = loop ? offsetSec % action.getClip().duration : Math.min(offsetSec, action.getClip().duration);
      if (loop || !action || this.isDisposed) return;
      const durationMs = Math.max(0, action.getClip().duration - action.time) * 1000;
      const timer = window.setTimeout(() => {
        this.motionReturnTimers.delete(id);
        if (this.avatarMotionUrls.get(id) !== key) return;
        avatar.playAnimation(IDLE_ANIMATION_URL, true);
      }, durationMs);
      this.motionReturnTimers.set(id, timer);
    });
  }

  /** 歩きながらの会話などで背景を横に流す（null で止めて場所の遠景に戻す） */
  public setScrollingBackground(settings: ScrollingBackgroundSettings | null): void {
    this.scrollingBackground.set(settings);
    this.applyBackdrop();
  }

  /** 口パクさせるキャラ（話者） */
  public setSpeaker(id: string | null): void {
    this.speakerId = id;
  }

  /** カメラ構図の指定（focusId は話者など、寄る対象） */
  /** Studio 用：カメラを手で動かす間は構図の自動決定を止める（戻すと今の構図へ動く） */
  public setFreeCamera(enabled: boolean): void {
    this.freeCamera = enabled;
    if (!enabled) {
      this.cameraFrom = { position: this.camera.position.clone(), target: this.cameraCurrentTarget.clone() };
      this.cameraElapsed = 0;
    }
  }

  /** Studio 用：手で動かしたカメラの注視点を伝える（戻したときにそこから補間する） */
  public setFreeCameraTarget(target: THREE.Vector3): void {
    this.cameraCurrentTarget.copy(target);
  }

  /** 今の注視点（カメラを手で動かすときの初期値） */
  public get viewTarget(): THREE.Vector3 {
    return this.cameraCurrentTarget.clone();
  }

  /** カットでカメラを直接指定する（null で構図の自動決定に戻す） */
  public setCameraPose(pose: CameraPoseSetting | null): void {
    this.basePose = pose;
    this.updateCameraTarget();
  }

  /** カット内のタイムライン（キーフレーム）。カットが変わったら呼ぶ */
  public setCutTimeline(scene: ScenarioScene | null): void {
    this.cutScene = scene;
    this.cutTime = 0;
    this.cutStartedAt = this.clock.getElapsedTime();
    this.appliedCut.clear();
    this.appliedCutCamera = '';
    // 前のカットの文字演出・汗は消す
    this.firedOneShots.clear();
    this.loadedAvatars.forEach((avatar) => avatar.effects?.clearOneShots());
    this.screenEffects?.playTransition(scene?.screenTransition ?? null);
    this.applyCutState(false);
  }

  /** カットの切り替え演出（暗転・瞼）をもう一度見せる（Studio で先頭から再生したとき） */
  public replayScreenTransition(): void {
    this.screenEffects?.playTransition(this.cutScene?.screenTransition ?? null);
  }

  /** 文字演出などの言語 */
  public setLanguage(language: 'ja' | 'en'): void {
    this.language = language;
  }

  /**
   * カット内の時刻（ボイスの再生位置、なければカット開始からの秒数）。
   * seek が true なら、その時刻の状態へ飛ぶ（モーションも途中から）
   */
  public setCutTime(time: number, seek = false): void {
    this.cutTime = time;
    this.applyCutState(seek);
  }

  /** カットの指定にタイムラインを重ねた状態を、変わったところだけ当てる */
  private applyCutState(seek: boolean): void {
    const state: CutState = this.cutScene ? cutStateAt(this.cutScene, this.cutTime) : { avatars: {}, camera: {}, focusLines: false, oneShots: [] };
    for (const member of this.castMembers) {
      const avatar = this.loadedAvatars.get(member.id);
      if (!avatar?.vrm || !this.castIds.includes(member.id)) continue;
      const key = state.avatars[member.id] ?? {};
      const look = member.look ?? DEFAULT_AVATAR_LOOK;
      const effective = {
        expression: key.expression ?? member.expression,
        expressionWeight: key.expression !== undefined ? (key.expressionWeight ?? 1) : member.expressionWeight,
        motion: key.motion ?? member.motion,
        motionLoop: key.motion !== undefined ? (key.motionLoop ?? false) : member.motionLoop,
        motionCue: key.motionAt !== undefined ? `timeline@${key.motionAt}` : member.motionCue,
        motionAt: key.motionAt,
        lookAtTarget: key.lookAtTarget ?? member.lookAtTarget,
        headTurn: key.headTurn ?? member.headTurn,
        visible: key.visible ?? true,
        blush: key.blush ?? look.blush,
        anger: key.anger ?? look.anger,
        tears: key.tears ?? look.tears,
        eyeWander: key.eyeWander ?? look.eyeWander,
        fastMotion: look.fastMotion,
        motionSpeed: key.motionSpeed ?? look.motionSpeed,
      };
      const json = JSON.stringify(effective);
      const previous = this.appliedCut.get(member.id);
      if (previous === json && !seek) continue;
      const before = previous ? (JSON.parse(previous) as typeof effective) : null;
      this.appliedCut.set(member.id, json);
      if (!before || before.expression !== effective.expression || before.expressionWeight !== effective.expressionWeight) {
        avatar.setExpression(effective.expression, effective.expressionWeight);
      }
      const motionChanged = !before || before.motion !== effective.motion || before.motionCue !== effective.motionCue || before.motionLoop !== effective.motionLoop;
      if (motionChanged || seek) {
        const offset = seek && effective.motionAt !== undefined ? this.cutTime - effective.motionAt : 0;
        // 頭出しのときは同じモーションでも再生し直す
        if (seek) this.avatarMotionUrls.delete(member.id);
        this.playMotion(member.id, avatar, effective.motion, effective.motionLoop, effective.motionCue, offset);
      }
      avatar.vrm.scene.visible = effective.visible;
      this.gaze.set(member.id, { target: effective.lookAtTarget, headTurn: effective.headTurn });
      if (!before || before.motionSpeed !== effective.motionSpeed) avatar.setMotionSpeed(effective.motionSpeed);
      const effects = avatar.effects;
      if (effects) {
        effects.setBlush(effective.blush);
        effects.setAnger(effective.anger);
        effects.setTears(effective.tears);
        effects.setEyeWander(effective.eyeWander);
        effects.setFastMotion(effective.fastMotion);
      }
    }

    this.screenEffects?.setFocusLines(state.focusLines);
    this.fireOneShots(state.oneShots, seek);

    const camera = state.camera;
    const cameraJson = JSON.stringify(camera);
    if (cameraJson !== this.appliedCutCamera || seek) {
      this.appliedCutCamera = cameraJson;
      this.timelineShot = camera.pose ? null : (camera.shot ?? null);
      this.timelinePose = camera.pose ? { pose: camera.pose, duration: seek ? 0 : camera.duration } : null;
      this.updateCameraTarget();
    }
  }

  /**
   * 時刻が来た文字演出・汗を出す（読み込み中のキャラは読み込み後に出す）。
   * 頭出しのときは直前（1秒以内）のものだけ出し直す
   */
  private fireOneShots(shots: AvatarOneShot[], seek: boolean): void {
    if (seek) {
      this.firedOneShots.clear();
      this.loadedAvatars.forEach((avatar) => avatar.effects?.clearOneShots());
    }
    for (const shot of shots) {
      if (this.firedOneShots.has(shot.key)) continue;
      const avatar = this.loadedAvatars.get(shot.id);
      if (!avatar?.effects || !this.castIds.includes(shot.id)) continue;
      this.firedOneShots.add(shot.key);
      if (seek && this.cutTime - shot.at > 1) continue;
      if (shot.effectText) {
        const spec = typeof shot.effectText === 'string' ? { preset: shot.effectText } : shot.effectText;
        avatar.effects.showText(spec.preset as EffectPresetName, this.localize(spec.text), spec.duration);
      }
      if (shot.sweat) avatar.effects.showSweat(shot.sweat);
    }
  }

  private localize(text: TextContent | undefined): string | undefined {
    if (text === undefined || typeof text === 'string') return text;
    return (this.language === 'en' ? text.en : undefined) ?? text.ja;
  }

  /** 視線の先のワールド座標（カメラ・話者・相手・キャラ ID） */
  private gazeTargetFor(id: string, target: string | undefined): THREE.Vector3 | null {
    if (!target || target === 'forward') return null;
    if (target === 'camera' || target === 'player') return this.camera.position.clone();
    const headOf = (otherId: string | null | undefined) => {
      if (!otherId || otherId === id) return null;
      const head = this.loadedAvatars.get(otherId)?.vrm?.humanoid?.getNormalizedBoneNode('head');
      return head && this.castIds.includes(otherId) ? head.getWorldPosition(new THREE.Vector3()) : null;
    };
    if (target === 'speaker') return headOf(this.speakerId) ?? this.camera.position.clone();
    if (target === 'partner') {
      // 話者でなければ話者を、話者なら一番近い相手を見る
      const partner = this.speakerId && this.speakerId !== id ? this.speakerId : this.castIds.find((other) => other !== id);
      return headOf(partner) ?? this.camera.position.clone();
    }
    return headOf(target);
  }

  public setCameraShot(shot: CameraShot, focusId: string | null): void {
    this.cameraShot = shot;
    this.cameraFocusId = focusId;
    this.updateCameraTarget();
  }

  /** 構図と登場キャラの位置から、カメラの目標位置を決めて補間を始める */
  private updateCameraTarget(): void {
    const xs = this.castIds.map((id) => this.castPositions.get(id) ?? 0);
    const focusX =
      (this.cameraFocusId !== null ? this.castPositions.get(this.cameraFocusId) : undefined) ??
      (xs.length === 1 ? xs[0] : 0);
    const centerX = xs.length > 0 ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    const spread = xs.length > 1 ? Math.max(...xs) - Math.min(...xs) : 0;
    // 頭の高さに合わせて構図を上下させる（標準は頭の高さ 1.42）。複数人の構図は一番背の高い人に合わせる
    const heads = this.castIds.map((id) => this.castHeadHeights.get(id) ?? 1.42);
    const tallest = heads.length > 0 ? Math.max(...heads) : 1.42;
    const focusHead =
      (this.cameraFocusId !== null ? this.castHeadHeights.get(this.cameraFocusId) : undefined) ??
      (heads.length === 1 ? heads[0] : tallest);

    // 奥行きはキャラの立ち位置に合わせる（カメラは注視点から手前へ distance 離れる）
    const zs = this.castIds.map((id) => this.castDepths.get(id) ?? 0);
    const centerZ = zs.length > 0 ? (Math.min(...zs) + Math.max(...zs)) / 2 : 0;
    const focusZ = (this.cameraFocusId !== null ? this.castDepths.get(this.cameraFocusId) : undefined) ?? centerZ;
    const shotName = this.timelineShot ?? this.cameraShot;
    const rig = { ...DEFAULT_SHOT_RIGS[shotName], ...this.locationStage?.camera?.[shotName] };

    let x: number;
    let z: number;
    let head: number;
    let distance = rig.distance;
    switch (shotName) {
      case 'wide':
        // 横に広がるほど引く
        x = centerX;
        z = centerZ;
        head = tallest;
        distance += spread * 0.9;
        break;
      case 'medium':
        x = focusX * 0.6 + centerX * 0.4;
        z = focusZ * 0.6 + centerZ * 0.4;
        head = tallest;
        break;
      default:
        x = focusX;
        z = focusZ;
        head = focusHead;
        break;
    }
    // 直接指定（タイムライン → カット）があれば構図より優先する
    const direct = this.timelinePose?.pose ?? (this.timelineShot ? null : this.basePose);
    const pose: CameraPose = direct
      ? { position: new THREE.Vector3(...direct.position), target: new THREE.Vector3(...direct.target) }
      : {
          position: new THREE.Vector3(x, head + rig.height, z + distance),
          target: new THREE.Vector3(x, head + rig.targetHeight, z),
        };
    const fov = direct?.fov ?? this.locationStage?.camera?.fov ?? DEFAULT_CAMERA_FOV;
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.cameraTransitionSec = this.timelinePose?.duration ?? CAMERA_TRANSITION_SEC;

    if (
      this.hasCameraPose &&
      pose.position.distanceTo(this.cameraTo.position) < 1e-4 &&
      pose.target.distanceTo(this.cameraTo.target) < 1e-4
    ) {
      return;
    }

    this.cameraFrom = { position: this.camera.position.clone(), target: this.cameraCurrentTarget.clone() };
    this.cameraTo = pose;
    // 最初の構図は補間せずに合わせる
    this.cameraElapsed = this.hasCameraPose ? 0 : this.cameraTransitionSec;
    this.hasCameraPose = true;
  }

  private updateCamera(delta: number): void {
    const duration = Math.max(1e-3, this.cameraTransitionSec);
    this.cameraElapsed = Math.min(duration, this.cameraElapsed + delta);
    const t = easeInOutCubic(this.cameraElapsed / duration);
    this.camera.position.lerpVectors(this.cameraFrom.position, this.cameraTo.position, t);
    this.cameraCurrentTarget.lerpVectors(this.cameraFrom.target, this.cameraTo.target, t);
    this.camera.lookAt(this.cameraCurrentTarget);
  }

  /**
   * 表情の設定（スムーズなクロスフェード補間）
   */
  public setExpression(id: string, expressionName: string, weight = 1.0, duration = 0.25): void {
    const avatar = this.loadedAvatars.get(id);
    if (avatar) {
      avatar.setExpression(expressionName, weight, duration);
    }
  }

  public resize(width: number, height: number): void {
    if (height <= 0 || width <= 0) return;
    const pr = Math.min(window.devicePixelRatio, 2);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(pr);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(width, height);

    const targetW = Math.floor(width * pr);
    const targetH = Math.floor(height * pr);

    this.bloomPass.resolution.set(targetW, targetH);
    this.cinematicAnimePass.uniforms['uResolution'].value.set(targetW, targetH);
    this.smaaPass.setSize(targetW, targetH);
    this.hairShadow.setSize(targetW, targetH);
    this.characterMask.setSize(targetW, targetH);
    this.lightWrapPass.uniforms['uResolution'].value.set(targetW, targetH);
    this.screenEffects?.resize();
  }

  /**
   * メインレンダリングループ
   */
  private startRenderLoop(): void {
    const animate = () => {
      if (this.isDisposed) return;
      this.animationFrameId = requestAnimationFrame(animate);

      const delta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();

      const currentPreset = this.presets.timeOfDay[this.currentTimeOfDay] || this.presets.timeOfDay.day;

      // 0. カット内のタイムライン、カメラ構図の補間と、流れる背景
      if (this.getCutTime && this.cutScene) {
        const time = this.getCutTime() ?? elapsed - this.cutStartedAt;
        if (time !== this.cutTime) this.setCutTime(time);
      }
      if (!this.freeCamera) this.updateCamera(delta);
      this.updateLayerPlacement();
      this.scrollingBackground.update(delta);

      // 1. 登場中のアバターの更新（口パクは話者だけ）
      const activeMeshes: THREE.Object3D[] = [];
      for (const id of this.castIds) {
        const avatar = this.loadedAvatars.get(id);
        if (!avatar?.vrm || !avatar.vrm.scene.visible) continue;
        avatar.updateLipSync(id === this.speakerId ? this.getSpeakerPhoneme?.() : undefined);
        const gaze = this.gaze.get(id);
        avatar.setGaze(this.gazeTargetFor(id, gaze?.target), gaze?.headTurn ?? 0.5);
        avatar.update(delta, { elapsed, camera: this.camera, renderer: this.renderer });
        activeMeshes.push(avatar.vrm.scene);
      }

      // 2. 太陽・レンズフレア・オクルージョン計算
      const sunInfo = this.sunEffect.update(
        this.camera,
        delta,
        elapsed,
        { lighting: currentPreset.lighting },
        this.directionalLight,
        activeMeshes
      );

      // 3. ゴッドレイ（サンシャフト）のユニフォーム更新
      if (this.godRaysPass.enabled) {
        this.godRaysPass.uniforms['uSunPosition'].value.copy(sunInfo.sunScreenPosition);
        this.godRaysPass.uniforms['uSunVisibility'].value = sunInfo.sunVisibility;
        this.godRaysPass.uniforms['uTime'].value = elapsed;
      }

      // 4. 空と雲のアニメーション更新
      this.skyBackground.material.uniforms.uTime.value = elapsed;

      // 5. CinematicAnimeShader の時間更新
      this.cinematicAnimePass.uniforms['uTime'].value = elapsed;

      // 6. 前髪の影用に髪の深度を描く
      this.hairShadow.render(this.renderer, this.scene, this.camera, this.directionalLight);
      if (this.lightWrapPass.uniforms['uEnabled'].value > 0.5 || this.paraPass.uniforms['uEnabled'].value > 0.5 || this.godRaysPass.enabled) {
        this.characterMask.render(this.renderer, this.scene, this.camera);
      }

      // 7. ポストプロセスパイプライン経由でレンダリング
      this.composer.render();
    };

    animate();
  }

  public dispose(): void {
    this.isDisposed = true;
    this.screenEffects?.dispose();
    this.motionReturnTimers.forEach((timer) => window.clearTimeout(timer));
    this.motionReturnTimers.clear();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.loadedAvatars.forEach((avatar) => {
      avatar.dispose();
    });
    this.loadedAvatars.clear();
    if (this.environment?.object) disposeEnvironment(this.environment.model, this.environment.object);
    this.environment = null;
    this.scrollingBackground.dispose();

    this.composer.renderTarget1?.dispose();
    this.composer.renderTarget2?.dispose();
    this.hairShadow.dispose();
    this.characterMask.dispose();
    this.renderer.dispose();
  }
}
