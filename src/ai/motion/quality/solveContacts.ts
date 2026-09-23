import { Matrix4, Quaternion, Vector3 } from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { contactStrengthAt, validateAvatarContactProfile, validateMotionQualityPlan } from './validate';
import { localDirectionToWorld, localPointToWorld, makeContactRig, type ContactRig } from './rig';
import type { AvatarContactProfile, Contact, MotionQualityPlan, Side, Vec3 } from './types';

export interface ContactSolveResult {
  status: 'inactive' | 'applied' | 'unreachable' | 'unsupported';
  strength: number;
  maxReachErrorRatio: number;
  reasons: string[];
}

interface TargetFrame {
  palm: Vector3;
  normal: Vector3;
  finger: Vector3;
}

interface ArmSolution {
  reachable: boolean;
  reachError: number;
}

const EPSILON = 1e-8;

function orientedBasis(finger: Vector3, normal: Vector3): Quaternion {
  const y = finger.clone().normalize();
  const z = normal.clone().normalize();
  const x = y.clone().cross(z).normalize();
  if (x.lengthSq() < EPSILON || y.lengthSq() < EPSILON || z.lengthSq() < EPSILON) {
    throw new Error('Contact target axes are degenerate.');
  }
  y.crossVectors(z, x).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z)).normalize();
}

function safeDirection(direction: Vector3, fallback: Vector3): Vector3 {
  if (direction.lengthSq() > EPSILON) return direction.normalize();
  if (fallback.lengthSq() > EPSILON) return fallback.clone().normalize();
  throw new Error('The contact IK direction is degenerate.');
}

function worldTarget(
  rig: ContactRig,
  profile: AvatarContactProfile,
  contact: Contact,
  side: Side,
): TargetFrame {
  if (contact.kind === 'face') {
    const anchor = contact.target === 'cheek'
      ? profile.anchors[contact.targetSide === 'left' ? 'leftCheek' : 'rightCheek']
      : profile.anchors[contact.target];
    const surfaceNormal = localDirectionToWorld(rig, anchor.bone, anchor.normal);
    const finger = localDirectionToWorld(rig, anchor.bone, anchor.tangent);
    return {
      palm: localPointToWorld(rig, anchor.bone, anchor.point).addScaledVector(surfaceNormal, profile.faceGapMeters * rig.uniformScale),
      normal: surfaceNormal.negate(),
      finger,
    };
  }

  const center = localPointToWorld(rig, profile.prayerCenter.bone, profile.prayerCenter.point);
  const normal = localDirectionToWorld(rig, profile.prayerCenter.bone, profile.prayerCenter.normal);
  const up = rig.frame.up.clone().addScaledVector(normal, -rig.frame.up.dot(normal));
  const finger = safeDirection(up, localDirectionToWorld(rig, profile.prayerCenter.bone, profile.prayerCenter.tangent));
  const handDirection = side === 'left' ? 1 : -1;
  const palm = center.addScaledVector(rig.frame.left, handDirection * profile.palmGapMeters * rig.uniformScale / 2);
  // The left palm faces across the body's centerline toward actor-right.
  const desiredNormal = normal.clone().multiplyScalar(side === 'left' ? -1 : 1);
  return { palm, normal: desiredNormal, finger };
}

function resolveHandWorldRotation(
  vrm: VRM,
  profile: AvatarContactProfile,
  side: Side,
  target: TargetFrame,
): Quaternion {
  const handName: VRMHumanBoneName = side === 'left' ? 'leftHand' : 'rightHand';
  const hand = vrm.humanoid.getNormalizedBoneNode(handName);
  if (!hand) throw new Error('The avatar is missing a normalized hand bone: ' + handName + '.');
  const local = profile.hands[side];
  const localRotation = orientedBasis(new Vector3(...local.fingerDirection), new Vector3(...local.palmNormal));
  const targetRotation = orientedBasis(target.finger, target.normal);
  return targetRotation.multiply(localRotation.invert()).normalize();
}

