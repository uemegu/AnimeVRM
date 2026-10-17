import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { createLayerDepthTarget, renderLayerDepth } from '../shader/LayerDepth';

/**
 * キャラのマスクとライトラップ
 *
 * キャラのマスク: アバターの全メッシュだけを深度テクスチャに描き、深度 < 1 の所をキャラとする。
 * ライトラップ: キャラの輪郭の内側に、周囲の「背景だけ」をぼかした色を足す合成処理。
 *   背景が明るい所ほど光がキャラに回り込み、キャラが背景になじむ。暗い背景ではほとんど変わらない。
 *   描画直後のリニア空間（ブルームの前）で行う。
 *   髪以外（服・肌）の強さは bodyStrength 倍にする（1 で髪と同じ）。暗く縁のくっきりした服に強くかけると
 *   切り抜きの縁取り（ハロー）に見えることがあるので既定は 0.3。場所の stage.character.lightWrapBody で変えられる。髪の判定には前髪の影用の髪の深度を使う。
 */

// アバターのメッシュを載せるレイヤー（マスク描画時にこのレイヤーだけを描く）
export const CHARACTER_LAYER = 6;
// 目（白目・瞳・ハイライト）のメッシュを載せるレイヤー。人物のにじみから目を外すのに使う
export const EYE_LAYER = 7;

export class CharacterMaskRenderer {
  private renderTarget: THREE.WebGLRenderTarget;

  /** layer: 描くレイヤー（既定はキャラ全体。EYE_LAYER なら目だけ） */
  constructor(width: number, height: number, private readonly layer = CHARACTER_LAYER) {
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
    renderLayerDepth(renderer, scene, camera, this.layer, this.renderTarget);
  }

  public dispose(): void {
    this.renderTarget.depthTexture?.dispose();
    this.renderTarget.dispose();
  }
}

/**
 * キャラのマスクから、手前の物（教卓・近景など）に隠れた所を除く（隠れた所は深度 1 にする）。
 * マスクはキャラだけを描くので、そのままだと隠れた脚の形に明部の抑え・パラ・ライトラップがかかり、
 * 手前の物の上に人物の形が透けて見える。本描画の深度（SceneRenderPass.depthTexture）と比べるので、
 * composer では本描画の直後に置く。マスクを読むパスには texture を渡す。
 */
export class VisibleMaskPass extends Pass {
  private readonly target: THREE.WebGLRenderTarget;
  private readonly material = new THREE.ShaderMaterial({
    uniforms: {
      tMask: { value: null as THREE.Texture | null },
      tScene: { value: null as THREE.Texture | null },
      uNearFar: { value: new THREE.Vector2(0.1, 100) },
    },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    // 深度の値のままだと、本描画（MSAA）とマスクで画素内の測る位置が違うだけで顔の三角形の境目が「隠れた」になり、
    // そこに背景がにじんで筋になる。奥行き（m）に直し、2cm か奥行きの2%より奥にあるときだけ隠れたとする
    fragmentShader: `#include <packing>
      uniform sampler2D tMask, tScene; uniform vec2 uNearFar; varying vec2 vUv;
      void main() {
        float character = texture2D(tMask, vUv).r;
        if (character >= 1.0) { gl_FragDepth = 1.0; return; }
        float characterZ = -perspectiveDepthToViewZ(character, uNearFar.x, uNearFar.y);
        float sceneZ = -perspectiveDepthToViewZ(texture2D(tScene, vUv).r, uNearFar.x, uNearFar.y);
        gl_FragDepth = characterZ <= sceneZ + max(0.02, sceneZ * 0.02) ? character : 1.0;
      }`,
    // 深度だけを書く（深度テストを切ると深度も書かれないので、常に通す）
    depthTest: true, depthFunc: THREE.AlwaysDepth, depthWrite: true, colorWrite: false,
  });
  private readonly quad = new FullScreenQuad(this.material);

