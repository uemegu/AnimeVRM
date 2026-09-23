import * as THREE from 'three';

/**
 * 天使の輪（髪の帯状ハイライト）
 *
 * 頭を球とみなし、頭の中心から見た方向（ビュー空間）の上下成分が一定範囲にある所に帯を描く。
 * 髪の実際の法線は毛束ごとにばらつくので、それだけだと帯が細かい筋に割れてしまう。
 * 球の法線を主に使い、実際の法線を少し混ぜて毛束感を出す。
 * 視点が変わると輪も動き、アニメの天使の輪のように頭の丸みに沿った弧になる。
 * 色はライティング後の髪色を白に寄せて明るくした色なので、髪色・時間帯に追従する。
 *
 * パラメータは数値だけなので全アバター・全レンダラーで共有する（HAIR_RING_UNIFORMS）。
 */

export interface HairRingParams {
  enabled: boolean;
  // 帯の中心（頭の中心から見た方向の y 成分。大きいほど頭頂寄り）
  center: number;
  // 帯の半幅
  width: number;
  // 帯の境界のぼかし幅（小さいほどくっきり）
  softness: number;
  // 左右の端のフェード開始位置（頭の中心から見た方向の |x|）
  sideFade: number;
  // 髪色を白に寄せる量（0 = 髪色のまま, 1 = 白）
  lighten: number;
  // 彩度を落とす量（0 = そのまま, 1 = グレー）
  desaturate: number;
  // 輪の濃さ
  strength: number;
  // 実際の法線を混ぜる量（0 = 完全な球, 1 = 実際の法線のみ）。毛束感が出る
  strandNormalMix: number;
  // 頭ボーンから頭の中心までの高さ（m）
  headCenterOffset: number;
  // 毛束のギザギザの振れ幅（方向 y の単位）
  jagAmplitude: number;
  // 毛束のギザギザの細かさ（1m あたりの山の数）
  jagFrequency: number;
}

export const DEFAULT_HAIR_RING_PARAMS: HairRingParams = {
  enabled: true,
  center: 0.4,
  width: 0.05,
  softness: 0.015,
  sideFade: 0.55,
  lighten: 0.35,
  desaturate: 0.2,
  strength: 1.0,
  strandNormalMix: 0.4,
  headCenterOffset: 0.08,
  jagAmplitude: 0.05,
  jagFrequency: 90,
};

export const HAIR_RING_UNIFORMS = {
  uHairRingEnabled: { value: DEFAULT_HAIR_RING_PARAMS.enabled ? 1 : 0 },
  uHairRingCenter: { value: DEFAULT_HAIR_RING_PARAMS.center },
  uHairRingWidth: { value: DEFAULT_HAIR_RING_PARAMS.width },
  uHairRingSoftness: { value: DEFAULT_HAIR_RING_PARAMS.softness },
  uHairRingSideFade: { value: DEFAULT_HAIR_RING_PARAMS.sideFade },
  uHairRingLighten: { value: DEFAULT_HAIR_RING_PARAMS.lighten },
  uHairRingDesaturate: { value: DEFAULT_HAIR_RING_PARAMS.desaturate },
  uHairRingStrength: { value: DEFAULT_HAIR_RING_PARAMS.strength },
  uHairRingStrandNormalMix: { value: DEFAULT_HAIR_RING_PARAMS.strandNormalMix },
  uHairRingHeadCenterOffset: { value: DEFAULT_HAIR_RING_PARAMS.headCenterOffset },
  uHairRingJagAmplitude: { value: DEFAULT_HAIR_RING_PARAMS.jagAmplitude },
  uHairRingJagFrequency: { value: DEFAULT_HAIR_RING_PARAMS.jagFrequency },
};