function solveArm(
  vrm: VRM,
  profile: AvatarContactProfile,
  side: Side,
  wristTarget: Vector3,
  desiredHandRotation: Quaternion,
  bodyLeft: Vector3,
  bodyUp: Vector3,
  bodyForward: Vector3,
  strength: number,
  style: MotionQualityPlan['style'],
  styleStrength: number,
): ArmSolution {
  const upperName: VRMHumanBoneName = side === 'left' ? 'leftUpperArm' : 'rightUpperArm';
  const lowerName: VRMHumanBoneName = side === 'left' ? 'leftLowerArm' : 'rightLowerArm';
  const handName: VRMHumanBoneName = side === 'left' ? 'leftHand' : 'rightHand';
  const upper = vrm.humanoid.getNormalizedBoneNode(upperName);
  const lower = vrm.humanoid.getNormalizedBoneNode(lowerName);
  const hand = vrm.humanoid.getNormalizedBoneNode(handName);
  if (!upper || !lower || !hand) throw new Error('The avatar is missing normalized arm bones for ' + side + '.');

  const root = vrm.scene.getWorldScale(new Vector3()).x;
  const lengths = profile.armLengths[side];
  const upperLength = lengths.upper * root;
  const lowerLength = lengths.lower * root;
  if (upperLength <= EPSILON || lowerLength <= EPSILON) throw new Error('Avatar arm length is degenerate.');
  upper.updateWorldMatrix(true, true);
  const shoulder = upper.getWorldPosition(new Vector3());
  let elbow = lower.getWorldPosition(new Vector3());
  const currentWrist = hand.getWorldPosition(new Vector3());
  const toTarget = wristTarget.clone().sub(shoulder);
  const rawDistance = toTarget.length();
  const minReach = Math.abs(upperLength - lowerLength) + EPSILON;
  const maxReach = upperLength + lowerLength - EPSILON;
  const reachError = Math.max(0, minReach - rawDistance, rawDistance - maxReach);
  const reachableDistance = Math.max(minReach, Math.min(maxReach, rawDistance));
  const aim = safeDirection(toTarget, bodyUp.clone().negate());
  const reachableWrist = shoulder.clone().addScaledVector(aim, reachableDistance);

  let startPole = elbow.clone().sub(shoulder);
  startPole.addScaledVector(aim, -startPole.dot(aim));
  const outward = bodyLeft.clone().multiplyScalar(side === 'left' ? 1 : -1);
  const compact = style === 'soft-compact' ? styleStrength : 0;
  let canonicalPole = outward.clone().multiplyScalar(1 + compact * .8)
    .addScaledVector(bodyUp, -.65)
    .addScaledVector(bodyForward, .35);
  canonicalPole.addScaledVector(aim, -canonicalPole.dot(aim));
  if (canonicalPole.lengthSq() < EPSILON) {
    canonicalPole = bodyUp.clone().addScaledVector(aim, -bodyUp.dot(aim));
  }
  if (startPole.lengthSq() < EPSILON) startPole.copy(canonicalPole);
  startPole.normalize();
  canonicalPole.normalize();
  if (startPole.dot(canonicalPole) < 0) canonicalPole.negate();
  const pole = safeDirection(startPole.lerp(canonicalPole, strength), canonicalPole);

  const along = (upperLength * upperLength - lowerLength * lowerLength + reachableDistance * reachableDistance) / (2 * reachableDistance);
  const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const desiredElbow = shoulder.clone().addScaledVector(aim, along).addScaledVector(pole, height);

  const turnJointToward = (joint: typeof upper, child: typeof lower, destination: Vector3) => {
    joint.updateWorldMatrix(true, true);
    child.updateWorldMatrix(true, false);
    const origin = joint.getWorldPosition(new Vector3());
    const from = child.getWorldPosition(new Vector3()).sub(origin);
    const to = destination.clone().sub(origin);
    if (from.lengthSq() < EPSILON || to.lengthSq() < EPSILON) throw new Error('An arm bone has a degenerate joint direction.');
    const worldDelta = new Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
    const parentWorld = joint.parent?.getWorldQuaternion(new Quaternion()) ?? new Quaternion();
    const localDelta = parentWorld.clone().invert().multiply(worldDelta).multiply(parentWorld);
    joint.quaternion.premultiply(localDelta).normalize();
    joint.updateWorldMatrix(true, true);
  };

  turnJointToward(upper, lower, desiredElbow);
  turnJointToward(lower, hand, reachableWrist);
  hand.updateWorldMatrix(true, false);
  const currentWorld = hand.getWorldQuaternion(new Quaternion()).normalize();
  const targetWorld = currentWorld.slerp(desiredHandRotation, strength);
  const parentWorld = hand.parent?.getWorldQuaternion(new Quaternion()) ?? new Quaternion();
  hand.quaternion.copy(parentWorld.invert().multiply(targetWorld).normalize());
  upper.updateWorldMatrix(true, true);

  return { reachable: reachError <= 1e-5 * Math.max(1, upperLength + lowerLength), reachError };
}

/**
 * Apply a validated contact constraint to one normalized VRM pose.
 * Calling this at an inactive time leaves every bone untouched.
 */
export function solveContactsAtTime(
  vrm: VRM,
  plan: MotionQualityPlan,
  profile: AvatarContactProfile,
  time: number,
  externalWeight = 1,
): ContactSolveResult {
  if (!Number.isFinite(time)) throw new RangeError('Contact time must be finite.');
  if (!Number.isFinite(externalWeight) || externalWeight < 0 || externalWeight > 1) {
    throw new RangeError('Contact external weight must be between zero and one.');
  }
  const validPlan = validateMotionQualityPlan(plan);
  const validProfile = validateAvatarContactProfile(profile);
  if (!validProfile.calibrated) return { status: 'unsupported', strength: 0, maxReachErrorRatio: 0, reasons: ['The avatar contact profile has not been calibrated.'] };
  const contact = validPlan.contacts[0];
  if (!contact) return { status: 'inactive', strength: 0, maxReachErrorRatio: 0, reasons: [] };
  const strength = contactStrengthAt(time, contact) * externalWeight;
  if (strength <= 0) return { status: 'inactive', strength: 0, maxReachErrorRatio: 0, reasons: [] };

  vrm.scene.updateMatrixWorld(true);
  const rig = makeContactRig(vrm, validProfile);
  const sides: Side[] = contact.kind === 'face' ? [contact.side] : ['left', 'right'];
  const results: ArmSolution[] = [];
  for (const side of sides) {
    const target = worldTarget(rig, validProfile, contact, side);
    const desiredHandRotation = resolveHandWorldRotation(vrm, validProfile, side, target);
    const scaledPalmOffset = new Vector3(...validProfile.hands[side].palmPoint).multiplyScalar(rig.uniformScale).applyQuaternion(desiredHandRotation);
    const wristTarget = target.palm.clone().sub(scaledPalmOffset);
    results.push(solveArm(vrm, validProfile, side, wristTarget, desiredHandRotation, rig.frame.left, rig.frame.up, rig.frame.forward, strength, validPlan.style, validPlan.styleStrength));
  }

  vrm.scene.updateMatrixWorld(true);
  const maxError = Math.max(...results.map(result => result.reachError)) / rig.frame.shoulderWidth;
  const unreachable = results.some(result => !result.reachable);
  return {
    status: unreachable ? 'unreachable' : 'applied',
    strength,
    maxReachErrorRatio: maxError,
    reasons: unreachable ? ['The requested hand target is outside the calibrated arm reach.'] : [],
  };
}
