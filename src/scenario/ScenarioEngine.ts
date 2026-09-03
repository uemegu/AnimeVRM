import { Avatar } from '../Avatar';
import { AudioLipSync } from '../AudioLipSync';
import { AdventureMessageWindow } from '../animation/AdventureMessageWindow';
import {
  ScenarioPackage,
  ScenarioScene,
  ScenarioChoice,
  ScenarioState,
  ScenarioCharacterPlacement,
  ScenarioSceneAvatarConfig,
  ScenarioScrollingBackgroundConfig,
  AvatarSlotPosition,
  AVATAR_POSITION_PRESETS,
  AVATAR_ROTATION_PRESETS,
} from './types';
import { ScenePresetId } from '../presets/ScenePresets';
import { CameraPreset, CameraStartAngle } from '../animation/types';
import { resolveAssetUrl } from '../utils/path';
import { MasterDataManager } from '../master/MasterDataManager';

export interface ScenarioEngineOptions {
  getAvatar: (characterId?: string) => Avatar | null;
  getAvatars?: () => Avatar[];
  getAudioLipSync: () => AudioLipSync;
  masterManager?: MasterDataManager;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onSceneChange?: (scene: ScenarioScene, state: ScenarioState) => void;
  onFinished?: () => void;
  onSwitchAvatar?: (modelUrl: string) => Promise<void>;
  onSetupScenarioCharacters?: (characters: ScenarioCharacterPlacement[]) => Promise<void>;
  onRestoreAvatar?: () => Promise<void>;
  onSwitchScenePreset?: (presetId: ScenePresetId) => void;
  onApplyCamera?: (
    startAngle?: CameraStartAngle,
    preset?: CameraPreset,
    strength?: number
  ) => void;
  onApplySceneCamera?: (scene: ScenarioScene) => void;
  onUpdateScrollingBackground?: (config?: ScenarioScrollingBackgroundConfig) => void;
  onSwitchBackground?: (bgUrl: string) => void;
}

export class ScenarioEngine {
  private getAvatar: (characterId?: string) => Avatar | null;
  private getAvatars?: () => Avatar[];
  private getAudioLipSync: () => AudioLipSync;
  private masterManager: MasterDataManager;
  private onPlayStateChange?: (isPlaying: boolean) => void;
  private onSceneChange?: (scene: ScenarioScene, state: ScenarioState) => void;
  private onFinished?: () => void;
  private onSwitchAvatar?: (modelUrl: string) => Promise<void>;
  private onSetupScenarioCharacters?: (characters: ScenarioCharacterPlacement[]) => Promise<void>;
  private onRestoreAvatar?: () => Promise<void>;
  private onSwitchScenePreset?: (presetId: ScenePresetId) => void;
  private onApplyCamera?: (
    startAngle?: CameraStartAngle,
    preset?: CameraPreset,
    strength?: number
  ) => void;
  private onApplySceneCamera?: (scene: ScenarioScene) => void;
  private onUpdateScrollingBackground?: (config?: ScenarioScrollingBackgroundConfig) => void;
  private onSwitchBackground?: (bgUrl: string) => void;

  private messageWindow: AdventureMessageWindow;
  private currentPackage: ScenarioPackage | null = null;
  private chapterIndex = 0;
  private sceneIndex = 0;
  private flags: Set<string> = new Set();
  private isPlayingState = false;

  private bgmAudio: HTMLAudioElement | null = null;
  private seAudio: HTMLAudioElement | null = null;
  private autoNextTimer: number | null = null;
  private pendingEffectTextTimers: number[] = [];
  private boundVoiceEndHandler: (() => void) | null = null;

