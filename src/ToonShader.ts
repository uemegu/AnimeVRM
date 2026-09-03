import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { AvatarConfig, MaterialStyleParams, EyeGlowConfig } from './Config';
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
  updateEyeGlow: (cfg?: EyeGlowConfig) => void;
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
  matcapFactor?: THREE.Color;
  matcapTexture?: THREE.Texture | null;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
  emissiveMap?: THREE.Texture | null;
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
  const img = texture.image as (HTMLImageElement | HTMLCanvasElement | ImageBitmap) | undefined;
  if (img && img.width && img.height) {
    try {
      const cvs = document.createElement('canvas');
      cvs.width = 16;
      cvs.height = 16;
      const ctx = cvs.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, 16, 16);
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
  lightnessFactor = 0.2,
  boundaryTint = 0.0
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
    // Warm blood scatter for anime skin with Hue Shift and boundary tint
    // Boundary tint warms hue towards vibrant coral-peach (0.97 - 0.02)
    const tintHueOffset = boundaryTint * -0.04;
    const targetHue = (0.98 + hueShiftAmount + tintHueOffset + 1.0) % 1.0;
    const h = (hsl.h * 0.15 + targetHue * 0.85 + 1.0) % 1.0;
    const s = Math.min(Math.max(hsl.s * (1.6 + boundaryTint * 0.5), 0.38), 0.95);
    const l = Math.max(hsl.l * (lightnessFactor + boundaryTint * 0.04), 0.02);
    const res = new THREE.Color();
    res.setHSL(h, s, l);
    return res;
  } else {
    // Anime shadow hue shift (cool or warm based on slider)
    const h = (hsl.h + hueShiftAmount + 1.0) % 1.0;
    const s = Math.min(hsl.s * (1.25 + boundaryTint * 0.3), 1.0);
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

  // 1. First check material name (handles merged meshes correctly)
  if (regexTest(DEFAULT_FACE_PATTERN, matName)) {
    return 'face';
  }
  if (regexTest(hairPattern, matName)) {
    return 'hair';
  }
  if (regexTest(clothPattern, matName)) {
    return 'cloth';
  }
  if (regexTest(bodyPattern, matName)) {
    return 'body';
  }

  // 2. Fallback to mesh name
  if (regexTest(DEFAULT_FACE_PATTERN, meshName)) {
    return 'face';
  }
  if (regexTest(hairPattern, meshName)) {
    return 'hair';
  }
  if (regexTest(clothPattern, meshName)) {
    return 'cloth';
  }
  if (regexTest(bodyPattern, meshName)) {
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

      // Preserve original VRM shade color, matcap factor & emissive properties
      if (material.shadeColorFactor) {
        material.userData.originalShadeColor = material.shadeColorFactor.clone();
      }
      if (material.matcapFactor) {
        material.userData.originalMatcapFactor = material.matcapFactor.clone();
      } else if (material.uniforms?.matcapFactor?.value) {
        material.userData.originalMatcapFactor = material.uniforms.matcapFactor.value.clone();
      } else {
        material.userData.originalMatcapFactor = new THREE.Color(1, 1, 1);
      }

      if (material.emissive) {
        material.userData.originalEmissive = material.emissive.clone();
      } else if (material.uniforms?.emissive?.value) {
        material.userData.originalEmissive = material.uniforms.emissive.value.clone();
      } else {
        material.userData.originalEmissive = new THREE.Color(1, 1, 1);
      }

      if (typeof material.emissiveIntensity === 'number') {
        material.userData.originalEmissiveIntensity = material.emissiveIntensity;
      } else if (typeof material.uniforms?.emissiveIntensity?.value === 'number') {
        material.userData.originalEmissiveIntensity = material.uniforms.emissiveIntensity.value;
      } else {
        material.userData.originalEmissiveIntensity = 1.0;
      }

      // Safely inject Auto Line Weight into outline vertex shader while preserving MToon defines
      if (material.isOutline) {
        material.alphaToCoverage = true;
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

  // Apply eye highlight glow (luminous sparkle)
  const applyEyeGlow = (eyeGlowCfg?: EyeGlowConfig) => {
    const cfg = eyeGlowCfg || activeConfig?.eyeGlow;
    const isEnabled = cfg ? cfg.enabled : true;
    const intensity = isEnabled ? (cfg?.intensity ?? 1.25) : 0.0;
    const eyeGlowColor = isEnabled ? new THREE.Color(intensity * 1.6, intensity * 1.6, intensity * 1.8) : new THREE.Color(0, 0, 0);

    trackedMaterials.forEach(({ material }) => {
      if (/EyeHighlight|Highlight.*Eye/i.test(material.name || '')) {
        // VRM exports dummy black texture (Shader_NoneBlack) to emissiveMap slot.
        // Replace with actual highlight map so emissive radiates along the eye highlight shape!
        if (material.map && material.emissiveMap !== material.map) {
          material.emissiveMap = material.map;
          if (material.uniforms?.emissiveMap) {
            material.uniforms.emissiveMap.value = material.map;
          }
          material.needsUpdate = true;
        }

        if (material.emissive) material.emissive.copy(eyeGlowColor);
        if (material.uniforms?.emissive?.value) material.uniforms.emissive.value.copy(eyeGlowColor);
        if (typeof material.emissiveIntensity === 'number') material.emissiveIntensity = intensity;
        if (material.uniforms?.emissiveIntensity) material.uniforms.emissiveIntensity.value = intensity;

        // Boost base color brightness slightly when enabled so difference is immediately visible
        const c = isEnabled ? Math.min(2.5, 1.0 + intensity * 0.8) : 1.0;
        if (material.color) {
          material.color.setRGB(c, c, c * 1.05);
        }
        if (material.uniforms?.litFactor?.value) {
          material.uniforms.litFactor.value.setRGB(c, c, c * 1.05);
        }
      }
    });
  };

  // Apply material params directly to MToon parameters
  const applyMaterialStyle = (kind: 'body' | 'hair' | 'cloth', params: Partial<MaterialStyleParams>) => {
    const bodyEntry = trackedMaterials.find((entry) => entry.kind === 'body');

    trackedMaterials
      .filter((entry) => entry.kind === kind || (kind === 'body' && entry.kind === 'face'))
      .forEach(({ material, kind: matKind }) => {
        // Base Color / Tint (litFactor)
        if (params.color) {
          if (material.color) material.color.set(params.color);
          if (material.uniforms?.litFactor?.value) material.uniforms.litFactor.value.set(params.color);
        }

        // Shade Color (Face uses body material as reference so skin shadow matches body perfectly)
        const referenceMaterial = (matKind === 'face' && bodyEntry) ? bodyEntry.material : material;
        const autoShadeColor = computeAutoShadowColor(
          referenceMaterial,
          matKind,
          params.shadowHueShift ?? 0.03,
          params.shadowLightnessFactor ?? 0.2,
          params.shadowBoundaryTint ?? 0.0
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

        // Shading Toony Factor (mildly soften edge if boundary tint is active to show warm SSS gradient)
        if (typeof params.shadingToonyFactor === 'number') {
          const boundarySoftening = (params.shadowBoundaryTint ?? 0) * 0.03;
          const effectiveToony = Math.max(0.0, params.shadingToonyFactor - boundarySoftening);
          material.shadingToonyFactor = effectiveToony;
          if (material.uniforms?.shadingToonyFactor) material.uniforms.shadingToonyFactor.value = effectiveToony;
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

        // Highlight (MatCap & Emissive Texture) ON/OFF & Intensity
        if (params.matcapEnabled !== undefined || params.emissiveIntensity !== undefined) {
          const isEnabled = params.matcapEnabled !== false;
          const intensity = typeof params.emissiveIntensity === 'number' ? params.emissiveIntensity : (isEnabled ? (material.userData.originalEmissiveIntensity ?? 1.0) : 0.0);

          // 1. MatCap Factor (Boost by intensity if > 1.0 to trigger Bloom)
          const origMatcap = (material.userData.originalMatcapFactor as THREE.Color | undefined) ?? new THREE.Color(1, 1, 1);
          const matcapMultiplier = isEnabled ? Math.max(1.0, intensity) : 0.0;
          const targetMatcap = origMatcap.clone().multiplyScalar(matcapMultiplier);
          if (material.matcapFactor) material.matcapFactor.copy(targetMatcap);
          if (material.uniforms?.matcapFactor?.value) material.uniforms.matcapFactor.value.copy(targetMatcap);

          // 2. Emissive (VRM hair highlight textures use emissiveMap / emissive)
          const origEmissive = (material.userData.originalEmissive as THREE.Color | undefined) ?? new THREE.Color(1, 1, 1);
          const baseEmissive = (origEmissive.r === 0 && origEmissive.g === 0 && origEmissive.b === 0) ? new THREE.Color(1, 1, 1) : origEmissive;

          const targetEmissive = isEnabled ? baseEmissive : new THREE.Color(0, 0, 0);
          const targetIntensity = isEnabled ? intensity : 0.0;

          if (material.emissive) material.emissive.copy(targetEmissive);
          if (typeof material.emissiveIntensity === 'number') material.emissiveIntensity = targetIntensity;

          if (material.uniforms?.emissive?.value) material.uniforms.emissive.value.copy(targetEmissive);
          if (material.uniforms?.emissiveIntensity) material.uniforms.emissiveIntensity.value = targetIntensity;
        }
      });

      // Enhance Eye Highlight with luminous glow if enabled
      applyEyeGlow();

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
      const bodyEntry = allMToonMaterials.find((e) => e.kind === 'body' && !e.material.isOutline);
      const referenceMaterial = (kind === 'face' && bodyEntry) ? bodyEntry.material : material;
      const autoColor = getDarkenedOutlineColor(referenceMaterial, darkness);
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
    updateEyeGlow: applyEyeGlow,
    applyFullConfig: (newConfig) => {
      activeConfig = newConfig;
      if (newConfig.materials) {
        if (newConfig.materials.body) applyMaterialStyle('body', newConfig.materials.body);
        if (newConfig.materials.hair) applyMaterialStyle('hair', newConfig.materials.hair);
        if (newConfig.materials.cloth) applyMaterialStyle('cloth', newConfig.materials.cloth);
      }
      applyEyeGlow(newConfig.eyeGlow);
      if (newConfig.outline) {
        applyOutline(newConfig.outline);
      }
    },
    dispose: () => {},
  };
}
