import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AvatarConfig } from '../Config';
import type { AvatarManager } from '../avatar/AvatarManager';
import type { AvatarTransformController } from '../avatar/AvatarTransformController';
import type { ScenarioController } from './ScenarioController';
import { resolveAssetUrl } from '../utils/path';

/** Loads the furnished classroom and provides simple free-roam controls for Aoi. */
export class ClassroomExperienceController {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: any;
  private readonly avatarManager: AvatarManager;
  private readonly scenarioController: ScenarioController;
  private readonly avatarTransformController: AvatarTransformController;
  private readonly getConfig: () => AvatarConfig;
  private readonly onApplyConfig: (cfg: AvatarConfig) => void;
  private readonly loader = new GLTFLoader();

  private environment: THREE.Group | null = null;
  private active = false;
  private savedEnvironmentConfig: AvatarConfig['environment'] | null = null;
  private savedSceneBackground: THREE.Scene['background'] = null;
  private savedControls: {
    enabled: boolean;
    minDistance: number;
    maxDistance: number;
    maxPolarAngle: number;
    enablePan: boolean;
  } | null = null;
  private followAnchor: THREE.Vector3 | null = null;
  private gradientMap: THREE.DataTexture;

  constructor(options: {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: any;
    avatarManager: AvatarManager;
    scenarioController: ScenarioController;
    avatarTransformController: AvatarTransformController;
    getConfig: () => AvatarConfig;
    onApplyConfig: (cfg: AvatarConfig) => void;
  }) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.controls = options.controls;
    this.avatarManager = options.avatarManager;
    this.scenarioController = options.scenarioController;
    this.avatarTransformController = options.avatarTransformController;
    this.getConfig = options.getConfig;
    this.onApplyConfig = options.onApplyConfig;

