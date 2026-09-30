import * as THREE from 'three';
import {
  VRMSpringBoneCollider,
  VRMSpringBoneColliderShapeCapsule,
  type VRM,
  type VRMHumanBoneName,
  type VRMSpringBoneColliderGroup,
} from '@pixiv/three-vrm';

/**
 * 髪が手を避けるように、手と指のコライダーを足す。
 *
 * VRM に入っているコライダーは手首の球が1つだけで、指先は覆われていない。読み込んだ VRM に指・手のひら・前腕の
 * カプセルを足し、すでにコライダーグループを持つ髪の揺れものへ紐付ける。胸・袖のようにグループを持たない揺れものは
 * 対象外（手に押されて形が崩れるのを避ける）。
 *
 * スカートには紐付けない。スカートはチェーンが6本と疎で、関節の先端しか判定しないので、チェーンの間に入った手を
 * 拾えない。拾えるまで太らせると、スカートが外へ膨らむ。スカートと手の貫通は handClearance.ts で手の側を動かして防ぐ。
 */

/** 左右の接頭辞を除いた骨の名前 */
const FINGER_CHAINS: string[][] = [
  ['thumbMetacarpal', 'thumbProximal', 'thumbDistal'],
  ['indexProximal', 'indexIntermediate', 'indexDistal'],
  ['middleProximal', 'middleIntermediate', 'middleDistal'],
  ['ringProximal', 'ringIntermediate', 'ringDistal'],
  ['littleProximal', 'littleIntermediate', 'littleDistal'],
];

/** 指の太さ = 骨の長さ × 比率 + 余白。余白は髪の厚みの分。メートル */
const FINGER_RADIUS_RATIO = 0.35;
const PALM_RADIUS = 0.03;
const FOREARM_RADIUS = 0.032;
const MARGIN = 0.02;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** bone に付けたカプセル。head → tail はワールド座標（読み込み直後の姿勢）で渡す */
function addCapsule(bone: THREE.Object3D, head: THREE.Vector3, tail: THREE.Vector3, radius: number): VRMSpringBoneCollider {
  const shape = new VRMSpringBoneColliderShapeCapsule({
    radius,
    offset: bone.worldToLocal(head.clone()),
    tail: bone.worldToLocal(tail.clone()),
  });
  const collider = new VRMSpringBoneCollider(shape);
  bone.add(collider);
  return collider;
}

function buildHandGroup(vrm: VRM, side: 'left' | 'right', margin: number): VRMSpringBoneColliderGroup | null {
  const humanoid = vrm.humanoid;
  if (!humanoid) return null;
  const raw = (name: VRMHumanBoneName) => humanoid.getRawBoneNode(name);
  const colliders: VRMSpringBoneCollider[] = [];
  const S = (name: string) => `${side}${name[0].toUpperCase()}${name.slice(1)}` as VRMHumanBoneName;

  const hand = raw(S('hand'));
  if (!hand) return null;
  const handPos = hand.getWorldPosition(new THREE.Vector3());

  // 前腕（肘 → 手首）
  const lowerArm = raw(S('lowerArm'));
  if (lowerArm) colliders.push(addCapsule(lowerArm, lowerArm.getWorldPosition(_a).clone(), handPos, FOREARM_RADIUS + margin));

  // 手のひら（手首 → 中指の付け根）
  const middleRoot = raw(S('middleProximal'));
  if (middleRoot) colliders.push(addCapsule(hand, handPos, middleRoot.getWorldPosition(_a).clone(), PALM_RADIUS + margin));

  // 指（各関節 → 次の関節。指先は前の骨の向きへ延ばす）
  for (const chain of FINGER_CHAINS) {
    const bones = chain.map((name) => raw(S(name))).filter((bone): bone is THREE.Object3D => !!bone);
    if (bones.length < 2) continue;
    const points = bones.map((bone) => bone.getWorldPosition(new THREE.Vector3()));
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    points.push(_b.subVectors(last, prev).multiplyScalar(0.9).add(last).clone());
    bones.forEach((bone, i) => {
      const length = points[i].distanceTo(points[i + 1]);
      colliders.push(addCapsule(bone, points[i], points[i + 1], length * FINGER_RADIUS_RATIO + margin));
    });
  }

  return { name: `runtime_${side}Hand`, colliders };
}

/** 手と指のコライダーを足して、髪の揺れものに紐付ける。VRM ごとに1回だけ呼ぶ */
export function addHandColliders(vrm: VRM): void {
  const manager = vrm.springBoneManager;
  if (!manager) return;

  vrm.scene.updateMatrixWorld(true);
  const groups = (['left', 'right'] as const)
    .map((side) => buildHandGroup(vrm, side, MARGIN))
    .filter((g): g is VRMSpringBoneColliderGroup => !!g);
  if (groups.length === 0) return;

  // 依存関係（更新順・更新が要る祖先）はマネージャーが覚えているので、登録し直して再計算させる。
  // スカート（上着の裾 CoatSkirt も）は除く
  const patched = [...manager.joints].filter((joint) => joint.colliderGroups.length > 0 && !/skirt/i.test(joint.bone.name));
  for (const joint of patched) {
    joint.colliderGroups.push(...groups);
    manager.deleteJoint(joint);
    manager.addJoint(joint);
  }
}
