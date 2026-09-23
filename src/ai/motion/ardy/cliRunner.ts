import { ARDY_DEFAULT_CFG_WEIGHT, ArdyMotionService, type ArdyMotionState } from './ArdyMotionService';
import { rankArdyCandidates, scoreArdyMotion, type ArdyMotionScore } from './scoreMotion';
import { MotionEngine, type Recipe, type SavedMotion } from '../../../motion/engine';
import { createArdySavedMotion } from '../../../motion/createArdySavedMotion';
import { exportFBX } from '../../../motion/fbx';
import type { StructuredMotionResult } from './vendor/motion-data';
import type { AnimationClip } from 'three';
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
import { renderMotionPreview } from './previewMotion';
import { fitHandsToAvatar } from './fitHandsToAvatar';
import { loopSavedMotion, styleMotion, styleSavedHips, validateMotionStyle, type MotionStyle } from './styleMotion';

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
  /** Seeds generated per CFG weight; the best-scoring candidate becomes the output. */
  candidates?: number;
  /** Base seed. With one candidate it is used as is, otherwise each candidate appends -1, -2, ... */
  seed?: string;
  /** Every seed is generated at each weight so the weights can be compared fairly. */
  cfgWeights?: number[];
  /** Candidates returned as files, best first, including the output itself. */
  keep?: number;
  /** Same-origin VRM URL the motion is baked for. Required for avatar fitting and previews. */
  avatarUrl?: string;
  /** Render a PNG contact sheet of each written motion through the game's importer. */
  preview?: boolean;
  /** Refit the palms to the avatar's torso (default true when an avatar is given). */
  fitHands?: boolean;
  /** Leg locking and motion size; needs an avatar. */
  style?: MotionStyle;
  /** Ease the end into the first pose so the motion repeats without a jump. */
  loop?: boolean;
}

export interface CandidateSummary {
  rank: number;
  seed: string;
  cfgWeight: number;
  lowActivity: boolean;
  score: ArdyMotionScore;
}

export interface GenerateResult {
  format: 'fbx' | 'saved-motion' | 'raw';
  duration: number;
  frameCount: number;
  data: string | object | null; // null means the quality gate refused to export
  sourceMotion?: object;
  qualityReport?: MotionQualityReport;
  /** All generated candidates, best first. The output is rank 1. */
  candidates: CandidateSummary[];
  /** Ranks 2 and later kept for review, exported without contact correction. */
  alternates: { rank: number; data: string | object; preview?: string }[];
  /** Base64 PNG contact sheet of the output. */
  preview?: string;
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
  private fitHands = true;
  private style: MotionStyle = {};
  private loop = false;
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
    const avatarUrl = options.quality?.avatarUrl ?? options.avatarUrl;
    const avatar = quality?.vrm ?? (avatarUrl ? (await this.loadAvatar(avatarUrl)).vrm : null);
    this.fitHands = options.fitHands ?? true;
    this.style = options.style ?? {};
    this.loop = options.loop ?? false;
    validateMotionStyle(this.style);
    if ((this.style.lockLegs || (this.style.amplitude ?? 1) !== 1) && !avatar) throw new Error('--lock-legs and --amplitude need --avatar.');
    if (options.preview && !avatar) throw new Error('Previews need --avatar.');
    if (options.preview && format !== 'fbx') throw new Error('Previews are rendered from FBX output only.');
    const generationPrompt = addActingDirection(options.prompt, options.actingNote);
    const count = options.candidates ?? 1;
    if (!Number.isInteger(count) || count < 1 || count > 32) throw new Error('Candidates must be an integer from 1 to 32.');
    const cfgWeights = options.cfgWeights?.length ? options.cfgWeights : [ARDY_DEFAULT_CFG_WEIGHT];
    if (cfgWeights.some(weight => !Number.isFinite(weight) || weight < 0 || weight > 20)) throw new Error('CFG weights must be between 0 and 20.');
    const baseSeed = options.seed ?? crypto.randomUUID().slice(0, 8);
    const generated: { seed: string; cfgWeight: number; motion: StructuredMotionResult; score: ArdyMotionScore }[] = [];
    for (const cfgWeight of cfgWeights) {
      for (let i = 1; i <= count; i++) {
        const seed = count === 1 ? baseSeed : `${baseSeed}-${i}`;
        const motion = await this.service.generate(generationPrompt, duration, controller.signal, { seed, cfgWeight });
        generated.push({ seed, cfgWeight, motion, score: scoreArdyMotion(motion) });
      }
    }
    const ranked = rankArdyCandidates(generated);
    const candidates: CandidateSummary[] = ranked.map(({ seed, cfgWeight, lowActivity, score }, index) => ({
      rank: index + 1, seed, cfgWeight, lowActivity, score,
    }));
    const rawMotion = ranked[0].motion;
    const keep = Math.min(ranked.length, options.keep ?? (ranked.length > 1 ? 3 : 1));
    const alternates: GenerateResult['alternates'] = [];
    for (const [index, { motion }] of ranked.slice(1, keep).entries()) {
      if (format === 'raw') {
        alternates.push({ rank: index + 2, data: motion });
        continue;
      }
      const alternate = this.bake(motion, name, avatar);
      if (format === 'saved-motion') {
        alternates.push({ rank: index + 2, data: alternate });
        continue;
      }
      const fbx = this.exportSaved(alternate);
      alternates.push({
        rank: index + 2, data: this.arrayBufferToBase64(fbx),
        ...(options.preview ? { preview: await renderMotionPreview(fbx, avatar!) } : {}),
      });
    }

