import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  LoopOnce,
  type Object3D,
} from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { collectPoseMetrics } from './measure';
import { solveContactsAtTime } from './solveContacts';
import { validateAvatarContactProfile, validateMotionQualityPlan } from './validate';
import type {
  AvatarContactProfile,
  MotionQualityPlan,
  QualityMetric,
  QualityMetrics,
  QualityStatus,
} from './types';

export interface PolishClipResult {
  clip: AnimationClip;
  before: QualityMetrics;
  after: QualityMetrics;
  status: QualityStatus;
  reasons: string[];
}

interface TransformSnapshot {
  node: Object3D;
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
}

function snapshotScene(scene: Object3D): TransformSnapshot[] {
  const nodes: TransformSnapshot[] = [];
  scene.traverse(node => nodes.push({
    node,
    position: node.position.clone(),
    quaternion: node.quaternion.clone(),
    scale: node.scale.clone(),
  }));
  return nodes;
}

function restoreScene(snapshots: readonly TransformSnapshot[]): void {
  for (const item of snapshots) {
    item.node.position.copy(item.position);
    item.node.quaternion.copy(item.quaternion);
    item.node.scale.copy(item.scale);
  }
}

function mergeWorst(current: QualityMetrics, incoming: QualityMetrics): void {
  for (const [key, value] of Object.entries(incoming)) {
    const previous = current[key];
    if (value.value === null) {
      if (!previous) current[key] = value;
      continue;
    }
    if (previous?.value === null || !previous || value.value > previous.value) current[key] = value;
  }
}

function metricPassed(metrics: QualityMetrics): boolean {
  return Object.values(metrics).every(metric => metric.passed !== false && metric.value !== null);
}

function keyframes(duration: number, fps: number, extra: readonly number[]): number[] {
  const frameCount = Math.ceil(duration * fps);
  const result = new Set<number>([0, duration]);
  for (let frame = 1; frame < frameCount; frame++) result.add(Math.min(duration, frame / fps));
  for (const time of extra) if (time >= 0 && time <= duration) result.add(time);
  return [...result].sort((a, b) => a - b);
}

/**
 * Bake contact correction into a new normalized-bone clip.
 * The source clip, VRM and source tracks remain unchanged.
 */
export function polishClip(
  sourceClip: AnimationClip,
  vrm: VRM,
  planInput: MotionQualityPlan,
  profileInput: AvatarContactProfile,
  options: { fps?: number; externalWeight?: number } = {},
): PolishClipResult {
  const plan = validateMotionQualityPlan(planInput);
  const profile = validateAvatarContactProfile(profileInput);
  const fps = options.fps ?? 30;
  const externalWeight = options.externalWeight ?? 1;
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) throw new RangeError('Polished clip fps must be an integer from 1 to 120.');
  if (Math.abs(sourceClip.duration - plan.duration) > 1 / fps) throw new RangeError('The plan duration must match the source clip duration within one output frame.');
  if (!profile.calibrated) {
    return { clip: sourceClip.clone(), before: {}, after: {}, status: 'needs-review', reasons: ['The avatar contact profile has not been visually calibrated.'] };
  }
  const contact = plan.contacts[0];
  if (!contact) {
    return { clip: sourceClip.clone(), before: {}, after: {}, status: 'needs-review', reasons: ['No supported contact was specified; no correction was applied.'] };
  }
  const times = keyframes(plan.duration, fps, [contact.start, contact.holdStart, contact.holdEnd, contact.end]);
  const before: QualityMetrics = {};
  const after: QualityMetrics = {};
  const reasons = new Set<string>();
  const targets = contact.kind === 'face'
    ? [contact.side === 'left' ? 'leftUpperArm' : 'rightUpperArm', contact.side === 'left' ? 'leftLowerArm' : 'rightLowerArm', contact.side === 'left' ? 'leftHand' : 'rightHand'] as const
    : ['leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand'] as const;
  const nodes = targets.map(name => {
    const node = vrm.humanoid.getNormalizedBoneNode(name);
    if (!node) throw new Error('Cannot bake contact correction without normalized bone ' + name + '.');
    return { name, node };
  });
  const trackByName = new Map<string, number[]>();
  for (const { node } of nodes) trackByName.set(node.uuid + '.quaternion', []);
  const original = snapshotScene(vrm.scene);
  const mixer = new AnimationMixer(vrm.scene);
  const action = mixer.clipAction(sourceClip);
  action.reset().setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();

  try {
    for (let index = 0; index < times.length; index++) {
      const time = times[index];
      restoreScene(original);
      mixer.setTime(time);
      vrm.scene.updateMatrixWorld(true);
      if (time >= contact.holdStart && time <= contact.holdEnd) {
        mergeWorst(before, collectPoseMetrics(vrm, profile, contact, Math.round(time * fps)));
      }
      const result = solveContactsAtTime(vrm, plan, profile, time, externalWeight);
      if (result.status === 'unreachable' || result.status === 'unsupported') {
        for (const reason of result.reasons) reasons.add(reason);
      }
      vrm.scene.updateMatrixWorld(true);
      if (time >= contact.holdStart && time <= contact.holdEnd) {
        mergeWorst(after, collectPoseMetrics(vrm, profile, contact, Math.round(time * fps)));
      }
      for (const { node } of nodes) trackByName.get(node.uuid + '.quaternion')!.push(...node.quaternion.toArray());
    }
  } finally {
    action.stop();
    mixer.uncacheAction(sourceClip);
    mixer.uncacheClip(sourceClip);
    restoreScene(original);
    vrm.scene.updateMatrixWorld(true);
  }

  const polished = sourceClip.clone();
  polished.tracks = polished.tracks.filter(track => !trackByName.has(track.name));
  for (const { node } of nodes) {
    polished.tracks.push(new QuaternionKeyframeTrack(
      node.uuid + '.quaternion',
      times,
      trackByName.get(node.uuid + '.quaternion')!,
    ));
  }
  const hasHoldingSample = times.some(time => time >= contact.holdStart && time <= contact.holdEnd);
  if (!hasHoldingSample) reasons.add('No sample fell inside the authored contact hold interval.');
  if (!hasHoldingSample) return { clip: polished, before, after, status: 'failed', reasons: [...reasons] };
  if (reasons.size) return { clip: polished, before, after, status: 'failed', reasons: [...reasons] };
  if (plan.timingSource === 'template') reasons.add('Contact timing came from a template and needs a human review.');
  const status: QualityStatus = !metricPassed(after) ? 'failed' : reasons.size ? 'needs-review' : 'pass';
  return { clip: polished, before, after, status, reasons: [...reasons] };
}
