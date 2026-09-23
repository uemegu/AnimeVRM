import * as THREE from 'three';
import { Avatar, YandereOptions, BlushOptions } from '../Avatar';
import { AvatarConfig } from '../Config';
import { EffectTextManager } from '../effects/text';
import { WindController } from '../wind/WindController';
import { TypographyOverlay } from '../animation/TypographyOverlay';
import { ShortAnimationPlayer } from '../animation/ShortAnimationPlayer';
import { resolveAssetUrl } from '../utils/path';
import { showToast } from '../ui/components/Toast';
import { updateAnimationPlayStateUI } from '../ui/helpers';
import { AudioLipSync } from '../AudioLipSync';
import { GeminiLiveChatController } from '../ai/live/GeminiLiveChatController';
import { FACE_OVERLAY_KINDS, FACE_OVERLAY_TEXTURES, FaceOverlayKind, FaceOverlayState } from '../effects/FaceOverlayEffect';

export function isMotionLoop(url: string): boolean {
  return url.includes('Idle') || url.includes('Walking') || url.includes('Jogging') || url.includes('Pose');
}

export class AvatarManager {
  public avatarInstance: Avatar | null = null;
  public currentModelUrl: string = resolveAssetUrl('/models/aoi/aoi-school.vrm');
  public currentMotionUrl: string = resolveAssetUrl('/animations/Idle.fbx');
  public customMotions: Array<{ name: string; url: string }> = [];
  public currentExprName: string = 'neutral';
  public scenarioAvatars: Map<string, Avatar> = new Map<string, Avatar>();
  public isMultiAvatarScenarioActive: boolean = false;
  /** Scenario character (if any) that should respond to the transform controls. */
  public controlledScenarioAvatarId: string | null = null;
  private faceOverlayState: FaceOverlayState = { blush: false, sweat: false, anger: false };

  public typographyOverlay: TypographyOverlay;
  public animationPlayer: ShortAnimationPlayer;

  private originalMotionUrlBeforeAnim: string = resolveAssetUrl('/animations/Idle.fbx');

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: any;
  private sharedEffectTextManager: EffectTextManager;
  private windController: WindController;
  private getConfig: () => AvatarConfig;
  private onAvatarLoaded?: (avatar: Avatar) => void;
  private liveChatController?: GeminiLiveChatController;

  constructor(options: {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: any;
    sharedEffectTextManager: EffectTextManager;
    windController: WindController;
    getConfig: () => AvatarConfig;
    liveChatController?: GeminiLiveChatController;
    renderer?: THREE.WebGLRenderer;
    onEnterTransparent: () => void;
    onExitTransparent: () => void;
    onAvatarLoaded?: (avatar: Avatar) => void;
  }) {
    this.renderer = options.renderer ?? null;
    this.scene = options.scene;
    this.camera = options.camera;
    this.controls = options.controls;
    this.sharedEffectTextManager = options.sharedEffectTextManager;
    this.windController = options.windController;
    this.getConfig = options.getConfig;
    this.liveChatController = options.liveChatController;
    this.onAvatarLoaded = options.onAvatarLoaded;

    this.typographyOverlay = new TypographyOverlay();
    this.animationPlayer = new ShortAnimationPlayer({
      camera: this.camera,
      controls: this.controls,
      overlay: this.typographyOverlay,
      getConfig: this.getConfig,
      onEnterTransparent: () => {
        this.originalMotionUrlBeforeAnim = this.currentMotionUrl;
        options.onEnterTransparent();
      },
      onExitTransparent: () => {
        options.onExitTransparent();
      },
      onPlayStateChange: (isPlaying) => {
        updateAnimationPlayStateUI(isPlaying);
      },
      onPlayMotion: (motionUrl) => {
        if (!this.avatarInstance) return;
        if (motionUrl === 'stop') {
          this.avatarInstance.stopAnimation();
          return;
        }
        if (motionUrl && motionUrl !== 'none') {
          const resolved = resolveAssetUrl(motionUrl);
          const isLoop = isMotionLoop(resolved);
          this.avatarInstance.playAnimation(resolved, isLoop);
        }
      },
      onRestoreMotion: () => {
        if (!this.avatarInstance) return;
        if (this.originalMotionUrlBeforeAnim === 'none') {
          this.avatarInstance.stopAnimation();
        } else if (this.originalMotionUrlBeforeAnim) {
          const isLoop = isMotionLoop(this.originalMotionUrlBeforeAnim);
          this.avatarInstance.playAnimation(this.originalMotionUrlBeforeAnim, isLoop);
        }
      },
    });
  }

  public renderer: THREE.WebGLRenderer | null = null;

  public setRenderer(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    if (this.avatarInstance) {
      this.avatarInstance.renderer = renderer;
    }
    for (const av of this.scenarioAvatars.values()) {
      av.renderer = renderer;
    }
  }

  public setLiveChatController(controller: GeminiLiveChatController): void {
    this.liveChatController = controller;
  }

