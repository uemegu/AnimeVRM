import { Avatar } from '../Avatar';
import { AudioLipSync } from '../AudioLipSync';
import { AdventureMessageWindow } from '../animation/AdventureMessageWindow';
import {
  ScenarioPackage,
  ScenarioScene,
  ScenarioChoice,
  ScenarioState,
} from './types';
import { ScenePresetId } from '../presets/ScenePresets';
import { CameraPreset, CameraStartAngle } from '../animation/types';
import { resolveAssetUrl } from '../utils/path';

export interface ScenarioEngineOptions {
  getAvatar: () => Avatar | null;
  getAudioLipSync: () => AudioLipSync;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onSceneChange?: (scene: ScenarioScene, state: ScenarioState) => void;
  onFinished?: () => void;
  onSwitchScenePreset?: (presetId: ScenePresetId) => void;
  onApplyCamera?: (
    startAngle?: CameraStartAngle,
    preset?: CameraPreset,
    strength?: number
  ) => void;
}

export class ScenarioEngine {
  private getAvatar: () => Avatar | null;
  private getAudioLipSync: () => AudioLipSync;
  private onPlayStateChange?: (isPlaying: boolean) => void;
  private onSceneChange?: (scene: ScenarioScene, state: ScenarioState) => void;
  private onFinished?: () => void;
  private onSwitchScenePreset?: (presetId: ScenePresetId) => void;
  private onApplyCamera?: (
    startAngle?: CameraStartAngle,
    preset?: CameraPreset,
    strength?: number
  ) => void;

  private messageWindow: AdventureMessageWindow;
  private currentPackage: ScenarioPackage | null = null;
  private chapterIndex = 0;
  private sceneIndex = 0;
  private flags: Set<string> = new Set();
  private isPlayingState = false;

  private bgmAudio: HTMLAudioElement | null = null;
  private seAudio: HTMLAudioElement | null = null;
  private autoNextTimer: number | null = null;
  private boundVoiceEndHandler: (() => void) | null = null;

  constructor(options: ScenarioEngineOptions) {
    this.getAvatar = options.getAvatar;
    this.getAudioLipSync = options.getAudioLipSync;
    this.onPlayStateChange = options.onPlayStateChange;
    this.onSceneChange = options.onSceneChange;
    this.onFinished = options.onFinished;
    this.onSwitchScenePreset = options.onSwitchScenePreset;
    this.onApplyCamera = options.onApplyCamera;

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

  public play(scenarioPackage: ScenarioPackage): void {
    if (this.isPlayingState) {
      this.stop();
    }

    this.currentPackage = scenarioPackage;
    this.chapterIndex = 0;
    this.sceneIndex = 0;
    this.flags.clear();
    this.isPlayingState = true;

    this.onPlayStateChange?.(true);

    // Start BGM & SE if configured
    this.startBgm(scenarioPackage.bgmUrl, scenarioPackage.bgmVolume);
    this.startSe(scenarioPackage.seUrl, scenarioPackage.seVolume);

    this.messageWindow.show();
    this.executeCurrentScene();
  }

  public stop(): void {
    if (!this.isPlayingState) return;

    this.isPlayingState = false;
    this.clearAutoNextTimer();
    this.stopAudioAndVoice();
    this.stopBgm();
    this.stopSe();
    this.getAvatar()?.resetFaceTexture();
    this.getAvatar()?.clearEffectText();

    this.messageWindow.hide();
    this.onPlayStateChange?.(false);
    this.onFinished?.();
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

  private executeCurrentScene(): void {
    const scene = this.currentScene;
    if (!scene) {
      this.stop();
      return;
    }

    this.clearAutoNextTimer();
    this.stopVoice();

    // 1. Switch Scene Preset (Lighting, Environment, PostProcessing)
    if (scene.scenePreset && this.onSwitchScenePreset) {
      this.onSwitchScenePreset(scene.scenePreset);
    }

    // 2. Camera Angle & Preset
    if (this.onApplyCamera && (scene.cameraStartAngle || scene.cameraPreset)) {
      this.onApplyCamera(
        scene.cameraStartAngle,
        scene.cameraPreset,
        scene.cameraStrength ?? 1.0
      );
    }

    // 3. Avatar Control (Motion, Expression, 3D Manga Effect)
    const avatar = this.getAvatar();
    if (avatar && scene.avatar) {
      const { motion, expression, expressionWeight, effectText } = scene.avatar;

      // Motion
      if (motion) {
        const resolvedMotion = resolveAssetUrl(motion);
        const isLoop =
          resolvedMotion.toLowerCase().includes('idle') ||
          resolvedMotion.toLowerCase().includes('walking') ||
          resolvedMotion.toLowerCase().includes('jogging');
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
      if (scene.avatar.faceTexture) {
        avatar.setFaceTexture(scene.avatar.faceTexture);
      } else {
        avatar.resetFaceTexture();
      }

      // 3D Manga Emotion Effect Text
      if (effectText) {
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
      } else {
        avatar.clearEffectText();
      }
    } else if (avatar) {
      avatar.clearEffectText();
    }

    // 4. Voice Lip-Sync
    if (scene.voiceUrl) {
      const audioLipSync = this.getAudioLipSync();
      const voicePath = resolveAssetUrl(scene.voiceUrl);
      audioLipSync.loadAudioUrl(voicePath, scene.text);
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
    if (scene.autoNextSec && !scene.voiceUrl && (!scene.choices || scene.choices.length === 0)) {
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

  public dispose(): void {
    this.stop();
    this.messageWindow.dispose();
  }
}
