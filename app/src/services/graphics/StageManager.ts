import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

import { TimeOfDayId } from '../../types/visual';
import { TIME_OF_DAY_PRESETS } from '../../data/timeOfDayPresets';
import { LOCATION_VISUAL_PRESETS } from '../../data/locationVisualPresets';
import { CinematicAnimeShader } from './CinematicAnimeShader';
import { GodRaysShader } from './postprocessing/GodRaysShader';
import { SunEffect } from './postprocessing/SunEffect';
import { SkyBackground } from './scene/SkyBackground';
import { ScrollingBackground, ScrollingBackgroundSettings } from './scene/ScrollingBackground';
import { Avatar } from './avatar/Avatar';
import { HairShadowRenderer } from './shader/HairShadow';
import { CharacterMaskRenderer, LightWrapShader } from './postprocessing/LightWrap';
import { ParaShader, DEFAULT_PARA_PARAMS, applyParaParams } from './postprocessing/Para';
import { setHairRingTint } from './shader/HairRing';
import { soundManager } from '../audio/SoundManager';
import type { CameraShot } from '../../types/scenario';
import type { StageCastMember } from '../stage/sceneView';

const IDLE_ANIMATION_URL = '/animations/Standing Idle.fbx';
const CAMERA_TRANSITION_SEC = 0.6;

interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export interface StageOptions {
  canvas: HTMLCanvasElement;
  initialTimeOfDay?: TimeOfDayId;
  initialLocationId?: string;
}

export class StageManager {
  private canvas: HTMLCanvasElement;
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
  private sunEffect: SunEffect;

  // 多層背景
  private textureLoader: THREE.TextureLoader;
  private midgroundMesh: THREE.Mesh | null = null;
  private neargroundMesh: THREE.Mesh | null = null;

  // アバター管理
  private loadedAvatars: Map<string, Avatar> = new Map();
  /** 登場中のキャラ（表示順） */
  private castIds: string[] = [];
  private castPositions: Map<string, number> = new Map();
  /** 登場中のキャラの頭の高さ（構図をキャラの背丈に合わせる） */
  private castHeadHeights: Map<string, number> = new Map();
  /** 口パクさせるキャラ */
  private speakerId: string | null = null;
  /** setCast の呼び出し番号（非同期ロード中に次の指定が来たら古い指定を捨てる） */
  private castVersion = 0;
  private pendingAvatars: Map<string, Promise<Avatar>> = new Map();
  private avatarMotionUrls: Map<string, string> = new Map();
  private motionReturnTimers: Map<string, number> = new Map();

  // カメラ構図の補間
  private cameraShot: CameraShot = 'speaker';
  private cameraFocusId: string | null = null;
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
    this.clock = new THREE.Clock();

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
    this.skyBackground = new SkyBackground(this.scene);
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
    const preset = TIME_OF_DAY_PRESETS[todId] || TIME_OF_DAY_PRESETS.day;

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
    const locPreset = LOCATION_VISUAL_PRESETS[locationId] || LOCATION_VISUAL_PRESETS.classroom;

    // 1. 遠景画像 (SkyBackground の前面にアルファカット合成)
    if (locPreset.layers.background.url) {
      this.textureLoader.load(locPreset.layers.background.url, (texture) => {
        if (this.isDisposed) return;
        texture.colorSpace = THREE.SRGBColorSpace;
        this.locationBackgroundTexture = texture;
        // 流れる背景を出している間は、固定の遠景を重ねない
        if (!this.scrollingBackground.isVisible) this.skyBackground.setBackgroundTexture(texture);
      });
    } else {
      this.locationBackgroundTexture = null;
      this.skyBackground.setBackgroundTexture(null);
    }

