// Micro WebAssembly LipSync Analyzer in AssemblyScript
// Pure zero-allocation static memory layout (no heap collisions with rt/stub)

const FFT_SIZE: i32 = 1024;
const HALF_SIZE: i32 = 512;
const NUM_MEL_BANDS: i32 = 26;
const NUM_MFCC: i32 = 13;

// Memory layout (in bytes):
// Base offset: 32768 (32KB onwards, completely away from data sections 0..3000)
// 32768: input PCM float32 [1024] (4096 bytes) -> 32768 .. 36864
// 36864: windowed float32 [1024] (4096 bytes) -> 36864 .. 40960
// 40960: fft real float32 [1024] (4096 bytes) -> 40960 .. 45056
// 45056: fft imag float32 [1024] (4096 bytes) -> 45056 .. 49152
// 49152: power spectrum float32 [512] (2048 bytes) -> 49152 .. 51200
// 51200: smoothed spectrum float32 [512] (2048 bytes) -> 51200 .. 53248
// 53248: mel bands float32 [26] (104 bytes) -> 53248 .. 53352
// 53352: mfcc float32 [13] (52 bytes) -> 53352 .. 53404
// 53404: vowel distances float32 [5] (20 bytes: aa, ee, ih, oh, ou) -> 53404 .. 53424
// 53424: output stats [phoneme_idx (i32), rms (f32), f1 (f32), f2 (f32)] (16 bytes) -> 53424 .. 53440
//
// Tables:
// 54000: hammingTable float32 [1024] (4096 bytes) -> 54000 .. 58096
// 58100: bitRevTable int32 [1024] (4096 bytes) -> 58100 .. 62196
// 62200: cosTable float32 [512] (2048 bytes) -> 62200 .. 64248
// 64248: sinTable float32 [512] (2048 bytes) -> 64248 .. 66296
// 66296: melStart int32 [26], melPeak int32 [26], melEnd int32 [26] (312 bytes)
// 66608: dctTable float32 [13 * 26 = 338] (1352 bytes) -> 66608 .. 67960

export const INPUT_OFFSET: usize = 32768;
export const DISTANCES_OFFSET: usize = 53404;
export const STATS_OFFSET: usize = 53424;

const WINDOWED_OFFSET: usize = 36864;
const REAL_OFFSET: usize = 40960;
const IMAG_OFFSET: usize = 45056;
const POWER_OFFSET: usize = 49152;
const SMOOTHED_OFFSET: usize = 51200;
const MEL_BANDS_OFFSET: usize = 53248;
const MFCC_OFFSET: usize = 53352;

const HAMMING_OFFSET: usize = 54000;
const BITREV_OFFSET: usize = 58100;
const COS_OFFSET: usize = 62200;
const SIN_OFFSET: usize = 64248;
const MEL_START_OFFSET: usize = 66296;
const MEL_PEAK_OFFSET: usize = 66400;
const MEL_END_OFFSET: usize = 66504;
const DCT_OFFSET: usize = 66608;

// State
let currentPhoneme: i32 = -1; // -1: silence/nn, 0: aa, 1: ee, 2: ih, 3: oh, 4: ou
let isVoicing: bool = false;
let silenceHoldCounter: i32 = 0;
let holdFrames: i32 = 12;
let rmsThreshold: f32 = 0.008;
let rmsReleaseThreshold: f32 = 0.003;
let smoothedRms: f32 = 0.0;
let voiceGender: i32 = 0; // 0: female, 1: male
let sampleRate: f32 = 44100.0;
let initialized: bool = false;

// Target MFCC vectors (MFCC 1..12) for female [0..4] and male [0..4]
// Vowel order: 0: aa, 1: ee, 2: ih, 3: oh, 4: ou
const TARGET_MFCC_FEMALE: StaticArray<f32> = [
  // aa
  40.1, -17.3, -26.1, -25.5, -25.8, -0.4, 31.0, 14.0, -19.7, -16.3, 1.9, -0.8,
  // ee
  31.4, -30.1, -8.7, -1.4, -19.5, -31.1, -6.6, -4.2, -7.6, -1.7, 1.7, -0.9,
  // ih
  29.0, -9.1, 33.6, 30.0, -19.4, -25.7, -13.7, -21.1, -20.7, -22.1, -25.5, -8.8,
  // oh
  42.2, -2.0, -20.1, -29.6, -31.4, -11.9, 12.9, 5.5, -13.1, -10.1, 2.9, 5.5,
  // ou
  53.9, 28.5, 12.6, -13.5, -10.0, -5.5, -16.7, -26.4, -29.3, -22.5, -9.9, 6.4
];

