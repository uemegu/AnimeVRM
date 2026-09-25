import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { loadPaintedClassroom, disposePaintedClassroom, PAINTED_CLASSROOM_IMAGE, PAINTED_CLASSROOM_SHOTS, AVATAR_POSITION, coverFov } from './scene/painted-classroom/PaintedClassroom';
import { resolveAssetUrl } from './utils/path';

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
const status = document.querySelector<HTMLElement>('#status')!;
const shotLabel = document.querySelector<HTMLElement>('#shot')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#b8c3d3');
const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 60);
const target = new THREE.Vector3();
scene.add(new THREE.HemisphereLight('#e2edff', '#8b7c69', 2));
const sun = new THREE.DirectionalLight('#fff5e3', 2.2);
sun.position.set(-4, 5, 3);
scene.add(sun);
let vrm: VRM | undefined;
let room: THREE.Group | undefined;
let original: THREE.Texture | undefined;
let flat = false, playing = false, elapsed = 0, shot = 0, baseFov = 50;
const clock = new THREE.Clock();
const position = new THREE.Vector3(), nextTarget = new THREE.Vector3();

function applyShot(index: number) {
  shot = index;
  const preset = PAINTED_CLASSROOM_SHOTS[index];
  camera.position.fromArray(preset.position);
  target.fromArray(preset.target);
  baseFov = preset.fov;
  camera.fov = coverFov(baseFov, camera.aspect);
  camera.updateProjectionMatrix();
  camera.lookAt(target);
  shotLabel.textContent = preset.label;
  document.querySelectorAll<HTMLButtonElement>('[data-shot]').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
}
function pause() {
  playing = false;
  document.querySelector('#play')!.textContent = 'カメラを再生';
}
document.querySelectorAll<HTMLButtonElement>('[data-shot]').forEach((button, index) => button.addEventListener('click', () => { pause(); applyShot(index); }));
document.querySelector('#play')!.addEventListener('click', () => {
  playing = !playing;
  elapsed = 0;
  document.querySelector('#play')!.textContent = playing ? '一時停止' : 'カメラを再生';
});
document.querySelector('#compare')!.addEventListener('click', () => {
  if (!original || !room) return;
  flat = !flat;
  room.visible = !flat;
  scene.background = flat ? original : new THREE.Color('#b8c3d3');
  document.querySelector('#compare')!.textContent = flat ? '簡易3Dに戻す' : '元の1枚絵と比較';
  document.querySelector('#compare')!.setAttribute('aria-pressed', String(flat));
});
document.querySelector('#avatar-toggle')!.addEventListener('click', () => {
  if (!vrm) return;
  vrm.scene.visible = !vrm.scene.visible;
  document.querySelector('#avatar-toggle')!.textContent = vrm.scene.visible ? 'アバターを隠す' : 'アバターを表示';
  document.querySelector('#avatar-toggle')!.setAttribute('aria-pressed', String(!vrm.scene.visible));
});
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = coverFov(baseFov, camera.aspect);
  camera.updateProjectionMatrix();
  // Match the original image's cover framing without stretching it.
  if (original) {
    const ratio = (1672 / 941) / camera.aspect;
    original.repeat.set(ratio > 1 ? 1 / ratio : 1, ratio > 1 ? 1 : ratio);
    original.offset.set((1 - original.repeat.x) / 2, (1 - original.repeat.y) / 2);
  }
}
window.addEventListener('resize', resize);
resize();
applyShot(0);
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.1);
  if (playing) {
    elapsed += delta;
    if (elapsed >= 5) { elapsed %= 5; shot = (shot + 1) % PAINTED_CLASSROOM_SHOTS.length; }
    const a = PAINTED_CLASSROOM_SHOTS[shot], b = PAINTED_CLASSROOM_SHOTS[(shot + 1) % PAINTED_CLASSROOM_SHOTS.length];
    const t = THREE.MathUtils.smoothstep(elapsed, 0.8, 4.8);
    camera.position.fromArray(a.position).lerp(position.fromArray(b.position), t);
    target.fromArray(a.target).lerp(nextTarget.fromArray(b.target), t);
    baseFov = THREE.MathUtils.lerp(a.fov, b.fov, t);
    camera.fov = coverFov(baseFov, camera.aspect);
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    shotLabel.textContent = `${a.label} → ${b.label}`;
  }
  vrm?.update(delta);
  renderer.render(scene, camera);
});

async function start() {
  room = await loadPaintedClassroom();
  scene.add(room);
  status.textContent = '教室を表示中・アバター読込中';
  // Keep the comparison texture separate from the atlas (repeat/offset differ).
  original = await new THREE.TextureLoader().loadAsync(resolveAssetUrl(PAINTED_CLASSROOM_IMAGE));
  original.colorSpace = THREE.SRGBColorSpace;
  resize();
  document.querySelector<HTMLButtonElement>('#compare')!.disabled = false;
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(resolveAssetUrl('/models/aoi/aoi-school.vrm'));
  vrm = gltf.userData.vrm;
  if (!vrm) throw new Error('VRM avatar missing');
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.position.set(...AVATAR_POSITION);
  vrm.humanoid.setNormalizedPose({
    leftUpperArm: { rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -1.2)).toArray() },
    rightUpperArm: { rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 1.2)).toArray() },
  });
  vrm.expressionManager?.setValue('happy', 1.0);
  scene.add(vrm.scene);
  status.textContent = '元画像の横一列 × 6層 / アバターは手前の会話距離';
  document.querySelector<HTMLButtonElement>('#avatar-toggle')!.disabled = false;
  document.body.dataset.ready = 'true';
}
start().catch((error) => { console.error(error); status.textContent = '読込に失敗しました。ページを再読み込みしてください。'; });
window.addEventListener('pagehide', () => {
  renderer.setAnimationLoop(null);
  if (room) disposePaintedClassroom(room);
  original?.dispose();
  if (vrm) VRMUtils.deepDispose(vrm.scene);
  renderer.dispose();
});
