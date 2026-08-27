import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { AvatarConfig, MaterialStyleParams } from './Config';
import { toggleSmoothNormalsInHierarchy } from './shader/SmoothNormalHelper';

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
  userData: Record<string, any>;
};

const DEFAULT_FACE_PATTERN = /Face|Mouth|Eye|Brow|Eyelash|Eyeline|顔|目|眉|口/i;
const DEFAULT_BODY_PATTERN = /Body.*SKIN|body|skin|肌|体/i;
const DEFAULT_HAIR_PATTERN = /Hair|hair|髪/i;
const DEFAULT_CLOTH_PATTERN = /Shoes|Cloth|Tops|Bottoms|Onepiece|outfit|dress|jacket|shirt|skirt|shoes|suit|pant|服|靴|衣/i;
const NON_HAIR_EXCLUSION_PATTERN = /Face|Mouth|Eye|Brow|Eyelash|Skin|Body|Cloth|Tops|Bottoms|Shoes|Dress|Skirt|Suit|Shirt|Pant|Onepiece|肌|体|顔|目|服|靴|衣/i;

type StyleKind = 'body' | 'hair' | 'cloth' | 'face';

const textureColorCache = new WeakMap<THREE.Texture, THREE.Color>();

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

/**
 * Computes an anime-style automatic shadow color (Auto HSV Shadow)
 * - Skin/Face: Shifts towards warm pink/peach (subsurface blood scattering)
 * - Cloth/Hair: Shifts towards cool blue/purple anime tone with boosted saturation
 */
function computeAutoShadowColor(
  material: MToonLikeMaterial,
  kind: StyleKind | 'other',
  hueShiftAmount = 0.03,
  lightnessFactor = 0.2
): THREE.Color {
  const base = new THREE.Color();
  if (material.map) {
    base.copy(getTextureAverageColor(material.map));
    if (material.color) {
      base.multiply(material.color);
    }
  } else if (material.color) {
    base.copy(material.color);
  } else if (material.userData.originalShadeColor) {
    base.copy(material.userData.originalShadeColor);
  } else {
    base.set('#cccccc');
  }

  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);

  const isSkin = kind === 'body' || kind === 'face';

  if (isSkin) {
    // Warm blood scatter for anime skin with Hue Shift control (shifts towards peach-red 0.98)
    const targetHue = (0.98 + hueShiftAmount + 1.0) % 1.0;
    const h = (hsl.h * 0.2 + targetHue * 0.8 + 1.0) % 1.0;
    const s = Math.min(Math.max(hsl.s * 1.6, 0.38), 0.9);
    const l = Math.max(hsl.l * lightnessFactor, 0.02);
    const res = new THREE.Color();
    res.setHSL(h, s, l);
    return res;
  } else {
    // Anime shadow hue shift (cool or warm based on slider)
    const h = (hsl.h + hueShiftAmount + 1.0) % 1.0;
    const s = Math.min(hsl.s * 1.25, 1.0);
    const l = Math.max(hsl.l * lightnessFactor, 0.02);
    const res = new THREE.Color();
    res.setHSL(h, s, l);
    return res;
  }
}

function regexTest(regex: RegExp, value: string): boolean {
  regex.lastIndex = 0;
  return regex.test(value);
}

