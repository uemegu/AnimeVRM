import { expect, test } from '@playwright/test';
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { collectClipMetrics, collectPoseMetrics, collectQuaternionMotionMetrics } from '../packages/motion/src/quality/measure';
import { makeContactRig } from '../packages/motion/src/quality/rig';
import { contactStrengthAt, validateAvatarContactProfile, validateMotionQualityPlan } from '../packages/motion/src/quality/validate';
import { solveContactsAtTime } from '../packages/motion/src/quality/solveContacts';
import { polishClip } from '../packages/motion/src/quality/polishClip';
import { verifyRoundTripClip } from '../packages/motion/src/quality/verifyRoundTrip';
import type { AvatarContactProfile, Contact } from '../packages/motion/src/quality/types';

function avatar(scale = 1, calibratedFrom?: AvatarContactProfile, shoulderOffset = .2) {
  const scene = new THREE.Group();
  scene.scale.setScalar(scale);
  const hips = new THREE.Bone();
  hips.name = 'hips';
  hips.position.set(0, 1, 0);
  scene.add(hips);
  const spine = new THREE.Bone();
  spine.name = 'spine';
  spine.position.y = .35;
  hips.add(spine);
  const chest = new THREE.Bone();
  chest.name = 'upperChest';
  chest.position.y = .25;
  spine.add(chest);
  const head = new THREE.Bone();
  head.name = 'head';
  head.position.y = .25;
  chest.add(head);
  const nodes: Record<string, THREE.Bone> = { hips, spine, upperChest: chest, head };

  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? 1 : -1;
    const upper = new THREE.Bone();
    upper.name = side + 'UpperArm';
    upper.position.set(sign * shoulderOffset, .2, 0);
    chest.add(upper);
    const lower = new THREE.Bone();
    lower.name = side + 'LowerArm';
    lower.position.set(-sign * .1, .05, 0);
    upper.add(lower);
    const hand = new THREE.Bone();
    hand.name = side + 'Hand';
    hand.position.set(-sign * .1, 0, 0);
    lower.add(hand);
    nodes[side + 'UpperArm'] = upper;
    nodes[side + 'LowerArm'] = lower;
    nodes[side + 'Hand'] = hand;
  }

  scene.updateMatrixWorld(true);
  const vrm = {
    scene,
    humanoid: { getNormalizedBoneNode: (name: string) => nodes[name] ?? null },
  } as unknown as VRM;
  const rig = makeContactRig(vrm);
  const anchor = (bone: string) => ({
    bone,
    point: [0, 0, 0] as [number, number, number],
    normal: [0, 0, 1] as [number, number, number],
    tangent: [1, 0, 0] as [number, number, number],
  });
  const profile: AvatarContactProfile = calibratedFrom ?? {
    version: 1,
    avatarSha256: 'a'.repeat(64),
    calibrated: true,
    anchors: {
      leftCheek: anchor('head'),
      rightCheek: anchor('head'),
      mouth: anchor('head'),
      chin: anchor('head'),
    },
    prayerCenter: {
      bone: 'upperChest',
      point: [0, .25, 0],
      normal: [0, 0, -1],
      tangent: [1, 0, 0],
    },
    hands: {
      left: { palmPoint: [0, 0, 0], palmNormal: [0, 0, 1], fingerDirection: [0, 1, 0] },
      right: { palmPoint: [0, 0, 0], palmNormal: [0, 0, -1], fingerDirection: [0, 1, 0] },
    },
    armLengths: {
      left: {
        upper: nodes.leftUpperArm.getWorldPosition(new THREE.Vector3()).distanceTo(nodes.leftLowerArm.getWorldPosition(new THREE.Vector3())),
        lower: nodes.leftLowerArm.getWorldPosition(new THREE.Vector3()).distanceTo(nodes.leftHand.getWorldPosition(new THREE.Vector3())),
      },
      right: {
        upper: nodes.rightUpperArm.getWorldPosition(new THREE.Vector3()).distanceTo(nodes.rightLowerArm.getWorldPosition(new THREE.Vector3())),
        lower: nodes.rightLowerArm.getWorldPosition(new THREE.Vector3()).distanceTo(nodes.rightHand.getWorldPosition(new THREE.Vector3())),
      },
    },
    bodyFrame: {
      left: rig.frame.left.clone().toArray() as [number, number, number],
      up: rig.frame.up.clone().toArray() as [number, number, number],
      forward: rig.frame.forward.clone().toArray() as [number, number, number],
    },
    shoulderWidthMeters: rig.frame.shoulderWidth / rig.uniformScale,
    faceGapMeters: 0,
    palmGapMeters: 0,
  };
  return { vrm, nodes, profile, rig };
}