    // A small stepped ramp keeps the classroom's imported PBR textures but shades
    // their surfaces in a clean cel style in the Three.js viewer.
    this.gradientMap = new THREE.DataTexture(
      new Uint8Array([
        106, 115, 132, 255,
        156, 166, 181, 255,
        211, 219, 229, 255,
        255, 255, 255, 255,
      ]),
      4,
      1,
      THREE.RGBAFormat
    );
    this.gradientMap.magFilter = THREE.LinearFilter;
    this.gradientMap.minFilter = THREE.LinearFilter;
    this.gradientMap.generateMipmaps = false;
    this.gradientMap.needsUpdate = true;
  }

  public get isActive(): boolean {
    return this.active;
  }

  public async start(): Promise<void> {
    if (this.active) return;

    // Load first so a missing model never leaves the viewer halfway switched.
    const gltf = await this.loader.loadAsync(
      resolveAssetUrl('/models/school-environments/school-classroom-3d.glb')
    );
    this.environment = gltf.scene;
    this.environment.name = 'School classroom | 3D experience';
    this.environment.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const replaceMaterial = (material: THREE.Material) => {
        const toon = this.toonMaterial(material);
        material.dispose();
        return toon;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(replaceMaterial)
        : replaceMaterial(object.material);
    });

    if (this.scenarioController.scenarioEngine.isPlaying) {
      this.scenarioController.scenarioEngine.stop();
    }
    if (this.scenarioController.scenarioPlayer.isPlaying) {
      this.scenarioController.scenarioPlayer.stop();
    }
    if (this.avatarManager.isMultiAvatarScenarioActive) {
      await this.scenarioController.restoreSingleAvatar();
    }

    this.savedSceneBackground = this.scene.background?.clone?.() ?? this.scene.background;
    this.savedEnvironmentConfig = { ...this.getConfig().environment };
    this.savedControls = {
      enabled: this.controls.enabled,
      minDistance: this.controls.minDistance,
      maxDistance: this.controls.maxDistance,
      maxPolarAngle: this.controls.maxPolarAngle,
      enablePan: this.controls.enablePan,
    };

    const config = this.getConfig();
    config.environment.showBackgroundImage = false;
    config.environment.showMidground = false;
    config.environment.showNearground = false;
    config.environment.showFloor = false;
    this.onApplyConfig(config);
    this.scene.background = new THREE.Color('#c9dff5');
    this.scene.add(this.environment);

    try {
      await this.scenarioController.setupScenarioCharacters([
        {
          id: 'aoi',
          character: '/models/aoi/aoi-school.vrm',
          position: [0, 0, 4.8],
          rotationY: Math.PI,
        },
        {
          id: 'emily',
          character: '/models/emili/emili-school-with-bag.vrm',
          position: [1.0, 0, -3.6],
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

    this.camera.position.set(0, 7.2, 17.5);
    this.controls.target.set(0, 1.08, 4.8);
    this.controls.minDistance = 3;
    this.controls.maxDistance = 27;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.025;
    this.controls.enablePan = true;
    this.controls.enabled = true;
    this.controls.update();

    this.followAnchor = this.controls.target.clone();
    this.active = true;
  }

  public update(): void {
    if (!this.active) return;
    const aoi = this.avatarManager.scenarioAvatars.get('aoi');
    if (!aoi?.vrm) return;

    const position = aoi.vrm.scene.position;
    const nextAnchor = new THREE.Vector3(position.x, position.y + 1.08, position.z);
    if (!this.followAnchor) {
      this.followAnchor = nextAnchor;
      return;
    }
    const delta = nextAnchor.sub(this.followAnchor);
    this.controls.target.add(delta);
    this.camera.position.add(delta);
    this.followAnchor.add(delta);
  }

  public async stop(): Promise<void> {
    if (!this.active && !this.environment) return;
    this.active = false;
    this.avatarTransformController.setWalkingMode(false);
    this.avatarManager.setControlledScenarioAvatar(null);

    if (this.environment) {
      this.scene.remove(this.environment);
      const textures = new Set<THREE.Texture>();
      this.environment.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture && value !== this.gradientMap) {
              textures.add(value);
            }
          });
          material.dispose();
        });
      });
      textures.forEach((texture) => texture.dispose());
      this.environment = null;
    }

    if (this.avatarManager.isMultiAvatarScenarioActive) {
      await this.scenarioController.restoreSingleAvatar();
    }

    if (this.savedEnvironmentConfig) {
      Object.assign(this.getConfig().environment, this.savedEnvironmentConfig);
      this.onApplyConfig(this.getConfig());
      this.savedEnvironmentConfig = null;
    }
    this.scene.background = this.savedSceneBackground;
    this.savedSceneBackground = null;

    if (this.savedControls) {
      this.controls.enabled = this.savedControls.enabled;
      this.controls.minDistance = this.savedControls.minDistance;
      this.controls.maxDistance = this.savedControls.maxDistance;
      this.controls.maxPolarAngle = this.savedControls.maxPolarAngle;
      this.controls.enablePan = this.savedControls.enablePan;
      this.controls.update();
      this.savedControls = null;
    }
    this.followAnchor = null;
  }

  private toonMaterial(source: THREE.Material): THREE.MeshToonMaterial {
    const sourceMaterial = source as THREE.MeshStandardMaterial;
    const toon = new THREE.MeshToonMaterial({
      name: `${source.name || 'Classroom material'} | toon`,
      color: sourceMaterial.color?.clone() ?? new THREE.Color(0xffffff),
      map: sourceMaterial.map ?? null,
      alphaMap: sourceMaterial.alphaMap ?? null,
      transparent: source.transparent,
      opacity: source.opacity,
      side: source.side,
      depthWrite: source.depthWrite,
      alphaTest: source.alphaTest,
      gradientMap: this.gradientMap,
    });
    toon.flatShading = true;
    toon.toneMapped = true;
    toon.needsUpdate = true;
    return toon;
  }
}
