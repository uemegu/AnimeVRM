import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { applyToonShader, ToonShaderController } from '../ToonShader';
import { HairShadowUniforms } from '../shader/HairShadow';
import { applySmoothNormalsToHierarchy } from '../shader/SmoothNormalHelper';
import type { MaterialStyleParams, OutlineConfig } from './visual';
import { getSeamlessLoopClip } from '../animation/seamlessLoop';
import { replaceHappyWithEyesOnly } from '../avatar/happyEyesOnly';
import { registerShapeKeyExpressions } from '../avatar/shapeKeyExpressions';
import { addHandColliders } from '../avatar/handColliders';
import { HandClearance, type HandClearanceMode } from '../avatar/handClearance';
import { ClothDent } from '../avatar/clothDent';
import { SpringWind, type WindSettings } from '../avatar/springWind';
import { AvatarEffects } from './AvatarEffects';
import { resolveAssetUrl } from '../utils/path';
import { setDaylight } from '../scene/Daylight';
import { HeldItem } from '../avatar/heldItem';
import type { HeldItemId } from '@anime-vrm/scenario';

const animationAssetCache = new Map<string, THREE.Group>();
/** モデルごとに変換したモーション。モデルを捨てたら一緒に消えるよう、モデルをキーにする */
const animationClipCache = new WeakMap<VRM, Map<string, THREE.AnimationClip>>();

