import * as THREE from 'three';
import type { HairRingHeadFrame } from './HairRing';

/**
 * 頭頂まわりの髪の陰影をなめらかにする
 *
 * 髪の毛束は1本ずつ法線の向きが違うので、MToon の硬い明暗では毛束ごとに明暗が割れ、
 * 後ろから見ると頭頂から縦に暗い筋が並ぶ。頭頂〜中ほどだけ光との角度を持ち上げて、毛束の影を消す。
 * 毛先へ行くほど持ち上げを弱めるので、毛先の毛束の影は残る。
 * （法線を頭の上向きに置き換えると毛先の影が同じ高さで横一列にそろい、頭を球とみなした法線にすると
 *   前から光が当たるとき後頭部が丸ごと影側になって大きな影が出る）
 *
 * 頭の位置と向きは天使の輪と同じもの（HairRingHeadFrame）を使う。
 */

export const HAIR_CROWN_UNIFORMS = {
  // 光との角度（法線・光の内積）に足す量の最大。頭頂側ほど足し、毛束の影を消す（0 = 元のまま）
  uHairCrownLift: { value: 1.0 },
  // 頭ボーンから頭の中心までの高さ（m）
  uHairCrownCenterOffset: { value: 0.08 },
  // 頭の中心からの高さ（m）。top より上は lift を全部足し、bottom より下は足さない
  uHairCrownTop: { value: 0.02 },
  uHairCrownBottom: { value: -0.16 },
  // 影の長さのばらつき（m）。頭の周りを区切り、区間ごとに top・bottom をずらす（影の先が横一列にそろわないように）
  uHairCrownJitter: { value: 0.04 },
  uHairCrownJitterCount: { value: 40 },
};

/**
 * MToon のフラグメントシェーダーに差し込む。
 * プログラムキャッシュを共有しても壊れないよう全 MToon マテリアルに同じコードを入れ、
 * 効かせるかどうかは target（髪だけ 1）で切り替える。
 */
export function injectHairCrown(
  shader: THREE.WebGLProgramParametersWithUniforms,
  target: { value: number },
  head: HairRingHeadFrame
): void {
  Object.assign(shader.uniforms, HAIR_CROWN_UNIFORMS);
  shader.uniforms.uHairCrownTarget = target;
  shader.uniforms.uHairCrownHeadPosition = head.position;
  shader.uniforms.uHairCrownHeadUp = head.up;
  shader.uniforms.uHairCrownHeadForward = head.forward;

  shader.fragmentShader = shader.fragmentShader.replace(
    'float getShading(',
    /* glsl */ `
    uniform float uHairCrownTarget;
    uniform float uHairCrownLift;
    uniform float uHairCrownCenterOffset;
    uniform float uHairCrownTop;
    uniform float uHairCrownBottom;
    uniform float uHairCrownJitter;
    uniform float uHairCrownJitterCount;
    uniform vec3 uHairCrownHeadPosition;
    uniform vec3 uHairCrownHeadUp;
    uniform vec3 uHairCrownHeadForward;

    // 頭頂側ほど光との角度を持ち上げる（ビュー空間）。陰りの深い毛束ほど影が上まで残るので、
    // 影の先は毛束ごとに長さが違い、細く尖る
    float hairCrownDotNL( const in float dotNL ) {
      vec3 upV = normalize( ( viewMatrix * vec4( uHairCrownHeadUp, 0.0 ) ).xyz );
      vec3 fwdV = normalize( ( viewMatrix * vec4( uHairCrownHeadForward, 0.0 ) ).xyz );
      vec3 rightV = normalize( cross( upV, fwdV ) );
      vec3 centerV = ( viewMatrix * vec4( uHairCrownHeadPosition + uHairCrownHeadUp * uHairCrownCenterOffset, 1.0 ) ).xyz;
      vec3 rel = -vViewPosition - centerV;
      float azimuth = atan( dot( rel, rightV ), dot( rel, fwdV ) );
      float segment = floor( azimuth / 6.2831853 * uHairCrownJitterCount );
      float jitter = ( fract( sin( segment * 91.7 ) * 43758.5453 ) - 0.5 ) * 2.0 * uHairCrownJitter;
      float lift = smoothstep( uHairCrownBottom + jitter, uHairCrownTop + jitter, dot( rel, upV ) ) * uHairCrownLift;
      return min( dotNL + lift, 1.0 );
    }

    float getShading(`
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    'float dotNL = clamp( dot( geometryNormal, directLight.direction ), -1.0, 1.0 );',
    /* glsl */ `float dotNL = clamp( dot( geometryNormal, directLight.direction ), -1.0, 1.0 );
    if ( uHairCrownTarget > 0.5 && uHairCrownLift > 0.0 ) {
      dotNL = hairCrownDotNL( dotNL );
    }`
  );
}