const face: Contact = {
  kind: 'face', side: 'right', target: 'cheek', targetSide: 'right',
  start: .5, holdStart: 1, holdEnd: 1.5, end: 2,
};
const prayer: Contact = {
  kind: 'palmsTogether',
  start: .5, holdStart: 1, holdEnd: 1.5, end: 2,
};

test('validates plan/profile bounds, references and calibrated axes', () => {
  const plan = {
    version: 1, duration: 2, style: 'neutral', styleStrength: 0, timingSource: 'authored', contacts: [face],
  };
  expect(validateMotionQualityPlan(plan).contacts).toHaveLength(1);
  const actor = avatar();
  expect(validateAvatarContactProfile(actor.profile).avatarSha256).toBe('a'.repeat(64));

  const rejected = (value: unknown) => {
    try { validateMotionQualityPlan(value); return false; } catch { return true; }
  };
  const badProfile = (value: unknown) => {
    try { validateAvatarContactProfile(value); return false; } catch { return true; }
  };
  expect(rejected({ ...plan, contacts: [{ ...face, holdStart: -1 }] })).toBe(true);
  expect(rejected({ ...plan, contacts: [face, face] })).toBe(true);
  expect(rejected({ ...plan, contacts: [{ ...face, targetSide: undefined }] })).toBe(true);
  expect(validateMotionQualityPlan({ ...plan, style: 'soft-compact', styleStrength: .5 }).style).toBe('soft-compact');
  expect(badProfile({ ...actor.profile, anchors: { ...actor.profile.anchors, chin: { ...actor.profile.anchors.chin, bone: 'mesh' } } })).toBe(true);
  expect(badProfile({ ...actor.profile, hands: { ...actor.profile.hands, left: { ...actor.profile.hands.left, palmNormal: [0, 0, 0] } } })).toBe(true);
  expect(badProfile({ ...actor.profile, faceGapMeters: -1 })).toBe(true);
  expect(badProfile({ ...actor.profile, avatarSha256: 'not-a-hash' })).toBe(true);
  expect(badProfile({ ...actor.profile, bodyFrame: { ...actor.profile.bodyFrame, forward: [0, 0, -1] } })).toBe(true);
});

test('contact envelope ramps smoothly, holds, and returns to zero', () => {
  expect([0, .5, .75, 1, 1.5, 1.75, 2].map(time => contactStrengthAt(time, face))).toEqual([
    0, 0, .5, 1, 1, .5, 0,
  ]);
});

test('measures palm position and facing without modifying pose and stays invariant under uniform scale', () => {
  const actor = avatar();
  const before = actor.nodes.rightHand.quaternion.toArray();
  const measured = collectPoseMetrics(actor.vrm, actor.profile, face, 30);
  const after = actor.nodes.rightHand.quaternion.toArray();
  const scaled = avatar(2, actor.profile);
  const scaledMetrics = collectPoseMetrics(scaled.vrm, scaled.profile, face, 30);

  expect(measured.faceContactError.value).toBeLessThan(1e-8);
  expect(measured.facePalmAngle.value).toBeCloseTo(0, 5);
  expect(measured.rightBoneLengthChange.value).toBeLessThan(1e-8);
  expect(after).toEqual(before);
  expect(scaledMetrics.faceContactError.value).toBeLessThan(1e-8);
  expect(scaledMetrics.rightBoneLengthChange.value).toBeLessThan(1e-8);
});

