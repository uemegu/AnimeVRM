import { resolveAssetUrl } from '../utils/path';
import { VoiceAnalyser, VOICE_PHONEMES, VOICE_SILENCE_RMS, type VoiceFrame, type VoicePhoneme } from './VoiceAnalyser';

export const PHONEMES = VOICE_PHONEMES;
export type Phoneme = VoicePhoneme;

export interface LipSyncStats {
  processingTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  avgTimeMs: number;
  count: number;
  rms: number;
  f1: number;
  f2: number;
  distances: Record<Phoneme, number>;
  phoneme: Phoneme | 'nn';
}

export interface AudioLipSyncEvents {
  onPhonemeChange?: (phoneme: Phoneme | 'nn' | undefined) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  onStatsUpdate?: (stats: LipSyncStats) => void;
}

export class AudioLipSync {
  public audioContext: AudioContext | null = null;
  public audioElement: HTMLAudioElement;
  public currentPhoneme: Phoneme | 'nn' | undefined = undefined;
  public currentRms: number = 0;
  public isPlaying: boolean = false;
  public rmsThreshold: number = VOICE_SILENCE_RMS;
  public rmsReleaseThreshold: number = VOICE_SILENCE_RMS;
  public holdFrames: number = 12; // ~200ms at 60fps hangover time
  public audioDelay: number = 0.05; // Default delay compensation (50ms)
  public voiceGender: 'female' | 'male' = 'female';
  public audioTitle: string = '';
  public isMuted: boolean = false;

  private minTimeMs: number = Infinity;
  private maxTimeMs: number = 0;
  private totalTimeMs: number = 0;
  private sampleCount: number = 0;
  private lastStats: LipSyncStats = {
    processingTimeMs: 0,
    minTimeMs: 0,
    maxTimeMs: 0,
    avgTimeMs: 0,
    count: 0,
    rms: 0,
    f1: 0,
    f2: 0,
    distances: { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 },
    phoneme: 'nn',
  };

  private voiceAnalyser: VoiceAnalyser | null = null;
  private volume: number = 1;
  private playbackGeneration: number = 0;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private delayNode: DelayNode | null = null;
  private gainNode: GainNode | null = null;
  private events: AudioLipSyncEvents = {};
  private objectUrlToRevoke: string | null = null;

  // AudioWorklet + WASM properties
  public isWorkletReady: boolean = false;

  constructor(events: AudioLipSyncEvents = {}) {
    this.events = events;
    if (typeof Audio !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.crossOrigin = 'anonymous';

      this.audioElement.addEventListener('timeupdate', () => {
        if (this.events.onTimeUpdate) {
          this.events.onTimeUpdate(this.audioElement.currentTime, this.audioElement.duration || 0);
        }
      });

      this.audioElement.addEventListener('ended', () => {
        this.playbackGeneration++;
        this.isPlaying = false;
        this.resetAnalysis();
        if (this.events.onPlayStateChange) {
          this.events.onPlayStateChange(false);
        }
        if (this.events.onEnded) {
          this.events.onEnded();
        }
      });

      this.audioElement.addEventListener('pause', () => {
        this.playbackGeneration++;
        this.isPlaying = false;
        this.resetAnalysis();
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
        this.playbackGeneration++;
        this.isPlaying = false;
        this.resetAnalysis();
        this.events.onPlayStateChange?.(false);
        if (this.events.onError) {
          this.events.onError(new Error('Audio playback failed'));
        }
      });
    } else {
      this.audioElement = {} as HTMLAudioElement;
    }
  }

  public setEvents(events: Partial<AudioLipSyncEvents>): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Set voice gender profile ('female' or 'male')
   */
  public setVoiceGender(gender: 'female' | 'male'): void {
    this.voiceGender = gender;
    this.voiceAnalyser?.setGender(gender);
  }

