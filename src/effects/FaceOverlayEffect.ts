import * as THREE from 'three';
import { resolveAssetUrl } from '../utils/path';

export const FACE_OVERLAY_TEXTURES = {
  blush: '/textures/girl_face_blush.png',
  sweat: '/textures/girl_face_sweat.png',
  anger: '/textures/girl_face_anger.png',
} as const;

export type FaceOverlayKind = keyof typeof FACE_OVERLAY_TEXTURES;
export type FaceOverlayState = Record<FaceOverlayKind, boolean>;
export const FACE_OVERLAY_KINDS = Object.keys(FACE_OVERLAY_TEXTURES) as FaceOverlayKind[];

/** Accept old scenario paths too; the former per-avatar blush maps have been removed. */
export function getFaceOverlayKindForTexture(url: string): FaceOverlayKind | null {
  const match = url.split(/[?#]/)[0].match(/(?:^|\/)(?:girl2?_|)face_(blush|sweat|anger)\.(?:png|avif)$/i);
  return match ? match[1].toLowerCase() as FaceOverlayKind : null;
}

export function isFaceSkinMaterial(material: THREE.Material): boolean {
  return /Face|顔/i.test(material.name)
    && !/Mouth|Eye|Brow|Lash|Line|口|目|眉|まつ/i.test(material.name)
    && !(material as THREE.Material & { isOutline?: boolean }).isOutline;
}

/** Layers use the face's UVs and deformation; neither the base map nor its alpha is changed. */
export class FaceOverlayEffect {
  private disposed = false;
  private loader = new THREE.TextureLoader();
  private textures = new Map<string, Promise<THREE.Texture>>();
  private patches: Array<{
    material: THREE.Material;
    compile: THREE.Material['onBeforeCompile'];
    cacheKey: THREE.Material['customProgramCacheKey'];
  }> = [];
  private layers = Object.fromEntries(FACE_OVERLAY_KINDS.map((kind) => [kind, {
    enabled: false,
    revision: 0,
    texture: { value: null as THREE.Texture | null },
    weight: { value: 0 },
  }])) as Record<FaceOverlayKind, {
    enabled: boolean;
    revision: number;
    texture: { value: THREE.Texture | null };
    weight: { value: number };
  }>;

  constructor(root: THREE.Object3D) {
    const materials = new Set<THREE.Material>();
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry.getAttribute('uv')) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (isFaceSkinMaterial(material)) materials.add(material);
      }
    });
    for (const material of materials) this.patch(material);
  }

  getState(): FaceOverlayState {
    return Object.fromEntries(FACE_OVERLAY_KINDS.map((kind) => [kind, this.layers[kind].enabled])) as FaceOverlayState;
  }

  async setEnabled(kind: FaceOverlayKind, enabled: boolean, url: string = FACE_OVERLAY_TEXTURES[kind]): Promise<void> {
    if (this.disposed) return;
    const layer = this.layers[kind];
    const revision = ++layer.revision;
    layer.enabled = enabled;
    layer.weight.value = 0;
    if (!enabled) return;
    try {
      if (this.patches.length === 0) throw new Error('No face skin material with UVs was found');
      const texture = await this.loadTexture(url);
      if (this.disposed || revision !== layer.revision) return;
      layer.texture.value = texture;
      layer.weight.value = 1;
    } catch (error) {
      if (this.disposed || revision !== layer.revision) return;
      layer.enabled = false;
      throw error;
    }
  }

  private loadTexture(url: string): Promise<THREE.Texture> {
    const resolved = resolveAssetUrl(url);
    let pending = this.textures.get(resolved);
    if (!pending) {
      pending = this.loader.loadAsync(resolved).then((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.anisotropy = 16;
        texture.needsUpdate = true;
        return texture;
      }).catch((error) => {
        this.textures.delete(resolved);
        throw error;
      });
      this.textures.set(resolved, pending);
    }
    return pending;
  }

  private patch(material: THREE.Material): void {
    const compile = material.onBeforeCompile;
    const cacheKey = material.customProgramCacheKey;
    this.patches.push({ material, compile, cacheKey });
    const declarations = FACE_OVERLAY_KINDS.map((kind) => `
      uniform sampler2D faceOverlay_${kind};
      uniform float faceOverlayWeight_${kind};
    `).join('\n');
    const blend = FACE_OVERLAY_KINDS.map((kind) => `
      if (faceOverlayWeight_${kind} > 0.0) {
        vec4 layer = texture2D(faceOverlay_${kind}, vFaceOverlayUv);
        base = mix(base, layer.rgb, layer.a * faceOverlayWeight_${kind});
      }
    `).join('\n');
    material.onBeforeCompile = (shader, renderer) => {
      compile.call(material, shader, renderer);
      for (const kind of FACE_OVERLAY_KINDS) {
        shader.uniforms[`faceOverlay_${kind}`] = this.layers[kind].texture;
        shader.uniforms[`faceOverlayWeight_${kind}`] = this.layers[kind].weight;
      }
      shader.vertexShader = `varying vec2 vFaceOverlayUv;\n${shader.vertexShader}`
        .replace('void main() {', 'void main() {\n vFaceOverlayUv = uv;');
      shader.fragmentShader = `
        varying vec2 vFaceOverlayUv;
        ${declarations}
        vec3 applyFaceOverlays(vec3 base) { ${blend} return base; }
        ${shader.fragmentShader}
      `.replace('#include <alphatest_fragment>', `
        diffuseColor.rgb = applyFaceOverlays(diffuseColor.rgb);
        #include <alphatest_fragment>
      `).replace('material.shadingShift = shadingShiftFactor;', `
        material.shadeColor = applyFaceOverlays(material.shadeColor);
        material.shadingShift = shadingShiftFactor;
      `);
    };
    material.customProgramCacheKey = () => `${cacheKey.call(material)}:face-overlays-v1`;
    material.needsUpdate = true;
  }

  dispose(): void {
    this.disposed = true;
    for (const { material, compile, cacheKey } of this.patches) {
      material.onBeforeCompile = compile;
      material.customProgramCacheKey = cacheKey;
      material.needsUpdate = true;
    }
    this.patches = [];
    for (const pending of this.textures.values()) {
      void pending.then((texture) => texture.dispose(), () => {});
    }
    this.textures.clear();
  }
}
