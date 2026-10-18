/** WASM の無音判定に渡す共通の閾値。 */
export const VOICE_SILENCE_RMS = 0.003;

/** 口パク解析の AudioWorklet と WASM（engine に同梱） */
const WORKLET_URL = new URL('./lipsync-processor.js', import.meta.url).href;
const WASM_URL = new URL('./lipsync.wasm', import.meta.url).href;

const moduleLoads = new WeakMap<AudioContext, Promise<void>>();
const wasmLoads = new Map<string, Promise<ArrayBuffer>>();

function loadWorkletModule(context: AudioContext): Promise<void> {
  const existing = moduleLoads.get(context);
  if (existing) return existing;
  const loading = workletSource().then((url) => context.audioWorklet.addModule(url)).catch((error) => {
    moduleLoads.delete(context);
    throw error;
  });
  moduleLoads.set(context, loading);
  return loading;
}

/** Worklet のソース（先読みしてあればメモリ上の blob URL） */
let workletBlobUrl: Promise<string> | null = null;
function workletSource(): Promise<string> {
  return workletBlobUrl ?? Promise.resolve(WORKLET_URL);
}

function loadWasmBytes(): Promise<ArrayBuffer> {
  const url = WASM_URL;
  const existing = wasmLoads.get(url);
  if (existing) return existing;
  const loading = fetch(url).then(async (response) => {
    if (response.ok === false) throw new Error(`LipSync WASM request failed: ${response.status}`);
    return response.arrayBuffer();
  }).catch((error) => {
    wasmLoads.delete(url);
    throw error;
  });
  wasmLoads.set(url, loading);
  return loading;
}

/** ボイスより先に解析の準備（WASM はメモリへ、Worklet はキャッシュへ）を済ませる */
export async function preloadVoiceAnalyser(): Promise<void> {
  await Promise.all([
    loadWasmBytes(),
    (workletBlobUrl ??= fetch(WORKLET_URL)
      .then(async (res) => {
        if (!res.ok) throw new Error(`LipSync worklet request failed: ${res.status}`);
        return URL.createObjectURL(new Blob([await res.text()], { type: 'text/javascript' }));
      })
      .catch((error) => {
        workletBlobUrl = null;
        throw error;
      })),
  ]).catch((error) => console.warn('口パク解析を先読みできません:', error));
}

export const VOICE_PHONEMES = ['aa', 'ee', 'ih', 'oh', 'ou'] as const;
export type VoicePhoneme = (typeof VOICE_PHONEMES)[number];

export interface VoiceFrame {
  phoneme: VoicePhoneme | 'nn';
  rms: number;
  mouthOpen: number;
}

export interface VoiceAnalysisResult extends VoiceFrame {
  processingTimeMs: number;
  f1: number;
  f2: number;
  distances: Record<VoicePhoneme, number>;
  generation?: number;
}

export interface VoiceAnalyserOptions {
  gender?: 'female' | 'male';
  rmsThreshold?: number;
  holdFrames?: number;
  onAnalysis?: (result: VoiceAnalysisResult) => void;
  onReady?: (ready: boolean) => void;
}

/** 出力音量より前の信号を WASM で解析し、その結果を受け取る。 */
export class VoiceAnalyser {
  public ready = false;
  private worklet: AudioWorkletNode | null = null;
  private silentOutput: GainNode | null = null;
  private latest: VoiceFrame = { phoneme: 'nn', rms: 0, mouthOpen: 0 };
  private generation = 0;
  private disposed = false;
  private gender: 'female' | 'male';

  constructor(
    private readonly context: AudioContext,
    private readonly source: AudioNode,
    private readonly options: VoiceAnalyserOptions = {},
  ) {
    this.gender = options.gender ?? 'female';
    void this.initWorklet();
  }

  getFrame(): VoiceFrame {
    if (!this.ready || this.disposed) return { phoneme: 'nn', rms: 0, mouthOpen: 0 };
    return { ...this.latest };
  }

  reset(): void {
    this.generation++;
    this.latest = { phoneme: 'nn', rms: 0, mouthOpen: 0 };
    this.worklet?.port.postMessage({ type: 'reset', data: { generation: this.generation } });
  }

  setGender(gender: 'female' | 'male'): void {
    this.gender = gender;
    this.worklet?.port.postMessage({ type: 'set-gender', data: { gender } });
  }

  private async initWorklet(): Promise<void> {
    try {
      await loadWorkletModule(this.context);
      if (this.disposed) return;
      const wasmBytes = await loadWasmBytes();
      if (this.disposed) return;
      const worklet = new AudioWorkletNode(this.context, 'lipsync-processor');
      this.worklet = worklet;
      worklet.onprocessorerror = () => {
        if (this.disposed) return;
        this.ready = false;
        this.latest = { phoneme: 'nn', rms: 0, mouthOpen: 0 };
        this.options.onReady?.(false);
      };
      worklet.port.onmessage = (event) => {
        if (this.disposed) return;
        const { type, data, error } = event.data;
        if (type === 'wasm-ready') {
          if (data?.abiVersion !== 2) {
            this.ready = false;
            this.latest = { phoneme: 'nn', rms: 0, mouthOpen: 0 };
            this.options.onReady?.(false);
            console.warn('LipSync AudioWorklet ABI mismatch:', data?.abiVersion);
            return;
          }
          this.ready = true;
          worklet.port.postMessage({ type: 'set-gender', data: { gender: this.gender } });
          worklet.port.postMessage({ type: 'set-rms-threshold', data: { threshold: this.options.rmsThreshold ?? VOICE_SILENCE_RMS } });
          worklet.port.postMessage({ type: 'set-hold-frames', data: { frames: this.options.holdFrames ?? 12 } });
          worklet.port.postMessage({ type: 'reset', data: { generation: this.generation } });
          this.options.onReady?.(true);
        } else if (type === 'wasm-error') {
          this.ready = false;
          this.latest = { phoneme: 'nn', rms: 0, mouthOpen: 0 };
          this.options.onReady?.(false);
          console.warn('LipSync WASM error in AudioWorklet:', error);
        } else if (type === 'analysis-result' && this.ready && data.generation === this.generation) {
          this.latest = {
            phoneme: data.phoneme,
            rms: data.rms,
            mouthOpen: Number.isFinite(data.mouthOpen) ? Math.max(0, Math.min(1, data.mouthOpen)) : 0,
          };
          this.options.onAnalysis?.({ ...data, ...this.latest });
        }
      };
      // 解析専用の出力は消音して接続し、再生経路と独立に Worklet を動かす
      this.silentOutput = this.context.createGain();
      this.silentOutput.gain.value = 0;
      worklet.connect(this.silentOutput);
      this.silentOutput.connect(this.context.destination);
      this.source.connect(worklet);
      worklet.port.postMessage({ type: 'init-wasm', data: { wasmBytes, sampleRate: this.context.sampleRate } });
    } catch (error) {
      if (this.disposed) return;
      this.ready = false;
      this.latest = { phoneme: 'nn', rms: 0, mouthOpen: 0 };
      this.options.onReady?.(false);
      console.warn('Failed to initialize AudioWorklet lipsync:', error);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.ready = false;
    this.reset();
    if (this.worklet) {
      this.source.disconnect(this.worklet);
      this.worklet.port.onmessage = null;
      this.worklet.onprocessorerror = null;
      this.worklet.disconnect();
      this.worklet = null;
    }
    this.silentOutput?.disconnect();
    this.silentOutput = null;
  }
}
