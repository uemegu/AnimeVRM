import type { StructuredMotionResult } from './vendor/motion-data';

/**
 * Defect measurements on ardy-mini's source skeleton. Lower is better except activity.
 * Jitter is not measured: generated clips keep under 0.1% of hand and head motion energy above 5 Hz,
 * so jerk only rewarded timid candidates.
 */
export interface ArdyMotionMetrics {
  /** Mean horizontal foot speed while grounded once the hips are held in place, m/s. */
  footSlide: number;
  /** Share of frames with a hand inside the torso. */
  handPenetration: number;
  /** Share of frames with a wrist bent beyond a natural range. */
  wristStrain: number;
  /** Mean hand speed relative to the hips, m/s. Used only to spot candidates that barely move. */
  activity: number;
}

export type ArdyDefectMetric = Exclude<keyof ArdyMotionMetrics, 'activity'>;

export interface ArdyMotionScore {
  /** Sum of each defect metric divided by its limit; lower is better. */
  total: number;
  metrics: ArdyMotionMetrics;
}

/** A metric at its limit adds 1 to the total. */
export const ARDY_SCORE_LIMITS: Record<ArdyDefectMetric, number> = {
  footSlide: 0.05,
  handPenetration: 0.05,
  wristStrain: 0.1,
};

/** Candidates moving less than this share of the median are likely ignoring the prompt. */
export const ARDY_LOW_ACTIVITY_RATIO = 0.5;

const TORSO_JOINTS = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Spine3', 'Neck'];
const TORSO_RADIUS = 0.06;
const WRIST_LIMIT_DEGREES = 75;
const GROUNDED_HEIGHT = 0.02;

type Vec3 = [number, number, number];

export function scoreArdyMotion(motion: StructuredMotionResult): ArdyMotionScore {
  const names = motion.skeleton.jointNames;
  const jointCount = names.length;
  const index = (name: string): number => {
    const found = names.indexOf(name);
    if (found < 0) throw new Error(`ardy-mini skeleton has no ${name} joint.`);
    return found;
  };
  const at = (frame: number, joint: number): Vec3 => {
    const offset = (frame * jointCount + joint) * 3;
    return [motion.positions[offset], motion.positions[offset + 1], motion.positions[offset + 2]];
  };
  const frames = motion.frameCount;
  const fps = motion.fps;
  const hips = index('Hips');

  let activitySum = 0;
  let activityCount = 0;
  for (const joint of ['RightHand', 'LeftHand'].map(index)) {
    for (let t = 0; t + 1 < frames; t++) {
      const before = sub(at(t, joint), at(t, hips));
      const after = sub(at(t + 1, joint), at(t + 1, hips));
      activitySum += length(sub(after, before)) * fps;
      activityCount++;
    }
  }

  // The exported clip keeps the hips' horizontal position fixed, so a planted foot slides by the hips' travel.
  let slideSum = 0;
  let slideCount = 0;
  const contactJoints = motion.skeleton.contactJointIndices;
  contactJoints.forEach((joint, channel) => {
    let floor = Infinity;
    for (let t = 0; t < frames; t++) floor = Math.min(floor, at(t, joint)[1]);
    const grounded = (t: number) => motion.contacts
      ? motion.contacts[t * contactJoints.length + channel] !== 0
      : at(t, joint)[1] <= floor + GROUNDED_HEIGHT;
    for (let t = 0; t + 1 < frames; t++) {
      if (!grounded(t) || !grounded(t + 1)) continue;
      const before = sub(at(t, joint), at(t, hips));
      const after = sub(at(t + 1, joint), at(t + 1, hips));
      slideSum += Math.hypot(after[0] - before[0], after[2] - before[2]) * fps;
      slideCount++;
    }
  });

  const torso = TORSO_JOINTS.map(index);
  const hands = ['Right', 'Left'].map(side => ({
    forearm: index(`${side}ForeArm`), hand: index(`${side}Hand`), end: index(`${side}HandEnd`),
  }));
  let penetratingFrames = 0;
  let strainedFrames = 0;
  for (let t = 0; t < frames; t++) {
    const spine = torso.map(joint => at(t, joint));
    let penetrating = false;
    let strained = false;
    for (const { forearm, hand, end } of hands) {
      const [elbow, wrist, tip] = [at(t, forearm), at(t, hand), at(t, end)];
      if ([wrist, tip].some(point => distanceToPolyline(point, spine) < TORSO_RADIUS)) penetrating = true;
      if (angleDegrees(sub(wrist, elbow), sub(tip, wrist)) > WRIST_LIMIT_DEGREES) strained = true;
    }
    if (penetrating) penetratingFrames++;
    if (strained) strainedFrames++;
  }

  const metrics: ArdyMotionMetrics = {
    footSlide: slideCount ? slideSum / slideCount : 0,
    handPenetration: frames ? penetratingFrames / frames : 0,
    wristStrain: frames ? strainedFrames / frames : 0,
    activity: activityCount ? activitySum / activityCount : 0,
  };
  const total = (Object.keys(ARDY_SCORE_LIMITS) as ArdyDefectMetric[])
    .reduce((sum, key) => sum + metrics[key] / ARDY_SCORE_LIMITS[key], 0);
  return { total, metrics };
}

/** Order candidates best first; ones that barely move go last because they rarely follow the prompt. */
export function rankArdyCandidates<T extends { score: ArdyMotionScore }>(candidates: readonly T[]): (T & { lowActivity: boolean })[] {
  const activities = candidates.map(({ score }) => score.metrics.activity);
  const threshold = percentile(activities, 0.5) * ARDY_LOW_ACTIVITY_RATIO;
  return candidates
    .map(candidate => ({ ...candidate, lowActivity: candidate.score.metrics.activity < threshold }))
    .sort((a, b) => Number(a.lowActivity) - Number(b.lowActivity) || a.score.total - b.score.total);
}

function percentile(values: readonly number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * (sorted.length - 1) + 0.5))];
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function length(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

function angleDegrees(a: Vec3, b: Vec3): number {
  const denominator = length(a) * length(b);
  if (denominator === 0) return 0;
  const cosine = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / denominator;
  return Math.acos(Math.min(1, Math.max(-1, cosine))) * 180 / Math.PI;
}

function distanceToPolyline(point: Vec3, line: readonly Vec3[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const segment = sub(line[i + 1], line[i]);
    const toPoint = sub(point, line[i]);
    const squared = segment[0] ** 2 + segment[1] ** 2 + segment[2] ** 2;
    const t = squared ? Math.min(1, Math.max(0, (toPoint[0] * segment[0] + toPoint[1] * segment[1] + toPoint[2] * segment[2]) / squared)) : 0;
    best = Math.min(best, length(sub(toPoint, [segment[0] * t, segment[1] * t, segment[2] * t])));
  }
  return best;
}
