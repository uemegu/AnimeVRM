import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import type { LocationCrowd } from '@anime-vrm/scenario';
import { loadMixamoAnimation } from './StageAvatar';
import { resolveAssetUrl } from '../utils/path';

/**
 * A crowd of passers-by drawn as pale, flat figures (the way anime and games
 * like Persona show a crowd: the cast in full colour, everyone else a pale
 * grey silhouette with dark outlines), so the crowd fills the place without
 * competing with the characters.
 *
 * Each mob is a still pose: every model is posed once per motion (at a few
 * moments of the clip) and the posed rigs are cloned, so a crowd of dozens
 * costs a few VRM loads and no animation per frame. They breathe a little
 * (a slow sway of the whole figure).
 *
 * The place decides where they stand (locations.json stage.crowd: areas with
 * a count); the scenario turns them on and off (effects.crowd). Mobs that
 * would stand on or in front of a cast member are hidden every frame.
 */

const outlineVertex = /* glsl */ `
  #include <begin_vertex>
  transformed += normal * uOutlineWidth;
`;

/** Pale flat material: the texture's lightness squeezed into a narrow pale range, with a cool cast. */
function paleMaterial(source: THREE.Material, tone: number, cache: Map<THREE.Texture, THREE.Texture>): THREE.MeshBasicMaterial {
  const map = (source as THREE.MeshBasicMaterial).map ?? null;
  const material = new THREE.MeshBasicMaterial({
    map: map ? paleTexture(map, cache) : null,
    color: new THREE.Color(tone, tone, tone * 1.02),
    transparent: source.transparent,
    alphaTest: (source as THREE.MeshBasicMaterial).alphaTest || (source.transparent ? 0.5 : 0),
    side: source.side,
    toneMapped: false,
    fog: false,
  });
  material.name = `Mob | ${source.name}`;
  return material;
}

/** Converts a texture to pale greyscale once (CPU, cached), keeping its alpha. */
function paleTexture(texture: THREE.Texture, cache: Map<THREE.Texture, THREE.Texture>): THREE.Texture {
  const cached = cache.get(texture);
  if (cached) return cached;
  const image = texture.image as CanvasImageSource & { width: number; height: number };
  const size = Math.min(512, Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(size * image.width / Math.max(image.width, image.height)));
  canvas.height = Math.max(1, Math.round(size * image.height / Math.max(image.width, image.height)));
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const luma = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    // Two flat tones (lit and shade) with a soft step: the cel look survives, the colour does not.
    const tone = 0.56 + 0.28 * THREE.MathUtils.smoothstep(luma, 0.18, 0.5);
    d[i] = tone * 248; d[i + 1] = tone * 250; d[i + 2] = tone * 255;
  }
  context.putImageData(pixels, 0, 0);
  const pale = new THREE.CanvasTexture(canvas);
  pale.colorSpace = THREE.SRGBColorSpace;
  pale.flipY = texture.flipY;
  pale.wrapS = texture.wrapS;
  pale.wrapT = texture.wrapT;
  pale.name = `Mob | ${texture.name}`;
  cache.set(texture, pale);
  return pale;
}

type Variant = { root: THREE.Object3D };
type Mob = { object: THREE.Object3D; x: number; z: number; phase: number };

