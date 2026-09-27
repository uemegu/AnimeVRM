import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm';
import { makeContactRig } from './rig';
import { validateAvatarContactProfile } from './validate';
import type { Anchor, AvatarContactProfile, HandFrame, Side } from './types';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';

/** 校正で記録する位置（顔の4点・胸の前の両手の中心・両手のひら） */
export const CALIBRATION_TARGETS = ['leftCheek', 'rightCheek', 'mouth', 'chin', 'prayerCenter', 'leftPalm', 'rightPalm'] as const;
export type CalibrationTarget = (typeof CALIBRATION_TARGETS)[number];

const BONE_FOR_TARGET: Record<CalibrationTarget, VRMHumanBoneName> = {
  leftCheek: 'head', rightCheek: 'head', mouth: 'head', chin: 'head', prayerCenter: 'upperChest',
  leftPalm: 'leftHand', rightPalm: 'rightHand',
};
const MARKER_COLORS: Record<CalibrationTarget, number> = {
  leftCheek: 0xff7c9c, rightCheek: 0xffa558, mouth: 0xe9dc71, chin: 0x95e277,
  prayerCenter: 0x6fcaff, leftPalm: 0xd19cff, rightPalm: 0x9f9cff,
};

export interface CalibrationState {
  /** 読み込んだ VRM の SHA-256（なければ null） */
  avatarSha256: string | null;
  recorded: CalibrationTarget[];
  /** 直前のクリックの結果 */
  notice?: 'recorded' | 'missSurface' | 'missingBone';
}

/**
 * VRM の表面をクリックして、接触の補正に使う基準点（顔・胸の前・手のひら）を記録する。
 * 表示先の要素を受け取り、描画と操作（ドラッグで回転・ホイールで拡大縮小）を持つ
 */
export class ContactCalibrator {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
  private readonly controls: OrbitControls;
  private readonly markers = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly observer: ResizeObserver;
  private frame = 0;
  private vrm: VRM | null = null;
  private hash: string | null = null;
  private anchors: Partial<Record<Exclude<CalibrationTarget, 'leftPalm' | 'rightPalm'>, Anchor>> = {};
  private hands: Partial<Record<Side, HandFrame>> = {};
  /** 次にクリックで記録する位置 */
  public target: CalibrationTarget = 'leftCheek';

