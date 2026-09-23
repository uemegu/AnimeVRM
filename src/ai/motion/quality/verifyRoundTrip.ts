import { AnimationMixer, LoopOnce, Quaternion, Vector3, type AnimationClip, type Object3D } from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { collectPoseMetrics } from './measure';
import { validateAvatarContactProfile, validateMotionQualityPlan } from './validate';
import type { AvatarContactProfile, MotionQualityPlan, QualityMetrics } from './types';

interface Snapshot { node: Object3D; position: Vector3; quaternion: Quaternion; scale: Vector3; }

function snapshot(scene: Object3D): Snapshot[] {
  const items: Snapshot[] = [];
  scene.traverse(node => items.push({ node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() }));
  return items;
}

function restore(items: readonly Snapshot[]): void {
  for (const item of items) {
    item.node.position.copy(item.position);
    item.node.quaternion.copy(item.quaternion);
    item.node.scale.copy(item.scale);
  }
}

/** Measure the exported-and-reloaded FBX clip on the same VRM, without applying the live IK again. */
export function verifyRoundTripClip(
  clip: AnimationClip,
  vrm: VRM,
  planInput: MotionQualityPlan,
  profileInput: AvatarContactProfile,
  fps = 30,
): QualityMetrics {
  const plan = validateMotionQualityPlan(planInput);
  const profile = validateAvatarContactProfile(profileInput);
  const contact = plan.contacts[0];
  if (!contact) return {};
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) throw new RangeError('Round-trip fps must be an integer from 1 to 120.');
  if (clip.duration + 1 / fps < plan.duration) throw new RangeError('Exported clip is shorter than its contact plan.');

  const frames = new Set<number>([
    Math.ceil(contact.holdStart * fps),
    Math.floor(contact.holdEnd * fps),
    Math.round(((contact.holdStart + contact.holdEnd) / 2) * fps),
  ]);
  for (let frame = Math.ceil(contact.holdStart * fps); frame <= Math.floor(contact.holdEnd * fps); frame++) frames.add(frame);
  const original = snapshot(vrm.scene);
  const mixer = new AnimationMixer(vrm.scene);
  const action = mixer.clipAction(clip);
  action.reset().setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const metrics: QualityMetrics = {};
  try {
    for (const frame of [...frames].sort((a, b) => a - b)) {
      const time = frame / fps;
      restore(original);
      mixer.setTime(time);
      vrm.scene.updateMatrixWorld(true);
      const current = collectPoseMetrics(vrm, profile, contact, frame);
      for (const [key, candidate] of Object.entries(current)) {
        const previous = metrics[key];
        if (!previous || candidate.value !== null && (previous.value === null || candidate.value > previous.value)) metrics[key] = candidate;
      }
    }
  } finally {
    action.stop();
    mixer.uncacheAction(clip);
    mixer.uncacheClip(clip);
    restore(original);
    vrm.scene.updateMatrixWorld(true);
  }
  return metrics;
}