test('aggregates contact metrics only over the hold interval', () => {
  const good = avatar();
  const bad = avatar();
  bad.nodes.rightHand.position.z = .2;
  bad.vrm.scene.updateMatrixWorld(true);
  const before = bad.nodes.rightHand.quaternion.toArray();
  const metrics = collectClipMetrics([
    { time: 0, vrm: bad.vrm, profile: bad.profile, contact: face, frame: 0 },
    { time: 1, vrm: good.vrm, profile: good.profile, contact: face, frame: 30 },
    { time: 1.5, vrm: good.vrm, profile: good.profile, contact: face, frame: 45 },
    { time: 2, vrm: bad.vrm, profile: bad.profile, contact: face, frame: 60 },
  ]);
  expect(metrics.faceContactError.value).toBeLessThan(1e-8);
  expect(metrics.faceContactError.worstFrame).toBe(30);
  expect(bad.nodes.rightHand.quaternion.toArray()).toEqual(before);
});

test('treats q and negative q as the same rotation and rejects duplicate sample times', () => {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), .7);
  const negative = new THREE.Quaternion(-q.x, -q.y, -q.z, -q.w);
  const motion = collectQuaternionMotionMetrics([
    { time: 0, rotation: q }, { time: 1 / 30, rotation: negative }, { time: 2 / 30, rotation: q },
  ]);
  expect(motion.angularVelocity.value).toBeLessThan(1e-6);
  expect(motion.angularVelocity.passed).toBeNull();
  expect(motion.angularAcceleration.value).toBeLessThan(1e-6);
  expect(() => collectQuaternionMotionMetrics([{ time: 0, rotation: q }, { time: 0, rotation: q }])).toThrow();
});

test('measures opposing prayer palms and actor-relative elbow sides', () => {
  const actor = avatar();
  const metrics = collectPoseMetrics(actor.vrm, actor.profile, prayer, 30);
  expect(metrics.leftPalmError.value).toBeLessThan(1e-8);
  expect(metrics.rightPalmError.value).toBeLessThan(1e-8);
  expect(metrics.palmsFacingEachOther.value).toBeLessThan(1e-4);
  expect(metrics.palmsFacingEachOtherRight.value).toBeLessThan(1e-4);
  expect(metrics.elbowSide.value).toBe(0);
  expect(metrics.forearmCrossRisk.value).toBe(0);
});

test('solves a normalized arm pose to a face target and preserves the palm gap', () => {
  const actor = avatar();
  const result = solveContactsAtTime(actor.vrm, {
    version: 1, duration: 2, style: 'neutral', styleStrength: 0, timingSource: 'authored', contacts: [face],
  }, actor.profile, 1);
  const metrics = collectPoseMetrics(actor.vrm, actor.profile, face, 30);
  expect(result.status).toBe('applied');
  expect(metrics.faceContactError.value).toBeLessThan(.03);
  expect(metrics.facePalmAngle.value).toBeLessThan(15);
  expect(metrics.rightBoneLengthChange.value).toBeLessThan(1e-5);
});

test('touches the requested opposite cheek instead of assuming hand and cheek sides match', () => {
  const actor = avatar(1, undefined, .1);
  actor.profile.anchors.leftCheek.point = [.035, 0, 0];
  actor.profile.anchors.rightCheek.point = [-.035, 0, 0];
  const crossBodyFace: Contact = { ...face, side: 'right', target: 'cheek', targetSide: 'left' };
  const result = solveContactsAtTime(actor.vrm, {
    version: 1, duration: 2, style: 'neutral', styleStrength: 0, timingSource: 'authored', contacts: [crossBodyFace],
  }, actor.profile, 1);
  const metrics = collectPoseMetrics(actor.vrm, actor.profile, crossBodyFace, 30);
  expect(result.status).toBe('applied');
  expect(metrics.faceContactError.value).toBeLessThan(.03);
});

