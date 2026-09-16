import * as THREE from 'three';
import type { AvatarManager } from '../avatar/AvatarManager';
import type { ViewerCore } from '../scene/ViewerCore';
import type { AudioLipSync } from '../AudioLipSync';
import { BlackoutOverlay } from '../ui/BlackoutOverlay';
import { Live2DOverlay } from './Live2DOverlay';
import { Live2DConfig, DEFAULT_LIVE2D_CONFIG } from './types';

export type DisplayMode = 'vrm' | 'transitioning_to_live2d' | 'live2d' | 'transitioning_to_vrm';

export class Live2DTransitionManager {
  private avatarManager: AvatarManager;
  private viewerCore: ViewerCore;
  private audioLipSync?: AudioLipSync;
  private blackoutOverlay: BlackoutOverlay;
  public live2dOverlay: Live2DOverlay;

  private config: Live2DConfig;
  private currentMode: DisplayMode = 'vrm';
  private appCanvas: HTMLCanvasElement;
  private modeListeners: Array<(mode: DisplayMode) => void> = [];

  // Scene-specific overrides
  private sceneOverrideEnabled: boolean | null = null;

  // Math helper
  private _targetPos = new THREE.Vector3();
  private _camPos = new THREE.Vector3();

  constructor(options: {
    avatarManager: AvatarManager;
    viewerCore: ViewerCore;
    audioLipSync?: AudioLipSync;
    config?: Partial<Live2DConfig>;
  }) {
    this.avatarManager = options.avatarManager;
    this.viewerCore = options.viewerCore;
    this.audioLipSync = options.audioLipSync;
    this.config = { ...DEFAULT_LIVE2D_CONFIG, ...(options.config ?? {}) };

    this.appCanvas = this.viewerCore.canvas;
    this.blackoutOverlay = new BlackoutOverlay();
    this.live2dOverlay = new Live2DOverlay({
      config: this.config,
    });

    this.live2dOverlay.init();
  }

  public setSceneOverride(enabled: boolean | null): void {
    this.sceneOverrideEnabled = enabled;
  }

  public get mode(): DisplayMode {
    return this.currentMode;
  }

  public onModeChange(callback: (mode: DisplayMode) => void): () => void {
    this.modeListeners.push(callback);
    return () => {
      this.modeListeners = this.modeListeners.filter((l) => l !== callback);
    };
  }

  private notifyModeChange(): void {
    for (const listener of this.modeListeners) {
      try {
        listener(this.currentMode);
      } catch (e) {
        console.error('Error in Live2D mode listener:', e);
      }
    }
  }

  public async toggle(): Promise<void> {
    if (
      this.currentMode === 'transitioning_to_live2d' ||
      this.currentMode === 'transitioning_to_vrm'
    ) {
      return;
    }
    if (this.currentMode === 'live2d') {
      await this.transitionToVRM();
    } else {
      await this.transitionToLive2D();
    }
  }

  public isTargetModel(): boolean {
    const currentModel = this.avatarManager.currentModelUrl.toLowerCase();
    return this.config.targetModelSubstrings.some((sub) => currentModel.includes(sub.toLowerCase()));
  }

  /**
   * Check camera distance and trigger transition if threshold crossed (when proximityTriggerEnabled is true).
   * Called every frame in main tick loop.
   */
  public update(delta: number): void {
    // Update live2d animations if visible
    if (this.currentMode === 'live2d' || this.live2dOverlay.isVisible) {
      // Sync lip-sync from AudioLipSync
      if (this.audioLipSync) {
        const phoneme = this.audioLipSync.currentPhoneme;
        const rms = this.audioLipSync.currentRms;
        if (this.audioLipSync.isPlaying && phoneme && phoneme !== 'nn') {
          this.live2dOverlay.expressions.setPhoneme(phoneme, Math.min(1, 0.5 + rms * 6));
        } else if (!this.audioLipSync.isPlaying && this.live2dOverlay.expressions.open > 0) {
          this.live2dOverlay.expressions.stopSpeaking();
        }
      }

      // Sync blush from Avatar
      const avatar = this.avatarManager.avatarInstance;
      if (avatar?.isBlushMode()) {
        this.live2dOverlay.expressions.setBlush(0.85);
      } else if (this.live2dOverlay.expressions.blush > 0) {
        this.live2dOverlay.expressions.setBlush(0);
      }

      this.live2dOverlay.render(delta);
    }

    if (!this.config.enabled || !this.live2dOverlay.isReady) return;

    // Do not initiate new transitions while already transitioning
    if (
      this.currentMode === 'transitioning_to_live2d' ||
      this.currentMode === 'transitioning_to_vrm'
    ) {
      return;
    }

    // Explicit scene override handling
    if (this.sceneOverrideEnabled === false) {
      if (this.currentMode === 'live2d') {
        this.transitionToVRM();
      }
      return;
    }
    if (this.sceneOverrideEnabled === true) {
      if (this.currentMode === 'vrm') {
        this.transitionToLive2D();
      }
      return;
    }

    // When model changes away from target model, return to VRM
    if (!this.isTargetModel()) {
      if (this.currentMode === 'live2d') {
        this.transitionToVRM();
      }
      return;
    }

    // Proximity trigger is disabled by default; only execute if explicitly enabled
    if (this.config.proximityTriggerEnabled) {
      const dist = this.calculateDistance();
      if (dist < 0) return;

      if (this.currentMode === 'vrm' && dist <= this.config.triggerDistance) {
        this.transitionToLive2D();
      } else if (this.currentMode === 'live2d' && dist >= this.config.restoreDistance) {
        this.transitionToVRM();
      }
    }
  }

