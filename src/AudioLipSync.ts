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

// Japanese vowel formant targets in Hz (Female/Anime Voice & Male Voice)
// F1 (Mouth Openness / Jaw height), F2 (Tongue frontness / Lip rounding)
const VOWEL_TARGETS: Record<'female' | 'male', Record<Phoneme, FormantTargets>> = {
  female: {
    aa: { f1: 950, f2: 1550, weightF1: 1.0, weightF2: 0.85 }, // あ: 口を大きく開く (High F1, Mid F2)
    ih: { f1: 340, f2: 2950, weightF1: 1.1, weightF2: 1.0 },  // い: 閉口・前舌 (Low F1, High F2)
    ou: { f1: 380, f2: 1100, weightF1: 1.1, weightF2: 0.95 }, // う: 閉口・後舌円唇 (Low F1, Low F2)
    ee: { f1: 580, f2: 2350, weightF1: 1.0, weightF2: 1.0 },  // え: 半開・前舌 (Mid F1, High-Mid F2)
    oh: { f1: 540, f2: 950, weightF1: 1.0, weightF2: 0.95 },  // お: 半開・後舌円唇 (Mid F1, Low F2)
  },
  male: {
    aa: { f1: 780, f2: 1300, weightF1: 1.0, weightF2: 0.85 },
    ih: { f1: 280, f2: 2400, weightF1: 1.1, weightF2: 1.0 },
    ou: { f1: 320, f2: 950, weightF1: 1.1, weightF2: 0.95 },
    ee: { f1: 480, f2: 1950, weightF1: 1.0, weightF2: 1.0 },
    oh: { f1: 460, f2: 850, weightF1: 1.0, weightF2: 0.95 },
  },
};

/**
 * Smoothed spectral envelope analysis to accurately locate F1 and F2 formant resonance peaks
 */
function findFormantPeaks(
  spectrum: ArrayLike<number>,
  sampleRate: number,
  bufferSize: number,
  gender: 'female' | 'male' = 'female'
): { f1: number; f2: number } {
  const binWidth = sampleRate / bufferSize;
  const numBins = spectrum.length;

  // Smoothing window (~180 Hz) to eliminate pitch harmonics and extract vocal tract envelope
  const smoothRadius = Math.max(2, Math.round(180 / (2 * binWidth)));
  const smoothed = new Float32Array(numBins);

  for (let i = 0; i < numBins; i++) {
    let sum = 0;
    let count = 0;
    for (let w = -smoothRadius; w <= smoothRadius; w++) {
      const idx = i + w;
      if (idx >= 0 && idx < numBins) {
        sum += spectrum[idx];
        count++;
      }
    }
    smoothed[i] = sum / (count || 1);
  }

  const isFemale = gender === 'female';
  const f1MinHz = isFemale ? 260 : 200;
  const f1MaxHz = isFemale ? 1250 : 1050;
  const f2MinHz = isFemale ? 800 : 700;
  const f2MaxHz = isFemale ? 3800 : 3400;

  const f1MinBin = Math.round(f1MinHz / binWidth);
  const f1MaxBin = Math.round(f1MaxHz / binWidth);

  let f1PeakIdx = -1;
  let f1MaxVal = -1;

  for (let i = f1MinBin; i <= f1MaxBin; i++) {
    if (smoothed[i] > f1MaxVal) {
      if (
        (i === f1MinBin || smoothed[i] >= smoothed[i - 1]) &&
        (i === f1MaxBin || smoothed[i] >= smoothed[i + 1])
      ) {
        f1MaxVal = smoothed[i];
        f1PeakIdx = i;
      }
    }
  }

  // F2 peak search above F1 peak + separation margin
  const f2MinBin = Math.max(
    f1PeakIdx + Math.round(200 / binWidth),
    Math.round(f2MinHz / binWidth)
  );
  const f2MaxBin = Math.round(f2MaxHz / binWidth);

  let f2PeakIdx = -1;
  let f2MaxVal = -1;

  for (let i = f2MinBin; i <= f2MaxBin; i++) {
    if (smoothed[i] > f2MaxVal) {
      if (
        (i === f2MinBin || smoothed[i] >= smoothed[i - 1]) &&
        (i === f2MaxBin || smoothed[i] >= smoothed[i + 1])
      ) {
        f2MaxVal = smoothed[i];
        f2PeakIdx = i;
      }
    }
  }

  const f1 = f1PeakIdx > 0 ? f1PeakIdx * binWidth : isFemale ? 550 : 450;
  const f2 = f2PeakIdx > 0 ? f2PeakIdx * binWidth : isFemale ? 1600 : 1400;

  return { f1, f2 };
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

    const spectrum = features?.powerSpectrum;
    if (spectrum && spectrum.length > 0) {
      const phoneme = this.guessPhoneme(features.mfcc, spectrum);
      if (this.currentPhoneme !== phoneme) {
        this.currentPhoneme = phoneme;
        this.events.onPhonemeChange?.(phoneme);
      }
    }
  }

  /**
   * High-accuracy Japanese phoneme classifier combining spectral formant peak tracking
   * (F1 mouth opening, F2 tongue frontness/rounding) with log-frequency distance modeling.
   */
  public guessPhoneme(_mfcc?: number[], powerSpectrum?: ArrayLike<number>): Phoneme | 'nn' {
    if (!powerSpectrum || powerSpectrum.length === 0 || !this.audioContext) {
      return 'nn';
    }

    const bufferSize = this.analyzerNode ? this.analyzerNode.fftSize : 1024;
    const { f1, f2 } = findFormantPeaks(
      powerSpectrum,
      this.audioContext.sampleRate,
      bufferSize,
      this.voiceGender
    );

    const targets = VOWEL_TARGETS[this.voiceGender] || VOWEL_TARGETS.female;
    let bestPhoneme: Phoneme | 'nn' = 'nn';
    let minDist = Infinity;

    for (const p of PHONEMES) {
      const target = targets[p];
      const dF1 = Math.log(f1 / target.f1) * target.weightF1;
      const dF2 = Math.log(f2 / target.f2) * target.weightF2;
      let dist = Math.sqrt(dF1 * dF1 + dF2 * dF2);

      // Hysteresis: prevent rapid fluttering between adjacent vowels
      if (this.currentPhoneme === p) {
        dist *= 0.82;
      }

      if (dist < minDist) {
        minDist = dist;
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
