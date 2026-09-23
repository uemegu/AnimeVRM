import { expect, test } from '@playwright/test';
import { CORE27_JOINT_NAMES, CORE27_SKELETON, type StructuredMotionResult } from '../src/ai/motion/ardy/vendor/motion-data';
import { rankArdyCandidates, scoreArdyMotion } from '../src/ai/motion/ardy/scoreMotion';

type Vec3 = [number, number, number];

// Neutral standing pose close to ardy-mini's Core27 output (Y up, metres).
const NEUTRAL: Record<string, Vec3> = {
  Hips: [0, 0.95, 0], Spine: [0, 1.05, -0.02], Spine1: [0, 1.15, -0.04], Spine2: [0, 1.22, -0.06],
  Spine3: [0, 1.3, -0.07], Neck: [0, 1.54, -0.02], Head: [0, 1.67, 0],
  RightShoulder: [-0.05, 1.45, -0.05], RightArm: [-0.18, 1.45, -0.05], RightForeArm: [-0.2, 1.18, -0.05],
  RightHand: [-0.21, 0.95, -0.03], RightHandEnd: [-0.21, 0.88, -0.02], RightHandThumb1: [-0.19, 0.93, 0],
  LeftShoulder: [0.05, 1.45, -0.05], LeftArm: [0.18, 1.45, -0.05], LeftForeArm: [0.2, 1.18, -0.05],
  LeftHand: [0.21, 0.95, -0.03], LeftHandEnd: [0.21, 0.88, -0.02], LeftHandThumb1: [0.19, 0.93, 0],
  RightUpLeg: [-0.1, 0.9, 0], RightLeg: [-0.1, 0.5, 0], RightFoot: [-0.1, 0.08, -0.02], RightToeBase: [-0.1, 0.02, 0.12],
  LeftUpLeg: [0.1, 0.9, 0], LeftLeg: [0.1, 0.5, 0], LeftFoot: [0.1, 0.08, -0.02], LeftToeBase: [0.1, 0.02, 0.12],
};

function motion(frames: number, pose: (frame: number, joint: string, neutral: Vec3) => Vec3): StructuredMotionResult {
  const positions = new Float32Array(frames * CORE27_JOINT_NAMES.length * 3);
  for (let t = 0; t < frames; t++) {
    CORE27_JOINT_NAMES.forEach((joint, j) => positions.set(pose(t, joint, NEUTRAL[joint]), (t * CORE27_JOINT_NAMES.length + j) * 3));
  }
  return {
    skeleton: CORE27_SKELETON, positions, positionsShape: [frames, CORE27_JOINT_NAMES.length, 3], frameCount: frames, fps: 20,
    contacts: new Uint8Array(frames * 4).fill(1), contactsShape: [frames, 4],
  };
}

// The right hand swings sideways so every candidate has the same, clearly non-zero activity.
const wave = (t: number, joint: string, [x, y, z]: Vec3): Vec3 =>
  joint.startsWith('RightHand') ? [x + 0.1 * Math.sin(t / 3), y, z] : [x, y, z];

test('a still standing pose has no defects', () => {
  const score = scoreArdyMotion(motion(40, (_t, _joint, neutral) => neutral));
  expect(score.total).toBe(0);
  expect(score.metrics.activity).toBe(0);
});

test('hips travelling over planted feet counts as foot slide in the in-place export', () => {
  // 0.1 m/s of hips drift while the feet stay put in the world.
  const drifting = scoreArdyMotion(motion(40, (t, joint, [x, y, z]) =>
    joint.includes('Foot') || joint.includes('Toe') ? [x, y, z] : [x, y, z + 0.1 * t / 20]));
  expect(drifting.metrics.footSlide).toBeCloseTo(0.1, 3);
  // Walking the whole body together keeps the feet under the hips, so nothing slides after locking.
  const together = scoreArdyMotion(motion(40, (t, _joint, [x, y, z]) => [x, y, z + 0.1 * t / 20]));
  expect(together.metrics.footSlide).toBeCloseTo(0, 5);
});

test('a hand inside the torso and a folded wrist are counted per frame', () => {
  const score = scoreArdyMotion(motion(40, (t, joint, [x, y, z]) => {
    if (t >= 20) return [x, y, z];
    if (joint === 'LeftHand') return [0.02, 1.2, -0.05];
    // Fold the right hand back up along the forearm.
    if (joint === 'RightHandEnd') return [-0.21, 1.02, -0.03];
    return [x, y, z];
  }));
  expect(score.metrics.handPenetration).toBeCloseTo(0.5, 5);
  expect(score.metrics.wristStrain).toBeCloseTo(0.5, 5);
});

test('ranking prefers fewer defects but moves near-static candidates last', () => {
  const clean = { id: 'clean', score: scoreArdyMotion(motion(40, wave)) };
  const sliding = { id: 'sliding', score: scoreArdyMotion(motion(40, (t, joint, neutral) => {
    const [x, y, z] = wave(t, joint, neutral);
    return joint.includes('Foot') || joint.includes('Toe') ? [x, y, z] : [x, y, z + 0.05 * t / 20];
  })) };
  const still = { id: 'still', score: scoreArdyMotion(motion(40, (_t, _joint, neutral) => neutral)) };
  const ranked = rankArdyCandidates([still, sliding, clean]);
  expect(ranked.map(({ id }) => id)).toEqual(['clean', 'sliding', 'still']);
  expect(ranked[2].lowActivity).toBe(true);
});
