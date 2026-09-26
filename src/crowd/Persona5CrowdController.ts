import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { VRM, VRMHumanBones, VRMHumanoid, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { loadMixamoAnimation } from '../Avatar';
import { getSeamlessLoopClip } from '../animation/seamlessLoop';
import { resolveAssetUrl } from '../utils/path';
import { setDaylight } from '../scene/Daylight';

export interface Persona5CrowdStyleOptions {
  opacity?: number;
  skinColor?: string;
  hairColor?: string;
  clothColor?: string;
  outlineColor?: string;
}

export interface CrowdMemberConfig {
  id: string;
  modelUrl: string;
  motionUrl: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  animTimeOffset?: number;
  // If moving along a path
  movement?: {
    endPosition: [number, number, number];
    speed: number; // meters per second
    loop?: boolean; // teleport back to start
  };
  daylight?: number; // 日なたの明るさ（窓の外の通行人など。0 で室内の光のみ、1 を超えるとブルームで白く飛ぶ）
  renderOrder?: number; // custom renderOrder (e.g. -2 for behind midground)
}

export interface Persona5CrowdMember {
  config: CrowdMemberConfig;
  /** A lightweight copy of the shared model: its own bones, shared geometry and materials. */
  root: THREE.Object3D;
  humanoid: VRMHumanoid;
  mixer: THREE.AnimationMixer;
  action: THREE.AnimationAction | null;
  currentPosition: THREE.Vector3;
}

/** One loaded and styled model that every member using the same URL is copied from. */
interface MobTemplate {
  vrm: VRM;
  materials: THREE.Material[];
}

export const DEFAULT_P5_CROWD_STYLE: Required<Persona5CrowdStyleOptions> = {
  opacity: 0.78,
  skinColor: '#d6dfea', // bright pale blue-gray for skin/face
  hairColor: '#5e6d80', // medium slate blue-gray for hair
  clothColor: '#36404e', // dark slate blue-gray for uniform
  outlineColor: '#1a2029',
};

/** The face's own skin (VRoid names it FaceMouth_00_FACE); eyes and mouth are drawn on it. */
const FACE_BASE_PATTERN = /FaceMouth|_FACE\b|Face_00/i;

/**
 * Applies Persona 5 styled crowd mob visual to a VRM model:
 * - Paints the face flat skin and hides eyes, eyebrows, eyelashes -> faceless (のっぺらぼう)
 * - Replaces the textures with soft per-vertex blue-gray tones taken from their brightness,
 *   so it also works on lightweight models whose hair, skin and clothes share one material
 * - Enables smooth semi-transparency with depthWrite enabled to prevent inside-out clipping
 */
export function applyPersona5MobStyle(
  vrm: VRM,
  options: Persona5CrowdStyleOptions = {}
): THREE.Material[] {
  const style = { ...DEFAULT_P5_CROWD_STYLE, ...options };
  const faceFeaturesPattern = /Eye|Mouth|Brow|Eyeline|Eyelash|Line|Lash|目|口|眉|アイライン|まつげ|まつ毛/i;
  const hairPattern = /Hair|hair|髪/i;
  const skinPattern = /Skin|Body_00|肌/i;
  const shoesPattern = /Shoes|靴/i;
  const toneRamp: Array<[number, THREE.Color]> = [
    [0.0, new THREE.Color(style.outlineColor)],
    [0.18, new THREE.Color(style.clothColor)],
    [0.45, new THREE.Color(style.hairColor)],
    [0.8, new THREE.Color(style.skinColor)],
    [1.0, new THREE.Color(style.skinColor).lerp(new THREE.Color('#ffffff'), 0.35)],
  ];
  const toneSamplers = new Map<THREE.Texture, ToneSampler | null>();
  const alphaMaps = new Map<THREE.Texture, THREE.Texture>();
  const tonedGeometries = new Set<THREE.BufferGeometry>();
  const alphaOnly = (map: THREE.Texture) => {
    let alpha = alphaMaps.get(map);
    if (!alpha) {
      alpha = alphaOnlyTexture(map);
      alphaMaps.set(map, alpha);
    }
    return alpha;
  };

  const touchedMaterials: THREE.Material[] = [];

  vrm.scene.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

      materials.forEach((mat: any) => {
        if (!mat) return;
        touchedMaterials.push(mat);
        const name = mat.name || '';
        const isFaceBase = FACE_BASE_PATTERN.test(name);

        // 1. Hide facial feature geometry (render faceless head)
        if (!isFaceBase && faceFeaturesPattern.test(name)) {
          mat.visible = false;
          return;
        }

        const sourceMap: THREE.Texture | null = mat.map ?? null;
        let sampler: ToneSampler | null = null;
        if (sourceMap && !isFaceBase) {
          if (!toneSamplers.has(sourceMap)) toneSamplers.set(sourceMap, createToneSampler(sourceMap, toneRamp));
          sampler = toneSamplers.get(sourceMap) ?? null;
        }
        // The texture now only cuts out hair tips and lash cards; its picture is gone.
        mat.map = sourceMap ? alphaOnly(sourceMap) : null;
        if (mat.shadeMultiplyTexture) mat.shadeMultiplyTexture = null;

        if (sampler) {
          // 2a. Tones live on the vertices: broad areas (hair, blazer, shirt, skin) survive,
          // everything smaller smears across the triangles, and UV seams never bleed.
          if (!tonedGeometries.has(mesh.geometry)) {
            paintVertexTones(mesh.geometry, sampler);
            tonedGeometries.add(mesh.geometry);
          }
          enableVertexTones(mat);
          if (mat.color) mat.color.set('#ffffff');
          if (mat.shadeColorFactor) mat.shadeColorFactor.setRGB(0.8, 0.82, 0.88);
        } else {
          // 2b. Flat tone: the face (erasing its drawn eyes and mouth) and untextured parts
          let targetHex = style.clothColor;
          if (isFaceBase || skinPattern.test(name)) {
            targetHex = style.skinColor;
          } else if (hairPattern.test(name)) {
            targetHex = style.hairColor;
          } else if (shoesPattern.test(name)) {
            targetHex = '#222832';
          }

          const color = new THREE.Color(targetHex);
          if (mat.color) mat.color.copy(color);
          if (mat.shadeColorFactor) {
            mat.shadeColorFactor.copy(color).multiplyScalar(0.8);
          }
        }
        // Colored highlights would break the monotone look.
        if (mat.matcapTexture) mat.matcapTexture = null;
        if (mat.rimMultiplyTexture) mat.rimMultiplyTexture = null;
        if (mat.emissiveMap) mat.emissiveMap = null;
        mat.emissive?.set?.('#000000');

        // Outline coloring if MToon supports it
        if (mat.outlineColorFactor) {
          mat.outlineColorFactor.set(style.outlineColor);
        }
        if (typeof mat.outlineWidthFactor === 'number') {
          // No crisp lines: the mob should read as a soft silhouette.
          mat.outlineWidthFactor = 0;
        }
        // A gentle gradient instead of a hard toon terminator.
        if (typeof mat.shadingToonyFactor === 'number') mat.shadingToonyFactor = 0.35;
        if (typeof mat.shadingShiftFactor === 'number') mat.shadingShiftFactor = -0.1;

        // 3. Semi-transparency with depth write
        if (style.opacity < 1.0) {
          mat.transparent = true;
          mat.opacity = style.opacity;
          mat.depthWrite = true;
        } else {
          mat.transparent = false;
          mat.opacity = 1.0;
        }

        mat.needsUpdate = true;
      });
    }
  });

  // Optimize mob: disable physics and lookAt
  if (vrm.springBoneManager) {
    vrm.springBoneManager.reset();
  }
  if (vrm.lookAt) {
    vrm.lookAt.autoUpdate = false;
  }

  return touchedMaterials;
}

