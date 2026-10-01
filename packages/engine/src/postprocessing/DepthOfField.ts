import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * 背景ぼかし（被写界深度）。ピントの距離から離れた所を、薄いレンズのぼけの大きさでぼかす。
 *
 * 本描画の深度を使うので、RenderPass の直後に置くこと（後ろのパスの出力先には今のフレームの深度がない）。
 * 各点は自分のぼけの半径の円の中から集め、集める先のぼけがその点まで届かないものは混ぜない。
 * ピントの合ったキャラは背景の点まで広がらないので、キャラの色が背景ににじまない。
 */
const DepthOfFieldShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uNearFar: { value: new THREE.Vector2(0.1, 100) },
    uFocus: { value: 2 },
    uSharpRange: { value: 0 },
    // 「|奥行き - ピント| / 奥行き」が1のときのぼけの直径（px）
    uCocScale: { value: 0 },
    uMaxRadius: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 uResolution;
    uniform vec2 uNearFar;
    uniform float uFocus;
    uniform float uSharpRange;
    uniform float uCocScale;
    uniform float uMaxRadius;
    varying vec2 vUv;

    const int SAMPLES = 40;
    const float GOLDEN_ANGLE = 2.39996323;

    // ぼけの半径（px）
    float cocAt(vec2 uv) {
      float depth = texture2D(tDepth, uv).x;
      float z = -perspectiveDepthToViewZ(depth, uNearFar.x, uNearFar.y);
      // ピントより奥は uSharpRange だけ手前にずらして測る（その幅まではぼかさない）
      float offset = z > uFocus ? max(z - uFocus - uSharpRange, 0.0) : uFocus - z;
      return min(0.5 * uCocScale * offset / max(z, 1e-3), uMaxRadius);
    }

    void main() {
      vec4 center = texture2D(tDiffuse, vUv);
      float radius = cocAt(vUv);
      if (radius < 0.5) {
        gl_FragColor = center;
        return;
      }
      vec3 sum = center.rgb;
      float weight = 1.0;
      for (int i = 0; i < SAMPLES; i++) {
        float t = (float(i) + 0.5) / float(SAMPLES);
        float r = sqrt(t) * radius;
        float a = float(i) * GOLDEN_ANGLE;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * r / uResolution;
        // 集める先のぼけがここまで届くときだけ混ぜる
        float w = smoothstep(r - 1.0, r + 1.0, cocAt(uv));
        sum += texture2D(tDiffuse, uv).rgb * w;
        weight += w;
      }
      gl_FragColor = vec4(sum / weight, center.a);
    }
  `,
};

export interface DepthOfFieldParams {
  /** レンズの口径（m）。大きいほどぼける */
  aperture: number;
  /** ぼけの直径の上限（画面の高さに対する割合） */
  maxBlur: number;
  /** ピントより奥でもぼかさない幅（m） */
  sharpRange: number;
}

export class DepthOfFieldPass extends Pass {
  private readonly material: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private params: DepthOfFieldParams = { aperture: 0, maxBlur: 0, sharpRange: 0 };

  constructor() {
    super();
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(DepthOfFieldShader.uniforms),
      vertexShader: DepthOfFieldShader.vertexShader,
      fragmentShader: DepthOfFieldShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  public setParams(params: DepthOfFieldParams | null): void {
    this.enabled = !!params && params.aperture > 0 && params.maxBlur > 0;
    if (params) this.params = params;
  }

  /** ピントを合わせる距離（カメラの向きに沿った奥行き m）とカメラ */
  public setFocus(camera: THREE.PerspectiveCamera, focusDistance: number): void {
    const u = this.material.uniforms;
    const height = u.uResolution.value.y as number;
    const focus = Math.max(focusDistance, camera.near * 2);
    // ピントの面での画面の高さ（m）に対する口径の割合を、画面の高さ（px）に直す
    const frameHeight = 2 * focus * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    u.uNearFar.value.set(camera.near, camera.far);
    u.uFocus.value = focus;
    u.uSharpRange.value = this.params.sharpRange;
    u.uCocScale.value = (this.params.aperture / frameHeight) * height;
    u.uMaxRadius.value = 0.5 * this.params.maxBlur * height;
  }

  public setSize(width: number, height: number): void {
    this.material.uniforms.uResolution.value.set(width, height);
  }

  public render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.material.uniforms.tDepth.value = readBuffer.depthTexture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.quad.render(renderer);
  }

  public dispose(): void {
    this.material.dispose();
    this.quad.dispose();
  }
}
