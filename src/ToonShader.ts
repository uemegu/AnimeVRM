import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { AvatarConfig, MaterialStyleParams, EyeGlowConfig, BottomGradientConfig } from './Config';
import { toggleSmoothNormalsInHierarchy } from './shader/SmoothNormalHelper';
import { createHairShadowUniforms, injectHairShadow, HAIR_SHADOW_LAYER, HairShadowUniforms } from './shader/HairShadow';
import { injectHairRing, createHairRingHeadFrame, updateHairRingHeadFrame } from './shader/HairRing';
import { attachFaceSdf, createFaceSdfFrame, injectFaceSdf } from './shader/FaceSdf';
import { CHARACTER_LAYER } from './postprocessing/LightWrap';

export type ToonShaderOptions = {
  bodyPattern?: RegExp;
  hairPattern?: RegExp;
  clothPattern?: RegExp;
  config?: AvatarConfig;
  camera?: THREE.Camera;
  // 前髪の影（HairShadowRenderer.uniforms）。未指定なら影は出ない
  hairShadow?: HairShadowUniforms;
  debug?: boolean;
};

export type ToonShaderController = {
  update: () => void;
  dispose: () => void;
  patched: ReadonlyArray<string>;
  updateMaterialStyle: (kind: 'body' | 'hair' | 'cloth', params: Partial<MaterialStyleParams>) => void;
  updateOutline: (params: Partial<AvatarConfig['outline']>) => void;
  updateEyeGlow: (cfg?: EyeGlowConfig) => void;
  updateBottomGradient: (cfg?: Partial<BottomGradientConfig>) => void;
  applyFullConfig: (config: AvatarConfig) => void;
};

