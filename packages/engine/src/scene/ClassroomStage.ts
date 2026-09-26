import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AvatarConfig } from '../Config';
import { resolveAssetUrl } from '../utils/path';

// Room layout in viewer space: windows along -X, blackboard at -Z.
// Values follow tools/build_classroom.py after its ROOM_SCALE is applied.
const WINDOW_X = -4.48;
const WINDOW_BAY_CENTERS_Z = [3.321, 1.107, -1.107, -3.321];
const WINDOW_BAY_WIDTH = 2.09;
const WINDOW_PANES_Y: Array<[number, number]> = [[0.91, 1.82], [1.87, 2.79]];
const CURTAIN_TOP_Y = 2.873;
const CURTAIN_HEIGHT = 1.92;
const BLACKBOARD = { z: -5.195, y: 1.7425, width: 4.466, height: 1.3855 };

const CLASSROOM_GLOW = {
  bloom: { enabled: true, strength: 0.18, radius: 0.8, threshold: 0.82 },
  diffusion: { enabled: true, strength: 0.22, radius: 3.0 },
};

/** Warm, pale air the room fades into with distance. */
const CLASSROOM_HAZE_COLOR = new THREE.Color('#f7e6d2');

/** Late-afternoon sun low through the window bank, with a cool sky fill. */
const CLASSROOM_LIGHTING = {
  hairRingTint: '#ffe3c6',
  ambient: { color: '#a3a6d6', intensity: 1.0 },
  directional: { color: '#ffdcb2', intensity: 3.2, posX: -10, posY: 5.4, posZ: 2.6 },
};

/**
 * The furnished late-afternoon classroom as a 3D stage: loads the room,
 * turns it into painted-background toon materials and sets the matching light.
 * Shared by the free-roam classroom and scenarios that play inside the room.
 */
export class ClassroomStage {
  private readonly scene: THREE.Scene;
  private readonly dirLight: THREE.DirectionalLight;
  private readonly getConfig: () => AvatarConfig;
  private readonly onApplyConfig: (cfg: AvatarConfig) => void;
  private readonly loader = new GLTFLoader();

  private environment: THREE.Group | null = null;
  private loading: Promise<THREE.Group> | null = null;
  private savedEnvironmentConfig: AvatarConfig['environment'] | null = null;
  private savedLighting: AvatarConfig['lighting'] | null = null;
  private savedPostProcessing: AvatarConfig['postProcessing'] | null = null;
  private savedShadowCamera: {
    left: number; right: number; top: number; bottom: number; near: number; far: number;
    mapSize: THREE.Vector2; bias: number; normalBias: number; radius: number; intensity: number;
  } | null = null;
  private gradientMap: THREE.DataTexture;
  private readonly clock = new THREE.Clock();
  private readonly timeUniform = { value: 0 };

  constructor(options: {
    scene: THREE.Scene;
    dirLight: THREE.DirectionalLight;
    getConfig: () => AvatarConfig;
    onApplyConfig: (cfg: AvatarConfig) => void;
  }) {
    this.scene = options.scene;
    this.dirLight = options.dirLight;
    this.getConfig = options.getConfig;
    this.onApplyConfig = options.onApplyConfig;

    // Only the classroom receives this ramp; VRM materials stay intact.
    // Like painted anime backgrounds, the terminator is a soft blend, not a hard step.
    const ramp = [96, 100, 110, 150, 212, 244, 255, 255];
    this.gradientMap = new THREE.DataTexture(
      new Uint8Array(ramp.flatMap((value) => [value, value, value, 255])),
      ramp.length,
      1,
      THREE.RGBAFormat
    );
    this.gradientMap.magFilter = THREE.LinearFilter;
    this.gradientMap.minFilter = THREE.LinearFilter;
    this.gradientMap.generateMipmaps = false;
    this.gradientMap.needsUpdate = true;
  }

  public get isActive(): boolean {
    return this.savedLighting !== null;
  }

  /** Loads and prepares the room without touching the viewer, so a failed load changes nothing. */
  public preload(): Promise<THREE.Group> {
    if (this.environment) return Promise.resolve(this.environment);
    this.loading ??= this.build().then(
      (environment) => {
        this.environment = environment;
        this.loading = null;
        return environment;
      },
      (error) => {
        this.loading = null;
        throw error;
      }
    );
    return this.loading;
  }

