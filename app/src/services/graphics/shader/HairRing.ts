import * as THREE from 'three';

/**
 * 天使の輪（髪の帯状ハイライト）
 *
 * 頭の向きを基準に、頭の中心から一定の高さにある水平な帯を描く。
 * 頭の向きに追従するので、正面・側面・後ろのどこから見ても頭に対して水平な輪になる。
 * （カメラ基準や頭を球とみなした角度基準にすると、前後に長い頭では側面から見て輪が斜めになる）
 * 帯は頭の正面で最も高く、横・後ろへ回り込むほど下がる（arc）。頭頂のドームに沿った「∩」型の弧になり、
 * 頭の向きを基準にしているので、頭を回すと輪も一緒に回る（カメラ基準だと光だけが画面に固定されて見える）。
 * 帯の高さはカメラの仰角でも少し動き、下の縁は頭の周りの角度に沿って毛束のようにギザギザにする。
 * 色はライティング後の髪色を時間帯ごとの色（tint）に寄せた色なので、髪色・時間帯になじむ。
 *
 * パラメータは数値だけなので全アバター・全レンダラーで共有する（HAIR_RING_UNIFORMS）。
 * 頭の位置と向きだけはアバターごとに持つ（HairRingHeadFrame）。
 */

export interface HairRingParams {
  enabled: boolean;
  // 帯の中心の高さ（頭の中心からの距離 m）
  height: number;
  // 帯の半幅（m）
  width: number;
  // 帯の境界のぼかし幅（m。小さいほどくっきり）
  softness: number;
  // 輪を出す範囲（頭の面がカメラを向く度合い）。この値から +0.3 までで立ち上がり、
  // カメラを向いた範囲だけの弧になる（大きいほど輪が短い）
  facingFade: number;
  // 髪色を tint に寄せる量（0 = 髪色のまま, 1 = tint）
  lighten: number;
  // 彩度を落とす量（0 = そのまま, 1 = グレー）
  desaturate: number;
  // 輪の濃さ
  strength: number;
  // 実際の法線で帯の縁を揺らす量（m）。毛束感が出る
  strandJitter: number;
  // 頭ボーンから頭の中心までの高さ（m）
  headCenterOffset: number;
  // 下の縁の毛先の長さ（m）。毛先ごとに長さがばらつく
  jagAmplitude: number;
  // 毛先の数（頭一周あたり）
  jagCount: number;
  // カメラの仰角で帯を上下させる量（m）。上から見るほど輪が上がる
  viewShift: number;
  // 弧の反り（m）。頭の正面から横に 90° 回り込んだ所で、正面よりこれだけ下がる
  arc: number;
  // 途切れ: 頭一周を区切る数と、そのうち輪を消す区間の割合（0 = 途切れなし）
  gapCount: number;
  gapRate: number;
}

export const DEFAULT_HAIR_RING_PARAMS: HairRingParams = {
  enabled: true,
  height: 0.07,
  width: 0.009,
  softness: 0.0015,
  facingFade: 0.3,
  lighten: 0.5,
  desaturate: 0.1,
  strength: 0.85,
  strandJitter: 0.006,
  headCenterOffset: 0.08,
  jagAmplitude: 0.012,
  jagCount: 48,
  viewShift: 0.01,
  arc: 0.04,
  gapCount: 40,
  gapRate: 0.2,
};

export const HAIR_RING_UNIFORMS = {
  uHairRingEnabled: { value: DEFAULT_HAIR_RING_PARAMS.enabled ? 1 : 0 },
  uHairRingHeight: { value: DEFAULT_HAIR_RING_PARAMS.height },
  uHairRingWidth: { value: DEFAULT_HAIR_RING_PARAMS.width },
  uHairRingSoftness: { value: DEFAULT_HAIR_RING_PARAMS.softness },
  uHairRingFacingFade: { value: DEFAULT_HAIR_RING_PARAMS.facingFade },
  uHairRingTint: { value: new THREE.Color('#ffffff') },
  uHairRingLighten: { value: DEFAULT_HAIR_RING_PARAMS.lighten },
  uHairRingDesaturate: { value: DEFAULT_HAIR_RING_PARAMS.desaturate },
  uHairRingStrength: { value: DEFAULT_HAIR_RING_PARAMS.strength },
  uHairRingStrandJitter: { value: DEFAULT_HAIR_RING_PARAMS.strandJitter },
  uHairRingHeadCenterOffset: { value: DEFAULT_HAIR_RING_PARAMS.headCenterOffset },
  uHairRingJagAmplitude: { value: DEFAULT_HAIR_RING_PARAMS.jagAmplitude },
  uHairRingJagCount: { value: DEFAULT_HAIR_RING_PARAMS.jagCount },
  uHairRingViewShift: { value: DEFAULT_HAIR_RING_PARAMS.viewShift },
  uHairRingArc: { value: DEFAULT_HAIR_RING_PARAMS.arc },
  uHairRingGapCount: { value: DEFAULT_HAIR_RING_PARAMS.gapCount },
  uHairRingGapRate: { value: DEFAULT_HAIR_RING_PARAMS.gapRate },
};