function seeded(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export class Crowd {
  readonly group = new THREE.Group();
  private mobs: Mob[] = [];
  private settingsKey = '';
  private enabled = false;
  private readonly textures = new Map<THREE.Texture, THREE.Texture>();
  private readonly materials: THREE.Material[] = [];
  private readonly vrms: VRM[] = [];
  private readonly clock = new THREE.Clock();
  private readonly outline: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Crowd';
    this.group.visible = false;
    scene.add(this.group);
    // Dark outline: the back faces of each mob pushed out along the normals.
    this.outline = new THREE.MeshBasicMaterial({ color: '#3a3d4a', side: THREE.BackSide, toneMapped: false, fog: false });
    this.outline.name = 'Mob outline';
    this.outline.onBeforeCompile = (shader) => {
      shader.uniforms.uOutlineWidth = { value: 0.006 };
      shader.vertexShader = 'uniform float uOutlineWidth;\n' + shader.vertexShader.replace('#include <begin_vertex>', outlineVertex);
    };
  }

  /** The place's crowd (or none). Rebuilds only when the settings change. */
  setLocation(settings: LocationCrowd | undefined): void {
    const key = JSON.stringify(settings ?? null);
    if (key === this.settingsKey) return;
    this.settingsKey = key;
    this.clear();
    if (!settings) return;
    void this.build(settings).catch((err) => console.error('群衆を作れません', err));
  }

  /** Scene effect: show the crowd or not. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    this.group.visible = on && this.mobs.length > 0;
  }

  /**
   * Every frame: hide the mobs that stand on a cast member or between the
   * camera and one (they must never cover the characters), and sway the rest.
   */
  update(camera: THREE.Camera, cast: THREE.Vector3[]): void {
    if (!this.group.visible) return;
    const eye = camera.getWorldPosition(new THREE.Vector3());
    const t = this.clock.getElapsedTime();
    const toMob = new THREE.Vector2(), toCast = new THREE.Vector2();
    for (const mob of this.mobs) {
      let hidden = false;
      for (const c of cast) {
        if (Math.hypot(mob.x - c.x, mob.z - c.z) < 0.75) { hidden = true; break; }
        // Between the eye and the character, inside a corridor around the line of sight.
        toCast.set(c.x - eye.x, c.z - eye.z);
        toMob.set(mob.x - eye.x, mob.z - eye.z);
        const length = toCast.length();
        const along = toMob.dot(toCast) / Math.max(length, 1e-4);
        if (along > 0 && along < length) {
          const across = Math.abs(toMob.x * toCast.y - toMob.y * toCast.x) / Math.max(length, 1e-4);
          if (across < 0.6) { hidden = true; break; }
        }
      }
      mob.object.visible = !hidden;
      mob.object.rotation.z = Math.sin(t * 0.7 + mob.phase) * 0.006;
    }
  }

  private async build(settings: LocationCrowd): Promise<void> {
    const key = this.settingsKey;
    const random = seeded(settings.seed ?? 7);
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const motions = settings.motions ?? ['Standing Idle'];
    const variants: Variant[] = [];
    for (const [m, modelUrl] of settings.models.entries()) {
      const gltf = await loader.loadAsync(resolveAssetUrl(modelUrl));
      if (key !== this.settingsKey) return;
      const vrm = gltf.userData.vrm as VRM;
      VRMUtils.rotateVRM0(vrm);
      this.vrms.push(vrm);
      // Pale materials once per model.
      const replaced = new Map<THREE.Material, THREE.Material>();
      const tone = 1 - 0.05 * (m % 3);
      vrm.scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const swap = (material: THREE.Material) => {
          // MToon outlines are a second material on the mesh: drop them, the crowd has its own.
          if ((material as { isOutline?: boolean }).isOutline) return this.hiddenMaterial();
          let pale = replaced.get(material);
          if (!pale) {
            pale = paleMaterial(material, tone, this.textures);
            replaced.set(material, pale);
            this.materials.push(pale);
          }
          return pale;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
      });
      // Pose it with each motion at a few moments and keep a clone of each pose.
      const mixer = new THREE.AnimationMixer(vrm.scene);
      for (const motion of motions) {
        const clip = await loadMixamoAnimation(`/animations/${motion}.fbx`, vrm).catch(() => null);
        if (key !== this.settingsKey) return;
        if (!clip) continue;
        const action = mixer.clipAction(clip);
        action.play();
        for (let k = 0; k < 2; k++) {
          mixer.setTime(clip.duration * random());
          vrm.update(0);
          vrm.scene.updateMatrixWorld(true);
          variants.push({ root: cloneSkinned(vrm.scene) });
        }
        action.stop();
      }
    }
    if (key !== this.settingsKey || variants.length === 0) return;

    for (const area of settings.areas) {
      for (let i = 0; i < area.count; i++) {
        const variant = variants[Math.floor(random() * variants.length)];
        const object = cloneSkinned(variant.root);
        const x = THREE.MathUtils.lerp(area.min[0], area.max[0], random());
        const z = THREE.MathUtils.lerp(area.min[1], area.max[1], random());
        object.position.set(x, 0, z);
        const facing = area.facing === undefined ? random() * Math.PI * 2 : THREE.MathUtils.degToRad(area.facing) + (random() - 0.5) * 1.6;
        object.rotation.set(0, facing, 0);
        object.scale.setScalar(0.94 + random() * 0.1);
        this.addOutline(object);
        object.traverse((child) => { child.frustumCulled = false; });
        this.group.add(object);
        this.mobs.push({ object, x, z, phase: random() * 6.28 });
      }
    }
    this.group.visible = this.enabled;
  }

  private hiddenMaterial(): THREE.Material {
    const material = new THREE.MeshBasicMaterial({ visible: false });
    this.materials.push(material);
    return material;
  }

  /** A back-face outline for every skinned mesh of a mob, sharing its skeleton. */
  private addOutline(root: THREE.Object3D): void {
    const meshes: THREE.SkinnedMesh[] = [];
    root.traverse((object) => { if ((object as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(object as THREE.SkinnedMesh); });
    for (const mesh of meshes) {
      const outline = new THREE.SkinnedMesh(mesh.geometry, this.outline);
      outline.bind(mesh.skeleton, mesh.bindMatrix);
      outline.name = `${mesh.name} | outline`;
      mesh.parent?.add(outline);
      outline.position.copy(mesh.position);
      outline.quaternion.copy(mesh.quaternion);
      outline.scale.copy(mesh.scale);
    }
  }

  private clear(): void {
    for (const mob of this.mobs) mob.object.removeFromParent();
    this.mobs = [];
    this.group.visible = false;
    this.vrms.forEach((vrm) => VRMUtils.deepDispose(vrm.scene));
    this.vrms.length = 0;
    this.materials.forEach((material) => material.dispose());
    this.materials.length = 0;
    this.textures.forEach((texture) => texture.dispose());
    this.textures.clear();
  }

  dispose(): void {
    this.settingsKey = '';
    this.clear();
    this.outline.dispose();
    this.group.removeFromParent();
  }
}
