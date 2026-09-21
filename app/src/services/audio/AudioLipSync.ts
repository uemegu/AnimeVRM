import { resolveAssetUrl } from '../../utils/path';

export const PHONEMES = ['aa', 'ee', 'ih', 'oh', 'ou'] as const;
export type Phoneme = (typeof PHONEMES)[number];

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

export type LipSyncEngine = 'wasm' | 'legacy';

export class AudioLipSync {
  public audioContext: AudioContext | null = null;
  public audioElement: HTMLAudioElement;
  public currentPhoneme: Phoneme | 'nn' | undefined = undefined;
  public currentRms: number = 0;
  public isPlaying: boolean = false;
  public rmsThreshold: number = 0.008; // Attack threshold for voicing detection
  public rmsReleaseThreshold: number = 0.003; // Release threshold to prevent dropouts
  public holdFrames: number = 12; // ~200ms at 60fps hangover time
  public audioDelay: number = 0.05; // Default delay compensation (50ms)
  public voiceGender: 'female' | 'male' = 'female';
  public audioTitle: string = '';
  public engineMode: LipSyncEngine = 'wasm';
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

  private analyzerNode: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private delayNode: DelayNode | null = null;
  private gainNode: GainNode | null = null;
  private events: AudioLipSyncEvents = {};
  private objectUrlToRevoke: string | null = null;

  // AudioWorklet + WASM properties
  private workletNode: AudioWorkletNode | null = null;
  public isWorkletReady: boolean = false;
  private wasmBytesCache: ArrayBuffer | null = null;

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
    this.workletNode?.port.postMessage({ type: 'set-gender', data: { gender } });
  }

  /**
   * ミュート状態の設定（音声出力のみ消音し、リップシンク解析は維持）
   */
  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(muted ? 0 : 1, this.audioContext.currentTime);
    }
  }

  /**
   * Lazy initialization of Web Audio API graph and AudioWorklet
   */
  public initAudioContext(): void {
    if (this.audioContext) return;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioContextClass();

    this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
    this.analyzerNode = this.audioContext.createAnalyser();
    this.analyzerNode.fftSize = 1024;
    this.analyzerNode.smoothingTimeConstant = 0;

    this.delayNode = this.audioContext.createDelay(1.0);
    this.delayNode.delayTime.setValueAtTime(this.audioDelay, this.audioContext.currentTime);

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : 1, this.audioContext.currentTime);

    // Playback Route: source -> delay -> gain -> destination
    this.sourceNode.connect(this.delayNode);
    this.delayNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    // Analysis Route
    this.sourceNode.connect(this.analyzerNode);

    if (this.engineMode === 'wasm') {
      void this.initAudioWorklet();
    }
  }

  private async initAudioWorklet(): Promise<void> {
    if (!this.audioContext || this.workletNode) return;

    try {
      await this.audioContext.audioWorklet.addModule(resolveAssetUrl('/worklets/lipsync-processor.js'));

      if (!this.wasmBytesCache) {
        const resp = await fetch(resolveAssetUrl('/wasm/lipsync.wasm'));
        this.wasmBytesCache = await resp.arrayBuffer();
      }

      this.workletNode = new AudioWorkletNode(this.audioContext, 'lipsync-processor');

      this.workletNode.port.onmessage = (event) => {
        const { type, data, error } = event.data;
        if (type === 'wasm-ready') {
          this.isWorkletReady = true;
          this.workletNode?.port.postMessage({ type: 'set-gender', data: { gender: this.voiceGender } });
          this.workletNode?.port.postMessage({ type: 'set-rms-threshold', data: { threshold: this.rmsThreshold } });
          this.workletNode?.port.postMessage({ type: 'set-hold-frames', data: { frames: this.holdFrames } });
        } else if (type === 'wasm-error') {
          console.error('LipSync WASM error in AudioWorklet:', error);
        } else if (type === 'analysis-result') {
          const { phoneme, rms, f1, f2, distances, processingTimeMs } = data;
          this.currentRms = rms;

          if (this.currentPhoneme !== phoneme) {
            this.currentPhoneme = phoneme;
            this.events.onPhonemeChange?.(phoneme);
          }

          this.updateStats(processingTimeMs, rms, phoneme, f1, f2, distances);
        }
      };

      this.workletNode.port.postMessage({
        type: 'init-wasm',
        data: {
          wasmBytes: this.wasmBytesCache,
          sampleRate: this.audioContext.sampleRate,
        },
      });

      if (this.sourceNode) {
        this.sourceNode.connect(this.workletNode);
      }
    } catch (err) {
      console.warn('Failed to initialize AudioWorklet lipsync:', err);
    }
  }

  public getStats(): LipSyncStats {
    return { ...this.lastStats, distances: { ...this.lastStats.distances } };
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
    if (typeof this.audioElement.pause === 'function') {
      this.audioElement.pause();
    }
    this.isPlaying = false;
    this.currentPhoneme = 'nn';
    this.events.onPhonemeChange?.('nn');
  }

  /**
   * Stop audio and reset to beginning
   */
  public stop(): void {
    if (typeof this.audioElement.pause === 'function') {
      this.audioElement.pause();
    }
    if ('currentTime' in this.audioElement) {
      this.audioElement.currentTime = 0;
    }
    this.isPlaying = false;
    this.currentPhoneme = 'nn';
    this.events.onPhonemeChange?.('nn');
    this.events.onPlayStateChange?.(false);
  }

  /**
   * Set volume [0, 1]
   */
  public setVolume(volume: number): void {
    if (this.audioElement) {
      this.audioElement.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stop();
    this.analyzerNode?.disconnect();
    this.analyzerNode = null;
    this.workletNode?.disconnect();
    this.workletNode = null;
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
