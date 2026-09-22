import type { WorkerCommand, WorkerEvent, ProgressEvent } from './vendor/runtime/protocol';
import type { BrowserModelManifest } from './vendor/runtime/manifest';
import type { RuntimeTimings } from './vendor/runtime/engine';
import { normalizeStructuredMotion, type StructuredMotionResult } from './vendor/motion-data';

export const ARDY_MODEL_REVISION = '1c21362effeecec0454bfc0d818661525ae6b387';
export const ARDY_MODEL_BASE_URL = `https://huggingface.co/intsuc/Llama-3-ARDY-Mini-Core40-Browser/resolve/${ARDY_MODEL_REVISION}/`;
export const ARDY_MODEL_TERMS_URL = `https://huggingface.co/intsuc/Llama-3-ARDY-Mini-Core40-Browser/blob/${ARDY_MODEL_REVISION}/MODEL_TERMS.md`;
export type ArdyMotionState = 'unloaded' | 'loading' | 'ready' | 'generating' | 'error';

interface PendingRequest {
  resolve: (event: WorkerEvent) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** The large runtime and model are loaded only after the user enables ARDY. */
export class ArdyMotionService {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRequest>();
  private manifest: BrowserModelManifest | null = null;
  private loading: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private epoch = 0;

  constructor(private onState: (state: ArdyMotionState, detail?: string) => void = () => {}) {}

  public get ready(): boolean { return this.manifest !== null; }

  public initialize(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = this.load().finally(() => { this.loading = null; });
    return this.loading;
  }

