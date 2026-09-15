import * as THREE from 'three';
import { Avatar } from '../Avatar';
import { AvatarConfig } from '../Config';
import { AudioLipSync } from '../AudioLipSync';
import { EffectTextManager } from '../effects/text';
import { MasterDataManager } from '../master/MasterDataManager';
import { WindController } from '../wind/WindController';
import { DialogueCameraController } from './DialogueCameraController';
import { ScenarioEngine } from './ScenarioEngine';
import { ScenarioPlayer, ScenarioStep } from '../animation/ScenarioPlayer';
import { ScrollingBackgroundManager } from '../scene/ScrollingBackgroundManager';
import { PanoramaBackgroundController } from '../scene/PanoramaBackgroundController';
import { InterludeOverlay } from '../ui/InterludeOverlay';
import {
  ScenarioPackage,
  ScenarioCharacterPlacement,
  AvatarSlotPosition,
  AVATAR_POSITION_PRESETS,
  AVATAR_ROTATION_PRESETS,
} from './types';
import { ScenePresetId } from '../presets/ScenePresets';
import { resolveAssetUrl } from '../utils/path';
import { showToast } from '../ui/components/Toast';
import {
  updateScenarioPlayStateUI,
  updateScenarioStepUI,
  updateScenarioDebugUI,
} from '../ui/helpers';
import { AvatarManager } from '../avatar/AvatarManager';
import { AnimeDreamBackground } from '../effects/AnimeDreamBackground';
import { PvTitleOverlay } from '../ui/PvTitleOverlay';
import { ShaftModeController } from '../effects/shaft/ShaftModeController';

export class ScenarioController {
  public dialogueCameraController: DialogueCameraController;
  public scrollingBackgroundManager: ScrollingBackgroundManager;
  public dreamBackground: AnimeDreamBackground;
  public interludeOverlay: InterludeOverlay;
  public pvTitleOverlay: PvTitleOverlay;
  public scenarioPlayer: ScenarioPlayer;
  public scenarioEngine: ScenarioEngine;
  public masterManager: MasterDataManager;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: any;
  private avatarManager: AvatarManager;
  private sharedEffectTextManager: EffectTextManager;
  private windController: WindController;
  private getConfig: () => AvatarConfig;
  private onApplyConfig: (cfg: AvatarConfig) => void;
  private onSwitchScenePreset: (presetId: ScenePresetId) => void;
  private panoramaController?: PanoramaBackgroundController;
  private shaftModeController?: ShaftModeController;

  private savedCameraPosBeforeMultiAvatar: THREE.Vector3 | null = null;
  private savedCameraTargetBeforeMultiAvatar: THREE.Vector3 | null = null;