const TARGET_MFCC_MALE: StaticArray<f32> = [
  // aa
  81.9, 28.8, 1.1, -5.1, -14.3, -18.9, -0.2, 25.2, 25.2, 4.9, -5.5, 0.7,
  // ee
  55.8, 11.6, 14.8, 32.4, 39.6, 16.4, -14.8, -13.8, -8.0, -7.8, 3.6, 4.4,
  // ih
  46.6, 1.3, 4.5, 40.4, 47.0, 11.1, -18.3, -10.1, 8.5, 7.1, -7.1, -13.6,
  // oh
  68.5, 36.1, 19.7, 3.8, -17.3, -30.5, -27.2, -8.5, 5.5, 0.5, -4.5, 2.5,
  // ou
  56.4, 32.2, 20.4, 23.6, 27.6, 21.1, 7.3, -5.1, -12.4, -13.6, -8.9, -3.4
];

// Formant search ranges [f1_min, f1_max, f2_min, f2_max]
const FORMANT_RANGES_FEMALE: StaticArray<f32> = [
  // aa
  750.0, 1200.0, 1300.0, 1750.0,
  // ee
  400.0, 680.0, 2000.0, 2900.0,
  // ih
  260.0, 450.0, 2500.0, 3600.0,
  // oh
  450.0, 750.0, 900.0, 1500.0,
  // ou
  280.0, 500.0, 900.0, 1600.0
];

const FORMANT_RANGES_MALE: StaticArray<f32> = [
  // aa
  600.0, 950.0, 1050.0, 1550.0,
  // ee
  350.0, 580.0, 1700.0, 2500.0,
  // ih
  200.0, 380.0, 2000.0, 3000.0,
  // oh
  380.0, 620.0, 750.0, 1250.0,
  // ou
  220.0, 420.0, 750.0, 1300.0
];

function hzToMel(hz: f32): f32 {
  return 1125.0 * <f32>Math.log(1.0 + <f64>(hz / 700.0));
}

function melToHz(mel: f32): f32 {
  return 700.0 * (<f32>Math.exp(<f64>(mel / 1125.0)) - 1.0);
}

export function init(sr: f32): void {
  sampleRate = sr;

  // 1. Precompute Hamming window
  const pi2: f64 = 2.0 * Math.PI;
  for (let i = 0; i < FFT_SIZE; i++) {
    const w = <f32>(0.54 - 0.46 * Math.cos(pi2 * <f64>i / <f64>(FFT_SIZE - 1)));
    store<f32>(HAMMING_OFFSET + (<usize>i << 2), w);
  }

  // 2. Precompute FFT bit reversal table
  for (let i = 0; i < FFT_SIZE; i++) {
    let rev: i32 = 0;
    let temp: i32 = i;
    for (let j = 0; j < 10; j++) {
      rev = (rev << 1) | (temp & 1);
      temp >>= 1;
    }
    store<i32>(BITREV_OFFSET + (<usize>i << 2), rev);
  }

  // 3. Precompute Twiddle factors (Euler: e^(-2*pi*k/N) = cos - i*sin)
  for (let i = 0; i < HALF_SIZE; i++) {
    const angle: f64 = -pi2 * <f64>i / <f64>(FFT_SIZE);
    store<f32>(COS_OFFSET + (<usize>i << 2), <f32>Math.cos(angle));
    store<f32>(SIN_OFFSET + (<usize>i << 2), <f32>Math.sin(angle));
  }

  // 4. Precompute Mel Filter Bank bins (Meyda formula)
  const minMel = hzToMel(0.0);
  const maxMel = hzToMel(sampleRate / 2.0);
  const melStep = (maxMel - minMel) / <f32>(NUM_MEL_BANDS + 1);

  for (let i = 0; i < NUM_MEL_BANDS; i++) {
    const fPrev = melToHz(minMel + <f32>i * melStep);
    const fCenter = melToHz(minMel + <f32>(i + 1) * melStep);
    const fNext = melToHz(minMel + <f32>(i + 2) * melStep);

    const s = <i32>Math.floor(<f64>((<f32>(FFT_SIZE + 1) * fPrev) / sampleRate));
    const p = <i32>Math.floor(<f64>((<f32>(FFT_SIZE + 1) * fCenter) / sampleRate));
    const e = <i32>Math.floor(<f64>((<f32>(FFT_SIZE + 1) * fNext) / sampleRate));

    store<i32>(MEL_START_OFFSET + (<usize>i << 2), s);
    store<i32>(MEL_PEAK_OFFSET + (<usize>i << 2), p);
    store<i32>(MEL_END_OFFSET + (<usize>i << 2), e);
  }

  // 5. Precompute DCT matrix (Meyda DCT-II formula)
  const piM: f64 = Math.PI / <f64>NUM_MEL_BANDS;
  for (let m = 0; m < NUM_MFCC; m++) {
    for (let k = 0; k < NUM_MEL_BANDS; k++) {
      const val = <f32>Math.cos(piM * (<f64>k + 0.5) * <f64>m);
      store<f32>(DCT_OFFSET + (<usize>(m * NUM_MEL_BANDS + k) << 2), val);
    }
  }

  initialized = true;
}

