import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { loadPaintedLibrary, disposePaintedLibrary, SKY_ONLY_BACKGROUND } from './scene/painted-library/PaintedLibrary';
import { buildLibraryBlockout } from './scene/painted-library/blockout';
import { AVATAR_POSITION, CHAIR, LIBRARY_SHOTS } from './scene/painted-library/layout';
import { SkyBackground } from './scene/SkyBackground';
import { loadMixamoAnimation } from './Avatar';
import { resolveAssetUrl } from './utils/path';

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
const status = document.querySelector<HTMLElement>('#status')!;
const shotLabel = document.querySelector<HTMLElement>('#shot')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#c9d3df');
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
const target = new THREE.Vector3();
scene.add(new THREE.HemisphereLight('#e2edff', '#8b7c69', 2));
// Window light from screen left, as painted.
const sun = new THREE.DirectionalLight('#fff3df', 2.2);
sun.position.set(-4, 4, 1);
scene.add(sun);

type Pose = 'chin' | 'sit' | 'none';
let vrm: VRM | undefined;
let mixer: THREE.AnimationMixer | undefined;
let chinRest: THREE.AnimationAction | undefined;
let pose: Pose = 'chin';
let painted: THREE.Group | undefined;
const blockout = buildLibraryBlockout();
let playing = false, elapsed = 0, shot = 0, baseFov = 40;
const clock = new THREE.Clock();
const position = new THREE.Vector3(), nextTarget = new THREE.Vector3();

const shotButtons = LIBRARY_SHOTS.map((preset, index) => {
  const button = document.createElement('button');
  button.textContent = preset.label;
  button.dataset.shot = String(index);
  button.addEventListener('click', () => { pause(); applyShot(index); });
  document.querySelector('#shots')!.append(button);
  return button;
});

function applyShot(index: number) {
  shot = index;
  const preset = LIBRARY_SHOTS[index];
  camera.position.fromArray(preset.position);
  target.fromArray(preset.target);
  baseFov = preset.fov;
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
  camera.lookAt(target);
  shotLabel.textContent = preset.label;
  shotButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
}
function pause() {
  playing = false;
  document.querySelector('#play')!.textContent = 'カメラを再生';
}
document.querySelector('#play')!.addEventListener('click', () => {
  playing = !playing;
  elapsed = 0;
  document.querySelector('#play')!.textContent = playing ? '一時停止' : 'カメラを再生';
});

function showBlockout(on: boolean) {
  blockout.visible = on || !painted;
  if (painted) painted.visible = !on;
  document.querySelector('#blockout')!.setAttribute('aria-pressed', String(blockout.visible));
}
document.querySelector('#blockout')!.addEventListener('click', () => showBlockout(!blockout.visible));

const euler = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)).toArray();
/** Seated legs: thighs forward, shins down. The chin-rest clip has no seat, so its legs are replaced. */
const SEATED_LEGS = {
  leftUpperLeg: euler(-1.5, 0, 0.04), rightUpperLeg: euler(-1.5, 0, -0.04),
  leftLowerLeg: euler(1.45, 0, 0), rightLowerLeg: euler(1.45, 0, 0),
  leftFoot: euler(0.05, 0, 0), rightFoot: euler(0.05, 0, 0),
};
/** Arm rotations that point the upper arm and forearm along world directions (normalized rig, torso unrotated). */
function armPose(side: 1 | -1, upper: [number, number, number], fore: [number, number, number]) {
  const rest = new THREE.Vector3(side, 0, 0);
  const upperQ = new THREE.Quaternion().setFromUnitVectors(rest, new THREE.Vector3(...upper).normalize());
  const foreQ = upperQ.clone().invert().multiply(new THREE.Quaternion().setFromUnitVectors(rest, new THREE.Vector3(...fore).normalize()));
  return [upperQ.toArray(), foreQ.toArray()];
}
const [leftUpperArm, leftLowerArm] = armPose(1, [0.3, -0.5, 0.8], [-0.55, -0.04, 0.83]);
const [rightUpperArm, rightLowerArm] = armPose(-1, [-0.3, -0.5, 0.8], [0.55, -0.04, 0.83]);
/** Sitting upright with both forearms on the table, looking down at the book. */
const SEATED_UPPER = {
  neck: euler(0.12, 0, 0), head: euler(0.18, 0, 0),
  leftUpperArm, leftLowerArm, rightUpperArm, rightLowerArm,
};
let sitRootY = AVATAR_POSITION[1];

