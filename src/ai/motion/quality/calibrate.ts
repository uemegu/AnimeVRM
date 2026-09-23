import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm';
import { makeContactRig } from './rig';
import { validateAvatarContactProfile } from './validate';
import type { Anchor, AvatarContactProfile, HandFrame, Side } from './types';
import { resolveAssetUrl } from '../../../utils/path';

type TargetId = 'leftCheek' | 'rightCheek' | 'mouth' | 'chin' | 'prayerCenter' | 'leftPalm' | 'rightPalm';
const anchorIds: TargetId[] = ['leftCheek', 'rightCheek', 'mouth', 'chin', 'prayerCenter'];
const handIds: TargetId[] = ['leftPalm', 'rightPalm'];
const boneForTarget: Record<TargetId, VRMHumanBoneName> = {
  leftCheek: 'head', rightCheek: 'head', mouth: 'head', chin: 'head', prayerCenter: 'upperChest',
  leftPalm: 'leftHand', rightPalm: 'rightHand',
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const viewport = $('viewport');
const status = $('status');
const progress = $('progress');
const targetSelect = $('target') as HTMLSelectElement;
const saveButton = $('save') as HTMLButtonElement;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x111722);
viewport.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111722);
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);
scene.add(new THREE.HemisphereLight(0xddeaff, 0x394052, 2.1));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(-2, 4, 5);
scene.add(keyLight);
const floor = new THREE.GridHelper(6, 30, 0x374861, 0x283447);
floor.position.y = 0;
scene.add(floor);
const markerLayer = new THREE.Group();
scene.add(markerLayer);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let vrm: VRM | null = null;
let modelBytes: ArrayBuffer | null = null;
let currentHash = '';
const anchors: Partial<Record<keyof AvatarContactProfile['anchors'] | 'prayerCenter', Anchor>> = {};
const hands: Partial<Record<Side, HandFrame>> = {};
const colors: Record<TargetId, number> = {
  leftCheek: 0xff7c9c, rightCheek: 0xffa558, mouth: 0xe9dc71, chin: 0x95e277,
  prayerCenter: 0x6fcaff, leftPalm: 0xd19cff, rightPalm: 0x9f9cff,
};

function resize(): void {
  const { width, height } = viewport.getBoundingClientRect();
  renderer.setSize(Math.max(1, width), Math.max(1, height), false);
  camera.aspect = Math.max(1, width) / Math.max(1, height);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
resize();

function render(): void {
  requestAnimationFrame(render);
  controls.update();
  if (vrm) vrm.update(0);
  renderer.render(scene, camera);
}
render();

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function loadAvatar(): Promise<void> {
  const url = ($('avatar') as HTMLInputElement).value.trim();
  if (!url.startsWith('/') || url.startsWith('//')) {
    status.textContent = 'VRM URLは同じサイト内のパスで指定してください（例: /models/aoi/aoi-school.vrm）。';
    return;
  }
  saveButton.disabled = true;
  status.textContent = 'VRMを読み込んでいます…';
  progress.textContent = '';
  const resolvedUrl = resolveAssetUrl(url);
  const response = await fetch(resolvedUrl, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`VRMの取得に失敗しました (${response.status})。`);
  modelBytes = await response.arrayBuffer();
  currentHash = hex(await crypto.subtle.digest('SHA-256', modelBytes));
  const loader = new GLTFLoader();
  loader.register(parser => new VRMLoaderPlugin(parser));
  const gltf = await loader.parseAsync(modelBytes, new URL('.', new URL(resolvedUrl, location.href)).href);
  const next = gltf.userData.vrm as VRM | undefined;
  if (!next) throw new Error('このファイルにVRMアバターが見つかりません。');
  if (vrm) scene.remove(vrm.scene);
  markerLayer.clear();
  vrm = next;
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.updateMatrixWorld(true);
  scene.add(vrm.scene);
  const bounds = new THREE.Box3().setFromObject(vrm.scene);
  const center = bounds.getCenter(new THREE.Vector3());
  controls.target.copy(center);
  const size = bounds.getSize(new THREE.Vector3());
  camera.position.copy(center).add(new THREE.Vector3(-size.x * .15, size.y * .12, Math.max(size.x, size.y, size.z) * 2.6));
  controls.minDistance = Math.max(.2, size.y * .45);
  controls.maxDistance = Math.max(4, size.y * 7);
  controls.update();
  for (const key of Object.keys(anchors)) delete anchors[key as keyof typeof anchors];
  for (const key of Object.keys(hands)) delete hands[key as Side];
  targetSelect.value = 'leftCheek';
  status.textContent = `読み込みました。SHA-256: ${currentHash.slice(0, 16)}…\n最初は左頬を選び、モデル表面をクリックしてください。`;
  updateProgress();
}

function projectedUp(normal: THREE.Vector3, actorUp: THREE.Vector3, actorLeft: THREE.Vector3): THREE.Vector3 {
  const result = actorUp.clone().addScaledVector(normal, -actorUp.dot(normal));
  if (result.lengthSq() < 1e-8) result.copy(actorLeft).addScaledVector(normal, -actorLeft.dot(normal));
  return result.normalize();
}

function addMarker(position: THREE.Vector3, color: number, name: string): void {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(.025, 12, 8),
    new THREE.MeshBasicMaterial({ color, depthTest: false }),
  );
  marker.position.copy(position);
  marker.renderOrder = 20;
  marker.userData.calibrationMarker = true;
  marker.name = name;
  markerLayer.add(marker);
}

