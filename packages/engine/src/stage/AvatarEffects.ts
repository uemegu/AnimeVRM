import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { FaceOverlayEffect } from '../effects/FaceOverlayEffect';
import { WateryEyeEffect } from '../effects/eye/WateryEyeEffect';
import { TearEffect } from '../effects/tears/TearEffect';
import { CryFaceEffect } from '../effects/cry/CryFaceEffect';
import { SweatEffect } from '../effects/sweat/SweatEffect';
import { EffectTextManager } from '../effects/text/EffectTextManager';
import type { EffectPresetName } from '../effects/text/types';
import { FastMotionEffect } from '../effects/motion/FastMotionEffect';

/** 汗の出し方（fly4 = 飛ぶ、jito = にじむ） */
export type SweatMode = 'fly4' | 'jito';

const SWEAT_SECONDS = 4;

/** 目のハイライト・瞳のマテリアル（頬赤のとき揺らして潤ませる。元の値に戻せるよう控えておく） */
interface EyeMaterialBackup {
  material: THREE.Material & {
    map?: THREE.Texture | null;
    emissive?: THREE.Color;
    emissiveIntensity?: number;
    uniforms?: Record<string, { value: any }>;
  };
  offset: THREE.Vector2;
  rotation: number;
  emissive: THREE.Color;
  emissiveIntensity: number;
}

type EyeMaterial = EyeMaterialBackup['material'];

/**
 * アバター1人分の感情演出（頬赤・赤面・涙目・あわあわ口・怒りマーク・涙・汗・目が泳ぐ・文字演出・高速アクションの残像）
 */
export class AvatarEffects {
  private readonly vrm: VRM;
  private readonly scene: THREE.Scene;
  private readonly faceOverlay: FaceOverlayEffect;
  private readonly wateryEyes: WateryEyeEffect;
  private readonly tears: TearEffect;
  private readonly sweat: SweatEffect;
  private readonly cryFace: CryFaceEffect;
  private readonly texts: EffectTextManager;
  private fastMotion: FastMotionEffect | null = null;

  private blush = false;
  private anger = false;
  private faceSweat = false;
  private tearsOn = false;
  private redface = false;
  private tearyEyes = false;
  private awawaMouth = false;
  private highlights: EyeMaterialBackup[] = [];
  private irises: EyeMaterialBackup[] = [];

  // 目が泳ぐ（視線に足すずれ。度）
  private wander = 0;
  private wanderTimer = 0;
  private wanderInterval = 0.25;
  private readonly wanderTarget = new THREE.Vector2();
  private readonly wanderOffset = new THREE.Vector2();

  constructor(vrm: VRM, scene: THREE.Scene) {
    this.vrm = vrm;
    this.scene = scene;
    this.faceOverlay = new FaceOverlayEffect(vrm.scene);
    this.wateryEyes = new WateryEyeEffect(vrm, { enabled: false });
    this.tears = new TearEffect(vrm, { enabled: false });
    this.sweat = new SweatEffect(vrm, { enabled: false });
    this.cryFace = new CryFaceEffect(vrm);
    this.texts = new EffectTextManager(scene);
  }

  /** 頬を赤らめる（目も潤ませる） */
  public setBlush(enabled: boolean): void {
    if (this.blush === enabled) return;
    this.blush = enabled;
    void this.faceOverlay.setEnabled('blush', enabled).catch((err) => console.warn('Failed to show blush:', err));
    this.updateEyeShine();
  }

  /** 赤面（頬を赤らめるより濃く広い） */
  public setRedface(enabled: boolean): void {
    if (this.redface === enabled) return;
    this.redface = enabled;
    void this.faceOverlay.setEnabled('redface', enabled).catch((err) => console.warn('Failed to show red face:', err));
  }

  /** 涙目（目を潤ませ、目尻に涙の粒をためる）。drops が false なら粒は出さない（髪が目尻にかかるキャラ） */
  public setTearyEyes(enabled: boolean, drops = true): void {
    this.cryFace.setDrops(enabled && drops);
    if (this.tearyEyes === enabled) return;
    this.tearyEyes = enabled;
    this.updateEyeShine();
  }

