import * as THREE from 'three';
import { Avatar } from '../Avatar';
import { AvatarConfig } from '../Config';
import { EffectTextManager } from '../effects/text';
import { WindController } from '../wind/WindController';
import { TypographyOverlay } from '../animation/TypographyOverlay';
import { ShortAnimationPlayer } from '../animation/ShortAnimationPlayer';
import { resolveAssetUrl } from '../utils/path';
import { showToast } from '../ui/components/Toast';
import { updateAnimationPlayStateUI } from '../ui/helpers';
import { AudioLipSync } from '../AudioLipSync';
import { AvatarChatController } from '../ai/AvatarChatController';

export function isMotionLoop(url: string): boolean {
  return url.includes('Idle') || url.includes('Walking') || url.includes('Jogging') || url.includes('Pose');
}

export class AvatarManager {
  public avatarInstance: Avatar | null = null;
  public currentModelUrl: string = resolveAssetUrl('/models/girl.vrm');
  public currentMotionUrl: string = resolveAssetUrl('/animations/Idle.fbx');
  public customMotions: Array<{ name: string; url: string }> = [];
  public currentExprName: string = 'neutral';
  public scenarioAvatars: Map<string, Avatar> = new Map<string, Avatar>();
  public isMultiAvatarScenarioActive: boolean = false;

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
  private avatarChatController?: AvatarChatController;

  constructor(options: {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: any;
    sharedEffectTextManager: EffectTextManager;
    windController: WindController;
    getConfig: () => AvatarConfig;
    avatarChatController?: AvatarChatController;
    onEnterTransparent: () => void;
    onExitTransparent: () => void;
    onAvatarLoaded?: (avatar: Avatar) => void;
  }) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.controls = options.controls;
    this.sharedEffectTextManager = options.sharedEffectTextManager;
    this.windController = options.windController;
    this.getConfig = options.getConfig;
    this.avatarChatController = options.avatarChatController;
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

  public setChatController(controller: AvatarChatController): void {
    this.avatarChatController = controller;
  }

  public loadAvatarModel(modelUrl: string): void {
    this.currentModelUrl = modelUrl;

    const loadingStatus = document.getElementById('loading-status');
    if (loadingStatus) {
      loadingStatus.innerHTML = `モデル読み込み中... <span id="progress-text">0%</span>`;
    }

    if (this.avatarInstance) {
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
      onProgress: (progress) => {
        const el = document.getElementById('progress-text');
        if (el) el.textContent = `${progress.toFixed(0)}%`;
      },
      onLoaded: (avatar) => {
        if (this.avatarChatController) {
          this.avatarChatController.setAvatar(avatar);
        }
        if (this.currentExprName !== 'neutral') {
          avatar.setExpression(this.currentExprName, 1.0);
        }
        if (this.onAvatarLoaded) {
          this.onAvatarLoaded(avatar);
        }

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
        av.update(delta, elapsed, () => {
          this.windController.update(av.vrm ?? null, cfg.wind, elapsed);
        });
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

      this.avatarInstance.update(delta, elapsed, () => {
        this.windController.update(this.avatarInstance?.vrm ?? null, cfg.wind, elapsed);
      });
    }
  }
}
