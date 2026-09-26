import * as THREE from 'three';
import { createLayerDepthTarget, renderLayerDepth } from '../shader/LayerDepth';

/**
 * キャラのマスクとライトラップ
 *
 * キャラのマスク: アバターの全メッシュだけを深度テクスチャに描き、深度 < 1 の所をキャラとする。
 * ライトラップ: キャラの輪郭の内側に、周囲の「背景だけ」をぼかした色を足す合成処理。
 *   背景が明るい所ほど光がキャラに回り込み、キャラが背景になじむ。暗い背景ではほとんど変わらない。
 *   描画直後のリニア空間（ブルームの前）で行う。
 *   暗く縁のくっきりした服に強くかけると切り抜きの縁取り（ハロー）に見えるので、
 *   髪以外は bodyStrength 倍に弱める。髪の判定には前髪の影用の髪の深度を使う。
 */

// アバターのメッシュを載せるレイヤー（マスク描画時にこのレイヤーだけを描く）
export const CHARACTER_LAYER = 6;

export class CharacterMaskRenderer {
  private renderTarget: THREE.WebGLRenderTarget;

  constructor(width: number, height: number) {
    this.renderTarget = createLayerDepthTarget(width, height);
  }

  // キャラがある所は深度 < 1、ない所は 1
  public get texture(): THREE.DepthTexture {
    return this.renderTarget.depthTexture!;
  }

  public setSize(width: number, height: number): void {
    this.renderTarget.setSize(width, height);
  }

  public render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    renderLayerDepth(renderer, scene, camera, CHARACTER_LAYER, this.renderTarget);
  }

  public dispose(): void {
    this.renderTarget.depthTexture?.dispose();
    this.renderTarget.dispose();
  }
}

export interface LightWrapParams {
  enabled: boolean;
  // にじませる幅（画面の高さに対する割合）
  radius: number;
  // 強さ
  strength: number;
  // 輪郭からの減衰（大きいほど輪郭のごく近くだけ）
  edgePower: number;
  // 髪以外（服・肌）の強さの倍率
  bodyStrength: number;
}

export const DEFAULT_LIGHT_WRAP_PARAMS: LightWrapParams = {
  enabled: true,
  radius: 0.012,
  strength: 0.4,
  edgePower: 1.5,
  bodyStrength: 0.3,
};

export const LightWrapShader = {
  name: 'LightWrapShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tMask: { value: null as THREE.Texture | null },
    // 髪だけの深度（HairShadowRenderer.depthTexture）
    tHair: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uEnabled: { value: 1.0 },
    uRadius: { value: DEFAULT_LIGHT_WRAP_PARAMS.radius },
    uStrength: { value: DEFAULT_LIGHT_WRAP_PARAMS.strength },
    uEdgePower: { value: DEFAULT_LIGHT_WRAP_PARAMS.edgePower },
    uBodyStrength: { value: DEFAULT_LIGHT_WRAP_PARAMS.bodyStrength },
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
    uniform sampler2D tHair;
    uniform vec2 uResolution;
    uniform float uEnabled;
    uniform float uRadius;
    uniform float uStrength;
    uniform float uEdgePower;
    uniform float uBodyStrength;
    varying vec2 vUv;

    const int TAPS = 32;

    float characterAt(vec2 uv) {
      return step(texture2D(tMask, uv).r, 0.99999);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      if (uEnabled < 0.5 || characterAt(vUv) < 0.5) {
        gl_FragColor = color;
        return;
      }

      // 周囲を円盤状にサンプルし、背景（キャラ以外）の色だけを平均する
      float aspect = uResolution.x / uResolution.y;
      vec3 background = vec3(0.0);
      float backgroundWeight = 0.0;
      for (int i = 0; i < TAPS; i++) {
        float fi = float(i) + 0.5;
        float r = sqrt(fi / float(TAPS)) * uRadius;
        float a = fi * 2.39996323; // 黄金角
        vec2 uv = vUv + vec2(cos(a) / aspect, sin(a)) * r;
        float isBackground = 1.0 - characterAt(uv);
        background += texture2D(tDiffuse, uv).rgb * isBackground;
        backgroundWeight += isBackground;
      }
      if (backgroundWeight < 0.5) {
        gl_FragColor = color;
        return;
      }
      background /= backgroundWeight;

      // 背景の割合が多い所（輪郭に近い所）ほど強く足す
      float edge = pow(clamp(backgroundWeight / float(TAPS) * 2.0, 0.0, 1.0), uEdgePower);

      // 髪が一番手前にある所（髪の深度とキャラの深度が一致）だけ本来の強さ、それ以外は弱める
      float hairDepth = texture2D(tHair, vUv).r;
      float isHair = step(hairDepth, texture2D(tMask, vUv).r + 1e-6) * step(hairDepth, 0.99999);
      float strength = uStrength * mix(uBodyStrength, 1.0, isHair);

      color.rgb += background * edge * strength;
      gl_FragColor = color;
    }
  `,
};

export function applyLightWrapParams(uniforms: typeof LightWrapShader.uniforms, params: Partial<LightWrapParams>): void {
  if (params.enabled !== undefined) uniforms.uEnabled.value = params.enabled ? 1 : 0;
  if (params.radius !== undefined) uniforms.uRadius.value = params.radius;
  if (params.strength !== undefined) uniforms.uStrength.value = params.strength;
  if (params.edgePower !== undefined) uniforms.uEdgePower.value = params.edgePower;
  if (params.bodyStrength !== undefined) uniforms.uBodyStrength.value = params.bodyStrength;
}