  constructor(
    private readonly container: HTMLElement,
    private readonly onChange: (state: CalibrationState) => void
  ) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xf1f5f9);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a94a6, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(-2, 4, 5);
    this.scene.add(key);
    this.scene.add(new THREE.GridHelper(6, 30, 0xcbd5e1, 0xe2e8f0));
    this.scene.add(this.markers);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1, 0);
    this.camera.position.set(0, 1.4, 2.5);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    const render = () => {
      this.frame = requestAnimationFrame(render);
      this.controls.update();
      this.vrm?.update(0);
      this.renderer.render(this.scene, this.camera);
    };
    render();
  }

  get state(): CalibrationState {
    return {
      avatarSha256: this.hash,
      recorded: CALIBRATION_TARGETS.filter((id) => this.isRecorded(id)),
    };
  }

  private isRecorded(id: CalibrationTarget): boolean {
    if (id === 'leftPalm') return !!this.hands.left;
    if (id === 'rightPalm') return !!this.hands.right;
    return !!this.anchors[id];
  }

  private resize(): void {
    const { width, height } = this.container.getBoundingClientRect();
    this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = Math.max(1, width) / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /** VRM を読み込む（記録した位置は消える） */
  async load(url: string): Promise<void> {
    const resolved = resolveAssetUrl(url);
    const response = await fetch(resolved, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`VRM を読めません（${response.status}）`);
    const bytes = await response.arrayBuffer();
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await loader.parseAsync(bytes, new URL('.', new URL(resolved, location.href)).href);
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) throw new Error('VRM が見つかりません');
    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
    }
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.updateMatrixWorld(true);
    this.scene.add(vrm.scene);
    this.vrm = vrm;
    this.hash = [...digest].map((v) => v.toString(16).padStart(2, '0')).join('');
    this.clear();
    // 顔が見やすい位置から始める
    const head = vrm.humanoid.getNormalizedBoneNode('head')?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(0, 1.3, 0);
    this.controls.target.set(0, head.y - 0.15, 0);
    this.camera.position.set(-0.15, head.y, 1.2);
    this.controls.update();
    this.onChange(this.state);
  }

  /** 記録をやり直す */
  clear(): void {
    this.anchors = {};
    this.hands = {};
    this.markers.clear();
    this.target = 'leftCheek';
    this.onChange(this.state);
  }

  // ドラッグ（回転）とクリック（記録）を分ける
  private down: { x: number; y: number } | null = null;
  private onPointerDown = (event: PointerEvent) => {
    this.down = { x: event.clientX, y: event.clientY };
  };
  private onPointerUp = (event: PointerEvent) => {
    const down = this.down;
    this.down = null;
    if (!down || event.button !== 0 || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4) return;
    this.record(event);
  };

  private record(event: PointerEvent): void {
    const vrm = this.vrm;
    if (!vrm) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(pointer, this.camera);
    const hit = this.raycaster
      .intersectObject(vrm.scene, true)
      .find((h) => (h.object as THREE.Mesh).isMesh && !!h.face);
    if (!hit?.face) {
      this.onChange({ ...this.state, notice: 'missSurface' });
      return;
    }
    const selected = this.target;
    let boneName = BONE_FOR_TARGET[selected];
    let bone = vrm.humanoid.getNormalizedBoneNode(boneName);
    for (const fallback of ['chest', 'spine'] as const) {
      if (selected === 'prayerCenter' && !bone) {
        boneName = fallback;
        bone = vrm.humanoid.getNormalizedBoneNode(boneName);
      }
    }
    if (!bone) {
      this.onChange({ ...this.state, notice: 'missingBone' });
      return;
    }
    vrm.scene.updateMatrixWorld(true);
    bone.updateWorldMatrix(true, false);
    const mesh = hit.object as THREE.Mesh;
    const worldNormal = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
    const rig = makeContactRig(vrm);
    const inverseBoneRotation = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
    const point = bone.worldToLocal(hit.point.clone()).toArray() as [number, number, number];
    // 合掌は体の左右方向で手が合うので、胸の前の点の法線は体の左向きにする
    const contactNormal = selected === 'prayerCenter' ? rig.frame.left.clone() : worldNormal;
    const tangent = projectedUp(contactNormal, rig.frame.up, rig.frame.left).applyQuaternion(inverseBoneRotation).normalize().toArray() as [number, number, number];
    if (selected === 'leftPalm' || selected === 'rightPalm') {
      this.hands[selected === 'leftPalm' ? 'left' : 'right'] = {
        palmPoint: point,
        palmNormal: worldNormal.clone().applyQuaternion(inverseBoneRotation).normalize().toArray() as [number, number, number],
        fingerDirection: tangent,
      };
    } else {
      this.anchors[selected] = {
        bone: boneName,
        point,
        normal: contactNormal.clone().applyQuaternion(inverseBoneRotation).normalize().toArray() as [number, number, number],
        tangent,
      };
    }
    this.markers.getObjectByName(selected)?.removeFromParent();
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), new THREE.MeshBasicMaterial({ color: MARKER_COLORS[selected], depthTest: false }));
    marker.position.copy(hit.point);
    marker.renderOrder = 20;
    marker.name = selected;
    this.markers.add(marker);
    // 次のまだ記録していない位置へ
    this.target = CALIBRATION_TARGETS.find((id) => id !== selected && !this.isRecorded(id)) ?? selected;
    this.onChange({ ...this.state, notice: 'recorded' });
  }

  /** 校正結果（7か所すべて記録してから） */
  buildProfile(faceGapMeters: number, palmGapMeters: number): AvatarContactProfile {
    const vrm = this.vrm;
    if (!vrm || !this.hash) throw new Error('VRM を先に読み込んでください');
    const rig = makeContactRig(vrm);
    const inverseRoot = vrm.scene.getWorldQuaternion(new THREE.Quaternion()).invert();
    const position = (name: VRMHumanBoneName) => {
      const node = vrm.humanoid.getNormalizedBoneNode(name);
      if (!node) throw new Error(`ボーン ${name} がありません`);
      return node.getWorldPosition(new THREE.Vector3());
    };
    const arm = (side: Side) => {
      const upper = position(`${side}UpperArm`);
      const elbow = position(`${side}LowerArm`);
      const wrist = position(`${side}Hand`);
      return { upper: upper.distanceTo(elbow), lower: elbow.distanceTo(wrist) };
    };
    const axis = (v: THREE.Vector3) => v.clone().applyQuaternion(inverseRoot).toArray() as [number, number, number];
    return validateAvatarContactProfile({
      version: 1,
      avatarSha256: this.hash,
      calibrated: true,
      anchors: { leftCheek: this.anchors.leftCheek!, rightCheek: this.anchors.rightCheek!, mouth: this.anchors.mouth!, chin: this.anchors.chin! },
      prayerCenter: this.anchors.prayerCenter!,
      hands: { left: this.hands.left!, right: this.hands.right! },
      armLengths: { left: arm('left'), right: arm('right') },
      bodyFrame: { left: axis(rig.frame.left), up: axis(rig.frame.up), forward: axis(rig.frame.forward) },
      shoulderWidthMeters: rig.frame.shoulderWidth / rig.uniformScale,
      faceGapMeters,
      palmGapMeters,
    });
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    if (this.vrm) VRMUtils.deepDispose(this.vrm.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function projectedUp(normal: THREE.Vector3, actorUp: THREE.Vector3, actorLeft: THREE.Vector3): THREE.Vector3 {
  const result = actorUp.clone().addScaledVector(normal, -actorUp.dot(normal));
  if (result.lengthSq() < 1e-8) result.copy(actorLeft).addScaledVector(normal, -actorLeft.dot(normal));
  return result.normalize();
}
