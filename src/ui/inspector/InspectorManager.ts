import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { AvatarConfig } from '../../Config';
import { ViewerCore } from '../../scene/ViewerCore';
import { AvatarManager } from '../../avatar/AvatarManager';
import { AudioLipSync } from '../../AudioLipSync';
import { setupStageInspector } from './StageInspector';
import { setupVisualInspector } from './VisualInspector';

export interface InspectorContext {
  currentConfig: AvatarConfig;
  toggleState: {
    colorGrading: boolean;
    bloom: boolean;
    smoothNormal: boolean;
    screenSpaceWidth: boolean;
    rimBody: boolean;
    rimCloth: boolean;
    rimLight: boolean;
    diffusion: boolean;
    filmGrain: boolean;
    vignette: boolean;
    chromaticAberration: boolean;
    sharpening: boolean;
    eyeGlow: boolean;
    wind: boolean;
    rain: boolean;
  };
  viewerCore: ViewerCore;
  avatarManager: AvatarManager;
  audioLipSync: AudioLipSync;
  applyConfigToSceneAndRenderer: (cfg: AvatarConfig) => void;
  updateAllInspectorsDisplay: () => void;
}

export class InspectorManager {
  public guis: GUI[] = [];
  public toggleState = {
    colorGrading: true,
    bloom: true,
    smoothNormal: true,
    screenSpaceWidth: true,
    rimBody: true,
    rimCloth: true,
    rimLight: true,
    diffusion: true,
    filmGrain: false,
    vignette: true,
    chromaticAberration: true,
    sharpening: true,
    eyeGlow: true,
    wind: true,
    rain: false,
  };

  public syncToggleState(cfg: AvatarConfig): void {
    this.toggleState.colorGrading = cfg.postProcessing.colorGrading?.enabled ?? false;
    this.toggleState.bloom = cfg.postProcessing.bloom?.enabled ?? false;
    this.toggleState.smoothNormal = cfg.outline.useSmoothNormal;
    this.toggleState.screenSpaceWidth = cfg.outline.screenSpaceWidth;
    this.toggleState.rimBody = cfg.materials.body.rimEnabled ?? false;
    this.toggleState.rimCloth = cfg.materials.cloth.rimEnabled ?? false;
    this.toggleState.rimLight = cfg.lighting.rim.enabled !== false;
    this.toggleState.diffusion = cfg.postProcessing.cinematic?.diffusion.enabled ?? false;
    this.toggleState.filmGrain = cfg.postProcessing.cinematic?.filmGrain.enabled ?? false;
    this.toggleState.vignette = cfg.postProcessing.cinematic?.vignette.enabled ?? false;
    this.toggleState.chromaticAberration = cfg.postProcessing.cinematic?.chromaticAberration.enabled ?? false;
    this.toggleState.sharpening = cfg.postProcessing.cinematic?.sharpening.enabled ?? false;
    this.toggleState.eyeGlow = cfg.eyeGlow?.enabled ?? true;
    this.toggleState.wind = cfg.wind.enabled;
    this.toggleState.rain = cfg.rain?.enabled ?? false;
  }

  public updateAllInspectorsDisplay(): void {
    this.guis.forEach((g) => {
      try {
        g.controllersRecursive().forEach((c) => c.updateDisplay());
      } catch (err) {
        // Safe to ignore update errors for unmounted controllers
      }
    });
  }

  public destroyAllInspectors(): void {
    this.guis.forEach((g) => {
      try {
        g.destroy();
      } catch (err) {
        // Safe to ignore destruction errors
      }
    });
    this.guis = [];
  }

  public setupInspector(ctx: InspectorContext): void {
    this.destroyAllInspectors();
    this.syncToggleState(ctx.currentConfig);

    const stageMount = document.getElementById('gui-mount-point-stage');
    if (stageMount) setupStageInspector(stageMount, ctx, this.guis);

    const visualMount = document.getElementById('gui-mount-point-visual');
    if (visualMount) setupVisualInspector(visualMount, ctx, this.guis);
  }

  public rebuildInspector(ctx: InspectorContext): void {
    this.setupInspector(ctx);
  }
}
