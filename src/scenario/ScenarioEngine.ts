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
import { FocusLinesOverlay } from '../effects/FocusLinesOverlay';
import { AnimeDreamBackgroundConfig } from '../effects/AnimeDreamBackground';
import * as THREE from 'three';

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
  onUpdateDreamBackground?: (
    config?: boolean | 'heart' | AnimeDreamBackgroundConfig,
    scene?: ScenarioScene
  ) => void;
  onSwitchBackground?: (bgUrl: string) => void;
  onSwitchPanoramaBackground?: (bgUrl: string | null) => void;
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
  private onUpdateDreamBackground?: (
    config?: boolean | 'heart' | AnimeDreamBackgroundConfig,
    scene?: ScenarioScene
  ) => void;
  private onSwitchBackground?: (bgUrl: string) => void;
  private onSwitchPanoramaBackground?: (bgUrl: string | null) => void;

  private messageWindow: AdventureMessageWindow;
  private currentPackage: ScenarioPackage | null = null;
  private chapterIndex = 0;
  private sceneIndex = 0;
  private flags: Set<string> = new Set();
  private isPlayingState = false;
  // Active smooth avatar position/rotation interpolations (e.g. walk past, run away)
  private activeMoveTransitions = new Map<
    Avatar,
    {
      startPos: THREE.Vector3;
      targetPos: THREE.Vector3;
      startRotY: number;
      targetRotY?: number;
      duration: number;
      elapsed: number;
    }
  >();

  private bgmAudio: HTMLAudioElement | null = null;
  private seAudio: HTMLAudioElement | null = null;
  private autoNextTimer: number | null = null;
  private pendingChoiceTimer: number | null = null;
  private pendingEffectTextTimers: number[] = [];
  private boundVoiceEndHandler: (() => void) | null = null;
  private isAutoMode = false;
  private focusLinesOverlay: FocusLinesOverlay = new FocusLinesOverlay();

  constructor(options: ScenarioEngineOptions) {
    this.getAvatar = options.getAvatar;
    this.getAvatars = options.getAvatars;
    this.getAudioLipSync = options.getAudioLipSync;
    this.masterManager = options.masterManager ?? new MasterDataManager();
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
    this.onUpdateDreamBackground = options.onUpdateDreamBackground;
    this.onSwitchBackground = options.onSwitchBackground;
    this.onSwitchPanoramaBackground = options.onSwitchPanoramaBackground;

    this.messageWindow = new AdventureMessageWindow({
      typingSpeedMs: 22,
      onNextClick: () => {
        this.handleUserNext();
      },
      onStopClick: () => {
        this.stop();
      },
      onAutoToggle: (enabled) => {
        this.setAutoMode(enabled);
      },
      onTypingComplete: () => {
        this.handleTypingComplete();
      },
    });
  }

  public get autoMode(): boolean {
    return this.isAutoMode;
  }

  public setAutoMode(enabled: boolean): void {
    this.isAutoMode = enabled;
    this.messageWindow.setAutoMode(enabled);

    if (!this.isPlayingState) return;
    const scene = this.currentScene;
    if (!scene) return;

    if (enabled) {
      const voiceKey = scene.voice || scene.voiceUrl;
      const audioLipSync = this.getAudioLipSync();
      const isVoicePlaying = Boolean(voiceKey && audioLipSync.isPlaying);

      if (!isVoicePlaying) {
        if (scene.choices && scene.choices.length > 0) {
          if (!this.messageWindow.isShowingChoices()) {
            this.showChoicesWithAttention(scene.choices, (choice) => {
              this.selectChoice(choice);
            });
          }
        } else {
          this.clearAutoNextTimer();
          const delaySec = scene.autoNextSec ?? 0.8;
          this.autoNextTimer = window.setTimeout(() => {
            this.next();
          }, delaySec * 1000);
        }
      }
    } else {
      if (!scene.autoNextSec) {
        this.clearAutoNextTimer();
      }
    }
  }

  public toggleAutoMode(): boolean {
    const nextState = !this.isAutoMode;
    this.setAutoMode(nextState);
    return nextState;
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

    const allAvatars = this.getAvatars ? this.getAvatars() : [this.getAvatar()].filter(Boolean) as Avatar[];
    allAvatars.forEach((avatar) => {
      avatar.setTearsEnabled(false);
      avatar.resetFaceTexture();
      avatar.clearEffectText();
    });

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

    this.messageWindow.setAutoMode(this.isAutoMode);
    this.messageWindow.show();
    this.executeCurrentScene();
  }

  public stop(): void {
    if (!this.isPlayingState) return;

    this.isPlayingState = false;
    this.clearAutoNextTimer();
    this.clearPendingChoiceTimer();
    this.clearPendingEffectTextTimers();
    this.focusLinesOverlay.hide();
    this.activeMoveTransitions.clear();
    this.stopAudioAndVoice();
    this.stopBgm();
    this.stopSe();

    const allAvatars = this.getAvatars ? this.getAvatars() : [this.getAvatar()].filter(Boolean) as Avatar[];
    allAvatars.forEach((avatar) => {
      avatar.resetFaceTexture();
      avatar.clearEffectText();
      avatar.setTearsEnabled(false);
      avatar.setMotionBlurEnabled(false);
      avatar.setMotionSpeed(1.0);
    });

    this.messageWindow.hide();
    this.onUpdateScrollingBackground?.(undefined);
    this.onUpdateDreamBackground?.(undefined);
    this.onSwitchPanoramaBackground?.(null);
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
        const isWaiting = this.pendingChoiceTimer !== null;
        this.showChoicesWithAttention(
          scene.choices,
          (choice) => {
            this.selectChoice(choice);
          },
          isWaiting // If already waiting during delay, clicking again shows choices immediately
        );
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
    this.clearPendingChoiceTimer();

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
    const {
      motion,
      expression,
      expressionWeight,
      faceTexture,
      effectText,
      position,
      rotationY,
      lookAtCamera,
      headLookAtCamera,
      eyeLookAtCamera,
      eyeWander,
      eyeOffset,
      headOffset,
    } = config;

    const isMultiCharacter = Boolean(this.currentPackage?.characters && this.currentPackage.characters.length > 1);
    const hasExplicitLookAt =
      lookAtCamera !== undefined ||
      headLookAtCamera !== undefined ||
      eyeLookAtCamera !== undefined ||
      config.lookAtTarget !== undefined;

    if (!isMultiCharacter || hasExplicitLookAt) {
      // Eye LookAt camera & offset control
      const effectiveEyeLookAt =
        eyeLookAtCamera !== undefined ? eyeLookAtCamera : (lookAtCamera !== undefined ? lookAtCamera : true);
      avatar.setEyeLookAt({
        mode: effectiveEyeLookAt ? 'camera' : 'forward',
        offset: eyeOffset ? { x: eyeOffset[0], y: eyeOffset[1] } : { x: 0, y: 0 },
        wander: typeof eyeWander === 'boolean' ? eyeWander : (typeof eyeWander === 'number' ? eyeWander > 0 : false),
        wanderIntensity: typeof eyeWander === 'number' ? eyeWander : 1.0,
      });
      avatar.setLookAtCamera(effectiveEyeLookAt);

      // Head / Face LookAt camera control (e.g. natural head turn towards camera during walking)
      const effectiveHeadLookAt = headLookAtCamera !== undefined ? headLookAtCamera : false;
      avatar.setHeadLookAtCamera(effectiveHeadLookAt, {
        offset: headOffset ? { x: headOffset[0], y: headOffset[1] } : { x: 0, y: 0 },
      });
    }

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

    // Smooth position/rotation interpolation (moveTo)
    if (config.moveTo) {
      const startPos = new THREE.Vector3();
      if (avatar.vrm?.scene) {
        avatar.vrm.scene.getWorldPosition(startPos);
      } else {
        startPos.copy(avatar.initialPosition);
      }
      const startRotY = avatar.vrm?.scene ? avatar.vrm.scene.rotation.y : avatar.initialRotationY;
      this.activeMoveTransitions.set(avatar, {
        startPos,
        targetPos: new THREE.Vector3(...config.moveTo.target),
        startRotY,
        targetRotY: config.moveTo.rotationY,
        duration: Math.max(0.01, config.moveTo.duration),
        elapsed: 0,
      });
    }

    // Motion (resolve Master ID or FBX path)
    const effectiveSpeed = config.motionSpeed ?? this.currentScene?.motionSpeed ?? 1.0;
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
        resolveAssetUrl('/animations/Idle.fbx'),
        effectiveSpeed
      );
    } else if (config.motionSpeed !== undefined || this.currentScene?.motionSpeed !== undefined) {
      avatar.setMotionSpeed(effectiveSpeed);
    }

    // Expression
    if (expression) {
      avatar.setExpression(expression, expressionWeight ?? 1.0);
    }

    // Dynamic Face Texture (e.g. Blush / Red cheeks)
    if (faceTexture) {
      avatar.setFaceTexture(faceTexture);
    } else {
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
          });
        } else {
          avatar.showEffectText({
            stylePreset: effectText.preset,
            text: effectText.text,
            duration: effectText.duration,
          });
        }
      }, delayMs);
      this.pendingEffectTextTimers.push(timer);
    }

    // Tears effect
    if (config.tears !== undefined) {
      if (config.tearConfig) {
        avatar.setTearConfig(config.tearConfig);
      }
      avatar.setTearsEnabled(config.tears);
    }

    // Sweat effect
    if (config.sweat !== undefined) {
      if (config.sweat === false) {
        avatar.setSweatEnabled(false);
      } else {
        const mode = typeof config.sweat === 'string' ? config.sweat : 'fly4';
        avatar.showSweat({ mode, duration: 4.0 });
      }
    }

    // Fast Motion Directional Blur override per avatar
    if (config.motionBlur !== undefined) {
      avatar.setMotionBlurEnabled(config.motionBlur);
    }
  }

  private clearPendingChoiceTimer(): void {
    if (this.pendingChoiceTimer !== null) {
      window.clearTimeout(this.pendingChoiceTimer);
      this.pendingChoiceTimer = null;
    }
  }

  /**
   * 選択肢表示時に自キャラの反応を待つ視線へ切り替えつつ選択肢を表示する。
   * choiceDelaySec（デフォルト 1.0s）のディレイを設けることで、
   * アバターが自キャラを向く動作が選択肢UIで隠れずにしっかり視認できるようにする。
   */
  private showChoicesWithAttention(
    choices: ScenarioChoice[],
    onSelect: (choice: ScenarioChoice) => void,
    immediate = false
  ): void {
    this.clearPendingChoiceTimer();
    this.applyWaitingPlayerAttention();

    const scene = this.currentScene;
    const delaySec = immediate ? 0 : (scene?.choiceDelaySec !== undefined ? scene.choiceDelaySec : 1.0);

    if (delaySec <= 0) {
      this.messageWindow.showChoices(choices, onSelect);
      return;
    }

    this.pendingChoiceTimer = window.setTimeout(() => {
      this.pendingChoiceTimer = null;
      if (this.isPlayingState && this.currentScene === scene) {
        this.messageWindow.showChoices(choices, onSelect);
      }
    }, delaySec * 1000);
  }

  /**
   * 会話シチュエーションに応じた注目方向（顔の向き＋目線）の自動制御。
   * - 自キャラに喋りかけている時は自キャラ（カメラ）
   * - 喋ってないキャラは喋っているキャラ
   * - 自キャラの反応を待っている時は自キャラ（カメラ）
   * - 顔の向きは浅い角度（maxYaw 約20度）とし、目線でしっかり対象を捉える。
   */
  private applyConversationAttention(scene: ScenarioScene): void {
    const isMultiCharacter = Boolean(this.currentPackage?.characters && this.currentPackage.characters.length > 1);
    if (!isMultiCharacter) {
      return;
    }

    const characters = this.currentPackage!.characters!;
    const charIds = characters.map((c) => c.id);

    // 1. スピーカー（喋っているキャラ）の特定
    const speakerId = scene.speakerCharacterId || scene.character || scene.avatar?.character;
    const isMultipleSpeakers =
      Boolean(scene.speaker?.includes('&') || scene.speaker?.includes('＆')) ||
      (!speakerId && charIds.length > 1);
    const hasChoices = Boolean(scene.choices && scene.choices.length > 0);

    // 2. 会話相手（dialogueTarget）の決定
    // 未指定時のデフォルトは 'player'（自キャラに喋りかけている）
    const dialogueTarget = scene.dialogueTarget || 'player';

    // 3. 各アバターへの適用
    for (const charId of charIds) {
      const avatar = this.getAvatar(charId);
      if (!avatar) continue;

      const customConfig = scene.avatars?.[charId];

      // 個別に lookAtTarget が明示されている場合はそれを優先
      if (customConfig?.lookAtTarget) {
        this.applyCustomLookAtTarget(avatar, charId, customConfig.lookAtTarget, customConfig);
        continue;
      }
      if (customConfig?.lookAtCamera !== undefined && customConfig.headLookAtCamera !== undefined) {
        // 個別にカメラ追従フラグが明示されている場合はスキップ
        continue;
      }

      const isSpeaker = speakerId === charId;
      const shallowAngle = customConfig?.shallowHeadAngle ?? true;
      const maxYaw = customConfig?.headMaxYaw;
      const weight = customConfig?.headWeight;
      const wander =
        typeof customConfig?.eyeWander === 'boolean'
          ? customConfig.eyeWander
          : (typeof customConfig?.eyeWander === 'number' ? customConfig.eyeWander > 0 : false);
      const wanderIntensity = typeof customConfig?.eyeWander === 'number' ? customConfig.eyeWander : 1.0;

      if (hasChoices || isMultipleSpeakers) {
        // 自キャラの反応を待っている時、または全員で呼びかけている時 -> 全アバターが自キャラ（カメラ）を向く
        avatar.setConversationLookAt({
          target: 'camera',
          shallowAngle,
          maxYaw,
          weight,
          wander,
          wanderIntensity,
        });
      } else if (isSpeaker) {
        // 喋っているキャラ
        if (dialogueTarget === 'player') {
          // 自キャラに喋りかけている -> 自キャラ（カメラ）を向く
          avatar.setConversationLookAt({
            target: 'camera',
            shallowAngle,
            maxYaw,
            weight,
            wander,
            wanderIntensity,
          });
        } else {
          // 相手キャラに喋りかけている (partner または 特定キャラID)
          const targetCharId =
            dialogueTarget === 'partner'
              ? charIds.find((id) => id !== charId)
              : dialogueTarget;
          const targetAvatar = targetCharId ? this.getAvatar(targetCharId) : null;

          if (targetAvatar) {
            avatar.setConversationLookAt({
              target: () => targetAvatar.getHeadWorldPosition(),
              shallowAngle,
              maxYaw,
              weight,
              wander,
              wanderIntensity,
            });
          } else {
            avatar.setConversationLookAt({
              target: 'camera',
              shallowAngle,
              maxYaw,
              weight,
              wander,
              wanderIntensity,
            });
          }
        }
      } else {
        // 喋っていないキャラ -> 喋っているキャラ（スピーカー）の頭部を向く
        const speakerAvatar = speakerId ? this.getAvatar(speakerId) : null;
        if (speakerAvatar) {
          avatar.setConversationLookAt({
            target: () => speakerAvatar.getHeadWorldPosition(),
            shallowAngle,
            maxYaw,
            weight,
            wander,
            wanderIntensity,
          });
        } else {
          avatar.setConversationLookAt({
            target: 'camera',
            shallowAngle,
            maxYaw,
            weight,
            wander,
            wanderIntensity,
          });
        }
      }
    }
  }

  /**
   * 自キャラの反応を待っている時（選択肢が表示された時など）の注目方向制御。
   * 全てのアバターが自キャラ（カメラ）の方を浅い角度＋目線で向く。
   */
  private applyWaitingPlayerAttention(): void {
    const isMultiCharacter = Boolean(this.currentPackage?.characters && this.currentPackage.characters.length > 1);
    if (!isMultiCharacter) return;

    for (const character of this.currentPackage!.characters!) {
      const avatar = this.getAvatar(character.id);
      if (avatar) {
        avatar.setConversationLookAt({
          target: 'camera',
          shallowAngle: true,
        });
      }
    }
  }

  private applyCustomLookAtTarget(
    avatar: Avatar,
    currentCharId: string,
    target: string,
    customConfig?: ScenarioSceneAvatarConfig
  ): void {
    const shallowAngle = customConfig?.shallowHeadAngle ?? true;
    const maxYaw = customConfig?.headMaxYaw;
    const weight = customConfig?.headWeight;
    const wander = typeof customConfig?.eyeWander === 'boolean' ? customConfig.eyeWander : false;
    const wanderIntensity = typeof customConfig?.eyeWander === 'number' ? customConfig.eyeWander : 1.0;

    if (target === 'player' || target === 'camera') {
      avatar.setConversationLookAt({
        target: 'camera',
        shallowAngle,
        maxYaw,
        weight,
        wander,
        wanderIntensity,
      });
    } else if (target === 'forward') {
      avatar.setConversationLookAt({
        target: 'forward',
      });
    } else if (target === 'partner') {
      const charIds = this.currentPackage?.characters?.map((c) => c.id) ?? [];
      const partnerId = charIds.find((id) => id !== currentCharId);
      const partnerAvatar = partnerId ? this.getAvatar(partnerId) : null;
      if (partnerAvatar) {
        avatar.setConversationLookAt({
          target: () => partnerAvatar.getHeadWorldPosition(),
          shallowAngle,
          maxYaw,
          weight,
          wander,
          wanderIntensity,
        });
      }
    } else if (target === 'speaker') {
      const speakerId = this.currentScene?.speakerCharacterId;
      const speakerAvatar = speakerId ? this.getAvatar(speakerId) : null;
      if (speakerAvatar && speakerAvatar !== avatar) {
        avatar.setConversationLookAt({
          target: () => speakerAvatar.getHeadWorldPosition(),
          shallowAngle,
          maxYaw,
          weight,
          wander,
          wanderIntensity,
        });
      }
    } else {
      const targetAvatar = this.getAvatar(target);
      if (targetAvatar) {
        avatar.setConversationLookAt({
          target: () => targetAvatar.getHeadWorldPosition(),
          shallowAngle,
          maxYaw,
          weight,
          wander,
          wanderIntensity,
        });
      }
    }
  }

  private executeCurrentScene(): void {
    const scene = this.currentScene;
    if (!scene) {
      this.stop();
      return;
    }

    this.clearAutoNextTimer();
    this.clearPendingChoiceTimer();
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
    const panoramaUrl = scene.panoramaBackgroundUrl || this.currentPackage?.panoramaBackgroundUrl;
    if (panoramaUrl) {
      this.onSwitchPanoramaBackground?.(panoramaUrl);
    } else if (scene.background && this.onSwitchBackground) {
      this.onSwitchPanoramaBackground?.(null);
      this.onSwitchBackground(scene.background);
    }

    // 1.5 Update Scrolling Background (2-plane loop scrolling & anime blur)
    this.onUpdateScrollingBackground?.(scene.scrollingBackground);

    // 1.6 Anime Dream Background (Heart / Pastel fluffy dreamy effect, e.g. for spiral camera)
    const dreamBgConfig =
      scene.dreamBackground !== undefined
        ? scene.dreamBackground
        : scene.cameraPreset === 'spiralRise'
        ? 'heart'
        : undefined;
    this.onUpdateDreamBackground?.(dreamBgConfig, scene);

    // 1.8 Scene specific SE or Package SE
    const seUrl = scene.seUrl || (scene.scrollingBackground?.enabled ? '/se/walking.mp3' : undefined);
    if (seUrl) {
      this.startSe(seUrl, scene.seVolume ?? 0.65, scene.seLoop ?? true);
    } else if (this.currentPackage?.se || this.currentPackage?.seUrl) {
      const pkgSe = this.currentPackage.se || this.currentPackage.seUrl;
      this.startSe(pkgSe, this.currentPackage.seVolume ?? 0.2, true);
    } else {
      this.stopSe();
    }

    // 1.9 Dynamic Focus Lines Overlay (画面中央に向かう集中線)
    if (scene.focusLines) {
      const config = typeof scene.focusLines === 'object' ? scene.focusLines : undefined;
      this.focusLinesOverlay.show(config);
    } else {
      this.focusLinesOverlay.hide();
    }

    // 1.95 Fast Motion Directional Blur (シーン単位でのブラーON/OFF。デフォルトOFF)
    const allAvatars = this.getAvatars ? this.getAvatars() : [this.getAvatar()].filter(Boolean) as Avatar[];
    for (const av of allAvatars) {
      av.setMotionBlurEnabled(!!scene.motionBlur);
    }

    // 2. Avatar Control (Motion, Expression, Position, 3D Manga Effect)
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

    // 2.5 Conversation Attention (LookAt target & shallow head angle)
    this.applyConversationAttention(scene);

    // 3. Camera Angle, Zoom & Preset (calculated after avatar positions are updated)
    if (this.onApplySceneCamera) {
      this.onApplySceneCamera(scene);
    } else if (this.onApplyCamera && (scene.cameraStartAngle || scene.cameraPreset)) {
      this.onApplyCamera(
        scene.cameraStartAngle,
        scene.cameraPreset,
        scene.cameraStrength ?? 1.0
      );
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
        this.handleVoiceEnded();
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

    // 6. Reset and display choices with attention delay if present
    this.messageWindow.hideChoices();
    if (scene.choices && scene.choices.length > 0) {
      this.showChoicesWithAttention(scene.choices, (choice) => {
        this.selectChoice(choice);
      });
    }

    this.onSceneChange?.(scene, this.getState());
  }

  private handleVoiceEnded(): void {
    if (!this.isPlayingState) return;
    const scene = this.currentScene;
    if (!scene) return;

    // If scene has choices, ensure choice dialog is revealed
    if (scene.choices && scene.choices.length > 0) {
      if (!this.messageWindow.isShowingChoices()) {
        this.showChoicesWithAttention(scene.choices, (choice) => {
          this.selectChoice(choice);
        }, true);
      }
      return;
    }

    // Normal dialogue line
    if (this.isAutoMode || scene.autoNextSec) {
      const delaySec = scene.autoNextSec ?? 0.8;
      this.clearAutoNextTimer();
      this.autoNextTimer = window.setTimeout(() => {
        this.next();
      }, delaySec * 1000);
    }
  }

  private handleTypingComplete(): void {
    if (!this.isPlayingState) return;
    const scene = this.currentScene;
    if (!scene) return;

    const voiceKey = scene.voice || scene.voiceUrl;
    // If voice exists, voice ended handler takes precedence
    if (voiceKey) return;

    // No voice: Calculate reading delay based on text length
    if (this.isAutoMode || scene.autoNextSec) {
      // Base reading speed: 1.2s + 0.055s per char (clamped between 2.0s and 6.0s, or explicit scene.autoNextSec)
      const calculatedSec = Math.max(2.0, Math.min(6.0, 1.2 + scene.text.length * 0.055));
      const delaySec = scene.autoNextSec ?? calculatedSec;

      this.clearAutoNextTimer();
      this.autoNextTimer = window.setTimeout(() => {
        if (scene.choices && scene.choices.length > 0) {
          if (!this.messageWindow.isShowingChoices()) {
            this.showChoicesWithAttention(scene.choices, (choice) => {
              this.selectChoice(choice);
            });
          }
        } else {
          this.next();
        }
      }, delaySec * 1000);
    }
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

  private currentSeUrl: string | null = null;

  private startSe(seUrl?: string, volume: number = 0.2, loop: boolean = true): void {
    if (!seUrl) return;
    const resolvedUrl = resolveAssetUrl(seUrl);
    try {
      if (!this.seAudio) {
        this.seAudio = new Audio(resolvedUrl);
        this.seAudio.loop = loop;
        this.seAudio.volume = volume;
        this.currentSeUrl = resolvedUrl;
        this.seAudio.play().catch(() => {});
      } else {
        this.seAudio.loop = loop;
        this.seAudio.volume = volume;
        if (this.currentSeUrl !== resolvedUrl || this.seAudio.paused) {
          this.seAudio.src = resolvedUrl;
          this.currentSeUrl = resolvedUrl;
          this.seAudio.play().catch(() => {});
        }
      }
    } catch {
      // Audio fallback
    }
  }

  private stopSe(): void {
    if (this.seAudio) {
      this.seAudio.pause();
      this.seAudio.currentTime = 0;
      this.currentSeUrl = null;
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

  /**
   * Update frame-by-frame animations (such as avatar moveTo transitions).
   */
  public update(delta: number): void {
    if (!this.isPlayingState) return;

    for (const [avatar, move] of this.activeMoveTransitions.entries()) {
      move.elapsed += delta;
      const t = Math.min(1.0, move.elapsed / move.duration);
      // Linear progress for walking/running
      const currentX = THREE.MathUtils.lerp(move.startPos.x, move.targetPos.x, t);
      const currentY = THREE.MathUtils.lerp(move.startPos.y, move.targetPos.y, t);
      const currentZ = THREE.MathUtils.lerp(move.startPos.z, move.targetPos.z, t);
      avatar.setPosition(currentX, currentY, currentZ);

      if (move.targetRotY !== undefined) {
        let diff = move.targetRotY - move.startRotY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        avatar.setRotationY(move.startRotY + diff * t);
      }

      if (t >= 1.0) {
        this.activeMoveTransitions.delete(avatar);
      }
    }
  }

  public dispose(): void {
    this.stop();
    this.clearPendingChoiceTimer();
    this.focusLinesOverlay.dispose();
    this.messageWindow.dispose();
  }
}
