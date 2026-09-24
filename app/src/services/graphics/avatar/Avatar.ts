import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { applyToonShader, ToonShaderController } from '../shader/ToonShader';
import { HairShadowUniforms } from '../shader/HairShadow';
import { applySmoothNormalsToHierarchy } from '../shader/SmoothNormalHelper';
import type { MaterialStyleParams, OutlineConfig } from '../../../types/visual';
import { getSeamlessLoopClip } from './seamlessLoop';

const animationAssetCache = new Map<string, THREE.Group>();
const animationClipCache = new Map<string, THREE.AnimationClip>();

export async function loadMixamoAnimation(url: string, vrm: VRM): Promise<THREE.AnimationClip> {
  const cacheKey = `${url}:${vrm.scene.uuid}`;
  if (animationClipCache.has(cacheKey)) {
    return animationClipCache.get(cacheKey)!;
  }

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
  const vrmHips = vrm.humanoid?.getNormalizedBoneNode('hips');
  const vrmHipsY = vrmHips ? vrmHips.getWorldPosition(_vec3).y : 1;
  const vrmRootY = vrm.scene.getWorldPosition(_vec3b).y;
  const vrmHipsHeight = Math.abs(vrmHipsY - vrmRootY);
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

  const resultClip = new THREE.AnimationClip('vrmAnimation', clip.duration, tracks);
  animationClipCache.set(cacheKey, resultClip);
  return resultClip;
}

export interface AvatarOptions {
  id: string;
  modelUrl: string;
  scene: THREE.Scene;
  // ToonShader の足元グラデーションをワールド座標で計算するために使用
  camera?: THREE.Camera;
  // 前髪の影（StageManager の HairShadowRenderer から受け取る）
  hairShadow?: HairShadowUniforms;
  defaultAnimationUrl?: string;
  initialPosition?: THREE.Vector3;
}

export class Avatar {
  public id: string;
  public vrm: VRM | null = null;
  public scene: THREE.Scene;
  private camera: THREE.Camera | undefined;
  private hairShadow: HairShadowUniforms | undefined;
  public mixer: THREE.AnimationMixer | null = null;
  public shaderController: ToonShaderController | null = null;

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

  constructor(options: AvatarOptions) {
    this.id = options.id;
    this.scene = options.scene;
    this.camera = options.camera;
    this.hairShadow = options.hairShadow;
  }

  public async load(modelUrl: string, defaultAnimationUrl = '/animations/Standing Idle.fbx'): Promise<VRM> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    return new Promise((resolve, reject) => {
      loader.load(
        modelUrl,
        async (gltf) => {
          const vrm = gltf.userData.vrm as VRM;
          if (!vrm) {
            reject(new Error(`Failed to load VRM from ${modelUrl}`));
            return;
          }

          this.vrm = vrm;
          VRMUtils.rotateVRM0(vrm);

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

    if (this.currentAnimationUrl === url && this.currentAction && this.currentAction.isRunning()) {
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
    const happyWeight = this.emotionWeights.get('happy') ?? 0;
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

  public update(delta: number): void {
    if (!this.vrm) return;

    // 1. モーション再生
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // 2. 表情クロスフェード
    this.updateExpressions(delta);

    // 3. まばたき
    this.updateBlink(delta);

    // 4. VRM SpringBone・Humanoid更新
    this.vrm.update(delta);
  }

  public dispose(): void {
    if (this.vrm) {
      VRMUtils.deepDispose(this.vrm.scene);
      this.scene.remove(this.vrm.scene);
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
    if (this.shaderController) {
      this.shaderController.dispose();
    }
  }
}
