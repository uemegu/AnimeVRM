import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { GenshinAvatarConfig, MaterialStyleParams } from './Config';

export type GenshinLikeShaderOptions = {
  faceControlUrl: string;
  facePattern?: RegExp;
  faceExcludePattern?: RegExp;
  bodyPattern?: RegExp;
  hairPattern?: RegExp;
  clothPattern?: RegExp;
  config?: GenshinAvatarConfig;
  debug?: boolean;
};

export type GenshinLikeShaderController = {
  update: () => void;
  dispose: () => void;
  patched: ReadonlyArray<string>;
  updateFaceShader: (params: Partial<GenshinAvatarConfig['faceShader']>) => void;
  updateMaterialStyle: (kind: 'body' | 'hair' | 'cloth', params: Partial<MaterialStyleParams>) => void;
  updateOutline: (params: Partial<GenshinAvatarConfig['outline']>) => void;
  applyFullConfig: (config: GenshinAvatarConfig) => void;
};

type UniformBag = {
  uGenshinFaceControl: { value: THREE.Texture };
  uGenshinLightDirWS: { value: THREE.Vector3 };
  uGenshinHeadForwardWS: { value: THREE.Vector3 };
  uGenshinHeadRightWS: { value: THREE.Vector3 };
  uGenshinFaceUvMin: { value: THREE.Vector2 };
  uGenshinFaceUvMax: { value: THREE.Vector2 };
  uGenshinShadowColor: { value: THREE.Color };
  uGenshinShadowStrength: { value: number };
  uGenshinSdfSoftness: { value: number };
  uGenshinThresholdOffset: { value: number };
  uGenshinFaceBoundaryColor: { value: THREE.Color };
  uGenshinFaceBoundaryWidth: { value: number };
  uGenshinFaceBoundaryStrength: { value: number };
};

type MaterialUniformBag = {
  uGenshinLightDirWS: { value: THREE.Vector3 };
  uBoundaryColor: { value: THREE.Color };
  uBoundaryWidth: { value: number };
  uBoundaryStrength: { value: number };
};

