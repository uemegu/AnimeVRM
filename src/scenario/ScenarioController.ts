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
import {
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

export class ScenarioController {
  public dialogueCameraController: DialogueCameraController;
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
    getConfig: () => AvatarConfig;
    onApplyConfig: (cfg: AvatarConfig) => void;
    onSwitchScenePreset: (presetId: ScenePresetId) => void;
  }) {
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

    this.dialogueCameraController = new DialogueCameraController({
      camera: this.camera,
      controls: this.controls,
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
        }
        this.syncPlayStateUI();
      },
      onFinished: () => {
        this.dialogueCameraController.stop();
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
        }
        this.syncPlayStateUI();
      },
      onSceneChange: (scene, state) => {
        updateScenarioDebugUI(scene, state);
      },
      onApplySceneCamera: (scene) => {
        this.dialogueCameraController.applyScene(scene);
      },
      onSwitchAvatar: async (modelUrl) => {
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
      onFinished: () => {
        this.dialogueCameraController.stop();
        showToast('✨ シナリオが終了しました');
      },
    });
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

    if (characters.length > 1) {
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