  constructor(mask: THREE.Texture, sceneDepth: THREE.Texture, private readonly camera: THREE.PerspectiveCamera, width: number, height: number) {
    super();
    this.needsSwap = false;
    this.target = createLayerDepthTarget(width, height);
    this.material.uniforms.tMask.value = mask;
    this.material.uniforms.tScene.value = sceneDepth;
  }

  /** 見えているキャラの所は深度 < 1、ほかは 1 */
  get texture(): THREE.DepthTexture {
    return this.target.depthTexture!;
  }

  setSize(width: number, height: number): void {
    this.target.setSize(width, height);
  }

  render(renderer: THREE.WebGLRenderer): void {
    this.material.uniforms.uNearFar.value.set(this.camera.near, this.camera.far);
    renderer.setRenderTarget(this.target);
    renderer.clear(false, true, false);
    this.quad.render(renderer);
  }

  dispose(): void {
    this.target.depthTexture?.dispose();
    this.target.dispose();
    this.material.dispose();
    this.quad.dispose();
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

      // 周囲を円盤状にサンプルし、背景（キャラ以外）の明るい光ほど強く拾う（透過光・色トレス）
      float aspect = uResolution.x / uResolution.y;
      vec3 background = vec3(0.0);
      float backgroundWeight = 0.0;
      float bgCoverage = 0.0;
      for (int i = 0; i < TAPS; i++) {
        float fi = float(i) + 0.5;
        float r = sqrt(fi / float(TAPS)) * uRadius;
        float a = fi * 2.39996323; // 黄金角
        vec2 uv = vUv + vec2(cos(a) / aspect, sin(a)) * r;
        float isBackground = 1.0 - characterAt(uv);
        vec3 sampleBg = texture2D(tDiffuse, uv).rgb;
        float sampleLuma = dot(sampleBg, vec3(0.2126, 0.7152, 0.0722));
        // 窓枠や枝葉の暗部よりも、背後の空や夕日の高輝度光を優先して回り込ませる
        float lumaWeight = 1.0 + smoothstep(0.45, 1.8, sampleLuma) * 1.8;
        float w = isBackground * lumaWeight;
        background += sampleBg * w;
        backgroundWeight += w;
        bgCoverage += isBackground;
      }
      if (bgCoverage < 0.5) {
        gl_FragColor = color;
        return;
      }
      background /= max(backgroundWeight, 1e-4);

      // 輪郭の鋭い回り込み（リム）と、強い逆光時のやわらかい空気感（ディフュージョンラップ）の2層合成
      float coverage = clamp(bgCoverage / float(TAPS) * 2.0, 0.0, 1.0);
      float bgLuma = dot(background, vec3(0.2126, 0.7152, 0.0722));
      float tightEdge = pow(coverage, uEdgePower);
      float softEdge = pow(coverage, max(0.85, uEdgePower * 0.55)) * smoothstep(0.55, 1.4, bgLuma) * 0.32;
      float edge = clamp(tightEdge + softEdge, 0.0, 1.0);

      // 髪が一番手前にある所（髪の深度とキャラの深度が一致）だけ本来の強さ、それ以外は弱める
      float hairDepth = texture2D(tHair, vUv).r;
      float isHair = step(hairDepth, texture2D(tMask, vUv).r + 1e-6) * step(hairDepth, 0.99999);
      float strength = uStrength * mix(uBodyStrength, 1.0, isHair);

      vec3 wrapLight = background * edge * strength;
      // 暗い輪郭線・髪のフチにはスクリーン調で色トレスとしてなじませ、明部も自然に持ち上げる
      vec3 screenBlend = 1.0 - (1.0 - clamp(color.rgb, 0.0, 1.0)) * (1.0 - clamp(wrapLight, 0.0, 1.0));
      color.rgb = mix(color.rgb + wrapLight * 0.85, max(color.rgb, screenBlend), 0.45);
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