  public calculateDistance(): number {
    const avatar = this.avatarManager.avatarInstance;
    if (!avatar?.vrm?.scene) return -1;

    // Prefer chest / head target point
    const chestNode =
      avatar.vrm.humanoid?.getNormalizedBoneNode('upperChest') ||
      avatar.vrm.humanoid?.getNormalizedBoneNode('chest') ||
      avatar.vrm.humanoid?.getNormalizedBoneNode('head');

    if (chestNode) {
      chestNode.getWorldPosition(this._targetPos);
    } else {
      avatar.vrm.scene.getWorldPosition(this._targetPos);
      this._targetPos.y += 1.25; // default chest height
    }

    this._camPos.copy(this.viewerCore.camera.position);
    return this._camPos.distanceTo(this._targetPos);
  }

  public async transitionToLive2D(): Promise<void> {
    if (this.currentMode !== 'vrm') return;
    this.currentMode = 'transitioning_to_live2d';
    this.notifyModeChange();

    const fadeOutMs = this.config.fadeOutDurationMs ?? 160;
    const holdMs = this.config.holdDurationMs ?? 50;
    const fadeInMs = this.config.fadeInDurationMs ?? 180;

    await this.blackoutOverlay.fadeTransition(
      () => {
        // 1. Hide 3D VRM Avatar
        const avatar = this.avatarManager.avatarInstance;
        if (avatar) {
          avatar.setVisible(false);
          // Sync blush state if avatar is blushing
          if (avatar.isBlushMode()) {
            this.live2dOverlay.expressions.setBlush(0.85);
          }
        }

        // 2. Apply background blur & close-up zoom to Three.js canvas
        const zoomScale = this.config.backgroundZoomScale ?? 1.22;
        this.appCanvas.style.transition = 'filter 0.25s ease, transform 0.25s cubic-bezier(0.2, 0, 0.2, 1)';
        this.appCanvas.style.filter = `blur(${this.config.blurAmount}px) brightness(0.95)`;
        this.appCanvas.style.transform = `scale(${zoomScale})`;

        // 3. Show Live2D Overlay
        this.live2dOverlay.setVisible(true);
      },
      fadeOutMs,
      holdMs,
      fadeInMs
    );

    this.currentMode = 'live2d';
    this.notifyModeChange();
  }

  public async transitionToVRM(): Promise<void> {
    if (this.currentMode !== 'live2d') return;
    this.currentMode = 'transitioning_to_vrm';
    this.notifyModeChange();

    const fadeOutMs = this.config.fadeOutDurationMs ?? 160;
    const holdMs = this.config.holdDurationMs ?? 50;
    const fadeInMs = this.config.fadeInDurationMs ?? 180;

    await this.blackoutOverlay.fadeTransition(
      () => {
        // 1. Hide Live2D Overlay
        this.live2dOverlay.setVisible(false);

        // 2. Remove background blur
        this.appCanvas.style.filter = '';
        this.appCanvas.style.transform = '';

        // 3. Restore 3D VRM Avatar
        const avatar = this.avatarManager.avatarInstance;
        if (avatar) {
          avatar.setVisible(true);
        }
      },
      fadeOutMs,
      holdMs,
      fadeInMs
    );

    this.currentMode = 'vrm';
    this.notifyModeChange();
  }

  public dispose(): void {
    this.live2dOverlay.dispose();
    this.blackoutOverlay.dispose();
    this.appCanvas.style.filter = '';
    this.appCanvas.style.transform = '';
  }
}
