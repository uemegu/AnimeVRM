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
    enableRotate: boolean;
    enableZoom: boolean;
  } | null = null;
  private readonly lastAoiPosition = new THREE.Vector3();
  private followDistance = 4.0;
  private isWalking = false;
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

    // Only the classroom receives this stepped ramp; VRM materials stay intact.
    this.gradientMap = new THREE.DataTexture(
      new Uint8Array([
        37, 55, 83, 255,
        83, 108, 139, 255,
        174, 190, 203, 255,
        250, 246, 236, 255,
      ]),
      4,
      1,
      THREE.RGBAFormat
    );
    this.gradientMap.magFilter = THREE.NearestFilter;
    this.gradientMap.minFilter = THREE.NearestFilter;
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
    const outlinedMeshes: THREE.Mesh[] = [];
    this.environment.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const isPaintedShadow = sourceMaterials.some((material) => material.name.includes('painted ') && material.name.includes('contact shadow'));
      object.castShadow = !isPaintedShadow;
      object.receiveShadow = !isPaintedShadow;
      if (isPaintedShadow) object.renderOrder = 1;
      if (sourceMaterials.some((material) => this.shouldOutline(material.name))) {
        outlinedMeshes.push(object);
      }
      const replaceMaterial = (material: THREE.Material) => {
        const toon = this.toonMaterial(material);
        material.dispose();
        return toon;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(replaceMaterial)
        : replaceMaterial(object.material);
    });
    this.addClassroomOutlines(outlinedMeshes);

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
      enableRotate: this.controls.enableRotate,
      enableZoom: this.controls.enableZoom,
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
          position: [0, 0, 2.3],
          rotationY: Math.PI,
        },
        {
          id: 'emily',
          character: '/models/emili/emili-school-with-bag.vrm',
          position: [2.4, 0, -5.8],
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
    this.followDistance = 4.0;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 8;
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
      this.followDistance = THREE.MathUtils.clamp(currentHorizontalDistance, 2.6, 7.0);
    }

    // Aoi faces -Z at her starting rotation, so the negative forward vector is her back.
    const behind = new THREE.Vector3(-Math.sin(rotationY), 0, -Math.cos(rotationY));
    const cameraPosition = position.clone().addScaledVector(behind, this.followDistance);
    cameraPosition.y += 2.35;
    cameraPosition.x = THREE.MathUtils.clamp(cameraPosition.x, -6.0, 6.0);
    cameraPosition.z = THREE.MathUtils.clamp(cameraPosition.z, -6.9, 6.9);

    const target = position.clone();
    target.y += 1.15;
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
    if (!this.active && !this.environment) return;
    this.active = false;
    this.avatarTransformController.setWalkingMode(false);
    this.avatarManager.setControlledScenarioAvatar(null);

    if (this.environment) {
      this.scene.remove(this.environment);
      const textures = new Set<THREE.Texture>();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      this.environment.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
        meshMaterials.forEach((material) => {
          materials.add(material);
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture && value !== this.gradientMap) {
              textures.add(value);
            }
          });
        });
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      this.environment = null;
    }

    if (this.avatarManager.isMultiAvatarScenarioActive) {
      await this.scenarioController.restoreSingleAvatar();
    }

    if (this.savedEnvironmentConfig) {
      Object.assign(this.getConfig().environment, this.savedEnvironmentConfig);
      this.savedEnvironmentConfig = null;
    }
    this.onApplyConfig(this.getConfig());
    this.scene.background = this.savedSceneBackground;
    this.savedSceneBackground = null;

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

  private toonMaterial(source: THREE.Material): THREE.Material {
    const sourceMaterial = source as THREE.MeshStandardMaterial;
    if (source.name.includes('painted ') && source.name.includes('contact shadow')) {
      return new THREE.MeshBasicMaterial({
        name: source.name,
        color: sourceMaterial.color?.clone() ?? new THREE.Color('#344a69'),
        transparent: true,
        opacity: source.opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
    }
    const name = source.name.toLowerCase();
    const shadowHex = name.includes('wood') || name.includes('walnut') || name.includes('beech')
      ? '#405168'
      : name.includes('board')
        ? '#122b37'
        : name.includes('steel') || name.includes('metal') || name.includes('support')
          ? '#304a68'
          : name.includes('floor') || name.includes('tile')
            ? '#6984a5'
            : '#718dab';
    const shadowColor = new THREE.Color(shadowHex);
    const shadowVector = `${shadowColor.r.toFixed(4)}, ${shadowColor.g.toFixed(4)}, ${shadowColor.b.toFixed(4)}`;
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
    toon.toneMapped = true;
    if (!toon.transparent) {
      // Suppress the shared ambient fill on the room alone. Keep the VRM's
      // MToon shader and the viewer's scene lights exactly as they were.
      toon.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vClassroomWorldPosition;')
          .replace(
            '#include <worldpos_vertex>',
            '#include <worldpos_vertex>\nvClassroomWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;'
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vClassroomWorldPosition;')
          .replace(
            '#include <map_fragment>',
            `#include <map_fragment>
             float paintedVariation = sin(vClassroomWorldPosition.x * 2.1 + sin(vClassroomWorldPosition.z * 1.7))
               * sin(vClassroomWorldPosition.y * 2.8 + vClassroomWorldPosition.x * 0.9);
             diffuseColor.rgb *= 1.0 + paintedVariation * 0.035;`
          )
          .replace(
            'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
            `vec3 classroomLight = normalize((viewMatrix * vec4(-0.38, 0.82, 0.42, 0.0)).xyz);
             float classroomFacing = dot(normal, classroomLight);
             vec3 classroomShade = vec3(${shadowVector});
             vec3 classroomDark = mix(classroomShade, diffuseColor.rgb, 0.15);
             vec3 classroomMid = mix(classroomShade, diffuseColor.rgb, 0.66);
             vec3 outgoingLight = classroomFacing > 0.62 ? diffuseColor.rgb
               : classroomFacing > 0.18 ? classroomMid : classroomDark;`
          );
      };
      toon.customProgramCacheKey = () => `classroom-painted-toon-v2-${shadowHex}`;
    }
    toon.needsUpdate = true;
    return toon;
  }

  private shouldOutline(materialName: string): boolean {
    return [
      'sunlit honey wood',
      'warm walnut edge',
      'classroom sliding door',
      'beech cabinet',
      'blank deep green board',
      'blue grey painted steel',
      'dark seat support',
      'powder blue trim',
      'slate window metal',
    ].some((name) => materialName.includes(name));
  }

  private addClassroomOutlines(meshes: THREE.Mesh[]): void {
    if (meshes.length === 0) return;
    const ink = new THREE.MeshBasicMaterial({
      color: '#2a425b',
      side: THREE.BackSide,
      toneMapped: false,
    });
    ink.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed += normalize(normal) * 0.012;'
      );
    };
    ink.customProgramCacheKey = () => 'classroom-outline-v2';
    for (const mesh of meshes) {
      const outline = new THREE.Mesh(mesh.geometry, ink);
      outline.name = 'Classroom ink outline';
      mesh.add(outline);
    }
  }
}