export function setVoiceGender(gender: i32): void {
  voiceGender = gender;
}

export function setRmsThreshold(threshold: f32): void {
  rmsThreshold = threshold;
}

export function setHoldFrames(frames: i32): void {
  holdFrames = frames;
}

export function resetState(): void {
  currentPhoneme = -1;
  isVoicing = false;
  silenceHoldCounter = 0;
  smoothedRms = 0.0;
}

// In-place Radix-2 Cooley-Tukey FFT of length 1024
function runFft(): void {
  // Bit reversal permutation
  for (let i = 0; i < FFT_SIZE; i++) {
    const rev = load<i32>(BITREV_OFFSET + (<usize>i << 2));
    const val = load<f32>(WINDOWED_OFFSET + (<usize>rev << 2));
    store<f32>(REAL_OFFSET + (<usize>i << 2), val);
    store<f32>(IMAG_OFFSET + (<usize>i << 2), 0.0);
  }

  // Butterfly passes
  for (let step = 1; step <= 10; step++) {
    const halfLen = 1 << (step - 1);
    const len = 1 << step;
    const tableStep = 512 / halfLen;

    for (let k = 0; k < FFT_SIZE; k += len) {
      for (let j = 0; j < halfLen; j++) {
        const tableIdx = j * tableStep;
        const c = load<f32>(COS_OFFSET + (<usize>tableIdx << 2));
        const s = load<f32>(SIN_OFFSET + (<usize>tableIdx << 2));

        const evenIdx: usize = <usize>(k + j) << 2;
        const oddIdx: usize = <usize>(k + j + halfLen) << 2;

        const uR = load<f32>(REAL_OFFSET + evenIdx);
        const uI = load<f32>(IMAG_OFFSET + evenIdx);

        const vR_raw = load<f32>(REAL_OFFSET + oddIdx);
        const vI_raw = load<f32>(IMAG_OFFSET + oddIdx);

        // Twiddle multiplication: (vR + i*vI) * (c + i*s) = (vR*c - vI*s) + i*(vR*s + vI*c)
        const vR = vR_raw * c - vI_raw * s;
        const vI = vR_raw * s + vI_raw * c;

        store<f32>(REAL_OFFSET + evenIdx, uR + vR);
        store<f32>(IMAG_OFFSET + evenIdx, uI + vI);
        store<f32>(REAL_OFFSET + oddIdx, uR - vR);
        store<f32>(IMAG_OFFSET + oddIdx, uI - vI);
      }
    }
  }
}

/**
 * Main LipSync processing frame.
 * Assumes 1024 float32 samples have been copied to INPUT_OFFSET.
 */
