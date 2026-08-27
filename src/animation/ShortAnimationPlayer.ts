import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CutConfig, CameraPreset, CameraStartAngle } from './types';
import type { AvatarConfig } from '../Config';
import { TypographyOverlay } from './TypographyOverlay';

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export interface CameraState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export interface ShortAnimationPlayerOptions {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  overlay: TypographyOverlay;
  getConfig: () => AvatarConfig;
  onEnterTransparent: () => void;
  onExitTransparent: () => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onPlayMotion?: (motionUrl: string) => void;
  onRestoreMotion?: () => void;
}

export class ShortAnimationPlayer {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private overlay: TypographyOverlay;
  private getConfig: () => AvatarConfig;
  private onEnterTransparent: () => void;
  private onExitTransparent: () => void;
  private onPlayStateChange?: (isPlaying: boolean) => void;
  private onPlayMotion?: (motionUrl: string) => void;
  private onRestoreMotion?: () => void;

  private _isPlaying = false;
  private activeCuts: CutConfig[] = [];
  private currentCutIndex = 0;
  private cutElapsedTime = 0;

  // Base camera state before playback starts (to restore when finished/stopped)
  private baseCameraState: CameraState = {
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: 30,
  };

  // Start camera state for the current Cut
  private cutStartCameraState: CameraState = {
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: 30,
  };

  // Pre-allocated math helper vectors
  private _dir = new THREE.Vector3();
  private _right = new THREE.Vector3();
  private _forward = new THREE.Vector3();
  private _rel = new THREE.Vector3();
  private readonly _yAxis = new THREE.Vector3(0, 1, 0);

  constructor(options: ShortAnimationPlayerOptions) {
    this.camera = options.camera;
    this.controls = options.controls;
    this.overlay = options.overlay;
    this.getConfig = options.getConfig;
    this.onEnterTransparent = options.onEnterTransparent;
    this.onExitTransparent = options.onExitTransparent;
    this.onPlayStateChange = options.onPlayStateChange;
    this.onPlayMotion = options.onPlayMotion;
    this.onRestoreMotion = options.onRestoreMotion;
  }

  public get isPlaying(): boolean {
    return this._isPlaying;
  }

  public play(): void {
    if (this._isPlaying) {
      this.stop();
    }

    const config = this.getConfig();
    const cuts = config.shortAnimation?.cuts || [];
    this.activeCuts = cuts.filter((c) => c.enabled && c.duration > 0);

    if (this.activeCuts.length === 0) {
      console.warn('No active animation cuts enabled.');
      return;
    }

    // 1. Save base camera state
    this.baseCameraState.position.copy(this.camera.position);
    this.baseCameraState.target.copy(this.controls.target);
    this.baseCameraState.fov = this.camera.fov;

    // 2. Disable OrbitControls to prevent damping interference
    this.controls.enabled = false;

    // 3. Enter transparent background mode for Back Text layering
    this.onEnterTransparent();
    this.overlay.enterTransparentMode(config);

    // 4. Start playback state
    this._isPlaying = true;
    this.currentCutIndex = 0;
    this.cutElapsedTime = 0;

    this.onPlayStateChange?.(true);

    // 5. Setup initial cut start camera position & motion
    const initialCut = this.activeCuts[0];
    this.setupCutStartCamera(initialCut);
    if (initialCut.motion && initialCut.motion !== 'none') {
      this.onPlayMotion?.(initialCut.motion);
    }

    // Apply first frame immediately
    this.applyCurrentFrame(0);
  }

  public stop(): void {
    if (!this._isPlaying) return;

    this._isPlaying = false;

    // 1. Restore base camera state
    this.camera.position.copy(this.baseCameraState.position);
    this.controls.target.copy(this.baseCameraState.target);
    this.camera.fov = this.baseCameraState.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.controls.target);

    // 2. Re-enable OrbitControls
    this.controls.enabled = true;
    this.controls.update();

    // 3. Exit transparent background mode
    this.overlay.exitTransparentMode();
    this.onExitTransparent();

    // 4. Restore original motion
    this.onRestoreMotion?.();