export function setHairRingParams(params: Partial<HairRingParams>): void {
  const u = HAIR_RING_UNIFORMS;
  if (params.enabled !== undefined) u.uHairRingEnabled.value = params.enabled ? 1 : 0;
  if (params.center !== undefined) u.uHairRingCenter.value = params.center;
  if (params.width !== undefined) u.uHairRingWidth.value = params.width;
  if (params.softness !== undefined) u.uHairRingSoftness.value = params.softness;
  if (params.sideFade !== undefined) u.uHairRingSideFade.value = params.sideFade;
  if (params.lighten !== undefined) u.uHairRingLighten.value = params.lighten;
  if (params.desaturate !== undefined) u.uHairRingDesaturate.value = params.desaturate;
  if (params.strength !== undefined) u.uHairRingStrength.value = params.strength;
  if (params.strandNormalMix !== undefined) u.uHairRingStrandNormalMix.value = params.strandNormalMix;
  if (params.headCenterOffset !== undefined) u.uHairRingHeadCenterOffset.value = params.headCenterOffset;
  if (params.jagAmplitude !== undefined) u.uHairRingJagAmplitude.value = params.jagAmplitude;
  if (params.jagFrequency !== undefined) u.uHairRingJagFrequency.value = params.jagFrequency;
}

/**
 * MToon のフラグメントシェーダーに天使の輪を差し込む。
 * プログラムキャッシュを共有しても壊れないよう全 MToon マテリアルに同じコードを入れ、
 * 描くかどうかは uHairRingTarget で切り替える。
 */
export function injectHairRing(
  shader: THREE.WebGLProgramParametersWithUniforms,
  target: { value: number },
  headBone: { value: THREE.Vector3 }
): void {
  Object.assign(shader.uniforms, HAIR_RING_UNIFORMS);
  shader.uniforms.uHairRingTarget = target;
  shader.uniforms.uHairRingHeadBone = headBone;

  // 直接光の陰影（getShading の結果）を記録し、影側では輪を消す
  shader.fragmentShader = shader.fragmentShader.replace(
    'float getShading(',
    'float hairRingShading = 0.0;\nfloat getShading('
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    'return shading;',
    'hairRingShading = max(hairRingShading, shading);\n  return shading;'
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    'void main() {',
    /* glsl */ `
    uniform float uHairRingTarget;
    uniform float uHairRingEnabled;
    uniform float uHairRingCenter;
    uniform float uHairRingWidth;
    uniform float uHairRingSoftness;
    uniform float uHairRingSideFade;
    uniform float uHairRingLighten;
    uniform float uHairRingDesaturate;
    uniform float uHairRingStrength;
    uniform float uHairRingStrandNormalMix;
    uniform float uHairRingHeadCenterOffset;
    uniform vec3 uHairRingHeadBone;
    uniform float uHairRingJagAmplitude;
    uniform float uHairRingJagFrequency;

    vec3 applyHairRing(vec3 col, vec3 viewNormal) {
      if (uHairRingEnabled < 0.5 || uHairRingTarget < 0.5) return col;

      // 頭の中心から見た方向（ビュー空間）。実際の法線を少し混ぜて毛束感を出す
      vec3 headCenter = uHairRingHeadBone + vec3(0.0, uHairRingHeadCenterOffset, 0.0);
      vec3 headView = (viewMatrix * vec4(headCenter, 1.0)).xyz;
      vec3 sphereNormal = normalize(-vViewPosition - headView);
      vec3 n = normalize(mix(sphereNormal, normalize(viewNormal), uHairRingStrandNormalMix));
      // 毛束に沿ったギザギザ（画面の横方向に三角波）
      float jag = abs(fract(-vViewPosition.x * uHairRingJagFrequency) * 2.0 - 1.0) * uHairRingJagAmplitude;
      float lower = uHairRingCenter - uHairRingWidth + jag;
      float upper = uHairRingCenter + uHairRingWidth + jag * 0.5;
      float band = smoothstep(lower - uHairRingSoftness, lower, n.y)
                 * (1.0 - smoothstep(upper, upper + uHairRingSoftness, n.y));
      float side = 1.0 - smoothstep(uHairRingSideFade, uHairRingSideFade + 0.25, abs(n.x));
      float lit = smoothstep(0.2, 0.6, hairRingShading);
      float ring = band * side * lit * uHairRingStrength;

      vec3 ringCol = mix(col, vec3(1.0), uHairRingLighten);
      float luma = dot(ringCol, vec3(0.2126, 0.7152, 0.0722));
      ringCol = mix(ringCol, vec3(luma), uHairRingDesaturate);
      return mix(col, ringCol, clamp(ring, 0.0, 1.0));
    }

    void main() {
    `
  );

  shader.fragmentShader = shader.fragmentShader.replaceAll(
    'gl_FragColor = vec4( col, diffuseColor.a );',
    'col = applyHairRing(col, normal);\n          gl_FragColor = vec4( col, diffuseColor.a );'
  );
}
