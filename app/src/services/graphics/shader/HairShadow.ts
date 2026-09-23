import * as THREE from 'three';

/**
 * スクリーンスペース方式の前髪の影
 *
 * 1. 髪メッシュだけを深度テクスチャに描く（HairShadowRenderer.render）
 * 2. 顔・肌のシェーダーで、自分の位置を光の方向へ少しずらした点を画面に投影し、
 *    その位置の髪の深度を読む。髪が手前にあれば MToon の shading を落として影色にする
 *
 * シャドウマップと違い、顔にノイズやアクネが出ず、影の形がくっきりする。
 */

// 髪メッシュを載せるレイヤー（深度マスク描画時にこのレイヤーだけを描く）
export const HAIR_SHADOW_LAYER = 5;

export interface HairShadowParams {
  // 光の方向へずらす距離（ワールド単位 m）。大きいほど影が髪から離れて落ちる
  offset: number;
  // 光の向きに関係なく、影を下へずらす量（m）。正面光でも前髪の影を出すため
  downBias: number;
  // 影の濃さ（0 = なし, 1 = MToon の影色そのもの）
  strength: number;
  // 髪がこの距離（m）以上手前にある場合だけ影にする（自己遮蔽のちらつき防止）
  depthBias: number;
  // 髪がこの距離（m）より手前にある場合は影にしない（遠くの髪が顔に影を落とさないように）
  maxDepthDiff: number;
}

export const DEFAULT_HAIR_SHADOW_PARAMS: HairShadowParams = {
  offset: 0.006,
  downBias: 0.002,
  strength: 0.7,
  depthBias: 0.002,
  maxDepthDiff: 0.12,
};

export interface HairShadowUniforms {
  uHairShadowEnabled: { value: number };
  uHairShadowDepth: { value: THREE.Texture | null };
  uHairShadowProjection: { value: THREE.Matrix4 };
  uHairShadowNearFar: { value: THREE.Vector2 };
  uHairShadowLightDir: { value: THREE.Vector3 };
  uHairShadowOffset: { value: number };
  uHairShadowDownBias: { value: number };
  uHairShadowStrength: { value: number };
  uHairShadowDepthBias: { value: number };
  uHairShadowMaxDepthDiff: { value: number };
}

export function createHairShadowUniforms(params: HairShadowParams = DEFAULT_HAIR_SHADOW_PARAMS): HairShadowUniforms {
  return {
    uHairShadowEnabled: { value: 0 },
    uHairShadowDepth: { value: null },
    uHairShadowProjection: { value: new THREE.Matrix4() },
    uHairShadowNearFar: { value: new THREE.Vector2(0.1, 100) },
    uHairShadowLightDir: { value: new THREE.Vector3(0, 1, 1).normalize() },
    uHairShadowOffset: { value: params.offset },
    uHairShadowDownBias: { value: params.downBias },
    uHairShadowStrength: { value: params.strength },
    uHairShadowDepthBias: { value: params.depthBias },
    uHairShadowMaxDepthDiff: { value: params.maxDepthDiff },
  };
}

/**
 * MToon のフラグメントシェーダーに前髪の影を差し込む。
 * プログラムキャッシュを共有しても壊れないよう全 MToon マテリアルに同じコードを入れ、
 * 影を受けるかどうかは uHairShadowReceiver で切り替える。
 */
export function injectHairShadow(
  shader: THREE.WebGLProgramParametersWithUniforms,
  uniforms: HairShadowUniforms,
  receiver: { value: number }
): void {
  Object.assign(shader.uniforms, uniforms);
  shader.uniforms.uHairShadowReceiver = receiver;

  shader.fragmentShader = shader.fragmentShader.replace(
    'void main() {',
    /* glsl */ `
    uniform float uHairShadowEnabled;
    uniform float uHairShadowReceiver;
    uniform sampler2D uHairShadowDepth;
    uniform mat4 uHairShadowProjection;
    uniform vec2 uHairShadowNearFar;
    uniform vec3 uHairShadowLightDir;
    uniform float uHairShadowOffset;
    uniform float uHairShadowDownBias;
    uniform float uHairShadowStrength;
    uniform float uHairShadowDepthBias;
    uniform float uHairShadowMaxDepthDiff;

    float hairShadowDepthToViewZ(float depth) {
      float n = uHairShadowNearFar.x;
      float f = uHairShadowNearFar.y;
      return (n * f) / ((f - n) * depth - f);
    }

    float computeHairShadowLit() {
      if (uHairShadowEnabled < 0.5 || uHairShadowReceiver < 0.5) return 1.0;

      vec3 viewPos = -vViewPosition;
      vec3 lightDirView = normalize((viewMatrix * vec4(uHairShadowLightDir, 0.0)).xyz);

      // 光の方向へずらした点（+ 画面下方向への固定オフセット分だけ上）を投影する
      vec3 samplePos = viewPos + lightDirView * uHairShadowOffset + vec3(0.0, uHairShadowDownBias, 0.0);
      vec4 clip = uHairShadowProjection * vec4(samplePos, 1.0);
      vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
      if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 1.0;

      float hairDepth = texture2D(uHairShadowDepth, uv).r;
      if (hairDepth >= 1.0) return 1.0;

      float hairViewZ = hairShadowDepthToViewZ(hairDepth);
      float diff = hairViewZ - viewPos.z; // 正 = 髪が手前
      float inShadow = step(uHairShadowDepthBias, diff) * step(diff, uHairShadowMaxDepthDiff);
      return 1.0 - inShadow * uHairShadowStrength;
    }

    void main() {
      hairShadowLit = computeHairShadowLit();
    `
  );

  // getShading() は main より前に定義されるので、参照する変数はその手前で宣言する
  // （1.0 = 影なし, 0.0 = 完全に影）
  shader.fragmentShader = shader.fragmentShader.replace(
    'float getShading(',
    'float hairShadowLit = 1.0;\nfloat getShading('
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    'shading *= shadow;',
    'shading *= shadow * hairShadowLit;'
  );
}