export function setHairRingParams(params: Partial<HairRingParams>): void {
  const u = HAIR_RING_UNIFORMS;
  if (params.enabled !== undefined) u.uHairRingEnabled.value = params.enabled ? 1 : 0;
  if (params.height !== undefined) u.uHairRingHeight.value = params.height;
  if (params.width !== undefined) u.uHairRingWidth.value = params.width;
  if (params.softness !== undefined) u.uHairRingSoftness.value = params.softness;
  if (params.facingFade !== undefined) u.uHairRingFacingFade.value = params.facingFade;
  if (params.lighten !== undefined) u.uHairRingLighten.value = params.lighten;
  if (params.desaturate !== undefined) u.uHairRingDesaturate.value = params.desaturate;
  if (params.strength !== undefined) u.uHairRingStrength.value = params.strength;
  if (params.strandJitter !== undefined) u.uHairRingStrandJitter.value = params.strandJitter;
  if (params.headCenterOffset !== undefined) u.uHairRingHeadCenterOffset.value = params.headCenterOffset;
  if (params.jagAmplitude !== undefined) u.uHairRingJagAmplitude.value = params.jagAmplitude;
  if (params.jagCount !== undefined) u.uHairRingJagCount.value = params.jagCount;
  if (params.viewShift !== undefined) u.uHairRingViewShift.value = params.viewShift;
  if (params.arc !== undefined) u.uHairRingArc.value = params.arc;
  if (params.gapCount !== undefined) u.uHairRingGapCount.value = params.gapCount;
  if (params.gapRate !== undefined) u.uHairRingGapRate.value = params.gapRate;
}

/**
 * 輪を寄せる色（sRGB）。時間帯のライト設定（lighting.hairRingTint）から設定する。
 * 昼は白寄り、夕方は暖色にすると、色調補正後も背景になじむ。
 */
export function setHairRingTint(hex: string | undefined): void {
  HAIR_RING_UNIFORMS.uHairRingTint.value.set(hex ?? '#ffffff');
}

// アバターごとの頭の位置と向き（ワールド座標）
export interface HairRingHeadFrame {
  position: { value: THREE.Vector3 };
  up: { value: THREE.Vector3 };
  forward: { value: THREE.Vector3 };
}

export function createHairRingHeadFrame(): HairRingHeadFrame {
  return {
    position: { value: new THREE.Vector3() },
    up: { value: new THREE.Vector3(0, 1, 0) },
    forward: { value: new THREE.Vector3(0, 0, 1) },
  };
}

const tmpQuat = new THREE.Quaternion();

// 頭ボーンから位置と向きを更新する（髪メッシュの描画直前に呼ぶ）
export function updateHairRingHeadFrame(frame: HairRingHeadFrame, head: THREE.Object3D): void {
  head.getWorldPosition(frame.position.value);
  head.getWorldQuaternion(tmpQuat);
  frame.up.value.set(0, 1, 0).applyQuaternion(tmpQuat);
  frame.forward.value.set(0, 0, 1).applyQuaternion(tmpQuat);
}

/**
 * MToon のフラグメントシェーダーに天使の輪を差し込む。
 * プログラムキャッシュを共有しても壊れないよう全 MToon マテリアルに同じコードを入れ、
 * 描くかどうかは uHairRingTarget で切り替える。
 */