  public loadAvatarModel(modelUrl: string): void {
    this.currentModelUrl = modelUrl;

    const loadingStatus = document.getElementById('loading-status');
    if (loadingStatus) {
      loadingStatus.innerHTML = `モデル読み込み中... <span id="progress-text">0%</span>`;
    }

    if (this.avatarInstance) {
      if (this.avatarInstance.vrm) this.faceOverlayState = this.avatarInstance.getFaceOverlays();
      this.avatarInstance.dispose();
      this.avatarInstance = null;
      this.windController.resetModel();
    }

    const cfg = this.getConfig();

    this.avatarInstance = new Avatar(this.scene, this.camera, {
      modelUrl: modelUrl,
      defaultAnimationUrl: this.currentMotionUrl !== 'none' ? this.currentMotionUrl : undefined,
      config: cfg,
      autoBlink: true,
      lookAtCamera: true,
      enableBreathing: true,
      effectTextManager: this.sharedEffectTextManager,
      renderer: this.renderer ?? undefined,
      onProgress: (progress) => {
        const el = document.getElementById('progress-text');
        if (el) el.textContent = `${progress.toFixed(0)}%`;
      },
      onLoaded: (avatar) => {
        if (this.liveChatController) {
          this.liveChatController.setAvatar(avatar);
        }
        if (this.currentExprName !== 'neutral') {
          avatar.setExpression(this.currentExprName, 1.0);
        }
        for (const kind of FACE_OVERLAY_KINDS) {
          void avatar.setFaceOverlay(kind, this.faceOverlayState[kind]).catch(console.error);
        }
        if (this.solidColorState.enabled) {
          avatar.setSolidColorMode(true, this.solidColorState.color);
        }
        if (this.onAvatarLoaded) {
          this.onAvatarLoaded(avatar);
        }
        window.dispatchEvent(new CustomEvent('avatar-model-change'));

        const el = document.getElementById('loading-status');
        if (el) {
          const displayName = modelUrl.startsWith('blob:') ? 'ローカルVRM' : modelUrl.split('/').pop();
          el.innerHTML = `<span style="color: #16a34a; font-weight: 600;">✓ ロード完了</span> (${displayName})`;
        }
        const displayName = modelUrl.startsWith('blob:') ? 'ローカルVRM' : modelUrl.split('/').pop();
        showToast(`👤 モデルを読み込みました: ${displayName}`);

        document.querySelectorAll<HTMLButtonElement>('.model-btn').forEach((btn) => {
          const btnModel = btn.getAttribute('data-model');
          btn.classList.toggle('active', btnModel === modelUrl);
        });
      },
      onError: (error) => {
        console.error('Failed to load VRM avatar:', error);
        const el = document.getElementById('loading-status');
        if (el) {
          el.innerHTML = `<span style="color: #dc2626; font-weight: 600;">✗ ロード失敗</span>`;
        }
        showToast('❌ モデルの読み込みに失敗しました');
      },
    });
    window.dispatchEvent(new CustomEvent('avatar-face-overlays-change'));
    window.dispatchEvent(new CustomEvent('avatar-model-change'));
  }

  public getVrmMeshes(): THREE.Object3D[] {
    const vrmMeshes: THREE.Object3D[] = [];
    if (this.isMultiAvatarScenarioActive) {
      for (const av of this.scenarioAvatars.values()) {
        if (av.vrm?.scene) vrmMeshes.push(av.vrm.scene);
      }
    } else if (this.avatarInstance?.vrm?.scene) {
      vrmMeshes.push(this.avatarInstance.vrm.scene);
    }
    return vrmMeshes;
  }

  public update(
    delta: number,
    elapsed: number,
    cfg: AvatarConfig,
    audioLipSync: AudioLipSync,
    activeSpeakerCharacterId?: string
  ): void {
    if (this.isMultiAvatarScenarioActive) {
      for (const [charId, av] of this.scenarioAvatars.entries()) {
        const isSpeaking = activeSpeakerCharacterId ? (activeSpeakerCharacterId === charId) : true;
        if (cfg.lipSync.enabled && isSpeaking) {
          av.updateLipSync(
            audioLipSync.currentPhoneme,
            cfg.lipSync.gain,
            cfg.lipSync.smoothing,
            delta
          );
        } else {
          av.updateLipSync(undefined, cfg.lipSync.gain, cfg.lipSync.smoothing, delta);
        }
        av.update(
          delta,
          elapsed,
          () => {
            this.windController.update(av.vrm ?? null, cfg.wind, elapsed);
          },
          this.renderer ?? undefined
        );
      }
    } else if (this.avatarInstance) {
      if (cfg.lipSync.enabled) {
        this.avatarInstance.updateLipSync(
          audioLipSync.currentPhoneme,
          cfg.lipSync.gain,
          cfg.lipSync.smoothing,
          delta
        );
      }

      this.avatarInstance.update(
        delta,
        elapsed,
        () => {
          this.windController.update(this.avatarInstance?.vrm ?? null, cfg.wind, elapsed);
        },
        this.renderer ?? undefined
      );
    }
  }

