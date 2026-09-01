import { Avatar } from '../Avatar';
import { AudioLipSync } from '../AudioLipSync';
import { resolveAssetUrl } from '../utils/path';
import { AdventureMessageWindow } from './AdventureMessageWindow';
import { CameraZoomType, CameraTransitionEasing } from '../scenario/types';
import { CameraPreset, CameraStartAngle } from './types';
import { Language, getLanguage } from '../i18n';

export interface ScenarioStep {
  text: string;
  displayText?: string;
  durationSec?: number;
  voiceUrl: string;
  motionUrl?: string;
  expression?: string;
  expressionWeight?: number;
  pauseAfterSec?: number;
  cameraZoom?: CameraZoomType;
  cameraDistance?: number;
  cameraPreset?: CameraPreset;
  cameraStrength?: number;
  cameraStartAngle?: CameraStartAngle;
  cameraTransitionDuration?: number;
  cameraTransitionEasing?: CameraTransitionEasing;
}

export interface ScenarioPlayerOptions {
  getAvatar: () => Avatar | null;
  getAudioLipSync: () => AudioLipSync;
  onStepChange?: (stepIndex: number, step: ScenarioStep) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onFinished?: () => void;
  onApplyStepCamera?: (step: ScenarioStep) => void;
  bgmUrl?: string;
  bgmVolume?: number;
  seUrl?: string;
  seVolume?: number;
}

export const DEFAULT_CONVERSATION_STEPS_JA: ScenarioStep[] = [
  {
    text: '君とはよく会うな。もしかして私のストーカーなのか？',
    displayText: '「君とはよく会うな。もしかして私のストーカーなのか？」',
    durationSec: 5.92,
    voiceUrl: '/voices/scenario_01.wav',
    motionUrl: '/animations/Dismissing Gesture.fbx',
    expression: 'neutral',
    pauseAfterSec: 0.3,
    cameraZoom: 'speaker',
    cameraPreset: 'pushIn',
    cameraStrength: 0.8,
  },
  {
    text: 'ふふっ、冗談だ',
    displayText: '「ふふっ、冗談だ」',
    durationSec: 2.44,
    voiceUrl: '/voices/scenario_02.wav',
    motionUrl: '/animations/Idle.fbx',
    expression: 'happy',
    expressionWeight: 1.0,
    pauseAfterSec: 0.3,
    cameraZoom: 'speaker_close',
    cameraTransitionEasing: 'gyuin',
    cameraTransitionDuration: 0.5,
    cameraPreset: 'punchIn',
    cameraStrength: 1.0,
  },
  {
    text: 'それで、君はここで何をしてるのかな？',
    displayText: '「それで、君はここで何をしてるのかな？」',
    durationSec: 4.04,
    voiceUrl: '/voices/scenario_03.wav',
    motionUrl: '/animations/Acknowledging.fbx',
    expression: 'neutral',
    expressionWeight: 1.0,
    pauseAfterSec: 0.8,
    cameraZoom: 'medium',
    cameraPreset: 'orbitLeftHalf',
    cameraStrength: 0.6,
  },
];

export const DEFAULT_CONVERSATION_STEPS_EN: ScenarioStep[] = [
  {
    text: 'We run into each other quite often. Are you perhaps stalking me?',
    displayText: '"We run into each other quite often. Are you perhaps stalking me?"',
    durationSec: 5.92,
    voiceUrl: '/voices/scenario_01.wav',
    motionUrl: '/animations/Dismissing Gesture.fbx',
    expression: 'neutral',
    pauseAfterSec: 0.3,
    cameraZoom: 'speaker',
    cameraPreset: 'pushIn',
    cameraStrength: 0.8,
  },
  {
    text: 'Hehe, just kidding.',
    displayText: '"Hehe, just kidding."',
    durationSec: 2.44,
    voiceUrl: '/voices/scenario_02.wav',
    motionUrl: '/animations/Idle.fbx',
    expression: 'happy',
    expressionWeight: 1.0,
    pauseAfterSec: 0.3,
    cameraZoom: 'speaker_close',
    cameraTransitionEasing: 'gyuin',
    cameraTransitionDuration: 0.5,
    cameraPreset: 'punchIn',
    cameraStrength: 1.0,
  },
  {
    text: 'So, what are you doing here anyway?',
    displayText: '"So, what are you doing here anyway?"',
    durationSec: 4.04,
    voiceUrl: '/voices/scenario_03.wav',
    motionUrl: '/animations/Acknowledging.fbx',
    expression: 'neutral',
    expressionWeight: 1.0,
    pauseAfterSec: 0.8,
    cameraZoom: 'medium',
    cameraPreset: 'orbitLeftHalf',
    cameraStrength: 0.6,
  },
];