  constructor(options: {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: any;
    avatarManager: AvatarManager;
    audioLipSync: AudioLipSync;
    sharedEffectTextManager: EffectTextManager;
    windController: WindController;
    panoramaController?: PanoramaBackgroundController;
    shaftModeController?: ShaftModeController;
    getConfig: () => AvatarConfig;
    onApplyConfig: (cfg: AvatarConfig) => void;
    onSwitchScenePreset: (presetId: ScenePresetId) => void;
    onFinished?: () => void;
  }) {
    this.panoramaController = options.panoramaController;
    this.shaftModeController = options.shaftModeController;
    const panoramaController = options.panoramaController;
    this.scene = options.scene;
    this.camera = options.camera;
    this.controls = options.controls;
    this.avatarManager = options.avatarManager;
    this.sharedEffectTextManager = options.sharedEffectTextManager;
    this.windController = options.windController;
    this.getConfig = options.getConfig;
    this.onApplyConfig = options.onApplyConfig;
    this.onSwitchScenePreset = options.onSwitchScenePreset;
    this.masterManager = new MasterDataManager();

    this.scrollingBackgroundManager = new ScrollingBackgroundManager({
      scene: this.scene,
      camera: this.camera,
    });

    this.dreamBackground = new AnimeDreamBackground(this.scene, this.camera);

    this.interludeOverlay = new InterludeOverlay();
    this.pvTitleOverlay = new PvTitleOverlay();

    this.dialogueCameraController = new DialogueCameraController({
      camera: this.camera,
      controls: this.controls,
      panoramaController: options.panoramaController,
      getAvatar: (charId?: string) => {
        if (this.avatarManager.isMultiAvatarScenarioActive) {
          if (charId && this.avatarManager.scenarioAvatars.has(charId)) {
            return this.avatarManager.scenarioAvatars.get(charId)!;
          }
          return this.avatarManager.scenarioAvatars.values().next().value ?? null;
        }
        return this.avatarManager.avatarInstance;
      },
      getAvatars: () => {
        if (this.avatarManager.isMultiAvatarScenarioActive) {
          return Array.from(this.avatarManager.scenarioAvatars.values());
        }
        return this.avatarManager.avatarInstance ? [this.avatarManager.avatarInstance] : [];
      },
    });

    this.scenarioPlayer = new ScenarioPlayer({
      getAvatar: () =>
        this.avatarManager.isMultiAvatarScenarioActive
          ? this.avatarManager.scenarioAvatars.values().next().value ?? null
          : this.avatarManager.avatarInstance,
      getAudioLipSync: () => options.audioLipSync,
      onStepChange: (index: number, step: ScenarioStep) => {
        updateScenarioStepUI(index, step);
      },
      onApplyStepCamera: (step: ScenarioStep) => {
        this.dialogueCameraController.applyScene({
          id: `step_${step.displayText || step.text}`,
          text: step.text,
          cameraZoom: step.cameraZoom,
          cameraDistance: step.cameraDistance,
          cameraPreset: step.cameraPreset,
          cameraStrength: step.cameraStrength,
          cameraStartAngle: step.cameraStartAngle,
          cameraTransitionDuration: step.cameraTransitionDuration,
          cameraTransitionEasing: step.cameraTransitionEasing,
        });
      },
      onPlayStateChange: () => {
        if (!this.scenarioPlayer.isPlaying) {
          this.dialogueCameraController.stop();
          this.scrollingBackgroundManager.hide();
          this.dreamBackground.stop(true);
        }
        this.syncPlayStateUI();
      },
      onFinished: () => {
        this.dialogueCameraController.stop();
        this.scrollingBackgroundManager.hide();
        this.dreamBackground.stop(true);
      },
    });

    this.scenarioEngine = new ScenarioEngine({
      getAvatar: (charId?: string) => {
        if (this.avatarManager.isMultiAvatarScenarioActive) {
          if (charId && this.avatarManager.scenarioAvatars.has(charId)) {
            return this.avatarManager.scenarioAvatars.get(charId)!;
          }
          return this.avatarManager.scenarioAvatars.values().next().value ?? null;
        }
        return this.avatarManager.avatarInstance;
      },
      getAvatars: () => {
        if (this.avatarManager.isMultiAvatarScenarioActive) {
          return Array.from(this.avatarManager.scenarioAvatars.values());
        }
        return this.avatarManager.avatarInstance ? [this.avatarManager.avatarInstance] : [];
      },
      getAudioLipSync: () => options.audioLipSync,
      masterManager: this.masterManager,
      onPlayStateChange: () => {
        if (!this.scenarioEngine.isPlaying) {
          this.dialogueCameraController.stop();
          this.scrollingBackgroundManager.hide();
          this.pvTitleOverlay.hide();
          this.shaftModeController?.setShaftMode(false);
        }
        this.syncPlayStateUI();
      },
      onSceneChange: (scene, state) => {
        updateScenarioDebugUI(scene, state);
        if (scene.id.startsWith('pv_cut')) {
          if (scene.id === 'pv_cut9_climax') {
            this.pvTitleOverlay.showKawaiiTitleLogo();
          } else {
            this.pvTitleOverlay.hideKawaiiTitleLogo();
            const pvSubtitles: Record<string, any> = {
              pv_cut1: {
                layout: 'step-cascade',
                theme: 'day',
                lines: [
                  { text: 'もしも、', en: 'IF EVER' },
                  { text: '世界が今日', en: 'THE WORLD ENDS' },
                  { text: '終わるなら。', en: 'RIGHT TODAY' },
                ],
              },
              pv_cut2: {
                layout: 'l-shape',
                side: 'right',
                theme: 'day',
                titleText: '名前を呼ぶことも、できなかった。',
                verticalEn: 'AFTERNOON CLASSROOM',
                subText: 'SCENE 02 ／ FIVE SECONDS CONFESSION',
              },
              pv_cut3: {
                layout: 'l-shape',
                side: 'left',
                theme: 'day',
                titleText: '「友達」のままじゃ、終われない。',
                verticalEn: 'TEASING HEART',
                subText: 'WE CANNOT JUST STAY FRIENDS',
              },
              pv_cut4: {
                layout: 'l-shape',
                side: 'left',
                theme: 'day',
                titleText: '素直になれない、距離がもどかしい。',
                verticalEn: 'SILENT DISTANCE',
                subText: 'THIS DISTANCE HURTS',
              },
              pv_cut5: {
                layout: 'l-shape',
                side: 'right',
                theme: 'sunset',
                titleText: '残された時間は、あと少し――',
                verticalEn: 'SUMMER BREEZE',
                subText: 'OUR TIME IS RUNNING OUT',
              },
              pv_cut6: {
                layout: 'ghost-smash',
                theme: 'day',
                ghostText: 'FALL IN LOVE',
                titleText: 'この夏、君に<span style="color:#f43f5e; -webkit-text-stroke: 1.5px #ffffff;">恋</span>をした。',
                subText: '✦ THIS SUMMER, I FELL IN LOVE WITH YOU ✦',
              },
              pv_cut7: {
                layout: 'l-shape',
                side: 'left',
                theme: 'sunset',
                titleText: '夕暮れが、本音を暴いていく。',
                verticalEn: 'CRIMSON TWILIGHT',
                subText: 'TWILIGHT REVEALS TRUE FEELINGS',
              },
              pv_cut8: {
                layout: 'bottom-glow',
                theme: 'night',
                titleText: '伝えたい想いは、ひとつだけ。',
                subText: 'ONLY ONE FEELING TO CONFESS',
              },
              pv_cut9_intro: {
                layout: 'cinema-push',
                theme: 'sunset',
                titleText: 'たった<span style="color:#f43f5e; -webkit-text-stroke: 1.5px #ffffff; font-weight: 900;">５秒</span>の勇気で、世界は変わる。',
                subText: '✦ A FIVE-SECOND MIRACLE ✦',
              },
            };
            const cfg = pvSubtitles[scene.id];
            if (cfg) {
              this.pvTitleOverlay.updateSubtitle(cfg);
            }
          }
        } else {
          this.pvTitleOverlay.hide();
        }
      },
      onApplySceneCamera: (scene) => {
        this.dialogueCameraController.applyScene(scene);
      },
      onUpdateScrollingBackground: (bgConfig) => {
        if (bgConfig && bgConfig.enabled) {
          const bgUrl = bgConfig.textureUrl || '/textures/town_far.avif';
          this.scrollingBackgroundManager.show({
            textureUrl: bgUrl,
            speed: bgConfig.speed,
            blur: bgConfig.blur,
            direction: bgConfig.direction,
            instantBlur: bgConfig.instantBlur,
            featherWidth: bgConfig.featherWidth,
          });
          // スクロール背景表示時は固定背景画像・中景レイヤーを確実にオフにして背後の透けを排除
          const cfg = this.getConfig();
          cfg.environment.showMidground = false;
          cfg.environment.midgroundImageUrl = undefined;
          cfg.environment.showBackgroundImage = false;
          this.onApplyConfig(cfg);
        } else {
          this.scrollingBackgroundManager.hide();
        }
      },
      onSwitchBackground: (bgUrl: string) => {
        const cfg = this.getConfig();
        cfg.environment.showBackgroundImage = true;
        cfg.environment.backgroundImageUrl = resolveAssetUrl(bgUrl);
        // ロケーションに応じた背景制御: 単体背景切り替え時は中景・近景をオフにする
        cfg.environment.showMidground = false;
        cfg.environment.midgroundImageUrl = undefined;
        cfg.environment.showNearground = false;
        cfg.environment.neargroundImageUrl = undefined;
        this.onApplyConfig(cfg);
      },
      onSwitchPanoramaBackground: (bgUrl: string | null) => {
        if (bgUrl && panoramaController) {
          const cfg = this.getConfig();
          cfg.environment.showMidground = false;
          cfg.environment.midgroundImageUrl = undefined;
          cfg.environment.showFloor = false;
          panoramaController.load({
            imageUrl: resolveAssetUrl(bgUrl),
            initialYaw: 0,
            initialPitch: 0,
            initialFov: cfg.camera.fov || 30,
          });
        } else if (panoramaController && panoramaController.isActive) {
          panoramaController.deactivate();
          const cfg = this.getConfig();
          this.onApplyConfig(cfg);
        }
      },
      onSwitchAvatar: async (modelUrl) => {
        if (this.avatarManager.currentModelUrl === modelUrl && this.avatarManager.avatarInstance) {
          return;
        }
        this.avatarManager.loadAvatarModel(modelUrl);
      },
      onSetupScenarioCharacters: async (characters) => {
        await this.setupScenarioCharacters(characters);
      },
      onRestoreAvatar: async () => {
        await this.restoreSingleAvatar();
      },
      onSwitchScenePreset: (presetId) => {
        this.onSwitchScenePreset(presetId as ScenePresetId);
      },
      onApplyFisheye: (fisheyeConfig) => {
        const cfg = this.getConfig();
        if (!cfg.postProcessing.cinematic) return;
        if (typeof fisheyeConfig === 'boolean') {
          if (!cfg.postProcessing.cinematic.fisheye) {
            cfg.postProcessing.cinematic.fisheye = {
              enabled: fisheyeConfig,
              strength: 0.8,
              zoom: 1.0,
              circular: true,
            };
          } else {
            cfg.postProcessing.cinematic.fisheye.enabled = fisheyeConfig;
          }
        } else if (fisheyeConfig) {
          cfg.postProcessing.cinematic.fisheye = {
            enabled: fisheyeConfig.enabled ?? true,
            strength: fisheyeConfig.strength ?? 0.8,
            zoom: fisheyeConfig.zoom ?? 1.0,
            circular: fisheyeConfig.circular ?? true,
          };
        } else {
          if (cfg.postProcessing.cinematic.fisheye) {
            cfg.postProcessing.cinematic.fisheye.enabled = false;
          }
        }
        this.onApplyConfig(cfg);
      },
      onUpdateDreamBackground: (config) => {
        if (config) {
          const cfg = typeof config === 'object' ? config : undefined;
          this.dreamBackground.play(cfg);
        } else {
          this.dreamBackground.stop();
        }
      },
      onSwitchShaftMode: (active: boolean) => {
        this.shaftModeController?.setShaftMode(active);
      },
      onFinished: () => {
        this.dialogueCameraController.stop();
        this.scrollingBackgroundManager.hide();
        this.dreamBackground.stop(true);
        this.pvTitleOverlay.hide();
        this.shaftModeController?.setShaftMode(false);
        const cfg = this.getConfig();
        if (cfg.postProcessing.cinematic?.fisheye) {
          cfg.postProcessing.cinematic.fisheye.enabled = false;
          this.onApplyConfig(cfg);
        }
        showToast('✨ シナリオが終了しました');
        options.onFinished?.();
      },
    });
  }

