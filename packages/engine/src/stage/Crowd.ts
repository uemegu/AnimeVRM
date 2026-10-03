import * as THREE from 'three';
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
 * Each mob is a still pose: every model is posed with each motion (at a few
 * moments of the clip) and the posed vertices are baked into one plain mesh
 * (no skeleton, one draw per material), shared by every mob in that pose. So a
 * crowd of dozens costs a few VRM loads and no skinning per frame. They
 * breathe a little (a slow sway of the whole figure).
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

/** A baked pose: one geometry with a group per material. */
type Variant = { geometry: THREE.BufferGeometry; materials: THREE.Material[] };
type Mob = { object: THREE.Object3D; x: number; z: number; phase: number };

/**
 * Bakes the posed model (skinning and morphs applied) into one geometry in the
 * model root's space: position, normal and uv, a group per pale material, the
 * parts without one (MToon outlines) left out.
 */
function bakePose(root: THREE.Object3D, paleOf: (material: THREE.Material) => THREE.Material | null): Variant {
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, { position: number[]; normal: number[]; uv: number[]; index: number[] }>();
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  const skin = new THREE.Matrix4(), boneMatrix = new THREE.Matrix4(), meshToRoot = new THREE.Matrix4(), skinToRoot = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    if (!position) return;
    const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh ? (mesh as THREE.SkinnedMesh) : null;
    const skinIndex = geometry.getAttribute('skinIndex');
    const skinWeight = geometry.getAttribute('skinWeight');
    meshToRoot.multiplyMatrices(toRoot, mesh.matrixWorld);
    if (skinned) skinToRoot.multiplyMatrices(meshToRoot, skinned.bindMatrixInverse);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const ranges = geometry.groups.length
      ? geometry.groups.map((g) => ({ start: g.start, count: g.count, material: materials[g.materialIndex ?? 0] }))
      : [{ start: 0, count: geometry.index ? geometry.index.count : position.count, material: materials[0] }];
    // Morph targets in use (VRM expressions: usually none in a still pose).
    const morphs = (geometry.morphAttributes.position ?? [])
      .map((attribute, k) => ({ attribute, weight: mesh.morphTargetInfluences?.[k] ?? 0 }))
      .filter((morph) => morph.weight !== 0);
    // Each source vertex is baked once and copied into every bucket that uses it.
    const baked = new Map<number, number>();
    const bakedPositions: number[] = [], bakedNormals: number[] = [];
    const bake = (i: number): number => {
      let slot = baked.get(i);
      if (slot !== undefined) return slot;
      slot = bakedPositions.length / 3;
      baked.set(i, slot);
      p.fromBufferAttribute(position, i);
      for (const morph of morphs) {
        const base = geometry.morphTargetsRelative ? 0 : 1;
        p.x += morph.weight * (morph.attribute.getX(i) - base * position.getX(i));
        p.y += morph.weight * (morph.attribute.getY(i) - base * position.getY(i));
        p.z += morph.weight * (morph.attribute.getZ(i) - base * position.getZ(i));
      }
      if (skinned && skinIndex && skinWeight) {
        // As three's skinning: matrixWorld · bindMatrixInverse · Σ weight · bone · boneInverse · bindMatrix, then to the root.
        skin.elements.fill(0);
        for (let k = 0; k < 4; k++) {
          const weight = skinWeight.getComponent(i, k);
          if (weight === 0) continue;
          const bone = skinIndex.getComponent(i, k);
          boneMatrix.multiplyMatrices(skinned.skeleton.bones[bone].matrixWorld, skinned.skeleton.boneInverses[bone]);
          for (let e = 0; e < 16; e++) skin.elements[e] += boneMatrix.elements[e] * weight;
        }
        skin.multiply(skinned.bindMatrix).premultiply(skinToRoot);
      } else {
        skin.copy(meshToRoot);
      }
      p.applyMatrix4(skin);
      bakedPositions.push(p.x, p.y, p.z);
      if (normal) n.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix.setFromMatrix4(skin)).normalize();
      else n.set(0, 1, 0);
      bakedNormals.push(n.x, n.y, n.z);
      return slot;
    };
    for (const range of ranges) {
      const pale = range.material ? paleOf(range.material) : null;
      if (!pale) continue;
      let bucket = buckets.get(pale);
      if (!bucket) buckets.set(pale, (bucket = { position: [], normal: [], uv: [], index: [] }));
      const remap = new Map<number, number>();
      for (let j = range.start; j < range.start + range.count; j++) {
        const i = geometry.index ? geometry.index.getX(j) : j;
        let target = remap.get(i);
        if (target === undefined) {
          const slot = bake(i);
          target = bucket.position.length / 3;
          remap.set(i, target);
          bucket.position.push(bakedPositions[slot * 3], bakedPositions[slot * 3 + 1], bakedPositions[slot * 3 + 2]);
          bucket.normal.push(bakedNormals[slot * 3], bakedNormals[slot * 3 + 1], bakedNormals[slot * 3 + 2]);
          bucket.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
        }
        bucket.index.push(target);
      }
    }
  });

  // One geometry: the buckets one after another, a group each.
  const materials = [...buckets.keys()];
  let vertexCount = 0, indexCount = 0;
  for (const bucket of buckets.values()) { vertexCount += bucket.position.length / 3; indexCount += bucket.index.length; }
  const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), uvs = new Float32Array(vertexCount * 2);
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  const geometry = new THREE.BufferGeometry();
  let vertexOffset = 0, indexOffset = 0;
  materials.forEach((material, materialIndex) => {
    const bucket = buckets.get(material)!;
    positions.set(bucket.position, vertexOffset * 3);
    normals.set(bucket.normal, vertexOffset * 3);
    uvs.set(bucket.uv, vertexOffset * 2);
    for (let j = 0; j < bucket.index.length; j++) indices[indexOffset + j] = bucket.index[j] + vertexOffset;
    geometry.addGroup(indexOffset, bucket.index.length, materialIndex);
    vertexOffset += bucket.position.length / 3;
    indexOffset += bucket.index.length;
  });
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return { geometry, materials };
}

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
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly clock = new THREE.Clock();
  private readonly outline: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Crowd';
    this.group.visible = false;
    scene.add(this.group);
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
      // Pale materials once per model (MToon outlines are dropped: the crowd has its own).
      const replaced = new Map<THREE.Material, THREE.Material | null>();
      const tone = 1 - 0.05 * (m % 3);
      const paleOf = (material: THREE.Material): THREE.Material | null => {
        if (replaced.has(material)) return replaced.get(material)!;
        const pale = (material as { isOutline?: boolean }).isOutline || !material.visible ? null : paleMaterial(material, tone, this.textures);
        if (pale) this.materials.push(pale);
        replaced.set(material, pale);
        return pale;
      };
      // Pose it with each motion at a few moments and bake each pose.
      const mixer = new THREE.AnimationMixer(vrm.scene);
      try {
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
            const variant = bakePose(vrm.scene, paleOf);
            this.geometries.push(variant.geometry);
            variants.push(variant);
            // Let a frame through between bakes (each walks every vertex of the model).
            await new Promise((resolve) => setTimeout(resolve));
            if (key !== this.settingsKey) return;
          }
          action.stop();
        }
      } finally {
        // The baked meshes keep nothing of the VRM (the pale textures are copies).
        mixer.stopAllAction();
        VRMUtils.deepDispose(vrm.scene);
      }
    }
    if (key !== this.settingsKey || variants.length === 0) return;

    for (const area of settings.areas) {
      for (let i = 0; i < area.count; i++) {
        const variant = variants[Math.floor(random() * variants.length)];
        const object = new THREE.Group();
        object.add(new THREE.Mesh(variant.geometry, variant.materials));
        // Dark outline: the back faces pushed out along the normals.
        object.add(new THREE.Mesh(variant.geometry, this.outline));
        const x = THREE.MathUtils.lerp(area.min[0], area.max[0], random());
        const z = THREE.MathUtils.lerp(area.min[1], area.max[1], random());
        object.position.set(x, 0, z);
        const facing = area.facing === undefined ? random() * Math.PI * 2 : THREE.MathUtils.degToRad(area.facing) + (random() - 0.5) * 1.6;
        object.rotation.set(0, facing, 0);
        object.scale.setScalar(0.94 + random() * 0.1);
        this.group.add(object);
        this.mobs.push({ object, x, z, phase: random() * 6.28 });
      }
    }
    this.group.visible = this.enabled;
  }

  private clear(): void {
    for (const mob of this.mobs) mob.object.removeFromParent();
    this.mobs = [];
    this.group.visible = false;
    this.geometries.forEach((geometry) => geometry.dispose());
    this.geometries.length = 0;
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