  constructor(options: ScenarioEngineOptions) {
    this.getAvatar = options.getAvatar;
    this.getAvatars = options.getAvatars;
    this.getAudioLipSync = options.getAudioLipSync;
    this.masterManager = options.masterManager || new MasterDataManager();
    this.onPlayStateChange = options.onPlayStateChange;
    this.onSceneChange = options.onSceneChange;
    this.onFinished = options.onFinished;
    this.onSwitchAvatar = options.onSwitchAvatar;
    this.onSetupScenarioCharacters = options.onSetupScenarioCharacters;
    this.onRestoreAvatar = options.onRestoreAvatar;
    this.onSwitchScenePreset = options.onSwitchScenePreset;
    this.onApplyCamera = options.onApplyCamera;
    this.onApplySceneCamera = options.onApplySceneCamera;
    this.onUpdateScrollingBackground = options.onUpdateScrollingBackground;
    this.onSwitchBackground = options.onSwitchBackground;

    this.messageWindow = new AdventureMessageWindow({
      typingSpeedMs: 22,
      onNextClick: () => {
        this.handleUserNext();
      },
      onStopClick: () => {
        this.stop();
      },
    });
  }

  public get isPlaying(): boolean {
    return this.isPlayingState;
  }

  public get currentScene(): ScenarioScene | null {
    if (!this.currentPackage) return null;
    const chapter = this.currentPackage.chapters[this.chapterIndex];
    if (!chapter) return null;
    return chapter.scenes[this.sceneIndex] ?? null;
  }

  public getState(): ScenarioState {
    return {
      chapterIndex: this.chapterIndex,
      sceneIndex: this.sceneIndex,
      flags: new Set(this.flags),
      isPlaying: this.isPlayingState,
      isTyping: false,
      isWaitingChoice: (this.currentScene?.choices?.length ?? 0) > 0,
    };
  }

  public async play(scenarioPackage: ScenarioPackage): Promise<void> {
    if (this.isPlayingState) {
      this.stop();
    }

    this.currentPackage = scenarioPackage;
    this.chapterIndex = 0;
    this.sceneIndex = 0;
    this.flags.clear();
    this.isPlayingState = true;

    this.onPlayStateChange?.(true);

    // Setup multi-character placements if defined
    if (scenarioPackage.characters && scenarioPackage.characters.length > 0 && this.onSetupScenarioCharacters) {
      try {
        await this.onSetupScenarioCharacters(scenarioPackage.characters);
      } catch (err) {
        console.error('Failed to setup scenario characters:', err);
      }
    }

    // Start BGM & SE if configured (resolve IDs via MasterDataManager)
    const bgmPath = this.masterManager.resolveSoundUrl(scenarioPackage.bgm || scenarioPackage.bgmUrl);
    const sePath = this.masterManager.resolveSoundUrl(scenarioPackage.se || scenarioPackage.seUrl);
    this.startBgm(bgmPath || undefined, scenarioPackage.bgmVolume);
    this.startSe(sePath || undefined, scenarioPackage.seVolume);

    this.messageWindow.show();
    this.executeCurrentScene();
  }

  public stop(): void {
    if (!this.isPlayingState) return;

    this.isPlayingState = false;
    this.clearAutoNextTimer();
    this.clearPendingEffectTextTimers();
    this.stopAudioAndVoice();
    this.stopBgm();
    this.stopSe();

    const allAvatars = this.getAvatars ? this.getAvatars() : [this.getAvatar()].filter(Boolean) as Avatar[];
    allAvatars.forEach((avatar) => {
      avatar.resetFaceTexture();
      avatar.clearEffectText();
    });

    this.messageWindow.hide();
    this.onUpdateScrollingBackground?.(undefined);
    this.onPlayStateChange?.(false);
    this.onFinished?.();

    if (this.onRestoreAvatar) {
      this.onRestoreAvatar().catch((err) => {
        console.error('Failed to restore avatar after scenario:', err);
      });
    }
  }

  private handleUserNext(): void {
    if (!this.isPlayingState) return;
    const scene = this.currentScene;
    if (!scene) return;

    // If scene has choices and not yet displayed, show choices on user click!
    if (scene.choices && scene.choices.length > 0) {
      if (!this.messageWindow.isShowingChoices()) {
        this.messageWindow.showChoices(scene.choices, (choice) => {
          this.selectChoice(choice);
        });
      }
      return;
    }

    this.next();
  }

