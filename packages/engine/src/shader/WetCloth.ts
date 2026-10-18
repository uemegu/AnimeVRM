import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { resolveAssetUrl } from '../utils/path';

/**
 * 雨で濡れたYシャツ
 *
 * 白いYシャツを、雨が当たりやすいところ（肩・背中・腕の上側）からまだらに濡らしていく。
 * 濡れたところは、Yシャツのテクスチャと同じ UV で描いた「濡れた版」のテクスチャ（青みのある灰色のまだら・
 * 水の筋・肩や背中に透ける淡い肌色）に切り替える。境目は少し濃く、光が当たるとツヤが出る。
 * 濡れた版のテクスチャがない服は、色を灰色がかって暗くするだけにする。
 *
 * 位置は骨の変形前（バインド姿勢）のメッシュの座標で決めるので、動いても染みは布についたまま動く。
 */

/** 濡れた版のテクスチャ（マテリアル名ごと）。中身は利用側が registerWetTexture で登録する */
const WET_TEXTURES: Array<{ pattern: RegExp; url: string }> = [];

/** マテリアル名が pattern に合う服に、同じ UV で描いた濡れた版のテクスチャ（url）を使う */
export function registerWetTexture(pattern: RegExp, url: string): void {
  WET_TEXTURES.push({ pattern, url });
}

const wetTextureCache = new Map<string, THREE.Texture>();

/** マテリアル名に合う濡れた版のテクスチャ（なければ null） */
export function wetTextureFor(matName: string): THREE.Texture | null {
  const entry = WET_TEXTURES.find((e) => e.pattern.test(matName));
  if (!entry) return null;
  let texture = wetTextureCache.get(entry.url);
  if (!texture) {
    texture = new THREE.TextureLoader().load(resolveAssetUrl(entry.url));
    texture.colorSpace = THREE.SRGBColorSpace;
    // VRM（glTF）のテクスチャと同じく上下を反転しない
    texture.flipY = false;
    wetTextureCache.set(entry.url, texture);
  }
  return texture;
}

/** 濡れた版のテクスチャがないマテリアル用（1 画素の白） */
const NO_WET_TEXTURE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
NO_WET_TEXTURE.needsUpdate = true;

export interface WetClothFrame {
  /** 濡れ具合（0 = 乾いている、1 = ずぶ濡れ）。アバターごとに共有する */
  wetness: { value: number };
  /** 胸の骨の位置と体の向き（バインド姿勢のメッシュの座標） */
  chest: { value: THREE.Vector3 };
  up: { value: THREE.Vector3 };
  forward: { value: THREE.Vector3 };
  left: { value: THREE.Vector3 };
  /** 胸の中心から上腕の付け根までの横幅（m） */
  halfWidth: { value: number };
}

export const WET_CLOTH_UNIFORMS = {
  // 濡れたところに掛ける色（濡れた版のテクスチャに重ねて、もう一段暗くする。テクスチャがない服はこれだけ）
  uWetTint: { value: new THREE.Color(0.78, 0.81, 0.87) },
  uWetTintNoTexture: { value: new THREE.Color(0.66, 0.7, 0.77) },
  // ツヤの強さ
  uWetGloss: { value: 0.3 },
  // 濡れたところの明るさの上限（リニア）。光が強いと、暗くした白いシャツも白く飛ぶので抑える
  uWetMaxLuma: { value: 0.45 },
};

export function createWetClothFrame(): WetClothFrame {
  return {
    wetness: { value: 0 },
    chest: { value: new THREE.Vector3(0, 1.25, 0) },
    up: { value: new THREE.Vector3(0, 1, 0) },
    forward: { value: new THREE.Vector3(0, 0, 1) },
    left: { value: new THREE.Vector3(1, 0, 0) },
    halfWidth: { value: 0.12 },
  };
}

/** 濡らす服か（白っぽい上着＝Yシャツ。制服のブレザー・ネクタイは除く） */
export function isWetClothMaterial(matName: string, averageColor: THREE.Color | null): boolean {
  if (!/Tops|shirt|シャツ/i.test(matName) || /Tie|Accessory/i.test(matName)) return false;
  if (!averageColor) return false;
  const luma = 0.2126 * averageColor.r + 0.7152 * averageColor.g + 0.0722 * averageColor.b;
  return luma > 0.7;
}

/**
 * 胸の骨の位置と体の向きを、バインド姿勢のメッシュの座標で求める（skinnedMesh は濡らす服のメッシュ）
 */