export function injectHairRing(
  shader: THREE.WebGLProgramParametersWithUniforms,
  target: { value: number },
  head: HairRingHeadFrame
): void {
  Object.assign(shader.uniforms, HAIR_RING_UNIFORMS);
  shader.uniforms.uHairRingTarget = target;
  shader.uniforms.uHairRingHeadPosition = head.position;
  shader.uniforms.uHairRingHeadUp = head.up;
  shader.uniforms.uHairRingHeadForward = head.forward;

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
    uniform float uHairRingHeight;
    uniform float uHairRingWidth;
    uniform float uHairRingSoftness;
    uniform float uHairRingFacingFade;
    uniform vec3 uHairRingTint;
    uniform float uHairRingLighten;
    uniform float uHairRingDesaturate;
    uniform float uHairRingStrength;
    uniform float uHairRingStrandJitter;
    uniform float uHairRingHeadCenterOffset;
    uniform float uHairRingJagAmplitude;
    uniform float uHairRingJagCount;
    uniform float uHairRingViewShift;
    uniform float uHairRingArc;
    uniform float uHairRingGapCount;
    uniform float uHairRingGapRate;
    uniform vec3 uHairRingHeadPosition;
    uniform vec3 uHairRingHeadUp;
    uniform vec3 uHairRingHeadForward;

    float hairRingHash(float x) {
      return fract(sin(x * 127.1) * 43758.5453);
    }

    vec3 applyHairRing(vec3 col, vec3 viewNormal) {
      if (uHairRingEnabled < 0.5 || uHairRingTarget < 0.5) return col;

      // 頭の座標系（ビュー空間）
      vec3 upV = normalize((viewMatrix * vec4(uHairRingHeadUp, 0.0)).xyz);
      vec3 fwdV = normalize((viewMatrix * vec4(uHairRingHeadForward, 0.0)).xyz);
      vec3 rightV = normalize(cross(upV, fwdV));
      vec3 centerV = (viewMatrix * vec4(uHairRingHeadPosition + uHairRingHeadUp * uHairRingHeadCenterOffset, 1.0)).xyz;

      vec3 viewPos = -vViewPosition;
      vec3 rel = viewPos - centerV;
      vec3 n = normalize(viewNormal);

      // 頭に対する高さ。実際の法線で少し揺らして毛束感を出す
      float h = dot(rel, upV) + dot(n, upV) * uHairRingStrandJitter;

      // 帯の中心はカメラの仰角で少し動かす（カメラはビュー空間の原点）
      float elevation = dot(normalize(-centerV), upV);
      float center = uHairRingHeight + elevation * uHairRingViewShift;

      // 弧: 頭の水平面上で、頭の正面からどれだけ回り込んでいるか（0 = 正面, 1 = 真横）
      vec3 relFlat = rel - upV * dot(rel, upV);
      float turn = min(1.0 - dot(normalize(relFlat), fwdV), 1.0);
      center -= uHairRingArc * turn;

      // 下の縁の毛先（頭の周りの角度で区切り、毛先ごとに長さをばらつかせる。頭と一緒に回る）
      float azimuth = atan(dot(rel, rightV), dot(rel, fwdV));
      float t = azimuth / 6.2831853 * uHairRingJagCount;
      float spike = 1.0 - abs(fract(t) * 2.0 - 1.0);
      float tip = spike * mix(0.25, 1.0, hairRingHash(floor(t))) * uHairRingJagAmplitude;

      float lower = center - uHairRingWidth - tip;
      float upper = center + uHairRingWidth;
      float band = smoothstep(lower - uHairRingSoftness, lower, h)
                 * (1.0 - smoothstep(upper, upper + uHairRingSoftness, h));

      // カメラを向いた範囲だけに出す（輪の両端は途切れる）
      float facing = dot(normalize(rel), normalize(-viewPos));
      float fade = smoothstep(uHairRingFacingFade, uHairRingFacingFade + 0.3, facing);

      // 途切れ: 頭の周りを区切り、一部の区間だけ輪を消す（頭と一緒に回る）
      float gapSeg = floor(azimuth / 6.2831853 * uHairRingGapCount);
      float gap = step(hairRingHash(gapSeg + 31.7), uHairRingGapRate);

      float lit = smoothstep(0.2, 0.6, hairRingShading);
      float ring = band * fade * lit * (1.0 - gap) * uHairRingStrength;

      vec3 ringCol = mix(col, uHairRingTint, uHairRingLighten);
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
