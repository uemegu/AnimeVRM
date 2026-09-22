import { Quaternion, QuaternionKeyframeTrack, type AnimationClip } from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { basics } from '../../motion/basics';
import { MotionEngine } from '../../motion/engine';

// Derive choices from the same definitions shown on motion.html.
export const FINGER_MOTION_OPTIONS = Object.entries(basics)
  .filter(([, pose]) => pose.fingers?.side === 'Right')
  .map(([source, pose]) => ({ id: source.slice('@right-'.length), label: pose.label.replace('右手：', '') }));
export type FingerMotionSelection = Partial<Record<'right' | 'left', string>>;
export interface FingerPoseTarget { bone: VRMHumanBoneName; rotation: Quaternion }

const handProperties = Object.fromEntries(FINGER_MOTION_OPTIONS.map(({ id, label }) => [id, {
  type: 'STRING', enum: ['YES', 'NO'], description: label,
}]));
export const FINGER_MOTION_SCHEMA = {
  type: 'OBJECT',
  description: 'Finger Motion: select at most one YES per hand. All NO leaves that hand unspecified. These are hand shapes, reached in 1 second and held for the body motion.',
  properties: Object.fromEntries(['right', 'left'].map(side => [side, {
    type: 'OBJECT', description: side === 'right' ? '右手' : '左手',
    properties: handProperties, required: FINGER_MOTION_OPTIONS.map(({ id }) => id),
  }])),
  required: ['right', 'left'],
};

export function parseFingerMotion(value: unknown): FingerMotionSelection {
  if (value === undefined) return {};
  const record = (input: unknown): input is Record<string, unknown> =>
    typeof input === 'object' && input !== null && !Array.isArray(input);
  if (!record(value)) throw new Error('fingerMotion must contain right/left YES/NO choices.');
  if (Object.keys(value).some(key => key !== 'right' && key !== 'left')) throw new Error('Unknown fingerMotion hand.');
  const selection: FingerMotionSelection = {};
  for (const side of ['right', 'left'] as const) {
    const hand = value[side];
    if (hand === undefined) continue;
    if (!record(hand)) throw new Error(`fingerMotion.${side} must contain YES/NO choices.`);
    for (const [id, enabled] of Object.entries(hand)) {
      if (!FINGER_MOTION_OPTIONS.some(option => option.id === id)) throw new Error(`Unknown Finger Motion: ${id}`);
      if (enabled !== 'YES' && enabled !== 'NO' && enabled !== true && enabled !== false) {
        throw new Error(`fingerMotion.${side}.${id} must be YES or NO.`);
      }
      if (enabled === 'YES' || enabled === true) {
        if (selection[side]) throw new Error(`Select at most one YES for fingerMotion.${side}.`);
        selection[side] = id;
      }
    }
  }
  return selection;
}

export function describeFingerMotion(selection: FingerMotionSelection): string {
  return (['right', 'left'] as const).map(side => {
    const option = FINGER_MOTION_OPTIONS.find(option => option.id === selection[side]);
    return `${side === 'right' ? '右手' : '左手'}: ${option ? `${option.label}=YES` : 'すべてNO'}`;
  }).join(', ');
}

export class FingerMotionService {
  private engine = new MotionEngine();
  private loading: Promise<void> | null = null;

  public async createTargets(selection: FingerMotionSelection, vrm: VRM): Promise<FingerPoseTarget[]> {
    if (!selection.right && !selection.left) return [];
    // Reuse motion.html's procedural poses and source-rig axes, including thumbs.
    this.loading ??= this.engine.init().catch(error => { this.loading = null; throw error; });
    await this.loading;
    for (const rest of this.engine.rest.values()) rest.node.quaternion.copy(rest.q);
    const targets: FingerPoseTarget[] = [];
    for (const side of ['right', 'left'] as const) {
      const id = selection[side];
      if (!id) continue;
      const source = `@${side}-${id}`;
      const pose = basics[source];
      if (!pose?.fingers) throw new Error(`Unknown Finger Motion: ${source}`);
      this.engine.procedural(source, 1, pose.mask, 1);
      for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
        const segments = finger === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'];
        for (let joint = 0; joint < 3; joint++) {
          const rest = this.engine.rest.get(`${pose.fingers.side}Hand${finger}${joint + 1}`);
          const bone = `${side}${finger === 'Pinky' ? 'Little' : finger}${segments[joint]}` as VRMHumanBoneName;
          if (!rest || !vrm.humanoid.getNormalizedBoneNode(bone)) continue;
          // Same Mixamo → normalized VRM conversion as motion.html's syncVRMPose.
          const rotation = rest.node.quaternion.clone().premultiply(rest.parentWorld).multiply(rest.world.clone().invert());
          if (vrm.meta.metaVersion === '0') { rotation.x *= -1; rotation.z *= -1; }
          targets.push({ bone, rotation: rotation.normalize() });
        }
      }
    }
    return targets;
  }
}

/** Replace only selected finger tracks; body and wrist motion remain on the ARDY clip. */
export function applyFingerMotion(clip: AnimationClip, vrm: VRM, targets: readonly FingerPoseTarget[]): void {
  const transition = Math.min(1, clip.duration);
  const times = clip.duration > transition ? [0, transition, clip.duration] : [0, transition];
  for (const { bone, rotation } of targets) {
    const node = vrm.humanoid.getNormalizedBoneNode(bone);
    if (!node) continue;
    const name = `${node.uuid}.quaternion`;
    // ARDY also emits the thumb base: replace it rather than blending two writers.
    clip.tracks = clip.tracks.filter(track => track.name !== name && track.name !== `${node.name}.quaternion`);
    const values = [...node.quaternion.toArray(), ...rotation.toArray()];
    if (times.length === 3) values.push(...rotation.toArray());
    clip.tracks.push(new QuaternionKeyframeTrack(name, times, values));
  }
}
