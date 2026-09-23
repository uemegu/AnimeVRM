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
  private readonly dirLight: THREE.DirectionalLight;
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
  private savedCastShadows: boolean | null = null;
  private savedShadowCamera: {
    left: number; right: number; top: number; bottom: number; near: number; far: number;
    mapSize: THREE.Vector2; bias: number; normalBias: number; radius: number; intensity: number;
  } | null = null;
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
  private followDistance = 3.8;
  private isWalking = false;
  private gradientMap: THREE.DataTexture;

  constructor(options: {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    dirLight: THREE.DirectionalLight;
    controls: any;
    avatarManager: AvatarManager;
    scenarioController: ScenarioController;
    avatarTransformController: AvatarTransformController;
    getConfig: () => AvatarConfig;
    onApplyConfig: (cfg: AvatarConfig) => void;
  }) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.dirLight = options.dirLight;
    this.controls = options.controls;
    this.avatarManager = options.avatarManager;
    this.scenarioController = options.scenarioController;
    this.avatarTransformController = options.avatarTransformController;
    this.getConfig = options.getConfig;
    this.onApplyConfig = options.onApplyConfig;

    // Only the classroom receives this stepped ramp; VRM materials stay intact.
    this.gradientMap = new THREE.DataTexture(
      new Uint8Array([
        66, 74, 84, 255,
        113, 123, 135, 255,
        188, 195, 201, 255,
        255, 252, 244, 255,
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
      object.castShadow = sourceMaterials.some((material) => this.shouldCastShadow(material.name));
      object.receiveShadow = sourceMaterials.some((material) => !material.transparent && !material.name.includes('daylight glass'));
      if (sourceMaterials.some((material) => this.shouldOutline(material.name))) {
        outlinedMeshes.push(object);
      }
      const replaceMaterial = (material: THREE.Material) => {
        const toon = material.name.includes('varnished desk top')
          ? this.deskTopMaterial(material)
          : this.toonMaterial(material);
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
    this.savedCastShadows = this.getConfig().lighting.castShadows;
    const shadow = this.dirLight.shadow;
    const shadowCamera = shadow.camera as THREE.OrthographicCamera;
    this.savedShadowCamera = {
      left: shadowCamera.left, right: shadowCamera.right,
      top: shadowCamera.top, bottom: shadowCamera.bottom,
      near: shadowCamera.near, far: shadowCamera.far,
      mapSize: shadow.mapSize.clone(), bias: shadow.bias,
      normalBias: shadow.normalBias, radius: shadow.radius, intensity: shadow.intensity,
    };
    Object.assign(shadowCamera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.1, far: 25 });
    shadowCamera.updateProjectionMatrix();
    shadow.mapSize.set(2048, 2048);
    shadow.bias = -0.00015;
    shadow.normalBias = 0.015;
    shadow.radius = 1.2;
    shadow.intensity = 0.72;
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
    config.lighting.castShadows = true;
    this.onApplyConfig(config);
    this.scene.background = new THREE.Color('#c9dff5');
    this.scene.add(this.environment);

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
    if (this.savedCastShadows !== null) {
      this.getConfig().lighting.castShadows = this.savedCastShadows;
      this.savedCastShadows = null;
    }
    if (this.savedShadowCamera) {
      const shadow = this.dirLight.shadow;
      const shadowCamera = shadow.camera as THREE.OrthographicCamera;
      const saved = this.savedShadowCamera;
      Object.assign(shadowCamera, {
        left: saved.left, right: saved.right, top: saved.top, bottom: saved.bottom,
        near: saved.near, far: saved.far,
      });
      shadowCamera.updateProjectionMatrix();
      shadow.mapSize.copy(saved.mapSize);
      shadow.bias = saved.bias;
      shadow.normalBias = saved.normalBias;
      shadow.radius = saved.radius;
      shadow.intensity = saved.intensity;
      this.savedShadowCamera = null;
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
      // Keep direct light and its real shadow map; only reduce the strong
      // magenta ambient fill used by the avatar setup for classroom surfaces.
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
          .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= 0.32;');
      };
      toon.customProgramCacheKey = () => 'classroom-lit-toon-v3';
    }
    toon.needsUpdate = true;
    return toon;
  }

  private deskTopMaterial(source: THREE.Material): THREE.Material {
    const original = source as THREE.MeshStandardMaterial;
    const top = this.toonMaterial(source) as THREE.MeshToonMaterial;
    const roughness = THREE.MathUtils.clamp(original.roughness, 0.1, 0.9);
    const baseCompile = top.onBeforeCompile;
    const toonLightChunk = THREE.ShaderChunk.lights_toon_pars_fragment.replace(
      'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
      `reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
       vec3 deskHalfVector = normalize( directLight.direction + geometryViewDir );
       float deskGloss = pow( max( dot( geometryNormal, deskHalfVector ), 0.0 ), ${(4 + (1 - roughness) * 8).toFixed(2)} );
       float deskHighlight = smoothstep( 0.035, 0.13, deskGloss );
       reflectedLight.directDiffuse += directLight.color * vec3(0.30, 0.19, 0.10) * deskHighlight * ${(0.75 - roughness * 0.38).toFixed(2)};`
    );
    top.name = `${source.name} | toon varnish`;
    top.onBeforeCompile = (shader, renderer) => {
      baseCompile(shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_toon_pars_fragment>', toonLightChunk
      );
    };
    top.customProgramCacheKey = () => `classroom-desk-toon-varnish-v1-${roughness}`;
    return top;
  }

  private shouldCastShadow(materialName: string): boolean {
    const name = materialName.toLowerCase();
    return [
      'varnished desk top', 'sunlit honey wood', 'warm walnut edge',
      'blue grey painted steel', 'dark seat support', 'beech cabinet',
      'textbook', 'plant', 'leaf green', 'unwritten paper',
    ].some((part) => name.includes(part));
  }

  private shouldOutline(materialName: string): boolean {
    return [
      'sunlit honey wood',
      'varnished desk top',
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
        '#include <begin_vertex>\ntransformed += normalize(normal) * 0.0035;'
      );
    };
    ink.customProgramCacheKey = () => 'classroom-outline-v3';
    for (const mesh of meshes) {
      const outline = new THREE.Mesh(mesh.geometry, ink);
      outline.name = 'Classroom ink outline';
      mesh.add(outline);
    }
  }
}
