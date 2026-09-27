import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { Quaternion, Vector3, type Object3D } from 'three';
import type { AvatarContactProfile, Side, Vec3 } from './types';

export interface BodyFrame {
  left: Vector3;
  up: Vector3;
  forward: Vector3;
  origin: Vector3;
  shoulderWidth: number;
}

export interface ContactRig {
  vrm: VRM;
  nodes: Partial<Record<VRMHumanBoneName, Object3D>>;
  frame: BodyFrame;
  uniformScale: number;
  elbows: Record<Side, Vector3>;
  wrists: Record<Side, Vector3>;
}

const requiredBones: VRMHumanBoneName[] = [
  'hips', 'spine', 'head',
  'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightUpperArm', 'rightLowerArm', 'rightHand',
];

export function makeContactRig(vrm: VRM, profile?: Pick<AvatarContactProfile, 'bodyFrame' | 'shoulderWidthMeters'>): ContactRig {
  vrm.scene.updateMatrixWorld(true);
  const scale = vrm.scene.getWorldScale(new Vector3());
  const uniformScale = (scale.x + scale.y + scale.z) / 3;
  if (!Number.isFinite(uniformScale) || uniformScale <= 0 || Math.max(Math.abs(scale.x - uniformScale), Math.abs(scale.y - uniformScale), Math.abs(scale.z - uniformScale)) > 1e-5 * uniformScale) {
    throw new Error('Quality correction requires positive uniform avatar scale.');
  }
  const nodes: Partial<Record<VRMHumanBoneName, Object3D>> = {};
  for (const name of requiredBones) {
    const node = vrm.humanoid.getNormalizedBoneNode(name);
    if (node) nodes[name] = node;
    else throw new Error(`Quality correction requires the normalized VRM bone "${name}".`);
  }
  const point = (name: VRMHumanBoneName) => nodes[name]!.getWorldPosition(new Vector3());
  const leftShoulder = point('leftUpperArm');
  const rightShoulder = point('rightUpperArm');
  const shoulderWidth = profile ? profile.shoulderWidthMeters * uniformScale : leftShoulder.distanceTo(rightShoulder);
  if (!Number.isFinite(shoulderWidth) || shoulderWidth <= 1e-5) throw new Error('Avatar shoulder width is degenerate.');
  const origin = point('hips');
  const rootWorldRotation = vrm.scene.getWorldQuaternion(new Quaternion()).normalize();
  const left = profile
    ? new Vector3(...profile.bodyFrame.left).applyQuaternion(rootWorldRotation).normalize()
    : leftShoulder.clone().sub(rightShoulder).normalize();
  const up = profile
    ? new Vector3(...profile.bodyFrame.up).applyQuaternion(rootWorldRotation).normalize()
    : point('head').sub(origin).normalize();
  if (up.lengthSq() < 1e-10) throw new Error('Avatar up direction is degenerate.');
  left.addScaledVector(up, -left.dot(up));
  if (left.lengthSq() < 1e-10) throw new Error('Avatar left direction is degenerate.');
  left.normalize();
  const forward = profile
    ? new Vector3(...profile.bodyFrame.forward).applyQuaternion(rootWorldRotation).normalize()
    : left.clone().cross(up).normalize();
  if (forward.lengthSq() < 1e-10) throw new Error('Avatar forward direction is degenerate.');
  return {
    vrm,
    nodes,
    frame: { left, up, forward, origin, shoulderWidth: profile ? profile.shoulderWidthMeters * uniformScale : shoulderWidth },
    uniformScale,
    elbows: { left: point('leftLowerArm'), right: point('rightLowerArm') },
    wrists: { left: point('leftHand'), right: point('rightHand') },
  };
}

export function localPointToWorld(rig: ContactRig, bone: VRMHumanBoneName, point: Vec3): Vector3 {
  const node = rig.nodes[bone] ?? rig.vrm.humanoid.getNormalizedBoneNode(bone);
  if (!node) throw new Error(`Avatar profile bone "${bone}" is not present in the normalized rig.`);
  return node.localToWorld(new Vector3(...point));
}

export function localDirectionToWorld(rig: ContactRig, bone: VRMHumanBoneName, direction: Vec3): Vector3 {
  const node = rig.nodes[bone] ?? rig.vrm.humanoid.getNormalizedBoneNode(bone);
  if (!node) throw new Error(`Avatar profile bone "${bone}" is not present in the normalized rig.`);
  return new Vector3(...direction).applyQuaternion(node.getWorldQuaternion(new Quaternion()).normalize()).normalize();
}
