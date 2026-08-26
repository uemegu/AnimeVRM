import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { AvatarConfig, MaterialStyleParams } from './Config';

export type ToonShaderOptions = {
  bodyPattern?: RegExp;
  hairPattern?: RegExp;
  clothPattern?: RegExp;
  config?: AvatarConfig;
  debug?: boolean;
};

export type ToonShaderController = {
  update: () => void;
  dispose: () => void;
  patched: ReadonlyArray<string>;
  updateMaterialStyle: (kind: 'body' | 'hair' | 'cloth', params: Partial<MaterialStyleParams>) => void;
  updateOutline: (params: Partial<AvatarConfig['outline']>) => void;
  applyFullConfig: (config: AvatarConfig) => void;
};

type MToonLikeMaterial = THREE.Material & {
  isMToonMaterial?: boolean;
  isOutline?: boolean;
  map?: THREE.Texture | null;
  color?: THREE.Color;
  uniforms?: Record<string, { value: any }>;
  shadeColorFactor?: THREE.Color;
  shadingToonyFactor?: number;
  shadingShiftFactor?: number;
  giEqualizationFactor?: number;
  parametricRimColorFactor?: THREE.Color;
  parametricRimFresnelPowerFactor?: number;
  parametricRimLiftFactor?: number;
  rimLightingMixFactor?: number;
  outlineColorFactor?: THREE.Color;
  outlineWidthFactor?: number;
  outlineLightingMixFactor?: number;
  outlineWidthMode?: string;
};

const DEFAULT_FACE_PATTERN = /Face|Mouth|Eye|Brow|Eyelash|Eyeline|顔|目|眉|口/i;
const DEFAULT_BODY_PATTERN = /Body.*SKIN|body|skin|肌|体/i;
const DEFAULT_HAIR_PATTERN = /Hair|hair|髪/i;
const DEFAULT_CLOTH_PATTERN = /Shoes|Cloth|Tops|Bottoms|Onepiece|outfit|dress|jacket|shirt|skirt|shoes|服|靴/i;

type StyleKind = 'body' | 'hair' | 'cloth' | 'face';

const textureColorCache = new WeakMap<THREE.Texture, THREE.Color>();

/**
 * Fast average color extraction from texture image using a downsampled 16x16 canvas
 */
function getTextureAverageColor(texture: THREE.Texture): THREE.Color {
  if (textureColorCache.has(texture)) return textureColorCache.get(texture)!;
  let col = new THREE.Color(0.8, 0.8, 0.8);
  if (texture.image && texture.image.width && texture.image.height) {
    try {
      const cvs = document.createElement('canvas');
      cvs.width = 16;
      cvs.height = 16;
      const ctx = cvs.getContext('2d');
      if (ctx) {
        ctx.drawImage(texture.image, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 60) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }
        if (count > 0) {
          col = new THREE.Color(r / (count * 255), g / (count * 255), b / (count * 255));
        }
      }
    } catch {
      // ignore
    }
  }
  textureColorCache.set(texture, col);
  return col;
}

/**
 * Computes an anime-style outline color by extracting the material's base/shade tone
 * and reducing its lightness (HSL Luma reduction) with a slight saturation boost.
 */
function getDarkenedOutlineColor(material: MToonLikeMaterial, darknessFactor = 0.45): THREE.Color {
  const base = new THREE.Color();
  if (material.map) {
    base.copy(getTextureAverageColor(material.map));
    if (material.shadeColorFactor) {
      base.lerp(material.shadeColorFactor, 0.35);
    }
  } else if (material.shadeColorFactor) {
    base.copy(material.shadeColorFactor);
  } else if (material.color) {
    base.copy(material.color);
  } else {
    base.set('#1f2430');
  }

  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);

  // Boost saturation slightly and reduce lightness
  const s = Math.min(hsl.s * 1.3, 1.0);
  const l = Math.max(hsl.l * darknessFactor, 0.02);

  const result = new THREE.Color();
  result.setHSL(hsl.h, s, l);
  return result;
}

function regexTest(regex: RegExp, value: string): boolean {
  regex.lastIndex = 0;
  return regex.test(value);
}

