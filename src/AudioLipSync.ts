import Meyda from 'meyda';
import { resolveAssetUrl } from './utils/path';

export const PHONEMES = ['aa', 'ee', 'ih', 'oh', 'ou'] as const;
export type Phoneme = (typeof PHONEMES)[number];

// Standard MFCC prototype vectors (c1 to c8) for Japanese vowels
// Reflecting acoustic spectral tilt, curvature, and formant peaks
const MFCC_PROFILES: Record<Phoneme, number[]> = {
  // 'aa': Low F1/F2 ratio, strong mid-band energy (700-1400Hz), wide mouth opening
  aa: [-32.0, -16.0, 10.0, -12.0, -8.0, 4.0, -2.0, 1.0],
  // 'ih': Low F1 (<350Hz), Very high F2 (>2200Hz), mid-frequency dip
  ih: [18.0, 24.0, -20.0, 16.0, -10.0, -14.0, 8.0, -4.0],
  // 'ou': Low F1, Low F2, rounded lips, strong high-frequency attenuation
  ou: [-38.0, 10.0, 18.0, 6.0, -4.0, -10.0, -2.0, 0.0],
  // 'ee': Mid F1 (~500Hz), High F2 (~2000Hz), balanced distribution
  ee: [-4.0, 16.0, -8.0, 12.0, -16.0, 4.0, 4.0, -2.0],
  // 'oh': Mid-Low F1 (~500Hz), Low F2 (~900Hz), concentrated in 400-1100Hz
  oh: [-24.0, 6.0, 16.0, -6.0, -12.0, 2.0, -4.0, 0.0],
};

interface FormantBands {
  low: number;     // 150 - 500 Hz (F1 low: 'ih', 'ou')
  midLow: number;  // 500 - 1400 Hz (F1 high / F2 low: 'aa', 'oh')
  midHigh: number; // 1400 - 2500 Hz (F2 high: 'ee', 'ih')
  high: number;    // 2500 - 5500 Hz (F3 / high consonants)
}

function calculateFormantBands(spectrum: number[], sampleRate: number, bufferSize: number): FormantBands {
  const binWidth = sampleRate / bufferSize;
  let low = 0, midLow = 0, midHigh = 0, high = 0;

  for (let i = 0; i < spectrum.length; i++) {
    const freq = i * binWidth;
    const val = spectrum[i];
    if (freq >= 150 && freq < 500) {
      low += val;
    } else if (freq >= 500 && freq < 1400) {
      midLow += val;
    } else if (freq >= 1400 && freq < 2500) {
      midHigh += val;
    } else if (freq >= 2500 && freq < 5500) {
      high += val;
    }
  }

  const total = low + midLow + midHigh + high + 1e-6;
  return {
    low: low / total,
    midLow: midLow / total,
    midHigh: midHigh / total,
    high: high / total,
  };
}

function getFormantVowelScore(vowel: Phoneme, bands: FormantBands): number {
  switch (vowel) {
    case 'aa':
      return Math.max(0, bands.midLow * 2.0 + bands.midHigh * 0.5 - bands.low * 0.8 - bands.high * 0.5);
    case 'ih':
      return Math.max(0, bands.midHigh * 1.5 + bands.high * 1.8 + bands.low * 0.8 - bands.midLow * 1.5);
    case 'ou':
      return Math.max(0, bands.low * 1.8 + bands.midLow * 0.8 - bands.midHigh * 1.5 - bands.high * 2.0);
    case 'ee':
      return Math.max(0, bands.midHigh * 1.4 + bands.midLow * 0.8 - bands.high * 0.5 - bands.low * 0.4);
    case 'oh':
      return Math.max(0, bands.midLow * 1.4 + bands.low * 1.2 - bands.midHigh * 1.2 - bands.high * 1.5);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const weight = 1.0 / Math.sqrt(i + 1);
    const wa = a[i] * weight;
    const wb = b[i] * weight;
    dot += wa * wb;
    normA += wa * wa;
    normB += wb * wb;
  }
  if (normA <= 0 || normB <= 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

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
      featureExtractors: ['mfcc', 'rms', 'powerSpectrum'],
      callback: (features: { mfcc?: number[]; rms?: number; powerSpectrum?: number[] }) => {
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
        const spectrum = features?.powerSpectrum;
        if (mfcc && mfcc.length > 1) {
          const phoneme = this.guessPhoneme(mfcc, spectrum);
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
   * High-accuracy hybrid phoneme classifier combining multi-dimensional MFCC
   * prototype matching with FFT spectral formant band energy ratios.
   */
  public guessPhoneme(mfcc: number[], powerSpectrum?: number[]): Phoneme | 'nn' {
    if (!mfcc || mfcc.length < 2) return 'nn';

    // c1 to c8 (skip c0 which is overall energy)
    const vec = mfcc.slice(1, 9);

    // Calculate spectral formant band ratios if power spectrum is available
    let bands: FormantBands | null = null;
    if (powerSpectrum && powerSpectrum.length > 0 && this.audioContext) {
      bands = calculateFormantBands(powerSpectrum, this.audioContext.sampleRate, 512);
    }

    let bestPhoneme: Phoneme | 'nn' = 'nn';
    let maxScore = -Infinity;

    for (const p of PHONEMES) {
      // 1. MFCC Cosine Similarity normalized to [0, 1]
      const mfccSim = (cosineSimilarity(vec, MFCC_PROFILES[p]) + 1.0) * 0.5;

      // 2. Formant Energy Ratio Score [0, 1]
      let formantScore = 0.5;
      if (bands) {
        formantScore = Math.min(1.0, getFormantVowelScore(p, bands));
      }

      // Hybrid combination
      let score = 0.55 * mfccSim + 0.45 * formantScore;

      // 3. Hysteresis: slight bonus to currently active phoneme to suppress chatter/jitter
      if (this.currentPhoneme === p) {
        score += 0.08;
      }

      if (score > maxScore) {
        maxScore = score;
        bestPhoneme = p;
      }
    }

    return bestPhoneme;
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
