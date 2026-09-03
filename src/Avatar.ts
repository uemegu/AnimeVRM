import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import {
  applyToonShader,
  ToonShaderController,
  ToonShaderOptions,
} from './ToonShader';
import { applySmoothNormalsToHierarchy } from './shader/SmoothNormalHelper';
import type { AvatarConfig } from './Config';
import { PHONEMES, Phoneme } from './AudioLipSync';
import { resolveAssetUrl } from './utils/path';
import { EffectTextManager, ShowEffectTextOptions, EffectTextInstance } from './effects/text';
import { TearEffect, TearConfig } from './effects/tears';
import { SweatEffect, SweatConfig } from './effects/sweat';

export interface AvatarOptions {
  modelUrl: string;
  defaultAnimationUrl?: string;
  config?: AvatarConfig;
  position?: THREE.Vector3 | [number, number, number];
  rotationY?: number;
  autoBlink?: boolean;
  lookAtCamera?: boolean;
  enableBreathing?: boolean;
  effectTextManager?: EffectTextManager;
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

export class Avatar {
  public vrm: VRM | null = null;
  public scene: THREE.Scene;
  public camera: THREE.Camera;
  public shaderController: ToonShaderController | null = null;
  public mixer: THREE.AnimationMixer | null = null;
  public currentAction: THREE.AnimationAction | null = null;
  public currentAnimationUrl: string | null = null;
  public effectTextManager: EffectTextManager | null = null;
  public tearEffect: TearEffect | null = null;
  public sweatEffect: SweatEffect | null = null;

  public initialPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public initialRotationY: number = 0;

  private options: AvatarOptions;
  private ownsEffectTextManager = false;
  private blinkTimer = 0;
  private blinkState: 0 | 1 | 2 | 3 = 0; // 0: open, 1: closing, 2: closed, 3: opening
  private currentExpression: string = 'neutral';

  public phonemeWeights: Record<Phoneme, number> = {
    aa: 0,
    ee: 0,
    ih: 0,
    oh: 0,
    ou: 0,
  };
  public isLipSyncActive: boolean = false;

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
      enableBreathing: options.enableBreathing ?? true,
      effectTextManager: options.effectTextManager,
      onProgress: options.onProgress ?? (() => {}),
      onLoaded: options.onLoaded ?? (() => {}),
      onError: options.onError ?? ((err) => console.error(err)),
    };

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

