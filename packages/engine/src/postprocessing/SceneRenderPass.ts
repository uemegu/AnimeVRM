import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';

/**
 * シーンを MSAA の的に描き、composer の画面（readBuffer）へ写す（RenderPass の代わり）。
 *
 * MSAA が要るのはシーンの描画だけ。composer の的そのものを MSAA にすると、後段の全画面パスが書くたびに
 * MSAA の的への書き込みと resolve が走り、パス1枚ごとに重くなる（iPad では全体の3割ほど）。
 * 本描画の深度は depthTexture に残す（背景ぼかし・人物のにじみが読む）。
 */
export class SceneRenderPass extends Pass {
  private readonly target: THREE.WebGLRenderTarget;
  private readonly copy = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms),
    vertexShader: CopyShader.vertexShader,
    fragmentShader: CopyShader.fragmentShader,
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
  }));

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    width: number,
    height: number,
    samples: number
  ) {
    super();
    this.needsSwap = false;
    this.target = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      samples,
      depthTexture: new THREE.DepthTexture(width, height),
    });
  }

  /** 本描画の深度 */
  get depthTexture(): THREE.DepthTexture {
    return this.target.depthTexture!;
  }

  setSize(width: number, height: number): void {
    this.target.setSize(width, height);
  }

  render(renderer: THREE.WebGLRenderer, _writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = autoClear;

    (this.copy.material as THREE.ShaderMaterial).uniforms.tDiffuse.value = this.target.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    this.copy.render(renderer);
  }

  dispose(): void {
    this.target.depthTexture?.dispose();
    this.target.dispose();
    this.copy.material.dispose();
    this.copy.dispose();
  }
}
