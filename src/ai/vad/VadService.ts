import { MicVAD, utils } from '@ricky0123/vad-web';

export interface VadCallbacks {
  onSpeechStart?: () => void;
  onSpeechEnd?: (wavBlob: Blob, wavBuffer: ArrayBuffer) => void;
  onVADMisfire?: () => void;
  onError?: (err: Error | string) => void;
}

export class VadService {
  private micVad: MicVAD | null = null;
  private isListening = false;
  private callbacks: VadCallbacks;

  constructor(callbacks: VadCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: VadCallbacks): void {
    this.callbacks = callbacks;
  }

  public get listening(): boolean {
    return this.isListening;
  }

  public async start(): Promise<void> {
    if (this.isListening) return;

    try {
      if (!this.micVad) {
        const vadBasePath = `${import.meta.env.BASE_URL}vad/`;
        // onnxruntime-web dynamically imports .mjs which Vite forbids from /public.
        // Using CDN for onnxWASMBasePath cleanly bypasses Vite's module transform restriction.
        const onnxWasmCdn = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/';
        console.log('[VadService] Initializing MicVAD with baseAssetPath:', vadBasePath, 'onnxWASMBasePath:', onnxWasmCdn);
        this.micVad = await MicVAD.new({
          baseAssetPath: vadBasePath,
          onnxWASMBasePath: onnxWasmCdn,
          processorType: 'auto',
          onSpeechStart: () => {
            console.log('[VadService] Speech start detected');
            this.callbacks.onSpeechStart?.();
          },
          onSpeechEnd: (audio: Float32Array) => {
            console.log('[VadService] Speech end detected, sample count:', audio.length);
            try {
              const wavBuffer = utils.encodeWAV(audio);
              const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
              this.callbacks.onSpeechEnd?.(wavBlob, wavBuffer);
            } catch (encodeErr: any) {
              console.error('[VadService] encodeWAV error:', encodeErr);
              this.callbacks.onError?.(encodeErr);
            }
          },
          onVADMisfire: () => {
            console.log('[VadService] VAD misfire (speech too short)');
            this.callbacks.onVADMisfire?.();
          },
        });
      }

      await this.micVad.start();
      this.isListening = true;
      console.log('[VadService] VAD listening started');
    } catch (err: any) {
      console.error('[VadService] Start error:', err);
      this.isListening = false;
      this.callbacks.onError?.(err?.message || String(err));
      throw err;
    }
  }

  public async pause(): Promise<void> {
    if (!this.micVad || !this.isListening) return;
    try {
      await this.micVad.pause();
      this.isListening = false;
      console.log('[VadService] VAD listening paused');
    } catch (err: any) {
      console.error('[VadService] Pause error:', err);
      this.callbacks.onError?.(err?.message || String(err));
    }
  }

  public async destroy(): Promise<void> {
    if (this.micVad) {
      try {
        await this.micVad.pause();
      } catch {
        // ignore
      }
      this.micVad = null;
      this.isListening = false;
    }
  }
}
