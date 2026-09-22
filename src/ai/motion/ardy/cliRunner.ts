import { ArdyMotionService, type ArdyMotionState } from './ArdyMotionService';
import { MotionEngine, type Recipe } from '../../../motion/engine';
import { createArdySavedMotion } from '../../../motion/createArdySavedMotion';
import { exportFBX } from '../../../motion/fbx';
import type { StructuredMotionResult } from './vendor/motion-data';

export interface GenerateOptions {
  prompt: string;
  duration?: number;
  format?: 'fbx' | 'saved-motion' | 'raw';
  name?: string;
}

export interface GenerateResult {
  format: 'fbx' | 'saved-motion' | 'raw';
  duration: number;
  frameCount: number;
  data: string | object; // base64 string for fbx, object for json
}

export interface ArdyStatus {
  state: ArdyMotionState;
  detail: string;
  ready: boolean;
  error?: string;
}

class ArdyCliRunner {
  private service: ArdyMotionService;
  private engine: MotionEngine | null = null;
  public status: ArdyStatus = {
    state: 'unloaded',
    detail: '',
    ready: false,
  };

  constructor() {
    this.service = new ArdyMotionService((state, detail) => {
      this.status.state = state;
      this.status.detail = detail ?? '';
      if (state === 'ready') this.status.ready = true;
    });
  }

  async init(): Promise<void> {
    try {
      this.status.detail = 'Initializing MotionEngine base rig...';
      this.engine = new MotionEngine();
      await this.engine.init();

      this.status.detail = 'Loading ardy-mini AI model...';
      await this.service.initialize();
      this.status.ready = true;
      this.status.detail = 'Ready';
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.status.state = 'error';
      this.status.error = errorMsg;
      throw err;
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (!this.status.ready || !this.engine) {
      throw new Error('ArdyCliRunner is not ready. Call init() first.');
    }

    const duration = options.duration ?? 4;
    const format = options.format ?? 'fbx';
    const name = options.name || options.prompt.slice(0, 30);
    const controller = new AbortController();

    const rawMotion: StructuredMotionResult = await this.service.generate(
      options.prompt,
      duration,
      controller.signal
    );

    if (format === 'raw') {
      return {
        format: 'raw',
        duration: rawMotion.frameCount / rawMotion.fps,
        frameCount: rawMotion.frameCount,
        data: rawMotion,
      };
    }

    const saved = createArdySavedMotion(rawMotion, this.engine, name);
    if (format === 'saved-motion') {
      return {
        format: 'saved-motion',
        duration: saved.duration,
        frameCount: rawMotion.frameCount,
        data: saved,
      };
    }

    // Default: 'fbx'
    this.engine.registerSaved(saved);
    const recipe: Recipe = {
      version: 1,
      duration: saved.duration,
      fps: 30,
      layers: [
        {
          id: 'generated_layer',
          source: saved.id,
          mask: '全身',
          weight: 1,
          start: 0,
          duration: saved.duration,
          speed: 1,
          from: 0,
          to: Math.floor(saved.duration * 30),
          fade: 0,
          loop: false,
          enabled: true,
        },
      ],
    };

    const buffer = exportFBX(this.engine, recipe);
    const base64 = this.arrayBufferToBase64(buffer);

    return {
      format: 'fbx',
      duration: saved.duration,
      frameCount: rawMotion.frameCount,
      data: base64,
    };
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000; // 32KB chunks to avoid stack overflow
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
  }
}

// Attach to window for Playwright evaluate
const runner = new ArdyCliRunner();
(window as unknown as { __ardy: ArdyCliRunner }).__ardy = runner;