    // 2. 中景 (Midground: renderOrder = -1)
    if (this.midgroundMesh) {
      const mid = locPreset.layers.midground;
      if (mid && mid.url) {
        this.textureLoader.load(mid.url, (texture) => {
          if (this.isDisposed || !this.midgroundMesh) return;
          texture.colorSpace = THREE.SRGBColorSpace;
          const mat = this.midgroundMesh.material as THREE.MeshBasicMaterial;
          mat.map = texture;
          mat.opacity = mid.opacity ?? 1.0;
          mat.needsUpdate = true;
          mat.visible = true;

          const pos = mid.position ?? { x: 0, y: 1.35, z: -0.25 };
          this.midgroundMesh.position.set(pos.x, pos.y, pos.z);
          const scale = mid.scale ?? 1.0;
          this.midgroundMesh.scale.set(scale, scale, 1);
        });
      } else {
        (this.midgroundMesh.material as THREE.MeshBasicMaterial).visible = false;
      }
    }

    // 3. 近景 (Nearground: renderOrder = 2)
    if (this.neargroundMesh) {
      const near = locPreset.layers.nearground;
      if (near && near.url) {
        this.textureLoader.load(near.url, (texture) => {
          if (this.isDisposed || !this.neargroundMesh) return;
          texture.colorSpace = THREE.SRGBColorSpace;
          const mat = this.neargroundMesh.material as THREE.MeshBasicMaterial;
          mat.map = texture;
          mat.opacity = near.opacity ?? 1.0;
          mat.needsUpdate = true;
          mat.visible = true;

          const pos = near.position ?? { x: 0, y: 0.8, z: 0.6 };
          this.neargroundMesh.position.set(pos.x, pos.y, pos.z);
          const scale = near.scale ?? 1.0;
          this.neargroundMesh.scale.set(scale, scale, 1);
        });
      } else {
        (this.neargroundMesh.material as THREE.MeshBasicMaterial).visible = false;
      }
    }
  }

  /**
   * アバターの非同期ロード
   */
  public loadAvatar(id: string, modelUrl: string): Promise<Avatar> {
    const loaded = this.loadedAvatars.get(id);
    if (loaded) return Promise.resolve(loaded);
    // 読み込み中なら同じ Promise を返す（同じキャラを二重に作らない）
    const pending = this.pendingAvatars.get(id);
    if (pending) return pending;

    const promise = this.createAvatar(id, modelUrl).finally(() => this.pendingAvatars.delete(id));
    this.pendingAvatars.set(id, promise);
    return promise;
  }

  private async createAvatar(id: string, modelUrl: string): Promise<Avatar> {
    const avatar = new Avatar({
      id,
      modelUrl,
      scene: this.scene,
      camera: this.camera,
      hairShadow: this.hairShadow.uniforms,
    });

    await avatar.load(modelUrl);

    // 現在の時間帯マテリアル設定を初期反映
    const currentPreset = TIME_OF_DAY_PRESETS[this.currentTimeOfDay] || TIME_OF_DAY_PRESETS.day;
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
    const avatars = await Promise.all(
      members.map((member) => this.loadAvatar(member.id, member.modelUrl).catch((err) => {
        console.error(`Failed to load avatar ${member.id}:`, err);
        return null;
      }))
    );
    if (version !== this.castVersion || this.isDisposed) return;

    const ids = new Set(members.map((member) => member.id));
    this.loadedAvatars.forEach((avatar, id) => {
      if (!ids.has(id) && avatar.vrm) avatar.vrm.scene.visible = false;
    });

    this.castIds = [];
    this.castPositions.clear();
    this.castHeadHeights.clear();
    members.forEach((member, index) => {
      const avatar = avatars[index];
      if (!avatar?.vrm) return;
      avatar.vrm.scene.position.set(...member.position);
      avatar.vrm.scene.rotation.y = member.rotationY;
      avatar.vrm.scene.visible = true;
      avatar.setExpression(member.expression, member.expressionWeight);
      this.playMotion(member.id, avatar, member.motion, member.motionLoop, member.motionCue);
      this.castIds.push(member.id);
      this.castPositions.set(member.id, member.position[0]);
      this.castHeadHeights.set(member.id, this.getHeadHeight(avatar));
    });

    // キャラの位置が決まったので構図を取り直す
    this.updateCameraTarget();
  }

  /** 頭の高さ（直立時）。取得できなければ標準的な背丈を返す */
  private getHeadHeight(avatar: Avatar): number {
    const head = avatar.vrm?.humanoid?.getRawBoneNode('head');
    if (!head) return 1.4;
    avatar.vrm!.scene.updateMatrixWorld(true);
    const y = head.getWorldPosition(new THREE.Vector3()).y - avatar.vrm!.scene.position.y;
    return y > 0.8 && y < 2.2 ? y : 1.4;
  }

  /** モーション再生。1回きりのモーションは終わったら待機モーションへ戻す */
  private playMotion(id: string, avatar: Avatar, motion: string | undefined, loop: boolean, cue = ''): void {
    const url = motion ? `/animations/${motion}.fbx` : IDLE_ANIMATION_URL;
    // 指定が変わった時だけ再生する（1回きりの身振りが待機に戻った後、同じ指定で再生し直さない）
    const key = `${url}|${loop}|${cue}`;
    if (this.avatarMotionUrls.get(id) === key) return;
    this.avatarMotionUrls.set(id, key);

    const pending = this.motionReturnTimers.get(id);
    if (pending !== undefined) window.clearTimeout(pending);
    this.motionReturnTimers.delete(id);

    avatar.playAnimation(url, loop).then((action) => {
      if (loop || !action || this.isDisposed) return;
      const durationMs = action.getClip().duration * 1000;
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
    this.skyBackground.setBackgroundTexture(settings ? null : this.locationBackgroundTexture);
  }

  /** 口パクさせるキャラ（話者） */
  public setSpeaker(id: string | null): void {
    this.speakerId = id;
  }

  /** カメラ構図の指定（focusId は話者など、寄る対象） */
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

    let pose: CameraPose;
    switch (this.cameraShot) {
      case 'wide':
        pose = {
          position: new THREE.Vector3(centerX, tallest - 0.22, 2.3 + spread * 0.9),
          target: new THREE.Vector3(centerX, tallest - 0.37, 0),
        };
        break;
      case 'medium': {
        const x = focusX * 0.6 + centerX * 0.4;
        pose = {
          position: new THREE.Vector3(x, tallest - 0.2, 2.2),
          target: new THREE.Vector3(x, tallest - 0.3, 0),
        };
        break;
      }
      case 'close':
        pose = {
          position: new THREE.Vector3(focusX, focusHead - 0.09, 1.2),
          target: new THREE.Vector3(focusX, focusHead - 0.14, 0),
        };
        break;
      case 'speaker':
      default:
        pose = {
          position: new THREE.Vector3(focusX, focusHead - 0.17, 1.6),
          target: new THREE.Vector3(focusX, focusHead - 0.27, 0),
        };
        break;
    }

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
    this.cameraElapsed = this.hasCameraPose ? 0 : CAMERA_TRANSITION_SEC;
    this.hasCameraPose = true;
  }

  private updateCamera(delta: number): void {
    this.cameraElapsed = Math.min(CAMERA_TRANSITION_SEC, this.cameraElapsed + delta);
    const t = easeInOutCubic(this.cameraElapsed / CAMERA_TRANSITION_SEC);
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

      const currentPreset = TIME_OF_DAY_PRESETS[this.currentTimeOfDay] || TIME_OF_DAY_PRESETS.day;

      // 0. カメラ構図の補間と、流れる背景
      this.updateCamera(delta);
      this.scrollingBackground.update(delta);

      // 1. 登場中のアバターの更新（口パクは話者だけ）
      const activeMeshes: THREE.Object3D[] = [];
      for (const id of this.castIds) {
        const avatar = this.loadedAvatars.get(id);
        if (!avatar?.vrm || !avatar.vrm.scene.visible) continue;
        avatar.updateLipSync(id === this.speakerId ? soundManager.getVoicePhoneme() : undefined);
        avatar.update(delta);
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
    this.motionReturnTimers.forEach((timer) => window.clearTimeout(timer));
    this.motionReturnTimers.clear();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.loadedAvatars.forEach((avatar) => {
      avatar.dispose();
    });
    this.loadedAvatars.clear();
    this.scrollingBackground.dispose();

    this.composer.renderTarget1?.dispose();
    this.composer.renderTarget2?.dispose();
    this.hairShadow.dispose();
    this.characterMask.dispose();
    this.renderer.dispose();
  }
}