export function getConversationSteps(lang: Language = getLanguage()): ScenarioStep[] {
  return lang === 'en' ? DEFAULT_CONVERSATION_STEPS_EN : DEFAULT_CONVERSATION_STEPS_JA;
}

export const DEFAULT_CONVERSATION_STEPS: ScenarioStep[] = DEFAULT_CONVERSATION_STEPS_JA;

export class ScenarioPlayer {
  private getAvatar: () => Avatar | null;
  private getAudioLipSync: () => AudioLipSync;
  private onStepChange?: (stepIndex: number, step: ScenarioStep) => void;
  private onPlayStateChange?: (isPlaying: boolean) => void;
  private onFinished?: () => void;
  private onApplyStepCamera?: (step: ScenarioStep) => void;

  private bgmUrl: string;
  private bgmVolume: number;
  private seUrl: string;
  private seVolume: number;

  private bgmAudio: HTMLAudioElement | null = null;
  private seAudio: HTMLAudioElement | null = null;
  private messageWindow: AdventureMessageWindow;

  private _isPlaying = false;
  private currentStepIndex = 0;
  private steps: ScenarioStep[] = [];
  private timeoutId: number | null = null;
  private boundAudioEndedHandler: (() => void) | null = null;

  constructor(options: ScenarioPlayerOptions) {
    this.getAvatar = options.getAvatar;
    this.getAudioLipSync = options.getAudioLipSync;
    this.onStepChange = options.onStepChange;
    this.onPlayStateChange = options.onPlayStateChange;
    this.onFinished = options.onFinished;
    this.onApplyStepCamera = options.onApplyStepCamera;

    this.bgmUrl = options.bgmUrl ?? '/bgm/bgm.mp3';
    this.bgmVolume = options.bgmVolume ?? 0.4;
    this.seUrl = options.seUrl ?? '/se/large_brown_cicada.mp3';
    this.seVolume = options.seVolume ?? 0.2;

    this.messageWindow = new AdventureMessageWindow({
      typingSpeedMs: 35,
      onStopClick: () => {
        this.stop();
      },
      onNextClick: () => {
        // Can be used to skip or stop
      },
    });
  }

  public get isPlaying(): boolean {
    return this._isPlaying;
  }

  public get currentStep(): number {
    return this.currentStepIndex;
  }

  public play(customSteps?: ScenarioStep[]): void {
    if (this._isPlaying) {
      this.stop();
    }

    this.steps = customSteps && customSteps.length > 0 ? customSteps : getConversationSteps();
    this._isPlaying = true;
    this.currentStepIndex = 0;

    // 1. Notify play state (hides settings panel in UI)
    this.onPlayStateChange?.(true);

    // 2. Play Ambient BGM & SE
    this.startBgm();
    this.startSe();

    // 3. Show Adventure Message Window
    this.messageWindow.show();

    // 4. Start first step
    this.executeStep(0);
  }

  public stop(): void {
    if (!this._isPlaying) return;

    this._isPlaying = false;
    this.clearPendingTimeout();

    // 1. Stop Speech Audio & Lip-sync
    const audioLipSync = this.getAudioLipSync();
    if (this.boundAudioEndedHandler) {
      audioLipSync.audioElement.removeEventListener('ended', this.boundAudioEndedHandler);
      this.boundAudioEndedHandler = null;
    }
    audioLipSync.stop();

    // 2. Stop BGM & SE
    this.stopBgm();
    this.stopSe();

    // 3. Hide Message Window
    this.messageWindow.hide();

    // 4. Reset Avatar Motion & Expression
    const avatar = this.getAvatar();
    if (avatar) {
      avatar.setExpression('neutral', 1.0);
      avatar.playAnimation(resolveAssetUrl('/animations/Idle.fbx'), true);
    }

    // 5. Notify play state (restores settings panel in UI)
    this.onPlayStateChange?.(false);
  }

