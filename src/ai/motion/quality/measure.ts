import { Quaternion, Vector3, type Quaternion as QuaternionType } from 'three';
import { makeContactRig, localDirectionToWorld, localPointToWorld } from './rig';
import type { Anchor, AvatarContactProfile, Contact, MotionQualityPlan, QualityMetric, QualityMetrics, Side } from './types';
import type { VRMHumanBoneName } from '@pixiv/three-vrm';
import type { VRM } from '@pixiv/three-vrm';

export interface PoseMeasurement {
  time: number;
  vrm: VRM;
  profile: AvatarContactProfile;
  contact: Contact;
  frame: number;
}

const metric = (value: number, unit: QualityMetric['unit'], threshold: number, frame: number): QualityMetric => ({
  value: Number.isFinite(value) ? value : null,
  unit,
  threshold,
  worstFrame: frame,
  passed: Number.isFinite(value) ? value <= threshold : false,
});

function angleDegrees(a: Vector3, b: Vector3): number {
  return Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * 180 / Math.PI;
}

function chooseMetric(metrics: QualityMetrics, key: string, candidate: QualityMetric): void {
  if (candidate.value === null) {
    if (!metrics[key]) metrics[key] = candidate;
    return;
  }
  if (metrics[key]?.value === null || !metrics[key] || candidate.value > metrics[key].value!) metrics[key] = candidate;
}

function anchorFor(contact: Extract<Contact, { kind: 'face' }>, profile: AvatarContactProfile): Anchor {
  if (contact.target === 'cheek') return profile.anchors[contact.targetSide === 'left' ? 'leftCheek' : 'rightCheek'];
  return profile.anchors[contact.target];
}

function handPoint(vrm: VRM, profile: AvatarContactProfile, side: Side): Vector3 {
  const handName: VRMHumanBoneName = side === 'left' ? 'leftHand' : 'rightHand';
  const hand = vrm.humanoid.getNormalizedBoneNode(handName);
  if (!hand) throw new Error(`Contact measurement requires normalized ${handName}.`);
  hand.updateWorldMatrix(true, false);
  return hand.localToWorld(new Vector3(...profile.hands[side].palmPoint));
}

export function collectPoseMetrics(vrm: VRM, profile: AvatarContactProfile, contact: Contact, frame: number): QualityMetrics {
  vrm.scene.updateMatrixWorld(true);
  const rig = makeContactRig(vrm, profile);
  const metrics: QualityMetrics = {};
  const width = rig.frame.shoulderWidth;
  const sides: Side[] = contact.kind === 'face' ? [contact.side] : ['left', 'right'];

  if (contact.kind === 'face') {
    const anchor = anchorFor(contact, profile);
    const anchorPoint = localPointToWorld(rig, anchor.bone, anchor.point);
    const surfaceNormal = localDirectionToWorld(rig, anchor.bone, anchor.normal);
    const palm = handPoint(vrm, profile, contact.side);
    const target = anchorPoint.clone().addScaledVector(surfaceNormal, profile.faceGapMeters * rig.uniformScale);
    metrics.faceContactError = metric(palm.distanceTo(target) / width, 'ratio', 0.03, frame);
    const normal = localDirectionToWorld(rig, contact.side === 'left' ? 'leftHand' : 'rightHand', profile.hands[contact.side].palmNormal);
    metrics.facePalmAngle = metric(angleDegrees(normal, surfaceNormal.clone().negate()), 'degrees', 15, frame);
  } else {
    const center = localPointToWorld(rig, profile.prayerCenter.bone, profile.prayerCenter.point);
    const normal = localDirectionToWorld(rig, profile.prayerCenter.bone, profile.prayerCenter.normal);
    const scaledPalmGap = profile.palmGapMeters * rig.uniformScale;
    const leftPoint = center.clone().addScaledVector(rig.frame.left, scaledPalmGap / 2);
    const rightPoint = center.clone().addScaledVector(rig.frame.left, -scaledPalmGap / 2);
    const leftPalm = handPoint(vrm, profile, 'left');
    const rightPalm = handPoint(vrm, profile, 'right');
    const leftNormal = localDirectionToWorld(rig, 'leftHand', profile.hands.left.palmNormal);
    const rightNormal = localDirectionToWorld(rig, 'rightHand', profile.hands.right.palmNormal);
    metrics.leftPalmError = metric(leftPalm.distanceTo(leftPoint) / width, 'ratio', 0.03, frame);
    metrics.rightPalmError = metric(rightPalm.distanceTo(rightPoint) / width, 'ratio', 0.03, frame);
    metrics.palmsFacingEachOther = metric(angleDegrees(leftNormal, normal.clone().negate()), 'degrees', 15, frame);
    metrics.palmsFacingEachOtherRight = metric(angleDegrees(rightNormal, normal), 'degrees', 15, frame);
    const leftElbow = rig.nodes.leftLowerArm!.getWorldPosition(new Vector3()).sub(center).dot(rig.frame.left);
    const rightElbow = rig.nodes.rightLowerArm!.getWorldPosition(new Vector3()).sub(center).dot(rig.frame.left);
    metrics.elbowSide = metric(Math.max(0, leftElbow < 0 ? -leftElbow : 0, rightElbow > 0 ? rightElbow : 0) / width, 'ratio', 0, frame);
    const collisionDistance = segmentDistance(
      rig.nodes.leftLowerArm!.getWorldPosition(new Vector3()), leftPalm.clone().lerp(rig.nodes.leftLowerArm!.getWorldPosition(new Vector3()), 0.2),
      rig.nodes.rightLowerArm!.getWorldPosition(new Vector3()), rightPalm.clone().lerp(rig.nodes.rightLowerArm!.getWorldPosition(new Vector3()), 0.2),
    );
    metrics.forearmCrossRisk = metric(Math.max(0, 0.04 - collisionDistance / width), 'ratio', 0, frame);
  }

  for (const side of sides) {
    const upper = rig.nodes[side === 'left' ? 'leftUpperArm' : 'rightUpperArm']!.getWorldPosition(new Vector3());
    const elbow = rig.nodes[side === 'left' ? 'leftLowerArm' : 'rightLowerArm']!.getWorldPosition(new Vector3());
    const wrist = rig.nodes[side === 'left' ? 'leftHand' : 'rightHand']!.getWorldPosition(new Vector3());
    const reference = profile.armLengths[side];
    const upperChange = Math.abs(upper.distanceTo(elbow) / (reference.upper * rig.uniformScale) - 1);
    const lowerChange = Math.abs(elbow.distanceTo(wrist) / (reference.lower * rig.uniformScale) - 1);
    metrics[`${side}BoneLengthChange`] = metric(Math.max(upperChange, lowerChange), 'ratio', 1e-5, frame);
  }

  return metrics;
}

