import type { VRMHumanBoneName } from '@pixiv/three-vrm';
import type { Anchor, AvatarContactProfile, Contact, HandFrame, MotionQualityPlan, Vec3 } from './types';

const humanBones = new Set<string>([
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
  ...(['left', 'right'] as const).flatMap(side => [
    `${side}ThumbMetacarpal`, `${side}ThumbProximal`, `${side}ThumbDistal`,
    ...(['Index', 'Middle', 'Ring', 'Little'] as const).flatMap(finger => [
      `${side}${finger}Proximal`, `${side}${finger}Intermediate`, `${side}${finger}Distal`,
    ]),
  ]),
]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new RangeError(`${label} must be a finite number.`);
  return value;
}

function vector(value: unknown, label: string): Vec3 {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${label} must contain exactly three numbers.`);
  return [finite(value[0], `${label}[0]`), finite(value[1], `${label}[1]`), finite(value[2], `${label}[2]`)];
}

function unit(value: Vec3, label: string): void {
  const length = Math.hypot(...value);
  if (Math.abs(length - 1) > 1e-4) throw new RangeError(`${label} must have unit length.`);
}

function orthogonal(a: Vec3, b: Vec3, label: string): void {
  if (Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) > 1e-4) throw new RangeError(`${label} must be perpendicular.`);
}

function parseAnchor(value: unknown, label: string): Anchor {
  const input = record(value, label);
  if (typeof input.bone !== 'string' || !humanBones.has(input.bone)) throw new TypeError(`${label}.bone is not a supported VRM humanoid bone.`);
  const point = vector(input.point, `${label}.point`);
  const normal = vector(input.normal, `${label}.normal`);
  const tangent = vector(input.tangent, `${label}.tangent`);
  unit(normal, `${label}.normal`);
  unit(tangent, `${label}.tangent`);
  orthogonal(normal, tangent, `${label}.normal and tangent`);
  return { bone: input.bone as VRMHumanBoneName, point, normal, tangent };
}

function parseHand(value: unknown, label: string): HandFrame {
  const input = record(value, label);
  const palmPoint = vector(input.palmPoint, `${label}.palmPoint`);
  const palmNormal = vector(input.palmNormal, `${label}.palmNormal`);
  const fingerDirection = vector(input.fingerDirection, `${label}.fingerDirection`);
  unit(palmNormal, `${label}.palmNormal`);
  unit(fingerDirection, `${label}.fingerDirection`);
  orthogonal(palmNormal, fingerDirection, `${label}.palmNormal and fingerDirection`);
  return { palmPoint, palmNormal, fingerDirection };
}

export function validateMotionQualityPlan(value: unknown): MotionQualityPlan {
  const input = record(value, 'plan');
  if (input.version !== 1) throw new TypeError('plan.version must be 1.');
  const duration = finite(input.duration, 'plan.duration');
  if (duration < 2 || duration > 8) throw new RangeError('plan.duration must be between 2 and 8 seconds.');
  if (input.style !== 'neutral' && input.style !== 'soft-compact') throw new TypeError('plan.style is unsupported.');
  const styleStrength = finite(input.styleStrength, 'plan.styleStrength');
  if (styleStrength < 0 || styleStrength > 1) throw new RangeError('plan.styleStrength must be between 0 and 1.');
  if (input.timingSource !== 'authored' && input.timingSource !== 'template') throw new TypeError('plan.timingSource is unsupported.');
  if (!Array.isArray(input.contacts) || input.contacts.length > 1) throw new RangeError('plan.contacts must contain zero or one contact.');
  const contacts = input.contacts.map((raw, index): Contact => {
    const contact = record(raw, `plan.contacts[${index}]`);
    const start = finite(contact.start, `contacts[${index}].start`);
    const holdStart = finite(contact.holdStart, `contacts[${index}].holdStart`);
    const holdEnd = finite(contact.holdEnd, `contacts[${index}].holdEnd`);
    const end = finite(contact.end, `contacts[${index}].end`);
    if (!(0 <= start && start < holdStart && holdStart <= holdEnd && holdEnd < end && end <= duration)) {
      throw new RangeError(`contacts[${index}] must satisfy 0 <= start < holdStart <= holdEnd < end <= duration.`);
    }
    if (contact.kind === 'palmsTogether') return { kind: 'palmsTogether', start, holdStart, holdEnd, end };
    if (contact.kind !== 'face') throw new TypeError(`contacts[${index}].kind is unsupported.`);
    if (contact.side !== 'left' && contact.side !== 'right') throw new TypeError(`contacts[${index}].side is unsupported.`);
    if (contact.target !== 'cheek' && contact.target !== 'mouth' && contact.target !== 'chin') throw new TypeError(`contacts[${index}].target is unsupported.`);
    if (contact.target === 'cheek') {
      if (contact.targetSide !== 'left' && contact.targetSide !== 'right') throw new TypeError(`contacts[${index}].targetSide is required for a cheek target.`);
      return { kind: 'face', side: contact.side, target: 'cheek', targetSide: contact.targetSide, start, holdStart, holdEnd, end };
    }
    return { kind: 'face', side: contact.side, target: contact.target, start, holdStart, holdEnd, end };
  });
  return { version: 1, duration, style: input.style, styleStrength, timingSource: input.timingSource, contacts };
}

export function validateAvatarContactProfile(value: unknown): AvatarContactProfile {
  const input = record(value, 'profile');
  if (input.version !== 1) throw new TypeError('profile.version must be 1.');
  if (typeof input.avatarSha256 !== 'string' || !/^[\da-f]{64}$/i.test(input.avatarSha256)) throw new TypeError('profile.avatarSha256 must be a 64-character hexadecimal hash.');
  if (typeof input.calibrated !== 'boolean') throw new TypeError('profile.calibrated must be a boolean.');
  const anchors = record(input.anchors, 'profile.anchors');
  const armLengths = record(input.armLengths, 'profile.armLengths');
  const hands = record(input.hands, 'profile.hands');
  const bodyFrameInput = record(input.bodyFrame, 'profile.bodyFrame');
  const bodyFrame = {
    left: vector(bodyFrameInput.left, 'profile.bodyFrame.left'),
    up: vector(bodyFrameInput.up, 'profile.bodyFrame.up'),
    forward: vector(bodyFrameInput.forward, 'profile.bodyFrame.forward'),
  };
  unit(bodyFrame.left, 'profile.bodyFrame.left');
  unit(bodyFrame.up, 'profile.bodyFrame.up');
  unit(bodyFrame.forward, 'profile.bodyFrame.forward');
  orthogonal(bodyFrame.left, bodyFrame.up, 'profile.bodyFrame.left and up');
  orthogonal(bodyFrame.up, bodyFrame.forward, 'profile.bodyFrame.up and forward');
  orthogonal(bodyFrame.forward, bodyFrame.left, 'profile.bodyFrame.forward and left');
  const handed = bodyFrame.left[1] * bodyFrame.up[2] - bodyFrame.left[2] * bodyFrame.up[1];
  const handedY = bodyFrame.left[2] * bodyFrame.up[0] - bodyFrame.left[0] * bodyFrame.up[2];
  const handedZ = bodyFrame.left[0] * bodyFrame.up[1] - bodyFrame.left[1] * bodyFrame.up[0];
  if (handed * bodyFrame.forward[0] + handedY * bodyFrame.forward[1] + handedZ * bodyFrame.forward[2] < 1 - 1e-4) {
    throw new RangeError('profile.bodyFrame must satisfy left cross up equals forward.');
  }
  const shoulderWidthMeters = finite(input.shoulderWidthMeters, 'profile.shoulderWidthMeters');
  if (shoulderWidthMeters <= 0) throw new RangeError('profile.shoulderWidthMeters must be greater than zero.');
  const lengthFor = (side: 'left' | 'right') => {
    const sideLengths = record(armLengths[side], `profile.armLengths.${side}`);
    const upper = finite(sideLengths.upper, `profile.armLengths.${side}.upper`);
    const lower = finite(sideLengths.lower, `profile.armLengths.${side}.lower`);
    if (upper <= 0 || lower <= 0) throw new RangeError(`profile.armLengths.${side} values must be greater than zero.`);
    return { upper, lower };
  };
  const faceGapMeters = finite(input.faceGapMeters, 'profile.faceGapMeters');
  const palmGapMeters = finite(input.palmGapMeters, 'profile.palmGapMeters');
  if (faceGapMeters < 0 || palmGapMeters < 0) throw new RangeError('Profile gaps must be greater than or equal to zero.');
  return {
    version: 1,
    avatarSha256: input.avatarSha256,
    calibrated: input.calibrated,
    anchors: {
      leftCheek: parseAnchor(anchors.leftCheek, 'profile.anchors.leftCheek'),
      rightCheek: parseAnchor(anchors.rightCheek, 'profile.anchors.rightCheek'),
      mouth: parseAnchor(anchors.mouth, 'profile.anchors.mouth'),
      chin: parseAnchor(anchors.chin, 'profile.anchors.chin'),
    },
    prayerCenter: parseAnchor(input.prayerCenter, 'profile.prayerCenter'),
    hands: { left: parseHand(hands.left, 'profile.hands.left'), right: parseHand(hands.right, 'profile.hands.right') },
    armLengths: { left: lengthFor('left'), right: lengthFor('right') },
    bodyFrame,
    shoulderWidthMeters,
    faceGapMeters,
    palmGapMeters,
  };
}

export function contactStrengthAt(time: number, contact: Contact): number {
  if (!Number.isFinite(time) || time <= contact.start || time >= contact.end) return 0;
  if (time >= contact.holdStart && time <= contact.holdEnd) return 1;
  const smoothstep = (value: number) => {
    const u = Math.max(0, Math.min(1, value));
    return u * u * u * (10 + u * (-15 + 6 * u));
  };
  if (time < contact.holdStart) return smoothstep((time - contact.start) / (contact.holdStart - contact.start));
  return smoothstep((contact.end - time) / (contact.end - contact.holdEnd));
}