  public async playWithInterlude(
    scenario: ScenarioPackage,
    options?: { title?: string; subtitle?: string; holdDurationMs?: number }
  ): Promise<void> {
    if (this.scenarioEngine.isPlaying) {
      this.scenarioEngine.stop();
    }
    if (this.scenarioPlayer.isPlaying) {
      this.scenarioPlayer.stop();
    }
    this.dreamBackground.stop(true);

    const title = options?.title ?? scenario.title;
    const subtitle = options?.subtitle ?? 'SCENE TRANSITION';

    await this.interludeOverlay.playTransition({
      title,
      subtitle,
      holdDurationMs: options?.holdDurationMs ?? 320,
      onCovered: async () => {
        await this.scenarioEngine.play(scenario);
      },
    });
  }

  public update(delta: number): void {
    if (this.scenarioEngine.isPlaying) {
      this.scenarioEngine.update(delta);
    }
    const dialogueBg = this.dialogueCameraController?.isActive
      ? this.dialogueCameraController.getBackgroundTransform()
      : null;
    if (this.scrollingBackgroundManager?.isVisible) {
      this.scrollingBackgroundManager.update(delta, dialogueBg);
    }
    if (this.dreamBackground) {
      this.dreamBackground.update(delta);
    }
  }

  public syncPlayStateUI(): void {
    updateScenarioPlayStateUI(
      this.scenarioPlayer.isPlaying,
      this.scenarioEngine.isPlaying,
      this.avatarManager.isMultiAvatarScenarioActive
    );
  }