/** Long side of the tiny copy the texture is averaged down to; details below this size vanish. */
const MOB_TEXTURE_DETAIL = 48;

/** Looks up the mob tone (linear color) at a UV. */
type ToneSampler = (u: number, v: number, target: THREE.Color) => THREE.Color;

/** Scales an image through repeated halving, so every texel is averaged in instead of sampling a few. */
function shrinkImage(
  image: CanvasImageSource & { width: number; height: number },
  longSide: number
): HTMLCanvasElement | null {
  let current: CanvasImageSource = image;
  let width = image.width;
  let height = image.height;
  const targetScale = Math.min(1, longSide / Math.max(width, height));
  while (true) {
    const halve = Math.max(width, height) / 2 > longSide;
    const step = document.createElement('canvas');
    step.width = Math.max(1, Math.round(halve ? width / 2 : image.width * targetScale));
    step.height = Math.max(1, Math.round(halve ? height / 2 : image.height * targetScale));
    const ctx = step.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(current, 0, 0, step.width, step.height);
    current = step;
    width = step.width;
    height = step.height;
    if (!halve) return step;
  }
}

/**
 * Averages a texture down until only broad areas of color remain, and maps
 * their brightness onto the tone ramp with reduced contrast.
 */
function createToneSampler(source: THREE.Texture, ramp: Array<[number, THREE.Color]>): ToneSampler | null {
  const image = source.image as CanvasImageSource & { width: number; height: number };
  if (!image?.width || !image?.height) return null;
  const small = shrinkImage(image, MOB_TEXTURE_DETAIL);
  const data = small?.getContext('2d', { willReadFrequently: true })
    ?.getImageData(0, 0, small.width, small.height).data;
  if (!small || !data) return null;
  const { width, height } = small;

  // Brightness per texel, then the ramp (in linear color) per brightness.
  const brightness = new Float32Array(width * height);
  for (let i = 0; i < brightness.length; i += 1) {
    const p = i * 4;
    brightness[i] = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255;
  }
  const toneAt = (brightnessValue: number, target: THREE.Color) => {
    // Pull toward the middle so the parts read as soft masses, not a crisp print.
    const l = 0.5 + (brightnessValue - 0.5) * 0.7;
    let upper = 1;
    while (upper < ramp.length - 1 && ramp[upper][0] < l) upper += 1;
    const [l0, c0] = ramp[upper - 1];
    const [l1, c1] = ramp[upper];
    return target.copy(c0).lerp(c1, THREE.MathUtils.clamp((l - l0) / Math.max(l1 - l0, 1e-6), 0, 1));
  };

  return (u, v, target) => {
    // glTF UVs start at the image's top-left (flipY is off), matching canvas rows.
    const x = THREE.MathUtils.euclideanModulo(u, 1) * width - 0.5;
    const y = THREE.MathUtils.euclideanModulo(v, 1) * height - 0.5;
    const x0 = THREE.MathUtils.clamp(Math.floor(x), 0, width - 1);
    const y0 = THREE.MathUtils.clamp(Math.floor(y), 0, height - 1);
    const x1 = Math.min(x0 + 1, width - 1);
    const y1 = Math.min(y0 + 1, height - 1);
    const fx = THREE.MathUtils.clamp(x - x0, 0, 1);
    const fy = THREE.MathUtils.clamp(y - y0, 0, 1);
    const top = brightness[y0 * width + x0] * (1 - fx) + brightness[y0 * width + x1] * fx;
    const bottom = brightness[y1 * width + x0] * (1 - fx) + brightness[y1 * width + x1] * fx;
    return toneAt(top * (1 - fy) + bottom * fy, target);
  };
}