function updateProgress(): void {
  const complete = [...anchorIds, ...handIds].filter(id => id === 'leftPalm' ? !!hands.left : id === 'rightPalm' ? !!hands.right : !!anchors[id]).length;
  progress.textContent = `校正位置: ${complete}/7`;
  saveButton.disabled = complete !== 7 || !vrm || !currentHash;
}

function recordClick(event: PointerEvent): void {
  if (!vrm || event.button !== 0 || event.target !== renderer.domElement) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(vrm.scene, true).filter(hit => (hit.object as THREE.Mesh).isMesh && !hit.object.userData.calibrationMarker && !!hit.face);
  const hit = hits[0];
  if (!hit?.face) {
    status.textContent = 'モデル表面をクリックしてください。';
    return;
  }
  const selected = targetSelect.value as TargetId;
  let boneName = boneForTarget[selected];
  let bone = vrm.humanoid.getNormalizedBoneNode(boneName);
  if (selected === 'prayerCenter' && !bone) {
    boneName = 'chest';
    bone = vrm.humanoid.getNormalizedBoneNode(boneName);
  }
  if (selected === 'prayerCenter' && !bone) {
    boneName = 'spine';
    bone = vrm.humanoid.getNormalizedBoneNode(boneName);
  }
  if (!bone) {
    status.textContent = `必要な正規化ボーン ${boneName} がこのVRMにありません。`;
    return;
  }
  vrm.scene.updateMatrixWorld(true);
  bone.updateWorldMatrix(true, false);
  const mesh = hit.object as THREE.Mesh;
  const worldNormal = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
  const rig = makeContactRig(vrm);
  const inverseBoneRotation = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
  const point = bone.worldToLocal(hit.point.clone());
  // Prayer hands meet along the actor's left/right axis. The chest click gives
  // the center point; the calibrated normal is deliberately the actor-left axis.
  const contactNormal = selected === 'prayerCenter' ? rig.frame.left.clone() : worldNormal;
  const tangentWorld = projectedUp(contactNormal, rig.frame.up, rig.frame.left);
  if (selected === 'leftPalm' || selected === 'rightPalm') {
    const side = selected === 'leftPalm' ? 'left' : 'right';
    hands[side] = {
      palmPoint: point.toArray() as [number, number, number],
      palmNormal: worldNormal.clone().applyQuaternion(inverseBoneRotation).normalize().toArray() as [number, number, number],
      fingerDirection: tangentWorld.applyQuaternion(inverseBoneRotation).normalize().toArray() as [number, number, number],
    };
  } else {
    anchors[selected] = {
      bone: boneName,
      point: point.toArray() as [number, number, number],
      normal: contactNormal.clone().applyQuaternion(inverseBoneRotation).normalize().toArray() as [number, number, number],
      tangent: tangentWorld.applyQuaternion(inverseBoneRotation).normalize().toArray() as [number, number, number],
    };
  }
  addMarker(hit.point, colors[selected], selected);
  status.textContent = `${targetSelect.selectedOptions[0].text}を記録しました。表面の外向き法線と上向き接線も記録しています。`;
  const next = [...anchorIds, ...handIds].find(id => id !== selected && (id === 'leftPalm' ? !hands.left : id === 'rightPalm' ? !hands.right : !anchors[id]));
  if (next) targetSelect.value = next;
  updateProgress();
}