export async function loadMixamoAnimation(url: string, vrm: VRM): Promise<THREE.AnimationClip> {
  url = resolveAssetUrl(url);
  let clips = animationClipCache.get(vrm);
  if (!clips) animationClipCache.set(vrm, (clips = new Map()));
  const cached = clips.get(url);
  if (cached) return cached;

  let asset = animationAssetCache.get(url);
  if (!asset) {
    const loader = new FBXLoader();
    asset = await loader.loadAsync(url);
    animationAssetCache.set(url, asset);
  }

  const clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com') || asset.animations[0];
  if (!clip) {
    throw new Error(`No animation clip found in ${url}`);
  }

  const tracks: THREE.KeyframeTrack[] = [];
  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const _quatA = new THREE.Quaternion();
  const _vec3 = new THREE.Vector3();
  const _vec3b = new THREE.Vector3();

  const findMixamoNode = (name: string): THREE.Object3D | null => {
    const direct = asset!.getObjectByName(name);
    if (direct) return direct;
    if (name.includes(':')) {
      const raw = name.split(':').pop()!;
      return asset!.getObjectByName(raw) || asset!.getObjectByName(`mixamorig${raw}`) || null;
    }
    if (name.startsWith('mixamorig')) {
      const raw = name.slice('mixamorig'.length);
      return asset!.getObjectByName(`mixamorig:${raw}`) || asset!.getObjectByName(raw) || null;
    }
    return asset!.getObjectByName(`mixamorig${name}`) || asset!.getObjectByName(`mixamorig:${name}`) || null;
  };

  const normalizeMixamoKey = (name: string): string => {
    const clean = name.replace(/^.*mixamorig\d*[:_]?/i, 'mixamorig');
    if (clean.startsWith('mixamorig')) return clean;
    return `mixamorig${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  };

  const motionHips = findMixamoNode('mixamorigHips');
  const motionHipsHeight = motionHips ? motionHips.position.y : 1;
  // 腰の高さは基準姿勢で測る（今の姿勢で測ると、腰を落としたモーションの最中に読み込んだモーションまで低くなる）
  const restHipsY = vrm.humanoid?.normalizedRestPose.hips?.position?.[1];
  const vrmHips = vrm.humanoid?.getNormalizedBoneNode('hips');
  const vrmHipsHeight =
    restHipsY ?? (vrmHips ? Math.abs(vrmHips.getWorldPosition(_vec3).y - vrm.scene.getWorldPosition(_vec3b).y) : 1);
  const hipsPositionScale = motionHipsHeight !== 0 ? vrmHipsHeight / motionHipsHeight : 1;

  const mixamoVRMBoneMap: Record<string, string> = {
    mixamorigHips: 'hips',
    mixamorigSpine: 'spine',
    mixamorigSpine1: 'chest',
    mixamorigSpine2: 'upperChest',
    mixamorigNeck: 'neck',
    mixamorigHead: 'head',
    mixamorigLeftShoulder: 'leftShoulder',
    mixamorigLeftArm: 'leftUpperArm',
    mixamorigLeftForeArm: 'leftLowerArm',
    mixamorigLeftHand: 'leftHand',
    mixamorigRightShoulder: 'rightShoulder',
    mixamorigRightArm: 'rightUpperArm',
    mixamorigRightForeArm: 'rightLowerArm',
    mixamorigRightHand: 'rightHand',
    mixamorigLeftUpLeg: 'leftUpperLeg',
    mixamorigLeftLeg: 'leftLowerLeg',
    mixamorigLeftFoot: 'leftFoot',
    mixamorigLeftToeBase: 'leftToes',
    mixamorigRightUpLeg: 'rightUpperLeg',
    mixamorigRightLeg: 'rightLowerLeg',
    mixamorigRightFoot: 'rightFoot',
    mixamorigRightToeBase: 'rightToes',
    // 指（旧ルートと同じ。FBX の指の動きも移す）
    mixamorigLeftHandThumb1: 'leftThumbMetacarpal',
    mixamorigLeftHandThumb2: 'leftThumbProximal',
    mixamorigLeftHandThumb3: 'leftThumbDistal',
    mixamorigLeftHandIndex1: 'leftIndexProximal',
    mixamorigLeftHandIndex2: 'leftIndexIntermediate',
    mixamorigLeftHandIndex3: 'leftIndexDistal',
    mixamorigLeftHandMiddle1: 'leftMiddleProximal',
    mixamorigLeftHandMiddle2: 'leftMiddleIntermediate',
    mixamorigLeftHandMiddle3: 'leftMiddleDistal',
    mixamorigLeftHandRing1: 'leftRingProximal',
    mixamorigLeftHandRing2: 'leftRingIntermediate',
    mixamorigLeftHandRing3: 'leftRingDistal',
    mixamorigLeftHandPinky1: 'leftLittleProximal',
    mixamorigLeftHandPinky2: 'leftLittleIntermediate',
    mixamorigLeftHandPinky3: 'leftLittleDistal',
    mixamorigRightHandThumb1: 'rightThumbMetacarpal',
    mixamorigRightHandThumb2: 'rightThumbProximal',
    mixamorigRightHandThumb3: 'rightThumbDistal',
    mixamorigRightHandIndex1: 'rightIndexProximal',
    mixamorigRightHandIndex2: 'rightIndexIntermediate',
    mixamorigRightHandIndex3: 'rightIndexDistal',
    mixamorigRightHandMiddle1: 'rightMiddleProximal',
    mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
    mixamorigRightHandMiddle3: 'rightMiddleDistal',
    mixamorigRightHandRing1: 'rightRingProximal',
    mixamorigRightHandRing2: 'rightRingIntermediate',
    mixamorigRightHandRing3: 'rightRingDistal',
    mixamorigRightHandPinky1: 'rightLittleProximal',
    mixamorigRightHandPinky2: 'rightLittleIntermediate',
    mixamorigRightHandPinky3: 'rightLittleDistal',
  };

  clip.tracks.forEach((track) => {
    const trackSplitted = track.name.split('.');
    const rawRigName = trackSplitted[0];
    const mixamoRigName = normalizeMixamoKey(rawRigName);
    const vrmBoneName = mixamoVRMBoneMap[mixamoRigName] || mixamoVRMBoneMap[rawRigName];
    if (!vrmBoneName) return;

    const vrmNodeName = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName as any)?.name;
    const mixamoRigNode = findMixamoNode(rawRigName) || findMixamoNode(mixamoRigName);

    if (vrmNodeName != null && mixamoRigNode != null) {
      const propertyName = trackSplitted[1];

      mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
      if (mixamoRigNode.parent) {
        mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);
      } else {
        parentRestWorldRotation.identity();
      }

      if (track instanceof THREE.QuaternionKeyframeTrack) {
        const values = new Float32Array(track.values.length);
        for (let i = 0; i < track.values.length; i += 4) {
          _quatA.fromArray(track.values, i);
          _quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse);
          _quatA.toArray(values, i);
        }

        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${vrmNodeName}.${propertyName}`,
            Array.from(track.times),
            Array.from(values).map((v, i) => (vrm.meta?.metaVersion === '0' && i % 2 === 0 ? -v : v))
          )
        );
      } else if (track instanceof THREE.VectorKeyframeTrack) {
        const value = Array.from(track.values).map(
          (v, i) => (vrm.meta?.metaVersion === '0' && i % 3 !== 1 ? -v : v) * hipsPositionScale
        );
        tracks.push(new THREE.VectorKeyframeTrack(`${vrmNodeName}.${propertyName}`, Array.from(track.times), value));
      }
    }
  });

  for (const side of ['left', 'right'] as const) {
    softenShoulder(tracks, vrm, `${side}Shoulder`, `${side}UpperArm`);
  }

  const resultClip = new THREE.AnimationClip('vrmAnimation', clip.duration, tracks);
  clips.set(url, resultClip);
  return resultClip;
}

