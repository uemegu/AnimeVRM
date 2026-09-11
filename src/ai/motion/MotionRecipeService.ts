import { MotionEngine, type Recipe, type Layer } from '../../motion/engine';
import { exportFBX } from '../../motion/fbx';
import { GeneratedMotionRecipe } from '../gemini/GeminiApiService';

export class MotionRecipeService {
  private engine: MotionEngine;
  private isInitialized = false;
  private activeBlobUrls: string[] = [];

  constructor() {
    this.engine = new MotionEngine();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      console.log('[MotionRecipeService] Initializing MotionEngine...');
      await this.engine.init();
      this.isInitialized = true;
      console.log('[MotionRecipeService] MotionEngine ready');
    } catch (err) {
      console.error('[MotionRecipeService] Init error:', err);
      throw err;
    }
  }

  /**
   * Build an FBX Animation Blob URL from a GeneratedMotionRecipe
   */
  public async bakeMotionToFBXUrl(recipeDef: GeneratedMotionRecipe): Promise<{
    blobUrl: string;
    duration: number;
    layerSummary: string[];
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const duration = Math.max(1.0, Math.min(15.0, recipeDef.duration || 3.0));
    const validLayers: Layer[] = [];
    const layerSummary: string[] = [];

    // Load any required sources
    for (const l of recipeDef.layers || []) {
      if (!l.source) continue;
      try {
        await this.engine.load(l.source);
        const maxFrames = this.engine.frames(l.source);
        const start = Math.max(0, Math.min(duration - 0.1, l.start || 0));
        const layerDuration = Math.max(0.2, Math.min(duration - start, l.duration || (duration - start)));
        const from = Math.max(0, Math.min(maxFrames - 1, Math.round(l.from ?? 0)));
        const to = Math.max(from + 1, Math.min(maxFrames, Math.round(l.to ?? maxFrames)));
        const speed = Math.max(0.2, Math.min(3.0, l.speed ?? 1.0));
        const fade = Math.max(0, Math.min(1.0, l.fade ?? 0.3));
        const loop = Boolean(l.loop);
        const envelope: 'flat' | 'sine' = l.envelope === 'sine' ? 'sine' : 'flat';
        const poseMode: 'motion' | 'hold' = l.poseMode === 'hold' ? 'hold' : 'motion';
        const repeatEvery = l.repeatEvery && l.repeatEvery >= layerDuration ? l.repeatEvery : undefined;
        
        validLayers.push({
          id: crypto.randomUUID(),
          source: l.source,
          mask: l.mask || '全身',
          weight: Math.max(0, Math.min(1, l.weight ?? 0.8)),
          start,
          duration: layerDuration,
          speed,
          from,
          to,
          fade,
          loop,
          enabled: true,
          repeatEvery,
          envelope,
          poseMode,
        });

        const timeRange = `${start.toFixed(1)}~${(start + layerDuration).toFixed(1)}s`;
        const tags: string[] = [];
        if (poseMode === 'hold') tags.push('hold');
        if (speed !== 1.0) tags.push(`${speed}x`);
        if (from > 0 || to < maxFrames) tags.push(`${from}-${to}f`);
        if (repeatEvery) tags.push(`rep:${repeatEvery}s`);
        const tagStr = tags.length > 0 ? ` (${tags.join(', ')})` : '';

        layerSummary.push(`${l.source} [${timeRange}] ${l.mask}:${Math.round((l.weight ?? 0.8) * 100)}%${tagStr}`);
      } catch (loadErr) {
        console.warn(`[MotionRecipeService] Could not load motion source '${l.source}':`, loadErr);
      }
    }

    const recipe: Recipe = {
      version: 1,
      duration,
      fps: 30,
      loop: false,
      layers: validLayers,
    };

    console.log('[MotionRecipeService] Exporting FBX for recipe:', recipe);
    const fbxBuffer = exportFBX(this.engine, recipe);
    const blob = new Blob([fbxBuffer], { type: 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);

    this.activeBlobUrls.push(blobUrl);
    // Keep only last 10 blob URLs in memory
    if (this.activeBlobUrls.length > 10) {
      const oldUrl = this.activeBlobUrls.shift();
      if (oldUrl) URL.revokeObjectURL(oldUrl);
    }

    return {
      blobUrl,
      duration,
      layerSummary,
    };
  }

  public dispose(): void {
    for (const url of this.activeBlobUrls) {
      URL.revokeObjectURL(url);
    }
    this.activeBlobUrls = [];
  }
}
