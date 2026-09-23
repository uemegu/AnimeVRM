import { AnimationClip, MathUtils, Quaternion, Vector3, type KeyframeTrack } from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import type { SavedMotion } from '../../../motion/engine';

export interface MotionStyle {
  /** Hold the legs, the hips' rotation and the hips' height at the first frame, for gestures made in place. */
  lockLegs?: boolean;
  /** Scale every rotation toward an upright pose with the arms lowered; below 1 is smaller, above 1 bigger. */
  amplitude?: number;
}

const LEG_BONES: VRMHumanBoneName[] = [
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
];
/** Normalized VRM upper arms point sideways; this lowers them to hang beside the body. */
const ARM_DOWN_DEGREES = 70;

export function validateMotionStyle(style: MotionStyle): void {
  if (style.amplitude !== undefined && !(style.amplitude >= 0.3 && style.amplitude <= 1.5)) {
    throw new RangeError('Amplitude must be between 0.3 and 1.5.');
  }
}

/** Return a copy of a normalized-rig clip with the style applied; the hips' height follows in styleSavedHips. */
export function styleMotion(clip: AnimationClip, vrm: VRM, style: MotionStyle): AnimationClip {
  validateMotionStyle(style);
  const styled = clip.clone();
  const boneOf = new Map<string, VRMHumanBoneName>();
  for (const name of Object.keys(vrm.humanoid.humanBones) as VRMHumanBoneName[]) {
    const node = vrm.humanoid.getNormalizedBoneNode(name);
    if (node) boneOf.set(node.uuid, name);
  }
  const rotations = new Map<VRMHumanBoneName, KeyframeTrack>();
  let hipsPosition: KeyframeTrack | undefined;
  for (const track of styled.tracks) {
    const [uuid, property] = track.name.split('.');
    const bone = boneOf.get(uuid);
    if (!bone) continue;
    if (property === 'quaternion') rotations.set(bone, track);
    else if (property === 'position' && bone === 'hips') hipsPosition = track;
  }
  const frames = rotations.get('hips')?.times.length ?? 0;
  const q = new Quaternion(), first = new Quaternion();

  const amplitude = style.amplitude ?? 1;
  if (amplitude !== 1 && hipsPosition) {
    const restHeight = vrm.humanoid.normalizedRestPose.hips?.position?.[1] ?? hipsPosition.values[1];
    for (let frame = 0; frame < frames; frame++) {
      hipsPosition.values[frame * 3 + 1] = restHeight + (hipsPosition.values[frame * 3 + 1] - restHeight) * amplitude;
    }
  }
  if (amplitude !== 1) {
    // VRM0's normalized rig faces the other way, which mirrors rotations about the vertical axis.
    const side = vrm.meta.metaVersion === '0' ? -1 : 1;
    const neutral = (bone: VRMHumanBoneName) => bone === 'leftUpperArm' || bone === 'rightUpperArm'
      ? new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), MathUtils.degToRad(ARM_DOWN_DEGREES) * side * (bone === 'leftUpperArm' ? -1 : 1))
      : new Quaternion();
    for (const [bone, track] of rotations) {
      const rest = neutral(bone);
      for (let frame = 0; frame < frames; frame++) {
        q.fromArray(track.values, frame * 4);
        new Quaternion().slerpQuaternions(rest, q, amplitude).toArray(track.values, frame * 4);
      }
    }
  }

  if (style.lockLegs) {
    for (const bone of LEG_BONES) {
      const track = rotations.get(bone);
      if (track) for (let frame = 1; frame < frames; frame++) track.values.copyWithin(frame * 4, 0, 4);
    }
    // Hold the hips' rotation and hand the difference to the spine, so the upper body keeps its pose.
    const hips = rotations.get('hips');
    const spine = rotations.get('spine');
    if (hips) {
      first.fromArray(hips.values, 0);
      const inverseFirst = first.clone().invert();
      for (let frame = 1; frame < frames; frame++) {
        q.fromArray(hips.values, frame * 4);
        if (spine) inverseFirst.clone().multiply(q).multiply(new Quaternion().fromArray(spine.values, frame * 4)).normalize().toArray(spine.values, frame * 4);
        first.toArray(hips.values, frame * 4);
      }
    }
    if (hipsPosition) for (let frame = 1; frame < frames; frame++) hipsPosition.values[frame * 3 + 1] = hipsPosition.values[1];
  }
  return styled;
}

/** Seconds at the end of a looping motion that ease back into its first pose. */
export const LOOP_BLEND_SECONDS = 0.5;

/** Ease the end of a Mixamo-rig motion into its first frame, so a repeating animation does not jump. */
export function loopSavedMotion(saved: SavedMotion, seconds = LOOP_BLEND_SECONDS): SavedMotion {
  const end = saved.times[saved.times.length - 1];
  const start = Math.max(0, end - seconds);
  const q = new Quaternion(), first = new Quaternion();
  return {
    ...saved,
    tracks: saved.tracks.map(track => {
      const rotations = [...track.rotations], positions = [...track.positions];
      first.fromArray(track.rotations, 0);
      saved.times.forEach((time, frame) => {
        if (time <= start) return;
        const weight = MathUtils.smoothstep(time, start, end);
        if (rotations.length >= (frame + 1) * 4) q.fromArray(track.rotations, frame * 4).slerp(first, weight).toArray(rotations, frame * 4);
        for (let axis = 0; axis < 3 && positions.length >= (frame + 1) * 3; axis++) {
          positions[frame * 3 + axis] = MathUtils.lerp(track.positions[frame * 3 + axis], track.positions[axis], weight);
        }
      });
      return { ...track, rotations, positions };
    }),
  };
}

/** Apply the style's effect on the hips' height to a Mixamo-rig motion, whose positions are not in the clip's rotations. */
export function styleSavedHips(saved: SavedMotion, style: MotionStyle, restHeight: number): SavedMotion {
  const amplitude = style.amplitude ?? 1;
  if (!style.lockLegs && amplitude === 1) return saved;
  return {
    ...saved,
    tracks: saved.tracks.map(track => {
      if (track.bone !== 'Hips') return track;
      const positions = [...track.positions];
      for (let index = 1; index < positions.length; index += 3) {
        positions[index] = style.lockLegs ? positions[1] : restHeight + (positions[index] - restHeight) * amplitude;
      }
      return { ...track, positions };
    }),
  };
}