export function measureWetClothFrame(vrm: VRM, skinnedMesh: THREE.SkinnedMesh, frame: WetClothFrame): boolean {
  const humanoid = vrm.humanoid;
  const skeleton = skinnedMesh.skeleton;
  if (!humanoid || !skeleton) return false;
  const bindPosition = (name: 'upperChest' | 'chest' | 'leftUpperArm' | 'rightUpperArm'): THREE.Vector3 | null => {
    const bone = humanoid.getRawBoneNode(name);
    const index = bone ? skeleton.bones.indexOf(bone as THREE.Bone) : -1;
    if (index < 0) return null;
    const position = new THREE.Vector3().setFromMatrixPosition(skeleton.boneInverses[index].clone().invert());
    return position.applyMatrix4(skinnedMesh.bindMatrixInverse);
  };
  const chest = bindPosition('upperChest') ?? bindPosition('chest');
  const leftArm = bindPosition('leftUpperArm');
  const rightArm = bindPosition('rightUpperArm');
  if (!chest || !leftArm || !rightArm) return false;
  const up = new THREE.Vector3(0, 1, 0);
  const left = leftArm.clone().sub(rightArm);
  left.addScaledVector(up, -left.dot(up));
  const halfWidth = left.length() / 2;
  if (halfWidth < 1e-3) return false;
  left.normalize();
  frame.chest.value.copy(chest);
  frame.up.value.copy(up);
  frame.left.value.copy(left);
  frame.forward.value.crossVectors(left, up).normalize();
  frame.halfWidth.value = halfWidth;
  return true;
}

/**
 * MToon のシェーダーに差し込む。
 * プログラムキャッシュを共有しても壊れないよう全 MToon マテリアルに同じコードを入れ、
 * 効かせるかどうかは target（濡らす服だけ 1）で切り替える。wetMap は濡れた版のテクスチャ（なければ null）
 */