  /** Shows the room and switches lighting, shadows and glow to the classroom look. */
  public async enter(): Promise<void> {
    const environment = await this.preload();
    if (this.isActive) return;

    this.savedEnvironmentConfig = { ...this.getConfig().environment };
    this.savedLighting = structuredClone(this.getConfig().lighting);
    this.savedPostProcessing = structuredClone(this.getConfig().postProcessing);
    const shadow = this.dirLight.shadow;
    const shadowCamera = shadow.camera as THREE.OrthographicCamera;
    this.savedShadowCamera = {
      left: shadowCamera.left, right: shadowCamera.right,
      top: shadowCamera.top, bottom: shadowCamera.bottom,
      near: shadowCamera.near, far: shadowCamera.far,
      mapSize: shadow.mapSize.clone(), bias: shadow.bias,
      normalBias: shadow.normalBias, radius: shadow.radius, intensity: shadow.intensity,
    };
    Object.assign(shadowCamera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.1, far: 26 });
    shadowCamera.updateProjectionMatrix();
    shadow.mapSize.set(2048, 2048);
    shadow.bias = -0.00015;
    shadow.normalBias = 0.015;
    shadow.radius = 3.0;
    shadow.intensity = 0.7;

    const config = this.getConfig();
    config.environment.showBackgroundImage = false;
    config.environment.showMidground = false;
    config.environment.showNearground = false;
    config.environment.showFloor = false;
    // Seen only past the far end of the courtyard painting; kept in config so a
    // later applyConfig (avatar load, scenario step) does not reset it.
    config.environment.backgroundColor = '#f3dcc0';
    config.lighting.castShadows = true;
    config.lighting.hairRingTint = CLASSROOM_LIGHTING.hairRingTint;
    Object.assign(config.lighting.ambient, CLASSROOM_LIGHTING.ambient);
    Object.assign(config.lighting.directional, CLASSROOM_LIGHTING.directional);
    // The sun is outside the room; screen-space shafts and flares would shine through walls.
    config.lighting.sunShafts.enabled = false;
    config.lighting.lensFlare.enabled = false;
    // Sunlit surfaces bleed a soft glow, like the painted backgrounds.
    Object.assign(config.postProcessing.bloom, CLASSROOM_GLOW.bloom);
    Object.assign(config.postProcessing.cinematic.diffusion, CLASSROOM_GLOW.diffusion);
    this.onApplyConfig(config);
    this.scene.add(environment);
  }

  public update(): void {
    if (!this.isActive) return;
    this.timeUniform.value = this.clock.getElapsedTime();
  }

  /** Removes and frees the room, and puts the viewer's own light and look back. */
  public exit(): void {
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
    if (!this.isActive) return;

    if (this.savedEnvironmentConfig) {
      Object.assign(this.getConfig().environment, this.savedEnvironmentConfig);
      this.savedEnvironmentConfig = null;
    }
    if (this.savedLighting) {
      restoreInPlace(this.getConfig().lighting, this.savedLighting);
      this.savedLighting = null;
    }
    if (this.savedPostProcessing) {
      restoreInPlace(this.getConfig().postProcessing, this.savedPostProcessing);
      this.savedPostProcessing = null;
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
  }

  private async build(): Promise<THREE.Group> {
    const gltf = await this.loader.loadAsync(
      resolveAssetUrl('/models/school-environments/school-classroom-3d.glb')
    );
    const environment = gltf.scene;
    environment.name = 'School classroom | 3D stage';
    environment.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      object.castShadow = sourceMaterials.some((material) => this.shouldCastShadow(material.name));
      object.receiveShadow = sourceMaterials.some((material) => !material.transparent && !material.name.includes('daylight glass'));
      const replaceMaterial = (material: THREE.Material) => {
        const replacement = material.name.includes('varnished desk top')
          ? this.deskTopMaterial(material)
          : material.name.includes('sheer linen curtain')
            ? this.curtainMaterial(material)
            : material.name.includes('daylight glass')
              ? this.glassMaterial(material)
              : this.toonMaterial(material);
        material.dispose();
        return replacement;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(replaceMaterial)
        : replaceMaterial(object.material);
      // Fixed order for the see-through layers (glass, then curtains, then light),
      // so their sorting never flips as the camera moves.
      if (sourceMaterials.some((material) => material.name.includes('sheer linen curtain'))) {
        object.renderOrder = 1;
      }
    });
    environment.add(this.createCourtyardBackdrop());
    environment.add(this.createChalkWriting());
    environment.add(this.createSunBeams());
    environment.add(this.createDustMotes());
    return environment;
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
    {
      // Keep direct light and its real shadow map; only reduce the strong
      // magenta ambient fill used by the avatar setup for classroom surfaces.
      toon.onBeforeCompile = (shader) => {
        shader.uniforms.uHazeColor = { value: CLASSROOM_HAZE_COLOR };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vClassroomWorldPosition;')
          .replace(
            '#include <worldpos_vertex>',
            '#include <worldpos_vertex>\nvClassroomWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;'
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vClassroomWorldPosition;\nuniform vec3 uHazeColor;')
          .replace(
            '#include <map_fragment>',
            `#include <map_fragment>
             float paintedVariation = sin(vClassroomWorldPosition.x * 2.1 + sin(vClassroomWorldPosition.z * 1.7))
               * sin(vClassroomWorldPosition.y * 2.8 + vClassroomWorldPosition.x * 0.9);
             diffuseColor.rgb *= 1.0 + paintedVariation * 0.035;`
          )
          .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= 0.68;')
          .replace(
            '#include <fog_fragment>',
            `#include <fog_fragment>
             // Sunlit air: surfaces soften and pale toward the light's color with distance,
             // so furniture reads as painted background rather than crisp props.
             float hazeDistance = length(vClassroomWorldPosition - cameraPosition);
             float haze = 0.05 + 0.16 * smoothstep(1.5, 11.0, hazeDistance);
             float luma = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
             gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(luma), 0.06);
             gl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeColor, haze);`
          );
      };
      toon.customProgramCacheKey = () => 'classroom-lit-toon-v5';
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

  private curtainMaterial(source: THREE.Material): THREE.Material {
    // Sheer fabric glows with the sun behind it, so it is unlit and denser in its folds.
    const curtain = new THREE.MeshBasicMaterial({
      name: `${source.name} | backlit sheer`,
      color: '#f7e8d2',
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
      // One pass keeps overlapping folds in a stable order while the fabric sways.
      forceSinglePass: true,
    });
    curtain.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.timeUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vFold;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vFold = abs(normal.z);
           // Hanging from the rail: the hem moves most, and gusts roll along the window bank.
           float hang = clamp((${CURTAIN_TOP_Y.toFixed(3)} - transformed.y) / ${CURTAIN_HEIGHT.toFixed(2)}, 0.0, 1.0);
           float gust = 0.55 + 0.45 * sin(uTime * 0.7 + transformed.z * 0.35);
           transformed.x += hang * hang * gust * (0.11 + 0.05 * sin(uTime * 1.9 + transformed.z * 4.0 + transformed.y * 2.0));
           transformed.z += hang * 0.035 * sin(uTime * 1.3 + transformed.z * 2.5);`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vFold;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           diffuseColor.rgb *= 1.0 - vFold * 0.28;
           diffuseColor.a = min(1.0, diffuseColor.a + vFold * 0.35);`
        );
    };
    curtain.customProgramCacheKey = () => 'classroom-sheer-curtain-v1';
    return curtain;
  }

  private glassMaterial(source: THREE.Material): THREE.Material {
    // Clear panes with a faint warm sheen; the courtyard painting shows through.
    return new THREE.MeshBasicMaterial({
      name: `${source.name} | clear`,
      color: '#fff4e4',
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  private createCourtyardBackdrop(): THREE.Mesh {
    const texture = new THREE.TextureLoader().load(resolveAssetUrl('/textures/school-courtyard-far.avif'));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    const material = new THREE.MeshBasicMaterial({ map: texture, fog: false });
    // The midday courtyard is pushed toward the late-afternoon haze of the room.
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         diffuseColor.rgb = mix(diffuseColor.rgb * vec3(1.06, 0.96, 0.84), vec3(1.0, 0.9, 0.77), 0.24);`
      );
    };
    material.customProgramCacheKey = () => 'classroom-courtyard-backdrop-v1';
    // Far enough that the far wing sits at eye level, as seen from an upper floor.
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(36, 20.15), material);
    backdrop.name = 'Courtyard painted backdrop';
    backdrop.position.set(-17, -1.6, 0);
    backdrop.rotation.y = Math.PI / 2;
    return backdrop;
  }

  private createChalkWriting(): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = Math.round(2048 * BLACKBOARD.height / BLACKBOARD.width);
    const ctx = canvas.getContext('2d')!;
    const random = seededRandom(24);
    const font = (size: number) => `${size}px "Hiragino Maru Gothic ProN", "Hiragino Sans", "Yu Gothic", sans-serif`;

    // Wiped-off chalk haze from earlier lessons.
    ctx.filter = 'blur(18px)';
    for (let i = 0; i < 18; i += 1) {
      ctx.fillStyle = `rgba(232, 240, 236, ${0.012 + random() * 0.014})`;
      ctx.beginPath();
      ctx.ellipse(
        300 + random() * 1300, 80 + random() * (canvas.height - 160),
        180 + random() * 320, 22 + random() * 30, (random() - 0.5) * 0.12, 0, Math.PI * 2
      );
      ctx.fill();
    }
    ctx.filter = 'none';

    const chalk = (text: string, x: number, y: number, size: number, color = '#f3f5ee') => {
      ctx.font = font(size);
      ctx.fillStyle = color;
      for (let pass = 0; pass < 3; pass += 1) {
        ctx.globalAlpha = 0.34;
        ctx.fillText(text, x + (random() - 0.5) * 2.2, y + (random() - 0.5) * 2.2);
      }
      ctx.globalAlpha = 1;
    };
    const verticalChalk = (text: string, x: number, y: number, size: number) => {
      [...text].forEach((char, i) => chalk(char, x, y + i * size * 1.08, size));
    };

    ctx.textBaseline = 'top';
    chalk('現代文', 96, 70, 74);
    ctx.fillStyle = 'rgba(243, 245, 238, 0.55)';
    ctx.fillRect(96, 158, 250, 5);
    chalk('「羅生門」  芥川龍之介', 110, 200, 56);
    chalk('①  下人の心の動きを追う', 130, 300, 48);
    chalk('②  老婆の言葉と行動', 130, 380, 48);
    chalk('p.128〜135', 130, 470, 44, '#f6e39a');
    verticalChalk('9月24日', 1935, 60, 60);
    verticalChalk('日直', 1840, 60, 54);
    verticalChalk('アオイ', 1840, 200, 50);
    verticalChalk('エミリ', 1760, 200, 50);

    // Chalk skips over the board's grain.
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9000; i += 1) {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.25 + random() * 0.5})`;
      ctx.fillRect(random() * canvas.width, random() * canvas.height, 1.5, 1.5);
    }
    ctx.globalCompositeOperation = 'source-over';

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    const material = this.toonMaterial(
      new THREE.MeshStandardMaterial({ name: 'Chalk writing', map: texture, transparent: true, depthWrite: false })
    );
    const writing = new THREE.Mesh(new THREE.PlaneGeometry(BLACKBOARD.width, BLACKBOARD.height), material);
    writing.name = 'Blackboard chalk writing';
    writing.position.set(0, BLACKBOARD.y, BLACKBOARD.z);
    writing.receiveShadow = true;
    return writing;
  }

  private sunTravelDirection(): THREE.Vector3 {
    const { posX, posY, posZ } = CLASSROOM_LIGHTING.directional;
    return new THREE.Vector3(-posX, -posY, -posZ).normalize();
  }

  /** Soft additive volumes swept from each window pane down to the floor. */
  private createSunBeams(): THREE.Mesh {
    const travel = this.sunTravelDirection();
    const positions: number[] = [];
    const along: number[] = [];
    const indices: number[] = [];
    const floorPoint = (point: THREE.Vector3) => point.clone().addScaledVector(travel, point.y / -travel.y);
    for (const bayZ of WINDOW_BAY_CENTERS_Z) {
      for (const [bottom, top] of WINDOW_PANES_Y) {
        const half = WINDOW_BAY_WIDTH / 2 - 0.05;
        const pane = [
          new THREE.Vector3(WINDOW_X, bottom, bayZ - half),
          new THREE.Vector3(WINDOW_X, bottom, bayZ + half),
          new THREE.Vector3(WINDOW_X, top, bayZ + half),
          new THREE.Vector3(WINDOW_X, top, bayZ - half),
        ];
        const base = positions.length / 3;
        for (const corner of pane) {
          positions.push(corner.x, corner.y, corner.z);
          along.push(0);
        }
        for (const corner of pane) {
          const end = floorPoint(corner);
          positions.push(end.x, end.y, end.z);
          along.push(1);
        }
        // Four side walls of the swept pane.
        for (let i = 0; i < 4; i += 1) {
          const a = base + i;
          const b = base + ((i + 1) % 4);
          indices.push(a, b, b + 4, a, b + 4, a + 4);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
    geometry.setIndex(indices);
    const material = new THREE.ShaderMaterial({
      name: 'Classroom sun beams',
      uniforms: {
        uTime: this.timeUniform,
        uColor: { value: new THREE.Color('#ffd9a8') },
        uStrength: { value: 0.085 },
      },
      vertexShader: `
        attribute float along;
        varying float vAlong;
        varying vec3 vWorld;
        void main() {
          vAlong = along;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uStrength;
        varying float vAlong;
        varying vec3 vWorld;
        void main() {
          // Interpolation can nudge vAlong past 1; pow() of a negative base is NaN, which bloom would spread.
          float fade = pow(max(1.0 - vAlong, 0.0), 1.4) * smoothstep(0.0, 0.06, vAlong);
          float streak = 0.72 + 0.28 * sin(vWorld.z * 6.0 + vWorld.y * 2.5 + uTime * 0.35);
          gl_FragColor = vec4(uColor * uStrength * fade * streak, 1.0);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const beams = new THREE.Mesh(geometry, material);
    beams.name = 'Classroom sun beams';
    beams.renderOrder = 2;
    beams.frustumCulled = false;
    return beams;
  }

  /** Dust drifting through the sunlit volumes, drawn as camera-facing quads. */
  private createDustMotes(): THREE.Mesh {
    const travel = this.sunTravelDirection();
    const random = seededRandom(7);
    const count = 220;
    const centers = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const bayZ = WINDOW_BAY_CENTERS_Z[Math.floor(random() * WINDOW_BAY_CENTERS_Z.length)];
      const start = new THREE.Vector3(
        WINDOW_X,
        0.95 + random() * 1.8,
        bayZ + (random() - 0.5) * WINDOW_BAY_WIDTH
      );
      const point = start.addScaledVector(travel, random() * 0.75 * start.y / -travel.y);
      centers.set([point.x, point.y, point.z], i * 3);
      seeds[i] = random() * 100;
    }
    const quad = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index;
    geometry.setAttribute('position', quad.getAttribute('position'));
    geometry.setAttribute('uv', quad.getAttribute('uv'));
    geometry.setAttribute('center', new THREE.InstancedBufferAttribute(centers, 3));
    geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 1));
    geometry.instanceCount = count;
    const material = new THREE.ShaderMaterial({
      name: 'Classroom dust motes',
      uniforms: { uTime: this.timeUniform },
      vertexShader: `
        uniform float uTime;
        attribute vec3 center;
        attribute float seed;
        varying vec2 vUv;
        varying float vTwinkle;
        void main() {
          vec3 p = center;
          p.x += sin(uTime * 0.13 + seed) * 0.18;
          p.y += sin(uTime * 0.09 + seed * 1.7) * 0.22;
          p.z += cos(uTime * 0.11 + seed * 0.6) * 0.18;
          vUv = uv;
          // Stays positive: additive blending would turn a negative value into a dark speck.
          vTwinkle = 0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * 1.6 + seed * 3.1));
          vec4 view = modelViewMatrix * vec4(p, 1.0);
          view.xy += position.xy * 0.022;
          gl_Position = projectionMatrix * view;
        }`,
      fragmentShader: `
        varying vec2 vUv;
        varying float vTwinkle;
        void main() {
          float glow = 1.0 - smoothstep(0.0, 0.5, length(vUv - 0.5));
          gl_FragColor = vec4(vec3(1.0, 0.9, 0.72) * glow * vTwinkle * 0.55, 1.0);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const dust = new THREE.Mesh(geometry, material);
    dust.name = 'Classroom dust motes';
    dust.frustumCulled = false;
    dust.renderOrder = 3;
    return dust;
  }

  private shouldCastShadow(materialName: string): boolean {
    const name = materialName.toLowerCase();
    return [
      'varnished desk top', 'sunlit honey wood', 'warm walnut edge',
      'silver painted steel', 'dark seat support', 'beech cabinet',
      'textbook', 'plant', 'leaf green', 'unwritten paper',
      // Window wall, piers and frames: sunlight enters only through the panes.
      'warm cream plaster', 'porcelain wainscot', 'silver window trim',
    ].some((part) => name.includes(part));
  }
}

/** Deterministic noise so the chalk and dust look the same on every visit. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Put saved values back into the live config objects that the UI may still reference. */
function restoreInPlace<T extends object>(target: T, saved: T): void {
  for (const key of Object.keys(saved) as Array<keyof T>) {
    const value = saved[key];
    if (value && typeof value === 'object' && target[key] && typeof target[key] === 'object') {
      restoreInPlace(target[key] as object, value as object);
    } else {
      target[key] = value;
    }
  }
}
