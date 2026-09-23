import { AnimationClip, MathUtils, Matrix4, Quaternion, SkinnedMesh, Vector3, type Object3D } from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import type { StructuredMotionResult } from './vendor/motion-data';

/**
 * ardy-mini is trained on real bodies, while anime avatars have narrow shoulders and short arms and torsos.
 * Copying joint rotations therefore moves the hands relative to the body, so hands on the hips or chest sink
 * into them. This refits the palms to the avatar's own torso, then re-solves each arm.
 *
 * Hands at the face keep ardy-mini's pose. Mapping the palm centre onto an anime face was tried with
 * landmarks measured from the mesh, but the face is so small relative to the hand (on aoi the nose is 1.5 cm
 * above the mouth) that a palm centred on the mouth covers the eyes, while the copied rotations read correctly.
 */

type SourceRegionName = 'head' | TorsoRegionName;
export type TorsoRegionName = 'chest' | 'waist' | 'hips';

/**
 * An ellipsoid that follows a bone. Offsets use the body's left (+X), up (+Y) and forward (+Z) in the rest pose,
 * the same axes ardy-mini uses, so a VRM0 avatar turned to face forward still measures the same way.
 */
export interface BodyRegion {
  bone: VRMHumanBoneName;
  center: Vector3;
  radii: Vector3;
  /** Inverse of the bone's world rotation in the rest pose; turns a posed rotation into a body-frame rotation. */
  restInverse: Quaternion;
}

export type AvatarBody = Record<TorsoRegionName, BodyRegion>;

/**
 * Where ardy-mini's palm centre (HandEnd) rests when a hand touches each region, in the joint's frame.
 * The head and chest were fitted to generated contacts (cover the mouth, rest the chin, touch a cheek, the
 * crown and an ear; a hand flat on the chest). The Core27 head joint sits at the back of the skull, so the
 * face is about 0.21 m in front of it. Waist and hips contacts were too inconsistent to fit, so those are
 * adult averages widened by a palm's offset from the skin.
 */
const SOURCE_REGIONS: Record<SourceRegionName, { joint: string; center: [number, number, number]; radii: [number, number, number] }> = {
  head: { joint: 'Head', center: [0, -0.013, 0], radii: [0.14, 0.19, 0.21] },
  chest: { joint: 'Spine3', center: [0, 0.05, 0.09], radii: [0.17, 0.14, 0.185] },
  waist: { joint: 'Spine1', center: [0, 0, 0.07], radii: [0.15, 0.11, 0.13] },
  hips: { joint: 'Hips', center: [0, -0.03, 0.01], radii: [0.19, 0.12, 0.14] },
};

const TARGET_BONES: Record<TorsoRegionName, VRMHumanBoneName[]> = {
  chest: ['upperChest', 'chest'],
  waist: ['spine'],
  hips: ['hips'],
};

/** A palm centre rests about this far from the skin. */
const PALM_OFFSET = 0.02;
/** Normalized ellipsoid distance where a region starts to pull the palm, and where it takes it fully. */
const FULL_INFLUENCE = 1.3;
const NO_INFLUENCE = 2.3;
/** Palms are kept this far outside torso surfaces in normalized units, so they rest on clothing. */
const SURFACE_GAP = 1.05;
/** ardy-mini's HandEnd sits about three quarters of the way from the wrist to the knuckles. */
const PALM_FRACTION = 0.75;

const SIDES = [
  { source: 'Right', upper: 'rightUpperArm', lower: 'rightLowerArm', hand: 'rightHand', knuckle: 'rightMiddleProximal' },
  { source: 'Left', upper: 'leftUpperArm', lower: 'leftLowerArm', hand: 'leftHand', knuckle: 'leftMiddleProximal' },
] as const;

/** Measure the avatar's chest, waist and hips from the skinned mesh in its rest pose. */
export function measureAvatarBody(vrm: VRM): AvatarBody {
  vrm.humanoid.resetNormalizedPose();
  vrm.humanoid.update();
  vrm.scene.updateMatrixWorld(true);
  const regions = {} as AvatarBody;
  for (const name of Object.keys(TARGET_BONES) as TorsoRegionName[]) {
    const bone = TARGET_BONES[name].find(candidate => vrm.humanoid.getNormalizedBoneNode(candidate));
    if (!bone) throw new Error(`Avatar fitting needs a ${TARGET_BONES[name].join(' or ')} bone.`);
    const normalized = vrm.humanoid.getNormalizedBoneNode(bone)!;
    const origin = normalized.getWorldPosition(new Vector3());
    const { low, high } = bounds(collectSkinnedPoints(vrm, vrm.humanoid.getRawBoneNode(bone)!).map(point => point.sub(origin)), bone);
    regions[name] = {
      bone, center: low.clone().add(high).multiplyScalar(0.5),
      radii: high.sub(low).multiplyScalar(0.5).addScalar(PALM_OFFSET),
      restInverse: normalized.getWorldQuaternion(new Quaternion()).invert(),
    };
  }
  return regions;
}

