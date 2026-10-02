import * as THREE from 'three';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { OVERLAY_LAYER } from '../effects/overlayLayer';

/**
 * OVERLAY_LAYER のオブジェクトだけを、今の画面の上に重ねて描く（背景ぼかしの対象にしない演出用）。
 * 画面（readBuffer）へ直接描き足すので、パスの入れ替えはしない
 */
export class OverlayPass extends Pass {
  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera
  ) {
    super();
    this.needsSwap = false;
  }

  public render(renderer: THREE.WebGLRenderer, _writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const { scene, camera } = this;
    const mask = camera.layers.mask;
    const background = scene.background;
    const autoClear = renderer.autoClear;
    camera.layers.set(OVERLAY_LAYER);
    scene.background = null;
    renderer.autoClear = false;
    renderer.setRenderTarget(readBuffer);
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = autoClear;
    scene.background = background;
    camera.layers.mask = mask;
  }
}