    if (format === 'raw') {
      return {
        format: 'raw',
        duration: rawMotion.frameCount / rawMotion.fps,
        frameCount: rawMotion.frameCount,
        data: rawMotion,
        candidates, alternates,
      };
    }

    const sourceSaved = createArdySavedMotion(rawMotion, this.engine, name);
    let saved = this.bake(rawMotion, name, avatar);
    let qualityReport: MotionQualityReport | undefined;
    if (options.quality && quality) {
      const sourceClip = this.avatarClip(rawMotion, quality.vrm);
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
        if (this.loop) saved = loopSavedMotion(saved);
      }
    }
    // Verify the exact exported FBX after importing it through the same retargeter used by gameplay.
    let buffer: ArrayBuffer | null = null;
    if (format === 'fbx' || qualityReport) buffer = this.exportSaved(saved);

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
        candidates, alternates,
      };
    }

    const base64 = this.arrayBufferToBase64(buffer!);
    const exported = !(qualityReport && (qualityReport.status === 'failed' || qualityReport.status === 'unsupported'));
    const preview = options.preview && exported ? await renderMotionPreview(buffer!, avatar!) : undefined;

    return {
      format: 'fbx',
      duration: saved.duration,
      frameCount: rawMotion.frameCount,
      data: exported ? base64 : null,
      ...(qualityReport ? { sourceMotion: sourceSaved } : {}),
      ...(qualityReport ? { qualityReport } : {}),
      ...(preview ? { preview } : {}),
      candidates, alternates,
    };
  }

  /** The motion on the avatar's normalized rig, with every avatar-specific adjustment applied. */
  private avatarClip(motion: StructuredMotionResult, vrm: VRM): AnimationClip {
    const clip = styleMotion(createArdyAnimationClip(motion, vrm), vrm, this.style);
    return this.fitHands ? fitHandsToAvatar(clip, motion, vrm) : clip;
  }

  /** Bake a generated motion onto the editor's Mixamo rig, fitted to the avatar when one is given. */
  private bake(motion: StructuredMotionResult, name: string, avatar: VRM | null): SavedMotion {
    const source = createArdySavedMotion(motion, this.engine!, name);
    const fitted = avatar
      ? styleSavedHips(normalizedClipToMixamo(this.avatarClip(motion, avatar), avatar, this.engine!, source), this.style, this.engine!.rest.get('Hips')!.p.y)
      : source;
    return this.loop ? loopSavedMotion(fitted) : fitted;
  }

  private exportSaved(saved: SavedMotion): ArrayBuffer {
    const engine = this.engine!;
    engine.registerSaved(saved);
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
      return exportFBX(engine, recipe);
    } finally {
      engine.removeSaved(saved.id);
    }
  }

  private async loadQualityAvatar(options: QualityGenerationOptions): Promise<{
    vrm: VRM;
    plan: MotionQualityPlan;
    profile: AvatarContactProfile;
  }> {
    const plan = validateMotionQualityPlan(options.plan);
    const profile = validateAvatarContactProfile(options.profile);
    const { vrm, sha256 } = await this.loadAvatar(options.avatarUrl);
    if (sha256 !== profile.avatarSha256.toLowerCase()) {
      throw new Error('The contact profile hash does not match the requested VRM.');
    }
    return { vrm, plan, profile };
  }

  private async loadAvatar(url: string): Promise<{ vrm: VRM; sha256: string }> {
    const avatarUrl = new URL(resolveAssetUrl(url), window.location.href);
    const response = await fetch(avatarUrl, { cache: 'force-cache' });
    if (!response.ok) throw new Error('Could not load the target VRM (' + response.status + ').');
    const bytes = await response.arrayBuffer();
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const sha256 = [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));
    const gltf = await loader.parseAsync(bytes, new URL('.', avatarUrl).href);
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) throw new Error('The requested file does not contain a VRM avatar.');
    VRMUtils.rotateVRM0(vrm);
    return { vrm, sha256 };
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
