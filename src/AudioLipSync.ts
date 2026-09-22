import Meyda from 'meyda';
import { resolveAssetUrl } from './utils/path';

export const PHONEMES = ['aa', 'ee', 'ih', 'oh', 'ou'] as const;
export type Phoneme = (typeof PHONEMES)[number];

interface FormantTargets {
  f1: number;
  f2: number;
  weightF1: number;
  weightF2: number;
}

// Empirically measured and verified MFCC vowel targets (MFCC[1..12], ignoring MFCC[0] energy)
const MFCC_TARGETS: Record<'female' | 'male', Record<Phoneme, number[]>> = {
  female: {
    aa: [40.1, -17.3, -26.1, -25.5, -25.8, -0.4, 31.0, 14.0, -19.7, -16.3, 1.9, -0.8],
    ih: [29.0, -9.1, 33.6, 30.0, -19.4, -25.7, -13.7, -21.1, -20.7, -22.1, -25.5, -8.8],
    ou: [53.9, 28.5, 12.6, -13.5, -10.0, -5.5, -16.7, -26.4, -29.3, -22.5, -9.9, 6.4],
    ee: [31.4, -30.1, -8.7, -1.4, -19.5, -31.1, -6.6, -4.2, -7.6, -1.7, 1.7, -0.9],
    oh: [42.2, -2.0, -20.1, -29.6, -31.4, -11.9, 12.9, 5.5, -13.1, -10.1, 2.9, 5.5],
  },
  male: {
    aa: [81.9, 28.8, 1.1, -5.1, -14.3, -18.9, -0.2, 25.2, 25.2, 4.9, -5.5, 0.7],
    ih: [46.6, 1.3, 4.5, 40.4, 47.0, 11.1, -18.3, -10.1, 8.5, 7.1, -7.1, -13.6],
    ou: [56.4, 32.2, 20.4, 23.6, 27.6, 21.1, 7.3, -5.1, -12.4, -13.6, -8.9, -3.4],
    ee: [55.8, 11.6, 14.8, 32.4, 39.6, 16.4, -14.8, -13.8, -8.0, -7.8, 3.6, 4.4],
    oh: [68.5, 36.1, 19.7, 3.8, -17.3, -30.5, -27.2, -8.5, 5.5, 0.5, -4.5, 2.5],
  },
};