  public async setupScenarioCharacters(characters: ScenarioCharacterPlacement[]): Promise<void> {
    if (this.avatarManager.avatarInstance) {
      this.avatarManager.avatarInstance.dispose();
      this.avatarManager.avatarInstance = null;
    }
    this.avatarManager.scenarioAvatars.forEach((av) => av.dispose());
    this.avatarManager.scenarioAvatars.clear();
    this.windController.resetModel();

    this.avatarManager.isMultiAvatarScenarioActive = true;

    if (!this.savedCameraPosBeforeMultiAvatar) {
      this.savedCameraPosBeforeMultiAvatar = this.camera.position.clone();
      this.savedCameraTargetBeforeMultiAvatar = this.controls.target.clone();
    }

    const hasFrontAndBack =
      characters.some((c) => (Array.isArray(c.position) ? c.position[2] > 0.3 : false)) &&
      characters.some((c) => (Array.isArray(c.position) ? c.position[2] < -0.3 : false));

    if (this.panoramaController?.isActive || hasFrontAndBack) {
      this.camera.position.set(0, 1.15, 0);
      this.controls.target.set(0, 1.25, -1.0);
      this.controls.update();
    } else if (characters.length > 1) {
      this.camera.position.set(0, 1.15, 3.45);
      this.controls.target.set(0, 0.95, 0);
      this.controls.update();
    }

    const cfg = this.getConfig();

    const loadPromises = characters.map((placement) => {
      return new Promise<void>((resolve, reject) => {
        const modelUrl =
          this.masterManager.resolveCharacterModelUrl(placement.character) ||
          resolveAssetUrl(placement.character);
        let posX = 0,
          posY = 0,
          posZ = 0;
        let rotY = placement.rotationY ?? 0;

        if (typeof placement.position === 'string' && placement.position in AVATAR_POSITION_PRESETS) {
          const p = AVATAR_POSITION_PRESETS[placement.position as AvatarSlotPosition];
          posX = p[0];
          posY = p[1];
          posZ = p[2];
          if (placement.rotationY === undefined && placement.position in AVATAR_ROTATION_PRESETS) {
            rotY = AVATAR_ROTATION_PRESETS[placement.position as AvatarSlotPosition];
          }
        } else if (Array.isArray(placement.position)) {
          posX = placement.position[0];
          posY = placement.position[1];
          posZ = placement.position[2];
        }

        const avatar = new Avatar(this.scene, this.camera, {
          modelUrl: modelUrl,
          defaultAnimationUrl: resolveAssetUrl('/animations/Idle.fbx'),
          position: [posX, posY, posZ],
          rotationY: rotY,
          config: cfg,
          autoBlink: true,
          lookAtCamera: false,
          enableBreathing: true,
          effectTextManager: this.sharedEffectTextManager,
          renderer: this.avatarManager.renderer ?? undefined,
          onLoaded: (loadedAvatar) => {
            this.avatarManager.scenarioAvatars.set(placement.id, loadedAvatar);
            resolve();
          },
          onError: (err) => {
            console.error(`Failed to load scenario character ${placement.id}:`, err);
            reject(err);
          },
        });
      });
    });

    await Promise.all(loadPromises);
    this.onApplyConfig(cfg);
  }

  public async restoreSingleAvatar(): Promise<void> {
    if (!this.avatarManager.isMultiAvatarScenarioActive) return;
    this.avatarManager.scenarioAvatars.forEach((av) => av.dispose());
    this.avatarManager.scenarioAvatars.clear();
    this.avatarManager.isMultiAvatarScenarioActive = false;

    if (this.savedCameraPosBeforeMultiAvatar && this.savedCameraTargetBeforeMultiAvatar) {
      this.camera.position.copy(this.savedCameraPosBeforeMultiAvatar);
      this.controls.target.copy(this.savedCameraTargetBeforeMultiAvatar);
      this.controls.update();
      this.savedCameraPosBeforeMultiAvatar = null;
      this.savedCameraTargetBeforeMultiAvatar = null;
    }

    this.avatarManager.loadAvatarModel(this.avatarManager.currentModelUrl);
  }
}
