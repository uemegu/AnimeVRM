import type { VRMHumanBoneName } from '@pixiv/three-vrm';

export type Vec3 = [number, number, number];
export type Side = 'left' | 'right';
export type Style = 'neutral' | 'soft-compact';
export type QualityStatus = 'pass' | 'needs-review' | 'failed' | 'unsupported';

export interface ContactWindow {
  start: number;
  holdStart: number;
  holdEnd: number;
  end: number;
}

export type Contact = ContactWindow & (
  | { kind: 'face'; side: Side; target: 'cheek'; targetSide: Side }
  | { kind: 'face'; side: Side; target: 'mouth' | 'chin' }
  | { kind: 'palmsTogether' }
);

export interface MotionQualityPlan {
  version: 1;
  duration: number;
  style: Style;
  styleStrength: number;
  timingSource: 'authored' | 'template';
  contacts: Contact[];
}

export interface Anchor {
  bone: VRMHumanBoneName;
  point: Vec3;
  normal: Vec3; // Surface-outward for face anchors; actor-left/right contact axis for prayerCenter.
  tangent: Vec3;
}

export interface HandFrame {
  palmPoint: Vec3;
  palmNormal: Vec3;
  fingerDirection: Vec3;
}

export interface AvatarContactProfile {
  version: 1;
  avatarSha256: string;
  calibrated: boolean;
  anchors: Record<'leftCheek' | 'rightCheek' | 'mouth' | 'chin', Anchor>;
  prayerCenter: Anchor;
  hands: Record<Side, HandFrame>;
  armLengths: Record<Side, { upper: number; lower: number }>;
  bodyFrame: { left: Vec3; up: Vec3; forward: Vec3 };
  shoulderWidthMeters: number;
  faceGapMeters: number;
  palmGapMeters: number;
}

export type MetricUnit = 'ratio' | 'degrees' | 'radians/second' | 'radians/second2' | 'count';

export interface QualityMetric {
  value: number | null;
  unit: MetricUnit;
  threshold: number | null;
  worstFrame: number | null;
  passed: boolean | null;
}

export type QualityMetrics = Record<string, QualityMetric>;

export interface MotionQualityReport {
  version: 1;
  status: QualityStatus;
  avatarSha256: string;
  plan: MotionQualityPlan;
  timingSource: MotionQualityPlan['timingSource'];
  before: QualityMetrics;
  after: QualityMetrics;
  exportRoundTrip: QualityMetrics;
  planner?: { model: string; confidence: Record<string, number>; note: string };
  reasons: string[];
}