/**
 * 髪の深度テクスチャを毎フレーム描くレンダラー
 */
export class HairShadowRenderer {
  public readonly uniforms: HairShadowUniforms;
  private renderTarget: THREE.WebGLRenderTarget;
  private lightPos = new THREE.Vector3();
  private targetPos = new THREE.Vector3();

  constructor(width: number, height: number, params: HairShadowParams = DEFAULT_HAIR_SHADOW_PARAMS) {
    this.uniforms = createHairShadowUniforms(params);
    const depthTexture = new THREE.DepthTexture(width, height);
    depthTexture.type = THREE.UnsignedIntType;
    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      depthTexture,
      depthBuffer: true,
    });
    this.uniforms.uHairShadowEnabled.value = 1;
  }

  public setSize(width: number, height: number): void {
    this.renderTarget.setSize(width, height);
  }

  public setParams(params: Partial<HairShadowParams>): void {
    if (params.offset !== undefined) this.uniforms.uHairShadowOffset.value = params.offset;
    if (params.downBias !== undefined) this.uniforms.uHairShadowDownBias.value = params.downBias;
    if (params.strength !== undefined) this.uniforms.uHairShadowStrength.value = params.strength;
    if (params.depthBias !== undefined) this.uniforms.uHairShadowDepthBias.value = params.depthBias;
    if (params.maxDepthDiff !== undefined) this.uniforms.uHairShadowMaxDepthDiff.value = params.maxDepthDiff;
  }

  public setEnabled(enabled: boolean): void {
    this.uniforms.uHairShadowEnabled.value = enabled ? 1 : 0;
  }

  public render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    light: THREE.DirectionalLight
  ): void {
    const u = this.uniforms;
    if (u.uHairShadowEnabled.value < 0.5) return;

    // 光の向き（ワールド、光源へ向かう方向）
    light.getWorldPosition(this.lightPos);
    light.target.getWorldPosition(this.targetPos);
    u.uHairShadowLightDir.value.subVectors(this.lightPos, this.targetPos).normalize();
    u.uHairShadowProjection.value.copy(camera.projectionMatrix);
    u.uHairShadowNearFar.value.set(camera.near, camera.far);

    // ライトもレイヤー判定の対象なので、ライト数が変わってシェーダーが切り替わらないよう髪レイヤーに載せる
    scene.traverse((obj) => {
      if ((obj as THREE.Light).isLight) obj.layers.enable(HAIR_SHADOW_LAYER);
    });

    // 描画先の深度テクスチャを自分で読むとフィードバックループになるため、描画中は外す
    u.uHairShadowDepth.value = null;

    const prevTarget = renderer.getRenderTarget();
    const prevLayers = camera.layers.mask;
    const prevBackground = scene.background;
    // シャドウマップは本描画で更新されるので、ここでは描き直さない
    const prevShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    scene.background = null;
    camera.layers.set(HAIR_SHADOW_LAYER);

    renderer.setRenderTarget(this.renderTarget);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);

    camera.layers.mask = prevLayers;
    scene.background = prevBackground;
    renderer.shadowMap.autoUpdate = prevShadowAutoUpdate;
    renderer.setRenderTarget(prevTarget);

    u.uHairShadowDepth.value = this.renderTarget.depthTexture;
  }

  public dispose(): void {
    this.renderTarget.depthTexture?.dispose();
    this.renderTarget.dispose();
  }
}