export function processFrame(): void {
  if (!initialized) {
    init(44100.0);
  }

  // 1. Compute RMS & Apply Hamming Window
  let sumSq: f32 = 0.0;
  for (let i = 0; i < FFT_SIZE; i++) {
    const s = load<f32>(INPUT_OFFSET + (<usize>i << 2));
    sumSq += s * s;
    const w = s * load<f32>(HAMMING_OFFSET + (<usize>i << 2));
    store<f32>(WINDOWED_OFFSET + (<usize>i << 2), w);
  }
  const rawRms = <f32>Math.sqrt(<f64>(sumSq / <f32>FFT_SIZE));

  // Exponential moving average
  smoothedRms = smoothedRms * 0.6 + rawRms * 0.4;
  const effectiveRms: f32 = rawRms > smoothedRms ? rawRms : smoothedRms;

  // Voicing state machine with hysteresis
  if (isVoicing) {
    if (effectiveRms < rmsReleaseThreshold) {
      if (silenceHoldCounter > 0) {
        silenceHoldCounter--;
      } else {
        isVoicing = false;
      }
    } else {
      silenceHoldCounter = holdFrames;
    }
  } else {
    if (effectiveRms >= rmsThreshold) {
      isVoicing = true;
      silenceHoldCounter = holdFrames;
    }
  }

  // If silent, set output to nn / silence
  if (!isVoicing) {
    currentPhoneme = -1;
    store<i32>(STATS_OFFSET, -1);
    store<f32>(STATS_OFFSET + 4, effectiveRms);
    store<f32>(STATS_OFFSET + 8, 0.0);
    store<f32>(STATS_OFFSET + 12, 0.0);

    for (let p = 0; p < 5; p++) {
      store<f32>(DISTANCES_OFFSET + (<usize>p << 2), 99.0);
    }
    return;
  }

  // 2. Run FFT
  runFft();

  // 3. Compute Power Spectrum [HALF_SIZE = 512 bins]
  for (let i = 0; i < HALF_SIZE; i++) {
    const r = load<f32>(REAL_OFFSET + (<usize>i << 2));
    const im = load<f32>(IMAG_OFFSET + (<usize>i << 2));
    store<f32>(POWER_OFFSET + (<usize>i << 2), r * r + im * im);
  }

  // 4. Compute Mel Filter Bank & log-energy
  for (let i = 0; i < NUM_MEL_BANDS; i++) {
    const pStart = load<i32>(MEL_START_OFFSET + (<usize>i << 2));
    const pCenter = load<i32>(MEL_PEAK_OFFSET + (<usize>i << 2));
    const pEnd = load<i32>(MEL_END_OFFSET + (<usize>i << 2));

    let bandSum: f32 = 0.0;

    // Up slope
    if (pCenter > pStart) {
      const denom = <f32>(pCenter - pStart);
      for (let b = pStart; b < pCenter && b < HALF_SIZE; b++) {
        const weight = <f32>(b - pStart) / denom;
        bandSum += weight * load<f32>(POWER_OFFSET + (<usize>b << 2));
      }
    }

    // Down slope
    if (pEnd > pCenter) {
      const denom = <f32>(pEnd - pCenter);
      for (let b = pCenter; b < pEnd && b < HALF_SIZE; b++) {
        const weight = <f32>(pEnd - b) / denom;
        bandSum += weight * load<f32>(POWER_OFFSET + (<usize>b << 2));
      }
    }

    // Meyda: melBands[i] = log(bandSum + 1)
    store<f32>(MEL_BANDS_OFFSET + (<usize>i << 2), <f32>Math.log(<f64>(bandSum + 1.0)));
  }

  // 5. Compute MFCC (13 coefficients via DCT-II)
  for (let m = 0; m < NUM_MFCC; m++) {
    let sum: f32 = 0.0;
    const rowOffset = m * NUM_MEL_BANDS;
    for (let k = 0; k < NUM_MEL_BANDS; k++) {
      const dctVal = load<f32>(DCT_OFFSET + (<usize>(rowOffset + k) << 2));
      sum += load<f32>(MEL_BANDS_OFFSET + (<usize>k << 2)) * dctVal;
    }
    // Meyda factor: 2.0 * sum
    store<f32>(MFCC_OFFSET + (<usize>m << 2), 2.0 * sum);
  }

  // 6. Match MFCC Distances (1..12) against Vowel Targets
  let bestPhoneme: i32 = -1;
  let minDist: f32 = 999999.0;
  const targetTable = voiceGender == 0 ? TARGET_MFCC_FEMALE : TARGET_MFCC_MALE;

  for (let p = 0; p < 5; p++) {
    let sumSqDiff: f32 = 0.0;
    const vecOffset = p * 12;

    for (let j = 0; j < 12; j++) {
      const mfccVal = load<f32>(MFCC_OFFSET + (<usize>(j + 1) << 2)); // ignore MFCC[0]
      const diff = mfccVal - targetTable[vecOffset + j];
      sumSqDiff += diff * diff;
    }

    let dist = <f32>Math.sqrt(<f64>sumSqDiff);

    // Hysteresis bonus for current vowel
    if (currentPhoneme == p) {
      dist *= 0.82;
    }

    // Normalized display distance (~0.1 to 1.5)
    const normDist = <f32>Math.round(<f64>((dist / 50.0) * 100.0)) / 100.0;
    store<f32>(DISTANCES_OFFSET + (<usize>p << 2), normDist);

    if (dist < minDist) {
      minDist = dist;
      bestPhoneme = p;
    }
  }

  currentPhoneme = bestPhoneme;

  // 7. Spectral Formant (F1/F2) Guided Peak Search
  const binWidth: f32 = sampleRate / <f32>FFT_SIZE;
  const smoothRadius = <i32>Math.max(3.0, Math.round(<f64>(360.0 / (2.0 * binWidth))));

  // Smooth power spectrum with moving average
  for (let i = 0; i < HALF_SIZE; i++) {
    let sum: f32 = 0.0;
    let count: i32 = 0;
    for (let w = -smoothRadius; w <= smoothRadius; w++) {
      const idx = i + w;
      if (idx >= 0 && idx < HALF_SIZE) {
        sum += load<f32>(POWER_OFFSET + (<usize>idx << 2));
        count++;
      }
    }
    store<f32>(SMOOTHED_OFFSET + (<usize>i << 2), sum / (count > 0 ? <f32>count : 1.0));
  }

  const formantRanges = voiceGender == 0 ? FORMANT_RANGES_FEMALE : FORMANT_RANGES_MALE;
  const activeIdx = (bestPhoneme >= 0 && bestPhoneme < 5 ? bestPhoneme : 0) * 4;

  const f1MinHz = formantRanges[activeIdx];
  const f1MaxHz = formantRanges[activeIdx + 1];
  const f2MinHz = formantRanges[activeIdx + 2];
  const f2MaxHz = formantRanges[activeIdx + 3];

  let bestF1Bin: i32 = <i32>Math.round(<f64>(f1MinHz / binWidth));
  let maxF1Val: f32 = -1.0;
  const maxF1Bin = <i32>Math.round(<f64>(f1MaxHz / binWidth));
  for (let b = bestF1Bin; b <= maxF1Bin && b < HALF_SIZE; b++) {
    const val = load<f32>(SMOOTHED_OFFSET + (<usize>b << 2));
    if (val > maxF1Val) {
      maxF1Val = val;
      bestF1Bin = b;
    }
  }

  let bestF2Bin: i32 = <i32>Math.round(<f64>(f2MinHz / binWidth));
  let maxF2Val: f32 = -1.0;
  const maxF2Bin = <i32>Math.round(<f64>(f2MaxHz / binWidth));
  for (let b = bestF2Bin; b <= maxF2Bin && b < HALF_SIZE; b++) {
    const val = load<f32>(SMOOTHED_OFFSET + (<usize>b << 2));
    if (val > maxF2Val) {
      maxF2Val = val;
      bestF2Bin = b;
    }
  }

  const f1Hz = <f32>Math.round(<f64>(<f32>bestF1Bin * binWidth));
  const f2Hz = <f32>Math.round(<f64>(<f32>bestF2Bin * binWidth));

  // Write Stats: [phoneme_idx (i32), rms (f32), f1 (f32), f2 (f32)]
  store<i32>(STATS_OFFSET, bestPhoneme);
  store<f32>(STATS_OFFSET + 4, effectiveRms);
  store<f32>(STATS_OFFSET + 8, f1Hz);
  store<f32>(STATS_OFFSET + 12, f2Hz);
}