function bounds(points: Vector3[], bone: string): { low: Vector3; high: Vector3 } {
  if (points.length < 20) throw new Error(`Avatar fitting could not find mesh bound to the ${bone} bone.`);
  const low = new Vector3(), high = new Vector3();
  for (const axis of ['x', 'y', 'z'] as const) {
    const values = points.map(point => point[axis]).sort((a, b) => a - b);
    low[axis] = values[Math.floor(values.length * 0.03)];
    high[axis] = values[Math.ceil(values.length * 0.97) - 1];
  }
  return { low, high };
}

/** Rest-pose world positions of the vertices bound mostly to the bone, clothing included. */
function collectSkinnedPoints(vrm: VRM, bone: Object3D): Vector3[] {
  const points: Vector3[] = [];
  vrm.scene.traverse(object => {
    if (!(object instanceof SkinnedMesh)) return;
    const { skinIndex, skinWeight, position } = object.geometry.attributes;
    if (!skinIndex || !skinWeight) return;
    for (let vertex = 0; vertex < position.count; vertex++) {
      let weight = 0;
      for (let slot = 0; slot < 4; slot++) {
        if (object.skeleton.bones[skinIndex.getComponent(vertex, slot)] === bone) weight += skinWeight.getComponent(vertex, slot);
      }
      if (weight >= 0.5) points.push(object.getVertexPosition(vertex, new Vector3()).applyMatrix4(object.matrixWorld));
    }
  });
  return points;
}

const measured = new WeakMap<VRM, AvatarBody>();

/** Return a copy of a normalized-rig clip whose arms reach the palm positions refitted to this avatar's body. */
export function fitHandsToAvatar(clip: AnimationClip, motion: StructuredMotionResult, vrm: VRM): AnimationClip {
  let body = measured.get(vrm);
  if (!body) {
    measured.set(vrm, body = measureAvatarBody(vrm));
    const round = (point: Vector3) => point.toArray().map(value => Number(value.toFixed(3)));
    console.info('[ardy-mini] avatar fit', JSON.stringify(Object.fromEntries(Object.entries(body).map(([name, region]) =>
      [name, { bone: region.bone, center: round(region.center), radii: round(region.radii) }]))));
  }
  const fitted = clip.clone();
  const tracks = fitted.tracks
    .filter(track => track.name.endsWith('.quaternion') || track.name.endsWith('.position'))
    .map(track => {
      const [uuid, property] = track.name.split('.');
      return { track, node: vrm.scene.getObjectByProperty('uuid', uuid), property };
    })
    .filter((entry): entry is typeof entry & { node: Object3D } => !!entry.node);
  const frames = tracks[0]?.track.times.length ?? 0;
  if (frames !== motion.frameCount) throw new Error('The clip and the generated motion have different frame counts.');
  const joints = motion.skeleton.jointNames;
  const jointCount = joints.length;
  const jointIndex = (name: string) => {
    const index = joints.indexOf(name);
    if (index < 0) throw new Error(`ardy-mini skeleton has no ${name} joint.`);
    return index;
  };
  const sourcePoint = (frame: number, name: string) => {
    const offset = (frame * jointCount + jointIndex(name)) * 3;
    return new Vector3(motion.positions[offset], motion.positions[offset + 1], motion.positions[offset + 2]);
  };
  const sourceRotation = (frame: number, name: string): Quaternion | null => {
    const track = motion.globalRotations;
    if (!track) return null;
    const offset = (frame * jointCount + jointIndex(name)) * track.shape[2];
    const v = track.values;
    if (track.format === 'quaternion-xyzw') return new Quaternion(v[offset], v[offset + 1], v[offset + 2], v[offset + 3]).normalize();
    return new Quaternion().setFromRotationMatrix(new Matrix4().set(
      v[offset], v[offset + 1], v[offset + 2], 0,
      v[offset + 3], v[offset + 4], v[offset + 5], 0,
      v[offset + 6], v[offset + 7], v[offset + 8], 0,
      0, 0, 0, 1,
    ));
  };
  const node = (name: VRMHumanBoneName) => vrm.humanoid.getNormalizedBoneNode(name);
  const worldPosition = (object: Object3D) => object.getWorldPosition(new Vector3());
  const armTracks = new Map(tracks.filter(({ property }) => property === 'quaternion').map(entry => [entry.node, entry.track]));
  const regionNames = Object.keys(body) as TorsoRegionName[];
  const head = SOURCE_REGIONS.head;

  for (let frame = 0; frame < frames; frame++) {
    for (const { track, node: target, property } of tracks) {
      if (property === 'quaternion') target.quaternion.fromArray(track.values, frame * 4);
      else target.position.fromArray(track.values, frame * 3);
    }
    vrm.scene.updateMatrixWorld(true);
    // Each region's frame follows its own skeleton's pose.
    const regions = regionNames.map(name => {
      const region = body[name];
      const bone = node(region.bone)!;
      const rotation = bone.getWorldQuaternion(new Quaternion()).multiply(region.restInverse);
      const source = SOURCE_REGIONS[name];
      const sourceFrame = sourceRotation(frame, source.joint) ?? rotation;
      return {
        name, rotation, inverse: rotation.clone().invert(),
        sourceOrigin: sourcePoint(frame, source.joint), sourceInverse: sourceFrame.clone().invert(),
        sourceCenter: new Vector3(...source.center), sourceRadii: new Vector3(...source.radii),
        targetOrigin: worldPosition(bone), targetCenter: region.center, targetRadii: region.radii,
      };
    });

    for (const arm of SIDES) {
      const upper = node(arm.upper), lower = node(arm.lower), hand = node(arm.hand);
      if (!upper || !lower || !hand) continue;
      const knuckle = node(arm.knuckle);
      const wrist = worldPosition(hand);
      const palm = knuckle ? wrist.clone().lerp(worldPosition(knuckle), PALM_FRACTION) : wrist.clone();
      const sourcePalm = sourcePoint(frame, `${arm.source}HandEnd`);

      // A hand at the face keeps its pose; the head counts toward the total without pulling.
      const headFrame = sourceRotation(frame, head.joint)?.invert() ?? regions[0].inverse;
      const atHead = sourcePalm.clone().sub(sourcePoint(frame, head.joint)).applyQuaternion(headFrame)
        .sub(new Vector3(...head.center)).divide(new Vector3(...head.radii));
      let total = 1 - MathUtils.smoothstep(atHead.length(), FULL_INFLUENCE, NO_INFLUENCE);
      const pull = new Vector3();
      for (const region of regions) {
        // Palm in the source joint's frame, then in units of the region's size.
        const normalized = sourcePalm.clone().sub(region.sourceOrigin).applyQuaternion(region.sourceInverse)
          .sub(region.sourceCenter).divide(region.sourceRadii);
        const weight = 1 - MathUtils.smoothstep(normalized.length(), FULL_INFLUENCE, NO_INFLUENCE);
        if (weight <= 0) continue;
        const target = normalized.multiply(region.targetRadii).add(region.targetCenter);
        pull.addScaledVector(target.applyQuaternion(region.rotation).add(region.targetOrigin).sub(palm), weight);
        total += weight;
      }
      if (total <= 0) continue;
      const goal = palm.clone().addScaledVector(pull, 1 / Math.max(1, total));
      for (const region of regions) {
        const inside = goal.clone().sub(region.targetOrigin).applyQuaternion(region.inverse).sub(region.targetCenter).divide(region.targetRadii);
        const distance = inside.length();
        if (distance >= SURFACE_GAP || distance < 1e-6) continue;
        goal.copy(inside.multiplyScalar(SURFACE_GAP / distance).multiply(region.targetRadii).add(region.targetCenter)
          .applyQuaternion(region.rotation).add(region.targetOrigin));
      }
      if (goal.distanceToSquared(palm) < 1e-8) continue;

      const handWorld = hand.getWorldQuaternion(new Quaternion());
      reachWithArm(upper, lower, hand, goal.sub(palm).add(wrist));
      const parentWorld = hand.parent!.getWorldQuaternion(new Quaternion());
      hand.quaternion.copy(parentWorld.invert().multiply(handWorld)).normalize();
      for (const bone of [upper, lower, hand]) armTracks.get(bone)?.values.set(bone.quaternion.toArray(), frame * 4);
    }
  }
  vrm.humanoid.resetNormalizedPose();
  vrm.scene.updateMatrixWorld(true);
  return fitted;
}