test('solves both arms together from a physically reachable crossed-elbow pose', () => {
  const actor = avatar(1, undefined, .08);
  actor.vrm.scene.updateMatrixWorld(true);
  const before = collectPoseMetrics(actor.vrm, actor.profile, prayer, 30);
  expect(before.elbowSide.value).toBeGreaterThan(0);
  const result = solveContactsAtTime(actor.vrm, {
    version: 1, duration: 2, style: 'neutral', styleStrength: 0, timingSource: 'authored', contacts: [prayer],
  }, actor.profile, 1);
  const after = collectPoseMetrics(actor.vrm, actor.profile, prayer, 30);
  expect(result.status).toBe('applied');
  expect(after.leftPalmError.value).toBeLessThan(.03);
  expect(after.rightPalmError.value).toBeLessThan(.03);
  expect(after.elbowSide.value).toBe(0);
});

test('soft-compact keeps the palms together while pulling the elbow path slightly inward', () => {
  const neutral = avatar(1, undefined, .15);
  const compact = avatar(1, undefined, .15);
  const solve = (style: 'neutral' | 'soft-compact', vrm: VRM, profile: AvatarContactProfile) => solveContactsAtTime(vrm, {
    version: 1, duration: 2, style, styleStrength: style === 'neutral' ? 0 : 1,
    timingSource: 'authored', contacts: [prayer],
  }, profile, 1);
  solve('neutral', neutral.vrm, neutral.profile);
  solve('soft-compact', compact.vrm, compact.profile);
  const neutralMetrics = collectPoseMetrics(neutral.vrm, neutral.profile, prayer, 30);
  const compactMetrics = collectPoseMetrics(compact.vrm, compact.profile, prayer, 30);
  const lateralSpan = (actor: ReturnType<typeof avatar>) => {
    const center = actor.rig.frame.origin;
    return ['leftLowerArm', 'rightLowerArm'].reduce((sum, name) => {
      const elbow = actor.nodes[name].getWorldPosition(new THREE.Vector3());
      return sum + Math.abs(elbow.sub(center).dot(actor.rig.frame.left));
    }, 0);
  };
  expect(compactMetrics.leftPalmError.value).toBeLessThan(.03);
  expect(compactMetrics.rightPalmError.value).toBeLessThan(.03);
  expect(lateralSpan(compact)).toBeLessThan(lateralSpan(neutral));
  expect(neutralMetrics.elbowSide.value).toBe(0);
});

test('reports an unreachable profile target and does not mutate at inactive times', () => {
  const actor = avatar();
  const plan = { version: 1 as const, duration: 2, style: 'neutral' as const, styleStrength: 0, timingSource: 'authored' as const, contacts: [face] };
  const before = actor.nodes.rightUpperArm.quaternion.toArray();
  expect(solveContactsAtTime(actor.vrm, plan, actor.profile, .25).status).toBe('inactive');
  expect(actor.nodes.rightUpperArm.quaternion.toArray()).toEqual(before);

  const farProfile = {
    ...actor.profile,
    anchors: { ...actor.profile.anchors, rightCheek: { ...actor.profile.anchors.rightCheek, point: [1, 0, 0] as [number, number, number] } },
  };
  const result = solveContactsAtTime(actor.vrm, plan, farProfile, 1);
  expect(result.status).toBe('unreachable');
  expect(result.maxReachErrorRatio).toBeGreaterThan(0);
});