  public setAvatarPosition(x: number, y: number, z: number): void {
    this.getTransformTargetAvatar()?.setPosition(x, y, z);
  }

  public getAvatarPosition(): THREE.Vector3 {
    const target = this.getTransformTargetAvatar();
    if (target?.vrm) {
      return target.vrm.scene.position;
    }
    return new THREE.Vector3(0, 0, 0);
  }

  public setAvatarRotationY(rad: number): void {
    this.getTransformTargetAvatar()?.setRotationY(rad);
  }

  public getAvatarRotationY(): number {
    const target = this.getTransformTargetAvatar();
    if (target?.vrm) {
      return target.vrm.scene.rotation.y;
    }
    return 0;
  }

  public setControlledScenarioAvatar(id: string | null): void {
    this.controlledScenarioAvatarId = id;
  }

  private getTransformTargetAvatar(): Avatar | null {
    if (
      this.controlledScenarioAvatarId &&
      this.scenarioAvatars.has(this.controlledScenarioAvatarId)
    ) {
      return this.scenarioAvatars.get(this.controlledScenarioAvatarId) ?? null;
    }
    return this.avatarInstance;
  }

  public setAvatarVisible(visible: boolean): void {
    if (this.avatarInstance?.vrm) {
      this.avatarInstance.vrm.scene.visible = visible;
    }
  }

  public getAvatarVisible(): boolean {
    if (this.avatarInstance?.vrm) {
      return this.avatarInstance.vrm.scene.visible;
    }
    return true;
  }

  public setYandereMode(enabled: boolean, options?: Partial<YandereOptions>): void {
    if (this.avatarInstance) {
      this.avatarInstance.setYandereMode(enabled, options);
    }
    for (const av of this.scenarioAvatars.values()) {
      av.setYandereMode(enabled, options);
    }
  }

  public isYandereMode(): boolean {
    return this.avatarInstance?.isYandereMode() ?? false;
  }

  public getYandereConfig(): Required<YandereOptions> | null {
    return this.avatarInstance?.getYandereConfig() ?? null;
  }

  public getFaceBlushTextureForModel(_modelUrl?: string): string {
    return FACE_OVERLAY_TEXTURES.blush;
  }

  public getFaceOverlays(): FaceOverlayState {
    return this.avatarInstance?.vrm ? this.avatarInstance.getFaceOverlays() : { ...this.faceOverlayState };
  }

  public async setFaceOverlay(kind: FaceOverlayKind, enabled: boolean): Promise<void> {
    this.faceOverlayState[kind] = enabled;
    const avatars = new Set(this.scenarioAvatars.values());
    if (this.avatarInstance) avatars.add(this.avatarInstance);
    await Promise.all([...avatars].map((avatar) => avatar.setFaceOverlay(kind, enabled)));
  }

  public setBlushMode(enabled: boolean, options?: Partial<BlushOptions>): void {
    const opts: Partial<BlushOptions> = {
      faceTexture: this.getFaceBlushTextureForModel(),
      wateryEyes: true,
      ...options,
    };
    if (this.avatarInstance) {
      this.avatarInstance.setBlushMode(enabled, opts);
    }
    for (const av of this.scenarioAvatars.values()) {
      av.setBlushMode(enabled, opts);
    }
  }

  public isBlushMode(): boolean {
    return this.avatarInstance?.isBlushMode() ?? false;
  }

  public getBlushConfig(): Required<BlushOptions> | null {
    return this.avatarInstance?.getBlushConfig() ?? null;
  }

  private solidColorState: { enabled: boolean; color: string | number } = { enabled: false, color: 0xff0000 };

  public getCharacterColor(identifier?: string): string | null {
    if (!identifier) return null;
    const lower = identifier.toLowerCase();
    if (lower.includes('aoi') || lower === 'girl_01') {
      return '#f59e0b'; // 黄色系
    } else if (lower.includes('emili') || lower === 'girl_02') {
      return '#dc2626'; // 赤系
    } else if (lower.includes('shion')) {
      return '#2563eb'; // 青系
    }
    return null;
  }

  public setSolidColorMode(enabled: boolean, color: string | number = 0xff0000): void {
    this.solidColorState = { enabled, color };
    if (this.avatarInstance) {
      const c = this.getCharacterColor(this.currentModelUrl) || color;
      this.avatarInstance.setSolidColorMode(enabled, c);
    }
    for (const [charId, av] of this.scenarioAvatars.entries()) {
      const c = this.getCharacterColor(charId) || this.getCharacterColor(this.currentModelUrl) || color;
      av.setSolidColorMode(enabled, c);
    }
  }

  public isSolidColorMode(): boolean {
    return this.solidColorState.enabled;
  }

  public getSolidColorState(): { enabled: boolean; color: string | number } {
    return { ...this.solidColorState };
  }
}
