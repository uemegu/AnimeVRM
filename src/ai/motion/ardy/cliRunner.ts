import { ArdyMotionService, type ArdyMotionState } from './ArdyMotionService';
import { MotionEngine, type Recipe } from '../../../motion/engine';
import { createArdySavedMotion } from '../../../motion/createArdySavedMotion';
import { exportFBX } from '../../../motion/fbx';
import type { StructuredMotionResult } from './vendor/motion-data';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { createArdyAnimationClip } from './createArdyAnimationClip';
import { polishClip } from '../quality/polishClip';
import { normalizedClipToMixamo } from '../quality/normalizedClipToMixamo';
import { validateAvatarContactProfile, validateMotionQualityPlan } from '../quality/validate';
import { verifyRoundTripClip } from '../quality/verifyRoundTrip';
import type { AvatarContactProfile, MotionQualityPlan, MotionQualityReport } from '../quality/types';
import { loadMixamoAnimation, releaseMixamoAnimation } from '../../../Avatar';
import { resolveAssetUrl } from '../../../utils/path';
import { addActingDirection } from './prompt';

export interface QualityGenerationOptions {
  plan: MotionQualityPlan;
  avatarUrl: string;
  profile: AvatarContactProfile;
  planner?: { model: string; confidence: Record<string, number>; note: string };
}

export interface GenerateOptions {
  prompt: string;
  actingNote?: string;
  duration?: number;
  format?: 'fbx' | 'saved-motion' | 'raw';
  name?: string;
  quality?: QualityGenerationOptions;
}

export interface GenerateResult {
  format: 'fbx' | 'saved-motion' | 'raw';
  duration: number;
  frameCount: number;
  data: string | object | null; // null means the quality gate refused to export
  sourceMotion?: object;
  qualityReport?: MotionQualityReport;
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
    if (options.quality && format === 'raw') throw new Error('Quality correction cannot be combined with raw output.');
    const name = options.name || options.prompt.slice(0, 30);
    const controller = new AbortController();

    const quality = options.quality ? await this.loadQualityAvatar(options.quality) : null;
    const generationPrompt = addActingDirection(options.prompt, options.actingNote);
    const rawMotion: StructuredMotionResult = await this.service.generate(
      generationPrompt,
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

    const sourceSaved = createArdySavedMotion(rawMotion, this.engine, name);
    let saved = sourceSaved;
    let qualityReport: MotionQualityReport | undefined;
    if (options.quality && quality) {
      const sourceClip = createArdyAnimationClip(rawMotion, quality.vrm);
      const polished = polishClip(sourceClip, quality.vrm, quality.plan, quality.profile);
      qualityReport = {
        version: 1,
        status: polished.status,
        avatarSha256: quality.profile.avatarSha256,
        plan: quality.plan,
        timingSource: quality.plan.timingSource,
        before: polished.before,
        after: polished.after,
        exportRoundTrip: {},
        ...(options.quality.planner ? { planner: options.quality.planner } : {}),
        reasons: [...polished.reasons],
      };
      if (polished.status === 'pass' || polished.status === 'needs-review') {
        saved = normalizedClipToMixamo(polished.clip, quality.vrm, this.engine, saved);
      }
    }
    // Verify the exact exported FBX after importing it through the same retargeter used by gameplay.
    let buffer: ArrayBuffer | null = null;
    if (format === 'fbx' || qualityReport) {
      this.engine.registerSaved(saved);
      const recipe: Recipe = {
        version: 1,
        duration: saved.duration,
        fps: 30,
        layers: [{
          id: 'generated_layer', source: saved.id, mask: '全身', weight: 1,
          start: 0, duration: saved.duration, speed: 1, from: 0,
          to: Math.floor(saved.duration * 30), fade: 0, loop: false, enabled: true,
        }],
      };
      try {
        buffer = exportFBX(this.engine, recipe);
      } finally {
        this.engine.removeSaved(saved.id);
      }
    }

    if (qualityReport && quality && buffer && (qualityReport.status === 'pass' || qualityReport.status === 'needs-review')) {
      const blobUrl = URL.createObjectURL(new Blob([buffer]));
      try {
        const reloadedClip = await loadMixamoAnimation(blobUrl, quality.vrm);
        qualityReport.exportRoundTrip = verifyRoundTripClip(reloadedClip, quality.vrm, quality.plan, quality.profile);
        const failedMetric = Object.entries(qualityReport.exportRoundTrip).find(([, metric]) => metric.passed === false);
        if (failedMetric) {
          qualityReport.status = 'failed';
          qualityReport.reasons.push(`FBX export/reload failed ${failedMetric[0]} threshold at frame ${failedMetric[1].worstFrame ?? 'unknown'}.`);
        } else if (!Object.keys(qualityReport.exportRoundTrip).length && qualityReport.status === 'pass') {
          qualityReport.status = 'failed';
          qualityReport.reasons.push('FBX export/reload produced no contact metrics.');
        }
      } catch (error) {
        qualityReport.status = 'failed';
        qualityReport.reasons.push('FBX export/reload verification failed: ' + (error instanceof Error ? error.message : String(error)));
      } finally {
        releaseMixamoAnimation(blobUrl, quality.vrm);
        URL.revokeObjectURL(blobUrl);
      }
    }

    if (format === 'saved-motion') {
      return {
        format: 'saved-motion', duration: saved.duration, frameCount: rawMotion.frameCount,
        data: qualityReport && (qualityReport.status === 'failed' || qualityReport.status === 'unsupported') ? null : saved,
        ...(qualityReport ? { sourceMotion: sourceSaved } : {}),
        ...(qualityReport ? { qualityReport } : {}),
      };
    }

    const base64 = this.arrayBufferToBase64(buffer!);

    return {
      format: 'fbx',
      duration: saved.duration,
      frameCount: rawMotion.frameCount,
      data: qualityReport && (qualityReport.status === 'failed' || qualityReport.status === 'unsupported') ? null : base64,
      ...(qualityReport ? { sourceMotion: sourceSaved } : {}),
      ...(qualityReport ? { qualityReport } : {}),
    };
  }

  private async loadQualityAvatar(options: QualityGenerationOptions): Promise<{
    vrm: VRM;
    plan: MotionQualityPlan;
    profile: AvatarContactProfile;
  }> {
    const plan = validateMotionQualityPlan(options.plan);
    const profile = validateAvatarContactProfile(options.profile);
    const avatarUrl = new URL(resolveAssetUrl(options.avatarUrl), window.location.href);
    const response = await fetch(avatarUrl, { cache: 'force-cache' });
    if (!response.ok) throw new Error('Could not load the quality target VRM (' + response.status + ').');
    const bytes = await response.arrayBuffer();
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const actualHash = [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
    if (actualHash !== profile.avatarSha256.toLowerCase()) {
      throw new Error('The contact profile hash does not match the requested VRM.');
    }
    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));
    const gltf = await loader.parseAsync(bytes, new URL('.', avatarUrl).href);
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) throw new Error('The requested file does not contain a VRM avatar.');
    VRMUtils.rotateVRM0(vrm);
    return { vrm, plan, profile };
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
