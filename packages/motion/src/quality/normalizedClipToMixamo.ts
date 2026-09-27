import { Quaternion, type AnimationClip } from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { MIXAMO_VRM_BONES } from '../rig/rig';
import type { MotionEngine, SavedMotion } from '../rig/engine';

/**
 * Replace the saved Mixamo tracks with sampled, normalized-VRM rotations.
 * This is the inverse of createArdySavedMotion's normalized retargeting path.
 */
export function normalizedClipToMixamo(
  clip: AnimationClip,
  vrm: VRM,
  engine: MotionEngine,
  source: SavedMotion,
): SavedMotion {
  const result: SavedMotion = {
    ...source,
    times: [...source.times],
    tracks: source.tracks.map(track => ({
      ...track,
      positions: [...track.positions],
      rotations: [...track.rotations],
    })),
  };
  const trackByBone = new Map(result.tracks.map(track => [track.bone, track]));
  const quaternion = new Quaternion();
  const changed = new Set<string>();

  for (const animated of clip.tracks) {
    if (!animated.name.endsWith('.quaternion')) continue;
    const targetNode = vrm.scene.getObjectByProperty('uuid', animated.name.slice(0, -'.quaternion'.length));
    if (!targetNode) continue;
    const targetBone = (Object.keys(MIXAMO_VRM_BONES) as Array<keyof typeof MIXAMO_VRM_BONES>)
      .find(bone => vrm.humanoid.getNormalizedBoneNode(MIXAMO_VRM_BONES[bone]) === targetNode);
    if (!targetBone) continue;
    const rest = engine.rest.get(targetBone);
    if (!rest) throw new Error('The Mixamo rig has no bone ' + targetBone + '.');
    let savedTrack = trackByBone.get(targetBone);
    if (!savedTrack) {
      // ardy-mini が動かさないボーン（指など）は、元の姿勢のままのトラックを足してから書き込む
      savedTrack = {
        bone: targetBone,
        positions: result.times.flatMap(() => [rest.p.x, rest.p.y, rest.p.z]),
        rotations: result.times.flatMap(() => rest.q.toArray()),
      };
      result.tracks.push(savedTrack);
      trackByBone.set(targetBone, savedTrack);
    }
    const interpolant = (animated as typeof animated & { createInterpolant(): { evaluate(time: number): ArrayLike<number> } }).createInterpolant();
    for (let index = 0; index < result.times.length; index++) {
      const time = Math.min(clip.duration, result.times[index]);
      const normalized = quaternion.fromArray(interpolant.evaluate(time)).normalize();
      if (vrm.meta.metaVersion === '0') {
        normalized.x *= -1;
        normalized.z *= -1;
        normalized.normalize();
      }
      // createArdySavedMotion applies parentRest * mixamoLocal * inverse(restWorld).
      // Reverse that mapping and preserve the target avatar's normalized pose.
      const mixamo = rest.parentWorld.clone().invert().multiply(normalized).multiply(rest.world).normalize();
      mixamo.toArray(savedTrack.rotations, index * 4);
    }
    changed.add(targetBone);
  }

  if (!changed.size) throw new Error('The polished clip contains no humanoid rotations that map to the Mixamo rig.');
  return result;
}