// Acoustic vowel formant search ranges per phoneme for guided resonance tracking
const FORMANT_SEARCH_RANGES: Record<'female' | 'male', Record<Phoneme, { f1: [number, number]; f2: [number, number] }>> = {
  female: {
    aa: { f1: [750, 1200], f2: [1300, 1750] },
    ih: { f1: [260, 450],  f2: [2500, 3600] },
    ou: { f1: [280, 500],  f2: [900, 1600] },
    ee: { f1: [400, 680],  f2: [2000, 2900] },
    oh: { f1: [450, 750],  f2: [900, 1500] },
  },
  male: {
    aa: { f1: [600, 950],  f2: [1050, 1550] },
    ih: { f1: [200, 380],  f2: [2000, 3000] },
    ou: { f1: [220, 420],  f2: [750, 1300] },
    ee: { f1: [350, 580],  f2: [1700, 2500] },
    oh: { f1: [380, 620],  f2: [750, 1250] },
  },
};

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
  public isMicrophoneActive: boolean = false;
  public rmsThreshold: number = 0.008; // Attack threshold for voicing detection
  public rmsReleaseThreshold: number = 0.003; // Release threshold to prevent dropouts
  public holdFrames: number = 12; // ~200ms at 60fps hangover time
  public micGainValue: number = 2.5; // Microphone boost gain
  public audioDelay: number = 0.05; // Default delay compensation (50ms)
  public voiceGender: 'female' | 'male' = 'female';
  public audioTitle: string = '';
  public engineMode: LipSyncEngine = 'wasm'; // Default to modern AudioWorklet + WASM

  private minTimeMs: number = Infinity;
  private maxTimeMs: number = 0;
  private totalTimeMs: number = 0;
  private sampleCount: number = 0;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private micGainNode: GainNode | null = null;
  private smoothedRms: number = 0;
  private silenceHoldCounter: number = 0;
  private isVoicing: boolean = false;
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
  private analysisBuffer: Float32Array<ArrayBuffer> | null = null;
  private analysisFrameId: number | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private delayNode: DelayNode | null = null;
  private gainNode: GainNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private currentPan: number = 0; // -1.0 (Left) to 1.0 (Right)
  private events: AudioLipSyncEvents = {};
  private objectUrlToRevoke: string | null = null;
  private pcmNextStartTime: number = 0;
  private pcmActiveSources: Set<AudioBufferSourceNode> = new Set();

  // AudioWorklet + WASM properties
  private workletNode: AudioWorkletNode | null = null;
  private isWorkletReady: boolean = false;
  private wasmBytesCache: ArrayBuffer | null = null;

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
   * Switch between WASM (AudioWorklet) and Legacy (Main Thread + Meyda)
   */
  public async setEngineMode(mode: LipSyncEngine): Promise<void> {
    if (this.engineMode === mode) return;
    this.engineMode = mode;
    this.resetStats();

    if (mode === 'wasm') {
      // If switching to WASM, stop legacy RAF loop if running
      if (this.analysisFrameId !== null) {
        cancelAnimationFrame(this.analysisFrameId);
        this.analysisFrameId = null;
      }
      if (this.audioContext) {
        await this.initAudioWorklet();
      }
    } else {
      // Switching to legacy: start RAF loop if playing
      this.workletNode?.port.postMessage({ type: 'reset' });
      if (this.audioContext && !this.analysisFrameId && this.isPlaying) {
        this.scheduleAnalysis();
      }
    }
  }

  /**
   * Set voice gender profile ('female' or 'male') for optimized vowel classification
   */
  public setVoiceGender(gender: 'female' | 'male'): void {
    this.voiceGender = gender;
    this.workletNode?.port.postMessage({ type: 'set-gender', data: { gender } });
  }

  /**
   * Set microphone input boost gain (multiplier, e.g. 1.0 - 6.0)
   */
  public setMicGain(gain: number): void {
    this.micGainValue = Math.max(0.2, Math.min(10.0, gain));
    if (this.micGainNode && this.audioContext) {
      this.micGainNode.gain.setValueAtTime(this.micGainValue, this.audioContext.currentTime);
    }
  }

  /**
   * Set silence hangover time in milliseconds (duration to hold vowel open across pitch valleys)
   */
  public setHoldTime(ms: number): void {
    // Convert ms to approx frames at 60fps (1 frame ~ 16.6ms)
    this.holdFrames = Math.max(1, Math.round(ms / 16.6));
    this.workletNode?.port.postMessage({ type: 'set-hold-frames', data: { frames: this.holdFrames } });
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

  private async initAudioWorklet(): Promise<void> {
    if (!this.audioContext || this.workletNode) return;

    try {
      // 1. Add AudioWorklet module
      await this.audioContext.audioWorklet.addModule(resolveAssetUrl('/worklets/lipsync-processor.js'));

      // 2. Fetch WASM binary
      if (!this.wasmBytesCache) {
        const resp = await fetch(resolveAssetUrl('/wasm/lipsync.wasm'));
        this.wasmBytesCache = await resp.arrayBuffer();
      }

      // 3. Create Worklet Node
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
          if (this.engineMode !== 'wasm') return; // ignore if user switched to legacy

          const { phoneme, rms, f1, f2, distances, processingTimeMs } = data;
          this.currentRms = rms;

          if (this.currentPhoneme !== phoneme) {
            this.currentPhoneme = phoneme;
            this.events.onPhonemeChange?.(phoneme);
          }

          this.updateStats(processingTimeMs, rms, phoneme, f1, f2, distances);
        }
      };

      // 4. Send WASM bytes to processor
      this.workletNode.port.postMessage({
        type: 'init-wasm',
        data: {
          wasmBytes: this.wasmBytesCache,
          sampleRate: this.audioContext.sampleRate,
        },
      });

      // 5. Connect source nodes to worklet
      if (this.sourceNode) {
        this.sourceNode.connect(this.workletNode);
      }
      if (this.micGainNode) {
        this.micGainNode.connect(this.workletNode);
      }
    } catch (err) {
      console.warn('Failed to initialize AudioWorklet lipsync, falling back to legacy:', err);
      this.engineMode = 'legacy';
      this.scheduleAnalysis();
    }
  }

  /**
   * AudioContext and non-deprecated Web Audio analysis lazy initialization.
   */
  public initAudioContext(): void {
    if (this.audioContext) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();

    this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
    this.analyzerNode = this.audioContext.createAnalyser();
    this.analyzerNode.fftSize = 1024;
    this.analyzerNode.smoothingTimeConstant = 0;
    this.analysisBuffer = new Float32Array(this.analyzerNode.fftSize);
    this.delayNode = this.audioContext.createDelay(1.0);
    this.delayNode.delayTime.setValueAtTime(this.audioDelay, this.audioContext.currentTime);
    this.gainNode = this.audioContext.createGain();

    if (typeof this.audioContext.createStereoPanner === 'function') {
      this.pannerNode = this.audioContext.createStereoPanner();
      this.pannerNode.pan.setValueAtTime(this.currentPan, this.audioContext.currentTime);
    }

    // Playback Route (Audio file to speakers): source -> delay -> gain -> (panner) -> destination
    this.sourceNode.connect(this.delayNode);
    this.delayNode.connect(this.gainNode);
    if (this.pannerNode) {
      this.gainNode.connect(this.pannerNode);
      this.pannerNode.connect(this.audioContext.destination);
    } else {
      this.gainNode.connect(this.audioContext.destination);
    }

    // Analysis Route (AnalyserNode connects only as a sink, NEVER to speakers):
    // Playback: sourceNode -> analyzerNode
    // Mic:      micSourceNode -> micGainNode -> analyzerNode
    this.sourceNode.connect(this.analyzerNode);

    // If WASM engine is requested, load AudioWorklet
    if (this.engineMode === 'wasm') {
      void this.initAudioWorklet();
    }

    // Meyda's streaming analyzer uses the deprecated ScriptProcessorNode.
    // Read the current signal with AnalyserNode and use Meyda's synchronous
    // feature extraction instead, keeping analysis off the audio render path.
    Meyda.bufferSize = this.analyzerNode.fftSize;
    Meyda.sampleRate = this.audioContext.sampleRate;
    this.scheduleAnalysis();
  }

  public getStats(): LipSyncStats {
    return { ...this.lastStats, distances: { ...this.lastStats.distances } };
  }

  public resetStats(): void {
    this.minTimeMs = Infinity;
    this.maxTimeMs = 0;
    this.totalTimeMs = 0;
    this.sampleCount = 0;
    this.lastStats = {
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
    this.events.onStatsUpdate?.(this.getStats());
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

  public async startMicrophone(): Promise<void> {
    this.initAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    if (this.isPlaying && !this.isMicrophoneActive) {
      this.audioElement.pause();
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia is not supported in this browser environment');
    }

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });

    if (this.audioContext && this.analyzerNode) {
      this.micSourceNode = this.audioContext.createMediaStreamSource(this.micStream);
      this.micGainNode = this.audioContext.createGain();
      this.micGainNode.gain.setValueAtTime(this.micGainValue, this.audioContext.currentTime);

      // Connect: micSource -> micGain -> analyzer & worklet.
      // Never connect to destination to avoid acoustic speaker feedback.
      this.micSourceNode.connect(this.micGainNode);
      this.micGainNode.connect(this.analyzerNode);
      if (this.workletNode) {
        this.micGainNode.connect(this.workletNode);
      }
    }

    this.silenceHoldCounter = 0;
    this.smoothedRms = 0;
    this.isVoicing = false;
    this.isMicrophoneActive = true;
    this.isPlaying = true;
    if (this.events.onPlayStateChange) {
      this.events.onPlayStateChange(true);
    }
  }

  public stopMicrophone(): void {
    if (this.micSourceNode) {
      try {
        if (this.micGainNode) {
          this.micSourceNode.disconnect(this.micGainNode);
          this.micGainNode.disconnect();
        } else if (this.analyzerNode) {
          this.micSourceNode.disconnect(this.analyzerNode);
        }
      } catch {
        // ignore
      }
      this.micSourceNode = null;
      this.micGainNode = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    this.workletNode?.port.postMessage({ type: 'reset' });
    this.isMicrophoneActive = false;
    this.silenceHoldCounter = 0;
    this.smoothedRms = 0;
    this.isVoicing = false;
    if (this.audioElement.paused && this.pcmActiveSources.size === 0) {
      this.isPlaying = false;
      this.currentPhoneme = 'nn';
      this.events.onPhonemeChange?.('nn');
      if (this.events.onPlayStateChange) {
        this.events.onPlayStateChange(false);
      }
    }
  }

  /**
   * Enqueue and play raw PCM audio chunk (e.g. from Gemini Live API at 24000Hz).
   * Automatically routes audio to analyzerNode for vowel lip-sync and speakers.
   */
  public playPcmChunk(pcmData: Int16Array | Float32Array, sampleRate: number = 24000): void {
    this.initAudioContext();
    if (!this.audioContext || !this.analyzerNode || !this.delayNode) return;

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }

    let float32: Float32Array;
    if (pcmData instanceof Int16Array) {
      float32 = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        float32[i] = pcmData[i] / 32768.0;
      }
    } else {
      float32 = pcmData;
    }

    if (float32.length === 0) return;

    const audioBuffer = this.audioContext.createBuffer(1, float32.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;

    // Connect to analysis (lip-sync) and playback
    source.connect(this.analyzerNode);
    if (this.workletNode) {
      source.connect(this.workletNode);
    }
    source.connect(this.delayNode);

    const now = this.audioContext.currentTime;
    const startTime = Math.max(now, this.pcmNextStartTime);
    source.start(startTime);
    this.pcmNextStartTime = startTime + audioBuffer.duration;
    this.pcmActiveSources.add(source);

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.events.onPlayStateChange?.(true);
    }

    source.onended = () => {
      this.pcmActiveSources.delete(source);
      source.disconnect();
      if (
        this.pcmActiveSources.size === 0 &&
        this.audioContext &&
        this.audioContext.currentTime >= this.pcmNextStartTime - 0.05
      ) {
        if (!this.isMicrophoneActive && this.audioElement.paused) {
          this.isPlaying = false;
          this.currentPhoneme = 'nn';
          this.events.onPhonemeChange?.('nn');
          this.events.onPlayStateChange?.(false);
          this.events.onEnded?.();
        }
      }
    };
  }

  /** Remaining audible PCM, including the lip-sync playback delay. Uses the audio clock. */
  public getPcmRemainingSeconds(): number {
    if (!this.audioContext || this.pcmNextStartTime === 0) return 0;
    return Math.max(0, this.pcmNextStartTime + this.audioDelay - this.audioContext.currentTime);
  }

  /** Immediately cancel all playing and queued PCM audio chunks. */
  public stopPcmStream(): void {
    for (const source of this.pcmActiveSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // ignore
      }
    }
    this.pcmActiveSources.clear();
    this.pcmNextStartTime = 0;

    if (!this.isMicrophoneActive && this.audioElement.paused) {
      this.isPlaying = false;
      this.currentPhoneme = 'nn';
      this.events.onPhonemeChange?.('nn');
      this.events.onPlayStateChange?.(false);
    }
  }

  private scheduleAnalysis(): void {
    this.analysisFrameId = requestAnimationFrame(() => {
      this.analysisFrameId = null;
      this.analyzeCurrentFrame();
      if (this.audioContext?.state !== 'closed') {
        this.scheduleAnalysis();
      }
    });
  }

  private analyzeCurrentFrame(): void {
    if (this.engineMode === 'wasm') return; // Handled by AudioWorkletProcessor
    if (!this.isPlaying || !this.analyzerNode || !this.analysisBuffer) return;

    const t0 = performance.now();
    this.analyzerNode.getFloatTimeDomainData(this.analysisBuffer);
    const features = Meyda.extract(
      ['mfcc', 'rms', 'powerSpectrum'],
      this.analysisBuffer
    );
    const rawRms = features?.rms ?? 0;
    // Exponential moving average for RMS to prevent dropouts during pitch wave valleys
    this.smoothedRms = this.smoothedRms * 0.6 + rawRms * 0.4;
    const effectiveRms = Math.max(rawRms, this.smoothedRms);
    this.currentRms = effectiveRms;

    // Hysteresis & hold-time state machine for voice activity
    if (this.isVoicing) {
      if (effectiveRms < this.rmsReleaseThreshold) {
        if (this.silenceHoldCounter > 0) {
          this.silenceHoldCounter--;
        } else {
          this.isVoicing = false;
        }
      } else {
        this.silenceHoldCounter = this.holdFrames;
      }
    } else {
      if (effectiveRms >= this.rmsThreshold) {
        this.isVoicing = true;
        this.silenceHoldCounter = this.holdFrames;
      }
    }

    // If not voicing (silence floor and hangover expired), close mouth.
    if (!this.isVoicing) {
      if (this.currentPhoneme !== 'nn') {
        this.currentPhoneme = 'nn';
        this.events.onPhonemeChange?.('nn');
      }
      const t1 = performance.now();
      this.updateStats(t1 - t0, effectiveRms, 'nn', 0, 0, { aa: 99, ee: 99, ih: 99, oh: 99, ou: 99 });
      return;
    }

    // In hangover period when instantaneous energy dropped significantly, hold previous phoneme
    const spectrum = features?.powerSpectrum;
    if (spectrum && spectrum.length > 0 && rawRms >= this.rmsReleaseThreshold) {
      const { phoneme, f1, f2, distances } = this.guessPhonemeDetailed(features.mfcc, spectrum);
      if (this.currentPhoneme !== phoneme) {
        this.currentPhoneme = phoneme;
        this.events.onPhonemeChange?.(phoneme);
      }
      const t1 = performance.now();
      this.updateStats(t1 - t0, effectiveRms, phoneme, f1, f2, distances);
    } else {
      // Hold previous vowel during brief energy dips within hangover
      const t1 = performance.now();
      this.updateStats(
        t1 - t0,
        effectiveRms,
        this.currentPhoneme || 'nn',
        this.lastStats.f1,
        this.lastStats.f2,
        this.lastStats.distances
      );
    }
  }

  /**
   * High-accuracy Japanese phoneme classifier combining empirical MFCC distance modeling
   * with guided spectral resonance formant (F1/F2) tracking.
   */
  public guessPhonemeDetailed(
    mfcc?: number[],
    powerSpectrum?: ArrayLike<number>
  ): { phoneme: Phoneme | 'nn'; f1: number; f2: number; distances: Record<Phoneme, number> } {
    const defaultDistances: Record<Phoneme, number> = {
      aa: 99,
      ee: 99,
      ih: 99,
      oh: 99,
      ou: 99,
    };

    if (!powerSpectrum || powerSpectrum.length === 0 || !this.audioContext) {
      return { phoneme: 'nn', f1: 0, f2: 0, distances: defaultDistances };
    }

    const targets = MFCC_TARGETS[this.voiceGender] || MFCC_TARGETS.female;
    let bestPhoneme: Phoneme | 'nn' = 'nn';
    let minDist = Infinity;
    const distances: Record<Phoneme, number> = { ...defaultDistances };

    if (mfcc && mfcc.length >= 13) {
      // Primary classifier: MFCC 1..12 distance (volume-invariant, timbre/vowel envelope matching)
      for (const p of PHONEMES) {
        const targetVec = targets[p];
        let sumSq = 0;
        for (let j = 0; j < 12; j++) {
          const diff = (mfcc[j + 1] ?? 0) - targetVec[j];
          sumSq += diff * diff;
        }
        let dist = Math.sqrt(sumSq);

        // Hysteresis: prevent rapid fluttering between adjacent vowels
        if (this.currentPhoneme === p) {
          dist *= 0.82;
        }

        // Normalize distance scale for UI meter readability (~0.1 to 1.5)
        distances[p] = Math.round((dist / 50.0) * 100) / 100;

        if (dist < minDist) {
          minDist = dist;
          bestPhoneme = p;
        }
      }
    }

    // Secondary: Extract accurate F1 and F2 formants from spectrum guided by predicted vowel range
    const bufferSize = this.analyzerNode ? this.analyzerNode.fftSize : 1024;
    const binWidth = this.audioContext.sampleRate / bufferSize;
    const numBins = powerSpectrum.length;

    // Smooth envelope with ~360Hz window to eliminate pitch harmonics
    const smoothRadius = Math.max(3, Math.round(360 / (2 * binWidth)));
    const smoothed = new Float32Array(numBins);
    for (let i = 0; i < numBins; i++) {
      let sum = 0, count = 0;
      for (let w = -smoothRadius; w <= smoothRadius; w++) {
        const idx = i + w;
        if (idx >= 0 && idx < numBins) {
          sum += powerSpectrum[idx];
          count++;
        }
      }
      smoothed[i] = sum / (count || 1);
    }

    const ranges = FORMANT_SEARCH_RANGES[this.voiceGender] || FORMANT_SEARCH_RANGES.female;
    const activeRange = bestPhoneme !== 'nn' ? ranges[bestPhoneme] : ranges.aa;

    const findPeakInHz = (minHz: number, maxHz: number): number => {
      const minB = Math.round(minHz / binWidth);
      const maxB = Math.round(maxHz / binWidth);
      let bestBin = minB;
      let maxVal = -1;
      for (let b = minB; b <= maxB; b++) {
        if (smoothed[b] > maxVal) {
          maxVal = smoothed[b];
          bestBin = b;
        }
      }
      return Math.round(bestBin * binWidth);
    };

    const f1 = findPeakInHz(activeRange.f1[0], activeRange.f1[1]);
    const f2 = findPeakInHz(activeRange.f2[0], activeRange.f2[1]);

    return { phoneme: bestPhoneme, f1, f2, distances };
  }

  /**
   * Backwards-compatible phoneme classifier
   */
  public guessPhoneme(mfcc?: number[], powerSpectrum?: ArrayLike<number>): Phoneme | 'nn' {
    return this.guessPhonemeDetailed(mfcc, powerSpectrum).phoneme;
  }

  /**
   * Backwards-compatible MFCC classification fallback
   */
  public guessPhonemeMfcc(mfcc: number[]): Phoneme | 'nn' {
    return this.guessPhoneme(mfcc);
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
   * Set stereo panning (-1.0 = 100% Left, 0.0 = Center, 1.0 = 100% Right)
   */
  public setPan(pan: number): void {
    this.currentPan = Math.max(-1.0, Math.min(1.0, pan));
    if (this.pannerNode && this.audioContext) {
      this.pannerNode.pan.value = this.currentPan;
      this.pannerNode.pan.setValueAtTime(this.currentPan, this.audioContext.currentTime);
    }
  }

  /**
   * Load audio from URL
   */
  public loadAudioUrl(url: string, title?: string, pan?: number): void {
    this.initAudioContext();
    this.setPan(typeof pan === 'number' ? pan : 0);
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
    if (this.isMicrophoneActive) {
      this.stopMicrophone();
    }
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
    this.stopMicrophone();
    if (this.analysisFrameId !== null) {
      cancelAnimationFrame(this.analysisFrameId);
      this.analysisFrameId = null;
    }
    this.analysisBuffer = null;
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
