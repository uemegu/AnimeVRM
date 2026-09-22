import { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { StructuredMotionResult } from './vendor/motion-data';
import { CORE27_VRM_BINDINGS, createVrmRetargetPlan, retargetMotionFrame } from './vendor/vrm-retarget';

/** Convert Core27 global rotations to this avatar's normalized humanoid tracks. */
export function createArdyAnimationClip(motion: StructuredMotionResult, vrm: VRM): AnimationClip {
  if (!motion.localRotations && !motion.globalRotations) throw new Error('ardy-mini returned no joint rotations.');
  const humanoid = vrm.humanoid;
  const restHips = humanoid.normalizedRestPose.hips?.position;
  const plan = createVrmRetargetPlan(motion.skeleton, {
    presentBones: CORE27_VRM_BINDINGS.filter(({ targetBone }) => humanoid.getNormalizedBoneNode(targetBone)).map(({ targetBone }) => targetBone),
    targetHipsHeight: restHips?.[1] ?? 1,
    metaVersion: vrm.meta.metaVersion,
  });
  const times = new Float32Array(motion.frameCount);
  const positions = new Float32Array(motion.frameCount * 3);
  const rotations = plan.bindings.map(() => new Float32Array(motion.frameCount * 4));
  for (let frame = 0; frame < motion.frameCount; frame++) {
    times[frame] = frame / motion.fps;
    const pose = retargetMotionFrame(motion, frame, plan);
    // Keep conversational gestures in place while retaining vertical movement.
    positions.set([restHips?.[0] ?? 0, pose.hipsPosition[1], restHips?.[2] ?? 0], frame * 3);
    // Retarget through globals folds the extra Core27 spine segment into the VRM rig.
    pose.rotations.forEach(({ rotation }, index) => rotations[index].set(rotation, frame * 4));
  }
  const tracks = plan.bindings.map(({ targetBone }, index) => new QuaternionKeyframeTrack(
    `${humanoid.getNormalizedBoneNode(targetBone)!.uuid}.quaternion`, times, rotations[index],
  ));
  const hips = humanoid.getNormalizedBoneNode('hips')!;
  // The neutral height is rig-scaled by the upstream retargeter; no scene transform is changed.
  return new AnimationClip('ardy-mini', motion.frameCount / motion.fps, [
    ...tracks, new VectorKeyframeTrack(`${hips.uuid}.position`, times, positions),
  ]);
}