  private async load(): Promise<void> {
    const epoch = this.epoch;
    this.onState('loading');
    try {
      if (!globalThis.isSecureContext || !('gpu' in navigator)) {
        throw new Error('ardy-mini requires WebGPU and HTTPS or localhost.');
      }
      this.worker = new Worker(new URL('./vendor/inference.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }: MessageEvent<WorkerEvent>) => this.handleEvent(data);
      this.worker.onerror = (event) => this.fail(new Error(event.message || 'ardy-mini worker failed'));
      this.worker.onmessageerror = () => this.fail(new Error('ardy-mini worker message could not be read'));
      const capabilities = await this.request({ type: 'getWebGpuCapabilities', requestId: crypto.randomUUID() });
      if (capabilities.type !== 'webGpuCapabilities') throw new Error('Invalid WebGPU capabilities');
      const loaded = await this.request({
        type: 'loadModel', requestId: crypto.randomUUID(),
        baseUrl: `${ARDY_MODEL_BASE_URL}${capabilities.shaderF16 ? 'fp16' : 'fp32'}/`,
      }, 20 * 60_000);
      if (loaded.type !== 'modelLoaded') throw new Error('Invalid ardy-mini model response');
      this.manifest = loaded.model.manifest;
      this.onState('ready');
    } catch (error) {
      if (epoch === this.epoch) this.fail(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public generate(prompt: string, duration: number, signal: AbortSignal): Promise<StructuredMotionResult> {
    const queuedAt = performance.now();
    // A cancelled inference must drain before another request reaches the worker.
    const operation = this.queue.catch(() => {}).then(async () => {
      signal.throwIfAborted();
      if (!this.manifest) throw new Error('Load ardy-mini before generating motion.');
      if (!prompt.trim() || prompt.length > 512) throw new Error('Motion prompt must contain 1–512 characters.');
      if (!Number.isFinite(duration) || duration < 2 || duration > 8) throw new Error('Motion duration must be 2–8 seconds.');
      const requestId = crypto.randomUUID();
      const startedAt = performance.now();
      const modelVariant = this.manifest.model?.variant ?? null;
      let receivedAt: number | undefined;
      let runtimeTimings: RuntimeTimings | undefined;
      let frameCount = 0;
      let motionSeconds = 0;
      let normalizeMs = 0;
      let status: 'success' | 'cancelled' | 'error' = 'error';
      const cancel = () => this.worker?.postMessage({ type: 'cancel', requestId: crypto.randomUUID(), targetRequestId: requestId });
      signal.addEventListener('abort', cancel, { once: true });
      this.onState('generating', prompt);
      try {
        const result = await this.request({
          type: 'generate', requestId, mode: 'replace', prompt: prompt.trim(),
          durationSeconds: duration, seed: crypto.randomUUID(), cfgWeight: 3.5, historyFrames: 40,
          initialTranslation: new Float32Array(3), initialHeading: 0,
        }, 180_000);
        receivedAt = performance.now();
        signal.throwIfAborted();
        if (result.type !== 'generationComplete') throw new Error('Invalid ardy-mini generation response');
        runtimeTimings = result.result.timingsMs;
        frameCount = result.result.frameCount;
        motionSeconds = frameCount / result.result.fps;
        const normalizeStartedAt = performance.now();
        const motion = normalizeStructuredMotion(result.result, { skeleton: this.manifest!.skeleton });
        normalizeMs = performance.now() - normalizeStartedAt;
        status = 'success';
        return motion;
      } catch (error) {
        status = signal.aborted || (error instanceof Error && error.name === 'AbortError') ? 'cancelled' : 'error';
        throw error;
      } finally {
        const finishedAt = performance.now();
        const round = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
        const inferenceMs = runtimeTimings?.total;
        console.debug('[ardy-mini] generation timing', {
          requestId, status, prompt, modelVariant, requestedSeconds: duration,
          frameCount, motionSeconds: round(motionSeconds),
          queueMs: round(startedAt - queuedAt), wallMs: round(finishedAt - queuedAt),
          workerRoundTripMs: round((receivedAt ?? finishedAt) - startedAt), normalizeMs: round(normalizeMs),
          inferenceMs: round(inferenceMs), textEncodeMs: round(runtimeTimings?.text),
          denoiseMs: round(runtimeTimings?.denoising), decodeMs: round(runtimeTimings?.decoding),
          framesPerSecond: round(inferenceMs && inferenceMs > 0 ? frameCount * 1000 / inferenceMs : undefined),
          realTimeFactor: round(inferenceMs !== undefined && motionSeconds > 0 ? inferenceMs / (motionSeconds * 1000) : undefined),
        });
        signal.removeEventListener('abort', cancel);
        if (this.ready) this.onState('ready');
      }
    });
    this.queue = operation;
    return operation;
  }

  private request(command: WorkerCommand, timeout = 30_000): Promise<WorkerEvent> {
    return new Promise((resolve, reject) => {
      if (!this.worker) { reject(new Error('ardy-mini worker is unavailable')); return; }
      const timer = setTimeout(() => this.fail(new Error('ardy-mini timed out. Reload the model to retry.')), timeout);
      this.pending.set(command.requestId, { resolve, reject, timer });
      this.worker.postMessage(command);
    });
  }

  private handleEvent(event: WorkerEvent): void {
    if (event.type === 'workerReady' || event.type === 'generationChunk') return;
    if (event.type === 'progress') {
      if (this.pending.has(event.requestId)) this.reportProgress(event);
      return;
    }
    const id = event.type === 'cancelled' ? event.targetRequestId : event.requestId;
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    if (event.type === 'error') pending.reject(new Error(event.error.message));
    else if (event.type === 'cancelled') pending.reject(new DOMException('Motion generation cancelled', 'AbortError'));
    else pending.resolve(event);
  }

  private reportProgress(event: ProgressEvent): void {
    const percent = event.total > 0 ? Math.round(event.completed / event.total * 100) : 0;
    this.onState(this.ready ? 'generating' : 'loading', `${event.stage}: ${percent}%`);
  }

  private fail(error: Error): void {
    this.dispose(error);
    this.onState('error', error.message);
  }

  public dispose(reason: Error = new DOMException('ardy-mini stopped', 'AbortError')): void {
    this.epoch++;
    this.worker?.terminate();
    this.worker = null;
    this.manifest = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(reason);
    }
    this.pending.clear();
    this.onState('unloaded');
  }
}
