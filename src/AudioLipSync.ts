import Meyda from 'meyda';
import { resolveAssetUrl } from './utils/path';

export const PHONEMES = ['aa', 'ee', 'ih', 'oh', 'ou'] as const;
export type Phoneme = (typeof PHONEMES)[number];

export interface AudioLipSyncEvents {
  onPhonemeChange?: (phoneme: Phoneme | 'nn' | undefined) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
}

export class AudioLipSync {
  public audioContext: AudioContext | null = null;
  public audioElement: HTMLAudioElement;
  public currentPhoneme: Phoneme | 'nn' | undefined = undefined;
  public currentRms: number = 0;
  public isPlaying: boolean = false;
  public rmsThreshold: number = 0.01;
  public audioDelay: number = 0.05; // Default delay compensation (50ms)
  public audioTitle: string = '';

  private analyzer: any = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private delayNode: DelayNode | null = null;
  private gainNode: GainNode | null = null;
  private events: AudioLipSyncEvents = {};
  private objectUrlToRevoke: string | null = null;

  constructor(events: AudioLipSyncEvents = {}) {
    this.events = events;
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';

    this.audioElement.addEventListener('timeupdate', () => {
      if (this.events.onTimeUpdate) {
        this.events.onTimeUpdate(this.audioElement.currentTime, this.audioElement.duration || 0);
      }
    });

    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      this.currentPhoneme = 'nn';
      if (this.events.onPhonemeChange) {
        this.events.onPhonemeChange('nn');
      }
      if (this.events.onPlayStateChange) {
        this.events.onPlayStateChange(false);
      }
      if (this.events.onEnded) {
        this.events.onEnded();
      }
    });

    this.audioElement.addEventListener('pause', () => {
      this.isPlaying = false;
      this.currentPhoneme = 'nn';
      if (this.events.onPhonemeChange) {
        this.events.onPhonemeChange('nn');
      }
      if (this.events.onPlayStateChange) {
        this.events.onPlayStateChange(false);
      }
    });

    this.audioElement.addEventListener('play', () => {
      this.isPlaying = true;
      if (this.events.onPlayStateChange) {
        this.events.onPlayStateChange(true);
      }
    });

    this.audioElement.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      this.isPlaying = false;
      if (this.events.onError) {
        this.events.onError(new Error('Audio playback failed'));
      }
    });
  }

  /**
   * Set delay compensation (in seconds) for audio output.
   * Delays speaker playback so visual lip-sync processing and morphing aligns accurately with speech.
   */
  public setAudioDelay(delaySeconds: number): void {
    this.audioDelay = Math.max(0, Math.min(1.0, delaySeconds));
    if (this.delayNode && this.audioContext) {
      this.delayNode.delayTime.setValueAtTime(this.audioDelay, this.audioContext.currentTime);
    }
  }

  /**
   * AudioContext and Meyda Analyzer lazy initialization
   */
  private initAudioContext(): void {
    if (this.audioContext) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();

    this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
    this.delayNode = this.audioContext.createDelay(1.0);
    this.delayNode.delayTime.setValueAtTime(this.audioDelay, this.audioContext.currentTime);
    this.gainNode = this.audioContext.createGain();

    // Playback Route: source -> delay -> gain -> speakers
    this.sourceNode.connect(this.delayNode);
    this.delayNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    // Initialize Meyda Analyzer directly from sourceNode with zero-latency extraction
    this.analyzer = Meyda.createMeydaAnalyzer({
      audioContext: this.audioContext,
      source: this.sourceNode,
      bufferSize: 512,
      featureExtractors: ['mfcc', 'rms'],
      callback: (features: { mfcc?: number[]; rms?: number }) => {
        if (!this.isPlaying) {
          if (this.currentPhoneme !== 'nn') {
            this.currentPhoneme = 'nn';
            this.events.onPhonemeChange?.('nn');
          }
          return;
        }

        const rms = features?.rms ?? 0;
        this.currentRms = rms;

        // If audio level is too quiet (silence/noise floor), close mouth
        if (rms < this.rmsThreshold) {
          if (this.currentPhoneme !== 'nn') {
            this.currentPhoneme = 'nn';
            this.events.onPhonemeChange?.('nn');
          }
          return;
        }

        const mfcc = features?.mfcc;
        if (mfcc && mfcc.length > 1) {
          const phoneme = this.guessPhonemeMfcc(mfcc);
          if (this.currentPhoneme !== phoneme) {
            this.currentPhoneme = phoneme;
            this.events.onPhonemeChange?.(phoneme);
          }
        }
      },
    });

    this.analyzer.start();
  }

  /**
   * MFCC-based phoneme classification logic (based on sayin5min implementation)
   * Uses mfcc[1] (2nd coefficient) to determine vowel
   */
  public guessPhonemeMfcc(mfcc: number[]): Phoneme | 'nn' {
    const c1 = mfcc[1];
    if (Math.abs(c1) < 10) {
      return 'nn';
    }
    if (c1 < -60) {
      return 'aa'; // あ (Low band vowel)
    } else if (c1 < -40) {
      return 'ee'; // え (Mid-low band vowel)
    } else if (c1 < -20) {
      return 'ih'; // い (Mid band vowel)
    } else if (c1 < 20) {
      return 'oh'; // お (Mid-high band vowel)
    } else if (c1 < 40) {
      return 'ou'; // う (High band vowel)
    } else {
      return 'nn'; // 閉口 / 鼻音
    }
  }

  /**
   * Load an audio file (File/Blob)
   */
  public loadAudioFile(file: File): void {
    if (this.objectUrlToRevoke) {
      URL.revokeObjectURL(this.objectUrlToRevoke);
      this.objectUrlToRevoke = null;
    }

    const objectUrl = URL.createObjectURL(file);
    this.objectUrlToRevoke = objectUrl;
    this.audioTitle = file.name;
    this.loadAudioUrl(objectUrl, file.name);
  }

  /**
   * Load audio from URL
   */
  public loadAudioUrl(url: string, title?: string): void {
    this.initAudioContext();
    const resolvedUrl = resolveAssetUrl(url);
    this.audioTitle = title || url.split('/').pop() || 'Audio Track';
    this.audioElement.src = resolvedUrl;
    this.audioElement.load();
    this.currentPhoneme = 'nn';
    if (this.events.onPhonemeChange) {
      this.events.onPhonemeChange('nn');
    }
  }

  /**
   * Play audio
   */
  public async play(): Promise<void> {
    this.initAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    try {
      await this.audioElement.play();
      this.isPlaying = true;
    } catch (err) {
      console.warn('Audio play request failed or interrupted:', err);
    }
  }

  /**
   * Pause audio
   */
  public pause(): void {
    this.audioElement.pause();
    this.isPlaying = false;
    this.currentPhoneme = 'nn';
    this.events.onPhonemeChange?.('nn');
  }

  /**
   * Stop audio and reset to beginning
   */
  public stop(): void {
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.isPlaying = false;
    this.currentPhoneme = 'nn';
    this.events.onPhonemeChange?.('nn');
    this.events.onPlayStateChange?.(false);
  }

  /**
   * Seek to specific position (in seconds)
   */
  public seek(timeSeconds: number): void {
    if (Number.isFinite(timeSeconds)) {
      this.audioElement.currentTime = Math.max(0, Math.min(timeSeconds, this.audioElement.duration || 0));
    }
  }

  /**
   * Set volume [0, 1]
   */
  public setVolume(volume: number): void {
    this.audioElement.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Toggle loop
   */
  public setLoop(loop: boolean): void {
    this.audioElement.loop = loop;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stop();
    this.analyzer?.stop();
    this.analyzer = null;

    if (this.objectUrlToRevoke) {
      URL.revokeObjectURL(this.objectUrlToRevoke);
      this.objectUrlToRevoke = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