test('produces the same pose after resetting and seeking to the same contact time', () => {
  const actor = avatar();
  const plan = { version: 1 as const, duration: 2, style: 'neutral' as const, styleStrength: 0, timingSource: 'authored' as const, contacts: [face] };
  const baseline = Object.fromEntries(Object.entries(actor.nodes).map(([name, node]) => [name, { q: node.quaternion.clone(), p: node.position.clone() }]));
  solveContactsAtTime(actor.vrm, plan, actor.profile, 1.2);
  const first = ['rightUpperArm', 'rightLowerArm', 'rightHand'].map(name => actor.nodes[name].quaternion.clone());
  for (const [name, node] of Object.entries(actor.nodes)) {
    node.quaternion.copy(baseline[name].q);
    node.position.copy(baseline[name].p);
  }
  actor.vrm.scene.updateMatrixWorld(true);
  solveContactsAtTime(actor.vrm, plan, actor.profile, 1.2);
  const second = ['rightUpperArm', 'rightLowerArm', 'rightHand'].map(name => actor.nodes[name].quaternion);
  expect(second.map((q, index) => q.angleTo(first[index]))).toEqual([0, 0, 0]);
});

test('bakes a contact into a new clip while restoring the source avatar and source animation', () => {
  const actor = avatar();
  const sourceHand = actor.nodes.rightHand;
  const sourceRotation = sourceHand.quaternion.toArray();
  const track = new THREE.QuaternionKeyframeTrack(
    sourceHand.uuid + '.quaternion',
    [0, 2],
    [...sourceRotation, ...sourceRotation],
  );
  const source = new THREE.AnimationClip('source', 2, [track]);
  const sourceValues = Array.from(source.tracks[0].values);
  const plan = { version: 1 as const, duration: 2, style: 'neutral' as const, styleStrength: 0, timingSource: 'authored' as const, contacts: [face] };

  const result = polishClip(source, actor.vrm, plan, actor.profile);
  const bakedTrack = result.clip.tracks.find(item => item.name === sourceHand.uuid + '.quaternion')!;
  expect(result.status).toBe('pass');
  expect(result.after.faceContactError.value).toBeLessThan(.03);
  expect(bakedTrack).toBeTruthy();
  expect(Array.from(source.tracks[0].values)).toEqual(sourceValues);
  expect(sourceHand.quaternion.toArray()).toEqual(sourceRotation);

  const mixer = new THREE.AnimationMixer(actor.vrm.scene);
  const action = mixer.clipAction(result.clip).setLoop(THREE.LoopOnce, 1);
  action.play();
  mixer.setTime(1);
  actor.vrm.scene.updateMatrixWorld(true);
  const metrics = collectPoseMetrics(actor.vrm, actor.profile, face, 30);
  const roundTrip = verifyRoundTripClip(result.clip, actor.vrm, plan, actor.profile);

  expect(metrics.faceContactError.value).toBeLessThan(.03);
  expect(roundTrip.faceContactError.passed).toBe(true);
});

test('does not report a template-timed contact as reviewed and reports unreachable hands as failed', () => {
  const actor = avatar();
  const hand = actor.nodes.rightHand;
  const identity = new THREE.Quaternion();
  const source = new THREE.AnimationClip('source', 2, [
    new THREE.QuaternionKeyframeTrack(hand.uuid + '.quaternion', [0, 2], [...identity.toArray(), ...identity.toArray()]),
  ]);
  const reviewPlan = {
    version: 1 as const, duration: 2, style: 'neutral' as const, styleStrength: 0,
    timingSource: 'template' as const, contacts: [face],
  };
  expect(polishClip(source, actor.vrm, reviewPlan, actor.profile).status).toBe('needs-review');

  const farProfile = {
    ...actor.profile,
    anchors: { ...actor.profile.anchors, rightCheek: { ...actor.profile.anchors.rightCheek, point: [1, 0, 0] as [number, number, number] } },
  };
  const failed = polishClip(source, actor.vrm, { ...reviewPlan, timingSource: 'authored' }, farProfile);
  expect(failed.status).toBe('failed');
  expect(failed.reasons.join(' ')).toContain('outside the calibrated arm reach');
});