/**
 * Turns on vertex colors for a material. MToon ignores them by default, and its shader
 * still reads vColor as vec3 while current three.js declares it vec4, so that is patched.
 */
function enableVertexTones(mat: any): void {
  mat.vertexColors = true;
  if (!('ignoreVertexColor' in mat)) return;
  mat.ignoreVertexColor = false;
  const baseCompile = mat.onBeforeCompile;
  const baseCacheKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms, renderer: THREE.WebGLRenderer) => {
    baseCompile.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replaceAll('*= vColor;', '*= vColor.rgb;');
  };
  mat.customProgramCacheKey = () => `${baseCacheKey.call(mat)},mob-vertex-tones`;
}

/** Stores the sampled mob tone of every vertex as its vertex color. */
function paintVertexTones(geometry: THREE.BufferGeometry, sampler: ToneSampler): void {
  const uv = geometry.getAttribute('uv');
  if (!uv) return;
  const colors = new Float32Array(uv.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < uv.count; i += 1) {
    sampler(uv.getX(i), uv.getY(i), color).toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** A small white copy of a texture that keeps only its alpha, for cutouts. */
function alphaOnlyTexture(source: THREE.Texture): THREE.Texture {
  const image = source.image as CanvasImageSource & { width: number; height: number };
  if (!image?.width || !image?.height) return source;
  const canvas = shrinkImage(image, 256);
  const ctx = canvas?.getContext('2d', { willReadFrequently: true });
  if (!canvas || !ctx) return source;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let p = 0; p < pixels.data.length; p += 4) {
    pixels.data[p] = 255;
    pixels.data[p + 1] = 255;
    pixels.data[p + 2] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const alpha = source.clone();
  alpha.image = canvas;
  alpha.needsUpdate = true;
  return alpha;
}

/** Walks two identically shaped trees side by side. */
function parallelTraverse(
  a: THREE.Object3D,
  b: THREE.Object3D,
  callback: (a: THREE.Object3D, b: THREE.Object3D) => void
): void {
  callback(a, b);
  for (let i = 0; i < a.children.length; i += 1) {
    parallelTraverse(a.children[i], b.children[i], callback);
  }
}

/**
 * Copies a loaded VRM for another mob: bones are its own so it can move
 * independently, while geometry, materials and textures stay shared.
 */
function cloneMob(vrm: VRM): { root: THREE.Object3D; humanoid: VRMHumanoid } {
  const root = SkeletonUtils.clone(vrm.scene);
  const counterpart = new Map<THREE.Object3D, THREE.Object3D>();
  parallelTraverse(vrm.scene, root, (source, copy) => counterpart.set(source, copy));

  // The template's normalized rig came along as plain nodes; the new humanoid builds its own.
  counterpart.get(vrm.humanoid.normalizedHumanBonesRoot)?.removeFromParent();

  const humanBones: Partial<VRMHumanBones> = {};
  for (const [boneName, bone] of Object.entries(vrm.humanoid.rawHumanBones)) {
    const node = bone && counterpart.get(bone.node);
    if (node) humanBones[boneName as keyof VRMHumanBones] = { node };
  }

  // The rig records rest rotations relative to the model root, as when it was first loaded
  // (before any VRM0 turn-around), so measure it with the root unrotated.
  const rootRotation = root.quaternion.clone();
  root.quaternion.identity();
  root.updateMatrixWorld(true);
  const humanoid = new VRMHumanoid(humanBones as VRMHumanBones);
  root.add(humanoid.normalizedHumanBonesRoot);
  root.quaternion.copy(rootRotation);
  return { root, humanoid };
}

/**
 * Controller for managing background crowd mobs in scenes.
 */
export class Persona5CrowdController {
  private scene: THREE.Scene;
  private members: Map<string, Persona5CrowdMember> = new Map();
  private templates: Map<string, Promise<MobTemplate>> = new Map();
  private styledMaterials: Set<THREE.Material> = new Set();
  private styleOptions: Required<Persona5CrowdStyleOptions>;
  private isVisible: boolean = true;
  private loader: GLTFLoader;

  constructor(scene: THREE.Scene, styleOptions: Persona5CrowdStyleOptions = {}) {
    this.scene = scene;
    this.styleOptions = { ...DEFAULT_P5_CROWD_STYLE, ...styleOptions };

    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
  }

  /** Loads and styles each model once; later members with the same URL reuse it. */
  private loadTemplate(modelUrl: string): Promise<MobTemplate> {
    const resolvedModelUrl = resolveAssetUrl(modelUrl);
    let template = this.templates.get(resolvedModelUrl);
    if (!template) {
      template = (async () => {
        const gltf = await this.loader.loadAsync(resolvedModelUrl);
        const vrm = gltf.userData.vrm as VRM;
        if (!vrm) {
          throw new Error(`Failed to load VRM from ${modelUrl}`);
        }
        VRMUtils.rotateVRM0(vrm);
        const materials = applyPersona5MobStyle(vrm, this.styleOptions);
        materials.forEach((material) => this.styledMaterials.add(material));
        return { vrm, materials };
      })();
      template.catch(() => this.templates.delete(resolvedModelUrl));
      this.templates.set(resolvedModelUrl, template);
    }
    return template;
  }

  public async addMember(config: CrowdMemberConfig): Promise<Persona5CrowdMember> {
    if (this.members.has(config.id)) {
      this.removeMember(config.id);
    }

    const template = await this.loadTemplate(config.modelUrl);
    const { root, humanoid } = cloneMob(template.vrm);

    // Set transform
    const pos = config.position;
    root.position.set(pos[0], pos[1], pos[2]);
    if (typeof config.rotationY === 'number') {
      root.rotation.y = config.rotationY;
    }
    const scale = config.scale ?? 1.0;
    root.scale.set(scale, scale, scale);

    if (typeof config.daylight === 'number') {
      setDaylight(root, config.daylight);
    }

    if (typeof config.renderOrder === 'number') {
      const targetOrder = config.renderOrder;
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          obj.renderOrder = targetOrder;
        }
      });
    }

    root.visible = this.isVisible;
    this.scene.add(root);

    // Animation (the clip targets bone names, so one retarget serves every copy of the model)
    const mixer = new THREE.AnimationMixer(root);
    let action: THREE.AnimationAction | null = null;
    if (config.motionUrl) {
      try {
        const clip = getSeamlessLoopClip(await loadMixamoAnimation(config.motionUrl, template.vrm));
        action = mixer.clipAction(clip);
        action.play();
        if (config.animTimeOffset) {
          action.time = config.animTimeOffset % clip.duration;
        }
      } catch (err) {
        console.warn(`Failed to load motion for crowd member ${config.id}:`, err);
      }
    }

    const member: Persona5CrowdMember = {
      config,
      root,
      humanoid,
      mixer,
      action,
      currentPosition: new THREE.Vector3(pos[0], pos[1], pos[2]),
    };

    this.members.set(config.id, member);
    return member;
  }

  public removeMember(id: string): void {
    const member = this.members.get(id);
    if (!member) return;

    // Geometry and materials belong to the shared template, so only the copy is dropped.
    this.scene.remove(member.root);
    member.mixer.stopAllAction();
    member.mixer.uncacheRoot(member.root);
    this.members.delete(id);
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    for (const member of this.members.values()) {
      member.root.visible = visible;
    }
  }

  public getVisible(): boolean {
    return this.isVisible;
  }

  public setOpacity(opacity: number): void {
    this.styleOptions.opacity = opacity;
    for (const mat of this.styledMaterials) {
      const m = mat as any;
      if (m.visible === false) continue; // Keep face parts hidden
      m.transparent = opacity < 1.0;
      m.opacity = opacity;
      m.depthWrite = true;
      m.needsUpdate = true;
    }
  }

  public update(delta: number): void {
    if (!this.isVisible) return;

    for (const member of this.members.values()) {
      member.mixer.update(delta);

      // Handle linear path movement if configured
      const mv = member.config.movement;
      if (mv) {
        const startPos = new THREE.Vector3(...member.config.position);
        const endPos = new THREE.Vector3(...mv.endPosition);
        const totalDistance = startPos.distanceTo(endPos);

        if (totalDistance > 0.001) {
          const dir = endPos.clone().sub(startPos).normalize();
          const moveStep = mv.speed * delta;
          member.currentPosition.addScaledVector(dir, moveStep);

          const covered = startPos.distanceTo(member.currentPosition);
          if (covered >= totalDistance) {
            if (mv.loop !== false) {
              member.currentPosition.copy(startPos);
            } else {
              member.currentPosition.copy(endPos);
            }
          }
          member.root.position.copy(member.currentPosition);
        }
      }

      // Copy the animated normalized pose onto the model's bones
      member.humanoid.update();
    }
  }

  public clear(): void {
    for (const id of Array.from(this.members.keys())) {
      this.removeMember(id);
    }
  }

  public dispose(): void {
    this.clear();
    for (const template of this.templates.values()) {
      template.then(({ vrm }) => VRMUtils.deepDispose(vrm.scene)).catch(() => {});
    }
    this.templates.clear();
    this.styledMaterials.clear();
  }
}