function buildProfile(): AvatarContactProfile {
  if (!vrm || !modelBytes || !currentHash) throw new Error('VRMを先に読み込んでください。');
  const rig = makeContactRig(vrm);
  const inverseRootRotation = vrm.scene.getWorldQuaternion(new THREE.Quaternion()).invert();
  const position = (name: VRMHumanBoneName) => {
    const node = vrm!.humanoid.getNormalizedBoneNode(name);
    if (!node) throw new Error(`必要なボーン ${name} がありません。`);
    return node.getWorldPosition(new THREE.Vector3());
  };
  const leftUpper = position('leftUpperArm'), leftElbow = position('leftLowerArm'), leftWrist = position('leftHand');
  const rightUpper = position('rightUpperArm'), rightElbow = position('rightLowerArm'), rightWrist = position('rightHand');
  const faceGapMeters = Number(($('faceGap') as HTMLInputElement).value);
  const palmGapMeters = Number(($('palmGap') as HTMLInputElement).value);
  return validateAvatarContactProfile({
    version: 1,
    avatarSha256: currentHash,
    calibrated: true,
    anchors: {
      leftCheek: anchors.leftCheek!, rightCheek: anchors.rightCheek!, mouth: anchors.mouth!, chin: anchors.chin!,
    },
    prayerCenter: anchors.prayerCenter!,
    hands: { left: hands.left!, right: hands.right! },
    armLengths: {
      left: { upper: leftUpper.distanceTo(leftElbow), lower: leftElbow.distanceTo(leftWrist) },
      right: { upper: rightUpper.distanceTo(rightElbow), lower: rightElbow.distanceTo(rightWrist) },
    },
    bodyFrame: {
      left: rig.frame.left.clone().applyQuaternion(inverseRootRotation).toArray() as [number, number, number],
      up: rig.frame.up.clone().applyQuaternion(inverseRootRotation).toArray() as [number, number, number],
      forward: rig.frame.forward.clone().applyQuaternion(inverseRootRotation).toArray() as [number, number, number],
    },
    shoulderWidthMeters: rig.frame.shoulderWidth / rig.uniformScale,
    faceGapMeters,
    palmGapMeters,
  });
}

function downloadProfile(): void {
  try {
    const profile = buildProfile();
    const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `contact-profile-${currentHash.slice(0, 8)}.json`;
    link.click();
    URL.revokeObjectURL(blobUrl);
    status.textContent = '校正プロファイルを保存しました。生成CLIで --contact-profile に指定してください。';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

renderer.domElement.addEventListener('pointerup', recordClick);
$('load').addEventListener('click', () => void loadAvatar().catch(error => { status.textContent = error instanceof Error ? error.message : String(error); }));
saveButton.addEventListener('click', downloadProfile);
const queryAvatar = new URLSearchParams(location.search).get('avatar');
if (queryAvatar) ($('avatar') as HTMLInputElement).value = queryAvatar;
void loadAvatar().catch(error => { status.textContent = error instanceof Error ? error.message : String(error); });