/**
 * 鎖骨の回転をどれだけ残すか。Mixamo の待機モーションは鎖骨を 10〜15° 下げるので、
 * そのまま移すとアニメ体型ではなで肩に見える
 */
const SHOULDER_ROTATION_SCALE = 0.5;

/**
 * 鎖骨の回転を弱め、そのぶんを上腕で打ち消す（肩の高さだけ変わり、腕の向きは元のモーションのまま）。
 * 正規化ボーンは基準姿勢の回転が単位なので、ローカル回転どうしの掛け算で合わせられる
 */
function softenShoulder(tracks: THREE.KeyframeTrack[], vrm: VRM, shoulderBone: string, upperArmBone: string): void {
  const shoulderName = vrm.humanoid?.getNormalizedBoneNode(shoulderBone as any)?.name;
  const upperArmName = vrm.humanoid?.getNormalizedBoneNode(upperArmBone as any)?.name;
  const shoulderIndex = tracks.findIndex((t) => t.name === `${shoulderName}.quaternion`);
  if (shoulderIndex < 0) return;
  const shoulder = tracks[shoulderIndex];
  const upperArm = tracks.find((t) => t.name === `${upperArmName}.quaternion`);

  const identity = new THREE.Quaternion();
  const full = new THREE.Quaternion();
  const soft = new THREE.Quaternion();
  const soften = (q: THREE.Quaternion) => soft.copy(identity).slerp(q, SHOULDER_ROTATION_SCALE);

  if (upperArm) {
    // 上腕のキーの時刻で鎖骨の元の回転を取り、soft⁻¹ · full · upperArm に置き換える
    const sample = new THREE.QuaternionLinearInterpolant(shoulder.times, shoulder.values, 4, new Float32Array(4));
    const armValues = Float32Array.from(upperArm.values);
    const arm = new THREE.Quaternion();
    for (let i = 0; i < upperArm.times.length; i++) {
      full.fromArray(sample.evaluate(upperArm.times[i]));
      soften(full);
      arm.fromArray(armValues, i * 4).premultiply(full).premultiply(soft.invert()).normalize();
      arm.toArray(armValues, i * 4);
    }
    tracks[tracks.indexOf(upperArm)] = new THREE.QuaternionKeyframeTrack(upperArm.name, Array.from(upperArm.times), Array.from(armValues));
  }

  const shoulderValues = Float32Array.from(shoulder.values);
  for (let i = 0; i < shoulderValues.length; i += 4) {
    soften(full.fromArray(shoulderValues, i)).toArray(shoulderValues, i);
  }
  tracks[shoulderIndex] = new THREE.QuaternionKeyframeTrack(shoulder.name, Array.from(shoulder.times), Array.from(shoulderValues));
}

/** 読み込んだモーションのキャッシュを捨てる（書き出したばかりの FBX を読み直して確かめたあとなど） */
export function releaseMixamoAnimation(url: string, vrm: VRM): void {
  const resolved = resolveAssetUrl(url);
  animationClipCache.get(vrm)?.delete(resolved);
  animationAssetCache.delete(resolved);
}

