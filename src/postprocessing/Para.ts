import * as THREE from 'three';

/**
 * パラ（空気感のグラデーション）
 *
 * アニメの撮影処理で、セルの上に重ねるパラフィン紙のグラデーションを再現する。
 * キャラは近くにいるのでフォグがほぼ効かず、背景の空気感から浮きやすい。
 * そこで、背景の空気の色をキャラのマスクの上だけに、画面の上ほど強く重ねる。
 * 重ね方はスクリーン合成（明るくかすむ）と色合わせ（明るさを保って色味だけ寄せる）を混ぜられる。
 * 明るい空の前でスクリーン合成だけにすると白っぽくなりすぎるので、色合わせを主にする。
 *
 * 空気の色は、キャラ以外の背景を画面全体からまばらにサンプルした平均なので、場所ごとの設定は不要。
 * スクリーン合成は 0〜1 の表示用の値を前提にするので、OutputPass の後（sRGB）で行う。
 * キャラのマスクはライトラップと共通（CharacterMaskRenderer）。
 */

export interface ParaParams {
  enabled: boolean;
  // 画面の上端での濃さ
  topOpacity: number;
  // 画面の下端での濃さ
  bottomOpacity: number;
  // 空気の色の彩度を落とす量（0 = 背景の平均色のまま, 1 = グレー）
  desaturate: number;
  // 色合わせの割合（0 = スクリーン合成のみ, 1 = 明るさを保って色味だけ寄せる）
  tintAmount: number;
}

export const DEFAULT_PARA_PARAMS: ParaParams = {
  enabled: true,
  topOpacity: 0.3,
  bottomOpacity: 0.05,
  desaturate: 0.2,
  tintAmount: 1.0,
};

export const ParaShader = {
  name: 'ParaShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tMask: { value: null as THREE.Texture | null },
    uEnabled: { value: 1.0 },
    uTopOpacity: { value: DEFAULT_PARA_PARAMS.topOpacity },
    uBottomOpacity: { value: DEFAULT_PARA_PARAMS.bottomOpacity },
    uDesaturate: { value: DEFAULT_PARA_PARAMS.desaturate },
    uTintAmount: { value: DEFAULT_PARA_PARAMS.tintAmount },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tMask;
    uniform float uEnabled;
    uniform float uTopOpacity;
    uniform float uBottomOpacity;
    uniform float uDesaturate;
    uniform float uTintAmount;
    varying vec2 vUv;

    const int GRID_X = 8;
    const int GRID_Y = 6;

    float characterAt(vec2 uv) {
      return step(texture2D(tMask, uv).r, 0.99999);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      if (uEnabled < 0.5 || characterAt(vUv) < 0.5) {
        gl_FragColor = color;
        return;
      }

      // 空気の色: キャラ以外の背景を格子状にサンプルして平均する
      vec3 air = vec3(0.0);
      float weight = 0.0;
      for (int y = 0; y < GRID_Y; y++) {
        for (int x = 0; x < GRID_X; x++) {
          vec2 uv = (vec2(float(x), float(y)) + 0.5) / vec2(float(GRID_X), float(GRID_Y));
          float isBackground = 1.0 - characterAt(uv);
          air += texture2D(tDiffuse, uv).rgb * isBackground;
          weight += isBackground;
        }
      }
      if (weight < 0.5) {
        gl_FragColor = color;
        return;
      }
      air /= weight;
      air = mix(air, vec3(dot(air, vec3(0.2126, 0.7152, 0.0722))), uDesaturate);

      // 画面の上ほど強いグラデーションで重ねる
      float opacity = mix(uBottomOpacity, uTopOpacity, vUv.y);
      vec3 screen = 1.0 - (1.0 - clamp(color.rgb, 0.0, 1.0)) * (1.0 - air);
      // 色合わせ: 空気の色を明るさ 1 に正規化して掛ける（明るさはほぼ保ち、色味だけ寄せる）
      float airLuma = max(dot(air, vec3(0.2126, 0.7152, 0.0722)), 0.05);
      vec3 tinted = clamp(color.rgb * (air / airLuma), 0.0, 1.0);
      color.rgb = mix(color.rgb, mix(screen, tinted, uTintAmount), opacity);
      gl_FragColor = color;
    }
  `,
};

export function applyParaParams(uniforms: typeof ParaShader.uniforms, params: Partial<ParaParams>): void {
  if (params.enabled !== undefined) uniforms.uEnabled.value = params.enabled ? 1 : 0;
  if (params.topOpacity !== undefined) uniforms.uTopOpacity.value = params.topOpacity;
  if (params.bottomOpacity !== undefined) uniforms.uBottomOpacity.value = params.bottomOpacity;
  if (params.desaturate !== undefined) uniforms.uDesaturate.value = params.desaturate;
  if (params.tintAmount !== undefined) uniforms.uTintAmount.value = params.tintAmount;
}
