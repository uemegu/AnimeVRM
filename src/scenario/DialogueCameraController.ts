import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Avatar } from '../Avatar';
import type { PanoramaBackgroundController } from '../scene/PanoramaBackgroundController';
import {
  ScenarioScene,
  CameraZoomType,
  CameraTransitionEasing,
  AvatarSlotPosition,
  AVATAR_POSITION_PRESETS,
} from './types';
import type { CameraPreset, CameraStartAngle } from '../animation/types';

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export interface CameraTransformState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export interface DialogueCameraControllerOptions {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  getAvatar: (characterId?: string) => Avatar | null;
  getAvatars?: () => Avatar[];
}

export interface BackgroundTransform {
  zoomScale: number;
  panOffsetX: number;
  panOffsetY: number;
}

export class DialogueCameraController {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private getAvatar: (characterId?: string) => Avatar | null;
  private getAvatars?: () => Avatar[];

  private _isActive = false;

  // Base state to restore when scenario finishes/stops
  private baseState: CameraTransformState = {
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: 30,
  };

  // Interpolation transition states
  private transitionStart: CameraTransformState = {
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: 30,
  };

  private transitionTarget: CameraTransformState = {
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: 30,
  };

  private currentPose: CameraTransformState = {
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: 30,
  };

  private transitionDuration = 0.7; // seconds
  private transitionElapsed = 0;
  private transitionEasing: CameraTransitionEasing = 'gyuin';
  private isTransitioning = false;

  // Scene continuous motion state (for pushIn, orbit, etc.)
  private currentPreset: CameraPreset = 'hold';
  private currentStrength = 1.0;
  private sceneElapsed = 0;

  // Background zoom state
  private baseFov = 30;
  private baseDistance = 3.0;
  private backgroundZoomScale = 1.0;
  private backgroundPanOffset = new THREE.Vector2(0, 0);

  // Preallocated math helpers
  private _workingPosition = new THREE.Vector3();
  private _workingTarget = new THREE.Vector3();
  private _tempVecA = new THREE.Vector3();
  private _tempVecB = new THREE.Vector3();
  private _tempForward = new THREE.Vector3();
  private _tempRight = new THREE.Vector3();
  private readonly _yAxis = new THREE.Vector3(0, 1, 0);
  private panoramaController?: PanoramaBackgroundController;