  public next(): void {
    if (!this.isPlayingState || !this.currentPackage) return;
    this.clearAutoNextTimer();

    const chapter = this.currentPackage.chapters[this.chapterIndex];
    if (!chapter) {
      this.stop();
      return;
    }

    const currentScene = chapter.scenes[this.sceneIndex];
    if (currentScene?.goto) {
      this.jumpToTarget(currentScene.goto);
      return;
    }

    // Advance to next eligible scene
    let nextIdx = this.sceneIndex + 1;
    while (nextIdx < chapter.scenes.length) {
      const candidate = chapter.scenes[nextIdx];
      if (this.evaluateConditions(candidate.conditions)) {
        this.sceneIndex = nextIdx;
        this.executeCurrentScene();
        return;
      }
      nextIdx++;
    }

    // End of chapter -> Next chapter
    let nextChapterIdx = this.chapterIndex + 1;
    while (nextChapterIdx < this.currentPackage.chapters.length) {
      const candidateChapter = this.currentPackage.chapters[nextChapterIdx];
      if (this.evaluateConditions(candidateChapter.conditions)) {
        this.chapterIndex = nextChapterIdx;
        this.sceneIndex = 0;
        this.executeCurrentScene();
        return;
      }
      nextChapterIdx++;
    }

    // End of scenario
    this.stop();
  }

  public selectChoice(choice: ScenarioChoice): void {
    if (!this.isPlayingState) return;

    // 1. Add flag
    if (choice.flag) {
      this.flags.add(choice.flag);
    }

    // 2. Spawn 3D Emotion Effect on Avatar immediately
    if (choice.effectText) {
      const avatar = this.getAvatar();
      if (avatar) {
        avatar.showEffectText({
          stylePreset: choice.effectText,
          text: '',
        });
      }
    }

    // 3. Jump or next
    if (choice.goto) {
      this.jumpToTarget(choice.goto);
    } else {
      this.next();
    }
  }

  private jumpToTarget(targetId: string): void {
    if (!this.currentPackage) return;

    // 1. Check current chapter scenes
    const currentChapter = this.currentPackage.chapters[this.chapterIndex];
    if (currentChapter) {
      const foundIdx = currentChapter.scenes.findIndex((s) => s.id === targetId);
      if (foundIdx !== -1) {
        this.sceneIndex = foundIdx;
        this.executeCurrentScene();
        return;
      }
    }

    // 2. Check across all chapters
    for (let cIdx = 0; cIdx < this.currentPackage.chapters.length; cIdx++) {
      const ch = this.currentPackage.chapters[cIdx];
      if (ch.id === targetId) {
        this.chapterIndex = cIdx;
        this.sceneIndex = 0;
        this.executeCurrentScene();
        return;
      }
      const sIdx = ch.scenes.findIndex((s) => s.id === targetId);
      if (sIdx !== -1) {
        this.chapterIndex = cIdx;
        this.sceneIndex = sIdx;
        this.executeCurrentScene();
        return;
      }
    }

    // If target not found, advance next
    this.next();
  }