export interface StageAvatarOptions {
  id: string;
  modelUrl: string;
  scene: THREE.Scene;
  // ToonShader の足元グラデーションをワールド座標で計算するために使用
  camera?: THREE.Camera;
  // 前髪の影（StageManager の HairShadowRenderer から受け取る）
  hairShadow?: HairShadowUniforms;
  defaultAnimationUrl?: string;
  initialPosition?: THREE.Vector3;
  /** 手が肌（頭・太もも）で止まる処理の精度（既定 precise） */
  handClearance?: HandClearanceMode;
  /** 手に押されてスカートがへこむ（既定 true） */
  clothDent?: boolean;
}

export class StageAvatar {
  public id: string;
  /** 読み込んだ（読み込み中の）モデル */
  public readonly modelUrl: string;
  public vrm: VRM | null = null;
  public scene: THREE.Scene;
  private camera: THREE.Camera | undefined;
  private hairShadow: HairShadowUniforms | undefined;
  public mixer: THREE.AnimationMixer | null = null;
  /** 手が肌（頭・太もも）に入らないよう腕をずらす（モーションの姿勢に足す） */
  private handClearance: HandClearance | null = null;
  private handClearanceMode: HandClearanceMode;
  /** 手に押されてスカートがへこむ */
  private clothDent: ClothDent | null = null;
  private clothDentEnabled: boolean;
  /** 風で髪とスカートを揺らす */
  private springWind: SpringWind | null = null;
  private wind: WindSettings | null = null;
  public shaderController: ToonShaderController | null = null;
  /** 感情演出（頬赤・涙・汗・文字演出など）。モデルの読み込み後に作る */
  public effects: AvatarEffects | null = null;
  /** 手に持つ小物 */
  private heldItem: HeldItem | null = null;
  private pendingHeldItem: { item: HeldItemId; hand?: 'left' | 'right' } | null = null;
  private motionSpeed = 1;

  private currentAction: THREE.AnimationAction | null = null;
  private currentAnimationUrl: string | null = null;

  // 表情クロスフェード管理
  private emotionWeights: Map<string, number> = new Map([
    ['happy', 0.0],
    ['angry', 0.0],
    ['sad', 0.0],
    ['relaxed', 0.0],
    ['surprised', 0.0],
  ]);
  private targetEmotionWeights: Map<string, number> = new Map([
    ['happy', 0.0],
    ['angry', 0.0],
    ['sad', 0.0],
    ['relaxed', 0.0],
    ['surprised', 0.0],
  ]);
  private currentExpression: string = 'neutral';
  private expressionTransitionDuration: number = 0.25;

  // 視線と顔の向き（ワールド座標の注視点。null なら正面）
  private gazeTarget: THREE.Vector3 | null = null;
  private headTurn = 0;
  private readonly gazeObject = new THREE.Object3D();
  private opacity = 1;
  private headYaw = 0;
  private headPitch = 0;
  /** 前のフレームで首・頭に足した回転（モーションが上書きしないボーンでも積み重ならないよう、次のフレームで戻す） */
  private appliedTurn: Array<{ bone: THREE.Object3D; rotation: THREE.Quaternion }> = [];

  public getCurrentExpression(): string {
    return this.currentExpression;
  }

  // 自動まばたき管理
  private blinkTimer: number = 2.0;
  private blinkState: 'open' | 'closing' | 'opening' = 'open';
  private blinkProgress: number = 0.0;

  // リップシンク管理
  private phonemeWeights: Record<string, number> = {
    aa: 0,
    ee: 0,
    ih: 0,
    oh: 0,
    ou: 0,
  };
  private isLipSyncActive: boolean = false;

  public getIsLipSyncActive(): boolean {
    return this.isLipSyncActive;
  }

  constructor(options: StageAvatarOptions) {
    this.id = options.id;
    this.modelUrl = options.modelUrl;
    this.scene = options.scene;
    this.camera = options.camera;
    this.hairShadow = options.hairShadow;
    this.handClearanceMode = options.handClearance ?? 'precise';
    this.clothDentEnabled = options.clothDent ?? true;
  }