/** Two-bone IK that keeps the elbow on the side it already bends toward. */
function reachWithArm(upper: Object3D, lower: Object3D, hand: Object3D, target: Vector3): void {
  const shoulder = upper.getWorldPosition(new Vector3());
  const elbow = lower.getWorldPosition(new Vector3());
  const wrist = hand.getWorldPosition(new Vector3());
  const upperLength = shoulder.distanceTo(elbow);
  const lowerLength = elbow.distanceTo(wrist);
  const toTarget = target.clone().sub(shoulder);
  const reach = MathUtils.clamp(toTarget.length(), Math.abs(upperLength - lowerLength) + 1e-4, upperLength + lowerLength - 1e-4);
  const aim = toTarget.normalize();
  const pole = elbow.clone().sub(shoulder);
  pole.addScaledVector(aim, -pole.dot(aim));
  if (pole.lengthSq() < 1e-10) pole.set(0, -1, 0).addScaledVector(aim, aim.y);
  pole.normalize();
  const along = (upperLength ** 2 - lowerLength ** 2 + reach ** 2) / (2 * reach);
  const height = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
  turnToward(upper, lower, shoulder.clone().addScaledVector(aim, along).addScaledVector(pole, height));
  turnToward(lower, hand, shoulder.addScaledVector(aim, reach));
}

function turnToward(joint: Object3D, child: Object3D, destination: Vector3): void {
  const origin = joint.getWorldPosition(new Vector3());
  const from = child.getWorldPosition(new Vector3()).sub(origin).normalize();
  const to = destination.clone().sub(origin).normalize();
  const parentWorld = joint.parent!.getWorldQuaternion(new Quaternion());
  const delta = parentWorld.clone().invert().multiply(new Quaternion().setFromUnitVectors(from, to)).multiply(parentWorld);
  joint.quaternion.premultiply(delta).normalize();
  joint.updateMatrixWorld(true);
}