  private startBgm(): void {
    if (!this.bgmAudio) {
      this.bgmAudio = new Audio();
      this.bgmAudio.loop = true;
    }
    this.bgmAudio.src = resolveAssetUrl(this.bgmUrl);
    this.bgmAudio.volume = Math.max(0, Math.min(1, this.bgmVolume));
    this.bgmAudio.currentTime = 0;
    this.bgmAudio.play().catch((e) => console.warn('BGM play failed:', e));
  }

  private stopBgm(): void {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
    }
  }

  private startSe(): void {
    if (!this.seAudio) {
      this.seAudio = new Audio();
      this.seAudio.loop = true;
    }
    this.seAudio.src = resolveAssetUrl(this.seUrl);
    this.seAudio.volume = Math.max(0, Math.min(1, this.seVolume));
    this.seAudio.currentTime = 0;
    this.seAudio.play().catch((e) => console.warn('SE play failed:', e));
  }

  private stopSe(): void {
    if (this.seAudio) {
      this.seAudio.pause();
      this.seAudio.currentTime = 0;
    }
  }

  private clearPendingTimeout(): void {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private executeStep(index: number): void {
    if (!this._isPlaying) return;

    if (index >= this.steps.length) {
      // Sequence naturally completed: wait a short moment to read final sentence then restore
      this.timeoutId = window.setTimeout(() => {
        if (this._isPlaying) {
          this.stop();
          this.onFinished?.();
        }
      }, 1500);
      return;
    }

    this.currentStepIndex = index;
    const step = this.steps[index];
    this.onStepChange?.(index, step);

    const avatar = this.getAvatar();
    const audioLipSync = this.getAudioLipSync();

    // 1. Apply Camera zoom & motion
    this.onApplyStepCamera?.(step);

    // 2. Set Expression
    if (avatar && step.expression) {
      avatar.setExpression(step.expression, step.expressionWeight ?? 1.0);
    }

    // 3. Play Motion
    if (avatar && step.motionUrl) {
      const resolvedMotion = resolveAssetUrl(step.motionUrl);
      const isLoop = resolvedMotion.includes('Idle') || resolvedMotion.includes('Walking') || resolvedMotion.includes('Jogging') || resolvedMotion.includes('Pose');
      avatar.playAnimation(resolvedMotion, isLoop);
    }

    // 4. Update Message Window with fast typing effect (show only current line)
    const textToShow = step.displayText || `「${step.text}」`;
    this.messageWindow.setText(textToShow);

    // 4. Setup Audio Playback and Lip-sync
    const resolvedVoiceUrl = resolveAssetUrl(step.voiceUrl);
    audioLipSync.loadAudioUrl(resolvedVoiceUrl, step.text);

    if (this.boundAudioEndedHandler) {
      audioLipSync.audioElement.removeEventListener('ended', this.boundAudioEndedHandler);
      this.boundAudioEndedHandler = null;
    }

    this.boundAudioEndedHandler = () => {
      if (!this._isPlaying) return;
      if (this.boundAudioEndedHandler) {
        audioLipSync.audioElement.removeEventListener('ended', this.boundAudioEndedHandler);
        this.boundAudioEndedHandler = null;
      }

      const pauseSec = step.pauseAfterSec ?? 0.3;
      this.timeoutId = window.setTimeout(() => {
        if (this._isPlaying) {
          this.executeStep(index + 1);
        }
      }, Math.max(10, pauseSec * 1000));
    };

    audioLipSync.audioElement.addEventListener('ended', this.boundAudioEndedHandler, { once: true });

    // Start Audio
    audioLipSync.play();
  }

  public dispose(): void {
    this.stop();
    this.messageWindow.dispose();
  }
}
