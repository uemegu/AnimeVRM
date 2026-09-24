import * as THREE from 'three';
import type { AvatarManager } from '../avatar/AvatarManager';
import type { AvatarTransformController } from '../avatar/AvatarTransformController';
import type { ClassroomStage } from '../scene/ClassroomStage';
import type { ScenarioController } from './ScenarioController';
import { resolveAssetUrl } from '../utils/path';

/** Shows the furnished classroom and provides simple free-roam controls for Aoi. */
export class ClassroomExperienceController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: any;
  private readonly avatarManager: AvatarManager;
  private readonly scenarioController: ScenarioController;
  private readonly avatarTransformController: AvatarTransformController;
  private readonly stage: ClassroomStage;

  private active = false;
  private savedControls: {
    enabled: boolean;
    minDistance: number;
    maxDistance: number;
    maxPolarAngle: number;
    enablePan: boolean;
    enableRotate: boolean;
    enableZoom: boolean;
  } | null = null;
  private readonly lastAoiPosition = new THREE.Vector3();
  private followDistance = 3.8;
  private isWalking = false;

  constructor(options: {
    camera: THREE.PerspectiveCamera;
    controls: any;
    avatarManager: AvatarManager;
    scenarioController: ScenarioController;
    avatarTransformController: AvatarTransformController;
    stage: ClassroomStage;
  }) {
    this.camera = options.camera;
    this.controls = options.controls;
    this.avatarManager = options.avatarManager;
    this.scenarioController = options.scenarioController;
    this.avatarTransformController = options.avatarTransformController;
    this.stage = options.stage;
  }

  public get isActive(): boolean {
    return this.active;
  }

  public async start(): Promise<void> {
    if (this.active) return;

    // Load first so a missing model never leaves the viewer halfway switched.
    await this.stage.preload();

    if (this.scenarioController.scenarioEngine.isPlaying) {
      this.scenarioController.scenarioEngine.stop();
    }
    if (this.scenarioController.scenarioPlayer.isPlaying) {
      this.scenarioController.scenarioPlayer.stop();
    }
    if (this.avatarManager.isMultiAvatarScenarioActive) {
      await this.scenarioController.restoreSingleAvatar();
    }

    this.savedControls = {
      enabled: this.controls.enabled,
      minDistance: this.controls.minDistance,
      maxDistance: this.controls.maxDistance,
      maxPolarAngle: this.controls.maxPolarAngle,
      enablePan: this.controls.enablePan,
      enableRotate: this.controls.enableRotate,
      enableZoom: this.controls.enableZoom,
    };
    await this.stage.enter();

    try {
      await this.scenarioController.setupScenarioCharacters([
        {
          id: 'aoi',
          character: '/models/aoi/aoi-school.vrm',
          position: [0, 0, 0.58],
          rotationY: Math.PI,
        },
        {
          id: 'emily',
          character: '/models/emili/emili-school-with-bag.vrm',
          position: [1.4, 0, -3.45],
          rotationY: 0,
        },
      ]);
    } catch (error) {
      await this.stop();
      throw error;
    }

    this.avatarManager.setControlledScenarioAvatar('aoi');
    this.avatarTransformController.setWalkingMode(true);
    this.avatarTransformController.syncInitialTransform();

    const aoi = this.avatarManager.scenarioAvatars.get('aoi');
    if (!aoi?.vrm) {
      await this.stop();
      throw new Error('Aoi was not loaded for the classroom experience.');
    }
    this.lastAoiPosition.copy(aoi.vrm.scene.position);
    this.isWalking = false;
    this.followDistance = 3.8;
    this.controls.minDistance = 2.3;
    this.controls.maxDistance = 5.0;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.025;
    this.controls.enablePan = false;
    this.controls.enableRotate = false;
    this.controls.enableZoom = true;
    this.controls.enabled = true;
    this.updateThirdPersonCamera(aoi.vrm.scene.position, aoi.vrm.scene.rotation.y, true);
    this.active = true;
  }

  public update(): void {
    if (!this.active) return;
    this.stage.update();
    const aoi = this.avatarManager.scenarioAvatars.get('aoi');
    if (!aoi?.vrm) return;

    const position = aoi.vrm.scene.position;
    const isMoving = position.distanceToSquared(this.lastAoiPosition) > 1e-6;
    if (isMoving !== this.isWalking) {
      this.isWalking = isMoving;
      const motion = resolveAssetUrl(isMoving ? '/animations/Walking.fbx' : '/animations/Idle.fbx');
      void aoi.playAnimation(motion, true, 0.22);
    }
    this.lastAoiPosition.copy(position);
    this.updateThirdPersonCamera(position, aoi.vrm.scene.rotation.y);
  }

  private updateThirdPersonCamera(
    position: THREE.Vector3,
    rotationY: number,
    snap = false
  ): void {
    const previousOffset = this.camera.position.clone().sub(this.controls.target);
    const currentHorizontalDistance = Math.hypot(previousOffset.x, previousOffset.z);
    if (!snap && Number.isFinite(currentHorizontalDistance) && currentHorizontalDistance > 0.1) {
      this.followDistance = THREE.MathUtils.clamp(currentHorizontalDistance, 2.3, 4.5);
    }

    // Aoi faces -Z at her starting rotation, so the negative forward vector is her back.
    const behind = new THREE.Vector3(-Math.sin(rotationY), 0, -Math.cos(rotationY));
    const cameraPosition = position.clone().addScaledVector(behind, this.followDistance);
    cameraPosition.y += 2.0;
    cameraPosition.x = THREE.MathUtils.clamp(cameraPosition.x, -4.15, 4.15);
    cameraPosition.z = THREE.MathUtils.clamp(cameraPosition.z, -4.95, 4.95);

    const target = position.clone();
    target.y += 1.5;
    if (snap) {
      this.camera.position.copy(cameraPosition);
      this.controls.target.copy(target);
    } else {
      this.camera.position.lerp(cameraPosition, 0.22);
      this.controls.target.lerp(target, 0.28);
    }
    this.controls.update();
  }

  public async stop(): Promise<void> {
    if (!this.active && !this.savedControls) return;
    this.active = false;
    this.avatarTransformController.setWalkingMode(false);
    this.avatarManager.setControlledScenarioAvatar(null);

    if (this.avatarManager.isMultiAvatarScenarioActive) {
      await this.scenarioController.restoreSingleAvatar();
    }
    this.stage.exit();

    if (this.savedControls) {
      this.controls.enabled = this.savedControls.enabled;
      this.controls.minDistance = this.savedControls.minDistance;
      this.controls.maxDistance = this.savedControls.maxDistance;
      this.controls.maxPolarAngle = this.savedControls.maxPolarAngle;
      this.controls.enablePan = this.savedControls.enablePan;
      this.controls.enableRotate = this.savedControls.enableRotate;
      this.controls.enableZoom = this.savedControls.enableZoom;
      this.controls.update();
      this.savedControls = null;
    }
    this.isWalking = false;
  }
}