type MToonLikeMaterial = THREE.Material & {
  isMToonMaterial?: boolean;
  isOutline?: boolean;
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

const DEFAULT_FACE_PATTERN = /N00_000_00_Face_00_SKIN|(^|[_\s.\-])face([_\s.\-]|$)|顔|フェイス/i;
const DEFAULT_EXCLUDE_PATTERN = /mouth|eye|iris|eyeline|eyebrow|brow|lash|teeth|tongue|口|目|眉|歯/i;
const DEFAULT_BODY_PATTERN = /N00_000_00_Body_00_SKIN|N00_000_00_Face_00_SKIN|body|skin|肌|体/i;
const DEFAULT_HAIR_PATTERN = /N00_000_00_HairBack_00_HAIR|hair|髪/i;
const DEFAULT_CLOTH_PATTERN = /N00_003_01_Shoes_01_CLOTH|cloth|outfit|dress|jacket|shirt|skirt|shoes|服|靴/i;

type StyleKind = 'body' | 'hair' | 'cloth';

const FACE_DECLARATIONS = /* glsl */ `
uniform sampler2D uGenshinFaceControl;
uniform vec3 uGenshinLightDirWS;
uniform vec3 uGenshinHeadForwardWS;
uniform vec3 uGenshinHeadRightWS;
uniform vec2 uGenshinFaceUvMin;
uniform vec2 uGenshinFaceUvMax;
uniform vec3 uGenshinShadowColor;
uniform float uGenshinShadowStrength;
uniform float uGenshinSdfSoftness;
uniform float uGenshinThresholdOffset;
uniform vec3 uGenshinFaceBoundaryColor;
uniform float uGenshinFaceBoundaryWidth;
uniform float uGenshinFaceBoundaryStrength;
`;

const FACE_SHADING = /* glsl */ `
  // --------------------------------------------------------------------------
  // Hoyo-style face SDF shading + Anime Color Ramp boundary line
  // --------------------------------------------------------------------------
  {
    vec2 genshinLightXZ = uGenshinLightDirWS.xz;
    vec2 genshinForwardXZ = uGenshinHeadForwardWS.xz;
    vec2 genshinRightXZ = uGenshinHeadRightWS.xz;

    float genshinLightLen = max(length(genshinLightXZ), 0.0001);
    float genshinForwardLen = max(length(genshinForwardXZ), 0.0001);
    float genshinRightLen = max(length(genshinRightXZ), 0.0001);

    genshinLightXZ /= genshinLightLen;
    genshinForwardXZ /= genshinForwardLen;
    genshinRightXZ /= genshinRightLen;

    float genshinFdotL = clamp(dot(genshinForwardXZ, genshinLightXZ), -1.0, 1.0);
    float genshinRdotL = dot(genshinRightXZ, genshinLightXZ);

    float genshinShadowStep = 1.0 - (genshinFdotL * 0.5 + 0.5);
    genshinShadowStep = clamp(genshinShadowStep + uGenshinThresholdOffset, 0.0, 1.0);

    vec2 genshinUvSpan = max(uGenshinFaceUvMax - uGenshinFaceUvMin, vec2(0.0001));
    vec2 genshinFaceUv = (uv - uGenshinFaceUvMin) / genshinUvSpan;

    if (genshinRdotL <= 0.0) {
      genshinFaceUv.x = 1.0 - genshinFaceUv.x;
    }

    genshinFaceUv = clamp(genshinFaceUv, vec2(0.0), vec2(1.0));

    vec4 genshinControl = texture2D(uGenshinFaceControl, genshinFaceUv);
    float genshinFaceSdf = genshinControl.a;
    float genshinFrontMask = genshinControl.g;

    float genshinSoftness = max(uGenshinSdfSoftness, 0.0001);
    float genshinLit = smoothstep(
      genshinShadowStep - genshinSoftness,
      genshinShadowStep + genshinSoftness,
      genshinFaceSdf
    );

    vec3 genshinShadowed = col * uGenshinShadowColor;
    vec3 genshinFaceColor = mix(genshinShadowed, col, genshinLit);

    // Anime Color Ramp (SSS-style warm boundary line on face)
    float faceSdfDist = abs(genshinFaceSdf - genshinShadowStep);
    float faceRampBand = smoothstep(max(uGenshinFaceBoundaryWidth, 0.001), 0.0, faceSdfDist);
    vec3 faceRamp = uGenshinFaceBoundaryColor * (faceRampBand * uGenshinFaceBoundaryStrength * genshinFrontMask);
    genshinFaceColor += faceRamp;

    float genshinAmount = clamp(uGenshinShadowStrength * genshinFrontMask, 0.0, 1.0);
    col = mix(col, genshinFaceColor, genshinAmount);
  }
`;

const MAT_DECLARATIONS = /* glsl */ `
uniform vec3 uGenshinLightDirWS;
uniform vec3 uBoundaryColor;
uniform float uBoundaryWidth;
uniform float uBoundaryStrength;
`;

const MAT_COLOR_RAMP = /* glsl */ `
  // Anime Color Ramp: warm saturated transition line at the shadow terminator
  if (uBoundaryStrength > 0.0 && uBoundaryWidth > 0.0) {
    float dotNLTerm = dot(normal, normalize(uGenshinLightDirWS));
    float boundaryDist = abs(dotNLTerm + shadingShiftFactor);
    float rampBand = smoothstep(max(uBoundaryWidth, 0.001), 0.0, boundaryDist);
    col += uBoundaryColor * (rampBand * uBoundaryStrength);
  }
`;

function regexTest(regex: RegExp, value: string): boolean {
  regex.lastIndex = 0;
  return regex.test(value);
}

function isFaceMaterial(
  mesh: THREE.Mesh,
  material: MToonLikeMaterial,
  facePattern: RegExp,
  faceExcludePattern: RegExp
): boolean {
  if (!material.isMToonMaterial) return false;

  const name = `${mesh.name} ${material.name}`;
  if (regexTest(faceExcludePattern, name)) return false;
  return regexTest(facePattern, name);
}

function classifyStyleMaterial(
  material: MToonLikeMaterial,
  bodyPattern: RegExp,
  hairPattern: RegExp,
  clothPattern: RegExp
): StyleKind | null {
  if (!material.isMToonMaterial) return null;

  const name = material.name || '';
  if (regexTest(hairPattern, name)) return 'hair';
  if (regexTest(clothPattern, name)) return 'cloth';
  if (regexTest(bodyPattern, name)) return 'body';
  return null;
}

function createNeutralControlTexture(): THREE.DataTexture {
  const data = new Uint8Array([255, 0, 255, 255]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.name = 'NeutralFaceControl';
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

function configureControlTexture(texture: THREE.Texture): void {
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.flipY = false;
  texture.needsUpdate = true;
}

function findDirectionalLight(scene: THREE.Scene): THREE.DirectionalLight | null {
  let result: THREE.DirectionalLight | null = null;

  scene.traverse((object) => {
    if (!result && (object as THREE.DirectionalLight).isDirectionalLight) {
      result = object as THREE.DirectionalLight;
    }
  });

  return result;
}

function patchMToonFaceMaterial(
  material: MToonLikeMaterial,
  uniforms: UniformBag,
  debug: boolean
): () => void {
  const originalOnBeforeCompile = material.onBeforeCompile;
  const originalCacheKey = material.customProgramCacheKey;

  if (material.uniforms) {
    Object.assign(material.uniforms, uniforms);
  }

  material.onBeforeCompile = function onBeforeCompile(shader, renderer) {
    originalOnBeforeCompile.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms);

    const mainMarker = 'void main() {';
    if (shader.fragmentShader.includes(mainMarker)) {
      shader.fragmentShader = shader.fragmentShader.replace(
        mainMarker,
        `${FACE_DECLARATIONS}\n${mainMarker}`
      );
    }

    const colorMarkers = [
      'vec3 col = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;',
      'vec3 col = reflectedLight.directDiffuse+reflectedLight.indirectDiffuse;',
    ];
    const colorMarker = colorMarkers.find((candidate) => shader.fragmentShader.includes(candidate));

    if (colorMarker) {
      shader.fragmentShader = shader.fragmentShader.replace(
        colorMarker,
        `${colorMarker}\n${FACE_SHADING}`
      );
    }

    if (debug) {
      console.info(`[GenshinLikeShader] compiled face shader: ${material.name || '(unnamed)'}`);
    }
  };

  material.customProgramCacheKey = () => {
    const base = originalCacheKey ? originalCacheKey.call(material) : '';
    return `${base}|hoshina-face-sdf-color-ramp-v3`;
  };

  material.needsUpdate = true;

  return () => {
    material.onBeforeCompile = originalOnBeforeCompile;
    if (originalCacheKey) {
      material.customProgramCacheKey = originalCacheKey;
    }
    material.needsUpdate = true;
  };
}

function patchMToonBodyMaterial(
  material: MToonLikeMaterial,
  uniforms: MaterialUniformBag,
  debug: boolean
): () => void {
  const originalOnBeforeCompile = material.onBeforeCompile;
  const originalCacheKey = material.customProgramCacheKey;

  if (material.uniforms) {
    Object.assign(material.uniforms, uniforms);
  }

  material.onBeforeCompile = function onBeforeCompile(shader, renderer) {
    originalOnBeforeCompile.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms);

    const mainMarker = 'void main() {';
    if (shader.fragmentShader.includes(mainMarker)) {
      shader.fragmentShader = shader.fragmentShader.replace(
        mainMarker,
        `${MAT_DECLARATIONS}\n${mainMarker}`
      );
    }

    const colorMarkers = [
      'vec3 col = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;',
      'vec3 col = reflectedLight.directDiffuse+reflectedLight.indirectDiffuse;',
    ];
    const colorMarker = colorMarkers.find((candidate) => shader.fragmentShader.includes(candidate));

    if (colorMarker) {
      shader.fragmentShader = shader.fragmentShader.replace(
        colorMarker,
        `${colorMarker}\n${MAT_COLOR_RAMP}`
      );
    }

    if (debug) {
      console.info(`[GenshinLikeShader] compiled body/hair/cloth ramp shader: ${material.name || '(unnamed)'}`);
    }
  };

  material.customProgramCacheKey = () => {
    const base = originalCacheKey ? originalCacheKey.call(material) : '';
    return `${base}|mtoon-color-ramp-v1`;
  };

  material.needsUpdate = true;

  return () => {
    material.onBeforeCompile = originalOnBeforeCompile;
    if (originalCacheKey) {
      material.customProgramCacheKey = originalCacheKey;
    }
    material.needsUpdate = true;
  };
}

export function applyGenshinLikeShader(
  vrm: VRM,
  scene: THREE.Scene,
  options: GenshinLikeShaderOptions
): GenshinLikeShaderController {
  const debug = options.debug ?? true;
  const facePattern = options.facePattern ?? DEFAULT_FACE_PATTERN;
  const faceExcludePattern = options.faceExcludePattern ?? DEFAULT_EXCLUDE_PATTERN;
  const bodyPattern = options.bodyPattern ?? DEFAULT_BODY_PATTERN;
  const hairPattern = options.hairPattern ?? DEFAULT_HAIR_PATTERN;
  const clothPattern = options.clothPattern ?? DEFAULT_CLOTH_PATTERN;

  let activeConfig = options.config;

  const neutralControl = createNeutralControlTexture();
  let loadedControl: THREE.Texture | null = null;
  let disposed = false;

  const lightDirWS = new THREE.Vector3(0.45, 0.75, 0.65).normalize();

  const faceUniforms: UniformBag = {
    uGenshinFaceControl: { value: neutralControl },
    uGenshinLightDirWS: { value: lightDirWS },
    uGenshinHeadForwardWS: { value: new THREE.Vector3(0, 0, 1) },
    uGenshinHeadRightWS: { value: new THREE.Vector3(-1, 0, 0) },
    uGenshinFaceUvMin: { value: new THREE.Vector2(0, 0) },
    uGenshinFaceUvMax: { value: new THREE.Vector2(0.5, 0.5) },
    uGenshinShadowColor: { value: new THREE.Color(activeConfig?.faceShader.shadowColor ?? '#c7abb5') },
    uGenshinShadowStrength: { value: activeConfig?.faceShader.shadowStrength ?? 0.55 },
    uGenshinSdfSoftness: { value: activeConfig?.faceShader.softness ?? 0.018 },
    uGenshinThresholdOffset: { value: activeConfig?.faceShader.thresholdOffset ?? 0.0 },
    uGenshinFaceBoundaryColor: { value: new THREE.Color(activeConfig?.faceShader.boundaryColor ?? '#ff8877') },
    uGenshinFaceBoundaryWidth: { value: activeConfig?.faceShader.boundaryWidth ?? 0.04 },
    uGenshinFaceBoundaryStrength: { value: activeConfig?.faceShader.boundaryStrength ?? 0.55 },
  };

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    options.faceControlUrl,
    (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }

      configureControlTexture(texture);
      texture.name = `HoshinaFaceControl:${options.faceControlUrl}`;
      loadedControl = texture;
      faceUniforms.uGenshinFaceControl.value = texture;

      if (debug) {
        console.info(`[GenshinLikeShader] loaded control texture: ${options.faceControlUrl}`);
      }
    },
    undefined,
    (error) => {
      console.error(
        `[GenshinLikeShader] failed to load ${options.faceControlUrl}. ` +
          'Custom face shadow stays disabled.',
        error
      );
    }
  );

  const restores: Array<() => void> = [];
  const patchedNames: string[] = [];
  const styledNames: Record<StyleKind, string[]> = { body: [], hair: [], cloth: [] };
  const trackedMaterials: Array<{
    material: MToonLikeMaterial;
    kind: StyleKind | 'face' | 'other';
    uniforms?: MaterialUniformBag;
  }> = [];
  const allMToonMaterials: Array<{ material: MToonLikeMaterial; kind: StyleKind | 'face' | 'other' }> = [];
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
      const isFace = isFaceMaterial(mesh, material, facePattern, faceExcludePattern);
      const kind: StyleKind | 'face' | 'other' = isFace ? 'face' : (styleKind ?? 'other');

      allMToonMaterials.push({ material, kind });

      if (material.isOutline) return;

      if (isFace) {
        restores.push(patchMToonFaceMaterial(material, faceUniforms, debug));
        patchedNames.push(`${mesh.name || '(mesh)'} / ${material.name || '(material)'}`);
        trackedMaterials.push({ material, kind: 'face' });
      } else if (styleKind) {
        const matParams = activeConfig?.materials[styleKind];
        const matUniforms: MaterialUniformBag = {
          uGenshinLightDirWS: { value: lightDirWS },
          uBoundaryColor: { value: new THREE.Color(matParams?.boundaryColor ?? '#ff7766') },
          uBoundaryWidth: { value: matParams?.boundaryWidth ?? 0.05 },
          uBoundaryStrength: { value: matParams?.boundaryStrength ?? 0.60 },
        };
        restores.push(patchMToonBodyMaterial(material, matUniforms, debug));
        trackedMaterials.push({ material, kind: styleKind, uniforms: matUniforms });
        styledNames[styleKind].push(`${mesh.name || '(mesh)'} / ${material.name || '(material)'}`);
      } else {
        trackedMaterials.push({ material, kind: 'other' });
      }
    });
  });

  // Apply material params from config directly to uniform values
  const applyMaterialStyle = (kind: StyleKind, params: Partial<MaterialStyleParams>) => {
    // 1. Update surface shading & boundary ramp
    trackedMaterials
      .filter((entry) => entry.kind === kind || (kind === 'body' && entry.kind === 'face'))
      .forEach(({ material, uniforms: matUniforms }) => {
        if (params.shadeColor) {
          if (material.shadeColorFactor) material.shadeColorFactor.set(params.shadeColor);
          if (material.uniforms?.shadeColorFactor?.value) material.uniforms.shadeColorFactor.value.set(params.shadeColor);
        }
        if (params.rimColor) {
          if (material.parametricRimColorFactor) material.parametricRimColorFactor.set(params.rimColor);
          if (material.uniforms?.parametricRimColorFactor?.value) material.uniforms.parametricRimColorFactor.value.set(params.rimColor);
        }
        if (typeof params.shadingToonyFactor === 'number') {
          material.shadingToonyFactor = params.shadingToonyFactor;
          if (material.uniforms?.shadingToonyFactor) material.uniforms.shadingToonyFactor.value = params.shadingToonyFactor;
        }
        if (typeof params.shadingShiftFactor === 'number') {
          material.shadingShiftFactor = params.shadingShiftFactor;
          if (material.uniforms?.shadingShiftFactor) material.uniforms.shadingShiftFactor.value = params.shadingShiftFactor;
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
        // Boundary Color Ramp
        if (matUniforms) {
          if (params.boundaryColor) matUniforms.uBoundaryColor.value.set(params.boundaryColor);
          if (typeof params.boundaryWidth === 'number') matUniforms.uBoundaryWidth.value = params.boundaryWidth;
          if (typeof params.boundaryStrength === 'number') matUniforms.uBoundaryStrength.value = params.boundaryStrength;
        }
      });

    // 2. Update outline for this specific kind if per-material color is active
    if (activeConfig?.outline.usePerMaterialColor) {
      allMToonMaterials
        .filter((entry) => entry.kind === kind || (kind === 'body' && entry.kind === 'face'))
        .forEach(({ material }) => {
          if (params.outlineColor) {
            if (material.outlineColorFactor) material.outlineColorFactor.set(params.outlineColor);
            if (material.uniforms?.outlineColorFactor?.value) material.uniforms.outlineColorFactor.value.set(params.outlineColor);
          }
          if (typeof params.outlineWidthFactor === 'number') {
            material.outlineWidthFactor = params.outlineWidthFactor;
            if (material.uniforms?.outlineWidthFactor) material.uniforms.outlineWidthFactor.value = params.outlineWidthFactor;
          }
        });
    }
  };

  // Apply outline params directly to outline uniform values
  const applyOutline = (outlineCfg: Partial<GenshinAvatarConfig['outline']>) => {
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

      // Color & Width (Global vs Per-Material)
      if (outlineCfg.usePerMaterialColor && activeConfig?.materials) {
        const matParams = kind === 'hair'
          ? activeConfig.materials.hair
          : kind === 'cloth'
          ? activeConfig.materials.cloth
          : activeConfig.materials.body;

        if (matParams.outlineColor) {
          if (material.outlineColorFactor) material.outlineColorFactor.set(matParams.outlineColor);
          if (material.uniforms?.outlineColorFactor?.value) material.uniforms.outlineColorFactor.value.set(matParams.outlineColor);
        }
        if (typeof matParams.outlineWidthFactor === 'number') {
          material.outlineWidthFactor = matParams.outlineWidthFactor;
          if (material.uniforms?.outlineWidthFactor) material.uniforms.outlineWidthFactor.value = matParams.outlineWidthFactor;
        }
      } else {
        if (outlineCfg.color) {
          if (material.outlineColorFactor) material.outlineColorFactor.set(outlineCfg.color);
          if (material.uniforms?.outlineColorFactor?.value) material.uniforms.outlineColorFactor.value.set(outlineCfg.color);
        }
        if (typeof outlineCfg.widthFactor === 'number') {
          material.outlineWidthFactor = outlineCfg.widthFactor;
          if (material.uniforms?.outlineWidthFactor) material.uniforms.outlineWidthFactor.value = outlineCfg.widthFactor;
        }
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

  const head = vrm.humanoid?.getNormalizedBoneNode('head') ?? null;
  const headForwardLocal = new THREE.Vector3(0, 0, 1).normalize();
  const headRightLocal = new THREE.Vector3(-1, 0, 0).normalize();

  const worldQuaternion = new THREE.Quaternion();
  const lightPosition = new THREE.Vector3();
  const lightTargetPosition = new THREE.Vector3();
  let directionalLight = findDirectionalLight(scene);

  const update = () => {
    if (head) {
      head.getWorldQuaternion(worldQuaternion);
      faceUniforms.uGenshinHeadForwardWS.value
        .copy(headForwardLocal)
        .applyQuaternion(worldQuaternion)
        .normalize();
      faceUniforms.uGenshinHeadRightWS.value
        .copy(headRightLocal)
        .applyQuaternion(worldQuaternion)
        .normalize();
    }

    if (!directionalLight || !directionalLight.parent) {
      directionalLight = findDirectionalLight(scene);
    }

    if (directionalLight) {
      directionalLight.getWorldPosition(lightPosition);
      directionalLight.target.getWorldPosition(lightTargetPosition);
      lightDirWS
        .copy(lightPosition)
        .sub(lightTargetPosition)
        .normalize();
      faceUniforms.uGenshinLightDirWS.value.copy(lightDirWS);
    }
  };

  update();

  return {
    patched: [
      ...patchedNames,
      ...styledNames.body,
      ...styledNames.hair,
      ...styledNames.cloth,
    ],
    update,
    updateFaceShader: (params) => {
      if (params.shadowColor) faceUniforms.uGenshinShadowColor.value.set(params.shadowColor);
      if (typeof params.shadowStrength === 'number') faceUniforms.uGenshinShadowStrength.value = params.shadowStrength;
      if (typeof params.softness === 'number') faceUniforms.uGenshinSdfSoftness.value = params.softness;
      if (typeof params.thresholdOffset === 'number') faceUniforms.uGenshinThresholdOffset.value = params.thresholdOffset;
      if (params.boundaryColor) faceUniforms.uGenshinFaceBoundaryColor.value.set(params.boundaryColor);
      if (typeof params.boundaryWidth === 'number') faceUniforms.uGenshinFaceBoundaryWidth.value = params.boundaryWidth;
      if (typeof params.boundaryStrength === 'number') faceUniforms.uGenshinFaceBoundaryStrength.value = params.boundaryStrength;
    },
    updateMaterialStyle: applyMaterialStyle,
    updateOutline: applyOutline,
    applyFullConfig: (newConfig) => {
      activeConfig = newConfig;
      if (newConfig.faceShader) {
        if (newConfig.faceShader.shadowColor) faceUniforms.uGenshinShadowColor.value.set(newConfig.faceShader.shadowColor);
        if (typeof newConfig.faceShader.shadowStrength === 'number') faceUniforms.uGenshinShadowStrength.value = newConfig.faceShader.shadowStrength;
        if (typeof newConfig.faceShader.softness === 'number') faceUniforms.uGenshinSdfSoftness.value = newConfig.faceShader.softness;
        if (typeof newConfig.faceShader.thresholdOffset === 'number') faceUniforms.uGenshinThresholdOffset.value = newConfig.faceShader.thresholdOffset;
        if (newConfig.faceShader.boundaryColor) faceUniforms.uGenshinFaceBoundaryColor.value.set(newConfig.faceShader.boundaryColor);
        if (typeof newConfig.faceShader.boundaryWidth === 'number') faceUniforms.uGenshinFaceBoundaryWidth.value = newConfig.faceShader.boundaryWidth;
        if (typeof newConfig.faceShader.boundaryStrength === 'number') faceUniforms.uGenshinFaceBoundaryStrength.value = newConfig.faceShader.boundaryStrength;
      }
      if (newConfig.materials) {
        if (newConfig.materials.body) applyMaterialStyle('body', newConfig.materials.body);
        if (newConfig.materials.hair) applyMaterialStyle('hair', newConfig.materials.hair);
        if (newConfig.materials.cloth) applyMaterialStyle('cloth', newConfig.materials.cloth);
      }
      if (newConfig.outline) {
        applyOutline(newConfig.outline);
      }
    },
    dispose: () => {
      disposed = true;
      restores.forEach((restore) => restore());

      if (loadedControl) loadedControl.dispose();
      neutralControl.dispose();
    },
  };
}
