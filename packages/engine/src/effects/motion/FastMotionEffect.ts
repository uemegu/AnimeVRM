import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { FastMotionConfig, DEFAULT_FAST_MOTION_CONFIG, LimbType } from './types';
import { LimbVelocityTracker } from './LimbVelocityTracker';
import { SpeedRibbonMesh } from './SpeedRibbonMesh';
import { LimbAfterimageRenderer } from './LimbAfterimageRenderer';
import { LimbDirectionalBlur } from './LimbDirectionalBlur';

export class FastMotionEffect {
  private vrm: VRM;
  private scene: THREE.Scene;
  private config: FastMotionConfig;

  private tracker: LimbVelocityTracker;
  private ribbons: SpeedRibbonMesh;
  private afterimages: LimbAfterimageRenderer;
  private directionalBlur: LimbDirectionalBlur;
  private rootGroup: THREE.Group;

  private currentTime: number = 0;

  constructor(vrm: VRM, scene: THREE.Scene, config?: Partial<FastMotionConfig>) {
    this.vrm = vrm;
    this.scene = scene;
    this.config = { ...DEFAULT_FAST_MOTION_CONFIG, ...config };

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'FastMotionEffectGroup';

    this.tracker = new LimbVelocityTracker(this.vrm, this.config);
    this.ribbons = new SpeedRibbonMesh(this.config);
    this.afterimages = new LimbAfterimageRenderer(this.config);
    this.directionalBlur = new LimbDirectionalBlur(this.config);

    this.rootGroup.add(this.afterimages.getRootObject());
    this.rootGroup.add(this.directionalBlur.getRootObject());
    this.rootGroup.add(this.ribbons.getRootObject());

    this.scene.add(this.rootGroup);
  }

  public updateConfig(newConfig: Partial<FastMotionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.tracker.updateConfig(this.config);
    this.ribbons.updateConfig(this.config);
    this.afterimages.updateConfig(this.config);
    this.directionalBlur.updateConfig(this.config);
  }

  public getConfig(): FastMotionConfig {
    return { ...this.config };
  }

  public update(
    delta: number,
    elapsed: number,
    camera: THREE.Camera,
    renderer?: THREE.WebGLRenderer
  ): void {
    if (!this.config.enabled) {
      this.ribbons.hideAll();
      this.afterimages.hideAll();
      this.directionalBlur.hideAll();
      return;
    }

    this.currentTime = elapsed;

    // 1. Update relative velocities & history for all 4 limbs
    this.tracker.update(delta, this.currentTime);

    const limbs: LimbType[] = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
    let maxIntensity = 0;

    for (const limb of limbs) {
      const intensity = this.tracker.getIntensity(limb);
      if (intensity > maxIntensity) {
        maxIntensity = intensity;
      }

      const history = this.tracker.getHistory(limb);
      const pos = this.tracker.getCurrentPositions(limb);
      const vel = this.tracker.getCurrentVelocities(limb);

      // 2. Speed line ribbons
      this.ribbons.update(limb, history, intensity, camera);

      // 3. Fading afterimages
      this.afterimages.update(limb, history, intensity, this.currentTime, camera);

      // 4. Trailing directional outline blur
      if (pos && vel) {
        this.directionalBlur.updateLimbGeometry(
          limb,
          pos.root,
          pos.mid,
          pos.tip,
          vel.root,
          vel.mid,
          vel.tip,
          intensity,
          camera
        );
      }
    }

    // 5. Offscreen RenderTarget pass for mask and blur outline
    if (renderer && maxIntensity > 0.03) {
      this.directionalBlur.renderMask(renderer, camera, maxIntensity);
    }
  }

  public reset(): void {
    this.tracker.reset();
    this.ribbons.hideAll();
    this.afterimages.hideAll();
    this.directionalBlur.hideAll();
  }

  public dispose(): void {
    this.tracker.reset();
    this.ribbons.dispose();
    this.afterimages.dispose();
    this.directionalBlur.dispose();

    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }
  }
}