function classifyStyleMaterial(
  material: MToonLikeMaterial,
  bodyPattern: RegExp,
  hairPattern: RegExp,
  clothPattern: RegExp
): StyleKind | null {
  if (!material.isMToonMaterial) return null;

  const name = material.name || '';
  if (regexTest(DEFAULT_FACE_PATTERN, name)) return 'face';
  if (regexTest(hairPattern, name)) return 'hair';
  if (regexTest(clothPattern, name)) return 'cloth';
  if (regexTest(bodyPattern, name)) return 'body';
  return null;
}

export function applyToonShader(
  vrm: VRM,
  scene: THREE.Scene,
  options: ToonShaderOptions
): ToonShaderController {
  const bodyPattern = options.bodyPattern ?? DEFAULT_BODY_PATTERN;
  const hairPattern = options.hairPattern ?? DEFAULT_HAIR_PATTERN;
  const clothPattern = options.clothPattern ?? DEFAULT_CLOTH_PATTERN;

  let activeConfig = options.config;

  const styledNames: Record<StyleKind, string[]> = { body: [], hair: [], cloth: [], face: [] };
  const trackedMaterials: Array<{
    material: MToonLikeMaterial;
    kind: StyleKind | 'other';
  }> = [];
  const allMToonMaterials: Array<{ material: MToonLikeMaterial; kind: StyleKind | 'other' }> = [];
  const processedMaterials = new Set<THREE.Material>();

  // Traverse and register materials
  vrm.scene.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh) return;

    const mesh = object as THREE.Mesh;
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    sourceMaterials.forEach((sourceMaterial) => {
      if (!sourceMaterial || processedMaterials.has(sourceMaterial)) return;
      processedMaterials.add(sourceMaterial);

      const material = sourceMaterial as MToonLikeMaterial;
      if (!material.isMToonMaterial) return;

      const styleKind = classifyStyleMaterial(material, bodyPattern, hairPattern, clothPattern);
      const kind: StyleKind | 'other' = styleKind ?? 'other';

      allMToonMaterials.push({ material, kind });

      if (material.isOutline) return;

      if (styleKind) {
        trackedMaterials.push({ material, kind: styleKind });
        styledNames[styleKind].push(`${mesh.name || '(mesh)'} / ${material.name || '(material)'}`);
      } else {
        trackedMaterials.push({ material, kind: 'other' });
      }
    });
  });

  // Apply material params directly to MToon parameters
  const applyMaterialStyle = (kind: 'body' | 'hair' | 'cloth', params: Partial<MaterialStyleParams>) => {
    trackedMaterials
      .filter((entry) => entry.kind === kind || (kind === 'body' && entry.kind === 'face'))
      .forEach(({ material, kind: matKind }) => {
        // Shade Color
        if (params.shadeColor) {
          if (material.shadeColorFactor) material.shadeColorFactor.set(params.shadeColor);
          if (material.uniforms?.shadeColorFactor?.value) material.uniforms.shadeColorFactor.value.set(params.shadeColor);
        }
        // Rim Color
        if (params.rimEnabled !== undefined || params.rimColor !== undefined) {
          const isEnabled = params.rimEnabled !== false;
          const effectiveColor = isEnabled ? (params.rimColor ?? '#000000') : '#000000';
          if (material.parametricRimColorFactor) material.parametricRimColorFactor.set(effectiveColor);
          if (material.uniforms?.parametricRimColorFactor?.value) material.uniforms.parametricRimColorFactor.value.set(effectiveColor);
        }
        if (typeof params.shadingToonyFactor === 'number') {
          material.shadingToonyFactor = params.shadingToonyFactor;
          if (material.uniforms?.shadingToonyFactor) material.uniforms.shadingToonyFactor.value = params.shadingToonyFactor;
        }
        // For face, ensure it maintains an anime-safe positive shift so cheeks aren't cut by 3D normal shadows
        if (typeof params.shadingShiftFactor === 'number') {
          const shift = matKind === 'face' ? Math.max(params.shadingShiftFactor, 0.45) : params.shadingShiftFactor;
          material.shadingShiftFactor = shift;
          if (material.uniforms?.shadingShiftFactor) material.uniforms.shadingShiftFactor.value = shift;
        }
        if (typeof params.giEqualizationFactor === 'number') {
          material.giEqualizationFactor = params.giEqualizationFactor;
          if (material.uniforms?.giEqualizationFactor) material.uniforms.giEqualizationFactor.value = params.giEqualizationFactor;
        }
        if (typeof params.parametricRimFresnelPowerFactor === 'number') {
          material.parametricRimFresnelPowerFactor = params.parametricRimFresnelPowerFactor;
          if (material.uniforms?.parametricRimFresnelPowerFactor) material.uniforms.parametricRimFresnelPowerFactor.value = params.parametricRimFresnelPowerFactor;
        }
        if (typeof params.parametricRimLiftFactor === 'number') {
          material.parametricRimLiftFactor = params.parametricRimLiftFactor;
          if (material.uniforms?.parametricRimLiftFactor) material.uniforms.parametricRimLiftFactor.value = params.parametricRimLiftFactor;
        }
        if (typeof params.rimLightingMixFactor === 'number') {
          material.rimLightingMixFactor = params.rimLightingMixFactor;
          if (material.uniforms?.rimLightingMixFactor) material.uniforms.rimLightingMixFactor.value = params.rimLightingMixFactor;
        }
      });

    // If auto outline is enabled or per-material color is active, update outlines
    if (activeConfig?.outline) {
      applyOutline(activeConfig.outline);
    }
  };

  // Apply outline params directly to outline uniform values
  const applyOutline = (outlineCfg: Partial<AvatarConfig['outline']>) => {
    allMToonMaterials.forEach(({ material, kind }) => {
      // Visibility
      if (typeof outlineCfg.enabled === 'boolean') {
        if (material.isOutline) {
          material.visible = outlineCfg.enabled;
        }
      }

      // Lighting mix
      if (typeof outlineCfg.lightingMixFactor === 'number') {
        material.outlineLightingMixFactor = outlineCfg.lightingMixFactor;
        if (material.uniforms?.outlineLightingMixFactor) material.uniforms.outlineLightingMixFactor.value = outlineCfg.lightingMixFactor;
      }

      // Color & Width (Auto vs Per-Material vs Global)
      if (outlineCfg.autoColorFromMaterial) {
        const autoColor = getDarkenedOutlineColor(material, outlineCfg.darknessFactor ?? 0.45);
        if (material.outlineColorFactor) material.outlineColorFactor.copy(autoColor);
        if (material.uniforms?.outlineColorFactor?.value) material.uniforms.outlineColorFactor.value.copy(autoColor);
      } else if (outlineCfg.usePerMaterialColor && activeConfig?.materials) {
        const matParams = kind === 'hair'
          ? activeConfig.materials.hair
          : kind === 'cloth'
          ? activeConfig.materials.cloth
          : activeConfig.materials.body;

        if (matParams.outlineColor) {
          if (material.outlineColorFactor) material.outlineColorFactor.set(matParams.outlineColor);
          if (material.uniforms?.outlineColorFactor?.value) material.uniforms.outlineColorFactor.value.set(matParams.outlineColor);
        }
      } else {
        if (outlineCfg.color) {
          if (material.outlineColorFactor) material.outlineColorFactor.set(outlineCfg.color);
          if (material.uniforms?.outlineColorFactor?.value) material.uniforms.outlineColorFactor.value.set(outlineCfg.color);
        }
      }

      // Width
      if (typeof outlineCfg.widthFactor === 'number') {
        material.outlineWidthFactor = outlineCfg.widthFactor;
        if (material.uniforms?.outlineWidthFactor) material.uniforms.outlineWidthFactor.value = outlineCfg.widthFactor;
      }
    });
  };

  // Initial config application
  if (activeConfig) {
    applyMaterialStyle('body', activeConfig.materials.body);
    applyMaterialStyle('hair', activeConfig.materials.hair);
    applyMaterialStyle('cloth', activeConfig.materials.cloth);
    applyOutline(activeConfig.outline);
  }

  const update = () => {};

  return {
    patched: [
      ...styledNames.body,
      ...styledNames.hair,
      ...styledNames.cloth,
      ...styledNames.face,
    ],
    update,
    updateMaterialStyle: applyMaterialStyle,
    updateOutline: applyOutline,
    applyFullConfig: (newConfig) => {
      activeConfig = newConfig;
      if (newConfig.materials) {
        if (newConfig.materials.body) applyMaterialStyle('body', newConfig.materials.body);
        if (newConfig.materials.hair) applyMaterialStyle('hair', newConfig.materials.hair);
        if (newConfig.materials.cloth) applyMaterialStyle('cloth', newConfig.materials.cloth);
      }
      if (newConfig.outline) {
        applyOutline(newConfig.outline);
      }
    },
    dispose: () => {},
  };
}
