import Meyda from 'meyda';
import { resolveAssetUrl } from './utils/path';

export const PHONEMES = ['aa', 'ee', 'ih', 'oh', 'ou'] as const;
export type Phoneme = (typeof PHONEMES)[number];

// Female / Anime voice prototype vectors (higher F1/F2, sharper high end)
const MFCC_PROFILES_FEMALE: Record<Phoneme, number[]> = {
  aa: [-32.0, -16.0, 10.0, -12.0, -8.0, 4.0, -2.0, 1.0],
  ih: [18.0, 24.0, -20.0, 16.0, -10.0, -14.0, 8.0, -4.0],
  ou: [-38.0, 10.0, 18.0, 6.0, -4.0, -10.0, -2.0, 0.0],
  ee: [-4.0, 16.0, -8.0, 12.0, -16.0, 4.0, 4.0, -2.0],
  oh: [-24.0, 6.0, 16.0, -6.0, -12.0, 2.0, -4.0, 0.0],
};

// Male voice prototype vectors (lower F1/F2, richer low-mid resonance)
const MFCC_PROFILES_MALE: Record<Phoneme, number[]> = {
  aa: [-38.0, -12.0, 14.0, -16.0, -6.0, 6.0, -4.0, 0.0],
  ih: [12.0, 18.0, -14.0, 12.0, -6.0, -10.0, 6.0, -2.0],
  ou: [-44.0, 14.0, 22.0, 4.0, -2.0, -6.0, 0.0, 2.0],
  ee: [-10.0, 12.0, -4.0, 8.0, -12.0, 2.0, 2.0, -1.0],
  oh: [-30.0, 8.0, 20.0, -8.0, -8.0, 4.0, -2.0, 1.0],
};

interface FormantBands {
  low: number;     // F1 low: 'ih', 'ou'
  midLow: number;  // F1 high / F2 low: 'aa', 'oh'
  midHigh: number; // F2 high: 'ee', 'ih'
  high: number;    // F3 / high consonants
}

function calculateFormantBands(
  spectrum: ArrayLike<number>,
  sampleRate: number,
  bufferSize: number,
  gender: 'female' | 'male' = 'female'
): FormantBands {
  const binWidth = sampleRate / bufferSize;
  let low = 0, midLow = 0, midHigh = 0, high = 0;

  // Gender-specific formant boundaries (Hz)
  const isFemale = gender === 'female';
  const fLowMax = isFemale ? 550 : 450;
  const fMidLowMax = isFemale ? 1600 : 1300;
  const fMidHighMax = isFemale ? 2800 : 2200;
  const fHighMax = isFemale ? 6000 : 4800;

  for (let i = 0; i < spectrum.length; i++) {
    const freq = i * binWidth;
    const val = spectrum[i];
    if (freq >= 120 && freq < fLowMax) {
      low += val;
    } else if (freq >= fLowMax && freq < fMidLowMax) {
      midLow += val;
    } else if (freq >= fMidLowMax && freq < fMidHighMax) {
      midHigh += val;
    } else if (freq >= fMidHighMax && freq < fHighMax) {
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
  public voiceGender: 'female' | 'male' = 'female';
  public audioTitle: string = '';

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
   * Set voice gender profile ('female' or 'male') for optimized vowel classification
   */
  public setVoiceGender(gender: 'female' | 'male'): void {
    this.voiceGender = gender;
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
   * AudioContext and non-deprecated Web Audio analysis lazy initialization.
   */
  private initAudioContext(): void {
    if (this.audioContext) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();

    this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
    this.analyzerNode = this.audioContext.createAnalyser();
    this.analyzerNode.fftSize = 512;
    this.analyzerNode.smoothingTimeConstant = 0;
    this.analysisBuffer = new Float32Array(this.analyzerNode.fftSize);
    this.delayNode = this.audioContext.createDelay(1.0);
    this.delayNode.delayTime.setValueAtTime(this.audioDelay, this.audioContext.currentTime);
    this.gainNode = this.audioContext.createGain();

    if (typeof this.audioContext.createStereoPanner === 'function') {
      this.pannerNode = this.audioContext.createStereoPanner();
      this.pannerNode.pan.setValueAtTime(this.currentPan, this.audioContext.currentTime);
    }

    // Playback Route: source -> analyser -> delay -> gain -> (panner) -> speakers
    this.sourceNode.connect(this.analyzerNode);
    this.analyzerNode.connect(this.delayNode);
    this.delayNode.connect(this.gainNode);
    if (this.pannerNode) {
      this.gainNode.connect(this.pannerNode);
      this.pannerNode.connect(this.audioContext.destination);
    } else {
      this.gainNode.connect(this.audioContext.destination);
    }

    // Meyda's streaming analyzer uses the deprecated ScriptProcessorNode.
    // Read the current signal with AnalyserNode and use Meyda's synchronous
    // feature extraction instead, keeping analysis off the audio render path.
    Meyda.bufferSize = this.analyzerNode.fftSize;
    Meyda.sampleRate = this.audioContext.sampleRate;
    this.scheduleAnalysis();
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
    if (!this.isPlaying || !this.analyzerNode || !this.analysisBuffer) return;

    this.analyzerNode.getFloatTimeDomainData(this.analysisBuffer);
    const features = Meyda.extract(
      ['mfcc', 'rms', 'powerSpectrum'],
      this.analysisBuffer
    );
    const rms = features?.rms ?? 0;
    this.currentRms = rms;

    // If audio level is too quiet (silence/noise floor), close mouth.
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
  }

  /**
   * High-accuracy hybrid phoneme classifier combining multi-dimensional MFCC
   * prototype matching with FFT spectral formant band energy ratios.
   */
  public guessPhoneme(mfcc: number[], powerSpectrum?: ArrayLike<number>): Phoneme | 'nn' {
    if (!mfcc || mfcc.length < 2) return 'nn';

    // c1 to c8 (skip c0 which is overall energy)
    const vec = mfcc.slice(1, 9);
    const profiles = this.voiceGender === 'male' ? MFCC_PROFILES_MALE : MFCC_PROFILES_FEMALE;

    // Calculate spectral formant band ratios if power spectrum is available
    let bands: FormantBands | null = null;
    if (powerSpectrum && powerSpectrum.length > 0 && this.audioContext) {
      bands = calculateFormantBands(powerSpectrum, this.audioContext.sampleRate, 512, this.voiceGender);
    }

    let bestPhoneme: Phoneme | 'nn' = 'nn';
    let maxScore = -Infinity;

    for (const p of PHONEMES) {
      // 1. MFCC Cosine Similarity normalized to [0, 1]
      const mfccSim = (cosineSimilarity(vec, profiles[p]) + 1.0) * 0.5;

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
    if (this.analysisFrameId !== null) {
      cancelAnimationFrame(this.analysisFrameId);
      this.analysisFrameId = null;
    }
    this.analysisBuffer = null;
    this.analyzerNode?.disconnect();
    this.analyzerNode = null;

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