type MToonLikeMaterial = THREE.Material & {
  isMToonMaterial?: boolean;
  isOutline?: boolean;
  map?: THREE.Texture | null;
  shadeMultiplyTexture?: THREE.Texture | null;
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

const DEFAULT_FACE_PATTERN = /Face|Mouth|顔|口/i;
const DEFAULT_BODY_PATTERN = /Body.*SKIN|body|skin|肌|体/i;
const DEFAULT_HAIR_PATTERN = /Hair|hair|髪/i;
const DEFAULT_CLOTH_PATTERN = /Shoes|Cloth|Tops|Bottoms|Onepiece|outfit|dress|jacket|shirt|skirt|shoes|suit|pant|服|靴|衣/i;
const NON_HAIR_EXCLUSION_PATTERN = /Face|Mouth|Eye|Brow|Eyelash|Skin|Body|Cloth|Tops|Bottoms|Shoes|Dress|Skirt|Suit|Shirt|Pant|Onepiece|肌|体|顔|目|服|靴|衣/i;

export function isEyeMaterial(matName: string): boolean {
  if (/Eyeline|Eyelash|アイライン|まつ毛|まつげ/i.test(matName)) {
    return false;
  }
  return /EyeWhite|EyeIris|EyeHighlight|Eye|目|Iris|白目|瞳|虹彩/i.test(matName);
}

export function isFaceFeatureMaterial(matName: string): boolean {
  return /FaceEyeline|FaceEyelash|FaceBrow|Eyeline|Eyelash|Brow|眉|アイライン|まつ毛|まつげ/i.test(matName);
}

type StyleKind = 'body' | 'hair' | 'cloth' | 'face' | 'eye';

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

  // 1. First check specific face features & eye materials by name
  if (isEyeMaterial(matName)) {
    return 'eye';
  }
  if (isFaceFeatureMaterial(matName)) {
    // Eyeliner, eyelash, and brows are facial line drawings, not skin
    return null;
  }
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

  // 2. Fallback to mesh name (ensure eye and facial features are never classified as skin)
  if (isEyeMaterial(matName) || isFaceFeatureMaterial(matName)) {
    return isEyeMaterial(matName) ? 'eye' : null;
  }
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
  const hairShadowUniforms = options.hairShadow ?? createHairShadowUniforms();
  // 天使の輪: 頭の位置と向き（髪メッシュの描画直前に更新する）
  // 向きは軸がそろった正規化ボーンから取る（Y が上、Z が前）
  const hairRingHeadFrame = createHairRingHeadFrame();
  const headBoneNode = vrm.humanoid?.getNormalizedBoneNode('head') ?? null;
  // 顔の SDF 陰影はバインド姿勢の骨の座標系でマップを作るので、生の頭の骨を使う
  const rawHeadBone = vrm.humanoid?.getRawBoneNode('head') ?? null;
  const faceSdfFrame = createFaceSdfFrame();
  const faceSdfMeshes = new Set<THREE.Mesh>();
  const faceSdfTargets: Array<{ value: number }> = [];
  const hairRingMeshes = new Set<THREE.Mesh>();

  const bottomGradientUniforms = {
    uBottomGradientEnabled: {
      value: (activeConfig?.bottomGradient?.enabled ?? true) ? 1.0 : 0.0,
    },
    uBottomGradientStartY: {
      value: activeConfig?.bottomGradient?.startY ?? 2.0,
    },
    uBottomGradientEndY: {
      value: activeConfig?.bottomGradient?.endY ?? 1.0,
    },
    uBottomGradientIntensity: {
      value: activeConfig?.bottomGradient?.intensity ?? 0.16,
    },
    uBottomGradientShadowWeight: {
      value: activeConfig?.bottomGradient?.shadowWeight ?? 1.0,
    },
    uBottomGradientColor: {
      value: new THREE.Color(activeConfig?.bottomGradient?.color ?? '#101018'),
    },
    uCameraMatrixWorld: {
      value: options.camera ? options.camera.matrixWorld : new THREE.Matrix4(),
    },
  };

  const styledNames: Record<StyleKind, string[]> = { body: [], hair: [], cloth: [], face: [], eye: [] };
  const trackedMaterials: Array<{
    material: MToonLikeMaterial;
    kind: StyleKind | 'other';
  }> = [];
  const allMToonMaterials: Array<{ material: MToonLikeMaterial; kind: StyleKind | 'other' }> = [];
  const processedMaterials = new Set<THREE.Material>();
  const originalBaseColors = new Map<MToonLikeMaterial, THREE.Color>();

  // Traverse and register materials
  vrm.scene.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh) return;

    const mesh = object as THREE.Mesh;
    mesh.frustumCulled = false;
    // キャラのマスク（ライトラップなど）に描く
    mesh.layers.enable(CHARACTER_LAYER);
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    sourceMaterials.forEach((sourceMaterial) => {
      // 前髪の影: 髪メッシュは深度マスクに描く（マテリアル共有でも全メッシュを登録する）
      if (sourceMaterial && classifyStyleMaterial(sourceMaterial as MToonLikeMaterial, mesh, bodyPattern, hairPattern, clothPattern) === 'hair') {
        mesh.layers.enable(HAIR_SHADOW_LAYER);
        if (headBoneNode && !hairRingMeshes.has(mesh)) {
          hairRingMeshes.add(mesh);
          const prevOnBeforeRender = mesh.onBeforeRender;
          mesh.onBeforeRender = function (...args) {
            updateHairRingHeadFrame(hairRingHeadFrame, headBoneNode);
            prevOnBeforeRender.apply(this, args);
          };
        }
      }
      if (!sourceMaterial || processedMaterials.has(sourceMaterial)) return;
      processedMaterials.add(sourceMaterial);

      const material = sourceMaterial as MToonLikeMaterial;
      if (!material.isMToonMaterial) return;
      originalBaseColors.set(material, (material.color ?? material.uniforms?.litFactor?.value ?? new THREE.Color(1, 1, 1)).clone());

      const styleKind = classifyStyleMaterial(material, mesh, bodyPattern, hairPattern, clothPattern);
      const kind: StyleKind | 'other' = styleKind ?? 'other';

      // 前髪の影を受けるのは顔・目・肌
      const hairShadowReceiver = {
        value: !material.isOutline && (kind === 'face' || kind === 'eye' || kind === 'body') ? 1 : 0,
      };
      // 天使の輪を描くのは髪（アウトラインを除く）
      const hairRingTarget = { value: !material.isOutline && kind === 'hair' ? 1 : 0 };
      // 顔の陰影を SDF マップで決めるのは顔の肌・口まわり（アウトラインを除く）。マップは走査後にまとめて作る
      const faceSdfTarget = { value: 0 };
      if (!material.isOutline && kind === 'face') {
        faceSdfMeshes.add(mesh);
        faceSdfTargets.push(faceSdfTarget);
      }

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
        material.userData.uAutoLineWeight = {
          value: (activeConfig?.outline?.autoLineWeight ?? true) ? 1.0 : 0.0,
        };
        const prevOutlineCompile = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) => {
          if (prevOutlineCompile) {
            prevOutlineCompile(shader, renderer);
          }
          shader.uniforms.uAutoLineWeight = material.userData.uAutoLineWeight;
          shader.vertexShader = shader.vertexShader.replace(
            'void main() {',
            /* glsl */ `
            uniform float uAutoLineWeight;
            void main() {
            `
          );
          shader.vertexShader = shader.vertexShader.replace(
            'vec3 outlineOffset = outlineWidthFactor * worldNormalLength * objectNormal;',
            /* glsl */ `
            vec3 outlineOffset = outlineWidthFactor * worldNormalLength * objectNormal;
            // Auto Line Weight: View Angle silhouette modulation
            float dotNV = abs(dot(normalize(transformedNormal), vec3(0.0, 0.0, 1.0)));
            float lineWeight = mix(1.0, 1.0 + (1.0 - dotNV) * 0.45, uAutoLineWeight);
            outlineOffset *= lineWeight;
            `
          );
        };
        material.needsUpdate = true;
      }

      // Inject Bottom Gradient (Vertical Shading / Grounding shadow) into fragment shader for ALL MToon materials
      const prevOnBeforeCompile = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        if (prevOnBeforeCompile) {
          prevOnBeforeCompile(shader, renderer);
        }

        shader.uniforms.uBottomGradientEnabled = bottomGradientUniforms.uBottomGradientEnabled;
        shader.uniforms.uBottomGradientStartY = bottomGradientUniforms.uBottomGradientStartY;
        shader.uniforms.uBottomGradientEndY = bottomGradientUniforms.uBottomGradientEndY;
        shader.uniforms.uBottomGradientIntensity = bottomGradientUniforms.uBottomGradientIntensity;
        shader.uniforms.uBottomGradientShadowWeight = bottomGradientUniforms.uBottomGradientShadowWeight;
        shader.uniforms.uBottomGradientColor = bottomGradientUniforms.uBottomGradientColor;
        shader.uniforms.uCameraMatrixWorld = bottomGradientUniforms.uCameraMatrixWorld;

        injectHairShadow(shader, hairShadowUniforms, hairShadowReceiver);
        injectHairRing(shader, hairRingTarget, hairRingHeadFrame);
        injectFaceSdf(shader, faceSdfTarget, faceSdfFrame);

        shader.fragmentShader = shader.fragmentShader.replace(
          'void main() {',
          /* glsl */ `
          uniform float uBottomGradientEnabled;
          uniform float uBottomGradientStartY;
          uniform float uBottomGradientEndY;
          uniform float uBottomGradientIntensity;
          uniform float uBottomGradientShadowWeight;
          uniform vec3 uBottomGradientColor;
          uniform mat4 uCameraMatrixWorld;
          void main() {
          `
        );

        // Replace all occurrences of gl_FragColor = vec4( col, diffuseColor.a ); so it hits the main exit at end of shader
        shader.fragmentShader = shader.fragmentShader.replaceAll(
          'gl_FragColor = vec4( col, diffuseColor.a );',
          /* glsl */ `
          if (uBottomGradientEnabled > 0.5) {
            vec4 mtoonWorldPos = uCameraMatrixWorld * vec4(-vViewPosition, 1.0);
            float gradRange = max(0.001, uBottomGradientStartY - uBottomGradientEndY);
            float gradFactor = clamp((mtoonWorldPos.y - uBottomGradientEndY) / gradRange, 0.0, 1.0);
            float smoothGrad = smoothstep(0.0, 1.0, gradFactor);

            // Base height darken factor (1.0 at endY, 0.0 at startY)
            float heightDarken = (1.0 - smoothGrad) * uBottomGradientIntensity;

            // Pixel luminance detection (0.0 = black, 1.0 = white)
            float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
            // Shadow mask: higher weight for already darker pixels
            float shadowMask = 1.0 - smoothstep(0.0, 0.7, lum);

            // Accentuate shadow areas when shadowWeight > 0
            float effectiveDarken = heightDarken * mix(1.0, 1.0 + shadowMask * 1.5, uBottomGradientShadowWeight);
            effectiveDarken = clamp(effectiveDarken, 0.0, 0.95);

            // Tint and darken towards shadow color
            col = mix(col, col * uBottomGradientColor, effectiveDarken);
          }
          gl_FragColor = vec4( col, diffuseColor.a );
          `
        );
      };
      material.needsUpdate = true;

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

  // 顔の SDF 陰影: 顔のメッシュ群から 1 枚のマップを作り、作れたら顔のマテリアルで使う
  if (rawHeadBone && faceSdfMeshes.size > 0 && attachFaceSdf([...faceSdfMeshes], rawHeadBone, faceSdfFrame)) {
    faceSdfTargets.forEach((target) => (target.value = 1));
  }

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

  // Keep eyes clear and prevent shadows on eyeballs (sclera/iris/highlights)
  const setupEyeMaterials = () => {
    allMToonMaterials.forEach(({ material }) => {
      const matName = material.name || '';
      if (isEyeMaterial(matName)) {
        // Eyeballs should never be shaded by skin or directional lighting
        const whiteColor = new THREE.Color(1, 1, 1);
        if (material.shadeColorFactor) material.shadeColorFactor.copy(whiteColor);
        if (material.uniforms?.shadeColorFactor?.value) material.uniforms.shadeColorFactor.value.copy(whiteColor);

        // Always fully lit (shadingShiftFactor = 1.0) so curvature/creases never cast shadow
        material.shadingShiftFactor = 1.0;
        if (material.uniforms?.shadingShiftFactor) material.uniforms.shadingShiftFactor.value = 1.0;

        material.shadingToonyFactor = 1.0;
        if (material.uniforms?.shadingToonyFactor) material.uniforms.shadingToonyFactor.value = 1.0;

        // Suppress rim lighting on eyeball to avoid unnatural glowing white rings
        const blackColor = new THREE.Color(0, 0, 0);
        if (material.parametricRimColorFactor) material.parametricRimColorFactor.copy(blackColor);
        if (material.uniforms?.parametricRimColorFactor?.value) material.uniforms.parametricRimColorFactor.value.copy(blackColor);

        if ((material as any).uniforms?.receiveShadow) {
          (material as any).uniforms.receiveShadow.value = false;
        }
        material.needsUpdate = true;
      }
    });
  };

  // Apply material params directly to MToon parameters
  const applyMaterialStyle = (kind: 'body' | 'hair' | 'cloth', params: Partial<MaterialStyleParams>) => {

    // Deep silhouette mode handling for eyes & facial features
    if (kind === 'body') {
      const isSilhouetteMode = typeof params.shadingShiftFactor === 'number' && params.shadingShiftFactor <= -0.7;
      if (isSilhouetteMode) {
        const shadowCol = new THREE.Color(params.color || '#080a12');
        const blackCol = new THREE.Color(0, 0, 0);
        allMToonMaterials.forEach(({ material }) => {
          const matName = material.name || '';
          if (isEyeMaterial(matName) || isFaceFeatureMaterial(matName)) {
            if (material.shadeColorFactor) material.shadeColorFactor.copy(shadowCol);
            if (material.uniforms?.shadeColorFactor?.value) material.uniforms.shadeColorFactor.value.copy(shadowCol);
            if (material.color) material.color.copy(shadowCol);
            if (material.uniforms?.litFactor?.value) material.uniforms.litFactor.value.copy(shadowCol);
            material.shadingShiftFactor = -1.0;
            if (material.uniforms?.shadingShiftFactor) material.uniforms.shadingShiftFactor.value = -1.0;
            if (material.parametricRimColorFactor) material.parametricRimColorFactor.copy(blackCol);
            if (material.uniforms?.parametricRimColorFactor?.value) material.uniforms.parametricRimColorFactor.value.copy(blackCol);
            if (material.outlineColorFactor) material.outlineColorFactor.copy(shadowCol);
            if (material.uniforms?.outlineColorFactor?.value) material.uniforms.outlineColorFactor.value.copy(shadowCol);
            material.needsUpdate = true;
          }
        });
      } else {
        setupEyeMaterials();
      }
    }

    trackedMaterials
      .filter((entry) => (entry.kind === kind || (kind === 'body' && entry.kind === 'face')) && !isEyeMaterial(entry.material.name || '') && !isFaceFeatureMaterial(entry.material.name || ''))
      .forEach(({ material, kind: matKind }) => {
        // Base Color / Tint (litFactor)
        if (params.color) {
          // White is a neutral tint: preserve VRM base colors as well as textures.
          // Always start from the imported color so repeated updates do not compound.
          const tintedColor = originalBaseColors.get(material)!.clone().multiply(new THREE.Color(params.color));
          if (material.color) material.color.copy(tintedColor);
          if (material.uniforms?.litFactor?.value) material.uniforms.litFactor.value.copy(tintedColor);
        }

        // 影色 = 乗算色 × マテリアル自身のテクスチャ
        if (params.shadeMultiply && !material.shadeMultiplyTexture && material.map) {
          // 影用テクスチャがないマテリアルは基本テクスチャで代用する（ないと影が乗算色のベタ塗りになる）
          material.shadeMultiplyTexture = material.map;
          material.needsUpdate = true;
        }
        if (params.shadeMultiply) {
          // 基本色係数（litFactor）も掛ける。白テクスチャ × 黒係数で色を出しているマテリアルでも影色が合う
          const shadeColor = new THREE.Color(params.shadeMultiply).multiply(originalBaseColors.get(material) ?? new THREE.Color(1, 1, 1));
          if (material.shadeColorFactor) material.shadeColorFactor.copy(shadeColor);
          if (material.uniforms?.shadeColorFactor?.value) material.uniforms.shadeColorFactor.value.copy(shadeColor);
        }

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

        // Shading Shift Factor
        // 顔は通常 SDF 陰影（shader/FaceSdf.ts）が明暗を決めるのでこの値は効かない。
        // SDF が作れなかったとき用に、頬やまぶたに影が割れないよう正の値に寄せる（シルエット表現は除く）
        if (typeof params.shadingShiftFactor === 'number') {
          const shift = matKind === 'face' && params.shadingShiftFactor > -0.7
            ? Math.max(params.shadingShiftFactor, 0.65)
            : params.shadingShiftFactor;
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
          // MToon computes pow(1 - N·V + lift, power); with power 0 that is pow(0, 0) = NaN on
          // pixels facing the camera, and bloom spreads one NaN pixel into a black frame.
          const power = matKind === 'body' ? Math.max(params.parametricRimFresnelPowerFactor, 4.0) : Math.max(params.parametricRimFresnelPowerFactor, 0.001);
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

      // Auto line weight modulation toggle
      if (typeof outlineCfg.autoLineWeight === 'boolean') {
        const weightVal = outlineCfg.autoLineWeight ? 1.0 : 0.0;
        if (material.userData.uAutoLineWeight) {
          material.userData.uAutoLineWeight.value = weightVal;
        }
        if (material.uniforms?.uAutoLineWeight) {
          material.uniforms.uAutoLineWeight.value = weightVal;
        }
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

  // Bottom Gradient controller
  const applyBottomGradient = (cfg?: Partial<BottomGradientConfig>) => {
    if (!cfg) return;
    if (typeof cfg.enabled === 'boolean') {
      bottomGradientUniforms.uBottomGradientEnabled.value = cfg.enabled ? 1.0 : 0.0;
    }
    if (typeof cfg.startY === 'number') {
      bottomGradientUniforms.uBottomGradientStartY.value = cfg.startY;
    }
    if (typeof cfg.endY === 'number') {
      bottomGradientUniforms.uBottomGradientEndY.value = cfg.endY;
    }
    if (typeof cfg.intensity === 'number') {
      bottomGradientUniforms.uBottomGradientIntensity.value = cfg.intensity;
    }
    if (typeof cfg.shadowWeight === 'number') {
      bottomGradientUniforms.uBottomGradientShadowWeight.value = cfg.shadowWeight;
    }
    if (cfg.color) {
      bottomGradientUniforms.uBottomGradientColor.value.set(cfg.color);
    }
  };

  // Initial config application
  if (activeConfig) {
    applyMaterialStyle('body', activeConfig.materials.body);
    applyMaterialStyle('hair', activeConfig.materials.hair);
    applyMaterialStyle('cloth', activeConfig.materials.cloth);
    applyOutline(activeConfig.outline);
    if (activeConfig.bottomGradient) {
      applyBottomGradient(activeConfig.bottomGradient);
    }
  }

  // Ensure eye materials are unlit & shadow-free immediately on load
  setupEyeMaterials();

  const update = () => {
    if (options.camera) {
      bottomGradientUniforms.uCameraMatrixWorld.value = options.camera.matrixWorld;
    }
  };

  return {
    patched: [
      ...styledNames.body,
      ...styledNames.hair,
      ...styledNames.cloth,
      ...styledNames.face,
      ...styledNames.eye,
    ],
    update,
    updateMaterialStyle: (kind, params) => {
      applyMaterialStyle(kind, params);
      setupEyeMaterials();
    },
    updateOutline: applyOutline,
    updateEyeGlow: (cfg) => {
      applyEyeGlow(cfg);
      setupEyeMaterials();
    },
    updateBottomGradient: applyBottomGradient,
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
      if (newConfig.bottomGradient) {
        applyBottomGradient(newConfig.bottomGradient);
      }
      const isSilhouette = typeof newConfig.materials?.body?.shadingShiftFactor === 'number' && newConfig.materials.body.shadingShiftFactor <= -0.7;
      if (!isSilhouette) {
        setupEyeMaterials();
      }
    },
    dispose: () => {},
  };
}