  /** あわあわ口（口の前に波打つ大きな口を貼る。正面から見たときだけ出る） */
  public setAwawaMouth(enabled: boolean): void {
    if (this.awawaMouth === enabled) return;
    this.awawaMouth = enabled;
    this.cryFace.setMouth(enabled);
  }

  /** 頬赤・涙目の間は目を潤ませる */
  private updateEyeShine(): void {
    const enabled = this.blush || this.tearyEyes;
    this.wateryEyes.setEnabled(enabled);
    if (enabled) this.backupEyeMaterials();
    else this.restoreEyeMaterials();
  }

  public setAnger(enabled: boolean): void {
    if (this.anger === enabled) return;
    this.anger = enabled;
    void this.faceOverlay.setEnabled('anger', enabled).catch((err) => console.warn('Failed to show anger mark:', err));
  }

  /** 顔に汗のテクスチャを重ねる */
  public setFaceSweat(enabled: boolean): void {
    if (this.faceSweat === enabled) return;
    this.faceSweat = enabled;
    void this.faceOverlay.setEnabled('sweat', enabled).catch((err) => console.warn('Failed to show face sweat:', err));
  }

  public setTears(enabled: boolean): void {
    if (this.tearsOn === enabled) return;
    this.tearsOn = enabled;
    this.tears.updateConfig({ enabled });
    if (enabled) this.tears.restart();
  }

  /** 目が泳ぐ強さ（0 で止める） */
  public setEyeWander(intensity: number): void {
    this.wander = intensity;
  }

  /** 速い動きに残像とスピード線をつける */
  public setFastMotion(enabled: boolean): void {
    if (enabled && !this.fastMotion) this.fastMotion = new FastMotionEffect(this.vrm, this.scene);
    this.fastMotion?.updateConfig({ enabled });
  }

  public showSweat(mode: SweatMode): void {
    this.sweat.restart(mode, SWEAT_SECONDS);
  }

  public showText(preset: EffectPresetName, text?: string, duration?: number): void {
    this.texts.clear();
    this.texts.show({ target: this.vrm, stylePreset: preset, text, duration });
  }

  /** 文字演出を消す */
  public clearText(): void {
    this.texts.clear();
  }

  /** 1回きりの演出（文字・汗）を消す（カットが変わったとき） */
  public clearOneShots(): void {
    this.texts.clear();
    this.sweat.stop();
  }

  /**
   * 視線に目が泳ぐずれを足す（vrm.update の前に呼ぶ）。
   * 泳いでいる間は lookAt の自動更新を止めて、注視点の向きにずれを足した角度を直接入れる
   */
  public applyEyeWander(delta: number, gazeTarget: THREE.Vector3 | null): void {
    const lookAt = this.vrm.lookAt;
    if (!lookAt) return;
    if (this.wander > 0) {
      this.wanderTimer += delta;
      if (this.wanderTimer >= this.wanderInterval) {
        this.wanderTimer = 0;
        this.wanderInterval = 0.16 + Math.random() * 0.22;
        this.pickWanderTarget(this.wander);
      }
      this.wanderOffset.lerp(this.wanderTarget, Math.min(1, 1 - Math.exp(-delta * 28)));
    } else {
      this.wanderOffset.lerp(new THREE.Vector2(), Math.min(1, 1 - Math.exp(-delta * 14)));
    }

    const active = this.wander > 0 || this.wanderOffset.lengthSq() > 1e-4;
    lookAt.autoUpdate = !active;
    if (!active) return;
    if (gazeTarget) lookAt.lookAt(gazeTarget);
    else {
      lookAt.yaw = 0;
      lookAt.pitch = 0;
    }
    lookAt.yaw += this.wanderOffset.x;
    lookAt.pitch += this.wanderOffset.y;
  }

  /** 次に目をやる向き（右上・左下・右下・左上・チラ見。度） */
  private pickWanderTarget(intensity: number): void {
    const deg = THREE.MathUtils.radToDeg;
    const roll = Math.random();
    let yaw: number;
    let pitch: number;
    if (roll < 0.32) {
      yaw = 0.13 + Math.random() * 0.11;
      pitch = 0.09 + Math.random() * 0.08;
    } else if (roll < 0.58) {
      yaw = -0.12 - Math.random() * 0.1;
      pitch = -0.08 - Math.random() * 0.08;
    } else if (roll < 0.74) {
      yaw = 0.1 + Math.random() * 0.09;
      pitch = -0.09 - Math.random() * 0.07;
    } else if (roll < 0.88) {
      yaw = -0.11 - Math.random() * 0.09;
      pitch = 0.08 + Math.random() * 0.07;
    } else {
      yaw = (Math.random() - 0.5) * 0.03;
      pitch = (Math.random() - 0.5) * 0.02;
    }
    this.wanderTarget.set(deg(yaw) * intensity, deg(pitch) * intensity);
  }