  public async load(modelUrl: string, defaultAnimationUrl = '/animations/Standing Idle.fbx'): Promise<VRM> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    return new Promise((resolve, reject) => {
      loader.load(
        resolveAssetUrl(modelUrl),
        async (gltf) => {
          const vrm = gltf.userData.vrm as VRM;
          if (!vrm) {
            reject(new Error(`Failed to load VRM from ${modelUrl}`));
            return;
          }

          this.vrm = vrm;
          VRMUtils.rotateVRM0(vrm);
          replaceHappyWithEyesOnly(vrm);
          registerShapeKeyExpressions(vrm);
          addHandColliders(vrm);
          this.handClearance = HandClearance.create(vrm, this.handClearanceMode);
          // 手と頭の形は読み込み時の姿勢で測る
          this.heldItem = new HeldItem(vrm);
          this.heldItem.set(this.pendingHeldItem);
          this.clothDent = ClothDent.create(vrm, this.clothDentEnabled);
          this.springWind = SpringWind.create(vrm);

          // 1. スムース法線の事前計算（綺麗なアニメアウトライン用）
          applySmoothNormalsToHierarchy(vrm.scene);

          // 2. メッシュのシャドウとカリング解除
          vrm.scene.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const mesh = obj as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = false;
              mesh.frustumCulled = false;
            }
          });

          // 3. ToonShader適用（アニメ調マテリアルパッチ）
          this.shaderController = applyToonShader(vrm, this.scene, {
            camera: this.camera,
            hairShadow: this.hairShadow,
          });

          // 4. アニメーションミキサー初期化
          this.mixer = new THREE.AnimationMixer(vrm.scene);
          this.effects = new AvatarEffects(vrm, this.scene);

          // 5. 初期待機モーション再生
          try {
            await this.playAnimation(defaultAnimationUrl, true);
          } catch (e) {
            console.warn('Failed to load initial animation:', e);
          }

          vrm.scene.visible = false;
          this.scene.add(vrm.scene);
          resolve(vrm);
        },
        undefined,
        reject
      );
    });
  }

  public async playAnimation(
    url: string,
    loop: boolean = true,
    crossFadeDuration: number = 0.5
  ): Promise<THREE.AnimationAction | null> {
    if (!this.vrm || !this.mixer) return null;

    // 同じモーションでも、ループのする・しないが変わったら再生し直す
    if (this.currentAnimationUrl === url && this.currentAction?.isRunning() && (this.currentAction.loop === THREE.LoopRepeat) === loop) {
      return this.currentAction;
    }

    try {
      const sourceClip = await loadMixamoAnimation(url, this.vrm);
      // Repeating clips are cross-faded into their own start so the loop point never jumps.
      const clip = loop ? getSeamlessLoopClip(sourceClip) : sourceClip;
      const action = this.mixer.clipAction(clip);

      if (loop) {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
      } else {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }

      action.reset();
      action.timeScale = this.motionSpeed;
      if (this.currentAction && this.currentAction !== action) {
        action.crossFadeFrom(this.currentAction, crossFadeDuration, false);
      }

      action.play();
      this.currentAction = action;
      this.currentAnimationUrl = url;
      return action;
    } catch (err) {
      console.error(`Failed to play animation ${url}:`, err);
      return null;
    }
  }

  /** 日なたの明るさ（暗い室内から見た窓の外の人物など。0 で場の光だけ） */
  /** 髪とスカートを揺らす風（場所の wind）。null で止む */
  public setWind(wind: WindSettings | null | undefined): void {
    this.wind = wind ?? null;
  }

  /** 手に持つ小物（null で手放す） */
  public setHeldItem(spec: { item: HeldItemId; hand?: 'left' | 'right' } | null | undefined): void {
    this.pendingHeldItem = spec ?? null;
    if (!this.vrm) return;
    this.heldItem ??= new HeldItem(this.vrm);
    this.heldItem.set(this.pendingHeldItem);
  }

  public setDaylight(amount: number): void {
    if (this.vrm) setDaylight(this.vrm.scene, amount);
  }

  /** 全体の不透明度（1 で通常。去っていくキャラを薄くして消すとき） */
  public setOpacity(opacity: number): void {
    if (!this.vrm || opacity === this.opacity) return;
    const wasOpaque = this.opacity >= 1;
    this.opacity = opacity;
    const opaque = opacity >= 1;
    this.vrm.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const base = (material.userData.baseTransparent ??= material.transparent) as boolean;
        material.opacity = opacity;
        material.transparent = base || !opaque;
        if (wasOpaque !== opaque) material.needsUpdate = true;
      }
    });
  }

  /** モーションの再生速度（1 が通常） */
  /** 手が肌で止まる処理の精度を切り替える */
  public setHandClearance(mode: HandClearanceMode): void {
    this.handClearanceMode = mode;
    this.handClearance?.setMode(mode);
  }

  /** 手に押されてスカートがへこむかを切り替える */
  public setClothDent(enabled: boolean): void {
    this.clothDentEnabled = enabled;
    this.clothDent?.setEnabled(enabled);
  }

  public setMotionSpeed(speed: number): void {
    this.motionSpeed = speed;
    if (this.currentAction) this.currentAction.timeScale = speed;
  }

  public getMotionSpeed(): number {
    return this.motionSpeed;
  }

  /**
   * 表情をスムーズな指数減衰クロスフェード補間で設定
   */
  public setExpression(expressionName: string, weight = 1.0, duration = 0.25): void {
    if (!this.vrm?.expressionManager) return;

    if (expressionName === 'normal') {
      expressionName = 'neutral';
    }

    this.currentExpression = expressionName;
    this.expressionTransitionDuration = Math.max(0, duration);

    const manager = this.vrm.expressionManager;
    const isSpecial = ['neutral', 'blink', 'blinkLeft', 'blinkRight', 'aa', 'ih', 'ou', 'ee', 'oh'].includes(expressionName);
    if (!isSpecial && !this.emotionWeights.has(expressionName)) {
      this.emotionWeights.set(expressionName, manager.getValue(expressionName) ?? 0.0);
      this.targetEmotionWeights.set(expressionName, 0.0);
    }

    this.targetEmotionWeights.forEach((_, key) => {
      if (key === expressionName && expressionName !== 'neutral') {
        this.targetEmotionWeights.set(key, weight);
      } else {
        this.targetEmotionWeights.set(key, 0.0);
      }
    });

    if (this.expressionTransitionDuration <= 0) {
      this.targetEmotionWeights.forEach((targetWeight, key) => {
        this.emotionWeights.set(key, targetWeight);
        manager.setValue(key, targetWeight);
      });
    }
  }

  /**
   * 毎フレームの表情クロスフェード更新
   */
  private updateExpressions(delta: number): void {
    if (!this.vrm?.expressionManager) return;
    const manager = this.vrm.expressionManager;

    const lambda = this.expressionTransitionDuration > 0
      ? 3.5 / Math.max(0.01, this.expressionTransitionDuration)
      : 100.0;
    const alpha = 1.0 - Math.exp(-lambda * delta);

    this.targetEmotionWeights.forEach((targetWeight, key) => {
      const current = this.emotionWeights.get(key) ?? 0.0;
      const next = THREE.MathUtils.lerp(current, targetWeight, alpha);
      const val = Math.abs(next - targetWeight) < 0.001 ? targetWeight : next;
      this.emotionWeights.set(key, val);
      manager.setValue(key, val);
    });
  }

  /**
   * 自然な自動まばたき
   */
  private updateBlink(delta: number): void {
    if (!this.vrm?.expressionManager) return;
    const manager = this.vrm.expressionManager;

    // 笑顔等で目が閉じている時は重複まばたきを防止
    const happyWeight = Math.max(this.emotionWeights.get('happy') ?? 0, this.emotionWeights.get('komari') ?? 0);
    if (happyWeight > 0.6) {
      manager.setValue('blink', 0.0);
      this.blinkState = 'open';
      return;
    }

    if (this.blinkState === 'open') {
      this.blinkTimer -= delta;
      if (this.blinkTimer <= 0) {
        this.blinkState = 'closing';
        this.blinkProgress = 0.0;
      }
    } else if (this.blinkState === 'closing') {
      this.blinkProgress += delta * 12.0; // 約0.08秒で閉じる
      if (this.blinkProgress >= 1.0) {
        this.blinkProgress = 1.0;
        this.blinkState = 'opening';
      }
      manager.setValue('blink', this.blinkProgress);
    } else if (this.blinkState === 'opening') {
      this.blinkProgress -= delta * 10.0; // 約0.1秒で開く
      if (this.blinkProgress <= 0.0) {
        this.blinkProgress = 0.0;
        this.blinkState = 'open';
        this.blinkTimer = 2.5 + Math.random() * 3.0; // 次のまばたき間隔
      }
      manager.setValue('blink', this.blinkProgress);
    }
  }

  /**
   * 時間帯プリセットに応じたMToonマテリアルの更新
   */
  public updateMaterialPreset(
    materials?: {
      body: MaterialStyleParams;
      hair: MaterialStyleParams;
      cloth: MaterialStyleParams;
    },
    outline?: OutlineConfig
  ): void {
    if (!this.shaderController) return;

    if (materials) {
      this.shaderController.updateMaterialStyle('body', materials.body);
      this.shaderController.updateMaterialStyle('hair', materials.hair);
      this.shaderController.updateMaterialStyle('cloth', materials.cloth);
    }
    if (outline) {
      this.shaderController.updateOutline(outline);
    }
  }

  /**
   * リアルタイム・リップシンク更新
   * 母音（aa, ee, ih, oh, ou）の開口度を VRM ExpressionManager に適用
   */
  public updateLipSync(
    phoneme: string | undefined,
    gain: number = 0.7,
    smoothing: number = 0.2
  ): void {
    if (!this.vrm?.expressionManager) return;
    const manager = this.vrm.expressionManager;

    const phonemes = ['aa', 'ee', 'ih', 'oh', 'ou'] as const;
    const target: Record<string, number> = {
      aa: 0,
      ee: 0,
      ih: 0,
      oh: 0,
      ou: 0,
    };

    if (phoneme && phoneme !== 'nn' && phoneme in target) {
      target[phoneme] = 1.0;
      this.isLipSyncActive = true;
    }

    let hasNonZero = false;
    phonemes.forEach((p) => {
      const cw = this.phonemeWeights[p] ?? 0;
      const tw = target[p] ?? 0;

      // 口が開くときは素早く（fast attack）、閉じるときは滑らかに減衰
      const effectiveSmoothing = tw > cw ? Math.min(1.0, smoothing * 2.0 + 0.25) : smoothing;
      const nw = cw + effectiveSmoothing * (tw - cw);
      const finalWeight = nw < 0.005 ? 0 : nw;
      this.phonemeWeights[p] = finalWeight;

      if (finalWeight > 0.001) {
        hasNonZero = true;
      }

      manager.setValue(p, finalWeight * gain);
    });

    if (!hasNonZero && (!phoneme || phoneme === 'nn')) {
      this.isLipSyncActive = false;
    }
  }

  public resetLipSync(): void {
    if (!this.vrm?.expressionManager) return;
    const manager = this.vrm.expressionManager;
    const phonemes = ['aa', 'ee', 'ih', 'oh', 'ou'] as const;
    phonemes.forEach((p) => {
      this.phonemeWeights[p] = 0;
      manager.setValue(p, 0);
    });
    this.isLipSyncActive = false;
  }

  /** frame は感情演出の描画に使う（文字演出はカメラへ向ける・残像はレンダラーを使う） */
  public update(delta: number, frame?: { elapsed: number; camera: THREE.Camera; renderer: THREE.WebGLRenderer }): void {
    if (!this.vrm) return;

    // 1. モーション再生（前のフレームで足した顔の向きを先に戻す）
    for (const { bone, rotation } of this.appliedTurn) bone.quaternion.multiply(rotation.invert());
    this.appliedTurn = [];
    this.handClearance?.restore();
    this.heldItem?.restore();
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // 1.2 小物を握る手は指を曲げる
    this.heldItem?.applyGrip();
    this.handClearance?.setItem(this.heldItem?.itemProbes() ?? null);

    // 1.5 顔を視線の先へ向ける（モーションの姿勢に足す）
    this.updateHeadTurn(delta);

    // 1.6 手が肌（頭・太もも）に入っていたら外へ出す（頭の向きが決まってから）
    this.handClearance?.apply();

    // 2. 表情クロスフェード
    this.updateExpressions(delta);

    // 3. まばたき
    this.updateBlink(delta);

    // 3.5 目が泳ぐ（視線にずれを足す）
    this.effects?.applyEyeWander(delta, this.gazeTarget);

    // 4. VRM SpringBone・Humanoid更新（風は揺れものの重力に足す）
    this.springWind?.update(delta, this.wind);
    this.vrm.update(delta);

    // 4.5 手に押されてスカートがへこむ（腕と揺れものが決まってから）
    this.clothDent?.update();

    // 4.6 小物を手の位置へ
    this.heldItem?.place();

    // 5. 感情演出
    if (frame) {
      const blink = this.vrm.expressionManager?.getValue('blink') ?? 0;
      this.effects?.update(delta, frame.elapsed, frame.camera, frame.renderer, blink);
    }
  }

  /**
   * 視線の先（ワールド座標）。null なら正面を見る。
   * headTurn は顔も向ける度合い（0 = 目だけ、1 = 顔も大きく向ける）
   */
  public setGaze(target: THREE.Vector3 | null, headTurn = 0): void {
    this.headTurn = target ? THREE.MathUtils.clamp(headTurn, 0, 1) : 0;
    const lookAt = this.vrm?.lookAt;
    if (target) {
      this.gazeTarget = (this.gazeTarget ?? new THREE.Vector3()).copy(target);
      this.gazeObject.position.copy(target);
      this.gazeObject.updateMatrixWorld();
      if (lookAt) lookAt.target = this.gazeObject;
    } else {
      this.gazeTarget = null;
      if (lookAt) {
        lookAt.target = undefined;
        lookAt.yaw = 0;
        lookAt.pitch = 0;
      }
    }
  }

  /** 首と頭を少しずつ注視点へ回す（左右 35°・上下 15° まで × headTurn） */
  private updateHeadTurn(delta: number): void {
    const humanoid = this.vrm?.humanoid;
    const head = humanoid?.getNormalizedBoneNode('head');
    const neck = humanoid?.getNormalizedBoneNode('neck');
    if (!this.vrm || !head) return;
    let yaw = 0;
    let pitch = 0;
    if (this.gazeTarget && this.headTurn > 0) {
      const root = this.vrm.scene;
      root.updateMatrixWorld();
      const local = root.worldToLocal(this.gazeTarget.clone());
      const headPos = root.worldToLocal(head.getWorldPosition(new THREE.Vector3()));
      const dir = local.sub(headPos);
      yaw = THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z), -0.61, 0.61) * this.headTurn;
      pitch = THREE.MathUtils.clamp(Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), -0.26, 0.26) * this.headTurn;
    }
    const k = 1 - Math.exp(-delta * 6);
    this.headYaw += (yaw - this.headYaw) * k;
    this.headPitch += (pitch - this.headPitch) * k;
    if (Math.abs(this.headYaw) < 1e-4 && Math.abs(this.headPitch) < 1e-4) return;
    // 首に4割、頭に6割（上を向くのは X 軸まわりの負の回転）
    const turn = (bone: THREE.Object3D, share: number) => {
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-this.headPitch * share, this.headYaw * share, 0, 'YXZ'));
      bone.quaternion.multiply(rotation);
      this.appliedTurn.push({ bone, rotation });
    };
    if (neck) turn(neck, 0.4);
    turn(head, neck ? 0.6 : 1);
  }

  public dispose(): void {
    this.heldItem?.dispose();
    this.heldItem = null;
    this.effects?.dispose();
    this.effects = null;
    if (this.vrm) {
      VRMUtils.deepDispose(this.vrm.scene);
      this.scene.remove(this.vrm.scene);
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
      // 再生したモーションの束縛（クリップごとのアクション）を手放す
      if (this.vrm) this.mixer.uncacheRoot(this.vrm.scene);
    }
    if (this.shaderController) {
      this.shaderController.dispose();
    }
  }
}
