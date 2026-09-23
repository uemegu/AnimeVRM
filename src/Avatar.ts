import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils, VRMExpression, VRMExpressionMorphTargetBind } from '@pixiv/three-vrm';
import {
  applyToonShader,
  ToonShaderController,
  ToonShaderOptions,
} from './ToonShader';
import { applySmoothNormalsToHierarchy, flattenEyeOrbitNormals } from './shader/SmoothNormalHelper';
import type { HairShadowUniforms } from './shader/HairShadow';
import type { AvatarConfig } from './Config';
import { PHONEMES, Phoneme } from './AudioLipSync';
import { resolveAssetUrl } from './utils/path';
import { EffectTextManager, ShowEffectTextOptions, EffectTextInstance } from './effects/text';
import { TearEffect, TearConfig } from './effects/tears';
import { SweatEffect, SweatConfig } from './effects/sweat';
import { FastMotionEffect, FastMotionConfig } from './effects/motion';
import { WateryEyeEffect, WateryEyeConfig } from './effects/eye';
import { FaceOverlayEffect, FaceOverlayKind, FaceOverlayState, getFaceOverlayKindForTexture } from './effects/FaceOverlayEffect';
import { MorphTargetPreview } from './avatar/MorphTargetPreview';

export interface BlushOptions {
  enabled?: boolean;
  faceTexture?: string | null;
  wateryEyes?: boolean;
  wateryEyeConfig?: Partial<WateryEyeConfig>;
  applyExpression?: boolean;
}

export interface YandereOptions {
  enabled?: boolean;
  color?: string; // 瞳の単色カラー (デフォルト: '#3b080f' 妖しい深紅)
  hideHighlights?: boolean; // 目の光（ハイライト）を消す (デフォルト: true)
  flatIrisTexture?: boolean; // 瞳テクスチャを単色ベタ塗りにする (デフォルト: true)
  dimEyeWhite?: boolean; // 白目をわずかに暗くする (デフォルト: true)
  tiltHead?: boolean; // 首を少しかしげる (デフォルト: true)
  tiltAngle?: number; // 傾き角度（ラジアン、デフォルト: 0.16）
  suppressBlink?: boolean; // まばたきを抑制してじっと見つめる (デフォルト: true)
  applyExpression?: boolean; // 虚ろな笑み・見開きのヤンデレ表情にする (デフォルト: true)
}

export interface EyeLookAtConfig {
  mode?: 'camera' | 'forward' | 'custom';
  targetPos?: THREE.Vector3;
  targetGetter?: () => THREE.Vector3 | null;
  offset?: { x: number; y: number }; // 水平(yaw), 垂直(pitch) オフセット (ラジアン)
  wander?: boolean; // 目が泳ぐか
  wanderIntensity?: number; // 目が泳ぐ強さ (0.0 - 2.0, デフォルト 1.0)
  wanderSpeed?: number; // 目が泳ぐ速度 (デフォルト 1.0)
}

export interface HeadLookAtConfig {
  enabled?: boolean;
  targetPos?: THREE.Vector3;
  targetGetter?: () => THREE.Vector3 | null;
  weight?: number; // 0.0 - 1.0 (追従ウェイト)
  offset?: { x: number; y: number }; // 水平(yaw), 垂直(pitch) オフセット (ラジアン)
  maxYaw?: number; // 最大水平角度 (デフォルト 約45度: 0.785 rad)
  maxPitch?: number; // 最大垂直角度 (デフォルト 約25度: 0.436 rad)
  smoothSpeed?: number; // 補間速度 (デフォルト 8.0)
}

export interface AvatarOptions {
  modelUrl: string;
  defaultAnimationUrl?: string;
  config?: AvatarConfig;
  position?: THREE.Vector3 | [number, number, number];
  rotationY?: number;
  autoBlink?: boolean;
  lookAtCamera?: boolean;
  headLookAtCamera?: boolean;
  eyeLookAtCamera?: boolean;
  eyeWander?: boolean;
  enableBreathing?: boolean;
  effectTextManager?: EffectTextManager;
  renderer?: THREE.WebGLRenderer;
  // 前髪の影（ViewerCore の HairShadowRenderer から受け取る）
  hairShadow?: HairShadowUniforms;
  onProgress?: (progress: number) => void;
  onLoaded?: (avatar: Avatar) => void;
  onError?: (error: unknown) => void;
}

const animationAssetCache = new Map<string, THREE.Group>();
const animationClipCache = new Map<string, THREE.AnimationClip>();

/**
 * Load Mixamo animation, convert for three-vrm use, and return it.
 * (Adapted from pixiv/three-vrm loadMixamoAnimation example)
 */
export async function loadMixamoAnimation(url: string, vrm: VRM): Promise<THREE.AnimationClip> {
  const resolvedUrl = resolveAssetUrl(url);
  const cacheKey = `${resolvedUrl}:${vrm.scene.uuid}`;
  if (animationClipCache.has(cacheKey)) {
    return animationClipCache.get(cacheKey)!;
  }

  let asset = animationAssetCache.get(resolvedUrl);
  if (!asset) {
    const loader = new FBXLoader();
    asset = await loader.loadAsync(resolvedUrl);
    animationAssetCache.set(resolvedUrl, asset);
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

  // Adjust with reference to hips height.
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
    mixamorigRightShoulder: 'rightShoulder',
    mixamorigRightArm: 'rightUpperArm',
    mixamorigRightForeArm: 'rightLowerArm',
    mixamorigRightHand: 'rightHand',
    mixamorigRightHandPinky1: 'rightLittleProximal',
    mixamorigRightHandPinky2: 'rightLittleIntermediate',
    mixamorigRightHandPinky3: 'rightLittleDistal',
    mixamorigRightHandRing1: 'rightRingProximal',
    mixamorigRightHandRing2: 'rightRingIntermediate',
    mixamorigRightHandRing3: 'rightRingDistal',
    mixamorigRightHandMiddle1: 'rightMiddleProximal',
    mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
    mixamorigRightHandMiddle3: 'rightMiddleDistal',
    mixamorigRightHandIndex1: 'rightIndexProximal',
    mixamorigRightHandIndex2: 'rightIndexIntermediate',
    mixamorigRightHandIndex3: 'rightIndexDistal',
    mixamorigRightHandThumb1: 'rightThumbMetacarpal',
    mixamorigRightHandThumb2: 'rightThumbProximal',
    mixamorigRightHandThumb3: 'rightThumbDistal',
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
        tracks.push(
          new THREE.VectorKeyframeTrack(
            `${vrmNodeName}.${propertyName}`,
            Array.from(track.times),
            value
          )
        );
      }
    }
  });

  const result = new THREE.AnimationClip('vrmAnimation', clip.duration, tracks);
  animationClipCache.set(cacheKey, result);
  return result;
}

/** Release a transient FBX clip cache entry after CLI round-trip verification. */
export function releaseMixamoAnimation(url: string, vrm: VRM): void {
  const resolvedUrl = resolveAssetUrl(url);
  animationClipCache.delete(`${resolvedUrl}:${vrm.scene.uuid}`);
  animationAssetCache.delete(resolvedUrl);
}

export class Avatar {
  public vrm: VRM | null = null;
  public scene: THREE.Scene;
  public camera: THREE.Camera;
  public shaderController: ToonShaderController | null = null;
  public mixer: THREE.AnimationMixer | null = null;
  public currentAction: THREE.AnimationAction | null = null;
  public currentAnimationUrl: string | null = null;
  public effectTextManager: EffectTextManager | null = null;