function applyPoseOverrides() {
  if (!vrm || pose === 'none') return;
  const bones = pose === 'sit' ? { ...SEATED_UPPER, ...SEATED_LEGS } : SEATED_LEGS;
  for (const [name, rotation] of Object.entries(bones)) {
    vrm.humanoid.getNormalizedBoneNode(name as any)?.quaternion.fromArray(rotation);
  }
}

function setPose(next: Pose) {
  pose = next;
  document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.pose === next)));
  if (!vrm) return;
  vrm.scene.visible = next !== 'none';
  if (next === 'sit') {
    chinRest?.stop();
    vrm.humanoid.resetNormalizedPose();
    vrm.scene.position.set(AVATAR_POSITION[0], sitRootY, AVATAR_POSITION[2]);
  } else {
    chinRest?.reset().play();
    vrm.scene.position.set(...AVATAR_POSITION);
  }
}
document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach((button) => button.addEventListener('click', () => setPose(button.dataset.pose as Pose)));

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
applyShot(0);
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.1);
  if (playing) {
    elapsed += delta;
    if (elapsed >= 5) { elapsed %= 5; shot = (shot + 1) % LIBRARY_SHOTS.length; }
    const a = LIBRARY_SHOTS[shot], b = LIBRARY_SHOTS[(shot + 1) % LIBRARY_SHOTS.length];
    const t = THREE.MathUtils.smoothstep(elapsed, 0.8, 4.8);
    camera.position.fromArray(a.position).lerp(position.fromArray(b.position), t);
    target.fromArray(a.target).lerp(nextTarget.fromArray(b.target), t);
    baseFov = THREE.MathUtils.lerp(a.fov, b.fov, t);
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    shotLabel.textContent = `${a.label} → ${b.label}`;
  }
  if (pose === 'chin') mixer?.update(delta);
  applyPoseOverrides();
  vrm?.update(delta);
  renderer.render(scene, camera);
});

async function loadShion() {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(resolveAssetUrl('/models/shion/shion-school.vrm'));
  vrm = gltf.userData.vrm;
  if (!vrm) throw new Error('VRM avatar missing');
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((object) => { object.frustumCulled = false; });
  // Static sitting pose: put the rest-pose hips just above the seat.
  const hips = vrm.humanoid.getNormalizedBoneNode('hips')!;
  vrm.scene.updateMatrixWorld(true);
  sitRootY = CHAIR.seat + 0.08 - hips.getWorldPosition(new THREE.Vector3()).y;
  mixer = new THREE.AnimationMixer(vrm.scene);
  chinRest = mixer.clipAction(await loadMixamoAnimation('/animations/chin_rest.fbx', vrm));
  vrm.expressionManager?.setValue('relaxed', 1.0);
  vrm.lookAt && (vrm.lookAt.target = camera);
  scene.add(vrm.scene);
  setPose(pose);
}

async function start() {
  // Same sky the scenario viewer draws behind a background image with transparent sky.
  const sky = new SkyBackground(scene);
  sky.setTimeOfDay('day');
  const skyTexture = await new THREE.TextureLoader().loadAsync(resolveAssetUrl(SKY_ONLY_BACKGROUND));
  sky.material.uniforms.uPainting.value = skyTexture;
  sky.mesh.visible = true;
  scene.add(blockout);
  const forceBlockout = new URLSearchParams(location.search).has('blockout');
  if (!forceBlockout) {
    try {
      painted = await loadPaintedLibrary();
      scene.add(painted);
    } catch (error) {
      console.warn('Painted library unavailable, showing the blockout', error);
    }
  }
  showBlockout(forceBlockout);
  status.textContent = '図書室を表示中・シオン読込中';
  await loadShion();
  status.textContent = painted ? '面ごとの生成画像 + 家具のアクスタ' : 'ブロックアウト（灰色の箱）';
  document.body.dataset.ready = 'true';
}
start().catch((error) => { console.error(error); status.textContent = '読込に失敗しました。ページを再読み込みしてください。'; });
window.addEventListener('pagehide', () => {
  renderer.setAnimationLoop(null);
  if (painted) disposePaintedLibrary(painted);
  if (vrm) VRMUtils.deepDispose(vrm.scene);
  renderer.dispose();
});