  constructor(options: DialogueCameraControllerOptions & { panoramaController?: PanoramaBackgroundController }) {
    this.camera = options.camera;
    this.controls = options.controls;
    this.getAvatar = options.getAvatar;
    this.getAvatars = options.getAvatars;
    this.panoramaController = options.panoramaController;
    this.baseFov = this.camera.fov || 30;
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  public getBackgroundTransform(): BackgroundTransform {
    return {
      zoomScale: this.backgroundZoomScale,
      panOffsetX: this.backgroundPanOffset.x,
      panOffsetY: this.backgroundPanOffset.y,
    };
  }

  /**
   * Start camera control session when a scenario starts.
   */
  public start(): void {
    if (this._isActive) return;

    this._isActive = true;
    this.baseState.position.copy(this.camera.position);
    this.baseState.target.copy(this.controls.target);
    this.baseState.fov = this.camera.fov;
    this.baseDistance = this.camera.position.distanceTo(this.controls.target);
    if (this.baseDistance < 0.5) this.baseDistance = 3.0;

    this.currentPose.position.copy(this.camera.position);
    this.currentPose.target.copy(this.controls.target);
    this.currentPose.fov = this.camera.fov;

    this.controls.enabled = false;
    this.panoramaController?.setCameraControlEnabled(false);
  }

  /**
   * Stop camera control session and restore original camera state.
   */
  public stop(instant = false): void {
    if (!this._isActive) return;

    this._isActive = false;
    this.isTransitioning = false;
    this.backgroundZoomScale = 1.0;
    this.backgroundPanOffset.set(0, 0);

    this.panoramaController?.setCameraControlEnabled(true);

    if (instant) {
      this.camera.position.copy(this.baseState.position);
      this.controls.target.copy(this.baseState.target);
      this.camera.fov = this.baseState.fov;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this.controls.target);
      this.controls.enabled = true;
      this.controls.update();
    } else {
      // Smoothly return to base state
      this.camera.position.copy(this.baseState.position);
      this.controls.target.copy(this.baseState.target);
      this.camera.fov = this.baseState.fov;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this.controls.target);
      this.controls.enabled = true;
      this.controls.update();
    }
  }

  /**
   * Apply camera setup for the current dialogue scene.
   */
  public applyScene(scene: ScenarioScene, defaultSpeakerId?: string): void {
    if (!this._isActive) {
      this.start();
    }

    this.sceneElapsed = 0;
    this.currentPreset = scene.cameraPreset || 'hold';
    this.currentStrength = scene.cameraStrength ?? 1.0;

    // 1. Determine target focus point
    const focusId =
      scene.cameraTargetCharacterId ||
      (typeof scene.cameraTarget === 'string' && !(scene.cameraTarget in AVATAR_POSITION_PRESETS)
        ? scene.cameraTarget
        : undefined) ||
      scene.speakerCharacterId ||
      scene.character ||
      defaultSpeakerId;
    const { targetPos, defaultCameraPos, defaultFov } = this.calculateShotFraming(scene, focusId);

    // 2. Set up transition
    this.transitionStart.position.copy(this.camera.position);
    this.transitionStart.target.copy(this.controls.target);
    this.transitionStart.fov = this.camera.fov;

    this.transitionTarget.position.copy(defaultCameraPos);
    this.transitionTarget.target.copy(targetPos);
    this.transitionTarget.fov = defaultFov;

    this.transitionDuration = Math.max(0.01, scene.cameraTransitionDuration ?? 0.7);
    this.transitionEasing = scene.cameraTransitionEasing ?? 'gyuin';
    this.transitionElapsed = 0;
    this.isTransitioning = true;

    if (this.transitionEasing === 'cut' || this.transitionDuration <= 0.05) {
      // Instant cut
      this.currentPose.position.copy(this.transitionTarget.position);
      this.currentPose.target.copy(this.transitionTarget.target);
      this.currentPose.fov = this.transitionTarget.fov;
      this.isTransitioning = false;
      this.applyCameraPose(this.currentPose);
    }
  }

  /**
   * Calculate 3D camera and target framing for the scene.
   */
  private calculateShotFraming(
    scene: ScenarioScene,
    speakerId?: string
  ): { targetPos: THREE.Vector3; defaultCameraPos: THREE.Vector3; defaultFov: number } {
    const targetPos = new THREE.Vector3(0, 1.25, 0);
    const defaultCameraPos = new THREE.Vector3(0, 1.25, 2.5);
    let defaultFov = this.baseFov;

    const allAvatars = this.getAvatars ? this.getAvatars() : [];
    const isMultiCharacter = allAvatars.length > 1;

    // 1. Resolve Speaker Position & World Center
    let speakerAvatar: Avatar | null = null;
    if (speakerId) {
      speakerAvatar = this.getAvatar(speakerId);
    }
    if (!speakerAvatar && isMultiCharacter && allAvatars.length > 0) {
      speakerAvatar = allAvatars[0];
    } else if (!speakerAvatar) {
      speakerAvatar = this.getAvatar();
    }

    const speakerWorldPos = new THREE.Vector3(0, 0, 0);
    if (speakerAvatar?.vrm?.scene) {
      speakerAvatar.vrm.scene.getWorldPosition(speakerWorldPos);
    }

    // 2. Determine Shot Type
    // If scene.cameraZoom is explicitly specified, use it.
    // Otherwise derive from scene properties: if choices or multiple speakers, use 'wide'; if speakerId exists, use 'speaker'.
    let zoomType: CameraZoomType = scene.cameraZoom || 'speaker';
    if (!scene.cameraZoom) {
      if (scene.choices && scene.choices.length > 0) {
        zoomType = 'wide';
      } else if (scene.speaker?.includes('&') || scene.speaker?.includes('＆')) {
        zoomType = 'wide';
      } else if (scene.cameraStartAngle === 'closeUp') {
        zoomType = 'speaker_close';
      } else if (scene.cameraStartAngle === 'farFront') {
        zoomType = 'wide';
      } else if (speakerId || !isMultiCharacter) {
        zoomType = 'speaker';
      } else {
        zoomType = 'wide';
      }
    }

    const distMultiplier = Math.max(0.3, scene.cameraDistance ?? 1.0);

    // 3. Custom target override
    if (scene.cameraTarget) {
      if (typeof scene.cameraTarget === 'string' && scene.cameraTarget in AVATAR_POSITION_PRESETS) {
        const p = AVATAR_POSITION_PRESETS[scene.cameraTarget as AvatarSlotPosition];
        targetPos.set(p[0], p[1] + 1.25, p[2]);
      } else if (Array.isArray(scene.cameraTarget)) {
        targetPos.set(scene.cameraTarget[0], scene.cameraTarget[1], scene.cameraTarget[2]);
      } else if (typeof scene.cameraTarget === 'string') {
        const charAvatar = this.getAvatar(scene.cameraTarget);
        if (charAvatar?.vrm?.scene) {
          const p = new THREE.Vector3();
          charAvatar.vrm.scene.getWorldPosition(p);
          targetPos.set(p.x, p.y + 1.25, p.z);
        }
      }
    } else if (zoomType === 'wide') {
      // Wide shot: Center view between all characters
      targetPos.set(0, 1.15, -0.3);
    } else {
      // Focus on speaker's head/chest/eyes
      targetPos.set(
        speakerWorldPos.x,
        speakerWorldPos.y + (zoomType === 'speaker_extreme_close' ? 1.33 : (zoomType === 'speaker_close' ? 1.30 : 1.25)),
        speakerWorldPos.z
      );
    }

    const angle: CameraStartAngle = scene.cameraStartAngle || 'front';
    const isBehind = speakerWorldPos.z > 0.3;
    const isPanoramaActive = Boolean(this.panoramaController?.isActive);
    const hasPanoramaUrl = Boolean(scene.panoramaBackgroundUrl || scene.usePanoramaCamera);
    const isAtPlayerOrigin = Math.abs(this.camera.position.x) < 0.2 && Math.abs(this.camera.position.z) < 0.2;
    const hasFrontAndBack =
      allAvatars.length > 1 &&
      allAvatars.some((a) => (a.vrm?.scene ? a.vrm.scene.position.z > 0.3 : a.initialPosition.z > 0.3)) &&
      allAvatars.some((a) => (a.vrm?.scene ? a.vrm.scene.position.z < -0.3 : a.initialPosition.z < -0.3));

    const isSurrounded = isPanoramaActive || hasPanoramaUrl || hasFrontAndBack || (isMultiCharacter && isAtPlayerOrigin);

    if (isSurrounded) {
      // In 360 panorama mode or surrounded formation, camera sits at player position (origin [0, 1.15, 0])
      // and turns towards the active speaker. Zoom is performed safely via FOV narrowing to avoid mesh penetration.
      defaultCameraPos.set(0, 1.15, 0);

      switch (zoomType) {
        case 'speaker_extreme_close': {
          defaultFov = Math.max(18, this.baseFov - 10);
          break;
        }
        case 'speaker_close': {
          defaultFov = Math.max(22, this.baseFov - 6);
          break;
        }
        case 'speaker': {
          defaultFov = this.baseFov;
          break;
        }
        case 'wide': {
          defaultFov = this.baseFov + 6;
          break;
        }
        default: {
          defaultFov = this.baseFov;
          break;
        }
      }
    } else {
      const zDir = isBehind ? -1 : 1;

      switch (zoomType) {
        case 'speaker_extreme_close': {
          // Extreme intimate close-up
          const shotDist = (isMultiCharacter ? 0.95 : 0.85) * distMultiplier;
          defaultFov = Math.max(20, this.baseFov - 6);
          const angleOffsetX = speakerWorldPos.x < 0 ? 0.05 : (speakerWorldPos.x > 0 ? -0.05 : 0);
          defaultCameraPos.set(
            targetPos.x + angleOffsetX,
            targetPos.y + 0.02,
            targetPos.z + shotDist * zDir
          );
          break;
        }

        case 'speaker_close': {
          // Close-up shot
          const shotDist = (isMultiCharacter ? 1.45 : 1.35) * distMultiplier;
          defaultFov = Math.max(22, this.baseFov - 4);
          const angleOffsetX = speakerWorldPos.x < 0 ? 0.09 : (speakerWorldPos.x > 0 ? -0.09 : 0);
          defaultCameraPos.set(
            targetPos.x + angleOffsetX,
            targetPos.y + 0.02,
            targetPos.z + shotDist * zDir
          );
          break;
        }

        case 'speaker': {
          // Standard speaker bust-up focus
          const shotDist = (isMultiCharacter ? 1.85 : 1.70) * distMultiplier;
          defaultFov = this.baseFov;
          const inwardOffset = speakerWorldPos.x < 0 ? 0.12 : (speakerWorldPos.x > 0 ? -0.12 : 0);
          defaultCameraPos.set(
            targetPos.x + inwardOffset,
            targetPos.y + 0.04,
            targetPos.z + shotDist * zDir
          );
          break;
        }

        case 'medium': {
          const shotDist = 2.40 * distMultiplier;
          defaultFov = this.baseFov;
          defaultCameraPos.set(targetPos.x, targetPos.y + 0.05, targetPos.z + shotDist * zDir);
          break;
        }

        case 'wide': {
          // Wide shot showing all characters and the environment
          const shotDist = (isMultiCharacter ? 3.60 : 3.00) * distMultiplier;
          defaultFov = this.baseFov;
          defaultCameraPos.set(0, 1.18, shotDist * zDir);
          break;
        }

        case 'none':
        case 'hold': {
          defaultCameraPos.copy(this.camera.position);
          targetPos.copy(this.controls.target);
          defaultFov = this.camera.fov;
          break;
        }
      }
    }

    // 5. Apply custom CameraStartAngle offsets if specified
    if (angle === 'lowAngle') {
      defaultCameraPos.y = targetPos.y - 0.45;
      defaultCameraPos.z = targetPos.z + 1.2 * distMultiplier;
    } else if (angle === 'highAngle') {
      defaultCameraPos.y = targetPos.y + 0.7;
      defaultCameraPos.z = targetPos.z + 1.5 * distMultiplier;
    } else if (angle === 'right') {
      defaultCameraPos.set(targetPos.x + 1.3 * distMultiplier, targetPos.y, targetPos.z + 0.4);
    } else if (angle === 'left') {
      defaultCameraPos.set(targetPos.x - 1.3 * distMultiplier, targetPos.y, targetPos.z + 0.4);
    }

    return { targetPos, defaultCameraPos, defaultFov };
  }

  /**
   * Update camera interpolation and continuous motions in render loop (tick).
   */
  public update(delta: number): void {
    if (!this._isActive) return;

    this.sceneElapsed += delta;

    // 1. Handle transition interpolation
    if (this.isTransitioning) {
      this.transitionElapsed += delta;
      const progress = Math.min(1.0, this.transitionElapsed / this.transitionDuration);

      let easeT = progress;
      if (this.transitionEasing === 'gyuin') {
        easeT = easeOutExpo(progress);
      } else if (this.transitionEasing === 'smooth') {
        easeT = easeInOutCubic(progress);
      }

      this.currentPose.position.lerpVectors(
        this.transitionStart.position,
        this.transitionTarget.position,
        easeT
      );

      // Smooth spherical yaw rotation for looking around / 180° turns
      const startDir = new THREE.Vector3().subVectors(this.transitionStart.target, this.transitionStart.position);
      const endDir = new THREE.Vector3().subVectors(this.transitionTarget.target, this.transitionTarget.position);
      const startDist = startDir.length();
      const endDist = endDir.length();

      if (startDist > 0.001 && endDist > 0.001) {
        startDir.normalize();
        endDir.normalize();

        const startYaw = Math.atan2(startDir.x, startDir.z);
        let endYaw = Math.atan2(endDir.x, endDir.z);

        // Normalize delta yaw to [-PI, PI] for shortest rotation
        let diffYaw = endYaw - startYaw;
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;

        const currentYaw = startYaw + diffYaw * easeT;
        const currentPitch = THREE.MathUtils.lerp(startDir.y, endDir.y, easeT);
        const currentDist = THREE.MathUtils.lerp(startDist, endDist, easeT);

        const horizLen = Math.sqrt(Math.max(0, 1 - currentPitch * currentPitch));
        const currentDir = new THREE.Vector3(
          Math.sin(currentYaw) * horizLen,
          currentPitch,
          Math.cos(currentYaw) * horizLen
        ).normalize();

        this.currentPose.target.copy(this.currentPose.position).addScaledVector(currentDir, currentDist);
      } else {
        this.currentPose.target.lerpVectors(
          this.transitionStart.target,
          this.transitionTarget.target,
          easeT
        );
      }

      this.currentPose.fov = THREE.MathUtils.lerp(
        this.transitionStart.fov,
        this.transitionTarget.fov,
        easeT
      );

      if (progress >= 1.0) {
        this.isTransitioning = false;
      }
    }

    // 2. Apply continuous subtle preset motions (pushIn, orbit, etc.)
    const workingPose = {
      position: this._workingPosition.copy(this.currentPose.position),
      target: this._workingTarget.copy(this.currentPose.target),
      fov: this.currentPose.fov,
    };

    if (this.currentPreset !== 'hold') {
      const motionProgress = Math.min(1.0, this.sceneElapsed / 4.0);
      const easeMotion = easeOutCubic(motionProgress);
      const strength = this.currentStrength;

      this._tempForward.subVectors(workingPose.target, workingPose.position).normalize();
      this._tempRight.crossVectors(this._tempForward, this._yAxis).normalize();

      switch (this.currentPreset) {
        case 'pushIn': {
          const moveDist = 0.22 * strength * easeMotion;
          workingPose.position.addScaledVector(this._tempForward, moveDist);
          break;
        }
        case 'pullOut': {
          const moveDist = -0.25 * strength * easeMotion;
          workingPose.position.addScaledVector(this._tempForward, moveDist);
          break;
        }
        case 'punchIn': {
          const punchT = easeOutExpo(Math.min(1.0, this.sceneElapsed / 0.5));
          const moveDist = 0.20 * strength * punchT;
          workingPose.position.addScaledVector(this._tempForward, moveDist);
          break;
        }
        case 'orbitLeftHalf': {
          const angle = -0.12 * strength * easeMotion;
          workingPose.position.sub(workingPose.target).applyAxisAngle(this._yAxis, angle).add(workingPose.target);
          break;
        }
        case 'orbitRightHalf': {
          const angle = 0.12 * strength * easeMotion;
          workingPose.position.sub(workingPose.target).applyAxisAngle(this._yAxis, angle).add(workingPose.target);
          break;
        }
        case 'lowAngleUp': {
          const riseY = 0.15 * strength * easeMotion;
          workingPose.position.y += riseY;
          break;
        }
      }

      // 安全ガード: 顔の突き抜けやクリッピングを防ぐため最小距離 1.15m を保証
      const currentDistToTarget = workingPose.position.distanceTo(workingPose.target);
      const minSafeDistance = 1.15;
      if (currentDistToTarget < minSafeDistance) {
        this._tempVecA.subVectors(workingPose.position, workingPose.target);
        if (this._tempVecA.lengthSq() < 0.0001) {
          this._tempVecA.set(0, 0, 1);
        } else {
          this._tempVecA.normalize();
        }
        workingPose.position.copy(workingPose.target).addScaledVector(this._tempVecA, minSafeDistance);
      }
    }

    // 3. Apply calculated pose to Three.js camera & controls
    this.applyCameraPose(workingPose);

    // 4. Calculate Background Zoom Scale & Parallax Offset
    // When camera gets closer or FOV narrows, background zoom scale increases proportionally
    const currentDist = workingPose.position.distanceTo(workingPose.target);
    const distRatio = this.baseDistance / Math.max(0.4, currentDist);
    const fovRatio = this.baseFov / Math.max(15, workingPose.fov);

    // Background zoom effect multiplier (1.0 = base wide, up to 1.65 for close up)
    const rawZoom = Math.pow(distRatio, 0.45) * Math.pow(fovRatio, 0.8);
    this.backgroundZoomScale = Math.max(1.0, Math.min(1.65, rawZoom));

    // Background horizontal/vertical pan parallax offset based on target shift
    const panX = workingPose.target.x - this.baseState.target.x;
    const panY = workingPose.target.y - this.baseState.target.y;
    this.backgroundPanOffset.set(panX * 0.15, panY * 0.1);
  }

  private applyCameraPose(pose: { position: THREE.Vector3; target: THREE.Vector3; fov: number }): void {
    this.camera.position.copy(pose.position);
    this.controls.target.copy(pose.target);

    if (Math.abs(this.camera.fov - pose.fov) > 0.01) {
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
    }

    this.camera.lookAt(this.controls.target);
  }
}