  private evaluateConditions(conditions?: string[]): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((cond) => this.flags.has(cond));
  }

  private applyAvatarAction(avatar: Avatar, config: ScenarioSceneAvatarConfig): void {
    const { motion, expression, expressionWeight, faceTexture, effectText, position, rotationY } = config;

    // Slot position / custom transform
    if (position !== undefined) {
      if (typeof position === 'string' && position in AVATAR_POSITION_PRESETS) {
        const [px, py, pz] = AVATAR_POSITION_PRESETS[position as AvatarSlotPosition];
        avatar.setPosition(px, py, pz);
        if (rotationY === undefined && position in AVATAR_ROTATION_PRESETS) {
          avatar.setRotationY(AVATAR_ROTATION_PRESETS[position as AvatarSlotPosition]);
        }
      } else if (Array.isArray(position)) {
        avatar.setPosition(position[0], position[1], position[2]);
      }
    }
    if (rotationY !== undefined) {
      avatar.setRotationY(rotationY);
    }

    // Motion (resolve Master ID or FBX path)
    if (motion) {
      const resolvedMotion = this.masterManager.resolveMotionUrl(motion) || resolveAssetUrl(motion);
      const motionLower = resolvedMotion.toLowerCase();
      const isLoop =
        motionLower.includes('idle') ||
        motionLower.includes('walking') ||
        motionLower.includes('jogging') ||
        motionLower.includes('standing pose');
      avatar.playAnimation(
        resolvedMotion,
        isLoop,
        0.5,
        resolveAssetUrl('/animations/Idle.fbx')
      );
    }

    // Expression
    if (expression) {
      avatar.setExpression(expression, expressionWeight ?? 1.0);
    }

    // Dynamic Face Texture (e.g. Blush / Red cheeks)
    if (faceTexture) {
      avatar.setFaceTexture(faceTexture);
    } else if (faceTexture === null) {
      avatar.resetFaceTexture();
    }

    // 3D Manga Emotion Effect Text (カメラワーク後に発火するようディレイを適用)
    avatar.clearEffectText();
    if (effectText) {
      const delayMs = 900; // カメラがズーム・移動し画面が安定するまで約0.9秒ディレイ
      const timer = window.setTimeout(() => {
        if (!this.isPlayingState) return;
        if (typeof effectText === 'string') {
          avatar.showEffectText({
            stylePreset: effectText,
            text: '',
          });
        } else {
          avatar.showEffectText({
            stylePreset: effectText.preset,
            text: effectText.text ?? '',
            duration: effectText.duration,
          });
        }
      }, delayMs);
      this.pendingEffectTextTimers.push(timer);
    }
  }

  private executeCurrentScene(): void {
    const scene = this.currentScene;
    if (!scene) {
      this.stop();
      return;
    }

    this.clearAutoNextTimer();
    this.clearPendingEffectTextTimers();
    this.stopVoice();

    // 0. Single Character Model Switch (if specified & not in multi-character package)
    const isMultiCharacter = Boolean(this.currentPackage?.characters && this.currentPackage.characters.length > 0);
    const charId = scene.character || scene.avatar?.character;
    if (!isMultiCharacter && charId && this.onSwitchAvatar) {
      const modelUrl = this.masterManager.resolveCharacterModelUrl(charId);
      if (modelUrl) {
        this.onSwitchAvatar(modelUrl).catch((err) => {
          console.error('Failed to switch avatar during scenario:', err);
        });
      }
    }

    // 1. Switch Scene Preset (Lighting, Environment, PostProcessing)
    if (scene.scenePreset && this.onSwitchScenePreset) {
      this.onSwitchScenePreset(scene.scenePreset);
    }

    // 1.2 Switch Direct Background Image (Standard single background)
    if (scene.background && this.onSwitchBackground) {
      this.onSwitchBackground(scene.background);
    }

    // 1.5 Update Scrolling Background (2-plane loop scrolling & anime blur)
    this.onUpdateScrollingBackground?.(scene.scrollingBackground);

    // 2. Camera Angle, Zoom & Preset
    if (this.onApplySceneCamera) {
      this.onApplySceneCamera(scene);
    } else if (this.onApplyCamera && (scene.cameraStartAngle || scene.cameraPreset)) {
      this.onApplyCamera(
        scene.cameraStartAngle,
        scene.cameraPreset,
        scene.cameraStrength ?? 1.0
      );
    }

    // 3. Avatar Control (Motion, Expression, 3D Manga Effect)
    if (scene.avatars) {
      for (const [charKey, config] of Object.entries(scene.avatars)) {
        const avatar = this.getAvatar(charKey);
        if (avatar) {
          this.applyAvatarAction(avatar, config);
        }
      }
    } else if (scene.avatar) {
      const charKey = scene.avatar.character || scene.character || scene.speakerCharacterId;
      const avatar = this.getAvatar(charKey);
      if (avatar) {
        this.applyAvatarAction(avatar, scene.avatar);
      }
    }

    // 3.5 Screen Transition (Eyelid close / blink)
    if (scene.screenTransition === 'eyelid_close') {
      this.messageWindow.setEyelidClosed(true);
    } else {
      this.messageWindow.setEyelidClosed(false);
    }

    // 4. Voice Lip-Sync (resolve Voice Master ID or WAV path & Stereo Pan)
    const voiceKey = scene.voice || scene.voiceUrl;
    if (voiceKey) {
      const audioLipSync = this.getAudioLipSync();
      const voicePath = this.masterManager.resolveSoundUrl(voiceKey) || resolveAssetUrl(voiceKey);
      audioLipSync.loadAudioUrl(voicePath, scene.text, scene.voicePan ?? 0);
      audioLipSync.play().catch(() => {});

      if (this.boundVoiceEndHandler) {
        audioLipSync.audioElement.removeEventListener('ended', this.boundVoiceEndHandler);
      }
      this.boundVoiceEndHandler = () => {
        if (scene.autoNextSec && (!scene.choices || scene.choices.length === 0)) {
          this.autoNextTimer = window.setTimeout(() => {
            this.next();
          }, scene.autoNextSec * 1000);
        }
      };
      audioLipSync.audioElement.addEventListener('ended', this.boundVoiceEndHandler, {
        once: true,
      });
    }

    // 5. Update Location Badge & Message Text
    if (scene.location) {
      this.messageWindow.setLocation(scene.location);
    }
    this.messageWindow.setText(scene.text, scene.speaker ?? '');

    // 6. Reset choices (shown after user reads text and clicks)
    this.messageWindow.hideChoices();
    if (scene.autoNextSec && !voiceKey && (!scene.choices || scene.choices.length === 0)) {
      this.autoNextTimer = window.setTimeout(() => {
        this.next();
      }, scene.autoNextSec * 1000);
    }

    this.onSceneChange?.(scene, this.getState());
  }

  private startBgm(bgmUrl?: string, volume: number = 0.4): void {
    if (!bgmUrl) return;
    try {
      if (!this.bgmAudio) {
        this.bgmAudio = new Audio(resolveAssetUrl(bgmUrl));
        this.bgmAudio.loop = true;
      } else {
        this.bgmAudio.src = resolveAssetUrl(bgmUrl);
      }
      this.bgmAudio.volume = volume;
      this.bgmAudio.play().catch(() => {
        // User interaction might be required
      });
    } catch {
      // Audio playback fallback
    }
  }

  private stopBgm(): void {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
    }
  }

  private startSe(seUrl?: string, volume: number = 0.2): void {
    if (!seUrl) return;
    try {
      if (!this.seAudio) {
        this.seAudio = new Audio(resolveAssetUrl(seUrl));
        this.seAudio.loop = true;
      } else {
        this.seAudio.src = resolveAssetUrl(seUrl);
      }
      this.seAudio.volume = volume;
      this.seAudio.play().catch(() => {});
    } catch {
      // Audio fallback
    }
  }

  private stopSe(): void {
    if (this.seAudio) {
      this.seAudio.pause();
      this.seAudio.currentTime = 0;
    }
  }

  private stopVoice(): void {
    const audioLipSync = this.getAudioLipSync();
    if (this.boundVoiceEndHandler) {
      audioLipSync.audioElement.removeEventListener('ended', this.boundVoiceEndHandler);
      this.boundVoiceEndHandler = null;
    }
    audioLipSync.stop();
  }

  private stopAudioAndVoice(): void {
    this.stopVoice();
  }

  private clearAutoNextTimer(): void {
    if (this.autoNextTimer !== null) {
      clearTimeout(this.autoNextTimer);
      this.autoNextTimer = null;
    }
  }

  private clearPendingEffectTextTimers(): void {
    for (const timer of this.pendingEffectTextTimers) {
      clearTimeout(timer);
    }
    this.pendingEffectTextTimers = [];
  }

  public dispose(): void {
    this.stop();
    this.messageWindow.dispose();
  }
}
