import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { loadMixamoAnimation, releaseMixamoAnimation } from '../../../Avatar';

const CELL_WIDTH = 220;
const CELL_HEIGHT = 330;

/**
 * Render an exported FBX through the game's importer as a PNG contact sheet.
 * Columns are evenly spaced times; the rows show the avatar from the front and from its right side.
 */
export async function renderMotionPreview(fbx: ArrayBuffer, vrm: VRM, columns = 6): Promise<string> {
  const url = URL.createObjectURL(new Blob([fbx]));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf2f2f2);
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(1, 2, 3);
  scene.add(sun);
  const floor = new THREE.GridHelper(2, 8, 0xaaaaaa, 0xcccccc);
  scene.add(floor);
  const previousParent = vrm.scene.parent;
  scene.add(vrm.scene);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(CELL_WIDTH, CELL_HEIGHT);
  const sheet = document.createElement('canvas');
  sheet.width = CELL_WIDTH * columns;
  sheet.height = CELL_HEIGHT * 2;
  const context = sheet.getContext('2d')!;
  const mixer = new THREE.AnimationMixer(vrm.scene);
  try {
    const clip = await loadMixamoAnimation(url, vrm);
    mixer.clipAction(clip).play();
    vrm.humanoid.resetNormalizedPose();
    vrm.scene.updateMatrixWorld(true);
    const head = vrm.humanoid.getNormalizedBoneNode('head')!.getWorldPosition(new THREE.Vector3());
    const height = head.y + 0.2;
    const center = new THREE.Vector3(0, height * 0.52, 0);
    const camera = new THREE.PerspectiveCamera(28, CELL_WIDTH / CELL_HEIGHT, 0.1, 20);
    const distance = height * 0.58 / Math.tan(THREE.MathUtils.degToRad(14));
    const views = [new THREE.Vector3(0, 0, distance), new THREE.Vector3(-distance, 0, 0)];
    context.font = '14px sans-serif';
    context.fillStyle = '#333';
    for (let column = 0; column < columns; column++) {
      const time = Math.min(clip.duration - 1e-3, clip.duration * column / (columns - 1));
      mixer.setTime(time);
      vrm.humanoid.update();
      vrm.scene.updateMatrixWorld(true);
      views.forEach((offset, row) => {
        camera.position.copy(center).add(offset);
        camera.lookAt(center);
        renderer.render(scene, camera);
        context.drawImage(renderer.domElement, column * CELL_WIDTH, row * CELL_HEIGHT);
      });
      context.fillText(`${time.toFixed(1)}s`, column * CELL_WIDTH + 8, 18);
    }
    return sheet.toDataURL('image/png').split(',')[1];
  } finally {
    mixer.stopAllAction();
    mixer.uncacheRoot(vrm.scene);
    vrm.humanoid.resetNormalizedPose();
    vrm.humanoid.update();
    scene.remove(vrm.scene);
    previousParent?.add(vrm.scene);
    renderer.dispose();
    releaseMixamoAnimation(url, vrm);
    URL.revokeObjectURL(url);
  }
}