  /** 毎フレームの更新（vrm.update の後） */
  public update(delta: number, elapsed: number, camera: THREE.Camera, renderer: THREE.WebGLRenderer, blinkWeight: number): void {
    this.texts.update(delta, camera);
    this.tears.update(delta);
    this.sweat.update(delta);
    this.cryFace.update(delta, elapsed, camera);
    this.wateryEyes.update(delta, elapsed, blinkWeight);
    if (this.blush || this.tearyEyes) this.wobbleEyeMaterials(elapsed);
    this.fastMotion?.update(delta, elapsed, camera, renderer);
  }

  private backupEyeMaterials(): void {
    if (this.highlights.length || this.irises.length) return;
    const seen = new Set<THREE.Material>();
    this.vrm.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!material || seen.has(material)) continue;
        seen.add(material);
        const mat = material as EyeMaterial;
        const backup = {
          material: mat,
          offset: mat.map?.offset.clone() ?? new THREE.Vector2(),
          rotation: mat.map?.rotation ?? 0,
          emissive: mat.emissive?.clone() ?? new THREE.Color(0, 0, 0),
          emissiveIntensity: mat.emissiveIntensity ?? 0,
        };
        if (/EyeHighlight|Highlight.*Eye/i.test(mat.name)) this.highlights.push(backup);
        else if (/EyeIris|Iris|瞳|虹彩/i.test(mat.name)) this.irises.push(backup);
      }
    });
  }

  /** 目のハイライトを揺らし、瞳をうっすら光らせる */
  private wobbleEyeMaterials(elapsed: number): void {
    const wobbleX = Math.sin(elapsed * 4.2) * 0.012 + Math.cos(elapsed * 2.7) * 0.006;
    const wobbleY = Math.cos(elapsed * 3.6) * 0.012 + Math.sin(elapsed * 5.1) * 0.005;
    const rotation = Math.sin(elapsed * 2.2) * 0.035;
    const pulse = 1.35 + 0.45 * Math.sin(elapsed * 3.8) + 0.2 * Math.sin(elapsed * 7.1);
    for (const item of this.highlights) {
      const map = item.material.map;
      if (map) {
        map.offset.set(item.offset.x + wobbleX, item.offset.y + wobbleY);
        map.rotation = item.rotation + rotation;
        map.center.set(0.5, 0.5);
      }
      setEmissive(item.material, new THREE.Color(0.88, 0.96, 1.0), pulse);
    }
    const sheen = 0.16 + 0.08 * Math.sin(elapsed * 2.5);
    for (const item of this.irises) setEmissive(item.material, new THREE.Color(0.06, 0.16, 0.24), sheen);
  }

  private restoreEyeMaterials(): void {
    for (const item of [...this.highlights, ...this.irises]) {
      const map = item.material.map;
      if (map) {
        map.offset.copy(item.offset);
        map.rotation = item.rotation;
      }
      setEmissive(item.material, item.emissive, item.emissiveIntensity);
    }
    this.highlights = [];
    this.irises = [];
  }

  public dispose(): void {
    this.restoreEyeMaterials();
    this.faceOverlay.dispose();
    this.wateryEyes.dispose();
    this.tears.dispose();
    this.sweat.dispose();
    this.cryFace.dispose();
    this.texts.dispose();
    this.fastMotion?.dispose();
    this.fastMotion = null;
  }
}

function setEmissive(material: EyeMaterial, color: THREE.Color, intensity: number): void {
  if (material.emissive) material.emissive.copy(color);
  material.uniforms?.emissive?.value?.copy?.(color);
  if (typeof material.emissiveIntensity === 'number') material.emissiveIntensity = intensity;
  if (material.uniforms?.emissiveIntensity) material.uniforms.emissiveIntensity.value = intensity;
}