    this.onPlayStateChange?.(false);
  }

  public update(delta: number): void {
    if (!this._isPlaying) return;

    this.cutElapsedTime += delta;

    const currentCut = this.activeCuts[this.currentCutIndex];
    if (!currentCut) {
      this.stop();
      return;
    }

    if (this.cutElapsedTime >= currentCut.duration) {
      // Advance to next Cut
      this.cutElapsedTime -= currentCut.duration;
      this.currentCutIndex++;

      if (this.currentCutIndex >= this.activeCuts.length) {
        // Finished all active cuts
        this.stop();
        return;
      }

      // Setup next cut start camera position & motion
      const nextCut = this.activeCuts[this.currentCutIndex];
      this.setupCutStartCamera(nextCut);
      if (nextCut.motion && nextCut.motion !== 'none') {
        this.onPlayMotion?.(nextCut.motion);
      }
    }

    const cut = this.activeCuts[this.currentCutIndex];
    const t = Math.max(0, Math.min(1, this.cutElapsedTime / cut.duration));
    this.applyCurrentFrame(t);
  }

  private setupCutStartCamera(cut: CutConfig): void {
    const angle: CameraStartAngle = cut.startAngle || 'continue';
    const distMultiplier = Math.max(0.2, cut.cameraDistance ?? 1.0);

    if (angle === 'continue') {
      this.cutStartCameraState.position.copy(this.camera.position);
      this.cutStartCameraState.target.copy(this.controls.target);
      this.cutStartCameraState.fov = this.camera.fov;
      return;
    }

    const basePos = this.baseCameraState.position;
    const baseTarget = this.baseCameraState.target;
    const rel = basePos.clone().sub(baseTarget);

    const baseRadius = Math.max(0.8, Math.sqrt(rel.x * rel.x + rel.z * rel.z));
    const radius = baseRadius * distMultiplier;
    const height = rel.y * distMultiplier;

    const newTarget = baseTarget.clone();
    const newPos = basePos.clone();

    switch (angle) {
      case 'farFront':
        // 遠景・正面ロングショット
        newTarget.copy(baseTarget);
        newPos.set(baseTarget.x, baseTarget.y + height * 1.2, baseTarget.z + radius * 2.2);
        break;

      case 'front':
        newTarget.copy(baseTarget);
        newPos.set(baseTarget.x, baseTarget.y + height, baseTarget.z + radius);
        break;

      case 'right':
        newTarget.copy(baseTarget);
        newPos.set(baseTarget.x + radius, baseTarget.y + height, baseTarget.z);
        break;

      case 'left':
        newTarget.copy(baseTarget);
        newPos.set(baseTarget.x - radius, baseTarget.y + height, baseTarget.z);
        break;

      case 'back':
        newTarget.copy(baseTarget);
        newPos.set(baseTarget.x, baseTarget.y + height, baseTarget.z - radius);
        break;

      case 'lowAngle':
        // 足元から見上げる構図
        newTarget.set(baseTarget.x, Math.max(0.6, baseTarget.y * 0.75), baseTarget.z);
        newPos.set(baseTarget.x, 0.2 * distMultiplier, baseTarget.z + Math.max(1.1, radius * 0.85));
        break;

      case 'highAngle':
        // 斜め上からの見下ろし構図
        newTarget.set(baseTarget.x, baseTarget.y * 0.8, baseTarget.z);
        newPos.set(baseTarget.x, Math.max(2.4, (baseTarget.y + 1.2) * distMultiplier), baseTarget.z + Math.max(1.6, radius * 1.1));
        break;

      case 'closeUp':
        // 顔・上半身の寄り構図
        newTarget.set(baseTarget.x, baseTarget.y + 0.05, baseTarget.z);
        newPos.set(baseTarget.x, baseTarget.y + 0.05, baseTarget.z + Math.max(0.65, radius * 0.45));
        break;
    }

    this.cutStartCameraState.position.copy(newPos);
    this.cutStartCameraState.target.copy(newTarget);
    this.cutStartCameraState.fov = this.baseCameraState.fov;

    this.camera.position.copy(newPos);
    this.controls.target.copy(newTarget);
    this.camera.lookAt(newTarget);
  }

  private applyCurrentFrame(t: number): void {
    const cut = this.activeCuts[this.currentCutIndex];
    if (!cut) return;

    // 1. Compute camera position & target based on camera preset
    this.calculateCameraMotion(cut.cameraPreset, cut.cameraStrength ?? 1.0, t);

    // 2. Ensure camera orientation aligns to target
    this.camera.lookAt(this.controls.target);

    // 3. Update typography text overlay
    this.overlay.update(t, cut.backText, cut.frontText);
  }

  private calculateCameraMotion(preset: CameraPreset, strength: number, t: number): void {
    const startPos = this.cutStartCameraState.position;
    const startTarget = this.cutStartCameraState.target;

    switch (preset) {
      case 'pushIn': {
        // Move towards the target (short MV zoom in)
        this._dir.subVectors(startTarget, startPos);
        const factor = 0.42 * strength * easeInOutCubic(t);
        this.camera.position.copy(startPos).addScaledVector(this._dir, factor);
        this.controls.target.copy(startTarget);
        break;
      }

      case 'pullOut': {
        // Move away from the target
        this._dir.subVectors(startPos, startTarget);
        const factor = 0.42 * strength * easeInOutCubic(t);
        this.camera.position.copy(startPos).addScaledVector(this._dir, factor);
        this.controls.target.copy(startTarget);
        break;
      }

      case 'panLeft': {
        // Pan composition to left (camera moves to the left in camera space)
        this.camera.getWorldDirection(this._forward);
        this._right.crossVectors(this._forward, this.camera.up).normalize();
        const panDist = 0.45 * strength * easeInOutCubic(t);
        this.camera.position.copy(startPos).addScaledVector(this._right, -panDist);
        this.controls.target.copy(startTarget).addScaledVector(this._right, -panDist);
        break;
      }

      case 'panRight': {
        // Pan composition to right
        this.camera.getWorldDirection(this._forward);
        this._right.crossVectors(this._forward, this.camera.up).normalize();
        const panDist = 0.45 * strength * easeInOutCubic(t);
        this.camera.position.copy(startPos).addScaledVector(this._right, panDist);
        this.controls.target.copy(startTarget).addScaledVector(this._right, panDist);
        break;
      }

      case 'orbitLeft': {
        // Orbit camera around target horizontally to the left
        this._rel.subVectors(startPos, startTarget);
        const angle = (Math.PI / 6) * strength * easeInOutCubic(t);
        this._rel.applyAxisAngle(this._yAxis, angle);
        this.camera.position.copy(startTarget).add(this._rel);
        this.controls.target.copy(startTarget);
        break;
      }

      case 'orbitRight': {
        // Orbit camera around target horizontally to the right
        this._rel.subVectors(startPos, startTarget);
        const angle = -(Math.PI / 6) * strength * easeInOutCubic(t);
        this._rel.applyAxisAngle(this._yAxis, angle);
        this.camera.position.copy(startTarget).add(this._rel);
        this.controls.target.copy(startTarget);
        break;
      }

      case 'orbitLeftHalf': {
        // Orbit camera around target horizontally to the left by 180 degrees (half circle)
        this._rel.subVectors(startPos, startTarget);
        const angle = Math.PI * strength * easeInOutCubic(t);
        this._rel.applyAxisAngle(this._yAxis, angle);
        this.camera.position.copy(startTarget).add(this._rel);
        this.controls.target.copy(startTarget);
        break;
      }

      case 'orbitRightHalf': {
        // Orbit camera around target horizontally to the right by 180 degrees
        this._rel.subVectors(startPos, startTarget);
        const angle = -Math.PI * strength * easeInOutCubic(t);
        this._rel.applyAxisAngle(this._yAxis, angle);
        this.camera.position.copy(startTarget).add(this._rel);
        this.controls.target.copy(startTarget);
        break;
      }

      case 'lowAngleUp': {
        // Dynamic look up from feet to chest/head
        const upDist = 0.65 * strength * easeInOutCubic(t);
        const targetUp = 0.5 * strength * easeInOutCubic(t);
        this.camera.position.set(startPos.x, startPos.y + upDist, startPos.z);
        this.controls.target.set(startTarget.x, startTarget.y + targetUp, startTarget.z);
        break;
      }

      case 'riseUp': {
        // Vertical upward motion
        const upDist = 0.65 * strength * easeInOutCubic(t);
        this.camera.position.set(startPos.x, startPos.y + upDist, startPos.z);
        this.controls.target.set(startTarget.x, startTarget.y + upDist, startTarget.z);
        break;
      }

      case 'diveDown': {
        // Vertical downward motion
        const downDist = 0.65 * strength * easeInOutCubic(t);
        this.camera.position.set(startPos.x, startPos.y - downDist, startPos.z);
        this.controls.target.set(startTarget.x, startTarget.y - downDist, startTarget.z);
        break;
      }

      case 'punchIn': {
        // Fast snap in and settle back
        let punchFactor: number;
        if (t < 0.25) {
          punchFactor = (t / 0.25) * 1.35;
        } else {
          const subT = (t - 0.25) / 0.75;
          punchFactor = 1.35 - 0.35 * easeOutCubic(subT);
        }
        this._dir.subVectors(startTarget, startPos);
        const factor = 0.32 * strength * punchFactor;
        this.camera.position.copy(startPos).addScaledVector(this._dir, factor);
        this.controls.target.copy(startTarget);
        break;
      }

      case 'hold':
      default: {
        this.camera.position.copy(startPos);
        this.controls.target.copy(startTarget);
        break;
      }
    }
  }
}