  private isSolidColorActive = false;
  private solidColorValue: string | number = 0xff0000;
  private originalMeshMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]> = new Map();
  private solidMaterialCache: Map<string | number, THREE.MeshBasicMaterial> = new Map();
  private shaftOutlineMeshes: THREE.Mesh[] = [];
  private shaftOutlineMaterial: THREE.MeshBasicMaterial | null = null;
  public tearEffect: TearEffect | null = null;
  public sweatEffect: SweatEffect | null = null;
  public fastMotionEffect: FastMotionEffect | null = null;
  public wateryEyeEffect: WateryEyeEffect | null = null;
  public morphTargetPreview: MorphTargetPreview | null = null;
  private faceOverlayEffect: FaceOverlayEffect | null = null;
  private legacyFaceOverlay: FaceOverlayKind | null = null;
  public renderer: THREE.WebGLRenderer | null = null;

  public initialPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public initialRotationY: number = 0;

  private isBlushActive = false;
  private blushConfig: Required<BlushOptions> = {
    enabled: false,
    faceTexture: null,
    wateryEyes: true,
    wateryEyeConfig: {},
    applyExpression: false,
  };
  private originalHighlightMaterials: Array<{
    material: any;
    originalOffset: THREE.Vector2;
    originalRotation: number;
    originalEmissive: THREE.Color;
    originalEmissiveIntensity: number;
  }> = [];
  private originalIrisMaterials: Array<{
    material: any;
    originalEmissive: THREE.Color;
    originalEmissiveIntensity: number;
  }> = [];

  private options: AvatarOptions;
  private ownsEffectTextManager = false;
  private blinkTimer = 0;
  private blinkState: 0 | 1 | 2 | 3 = 0; // 0: open, 1: closing, 2: closed, 3: opening
  private currentExpression: string = 'neutral';
  private emotionWeights: Map<string, number> = new Map();
  private targetEmotionWeights: Map<string, number> = new Map();
  private expressionTransitionDuration: number = 0.25;

  private isYandereActive = false;
  private isShafudoActive = false;
  private yandereConfig: Required<YandereOptions> = {
    enabled: false,
    color: '#3b080f',
    hideHighlights: true,
    flatIrisTexture: true,
    dimEyeWhite: true,
    tiltHead: true,
    tiltAngle: 0.26,
    suppressBlink: true,
    applyExpression: true,
  };
  private originalEyeStates: Array<{
    mesh?: THREE.Mesh;
    material: THREE.Material;
    type: 'highlight' | 'iris' | 'white';
    originalVisible?: boolean;
    originalOpacity?: number;
    originalMap?: THREE.Texture | null;
    originalColor?: THREE.Color;
    originalShadeColor?: THREE.Color;
    morphTargetName?: string;
    originalMorphWeight?: number;
  }> = [];
  private solidTextureCache: Map<string, THREE.CanvasTexture> = new Map();
  private originalExpressionBeforeYandere: string = 'neutral';

  public phonemeWeights: Record<Phoneme, number> = {
    aa: 0,
    ee: 0,
    ih: 0,
    oh: 0,
    ou: 0,
  };
  public isLipSyncActive: boolean = false;
  private isLipSyncDisabled: boolean = false;
  private isMotionFrozen: boolean = false;

  // Eye Look-At & Eye Wander state
  private eyeLookAtConfig: Omit<Required<EyeLookAtConfig>, 'targetPos' | 'targetGetter'> & {
    targetPos?: THREE.Vector3;
    targetGetter?: () => THREE.Vector3 | null;
  } = {
    mode: 'camera',
    targetPos: undefined,
    targetGetter: undefined,
    offset: { x: 0, y: 0 },
    wander: false,
    wanderIntensity: 1.0,
    wanderSpeed: 1.0,
  };
  private eyeWanderTimer = 0;
  private eyeWanderInterval = 0.3;
  private eyeWanderCurrentOffset = new THREE.Vector2(0, 0);
  private eyeWanderTargetOffset = new THREE.Vector2(0, 0);

  // Head Look-At state
  private headLookAtConfig: Omit<Required<HeadLookAtConfig>, 'targetPos' | 'targetGetter'> & {
    targetPos?: THREE.Vector3;
    targetGetter?: () => THREE.Vector3 | null;
  } = {
    enabled: false,
    targetPos: undefined,
    targetGetter: undefined,
    weight: 1.0,
    offset: { x: 0, y: 0 },
    maxYaw: THREE.MathUtils.degToRad(45),
    maxPitch: THREE.MathUtils.degToRad(25),
    smoothSpeed: 8.0,
  };
  private currentHeadYaw = 0;
  private currentHeadPitch = 0;
  private lastNeckDeltaInverse = new THREE.Quaternion();
  private lastHeadDeltaInverse = new THREE.Quaternion();
  private hasAppliedHeadLookAt = false;
  private restNeckRotation: THREE.Quaternion | null = null;
  private restHeadRotation: THREE.Quaternion | null = null;
  private animNeckQuat = new THREE.Quaternion();
  private animHeadQuat = new THREE.Quaternion();

  constructor(scene: THREE.Scene, camera: THREE.Camera, options: AvatarOptions) {
    this.scene = scene;
    this.camera = camera;
    this.options = {
      modelUrl: options.modelUrl,
      defaultAnimationUrl: options.defaultAnimationUrl ?? '/animations/Idle.fbx',
      config: options.config,
      position: options.position,
      rotationY: options.rotationY,
      autoBlink: options.autoBlink ?? true,
      lookAtCamera: options.lookAtCamera ?? true,
      headLookAtCamera: options.headLookAtCamera ?? false,
      eyeLookAtCamera: options.eyeLookAtCamera ?? (options.lookAtCamera ?? true),
      eyeWander: options.eyeWander ?? false,
      enableBreathing: options.enableBreathing ?? true,
      effectTextManager: options.effectTextManager,
      hairShadow: options.hairShadow,
      onProgress: options.onProgress ?? (() => {}),
      onLoaded: options.onLoaded ?? (() => {}),
      onError: options.onError ?? ((err) => console.error(err)),
    };

    this.eyeLookAtConfig.mode = (options.eyeLookAtCamera ?? (options.lookAtCamera ?? true)) ? 'camera' : 'forward';
    this.eyeLookAtConfig.wander = !!options.eyeWander;
    this.headLookAtConfig.enabled = !!options.headLookAtCamera;

    if (options.position) {
      if (options.position instanceof THREE.Vector3) {
        this.initialPosition.copy(options.position);
      } else if (Array.isArray(options.position)) {
        this.initialPosition.set(options.position[0], options.position[1], options.position[2]);
      }
    }
    if (typeof options.rotationY === 'number') {
      this.initialRotationY = options.rotationY;
    }

    this.ownsEffectTextManager = !options.effectTextManager;
    this.effectTextManager = options.effectTextManager ?? new EffectTextManager(scene);
    this.blinkTimer = this.getRandomBlinkInterval(3, 7);
    this.loadModel();
  }

  private isVisible: boolean = true;

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (this.vrm?.scene) {
      this.vrm.scene.visible = visible;
    }
  }

  public getVisible(): boolean {
    return this.vrm?.scene ? this.vrm.scene.visible : this.isVisible;
  }

  public setPosition(x: number, y: number, z: number): void {
    this.initialPosition.set(x, y, z);
    if (this.vrm) {
      this.vrm.scene.position.set(x, y, z);
    }
  }

  public setRotationY(rad: number): void {
    this.initialRotationY = rad;
    if (this.vrm) {
      this.vrm.scene.rotation.y = rad;
    }
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      resolveAssetUrl(this.options.modelUrl),
      async (gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        if (!vrm) {
          this.options.onError?.(new Error('No VRM found in GLTF user data'));
          return;
        }

        this.vrm = vrm;

        // VRM 0.0 rotation fix if needed
        VRMUtils.rotateVRM0(vrm);

        // Register custom expressions (e.g. nima)
        this.setupCustomExpressions(vrm);

        // 1. Flatten eye orbit normals to prevent crease/step shadows at inner eye corners
        //flattenEyeOrbitNormals(vrm.scene);

        // 2. Precompute Smooth Normals & Curvature for high-quality silhouette outline & auto line weight
        applySmoothNormalsToHierarchy(vrm.scene);

        // Adjust model orientation & initial position
        vrm.scene.rotation.y = this.initialRotationY;
        vrm.scene.position.copy(this.initialPosition);
        vrm.scene.visible = this.isVisible;

        // Setup shadows, depth write, Alpha-to-Coverage, and disable frustum culling (prevents SkinnedMesh face/hair clipping)
        vrm.scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = false;
            // SkinnedMesh GPU vertices deviate from static CPU boundingSphere, causing Three.js to cull Face/Hair
            mesh.frustumCulled = false;

            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mat of materials) {
              if (mat) {
                // Only enable depthWrite on opaque materials to prevent occluding transparent face features (eyes, eyebrows, eyelashes)
                const isTransparent = mat.transparent || (mat as any).alphaMode === 'BLEND';
                if (!isTransparent) {
                  mat.depthWrite = true;
                }
                mat.alphaToCoverage = true;

                // Maximize texture anisotropy & linear mipmap filtering to prevent staircasing
                for (const key of Object.keys(mat)) {
                  const val = (mat as any)[key];
                  if (val && (val as THREE.Texture).isTexture) {
                    const tex = val as THREE.Texture;
                    tex.anisotropy = 16;
                    tex.generateMipmaps = true;
                    tex.minFilter = THREE.LinearMipmapLinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    tex.needsUpdate = true;
                  }
                }
              }
            }
          }
        });

        this.scene.add(vrm.scene);

        // Initial VRM update to initialize bone matrices and texture uniforms
        vrm.update(0);

        // Cache initial rest/bind rotations for neck and head bones
        const restNeck = vrm.humanoid?.getNormalizedBoneNode('neck');
        if (restNeck) {
          this.restNeckRotation = restNeck.quaternion.clone();
          this.animNeckQuat.copy(restNeck.quaternion);
        }
        const restHead = vrm.humanoid?.getNormalizedBoneNode('head');
        if (restHead) {
          this.restHeadRotation = restHead.quaternion.clone();
          this.animHeadQuat.copy(restHead.quaternion);
        }

        // Limit eye lookAt maximum range to ~0.65 of full scale so eyes don't push into corners
        if (vrm.lookAt) {
          const l = vrm.lookAt;
          const applier = (l as any).applier;
          const eyeMaxRatio = 0.65;
          if (applier) {
            if (applier.rangeMapHorizontalInner) {
              applier.rangeMapHorizontalInner.outputScale *= eyeMaxRatio;
            }
            if (applier.rangeMapHorizontalOuter) {
              applier.rangeMapHorizontalOuter.outputScale *= eyeMaxRatio;
            }
          }
        }

        // Apply toon shading in-place
        const shaderOpts: ToonShaderOptions = {
          bodyPattern: /Body.*SKIN|body|skin|肌|体/i,
          hairPattern: /Hair|hair|髪/i,
          clothPattern: /Cloth|Tops|Bottoms|Shoes|Onepiece|outfit|dress|jacket|shirt|skirt|shoes|服|靴/i,
          config: this.options.config,
          camera: this.camera,
          hairShadow: this.options.hairShadow,
          debug: true,
        };

        this.shaderController = applyToonShader(vrm, this.scene, shaderOpts);
        this.shaderController.update();
        this.faceOverlayEffect = new FaceOverlayEffect(vrm.scene);
        this.morphTargetPreview = new MorphTargetPreview(vrm.scene);

        // Initialize animation mixer and play default animation if available
        this.mixer = new THREE.AnimationMixer(vrm.scene);
        if (this.options.defaultAnimationUrl) {
          await this.playAnimation(this.options.defaultAnimationUrl, true);
        }

        // Initialize tear effect
        this.tearEffect = new TearEffect(vrm, { enabled: false });

        // Initialize sweat effect
        this.sweatEffect = new SweatEffect(vrm, { enabled: false });

        // Initialize watery eye effect (blush & moist eyes)
        this.wateryEyeEffect = new WateryEyeEffect(vrm, { enabled: false });

        // Initialize fast motion effect (arms & legs anime motion effects)
        this.fastMotionEffect = new FastMotionEffect(vrm, this.scene, this.options.config?.fastMotion);

        this.options.onLoaded?.(this);
      },
      (progress) => {
        if (progress.total > 0) {
          const ratio = (progress.loaded / progress.total) * 100;
          this.options.onProgress?.(ratio);
        }
      },
      (error) => {
        this.options.onError?.(error);
      }
    );
  }

  private returnToIdleUrl: string | null = null;
  private boundMixerFinishedListener: ((e: any) => void) | null = null;
  private animationRequestId = 0;
  private transientClip: THREE.AnimationClip | null = null;
  private generatedAnimationFinished: (() => void) | null = null;

  private ensureAnimationMixer(): THREE.AnimationMixer {
    if (!this.mixer) this.mixer = new THREE.AnimationMixer(this.vrm!.scene);
    if (!this.boundMixerFinishedListener) {
      this.boundMixerFinishedListener = (event: { action: THREE.AnimationAction }) => {
        if (this.currentAction !== event.action) return;
        const finished = this.generatedAnimationFinished;
        this.generatedAnimationFinished = null;
        finished?.();
        // A queued clip may have started synchronously in the callback.
        if (this.returnToIdleUrl && this.currentAction === event.action) {
          const idle = this.returnToIdleUrl;
          this.returnToIdleUrl = null;
          void this.playAnimation(idle, true, 0.6);
        }
      };
      this.mixer.addEventListener('finished', this.boundMixerFinishedListener);
    }
    return this.mixer;
  }

  private releaseTransientClip(fade: number): void {
    const clip = this.transientClip;
    const mixer = this.mixer;
    this.transientClip = null;
    if (clip && mixer) setTimeout(() => mixer.uncacheClip(clip), (fade + 0.1) * 1000);
  }

  /** Play a generated clip directly, preserving expression and lip-sync updates. */
  public playAnimationClip(clip: THREE.AnimationClip, crossFadeDuration = 0.35, onFinished?: () => void): THREE.AnimationAction | null {
    if (!this.vrm) return null;
    this.animationRequestId++;
    const mixer = this.ensureAnimationMixer();
    this.releaseTransientClip(crossFadeDuration);
    const action = mixer.clipAction(clip);
    action.reset().setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = this.isMotionFrozen ? 0 : 1;
    if (this.currentAction) action.crossFadeFrom(this.currentAction, crossFadeDuration, false);
    action.play();
    this.currentAction = action;
    this.currentAnimationUrl = null;
    this.transientClip = clip;
    this.generatedAnimationFinished = onFinished ?? null;
    this.returnToIdleUrl = this.options.defaultAnimationUrl || '/animations/Idle.fbx';
    return action;
  }

  public stopGeneratedAnimation(): void {
    if (this.transientClip) {
      this.stopAnimation();
      void this.playAnimation(this.options.defaultAnimationUrl || '/animations/Idle.fbx');
    }
  }

  public async playAnimation(
    url: string,
    loop: boolean = true,
    crossFadeDuration: number = 0.5,
    returnToIdleUrl?: string,
    timeScale: number = 1.0
  ): Promise<THREE.AnimationAction | null> {
    if (!this.vrm) return null;
    const requestId = ++this.animationRequestId;
    this.generatedAnimationFinished = null;

    // If identical animation is already running, just continue playing seamlessly!
    if (this.currentAnimationUrl === url && this.currentAction && this.currentAction.isRunning()) {
      this.currentAction.timeScale = timeScale;
      if (loop) {
        this.returnToIdleUrl = null;
        this.currentAction.setLoop(THREE.LoopRepeat, Infinity);
      }
      return this.currentAction;
    }

    this.ensureAnimationMixer();

    try {
      const clip = await loadMixamoAnimation(url, this.vrm);
      if (!this.vrm || !this.mixer || requestId !== this.animationRequestId) {
        return null;
      }
      this.releaseTransientClip(crossFadeDuration);
      const action = this.mixer.clipAction(clip);

      if (loop) {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
        this.returnToIdleUrl = null;
      } else {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        this.returnToIdleUrl = returnToIdleUrl ?? (this.options.defaultAnimationUrl || '/animations/Idle.fbx');
      }

      action.reset();
      action.timeScale = this.isMotionFrozen ? 0 : timeScale;

      if (this.currentAction && this.currentAction !== action) {
        action.crossFadeFrom(this.currentAction, crossFadeDuration, false);
      }

      action.play();
      this.currentAction = action;
      this.currentAnimationUrl = url;
      return action;
    } catch (err) {
      if (requestId !== this.animationRequestId) return null;
      console.error(`Failed to play animation ${url}:`, err);
      const fallbackUrl = this.options.defaultAnimationUrl || '/animations/Idle.fbx';
      if (url !== fallbackUrl) {
        console.warn(`Falling back to default animation: ${fallbackUrl}`);
        return this.playAnimation(fallbackUrl, loop, crossFadeDuration, returnToIdleUrl);
      }
      return null;
    }
  }

  public stopAnimation(): void {
    this.generatedAnimationFinished = null;
    this.animationRequestId++;
    this.releaseTransientClip(0.3);
    this.returnToIdleUrl = null;
    if (this.currentAction) {
      this.currentAction.fadeOut(0.3);
      this.currentAction = null;
      this.currentAnimationUrl = null;
    }
  }

  /**
   * Register custom expressions (e.g. nima) to VRMExpressionManager
   */
  private setupCustomExpressions(vrm: VRM): void {
    if (!vrm.expressionManager) return;

    const customDefinitions = [
      {
        name: 'nima',
        isBinary: false,
        overrideBlink: 'none' as const,
        overrideLookAt: 'none' as const,
        overrideMouth: 'none' as const,
        morphTargetBinds: [
          {
            mesh: 'Face',
            shapeKey: 'Fcl_BRW_Sorrow',
            weight: 1.0,
          },
          {
            mesh: 'Face',
            shapeKey: 'Fcl_MTH_Fun',
            weight: 1.0,
          },
        ],
      },
    ];

    for (const def of customDefinitions) {
      if (vrm.expressionManager.getExpression(def.name)) {
        continue;
      }

      const expr = new VRMExpression(def.name);
      expr.isBinary = def.isBinary;
      expr.overrideBlink = def.overrideBlink;
      expr.overrideLookAt = def.overrideLookAt;
      expr.overrideMouth = def.overrideMouth;

      for (const bindDef of def.morphTargetBinds) {
        const candidateMeshes: { mesh: THREE.Mesh; index: number }[] = [];
        vrm.scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            const dict = mesh.morphTargetDictionary;
            if (dict && dict[bindDef.shapeKey] !== undefined) {
              candidateMeshes.push({ mesh, index: dict[bindDef.shapeKey] });
            }
          }
        });

        if (candidateMeshes.length === 0) continue;

        let targetMeshes = candidateMeshes;
        if (bindDef.mesh) {
          const named = candidateMeshes.filter((m) =>
            m.mesh.name.toLowerCase().includes(bindDef.mesh.toLowerCase())
          );
          if (named.length > 0) {
            targetMeshes = named;
          }
        }

        const indexMap = new Map<number, THREE.Mesh[]>();
        for (const { mesh, index } of targetMeshes) {
          if (!indexMap.has(index)) {
            indexMap.set(index, []);
          }
          indexMap.get(index)!.push(mesh);
        }

        for (const [index, primitives] of indexMap.entries()) {
          const bind = new VRMExpressionMorphTargetBind({
            primitives,
            index,
            weight: bindDef.weight,
          });
          expr.addBind(bind);
        }
      }

      vrm.scene.add(expr);
      vrm.expressionManager.registerExpression(expr);
    }
  }

  /**
   * Set facial expression with smooth crossfade interpolation.
   * @param expressionName Preset name ('happy', 'angry', 'sad', 'surprised', 'relaxed', 'nima', 'neutral') or custom morph name
   * @param weight Target intensity weight (default: 1.0)
   * @param duration Transition duration in seconds for smooth interpolation (default: 0.25s, 0 for instant)
   */
  public setExpression(expressionName: string, weight = 1.0, duration = 0.25): void {
    this.morphTargetPreview?.setEnabled(false);
    if (!this.vrm?.expressionManager) return;

    if (expressionName === 'normal') {
      expressionName = 'neutral';
    }

    if (expressionName !== 'yandere') {
      this.resetYandereFacialMorphs();
    }

    this.currentExpression = expressionName;
    this.expressionTransitionDuration = Math.max(0, duration);

    const manager = this.vrm.expressionManager;
    const emotionPresets = ['happy', 'angry', 'sad', 'surprised', 'relaxed', 'nima'];

    // Ensure preset emotions are registered in the weight maps
    emotionPresets.forEach((name) => {
      if (!this.emotionWeights.has(name)) {
        this.emotionWeights.set(name, manager.getValue(name) ?? 0.0);
        this.targetEmotionWeights.set(name, 0.0);
      }
    });

    // If custom expression name is specified, register it
    const isSpecial = ['neutral', 'blink', 'blinkLeft', 'blinkRight', 'aa', 'ih', 'ou', 'ee', 'oh', 'yandere'].includes(expressionName);
    if (!isSpecial && !this.emotionWeights.has(expressionName)) {
      this.emotionWeights.set(expressionName, manager.getValue(expressionName) ?? 0.0);
      this.targetEmotionWeights.set(expressionName, 0.0);
    }

    // Set target weights: target expression gets `weight`, all other tracked emotions decay to 0.0
    for (const key of this.targetEmotionWeights.keys()) {
      if (key === expressionName && expressionName !== 'neutral') {
        this.targetEmotionWeights.set(key, weight);
      } else {
        this.targetEmotionWeights.set(key, 0.0);
      }
    }

    // If duration is 0, apply immediately
    if (this.expressionTransitionDuration <= 0) {
      for (const [name, target] of this.targetEmotionWeights.entries()) {
        this.emotionWeights.set(name, target);
        manager.setValue(name, target);
      }
    }

    // If eyes are closed by the new expression, cancel ongoing procedural blink to avoid eyelid clipping
    if (this.isEyesClosed() && expressionName !== 'blink') {
      this.blinkState = 0;
      manager.setValue('blink', 0.0);
      this.blinkTimer = this.getRandomBlinkInterval(3.0, 6.0);
    }
  }

  /**
   * Update smooth crossfading of facial expressions towards their target weights.
   */
  private updateExpressions(delta: number): void {
    if (!this.vrm?.expressionManager) return;
    const manager = this.vrm.expressionManager;

    // Faster damping: lambda ~ 3.5 / duration ensures ~97% transition completion within duration
    const lambda = this.expressionTransitionDuration > 0
      ? 3.5 / Math.max(0.01, this.expressionTransitionDuration)
      : 100;

    for (const [name, target] of this.targetEmotionWeights.entries()) {
      const current = this.emotionWeights.get(name) ?? 0;
      if (Math.abs(target - current) > 0.0005) {
        const next = THREE.MathUtils.damp(current, target, lambda, delta);
        const finalVal = Math.abs(target - next) < 0.001 ? target : next;
        this.emotionWeights.set(name, finalVal);
        manager.setValue(name, finalVal);
      } else if (current !== target) {
        this.emotionWeights.set(name, target);
        manager.setValue(name, target);
      }
    }
  }

  /**
   * Check if the eyes are already closed or squinted (e.g. happy >= 0.5, relaxed >= 0.5, blink >= 0.5)
   * to suppress auto-blinking and avoid eyelid clipping / double-blinking.
   */
  public isEyesClosed(): boolean {
    if (!this.vrm?.expressionManager) return false;
    const manager = this.vrm.expressionManager;

    // Explicit blink expression set externally
    if (this.currentExpression === 'blink') return true;

    // Happy expression (usually squinted/closed eyes in anime VRM models, e.g. 0.9 or >= 0.5)
    const happy = manager.getValue('happy') ?? 0;
    if (happy >= 0.5) return true;

    // Relaxed expression (sleepy / eyes closed in many models)
    const relaxed = manager.getValue('relaxed') ?? 0;
    if (relaxed >= 0.5) return true;

    // Blink left / right (winking)
    const blinkLeft = (manager.getValue('blinkLeft') ?? manager.getValue('blink_l') ?? 0);
    const blinkRight = (manager.getValue('blinkRight') ?? manager.getValue('blink_r') ?? 0);
    if (blinkLeft >= 0.5 || blinkRight >= 0.5) return true;

    // If blinkState is 0 (not currently in procedural blink animation), but blink is high (e.g. set by animation clip or external script)
    if (this.blinkState === 0) {
      const blink = manager.getValue('blink') ?? 0;
      if (blink >= 0.5) return true;
    }

    return false;
  }

  public updateLipSync(
    phoneme: Phoneme | 'nn' | undefined,
    gain: number = 0.65,
    smoothing: number = 0.17,
    _delta: number = 0.016
  ): void {
    if (!this.vrm?.expressionManager) return;
    const manager = this.vrm.expressionManager;

    if (this.isLipSyncDisabled) {
      if (this.isLipSyncActive) {
        this.resetLipSync();
      }
      return;
    }

    const target: Record<Phoneme, number> = {
      aa: 0,
      ee: 0,
      ih: 0,
      oh: 0,
      ou: 0,
    };

    if (phoneme && phoneme !== 'nn') {
      target[phoneme] = 1.0;
      this.isLipSyncActive = true;
    }

    let hasNonZero = false;
    PHONEMES.forEach((p) => {
      const cw = this.phonemeWeights[p];
      const tw = target[p];

      // Fast attack for immediate opening, smooth decay for natural mouth closing
      const effectiveSmoothing = tw > cw 
        ? Math.min(1.0, smoothing * 2.0 + 0.25)
        : smoothing;

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
    const manager = this.vrm?.expressionManager;
    PHONEMES.forEach((p) => {
      this.phonemeWeights[p] = 0;
      if (manager) {
        manager.setValue(p, 0);
      }
    });
    this.isLipSyncActive = false;
  }

  public setLipSyncEnabled(enabled: boolean): void {
    this.isLipSyncDisabled = !enabled;
    if (!enabled) {
      this.resetLipSync();
    }
  }

  public setMotionFrozen(frozen: boolean): void {
    this.isMotionFrozen = frozen;
    if (this.currentAction) {
      this.currentAction.timeScale = frozen ? 0 : 1.0;
    }
  }

  public getIsMotionFrozen(): boolean {
    return this.isMotionFrozen;
  }

  public applyConfig(config: AvatarConfig): void {
    this.shaderController?.applyFullConfig(config);
    if (config.fastMotion) {
      this.fastMotionEffect?.updateConfig(config.fastMotion);
    }
  }

  public setMotionBlurEnabled(enabled: boolean): void {
    this.fastMotionEffect?.updateConfig({ directionalBlurEnabled: enabled });
  }

  public setMotionSpeed(speed: number): void {
    if (this.currentAction) {
      this.currentAction.timeScale = speed;
    }
  }

  public getMotionSpeed(): number {
    return this.currentAction ? this.currentAction.timeScale : 1.0;
  }

  private getRandomBlinkInterval(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private updateBlink(delta: number): void {
    if (!this.options.autoBlink || !this.vrm?.expressionManager) return;
    const manager = this.vrm.expressionManager;

    // Suppress blinking in Yandere mode so the avatar stares unblinkingly at the user
    if (this.isYandereActive && this.yandereConfig.suppressBlink) {
      if (this.blinkState !== 0) {
        this.blinkState = 0;
        manager.setValue('blink', 0.0);
      }
      return;
    }

    // Do not blink if eyes are closed (happy, relaxed, blink, winking, etc.)
    if (this.isEyesClosed()) {
      // If currently mid-blink animation when eyes were closed by an expression, reset blink state
      if (this.blinkState !== 0) {
        this.blinkState = 0;
        if (this.currentExpression !== 'blink') {
          manager.setValue('blink', 0.0);
        }
      }
      // Refresh blink timer so avatar doesn't immediately blink upon opening eyes
      this.blinkTimer = this.getRandomBlinkInterval(3.0, 6.0);
      return;
    }

    this.blinkTimer -= delta;
    if (this.blinkTimer < 0 && this.blinkState === 0) {
      this.blinkState = 1; // Start closing
      this.blinkTimer = this.getRandomBlinkInterval(3.5, 7.0);
    }

    const currentBlink = manager.getValue('blink') ?? 0;

    switch (this.blinkState) {
      case 1: { // Closing
        const next = Math.min(1.0, currentBlink + delta * 12);
        manager.setValue('blink', next);
        if (next >= 1.0) {
          this.blinkState = 2; // Closed
        }
        break;
      }
      case 2: { // Fully closed hold
        manager.setValue('blink', 1.0);
        this.blinkState = 3; // Ready to open
        break;
      }
      case 3: { // Opening
        const next = Math.max(0.0, currentBlink - delta * 12);
        manager.setValue('blink', next);
        if (next <= 0.0) {
          this.blinkState = 0; // Fully open
        }
        break;
      }
    }
  }

  public setLookAtCamera(enabled: boolean): void {
    this.options.lookAtCamera = enabled;
    this.eyeLookAtConfig.mode = enabled ? 'camera' : 'forward';
    if (!enabled && this.vrm?.lookAt) {
      // Look straight forward in model space
      const forwardPos = new THREE.Vector3(0, 1.4, 5.0);
      this.vrm.scene.localToWorld(forwardPos);
      this.vrm.lookAt.lookAt(forwardPos);
    }
  }

  /**
   * Configure eye look-at (mode, target, offset, wandering/restless eye movement).
   */
  public setEyeLookAt(config: Partial<EyeLookAtConfig>): void {
    if (config.mode !== undefined) this.eyeLookAtConfig.mode = config.mode;
    if ('targetPos' in config) this.eyeLookAtConfig.targetPos = config.targetPos;
    if ('targetGetter' in config) this.eyeLookAtConfig.targetGetter = config.targetGetter;
    if (config.offset !== undefined) {
      this.eyeLookAtConfig.offset = {
        x: config.offset.x ?? this.eyeLookAtConfig.offset.x,
        y: config.offset.y ?? this.eyeLookAtConfig.offset.y,
      };
    }
    if (config.wander !== undefined) this.eyeLookAtConfig.wander = config.wander;
    if (config.wanderIntensity !== undefined) this.eyeLookAtConfig.wanderIntensity = config.wanderIntensity;
    if (config.wanderSpeed !== undefined) this.eyeLookAtConfig.wanderSpeed = config.wanderSpeed;
  }

  /**
   * Adjust eye offset angles in radians (e.g. looking up, down, side glances).
   * x: Horizontal yaw offset (positive: right, negative: left)
   * y: Vertical pitch offset (positive: up, negative: down)
   */
  public setEyeOffset(x: number, y: number): void {
    this.eyeLookAtConfig.offset.x = x;
    this.eyeLookAtConfig.offset.y = y;
  }

  /**
   * Toggle or set wandering/restless eye movement (saccade/darting gaze).
   */
  public setEyeWander(enabled: boolean, intensity: number = 1.0): void {
    this.eyeLookAtConfig.wander = enabled;
    this.eyeLookAtConfig.wanderIntensity = intensity;
    if (!enabled) {
      this.eyeWanderCurrentOffset.set(0, 0);
      this.eyeWanderTargetOffset.set(0, 0);
    }
  }

  /**
   * Set head/face look-at camera tracking.
   * Naturally bends neck (35%) and head (65%) on top of FBX animations with physiological limits.
   */
  public setHeadLookAtCamera(enabled: boolean, options?: Partial<HeadLookAtConfig>): void {
    this.headLookAtConfig.enabled = enabled;
    if (options) {
      this.setHeadLookAt(options);
    }
  }

  /**
   * Detailed configuration for head/neck look-at.
   */
  public setHeadLookAt(config: Partial<HeadLookAtConfig>): void {
    if (config.enabled !== undefined) this.headLookAtConfig.enabled = config.enabled;
    if ('targetPos' in config) this.headLookAtConfig.targetPos = config.targetPos;
    if ('targetGetter' in config) this.headLookAtConfig.targetGetter = config.targetGetter;
    if (config.weight !== undefined) this.headLookAtConfig.weight = config.weight;
    if (config.offset !== undefined) {
      this.headLookAtConfig.offset = {
        x: config.offset.x ?? this.headLookAtConfig.offset.x,
        y: config.offset.y ?? this.headLookAtConfig.offset.y,
      };
    }
    if (config.maxYaw !== undefined) this.headLookAtConfig.maxYaw = config.maxYaw;
    if (config.maxPitch !== undefined) this.headLookAtConfig.maxPitch = config.maxPitch;
    if (config.smoothSpeed !== undefined) this.headLookAtConfig.smoothSpeed = config.smoothSpeed;
  }

  /**
   * アバター頭部（Headボーン）のワールド座標を取得する。
   * 相手キャラの目線・顔向きターゲットとして使用。
   */
  public getHeadWorldPosition(out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    const headNode =
      this.vrm?.humanoid?.getNormalizedBoneNode('head') ||
      this.vrm?.humanoid?.getRawBoneNode('head');
    if (headNode) {
      headNode.getWorldPosition(out);
    } else if (this.vrm?.scene) {
      this.vrm.scene.getWorldPosition(out);
      out.y += 1.4;
    } else {
      out.copy(this.initialPosition);
      out.y += 1.4;
    }
    return out;
  }

  /**
   * 会話時の自然な注目（顔の向き＋目線）を設定する。
   * 顔の向きは浅い角度（maxYaw 約20度、控えめなウェイト）とし、目線はターゲットをしっかり捉える。
   */
  public setConversationLookAt(options: {
    target: 'camera' | 'forward' | THREE.Vector3 | (() => THREE.Vector3 | null);
    shallowAngle?: boolean;
    maxYaw?: number;
    weight?: number;
    wander?: boolean;
    wanderIntensity?: number;
  }): void {
    const isCamera = options.target === 'camera';
    const isForward = options.target === 'forward';
    const isGetter = typeof options.target === 'function';
    const isVec = options.target instanceof THREE.Vector3;

    const shallow = options.shallowAngle ?? true;
    const maxYaw = options.maxYaw ?? (shallow ? THREE.MathUtils.degToRad(20) : THREE.MathUtils.degToRad(45));
    const maxPitch = shallow ? THREE.MathUtils.degToRad(15) : THREE.MathUtils.degToRad(25);
    const weight = options.weight ?? (shallow ? 0.6 : 0.85);

    if (isForward) {
      this.setLookAtCamera(false);
      this.setHeadLookAt({ enabled: false, targetGetter: undefined, targetPos: undefined });
      return;
    }

    const targetPos = options.target instanceof THREE.Vector3 ? options.target : undefined;
    const targetGetter = typeof options.target === 'function' ? options.target : undefined;

    this.setEyeLookAt({
      mode: isCamera ? 'camera' : 'custom',
      targetPos,
      targetGetter,
      wander: options.wander ?? false,
      wanderIntensity: options.wanderIntensity ?? 1.0,
      offset: { x: 0, y: 0 },
    });

    this.setHeadLookAt({
      enabled: true,
      targetPos,
      targetGetter,
      maxYaw,
      maxPitch,
      weight,
      smoothSpeed: 7.0,
      offset: { x: 0, y: 0 },
    });
  }

  public getEyeLookAtConfig(): Readonly<Required<EyeLookAtConfig>> {
    return this.eyeLookAtConfig as any;
  }

  public getHeadLookAtConfig(): Readonly<Required<HeadLookAtConfig>> {
    return this.headLookAtConfig as any;
  }

  /**
   * Update Head/Neck look-at by additively blending camera orientation onto active FBX animations.
   */
  private updateHeadLookAt(delta: number): void {
    if (!this.vrm?.humanoid) return;

    const headNode = this.vrm.humanoid.getNormalizedBoneNode('head');
    const neckNode = this.vrm.humanoid.getNormalizedBoneNode('neck');
    if (!headNode || !neckNode) return;

    let targetYaw = 0;
    let targetPitch = 0;

    if (this.headLookAtConfig.enabled) {
      const chestNode =
        this.vrm.humanoid.getNormalizedBoneNode('chest') ||
        this.vrm.humanoid.getNormalizedBoneNode('spine') ||
        this.vrm.humanoid.getNormalizedBoneNode('hips');

      const dynamicTarget = this.headLookAtConfig.targetGetter ? this.headLookAtConfig.targetGetter() : null;
      const targetWorldPos = dynamicTarget
        ? dynamicTarget.clone()
        : (this.headLookAtConfig.targetPos
          ? this.headLookAtConfig.targetPos.clone()
          : new THREE.Vector3());
      if (!dynamicTarget && !this.headLookAtConfig.targetPos) {
        this.camera.getWorldPosition(targetWorldPos);
      }

      // Reference orientation comes from avatar root orientation (stable model plane,
      // immune to individual animation torso twist poses like Female Standing Pose)
      const refQuatNode = this.vrm.scene;
      const refWorldQuat = new THREE.Quaternion();
      refQuatNode.getWorldQuaternion(refWorldQuat);

      // Reference position comes from neck/head origin (avoids artificial ~13deg chest-to-head upward tilt)
      const originNode = neckNode || headNode || refQuatNode;
      const refWorldPos = new THREE.Vector3();
      originNode.getWorldPosition(refWorldPos);

      // Vector from neck/head to target
      const dirWorld = targetWorldPos.sub(refWorldPos).normalize();
      // Direction in chest local space (+Z is forward, +Y is up, +X is left/right)
      const dirLocal = dirWorld.clone().applyQuaternion(refWorldQuat.clone().invert());

      // Raw horizontal (yaw) and vertical (pitch) angles
      const rawYaw = Math.atan2(dirLocal.x, dirLocal.z);
      const rawPitch = Math.atan2(dirLocal.y, Math.hypot(dirLocal.x, dirLocal.z));

      // Natural physiological motion limits (clamp)
      const maxYaw = this.headLookAtConfig.maxYaw;
      // Limit upward tilt (max 10 deg) so character never raises chin too high and looks condescending
      const maxPitchUp = THREE.MathUtils.degToRad(10);
      const maxPitchDown = this.headLookAtConfig.maxPitch;

      // Soft angle falloff if target is largely behind the avatar (> 85 deg)
      const absYaw = Math.abs(rawYaw);
      let angleWeight = 1.0;
      if (absYaw > THREE.MathUtils.degToRad(85)) {
        angleWeight = Math.max(0, 1.0 - (absYaw - THREE.MathUtils.degToRad(85)) / THREE.MathUtils.degToRad(45));
      }

      const clampedYaw = THREE.MathUtils.clamp(rawYaw, -maxYaw, maxYaw) * angleWeight;
      const clampedPitch = THREE.MathUtils.clamp(rawPitch, -maxPitchDown, maxPitchUp) * angleWeight;

      targetYaw = (clampedYaw + this.headLookAtConfig.offset.x) * this.headLookAtConfig.weight;
      targetPitch = (clampedPitch + this.headLookAtConfig.offset.y) * this.headLookAtConfig.weight;
    } else if (this.headLookAtConfig.offset.x !== 0 || this.headLookAtConfig.offset.y !== 0) {
      // Apply pure offset (e.g. slight chin-down correction for walking) even if not looking at camera
      targetYaw = this.headLookAtConfig.offset.x;
      targetPitch = this.headLookAtConfig.offset.y;
    }

    // Smooth exponential damping so head smoothly glides towards target
    const smoothRate = Math.min(1.0, 1.0 - Math.exp(-delta * this.headLookAtConfig.smoothSpeed));
    this.currentHeadYaw = THREE.MathUtils.lerp(this.currentHeadYaw, targetYaw, smoothRate);
    this.currentHeadPitch = THREE.MathUtils.lerp(this.currentHeadPitch, targetPitch, smoothRate);

    // If head look-at is disabled and has smoothly returned to neutral, don't override animation
    if (!this.headLookAtConfig.enabled && Math.abs(this.currentHeadYaw) < 0.0001 && Math.abs(this.currentHeadPitch) < 0.0001) {
      return;
    }

    // Distribute rotation naturally: 35% neck, 65% head
    const neckRatio = 0.35;
    const headRatio = 0.65;

    const neckYaw = this.currentHeadYaw * neckRatio;
    const neckPitch = this.currentHeadPitch * neckRatio;
    const headYaw = this.currentHeadYaw * headRatio;
    const headPitch = this.currentHeadPitch * headRatio;

    // Relative delta quaternions (Euler: -pitch for looking up, yaw for looking left/right)
    const qNeckDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(-neckPitch, neckYaw, 0, 'YXZ'));
    const qHeadDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(-headPitch, headYaw, 0, 'YXZ'));

    // If no animation is currently driving bones, ensure bones start from bind/rest pose
    if (!this.currentAction) {
      if (this.restNeckRotation) {
        neckNode.quaternion.copy(this.restNeckRotation);
      }
      if (this.restHeadRotation) {
        headNode.quaternion.copy(this.restHeadRotation);
      }
    }

    // Multiply additive delta on top of the clean FBX animation frame rotation.
    // This preserves expressive character acting (nodding, head shaking, tilting)
    // while keeping attention focused naturally towards the conversational target.
    neckNode.quaternion.multiply(qNeckDelta);
    headNode.quaternion.multiply(qHeadDelta);

    // Record inverse quaternions to cleanly cancel this delta next frame before mixer.update,
    // permanently preventing relative delta compounding regardless of animation pauses or clamps.
    this.lastNeckDeltaInverse.copy(qNeckDelta).invert();
    this.lastHeadDeltaInverse.copy(qHeadDelta).invert();
    this.hasAppliedHeadLookAt = true;
  }

  /**
   * Update Eye look-at with custom mode, directional offset and wandering saccade movement.
   */
  private updateEyeLookAt(delta: number, elapsed: number): void {
    if (!this.vrm?.lookAt) return;

    // Process procedural eye wander (psychological & NLP eye-accessing cues: up-right, down-left, etc.)
    if (this.eyeLookAtConfig.wander) {
      this.eyeWanderTimer += delta * this.eyeLookAtConfig.wanderSpeed;
      if (this.eyeWanderTimer >= this.eyeWanderInterval) {
        this.eyeWanderTimer = 0;
        // 0.16〜0.38秒ごとに次の方向へサッカード
        this.eyeWanderInterval = 0.16 + Math.random() * 0.22;

        const intensity = this.eyeLookAtConfig.wanderIntensity;

        // 心理学・NLPアイアクセシングキュー（嘘をつく時・動揺した時の視線方向）
        // 1. 上右 (右上: 視覚的創造 / 嘘や言い訳を思い浮かべる): yaw > 0, pitch > 0
        // 2. 下左 (左下: 内的対話 / 心の中で葛藤・自問自答): yaw < 0, pitch < 0
        // 3. 下右 (右下: 感情・照れ・うつむき): yaw > 0, pitch < 0
        // 4. 上左 (左上: 過去の記憶をたどる): yaw < 0, pitch > 0
        // 5. 中央 (相手の目元をチラッと見てすぐ逸らす)
        const roll = Math.random();
        let targetYaw = 0;
        let targetPitch = 0;

        if (roll < 0.32) {
          // 上右 (右上: 嘘をつく・想像・作り話の典型的な視線)
          targetYaw = (0.13 + Math.random() * 0.11) * intensity;
          targetPitch = (0.09 + Math.random() * 0.08) * intensity;
        } else if (roll < 0.58) {
          // 下左 (左下: 自問自答・後ろめたさ・動揺)
          targetYaw = (-0.12 - Math.random() * 0.10) * intensity;
          targetPitch = (-0.08 - Math.random() * 0.08) * intensity;
        } else if (roll < 0.74) {
          // 下右 (右下: 照れ・感情・うつむきがち)
          targetYaw = (0.10 + Math.random() * 0.09) * intensity;
          targetPitch = (-0.09 - Math.random() * 0.07) * intensity;
        } else if (roll < 0.88) {
          // 上左 (左上: 記憶を想起・迷い)
          targetYaw = (-0.11 - Math.random() * 0.09) * intensity;
          targetPitch = (0.08 + Math.random() * 0.07) * intensity;
        } else {
          // チラ見 (相手の目元をチラッと確認してすぐ逸らす)
          targetYaw = (Math.random() - 0.5) * 0.03 * intensity;
          targetPitch = (Math.random() - 0.5) * 0.02 * intensity;
        }

        this.eyeWanderTargetOffset.set(targetYaw, targetPitch);
      }

      // 素早いサッカード跳躍補間 (人間は約30〜40msで視線を跳躍させる)
      const t = Math.min(1.0, 1.0 - Math.exp(-delta * 28.0));
      this.eyeWanderCurrentOffset.lerp(this.eyeWanderTargetOffset, t);
    } else {
      const t = Math.min(1.0, 1.0 - Math.exp(-delta * 14.0));
      this.eyeWanderCurrentOffset.lerp(new THREE.Vector2(0, 0), t);
    }

    // Determine base target position
    const baseTargetPos = new THREE.Vector3();
    const headNode =
      this.vrm.humanoid?.getNormalizedBoneNode('head') ||
      this.vrm.humanoid?.getRawBoneNode('head');
    const headWorldPos = new THREE.Vector3();
    if (headNode) {
      headNode.getWorldPosition(headWorldPos);
    } else {
      this.vrm.scene.getWorldPosition(headWorldPos);
      headWorldPos.y += 1.4;
    }

    const dynamicEyeTarget = this.eyeLookAtConfig.targetGetter ? this.eyeLookAtConfig.targetGetter() : null;
    if (dynamicEyeTarget) {
      baseTargetPos.copy(dynamicEyeTarget);
    } else if (this.eyeLookAtConfig.mode === 'camera') {
      this.camera.getWorldPosition(baseTargetPos);
    } else if (this.eyeLookAtConfig.mode === 'custom' && this.eyeLookAtConfig.targetPos) {
      baseTargetPos.copy(this.eyeLookAtConfig.targetPos);
    } else {
      // 'forward' mode: 5 meters in front of the model's head
      const forwardVec = new THREE.Vector3(0, 0, 5.0);
      if (headNode) {
        const headWorldQuat = new THREE.Quaternion();
        headNode.getWorldQuaternion(headWorldQuat);
        forwardVec.applyQuaternion(headWorldQuat);
      } else {
        const vrmWorldQuat = new THREE.Quaternion();
        this.vrm.scene.getWorldQuaternion(vrmWorldQuat);
        forwardVec.applyQuaternion(vrmWorldQuat);
      }
      baseTargetPos.copy(headWorldPos).add(forwardVec);
    }

    // Vector from head to target
    const toTarget = baseTargetPos.clone().sub(headWorldPos);
    const dist = Math.max(0.5, toTarget.length());

    // Clamp relative horizontal angle from head orientation to ~32 deg so eyes don't roll excessively to edges
    const headQuat = new THREE.Quaternion();
    if (headNode) {
      headNode.getWorldQuaternion(headQuat);
    } else {
      this.vrm.scene.getWorldQuaternion(headQuat);
    }
    const localDir = toTarget.clone().applyQuaternion(headQuat.clone().invert());
    const rawEyeYaw = Math.atan2(localDir.x, localDir.z);
    const maxEyeYaw = THREE.MathUtils.degToRad(32);
    if (Math.abs(rawEyeYaw) > maxEyeYaw) {
      const clampedYaw = Math.sign(rawEyeYaw) * maxEyeYaw;
      const xzLen = Math.hypot(localDir.x, localDir.z);
      localDir.x = Math.sin(clampedYaw) * xzLen;
      localDir.z = Math.cos(clampedYaw) * xzLen;
      toTarget.copy(localDir.applyQuaternion(headQuat));
    }

    // Total eye yaw/pitch offsets
    const totalYaw = this.eyeLookAtConfig.offset.x + this.eyeWanderCurrentOffset.x;
    const totalPitch = this.eyeLookAtConfig.offset.y + this.eyeWanderCurrentOffset.y;

    if (Math.abs(totalYaw) > 0.0001 || Math.abs(totalPitch) > 0.0001) {
      const upVec = new THREE.Vector3(0, 1, 0);
      const rightVec = new THREE.Vector3();
      rightVec.crossVectors(toTarget, upVec).normalize();
      const realUpVec = new THREE.Vector3().crossVectors(rightVec, toTarget).normalize();

      toTarget.addScaledVector(rightVec, Math.sin(totalYaw) * dist);
      toTarget.addScaledVector(realUpVec, Math.sin(totalPitch) * dist);
    }

    const finalTargetPos = headWorldPos.clone().add(toTarget);
    this.vrm.lookAt.lookAt(finalTargetPos);
  }

  private updateBreathing(elapsed: number): void {
    if (!this.options.enableBreathing || !this.vrm) return;

    const root = this.vrm.scene;
    root.position.y = this.initialPosition.y + Math.sin(elapsed * 1.5) * 0.005;

    const head =
      this.vrm.humanoid?.getNormalizedBoneNode?.('head') ||
      this.vrm.humanoid?.getRawBoneNode?.('head');

    if (head) {
      head.rotation.z = Math.sin(elapsed * 1.2) * 0.01;
      head.rotation.x = Math.sin(elapsed * 1.5) * 0.008;
    }
  }

  public update(delta: number, elapsed: number, windCallback?: () => void, renderer?: THREE.WebGLRenderer): void {
    if (!this.vrm) return;
    this.morphTargetPreview?.restore();

    // Cancel previous frame's procedural Head Look-At before animation mixer runs,
    // restoring bone transforms to their pure animation/rest state and completely preventing accumulation.
    if (this.hasAppliedHeadLookAt && this.vrm.humanoid) {
      const neckNode = this.vrm.humanoid.getNormalizedBoneNode('neck');
      const headNode = this.vrm.humanoid.getNormalizedBoneNode('head');
      if (neckNode) neckNode.quaternion.multiply(this.lastNeckDeltaInverse);
      if (headNode) headNode.quaternion.multiply(this.lastHeadDeltaInverse);
      this.hasAppliedHeadLookAt = false;
    }

    // Update animation mixer first to update bone transformations
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Apply procedural Head Look-At on top of FBX animation (before vrm.update)
    this.updateHeadLookAt(delta);

    // Update smooth emotion expressions
    this.updateExpressions(delta);

    // Update eye blinking
    this.updateBlink(delta);

    // Update eye look-at tracking & wandering
    this.updateEyeLookAt(delta, elapsed);

    // If no FBX animation is active and motion not frozen, apply procedural breathing
    if (!this.currentAction && !this.isMotionFrozen) {
      this.updateBreathing(elapsed);
    }

    // Apply wind forces before VRM spring bone physics step
    if (windCallback) {
      windCallback();
    }

    // Update VRM internal state (expressions, humanoid, spring bones)
    this.vrm.update(delta);

    // Limit maximum horizontal eye gaze on ExpressionApplier to 0.65 to avoid unnatural eye corners
    if (this.vrm.expressionManager) {
      const left = this.vrm.expressionManager.getValue('lookLeft');
      if (left !== null && left > 0.65) {
        this.vrm.expressionManager.setValue('lookLeft', 0.65);
      }
      const right = this.vrm.expressionManager.getValue('lookRight');
      if (right !== null && right > 0.65) {
        this.vrm.expressionManager.setValue('lookRight', 0.65);
      }
    }

    // Apply Yandere pose (head tilt) and custom facial morphs after vrm.update
    if (this.isYandereActive) {
      if (this.yandereConfig.tiltHead) {
        const rawHead = this.vrm.humanoid?.getRawBoneNode?.('head');
        const rawNeck = this.vrm.humanoid?.getRawBoneNode?.('neck');
        const tilt = this.yandereConfig.tiltAngle;
        if (rawHead) {
          rawHead.rotation.z += tilt;
          rawHead.rotation.x -= 0.05; // Slightly pull chin down for an eerie upturned gaze
        }
        if (rawNeck) {
          rawNeck.rotation.z += tilt * 0.4;
        }
      }

      if (this.yandereConfig.applyExpression) {
        this.applyYandereFacialMorphs();
      }
    }

    // Apply Shafudo (Shaft head/neck tilt pose: arch back + look at camera + head tilt)
    if (this.isShafudoActive) {
      const rawHead = this.vrm.humanoid?.getRawBoneNode?.('head');
      const rawNeck = this.vrm.humanoid?.getRawBoneNode?.('neck');
      const rawSpine = this.vrm.humanoid?.getRawBoneNode?.('spine');
      const rawChest =
        this.vrm.humanoid?.getRawBoneNode?.('upperChest') ||
        this.vrm.humanoid?.getRawBoneNode?.('chest');

      // 1. 体を仰向け方向に倒す (spine, chest を後ろに反らす: -x)
      // 体の傾き自体はもう少しあっても良いとのことなので、反りをやや深める
      if (rawSpine) {
        rawSpine.rotation.x -= 0.35;
      }
      if (rawChest) {
        rawChest.rotation.x -= 0.45;
      }

      // 2. 首と頭で顔をカメラに向ける + シャフ度の首かしげロール
      // 体がカメラ側(手前)に約48度向いたことで、首の無理なねじれを大幅に緩和
      if (rawNeck) {
        rawNeck.rotation.y += 0.38;
        rawNeck.rotation.x += 0.08;
        rawNeck.rotation.z -= 0.15;
      }
      if (rawHead) {
        rawHead.rotation.y += 0.38;
        rawHead.rotation.x += 0.12;
        rawHead.rotation.z -= 0.20;
      }
    }

    // Keep the preview stable over VRM expressions, blinking, lip sync and direct morph effects.
    this.morphTargetPreview?.apply();

    // Update toon face shader & uniforms
    this.shaderController?.update();

    // Update active emotion effect texts
    this.effectTextManager?.update(delta, this.camera);

    // Update tear flow & glow effect
    this.tearEffect?.update(delta);

    // Update sweat mark effect
    this.sweatEffect?.update(delta);

    // Update watery eyes effect (blush & moist eye shimmering)
    const blinkVal = this.vrm?.expressionManager?.getValue('blink') ?? 0.0;
    const isClosed = this.isEyesClosed();
    const blinkWeight = Math.max(blinkVal, isClosed ? 1.0 : 0.0);
    this.wateryEyeEffect?.update(delta, elapsed, blinkWeight);

    // Dynamic animation for Eye Highlights and Iris when blush/watery eyes is active
    if (this.isBlushActive || (this.wateryEyeEffect && this.wateryEyeEffect.config.enabled)) {
      const wobbleX = Math.sin(elapsed * 4.2) * 0.012 + Math.cos(elapsed * 2.7) * 0.006;
      const wobbleY = Math.cos(elapsed * 3.6) * 0.012 + Math.sin(elapsed * 5.1) * 0.005;
      const rot = Math.sin(elapsed * 2.2) * 0.035;
      const pulseIntensity = 1.35 + 0.45 * Math.sin(elapsed * 3.8) + 0.2 * Math.sin(elapsed * 7.1);

      for (const item of this.originalHighlightMaterials) {
        const mat = item.material;
        if (mat.map) {
          mat.map.offset.set(
            item.originalOffset.x + wobbleX,
            item.originalOffset.y + wobbleY
          );
          mat.map.rotation = item.originalRotation + rot;
          mat.map.center.set(0.5, 0.5);
        }
        if (mat.emissive) {
          mat.emissive.setRGB(0.88, 0.96, 1.0);
          if (mat.uniforms?.emissive?.value) {
            mat.uniforms.emissive.value.setRGB(0.88, 0.96, 1.0);
          }
        }
        if (typeof mat.emissiveIntensity === 'number') {
          mat.emissiveIntensity = pulseIntensity;
          if (mat.uniforms?.emissiveIntensity) {
            mat.uniforms.emissiveIntensity.value = pulseIntensity;
          }
        }
        mat.needsUpdate = true;
      }

      const irisSheen = 0.16 + 0.08 * Math.sin(elapsed * 2.5);
      for (const item of this.originalIrisMaterials) {
        const mat = item.material;
        if (mat.emissive) {
          mat.emissive.setRGB(0.06, 0.16, 0.24);
          if (mat.uniforms?.emissive?.value) {
            mat.uniforms.emissive.value.setRGB(0.06, 0.16, 0.24);
          }
        }
        if (typeof mat.emissiveIntensity === 'number') {
          mat.emissiveIntensity = irisSheen;
          if (mat.uniforms?.emissiveIntensity) {
            mat.uniforms.emissiveIntensity.value = irisSheen;
          }
        }
        mat.needsUpdate = true;
      }
    }

    // Update fast motion effects (speed lines, afterimages, directional outline blur)
    this.fastMotionEffect?.update(delta, elapsed, this.camera, renderer ?? this.renderer ?? this.options.renderer);
  }

  private originalFaceTextures: Map<THREE.Material, THREE.Texture | null> = new Map();
  private loadedTextureCache: Map<string, THREE.Texture> = new Map();
  private textureLoader = new THREE.TextureLoader();

  public getFaceOverlays(): FaceOverlayState {
    return this.faceOverlayEffect?.getState() ?? { blush: false, sweat: false, anger: false };
  }

  public async setFaceOverlay(kind: FaceOverlayKind, enabled: boolean, textureUrl?: string): Promise<void> {
    if (!this.faceOverlayEffect) return;
    const pending = this.faceOverlayEffect.setEnabled(kind, enabled, textureUrl);
    const notify = () => window.dispatchEvent(new CustomEvent('avatar-face-overlays-change'));
    notify();
    try {
      await pending;
    } finally {
      notify();
    }
  }

  /**
   * Change a full face texture, or route the built-in transparent marks to overlay layers.
   * Passing null resets to the original face texture.
   */
  public setFaceTexture(textureUrl: string | null): void {
    if (!this.vrm) return;

    if (this.legacyFaceOverlay) {
      void this.setFaceOverlay(this.legacyFaceOverlay, false);
      this.legacyFaceOverlay = null;
    }
    const overlay = textureUrl ? getFaceOverlayKindForTexture(textureUrl) : null;
    if (overlay) {
      this.legacyFaceOverlay = overlay;
      void this.setFaceOverlay(overlay, true).catch(console.error);
      return;
    }

    const faceSkinMaterials: any[] = [];
    this.vrm.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of materials) {
          if (mat && mat.name && /Face.*SKIN|Face_00|Face/i.test(mat.name) && !/Mouth|Eye|Brow|Eyelash|Eyeline/i.test(mat.name)) {
            faceSkinMaterials.push(mat);
            if (!this.originalFaceTextures.has(mat)) {
              this.originalFaceTextures.set(mat, (mat as any).map ?? null);
            }
          }
        }
      }
    });

    if (!textureUrl) {
      // Reset to original texture
      faceSkinMaterials.forEach((mat) => {
        if (this.originalFaceTextures.has(mat)) {
          const orig = this.originalFaceTextures.get(mat) ?? null;
          if (orig) {
            mat.map = orig;
            if (mat.uniforms && mat.uniforms.map) {
              mat.uniforms.map.value = orig;
            }
            mat.needsUpdate = true;
          }
        }
      });
      return;
    }

    const applyTexture = (tex: THREE.Texture) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      faceSkinMaterials.forEach((mat) => {
        mat.map = tex;
        if (mat.uniforms && mat.uniforms.map) {
          mat.uniforms.map.value = tex;
        }
        mat.needsUpdate = true;
      });
    };

    if (this.loadedTextureCache.has(textureUrl)) {
      applyTexture(this.loadedTextureCache.get(textureUrl)!);
    } else {
      this.textureLoader.load(
        resolveAssetUrl(textureUrl),
        (tex) => {
          this.loadedTextureCache.set(textureUrl, tex);
          applyTexture(tex);
        },
        undefined,
        (err) => console.error(`Failed to load face texture: ${textureUrl}`, err)
      );
    }
  }

  public resetFaceTexture(): void {
    this.setFaceTexture(null);
  }

  private getSolidCanvasTexture(hexColor: string): THREE.CanvasTexture {
    if (this.solidTextureCache.has(hexColor)) {
      return this.solidTextureCache.get(hexColor)!;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = hexColor;
      ctx.fillRect(0, 0, 16, 16);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    this.solidTextureCache.set(hexColor, texture);
    return texture;
  }

  /**
   * Toggle or configure Blush (red cheeks + watery shimmering eyes) mode.
   * Layers blush over the original skin, with watery eyes and organic highlight wobble.
   */
  public setBlushMode(enabled: boolean, options?: Partial<BlushOptions>): void {
    if (!this.vrm) return;

    if (!enabled) {
      if (!this.isBlushActive) return;
      this.isBlushActive = false;
      this.blushConfig.enabled = false;

      // 1. Remove only the blush layer; other face marks remain independent.
      void this.setFaceOverlay('blush', false);

      // 2. Disable watery eye effect
      this.wateryEyeEffect?.setEnabled(false);

      // 3. Restore highlight & iris materials
      for (const item of this.originalHighlightMaterials) {
        const mat = item.material;
        if (mat.map) {
          mat.map.offset.copy(item.originalOffset);
          mat.map.rotation = item.originalRotation;
        }
        if (mat.emissive) {
          mat.emissive.copy(item.originalEmissive);
          if (mat.uniforms?.emissive?.value) {
            mat.uniforms.emissive.value.copy(item.originalEmissive);
          }
        }
        if (typeof mat.emissiveIntensity === 'number') {
          mat.emissiveIntensity = item.originalEmissiveIntensity;
          if (mat.uniforms?.emissiveIntensity) {
            mat.uniforms.emissiveIntensity.value = item.originalEmissiveIntensity;
          }
        }
        mat.needsUpdate = true;
      }
      this.originalHighlightMaterials = [];

      for (const item of this.originalIrisMaterials) {
        const mat = item.material;
        if (mat.emissive) {
          mat.emissive.copy(item.originalEmissive);
          if (mat.uniforms?.emissive?.value) {
            mat.uniforms.emissive.value.copy(item.originalEmissive);
          }
        }
        if (typeof mat.emissiveIntensity === 'number') {
          mat.emissiveIntensity = item.originalEmissiveIntensity;
          if (mat.uniforms?.emissiveIntensity) {
            mat.uniforms.emissiveIntensity.value = item.originalEmissiveIntensity;
          }
        }
        mat.needsUpdate = true;
      }
      this.originalIrisMaterials = [];

      return;
    }

    // Enable blush mode (cancels Yandere mode if active)
    if (this.isYandereActive) {
      this.setYandereMode(false);
    }

    this.isBlushActive = true;
    this.blushConfig = {
      ...this.blushConfig,
      ...options,
      enabled: true,
    };

    // 1. All bundled avatars share the transparent blush layer. Keep custom overlays supported.
    const requestedTexture = this.blushConfig.faceTexture;
    const customTexture = requestedTexture && !getFaceOverlayKindForTexture(requestedTexture)
      ? requestedTexture : undefined;
    void this.setFaceOverlay('blush', true, customTexture).catch(console.error);

    // 2. Enable watery eye effect
    if (this.blushConfig.wateryEyes) {
      if (this.blushConfig.wateryEyeConfig && this.wateryEyeEffect) {
        this.wateryEyeEffect.updateConfig(this.blushConfig.wateryEyeConfig);
      }
      this.wateryEyeEffect?.setEnabled(true);
    }

    // 3. Backup and register highlight & iris materials
    if (this.originalHighlightMaterials.length === 0 || this.originalIrisMaterials.length === 0) {
      this.vrm.scene.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh) return;
        const mesh = obj as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if (!mat) return;
          const matName = mat.name || '';
          if (/EyeHighlight|Highlight.*Eye/i.test(matName)) {
            if (!this.originalHighlightMaterials.some((m) => m.material === mat)) {
              this.originalHighlightMaterials.push({
                material: mat,
                originalOffset: (mat as any).map?.offset ? (mat as any).map.offset.clone() : new THREE.Vector2(0, 0),
                originalRotation: (mat as any).map?.rotation ?? 0,
                originalEmissive: (mat as any).emissive ? (mat as any).emissive.clone() : new THREE.Color(0, 0, 0),
                originalEmissiveIntensity: typeof (mat as any).emissiveIntensity === 'number' ? (mat as any).emissiveIntensity : 1.0,
              });
            }
          } else if (/EyeIris|Iris|瞳|虹彩/i.test(matName)) {
            if (!this.originalIrisMaterials.some((m) => m.material === mat)) {
              this.originalIrisMaterials.push({
                material: mat,
                originalEmissive: (mat as any).emissive ? (mat as any).emissive.clone() : new THREE.Color(0, 0, 0),
                originalEmissiveIntensity: typeof (mat as any).emissiveIntensity === 'number' ? (mat as any).emissiveIntensity : 0.0,
              });
            }
          }
        });
      });
    }
  }

  public isBlushMode(): boolean {
    return this.isBlushActive;
  }

  public getBlushConfig(): Required<BlushOptions> | null {
    return this.isBlushActive ? { ...this.blushConfig } : null;
  }

  /**
   * Toggle or configure Yandere (darkness) mode.
   * Disables eye highlights, makes iris textures solid flat color, adjusts head tilt and expression.
   */
  public setYandereMode(enabled: boolean, options?: Partial<YandereOptions>): void {
    if (!this.vrm) return;
    if (enabled) this.morphTargetPreview?.setEnabled(false);

    if (enabled && this.isBlushActive) {
      this.setBlushMode(false);
    }

    if (!enabled) {
      if (!this.isYandereActive) return;
      this.isYandereActive = false;
      this.yandereConfig.enabled = false;

      // Restore eyes to original state
      for (const state of this.originalEyeStates) {
        if (state.type === 'highlight') {
          if (state.originalVisible !== undefined) {
            state.material.visible = state.originalVisible;
          }
          if (typeof state.originalOpacity === 'number') {
            (state.material as any).opacity = state.originalOpacity;
          }
          if (state.mesh && state.morphTargetName && typeof state.originalMorphWeight === 'number') {
            const dict = state.mesh.morphTargetDictionary;
            const inf = state.mesh.morphTargetInfluences;
            if (dict && inf && dict[state.morphTargetName] !== undefined) {
              inf[dict[state.morphTargetName]] = state.originalMorphWeight;
            }
          }
          state.material.needsUpdate = true;
        } else if (state.type === 'iris') {
          const mat = state.material as any;
          if (state.originalMap !== undefined) {
            mat.map = state.originalMap;
            if (mat.uniforms?.map) mat.uniforms.map.value = state.originalMap;
          }
          if (state.originalColor) {
            mat.color?.copy(state.originalColor);
            if (mat.uniforms?.litFactor?.value) mat.uniforms.litFactor.value.copy(state.originalColor);
          }
          if (state.originalShadeColor && mat.shadeColorFactor) {
            mat.shadeColorFactor.copy(state.originalShadeColor);
            if (mat.uniforms?.shadeColorFactor?.value) mat.uniforms.shadeColorFactor.value.copy(state.originalShadeColor);
          }
          mat.needsUpdate = true;
        } else if (state.type === 'white') {
          const mat = state.material as any;
          if (state.originalColor) {
            mat.color?.copy(state.originalColor);
            if (mat.uniforms?.litFactor?.value) mat.uniforms.litFactor.value.copy(state.originalColor);
          }
          mat.needsUpdate = true;
        }
      }
      this.originalEyeStates = [];
      this.resetYandereFacialMorphs();

      // Restore expression
      this.setExpression(this.originalExpressionBeforeYandere || 'neutral');
      return;
    }

    // Enable / update Yandere Mode
    if (!this.isYandereActive) {
      this.originalExpressionBeforeYandere = this.currentExpression;
    }
    this.isYandereActive = true;
    this.yandereConfig = {
      ...this.yandereConfig,
      ...options,
      enabled: true,
    };

    const shouldBackup = this.originalEyeStates.length === 0;
    const solidColor = this.yandereConfig.color || '#3b080f';
    const solidTexture = this.getSolidCanvasTexture(solidColor);

    this.vrm.scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;

      // Check morph targets (e.g. Fcl_EYE_Highlight_Hide)
      if (this.yandereConfig.hideHighlights && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        const hideMorphName = 'Fcl_EYE_Highlight_Hide';
        if (mesh.morphTargetDictionary[hideMorphName] !== undefined) {
          const idx = mesh.morphTargetDictionary[hideMorphName];
          if (shouldBackup) {
            this.originalEyeStates.push({
              mesh,
              material: (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material,
              type: 'highlight',
              morphTargetName: hideMorphName,
              originalMorphWeight: mesh.morphTargetInfluences[idx],
            });
          }
          mesh.morphTargetInfluences[idx] = 1.0;
        }
      }

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((mat) => {
        if (!mat) return;
        const matName = mat.name || '';

        // 1. Eye Highlights (目の光を消す)
        if (/EyeHighlight|Highlight.*Eye/i.test(matName)) {
          if (this.yandereConfig.hideHighlights) {
            if (shouldBackup) {
              this.originalEyeStates.push({
                material: mat,
                type: 'highlight',
                originalVisible: mat.visible,
                originalOpacity: (mat as any).opacity,
              });
            }
            mat.visible = false;
            (mat as any).opacity = 0;
            if ((mat as any).emissiveIntensity !== undefined) {
              (mat as any).emissiveIntensity = 0;
            }
            mat.needsUpdate = true;
          }
        }
        // 2. Eye Iris (瞳テクスチャを単色化)
        else if (/EyeIris|Iris|瞳|虹彩/i.test(matName)) {
          const m = mat as any;
          if (shouldBackup) {
            this.originalEyeStates.push({
              material: mat,
              type: 'iris',
              originalMap: m.map ?? null,
              originalColor: m.color ? m.color.clone() : undefined,
              originalShadeColor: m.shadeColorFactor ? m.shadeColorFactor.clone() : undefined,
            });
          }

          if (this.yandereConfig.flatIrisTexture) {
            m.map = solidTexture;
            if (m.uniforms?.map) m.uniforms.map.value = solidTexture;
          }
          if (m.color) {
            m.color.set(solidColor);
            if (m.uniforms?.litFactor?.value) m.uniforms.litFactor.value.set(solidColor);
          }
          if (m.shadeColorFactor) {
            m.shadeColorFactor.set(solidColor);
            if (m.uniforms?.shadeColorFactor?.value) m.uniforms.shadeColorFactor.value.set(solidColor);
          }
          m.needsUpdate = true;
        }
        // 3. Eye White (白目をトーンダウン)
        else if (/EyeWhite|白目/i.test(matName)) {
          const m = mat as any;
          if (this.yandereConfig.dimEyeWhite) {
            if (shouldBackup) {
              this.originalEyeStates.push({
                material: mat,
                type: 'white',
                originalColor: m.color ? m.color.clone() : undefined,
              });
            }
            const dimColor = '#a8adb8';
            if (m.color) {
              m.color.set(dimColor);
              if (m.uniforms?.litFactor?.value) m.uniforms.litFactor.value.set(dimColor);
            }
            m.needsUpdate = true;
          }
        }
      });
    });

    // 4. Apply Yandere Expression (虚ろな微笑み・見開き)
    if (this.yandereConfig.applyExpression) {
      if (this.vrm.expressionManager) {
        const mgr = this.vrm.expressionManager;
        ['happy', 'angry', 'sad', 'surprised', 'relaxed', 'nima', 'neutral', 'aa', 'ih', 'ou', 'ee', 'oh', 'blink'].forEach((name) => {
          mgr.setValue(name, 0.0);
        });
      }
      this.emotionWeights.clear();
      this.targetEmotionWeights.clear();
      this.currentExpression = 'yandere';
      this.applyYandereFacialMorphs();
    }
  }

  /**
   * Directly apply custom VRoid morph targets for creepy open-eyed smile.
   * Mouth smiles while eyes remain unblinking and wide open.
   */
  private applyYandereFacialMorphs(): void {
    if (!this.vrm) return;
    this.vrm.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const d = mesh.morphTargetDictionary;
        const inf = mesh.morphTargetInfluences;
        if (d && inf) {
          // 1. Mouth creepy smile (pure mouth joy, eyes unaffected!)
          if (d['Fcl_MTH_Joy'] !== undefined) inf[d['Fcl_MTH_Joy']] = 0.95;
          if (d['Fcl_MTH_Up'] !== undefined) inf[d['Fcl_MTH_Up']] = 0.6;
          if (d['Fcl_MTH_Small'] !== undefined) inf[d['Fcl_MTH_Small']] = 0.35;

          // 2. Wide unblinking eye spread (highlights missing, dark iris fully visible)
          if (d['Fcl_EYE_Spread'] !== undefined) inf[d['Fcl_EYE_Spread']] = 0.65;
          if (d['Fcl_EYE_Surprised'] !== undefined) inf[d['Fcl_EYE_Surprised']] = 0.45;

          // 3. Brow sorrow/madness
          if (d['Fcl_BRW_Sorrow'] !== undefined) inf[d['Fcl_BRW_Sorrow']] = 0.45;
        }
      }
    });
  }

  /**
   * Reset custom VRoid morph targets applied during Yandere mode.
   */
  private resetYandereFacialMorphs(): void {
    if (!this.vrm) return;
    this.vrm.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const d = mesh.morphTargetDictionary;
        const inf = mesh.morphTargetInfluences;
        if (d && inf) {
          const morphsToReset = [
            'Fcl_MTH_Joy',
            'Fcl_MTH_Up',
            'Fcl_MTH_Small',
            'Fcl_EYE_Spread',
            'Fcl_EYE_Surprised',
            'Fcl_BRW_Sorrow',
          ];
          morphsToReset.forEach((name) => {
            if (d[name] !== undefined) {
              inf[d[name]] = 0.0;
            }
          });
        }
      }
    });
  }

  public isYandereMode(): boolean {
    return this.isYandereActive;
  }

  public getYandereConfig(): Required<YandereOptions> {
    return { ...this.yandereConfig };
  }

  public setShafudo(enabled: boolean): void {
    this.isShafudoActive = enabled;
  }

  public isShafudo(): boolean {
    return this.isShafudoActive;
  }

  private currentEffectKey: string | null = null;

  /**
   * Display manga-style emotion effect text attached to this VRM.
   * If the effect matches current active effect, it continues smoothly without restarting!
   */
  public showEffectText(options: Omit<ShowEffectTextOptions, 'target'> & { target?: VRM | THREE.Object3D }): EffectTextInstance | null {
    if (!this.effectTextManager) return null;

    const presetName = options.stylePreset || (options as any).preset || 'doki';
    const text = options.text || '';
    const effectKey = `${presetName}:${text}`;

    // If identical effect is already active, seamlessly continue it!
    if (this.currentEffectKey === effectKey && this.effectTextManager.activeCount > 0) {
      return null;
    }

    // Clear previous different effects and start new one
    this.effectTextManager.clear();
    this.currentEffectKey = effectKey;

    return this.effectTextManager.show({
      target: options.target ?? (this.vrm ?? undefined),
      ...options,
    });
  }

  public clearEffectText(): void {
    this.currentEffectKey = null;
    this.effectTextManager?.clear();
  }

  /**
   * Enable/disable or restart tear effect
   */
  public setTearsEnabled(enabled: boolean): void {
    if (this.tearEffect) {
      this.tearEffect.updateConfig({ enabled });
      if (enabled) {
        this.tearEffect.restart();
      }
    }
  }

  public setTearConfig(config: Partial<TearConfig>): void {
    this.tearEffect?.updateConfig(config);
  }

  public restartTears(): void {
    this.tearEffect?.restart();
  }

  /**
   * Enable/disable or restart sweat effect
   */
  public setSweatEnabled(enabled: boolean): void {
    if (this.sweatEffect) {
      this.sweatEffect.updateConfig({ enabled });
      if (enabled) {
        this.sweatEffect.restart();
      }
    }
  }

  public setSweatConfig(config: Partial<SweatConfig>): void {
    this.sweatEffect?.updateConfig(config);
  }

  public restartSweat(mode?: 'fly4' | 'jito', duration?: number): void {
    this.sweatEffect?.restart(mode, duration);
  }

  public showSweat(options?: { mode?: 'fly4' | 'jito'; duration?: number }): void {
    if (this.sweatEffect) {
      this.sweatEffect.restart(options?.mode ?? 'fly4', options?.duration ?? 3.0);
    }
  }

  public showJitoSweat(options?: { side?: 'right' | 'left' | 'both'; duration?: number }): void {
    if (this.sweatEffect) {
      if (options?.side) {
        this.sweatEffect.updateConfig({ side: options.side });
      }
      this.sweatEffect.restart('jito', options?.duration ?? 3.0);
    }
  }

  public showFlySweat(options?: { duration?: number }): void {
    if (this.sweatEffect) {
      this.sweatEffect.restart('fly4', options?.duration ?? 3.0);
    }
  }

  private removeShaftOutlines(): void {
    for (const outline of this.shaftOutlineMeshes) {
      outline.removeFromParent();
    }
    this.shaftOutlineMeshes = [];
    if (this.shaftOutlineMaterial) {
      this.shaftOutlineMaterial.dispose();
      this.shaftOutlineMaterial = null;
    }
  }

  /**
   * Toggle solid color (Shaft silhouette) mode with a bold white outline.
   */
  public setSolidColorMode(enabled: boolean, color: string | number = 0xff0000): void {
    if (!this.vrm) return;

    if (!enabled) {
      if (!this.isSolidColorActive) return;
      this.isSolidColorActive = false;
      this.removeShaftOutlines();
      for (const [mesh, origMat] of this.originalMeshMaterials) {
        mesh.material = origMat;
      }
      this.originalMeshMaterials.clear();
      return;
    }

    this.isSolidColorActive = true;
    this.solidColorValue = color;
    this.removeShaftOutlines();

    if (this.originalMeshMaterials.size === 0) {
      this.vrm.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh && obj.name !== '__shaft_white_outline__') {
          const mesh = obj as THREE.Mesh;
          this.originalMeshMaterials.set(mesh, mesh.material);
        }
      });
    }

    let mat = this.solidMaterialCache.get(color);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color as any),
        toneMapped: false,
        side: THREE.FrontSide,
      });
      this.solidMaterialCache.set(color, mat);
    }

    // Bold white outline material (inverted hull method)
    if (!this.shaftOutlineMaterial) {
      this.shaftOutlineMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.BackSide,
        toneMapped: false,
        depthWrite: true,
      });
      this.shaftOutlineMaterial.onBeforeCompile = (shader) => {
        shader.uniforms.uOutlineWidth = { value: 0.007 }; // 太めの白輪郭
        shader.vertexShader = 'uniform float uOutlineWidth;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          transformed += normal * uOutlineWidth;
          `
        );
      };
    }

    for (const [mesh] of this.originalMeshMaterials) {
      mesh.material = mat;

      let outlineMesh: THREE.Mesh;
      if ((mesh as any).isSkinnedMesh) {
        const skinned = mesh as THREE.SkinnedMesh;
        const oSkinned = new THREE.SkinnedMesh(skinned.geometry, this.shaftOutlineMaterial);
        oSkinned.bind(skinned.skeleton, skinned.bindMatrix);
        outlineMesh = oSkinned;
      } else {
        outlineMesh = new THREE.Mesh(mesh.geometry, this.shaftOutlineMaterial);
      }
      outlineMesh.name = '__shaft_white_outline__';
      outlineMesh.renderOrder = mesh.renderOrder;
      mesh.add(outlineMesh);
      this.shaftOutlineMeshes.push(outlineMesh);
    }
  }

  public getIsSolidColorActive(): boolean {
    return this.isSolidColorActive;
  }

  public getSolidColorValue(): string | number {
    return this.solidColorValue;
  }

  public dispose(): void {
    this.animationRequestId++;
    this.releaseTransientClip(0);
    this.morphTargetPreview?.dispose();
    this.morphTargetPreview = null;
    this.faceOverlayEffect?.dispose();
    this.faceOverlayEffect = null;
    if (this.isSolidColorActive) {
      this.setSolidColorMode(false);
    }
    this.removeShaftOutlines();
    this.solidMaterialCache.forEach((m) => m.dispose());
    this.solidMaterialCache.clear();
    this.originalMeshMaterials.clear();

    this.sweatEffect?.dispose();
    this.sweatEffect = null;

    this.tearEffect?.dispose();
    this.tearEffect = null;

    this.wateryEyeEffect?.dispose();
    this.wateryEyeEffect = null;

    this.fastMotionEffect?.dispose();
    this.fastMotionEffect = null;

    if (this.ownsEffectTextManager) {
      this.effectTextManager?.dispose();
    } else {
      this.effectTextManager?.clear();
    }
    this.effectTextManager = null;

    this.solidTextureCache.forEach((tex) => tex.dispose());
    this.solidTextureCache.clear();
    this.originalEyeStates = [];
    this.emotionWeights.clear();
    this.targetEmotionWeights.clear();

    this.shaderController?.dispose();
    this.shaderController = null;

    if (this.mixer) {
      if (this.boundMixerFinishedListener) this.mixer.removeEventListener('finished', this.boundMixerFinishedListener);
      this.boundMixerFinishedListener = null;
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
      this.vrm = null;
    }
  }
}
