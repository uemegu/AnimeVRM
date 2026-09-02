import { AutoTokenizer } from '@huggingface/transformers';
import * as ortWebgpu from 'onnxruntime-web/webgpu';
import { resolveAssetUrl } from '../utils/path';
import { EncodedSpeaker, IrodoriTTS, encodeWav } from './irodori/pipeline';

export { encodeWav } from './irodori/pipeline';

const SR = 48000;
const CACHE_NAME = 'irodori-tts-models-v2';
const HF_BASE = 'https://huggingface.co/noguchis/irodori-tts-onnx/resolve/main/onnx_fp16';

let cachedOrt: any = null;
let cachedGpuAdapter: GPUAdapter | null = null;

async function getGpuAdapter(ort: any): Promise<GPUAdapter> {
  if (cachedGpuAdapter) return cachedGpuAdapter;

  // Select the adapter, but deliberately let ORT create and own the GPUDevice.
  // Passing a user-created device to ORT Web 1.29 breaks synchronous GPU output
  // downloads (microsoft/onnxruntime#32257: "Failed to wait ...:3").
  const adapter =
    (ort.env.webgpu.adapter as GPUAdapter | null | undefined) ||
    (await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
      forceFallbackAdapter: false,
    })) ||
    (await navigator.gpu.requestAdapter({ forceFallbackAdapter: false }));

  if (!adapter) {
    throw new Error(
      'WebGPU アダプタを取得できませんでした。chrome://gpu で WebGPU が Hardware accelerated か確認してください。'
    );
  }
  if (!adapter.features.has('shader-f16')) {
    throw new Error(
      '選択されたWebGPUアダプタは shader-f16 をサポートしていません。Irodori-TTSのFP16モデルを実行できません。'
    );
  }

  // ORT will request its own device from this adapter with shader-f16,
  // subgroups, appropriate limits, and its required timed-wait instance.
  ort.env.webgpu.adapter = adapter;

  const info = adapter.info;
  console.log('[IrodoriTTSService] WebGPU adapter:', {
    vendor: info?.vendor || 'unknown',
    architecture: info?.architecture || 'unknown',
    device: info?.device || 'unknown',
    description: info?.description || 'unknown',
    shaderF16: adapter.features.has('shader-f16'),
    subgroups: adapter.features.has('subgroups'),
    deviceOwner: 'onnxruntime',
  });

  cachedGpuAdapter = adapter;
  return adapter;
}

async function getOrtWebgpu(): Promise<any> {
  if (!cachedOrt) {
    cachedOrt = ortWebgpu;
    cachedOrt.env.logLevel = 'error';
    cachedOrt.env.webgpu.powerPreference = 'high-performance';
    cachedOrt.env.webgpu.forceFallbackAdapter = false;
    cachedOrt.env.webgpu.validateInputContent = false;
    console.log('[IrodoriTTSService] Loaded bundled ONNX Runtime WebGPU 1.29.x');
  }

  await getGpuAdapter(cachedOrt);
  return cachedOrt;
}

export async function audioBufferToMono48k(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  const decoded = await ctx.decodeAudioData(arrayBuffer);
  await ctx.close();

  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * SR), SR);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return rendered.getChannelData(0).slice();
}

async function fetchCachedModelFile(url: string, onProgress?: (msg: string) => void): Promise<Uint8Array> {
  const useCache = 'caches' in globalThis;
  if (!useCache) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  const store = await caches.open(CACHE_NAME);
  let res = await store.match(url);
  if (!res) {
    const filename = url.split('/').pop() || 'model';
    onProgress?.(`ダウンロード中: ${filename}`);
    const net = await fetch(url);
    if (!net.ok) throw new Error(`fetch ${url}: ${net.status}`);
    await store.put(url, net.clone());
    res = net;
  }
  return new Uint8Array(await res.arrayBuffer());
}

export class IrodoriTTSService {
  private ttsPipeline: IrodoriTTS | null = null;
  private refWav48k: Float32Array | null = null;
  private refSpeaker: EncodedSpeaker | null = null;
  private isLoaded = false;
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;

