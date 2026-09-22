import { Quaternion } from 'three';
import type { VRMHumanBoneName } from '@pixiv/three-vrm';
import type { MotionEngine, SavedMotion } from './engine';
import { MIXAMO_VRM_BONES } from './rig';
import type { StructuredMotionResult } from '../ai/motion/ardy/vendor/motion-data';
import { createVrmRetargetPlan, retargetMotionFrame } from '../ai/motion/ardy/vendor/vrm-retarget';

/** Bake ARDY's normalized rotations into the editor's reusable Mixamo-rig motion format. */
export function createArdySavedMotion(motion: StructuredMotionResult, engine: MotionEngine, name: string): SavedMotion {
  if (!motion.localRotations && !motion.globalRotations) throw new Error('ardy-mini returned no joint rotations.');
  const hips = engine.rest?.get('Hips');
  if (!hips) throw new Error('編集用の骨格を読み込んでください。');
  const duration = motion.frameCount / motion.fps;
  if (!Number.isFinite(duration) || duration < .1 || duration > 60) throw new Error('生成した動作の長さが正しくありません。');
  const boneByTarget = new Map<VRMHumanBoneName, string>(Object.entries(MIXAMO_VRM_BONES)
    .filter(([bone]) => engine.rest.has(bone)).map(([bone, target]) => [target, bone]));
  const plan = createVrmRetargetPlan(motion.skeleton, {
    presentBones: boneByTarget.keys(), targetHipsHeight: hips.p.y, metaVersion: '1',
  });
  const bindings = plan.bindings.map(({ targetBone }) => {
    const bone = boneByTarget.get(targetBone)!;
    const rest = engine.rest.get(bone)!;
    return { bone, rest, inverseParent: rest.parentWorld.clone().invert() };
  });
  // Include the endpoint so JSON round-trips, source trimming and FBX export retain the full duration.
  const times = Array.from({ length: motion.frameCount + 1 }, (_, frame) => frame / motion.fps);
  const tracks = bindings.map(({ bone }) => ({ bone, positions: [] as number[], rotations: [] as number[] }));
  const rotation = new Quaternion();
  const round = (v: number) => Number(v.toFixed(6));
  for (let frame = 0; frame < times.length; frame++) {
    const pose = retargetMotionFrame(motion, Math.min(frame, motion.frameCount - 1), plan);
    bindings.forEach(({ bone, rest, inverseParent }, index) => {
      // Inverse of syncVRMPose: normalized = parentRestWorld * local * inverse(restWorld).
      rotation.fromArray(pose.rotations[index].rotation).multiply(rest.world).premultiply(inverseParent).normalize();
      tracks[index].rotations.push(...rotation.toArray().map(round));
      // Keep horizontal placement fixed, with ARDY's vertical motion scaled to this source rig.
      tracks[index].positions.push(round(rest.p.x), round(bone === 'Hips' ? pose.hipsPosition[1] : rest.p.y), round(rest.p.z));
    });
  }
  return { id: `saved:${crypto.randomUUID()}`, name: name.trim().slice(0, 60) || 'ardy-mini の動作', duration, mask: '全身', times, tracks };
}