function segmentDistance(p1: Vector3, q1: Vector3, p2: Vector3, q2: Vector3): number {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s = 0, t = 0;
  if (a <= 1e-12 && e <= 1e-12) return p1.distanceTo(p2);
  if (a <= 1e-12) t = Math.max(0, Math.min(1, f / e));
  else {
    const c = d1.dot(r);
    if (e <= 1e-12) s = Math.max(0, Math.min(1, -c / a));
    else {
      const b = d1.dot(d2), denominator = a * e - b * b;
      if (denominator !== 0) s = Math.max(0, Math.min(1, (b * f - c * e) / denominator));
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / a)); }
      else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / a)); }
    }
  }
  return p1.addScaledVector(d1, s).distanceTo(p2.addScaledVector(d2, t));
}

export function collectClipMetrics(samples: readonly PoseMeasurement[]): QualityMetrics {
  if (!samples.length) return {};
  const ordered = [...samples].sort((a, b) => a.time - b.time);
  for (let i = 1; i < ordered.length; i++) if (ordered[i].time <= ordered[i - 1].time) throw new RangeError('Clip metric sample times must be unique.');
  const first = ordered[0];
  const evaluated = ordered.filter(sample => sample.time >= first.contact.holdStart && sample.time <= first.contact.holdEnd);
  if (!evaluated.length) return {};
  const combined: QualityMetrics = {};
  for (const sample of evaluated) {
    const metrics = collectPoseMetrics(sample.vrm, sample.profile, sample.contact, sample.frame);
    for (const [key, value] of Object.entries(metrics)) chooseMetric(combined, key, value);
  }
  return combined;
}

export function collectQuaternionMotionMetrics(track: readonly { time: number; rotation: QuaternionType }[]): QualityMetrics {
  const ordered = [...track].sort((a, b) => a.time - b.time);
  if (ordered.length < 2) return {};
  const velocities: Array<{ time: number; value: number }> = [];
  for (let i = 1; i < ordered.length; i++) {
    const dt = ordered[i].time - ordered[i - 1].time;
    if (!Number.isFinite(dt) || dt <= 0) throw new RangeError('Quaternion sample times must be strictly increasing.');
    const q0 = ordered[i - 1].rotation.clone().normalize(), q1 = ordered[i].rotation.clone().normalize();
    velocities.push({ time: (ordered[i].time + ordered[i - 1].time) / 2, value: 2 * Math.acos(Math.max(0, Math.min(1, Math.abs(q0.dot(q1))))) / dt });
  }
  const maxVelocity = velocities.reduce((max, item) => item.value > max.value ? item : max, velocities[0]);
  const result: QualityMetrics = { angularVelocity: { value: maxVelocity.value, unit: 'radians/second', threshold: null, worstFrame: Math.round(maxVelocity.time * 30), passed: null } };
  if (velocities.length > 1) {
    let maxAcceleration = { value: 0, time: 0 };
    for (let i = 1; i < velocities.length; i++) {
      const dt = velocities[i].time - velocities[i - 1].time;
      const value = Math.abs(velocities[i].value - velocities[i - 1].value) / dt;
      if (value > maxAcceleration.value) maxAcceleration = { value, time: (velocities[i].time + velocities[i - 1].time) / 2 };
    }
    result.angularAcceleration = { value: maxAcceleration.value, unit: 'radians/second2', threshold: null, worstFrame: Math.round(maxAcceleration.time * 30), passed: null };
  }
  return result;
}

export function makeContactPlan(duration: number, contact: Contact): MotionQualityPlan {
  return { version: 1, duration, style: 'neutral', styleStrength: 0, timingSource: 'authored', contacts: [contact] };
}