  public async load(onProgress?: (msg: string) => void): Promise<void> {
    if (this.isLoaded && this.ttsPipeline) return;
    if (this.loadPromise) return this.loadPromise;

    if (!navigator.gpu) {
      throw new Error(
        'この機能を利用するにはWebGPU対応ブラウザが必要です。Chrome最新版を使用してください。'
      );
    }

    this.loadPromise = this.loadOnce(onProgress);
    try {
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  private async loadOnce(onProgress?: (msg: string) => void): Promise<void> {
    this.isLoading = true;
    const t0 = performance.now();
    onProgress?.('Irodori-TTS (WebGPU) をロード中...');

    try {
      const ort = await getOrtWebgpu();

      // 1. Tokenizer
      onProgress?.('Tokenizerをロード中...');
      const tokenizer = await AutoTokenizer.from_pretrained('llm-jp/llm-jp-3-1.8b');

      // 2. Models from Hugging Face
      const models = [
        { key: 'text', name: 'text_encoder' },
        { key: 'speaker', name: 'speaker_encoder' },
        { key: 'duration', name: 'duration' },
        { key: 'dit', name: 'dit' },
        { key: 'dac', name: 'dacvae_decoder' },
        { key: 'enc', name: 'dacvae_encoder' },
      ];

      const sessions: Record<string, any> = {};

      for (const m of models) {
        onProgress?.(`ONNXモデルロード中: ${m.name}...`);
        const [modelBytes, dataBytes] = await Promise.all([
          fetchCachedModelFile(`${HF_BASE}/${m.name}.onnx`, onProgress),
          fetchCachedModelFile(`${HF_BASE}/${m.name}.onnx.data`, onProgress),
        ]);

        const sessionOptions = {
          // Do not pass a custom GPUDevice here. ORT must own device creation
          // for its WebGPU synchronous download path to work correctly.
          executionProviders: ['webgpu'],
          graphOptimizationLevel: 'all',
          externalData: [{ path: `${m.name}.onnx.data`, data: dataBytes }],
        };

        sessions[m.key] = await ort.InferenceSession.create(modelBytes, sessionOptions);
      }

      // 3. Instantiate IrodoriTTS pipeline
      this.ttsPipeline = new IrodoriTTS({ ort, sessions, tokenizer });

      // 4. Reference Voice (/voices/001.wav)
      onProgress?.('Reference Voice (/voices/001.wav) をロード中...');
      const refUrl = resolveAssetUrl('/voices/001.wav');
      const refRes = await fetch(refUrl);
      if (!refRes.ok) {
        throw new Error(`Failed to load reference voice from ${refUrl}`);
      }
      const refBuf = await refRes.arrayBuffer();
      this.refWav48k = await audioBufferToMono48k(refBuf);

      onProgress?.('Reference Voice の特徴量をキャッシュ中...');
      const speakerT0 = performance.now();
      this.refSpeaker = await this.ttsPipeline.prepareSpeaker(this.refWav48k, SR);
      console.log(
        `[TTS] reference conditioning: ${(performance.now() - speakerT0).toFixed(1)} ms (cached)`
      );

      // 5. Warm up both graph shapes used by the RF loop. With 2 steps the
      // first iteration is CFG batch=3 and the second is batch=1.
      onProgress?.('WebGPUシェーダーを最適化中 (Warmup)...');
      try {
        await this.ttsPipeline.synthesizePrepared('あ', this.refSpeaker, {
          numSteps: 2,
          seconds: 0.5,
        });
        console.log('[IrodoriTTSService] WebGPU warmup completed successfully.');
      } catch (warmupErr) {
        console.warn('[IrodoriTTSService] Warmup skipped/errored:', warmupErr);
      }

      this.isLoaded = true;
      const loadTime = performance.now() - t0;
      console.log(`[TTS] load & warmup complete: ${loadTime.toFixed(1)} ms`);
    } finally {
      this.isLoading = false;
    }
  }

  public get ready(): boolean {
    return this.isLoaded && this.ttsPipeline !== null && this.refSpeaker !== null;
  }

  public async synthesize(
    text: string,
    opts: {
      numSteps?: number;
      seed?: number;
      durationScale?: number;
      onProgress?: (pct: number, step: number, total: number) => void;
    } = {}
  ): Promise<{ audio: Float32Array; sampleRate: number; wavBlob: Blob; durationSec: number; ttsMs: number }> {
    if (!this.ready || !this.ttsPipeline || !this.refSpeaker) {
      throw new Error('Irodori-TTS is not ready');
    }

    const t0 = performance.now();
    const steps = opts.numSteps ?? 8;
    const stepTimes: number[] = [];
    const { audio, sampleRate, seqLen } = await this.ttsPipeline.synthesizePrepared(
      text,
      this.refSpeaker,
      {
        numSteps: steps,
        seed: opts.seed ?? 0,
        durationScale: opts.durationScale ?? 1.0,
        onStep: (step, total, stepMs) => {
          stepTimes.push(stepMs);
          const pct = Math.round((step / total) * 100);
          opts.onProgress?.(pct, step, total);
        },
      }
    );

    const ttsMs = performance.now() - t0;
    const durationSec = audio.length / sampleRate;
    const rtf = (ttsMs / 1000) / durationSec;
    const avgStepMs = stepTimes.length
      ? stepTimes.reduce((sum, ms) => sum + ms, 0) / stepTimes.length
      : 0;
    console.log(`[Chat] TTS: ${ttsMs.toFixed(1)} ms (seqLen=${seqLen}, ${durationSec.toFixed(2)}s audio, RTF ${rtf.toFixed(2)}x)`);
    console.log(`[Chat] TTS RF average: ${avgStepMs.toFixed(1)} ms/step (${steps} steps)`);
    if (avgStepMs > 1000) {
      console.warn(
        '[Chat] TTS WebGPU is unexpectedly slow (>1s/step). Check the logged adapter and chrome://gpu; software WebGPU or GPU contention is likely.'
      );
    }

    const wavBlob = encodeWav(audio, sampleRate);
    return { audio, sampleRate, wavBlob, durationSec, ttsMs };
  }
}
