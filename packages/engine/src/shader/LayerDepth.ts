import * as THREE from 'three';

/**
 * 指定レイヤーのオブジェクトだけを深度テクスチャ付きのレンダーターゲットに描く。
 * 前髪の影（髪の深度）やキャラのマスクに使う。
 * マテリアルはそのまま使うので、髪の毛先のアルファカットも反映される。
 */

export function createLayerDepthTarget(width: number, height: number): THREE.WebGLRenderTarget {
  const depthTexture = new THREE.DepthTexture(width, height);
  depthTexture.type = THREE.UnsignedIntType;
  return new THREE.WebGLRenderTarget(width, height, {
    depthTexture,
    depthBuffer: true,
  });
}

export function renderLayerDepth(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  layer: number,
  target: THREE.WebGLRenderTarget
): void {
  // ライトもレイヤー判定の対象なので、ライト数が変わってシェーダーが切り替わらないよう同じレイヤーに載せる
  scene.traverse((obj) => {
    if ((obj as THREE.Light).isLight) obj.layers.enable(layer);
  });

  const prevTarget = renderer.getRenderTarget();
  const prevLayers = camera.layers.mask;
  const prevBackground = scene.background;
  // シャドウマップは本描画で更新されるので、ここでは描き直さない
  const prevShadowAutoUpdate = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = false;
  scene.background = null;
  camera.layers.set(layer);

  renderer.setRenderTarget(target);
  renderer.clear(true, true, true);
  renderer.render(scene, camera);

  camera.layers.mask = prevLayers;
  scene.background = prevBackground;
  renderer.shadowMap.autoUpdate = prevShadowAutoUpdate;
  renderer.setRenderTarget(prevTarget);
}