function classifyStyleMaterial(
  material: MToonLikeMaterial,
  mesh: THREE.Mesh,
  bodyPattern: RegExp,
  hairPattern: RegExp,
  clothPattern: RegExp
): StyleKind | null {
  if (!material.isMToonMaterial) return null;

  const matName = material.name || '';
  const meshName = mesh.name || '';

  if (regexTest(DEFAULT_FACE_PATTERN, matName) || regexTest(DEFAULT_FACE_PATTERN, meshName)) {
    return 'face';
  }

  const isStrictHair = (regexTest(hairPattern, matName) || regexTest(hairPattern, meshName)) &&
                       !regexTest(NON_HAIR_EXCLUSION_PATTERN, matName.replace(/hair/gi, '')) &&
                       !regexTest(NON_HAIR_EXCLUSION_PATTERN, meshName.replace(/hair/gi, ''));

  if (isStrictHair) {
    return 'hair';
  }

  if (regexTest(clothPattern, matName) || regexTest(clothPattern, meshName)) {
    return 'cloth';
  }

  if (regexTest(bodyPattern, matName) || regexTest(bodyPattern, meshName)) {
    return 'body';
  }

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

      const styleKind = classifyStyleMaterial(material, mesh, bodyPattern, hairPattern, clothPattern);
      const kind: StyleKind | 'other' = styleKind ?? 'other';

      // Preserve original VRM shade color
      if (material.shadeColorFactor) {
        material.userData.originalShadeColor = material.shadeColorFactor.clone();
      }

      // Safely inject Auto Line Weight into outline vertex shader while preserving MToon defines
      if (material.isOutline) {
        const prevOnBeforeCompile = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) => {
          if (prevOnBeforeCompile) {
            prevOnBeforeCompile(shader, renderer);
          }
          shader.vertexShader = shader.vertexShader.replace(
            'vec3 outlineOffset = outlineWidthFactor * worldNormalLength * objectNormal;',
            /* glsl */ `
            vec3 outlineOffset = outlineWidthFactor * worldNormalLength * objectNormal;
            // Auto Line Weight: View Angle silhouette modulation
            float dotNV = abs(dot(normalize(transformedNormal), vec3(0.0, 0.0, 1.0)));
            float lineWeight = 1.0 + (1.0 - dotNV) * 0.45;
            outlineOffset *= lineWeight;
            `
          );
        };
        material.needsUpdate = true;
      }

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
        // Base Color / Tint (litFactor)
        if (params.color) {
          if (material.color) material.color.set(params.color);
          if (material.uniforms?.litFactor?.value) material.uniforms.litFactor.value.set(params.color);
        }

        // Shade Color (Always auto-computed with hue shift and lightness factor)
        const autoShadeColor = computeAutoShadowColor(
          material,
          matKind,
          params.shadowHueShift ?? 0.03,
          params.shadowLightnessFactor ?? 0.2
        );
        if (material.shadeColorFactor) material.shadeColorFactor.copy(autoShadeColor);
        if (material.uniforms?.shadeColorFactor?.value) material.uniforms.shadeColorFactor.value.copy(autoShadeColor);

        // Rim Color & Depth-based Rim suppression on face
        if (params.rimEnabled !== undefined || params.rimColor !== undefined) {
          const isEnabled = params.rimEnabled !== false;
          // For face, always disable rim to prevent whole face glow
          const effectiveColor = (isEnabled && matKind !== 'face') ? (params.rimColor ?? '#000000') : '#000000';
          if (material.parametricRimColorFactor) material.parametricRimColorFactor.set(effectiveColor);
          if (material.uniforms?.parametricRimColorFactor?.value) material.uniforms.parametricRimColorFactor.value.set(effectiveColor);
        }

        // Shading Toony Factor
        if (typeof params.shadingToonyFactor === 'number') {
          material.shadingToonyFactor = params.shadingToonyFactor;
          if (material.uniforms?.shadingToonyFactor) material.uniforms.shadingToonyFactor.value = params.shadingToonyFactor;
        }

        // Shading Shift Factor (Face protection: positive shift prevents cheek cuts)
        if (typeof params.shadingShiftFactor === 'number') {
          const shift = matKind === 'face' ? Math.max(params.shadingShiftFactor, 0.45) : params.shadingShiftFactor;
          material.shadingShiftFactor = shift;
          if (material.uniforms?.shadingShiftFactor) material.uniforms.shadingShiftFactor.value = shift;
        }

        // GI Equalization
        if (typeof params.giEqualizationFactor === 'number') {
          material.giEqualizationFactor = params.giEqualizationFactor;
          if (material.uniforms?.giEqualizationFactor) material.uniforms.giEqualizationFactor.value = params.giEqualizationFactor;
        }

        // Parametric Rim Fresnel Power (High power keeps rim tight on silhouettes only)
        if (typeof params.parametricRimFresnelPowerFactor === 'number') {
          const power = matKind === 'body' ? Math.max(params.parametricRimFresnelPowerFactor, 4.0) : params.parametricRimFresnelPowerFactor;
          material.parametricRimFresnelPowerFactor = power;
          if (material.uniforms?.parametricRimFresnelPowerFactor) material.uniforms.parametricRimFresnelPowerFactor.value = power;
        }

        // Parametric Rim Lift
        if (typeof params.parametricRimLiftFactor === 'number') {
          material.parametricRimLiftFactor = params.parametricRimLiftFactor;
          if (material.uniforms?.parametricRimLiftFactor) material.uniforms.parametricRimLiftFactor.value = params.parametricRimLiftFactor;
        }

        // Rim Lighting Mix
        if (typeof params.rimLightingMixFactor === 'number') {
          material.rimLightingMixFactor = params.rimLightingMixFactor;
          if (material.uniforms?.rimLightingMixFactor) material.uniforms.rimLightingMixFactor.value = params.rimLightingMixFactor;
        }
      });

    // If outline config exists, update outlines
    if (activeConfig?.outline) {
      applyOutline(activeConfig.outline);
    }
  };

  // Apply outline params directly to outline uniform values
  const applyOutline = (outlineCfg: Partial<AvatarConfig['outline']>) => {
    // Dynamic smooth normal toggle on VRM scene hierarchy
    if (typeof outlineCfg.useSmoothNormal === 'boolean') {
      toggleSmoothNormalsInHierarchy(vrm.scene, outlineCfg.useSmoothNormal);
    }

    allMToonMaterials.forEach(({ material, kind }) => {
      // Visibility
      if (typeof outlineCfg.enabled === 'boolean') {
        if (material.isOutline) {
          material.visible = outlineCfg.enabled;
        }
      }

      // Screen-space stable outline width mode
      if (outlineCfg.screenSpaceWidth !== undefined) {
        const mode = outlineCfg.screenSpaceWidth ? 'screenCoordinates' : 'worldCoordinates';
        material.outlineWidthMode = mode;
      }

      // Lighting mix
      if (typeof outlineCfg.lightingMixFactor === 'number') {
        material.outlineLightingMixFactor = outlineCfg.lightingMixFactor;
        if (material.uniforms?.outlineLightingMixFactor) material.uniforms.outlineLightingMixFactor.value = outlineCfg.lightingMixFactor;
      }

      // Outline Color: Automatically derived from material color / texture
      const darkness = outlineCfg.darknessFactor ?? 0.1;
      const autoColor = getDarkenedOutlineColor(material, darkness);
      if (material.outlineColorFactor) material.outlineColorFactor.copy(autoColor);
      if (material.uniforms?.outlineColorFactor?.value) material.uniforms.outlineColorFactor.value.copy(autoColor);

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