  /**
   * ミュート状態の設定（音声出力のみ消音し、リップシンク解析は維持）
   */
  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.applyOutputVolume();
  }

  /**
   * Lazy initialization of Web Audio API graph and AudioWorklet
   */
  public initAudioContext(): void {
    if (this.audioContext) return;

    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    this.audioContext = new AudioContextClass();

    // 音声要素の音量も解析信号を変えるため、出力側の GainNode だけで調整する
    this.audioElement.volume = 1;
    this.audioElement.muted = false;
    this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);

    this.delayNode = this.audioContext.createDelay(1.0);
    this.delayNode.delayTime.setValueAtTime(this.audioDelay, this.audioContext.currentTime);

    this.gainNode = this.audioContext.createGain();
    this.applyOutputVolume();

    // Playback Route: source -> delay -> gain -> destination
    this.sourceNode.connect(this.delayNode);
    this.delayNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    this.voiceAnalyser = new VoiceAnalyser(this.audioContext, this.sourceNode, {
      gender: this.voiceGender,
      rmsThreshold: this.rmsThreshold,
      holdFrames: this.holdFrames,
      onReady: (ready) => { this.isWorkletReady = ready; },
      onAnalysis: ({ phoneme, rms, f1, f2, distances, processingTimeMs }) => {
        if (!this.isPlaying || this.audioElement.paused || this.audioElement.ended) return;
        this.currentRms = rms;
        this.setPhoneme(phoneme);
        this.updateStats(processingTimeMs, rms, phoneme, f1, f2, distances);
      },
    });
  }

  public getStats(): LipSyncStats {
    return { ...this.lastStats, distances: { ...this.lastStats.distances } };
  }

  /** WASM が音声の特徴から推定した口の開き。解析が未準備なら閉じる */
  public getMouthOpen(): number {
    if (!this.isPlaying || this.audioElement.paused || this.audioElement.ended) return 0;
    return this.readVoiceFrame().mouthOpen;
  }

  public getPhoneme(): Phoneme | 'nn' | undefined {
    if (!this.isPlaying || this.audioElement.paused || this.audioElement.ended) return undefined;
    return this.readVoiceFrame().phoneme;
  }

  private readVoiceFrame(): VoiceFrame {
    const frame = this.voiceAnalyser?.getFrame() ?? { phoneme: 'nn', rms: 0, mouthOpen: 0 };
    this.currentRms = frame.rms;
    this.setPhoneme(frame.phoneme);
    return frame;
  }

  private setPhoneme(phoneme: Phoneme | 'nn'): void {
    if (this.currentPhoneme === phoneme) return;
    this.currentPhoneme = phoneme;
    this.events.onPhonemeChange?.(phoneme);
  }

  private resetAnalysis(): void {
    this.voiceAnalyser?.reset();
    this.currentRms = 0;
    this.setPhoneme('nn');
  }

  private applyOutputVolume(): void {
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.audioContext.currentTime);
    } else {
      this.audioElement.volume = this.volume;
      this.audioElement.muted = this.isMuted;
    }
  }

  private updateStats(
    processingTimeMs: number,
    rms: number,
    phoneme: Phoneme | 'nn',
    f1: number,
    f2: number,
    distances: Record<Phoneme, number>
  ): void {
    this.sampleCount++;
    this.totalTimeMs += processingTimeMs;
    if (processingTimeMs < this.minTimeMs) this.minTimeMs = processingTimeMs;
    if (processingTimeMs > this.maxTimeMs) this.maxTimeMs = processingTimeMs;
    const avgTimeMs = this.totalTimeMs / this.sampleCount;

    this.lastStats = {
      processingTimeMs,
      minTimeMs: this.minTimeMs === Infinity ? 0 : this.minTimeMs,
      maxTimeMs: this.maxTimeMs,
      avgTimeMs,
      count: this.sampleCount,
      rms,
      f1,
      f2,
      distances,
      phoneme,
    };

    if (this.events.onStatsUpdate) {
      this.events.onStatsUpdate(this.lastStats);
    }
  }

  /**
   * Load audio from URL
   */
  public loadAudioUrl(url: string, title?: string): void {
    this.pause();
    this.initAudioContext();
    const resolvedUrl = resolveAssetUrl(url);
    this.audioTitle = title || url.split('/').pop() || 'Audio Track';
    this.audioElement.src = resolvedUrl;
    this.audioElement.load();
  }

  /**
   * Play audio
   */
  public async play(): Promise<void> {
    this.initAudioContext();
    const generation = ++this.playbackGeneration;
    try {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      if (generation !== this.playbackGeneration) return;
      await this.audioElement.play();
      if (generation === this.playbackGeneration) this.isPlaying = true;
    } catch (err) {
      console.warn('Audio play request failed or interrupted:', err);
      if (generation !== this.playbackGeneration) return;
      this.isPlaying = false;
      this.resetAnalysis();
      this.events.onPlayStateChange?.(false);
      this.events.onError?.(err instanceof Error ? err : new Error('Audio playback failed'));
    }
  }

  /**
   * Pause audio
   */
  public pause(): void {
    this.playbackGeneration++;
    if (typeof this.audioElement.pause === 'function') {
      this.audioElement.pause();
    }
    this.isPlaying = false;
    this.resetAnalysis();
  }

  /**
   * Stop audio and reset to beginning
   */
  public stop(): void {
    this.playbackGeneration++;
    if (typeof this.audioElement.pause === 'function') {
      this.audioElement.pause();
    }
    if ('currentTime' in this.audioElement) {
      this.audioElement.currentTime = 0;
    }
    this.isPlaying = false;
    this.resetAnalysis();
    this.events.onPlayStateChange?.(false);
  }

  /**
   * Set volume [0, 1]
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyOutputVolume();
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stop();
    this.voiceAnalyser?.dispose();
    this.voiceAnalyser = null;
    this.sourceNode?.disconnect();
    this.sourceNode = null;
    this.delayNode?.disconnect();
    this.delayNode = null;
    this.gainNode?.disconnect();
    this.gainNode = null;
    this.isWorkletReady = false;

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
