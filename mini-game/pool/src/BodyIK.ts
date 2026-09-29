import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

/**
 * bone から child へ向かう向きが desired（ワールド座標の位置）を指すように、bone を回す。
 * 子孫のワールド行列も更新する。
 */
function aimBone(bone: THREE.Object3D, child: THREE.Object3D, desired: THREE.Vector3): void {
  bone.updateWorldMatrix(true, false);
  child.updateWorldMatrix(true, false);
  const bonePos = bone.getWorldPosition(_v1);
  const cur = child.getWorldPosition(_v2).sub(bonePos).normalize();
  const des = _p.copy(desired).sub(bonePos).normalize();
  const delta = _q.setFromUnitVectors(cur, des);
  const worldQ = bone.getWorldQuaternion(_q2);
  worldQ.premultiply(delta);
  const parentQ = bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(parentQ.multiply(worldQ));
  bone.updateWorldMatrix(false, true);
}

/**
 * 脚の 2 ボーン IK（太もも・すね）。足首（foot）をワールド座標の target に置く。
 * 膝の曲がる向きは、解く前の膝の向きを保つ。
 */
export class LegIK {
  public readonly upper: THREE.Object3D;
  public readonly lower: THREE.Object3D;
  public readonly foot: THREE.Object3D;
  private lenUpper: number;
  private lenLower: number;

  constructor(vrm: VRM, side: 'left' | 'right') {
    const h = vrm.humanoid;
    this.upper = h.getNormalizedBoneNode(`${side}UpperLeg` as VRMHumanBoneName)!;
    this.lower = h.getNormalizedBoneNode(`${side}LowerLeg` as VRMHumanBoneName)!;
    this.foot = h.getNormalizedBoneNode(`${side}Foot` as VRMHumanBoneName)!;
    this.lenUpper = this.lower.position.length();
    this.lenLower = this.foot.position.length();
  }

  /** 足首のワールド座標 */
  public footWorld(out: THREE.Vector3): THREE.Vector3 {
    this.foot.updateWorldMatrix(true, false);
    return this.foot.getWorldPosition(out);
  }

  public solve(target: THREE.Vector3, footWorldQuat?: THREE.Quaternion): void {
    this.upper.updateWorldMatrix(true, true);
    const root = this.upper.getWorldPosition(new THREE.Vector3());
    const kneeCur = this.lower.getWorldPosition(new THREE.Vector3());

    const toT = new THREE.Vector3().subVectors(target, root);
    const dist = THREE.MathUtils.clamp(toT.length(), 0.05, this.lenUpper + this.lenLower - 0.002);
    const dir = toT.normalize();

    // 膝の向き（解く前の膝の位置から、根元→足首の軸に垂直な成分を取る）
    const v = new THREE.Vector3().subVectors(kneeCur, root);
    const perp = v.sub(dir.clone().multiplyScalar(v.dot(dir)));
    if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1);
    perp.normalize();

    const a = (this.lenUpper * this.lenUpper - this.lenLower * this.lenLower + dist * dist) / (2 * dist);
    const hgt = Math.sqrt(Math.max(this.lenUpper * this.lenUpper - a * a, 0));
    const kneeDes = root.clone().addScaledVector(dir, a).addScaledVector(perp, hgt);
    const footDes = root.clone().addScaledVector(dir, dist);

    aimBone(this.upper, this.lower, kneeDes);
    aimBone(this.lower, this.foot, footDes);

    if (footWorldQuat) {
      this.foot.updateWorldMatrix(true, false);
      const parentQ = this.foot.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
      this.foot.quaternion.copy(parentQ.multiply(footWorldQuat));
      this.foot.updateWorldMatrix(false, true);
    }
  }
}

/**
 * 首と頭をカメラの方へ向ける（体の向きは変えない）。
 * weight 0..1。角度が大きすぎる場合は maxAngle で頭打ち。
 */
export function lookAtWithNeckAndHead(
  vrm: VRM,
  targetWorld: THREE.Vector3,
  weight: number,
  maxAngle = 1.25
): void {
  if (weight <= 0.001) return;
  const h = vrm.humanoid;
  const neck = h.getNormalizedBoneNode('neck');
  const head = h.getNormalizedBoneNode('head');
  if (!head) return;

  head.updateWorldMatrix(true, false);
  const headPos = head.getWorldPosition(new THREE.Vector3());
  const curQ = head.getWorldQuaternion(new THREE.Quaternion());

  // 頭の +Z（正面）が targetWorld を向く回転
  const m = new THREE.Matrix4().lookAt(targetWorld, headPos, new THREE.Vector3(0, 1, 0));
  const wantQ = new THREE.Quaternion().setFromRotationMatrix(m);

  const delta = wantQ.multiply(curQ.clone().invert());
  const angle = 2 * Math.acos(THREE.MathUtils.clamp(Math.abs(delta.w), 0, 1));
  if (angle > maxAngle) {
    const t = maxAngle / angle;
    delta.slerp(new THREE.Quaternion(), 1 - t);
    if (delta.w < 0) { delta.x *= -1; delta.y *= -1; delta.z *= -1; delta.w *= -1; }
  }

  const apply = (bone: THREE.Object3D | null, share: number) => {
    if (!bone) return;
    bone.updateWorldMatrix(true, false);
    const worldQ = bone.getWorldQuaternion(new THREE.Quaternion());
    const part = new THREE.Quaternion().slerp(delta, share * weight);
    worldQ.premultiply(part);
    const parentQ = bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
    bone.quaternion.copy(parentQ.multiply(worldQ));
    bone.updateWorldMatrix(false, true);
  };
  apply(neck, 0.4);
  apply(head, 0.6); // 首が 4 割、頭が 6 割を受け持つ
}