        // Optimize geometry & joints
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);

        // Precompute Smooth Normals & Curvature for high-quality silhouette outline & auto line weight
        applySmoothNormalsToHierarchy(vrm.scene);

        // Adjust model orientation & initial position
        vrm.scene.rotation.y = this.initialRotationY;
        vrm.scene.position.copy(this.initialPosition);

        // Setup shadows, depth write, Alpha-to-Coverage, and texture filtering
        vrm.scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = false;

            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mat of materials) {
              if (mat) {
                mat.depthWrite = true;
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

        // Apply toon shading in-place
        const shaderOpts: ToonShaderOptions = {
          bodyPattern: /Body.*SKIN|body|skin|肌|体/i,
          hairPattern: /Hair|hair|髪/i,
          clothPattern: /Cloth|Tops|Bottoms|Shoes|Onepiece|outfit|dress|jacket|shirt|skirt|shoes|服|靴/i,
          config: this.options.config,
          debug: true,
        };

        this.shaderController = applyToonShader(vrm, this.scene, shaderOpts);
        this.shaderController.update();

        // Initialize animation mixer and play default animation if available
        this.mixer = new THREE.AnimationMixer(vrm.scene);
        if (this.options.defaultAnimationUrl) {
          await this.playAnimation(this.options.defaultAnimationUrl, true);
        }

        // Initialize tear effect
        this.tearEffect = new TearEffect(vrm, { enabled: false });

        // Initialize sweat effect
        this.sweatEffect = new SweatEffect(vrm, { enabled: false });

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

  public async playAnimation(
    url: string,
    loop: boolean = true,
    crossFadeDuration: number = 0.5,
    returnToIdleUrl?: string
  ): Promise<THREE.AnimationAction | null> {
    if (!this.vrm) return null;

    // If identical animation is already running, just continue playing seamlessly!
    if (this.currentAnimationUrl === url && this.currentAction && this.currentAction.isRunning()) {
      if (loop) {
        this.returnToIdleUrl = null;
        this.currentAction.setLoop(THREE.LoopRepeat, Infinity);
      }
      return this.currentAction;
    }

    if (!this.mixer) {
      this.mixer = new THREE.AnimationMixer(this.vrm.scene);
      this.boundMixerFinishedListener = (e: { action: THREE.AnimationAction }) => {
        if (this.returnToIdleUrl && this.currentAction === e.action) {
          const idle = this.returnToIdleUrl;
          this.returnToIdleUrl = null;
          this.playAnimation(idle, true, 0.6);
        }
      };
      this.mixer.addEventListener('finished', this.boundMixerFinishedListener);
    }

    try {
      const clip = await loadMixamoAnimation(url, this.vrm);
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

  public stopAnimation(): void {
    this.returnToIdleUrl = null;
    if (this.currentAction) {
      this.currentAction.fadeOut(0.3);
      this.currentAction = null;
      this.currentAnimationUrl = null;
    }
  }

  public setExpression(expressionName: string, weight = 1.0): void {
    if (!this.vrm?.expressionManager) return;

    this.currentExpression = expressionName;

    const manager = this.vrm.expressionManager;
    const presets = ['happy', 'angry', 'sad', 'surprised', 'relaxed', 'neutral', 'aa', 'ih', 'ou', 'ee', 'oh'];

    // Reset preset expressions
    presets.forEach((name) => {
      if (name !== 'blink') {
        manager.setValue(name, 0.0);
      }
    });

    if (expressionName !== 'neutral') {
      manager.setValue(expressionName, weight);
    }
  }

  public updateLipSync(
    phoneme: Phoneme | 'nn' | undefined,
    gain: number = 0.65,
    smoothing: number = 0.17,
    _delta: number = 0.016
  ): void {
    if (!this.vrm?.expressionManager) return;
    const manager = this.vrm.expressionManager;

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

  public applyConfig(config: AvatarConfig): void {
    this.shaderController?.applyFullConfig(config);
  }

  private getRandomBlinkInterval(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private updateBlink(delta: number): void {
    if (!this.options.autoBlink || !this.vrm?.expressionManager) return;
    const manager = this.vrm.expressionManager;

    // Do not blink if happy or during certain expressions
    if (manager.getValue('happy') === 1.0) return;

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

  private updateLookAt(): void {
    if (!this.options.lookAtCamera || !this.vrm?.lookAt) return;
    const targetPos = new THREE.Vector3();
    this.camera.getWorldPosition(targetPos);
    this.vrm.lookAt.lookAt(targetPos);
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

  public update(delta: number, elapsed: number, windCallback?: () => void): void {
    if (!this.vrm) return;

    // Update animation mixer first to update bone transformations
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Update eye blinking
    this.updateBlink(delta);

    // Update camera look-at tracking
    this.updateLookAt();

    // If no FBX animation is active, apply procedural breathing
    if (!this.currentAction) {
      this.updateBreathing(elapsed);
    }

    // Apply wind forces before VRM spring bone physics step
    if (windCallback) {
      windCallback();
    }

    // Update VRM internal state (expressions, humanoid, spring bones)
    this.vrm.update(delta);

    // Update toon face shader & uniforms
    this.shaderController?.update();

    // Update active emotion effect texts
    this.effectTextManager?.update(delta, this.camera);

    // Update tear flow & glow effect
    this.tearEffect?.update(delta);

    // Update sweat mark effect
    this.sweatEffect?.update(delta);
  }

  private originalFaceTextures: Map<THREE.Material, THREE.Texture | null> = new Map();
  private loadedTextureCache: Map<string, THREE.Texture> = new Map();
  private textureLoader = new THREE.TextureLoader();

  /**
   * Dynamically change the face skin texture (e.g. blush / red cheeks face texture).
   * Passing null resets to the original face texture.
   */
  public setFaceTexture(textureUrl: string | null): void {
    if (!this.vrm) return;

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
        const orig = this.originalFaceTextures.get(mat) ?? null;
        mat.map = orig;
        if (mat.uniforms && mat.uniforms.map) {
          mat.uniforms.map.value = orig;
        }
        mat.needsUpdate = true;
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

  public dispose(): void {
    this.sweatEffect?.dispose();
    this.sweatEffect = null;

    this.tearEffect?.dispose();
    this.tearEffect = null;

    if (this.ownsEffectTextManager) {
      this.effectTextManager?.dispose();
    } else {
      this.effectTextManager?.clear();
    }
    this.effectTextManager = null;

    this.shaderController?.dispose();
    this.shaderController = null;

    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
      this.vrm = null;
    }
  }
}
