import * as THREE from 'three';
import type { HairRingHeadFrame } from './HairRing';

/**
 * 頭頂まわりの髪の陰影をなめらかにする
 *
 * 髪の毛束は1本ずつ法線の向きが違うので、MToon の硬い明暗では毛束ごとに明暗が割れ、
 * 後ろから見ると頭頂から縦に暗い筋が並ぶ。頭頂〜中ほどだけ、毛束の法線の代わりに
 * 頭の上向きで明暗を決め、ひと続きの面として塗る（光が上から来ていれば影がなくなる）。
 * 頭を球とみなした法線にすると、前から光が当たるとき後頭部が丸ごと影側になって大きな影が出る。
 * 下へ行くほど元の法線に戻すので、毛先の毛束の影は残る。
 *
 * 頭の位置と向きは天使の輪と同じもの（HairRingHeadFrame）を使う。
 */

export const HAIR_CROWN_UNIFORMS = {
  // 頭の上向きに置き換える量（0 = 元のまま, 1 = 頭の上向き）
  uHairCrownStrength: { value: 1.0 },
  // 頭ボーンから頭の中心までの高さ（m）
  uHairCrownCenterOffset: { value: 0.08 },
  // 頭の中心からの高さ（m）。top より上は頭の上向き、bottom より下は元の法線、その間はなめらかに混ぜる
  uHairCrownTop: { value: 0.0 },
  uHairCrownBottom: { value: -0.1 },
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

  shader.fragmentShader = shader.fragmentShader.replace(
    'float getShading(',
    /* glsl */ `
    uniform float uHairCrownTarget;
    uniform float uHairCrownStrength;
    uniform float uHairCrownCenterOffset;
    uniform float uHairCrownTop;
    uniform float uHairCrownBottom;
    uniform vec3 uHairCrownHeadPosition;
    uniform vec3 uHairCrownHeadUp;

    // 頭頂側では、光との角度を頭の上向きで測る（ビュー空間）
    float hairCrownDotNL( const in float dotNL, const in vec3 lightDir ) {
      vec3 upV = normalize( ( viewMatrix * vec4( uHairCrownHeadUp, 0.0 ) ).xyz );
      vec3 centerV = ( viewMatrix * vec4( uHairCrownHeadPosition + uHairCrownHeadUp * uHairCrownCenterOffset, 1.0 ) ).xyz;
      vec3 rel = -vViewPosition - centerV;
      float weight = smoothstep( uHairCrownBottom, uHairCrownTop, dot( rel, upV ) ) * uHairCrownStrength;
      return mix( dotNL, dot( upV, lightDir ), weight );
    }

    float getShading(`
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    'float dotNL = clamp( dot( geometryNormal, directLight.direction ), -1.0, 1.0 );',
    /* glsl */ `float dotNL = clamp( dot( geometryNormal, directLight.direction ), -1.0, 1.0 );
    if ( uHairCrownTarget > 0.5 && uHairCrownStrength > 0.0 ) {
      dotNL = hairCrownDotNL( dotNL, directLight.direction );
    }`
  );
}