export function injectWetCloth(
  shader: THREE.WebGLProgramParametersWithUniforms,
  target: { value: number },
  frame: WetClothFrame,
  wetMap: THREE.Texture | null
): void {
  Object.assign(shader.uniforms, WET_CLOTH_UNIFORMS);
  shader.uniforms.uWetTarget = target;
  shader.uniforms.uWetness = frame.wetness;
  shader.uniforms.uWetChest = frame.chest;
  shader.uniforms.uWetUp = frame.up;
  shader.uniforms.uWetForward = frame.forward;
  shader.uniforms.uWetLeft = frame.left;
  shader.uniforms.uWetHalfWidth = frame.halfWidth;
  shader.uniforms.uWetMap = { value: wetMap ?? NO_WET_TEXTURE };
  shader.uniforms.uWetHasMap = { value: wetMap ? 1 : 0 };

  shader.vertexShader = shader.vertexShader
    .replace(
      'void main() {',
      /* glsl */ `varying vec3 vWetPos;
      varying vec3 vWetNormal;
      void main() {`
    )
    .replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
      vWetPos = position;
      vWetNormal = normal;`
    );

  shader.fragmentShader = shader.fragmentShader
    // 濡れ具合は光ごとの計算（RE_Direct）でも使うので、その前に置く
    .replace(
      'float getShading(',
      /* glsl */ `uniform float uWetGloss;
      uniform float uWetMaxLuma;
      float gWetMask = 0.0;
      float getShading(`
    )
    .replace(
      'void main() {',
      /* glsl */ `
      uniform float uWetTarget;
      uniform float uWetness;
      uniform vec3 uWetChest;
      uniform vec3 uWetUp;
      uniform vec3 uWetForward;
      uniform vec3 uWetLeft;
      uniform float uWetHalfWidth;
      uniform vec3 uWetTint;
      uniform vec3 uWetTintNoTexture;
      uniform sampler2D uWetMap;
      uniform float uWetHasMap;
      varying vec3 vWetPos;
      varying vec3 vWetNormal;

      float wetHash( vec3 p ) {
        p = fract( p * 0.3183099 + 0.1 );
        p *= 17.0;
        return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
      }
      float wetNoise( vec3 x ) {
        vec3 i = floor( x );
        vec3 f = fract( x );
        f = f * f * ( 3.0 - 2.0 * f );
        return mix(
          mix( mix( wetHash( i ), wetHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( wetHash( i + vec3( 0, 1, 0 ) ), wetHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
          mix( mix( wetHash( i + vec3( 0, 0, 1 ) ), wetHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( wetHash( i + vec3( 0, 1, 1 ) ), wetHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ),
          f.z
        );
      }

      // 濡れたところの色にする（dryTexel は元のテクスチャの色、uv はその座標）。濡れ具合（ツヤに使う）を返す
      float wetCloth( inout vec3 lit, inout vec3 shade, const in vec3 dryTexel, const in vec2 uv ) {
        vec3 rel = vWetPos - uWetChest;
        vec3 n = normalize( vWetNormal );
        float h = dot( rel, uWetUp );
        float side = abs( dot( rel, uWetLeft ) ) / uWetHalfWidth;
        float front = dot( n, uWetForward );
        float noise = wetNoise( vWetPos * 9.0 ) * 0.65 + wetNoise( vWetPos * 23.0 + 7.3 ) * 0.35;
        // 胸の前（脇の内側・鎖骨の下からみぞおちまで）は濡れにくい
        float chestFront = smoothstep( 0.1, 0.45, front ) * ( 1.0 - smoothstep( 0.6, 0.9, side ) )
          * smoothstep( -0.3, -0.2, h ) * ( 1.0 - smoothstep( 0.06, 0.14, h ) );
        // 雨が当たりやすいところ（高いところ・上を向いた面・背中・腕）ほど先に濡れる
        float exposure = 0.45 * smoothstep( -0.4, 0.12, h ) + 0.25 * max( dot( n, uWetUp ), 0.0 )
          + 0.15 * clamp( -front, 0.0, 1.0 ) + 0.15 * smoothstep( 0.7, 1.2, side );
        float p = exposure + ( noise - 0.5 ) * 0.55 - 0.25 * chestFront;
        float threshold = mix( 1.0, -0.2, uWetness );
        float wet = smoothstep( threshold, threshold + 0.04, p );
        // 境目の少し内側は色が濃い（水がたまる）
        float inner = smoothstep( threshold + 0.05, threshold + 0.12, p );
        float rim = wet * ( 1.0 - inner );

        // 濡れた版のテクスチャとの色の比（影の色も同じ比で変える）。テクスチャがない服は決まった色を掛ける
        vec3 wetTexel = texture2D( uWetMap, uv ).rgb;
        // テクスチャのまだらは淡いので、比を強めて（2 乗して）見えるようにする
        vec3 ratio = uWetHasMap > 0.5
          ? pow( min( wetTexel / max( dryTexel, vec3( 0.02 ) ), vec3( 1.2 ) ), vec3( 2.0 ) ) * uWetTint
          : uWetTintNoTexture;
        ratio *= 1.0 - 0.1 * rim;
        lit = mix( lit, lit * ratio, wet );
        shade = mix( shade, shade * ratio, wet );
        return wet;
      }

      void main() {`
    )
    .replace(
      'material.shadingShift = shadingShiftFactor;',
      /* glsl */ `#ifdef USE_MAP
      if ( uWetTarget > 0.5 && uWetness > 0.0 ) {
        gWetMask = wetCloth( material.diffuseColor, material.shadeColor, sampledDiffuseColor.rgb, mapUv );
      }
      #endif
      material.shadingShift = shadingShiftFactor;`
    )
    .replaceAll(
      'gl_FragColor = vec4( col, diffuseColor.a );',
      /* glsl */ `if ( gWetMask > 0.0 ) {
        float wetLuma = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
        col *= mix( 1.0, min( 1.0, uWetMaxLuma / max( wetLuma, 1e-4 ) ), gWetMask );
      }
      gl_FragColor = vec4( col, diffuseColor.a );`
    )
    // 濡れたところのツヤ（光が当たる面に、硬い縁のハイライトを足す）
    .replaceAll(
      'reflectedLight.directDiffuse += getDiffuse( material, shading, directLight.color );',
      /* glsl */ `reflectedLight.directDiffuse += getDiffuse( material, shading, directLight.color );
      #if THREE_VRM_THREE_REVISION >= 157
      if ( gWetMask > 0.0 ) {
        vec3 wetHalf = normalize( directLight.direction + geometryViewDir );
        float wetSpec = smoothstep( 0.9, 0.93, dot( geometryNormal, wetHalf ) ) * shadow;
        reflectedLight.directDiffuse += directLight.color * wetSpec * gWetMask * uWetGloss;
      }
      #endif`
    );
}
