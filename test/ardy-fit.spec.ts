import { expect, test } from '@playwright/test';
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { CORE27_JOINT_NAMES, CORE27_SKELETON, type StructuredMotionResult } from '../src/ai/motion/ardy/vendor/motion-data';
import { fitHandsToAvatar, measureAvatarBody } from '../src/ai/motion/ardy/fitHandsToAvatar';
import { styleMotion, styleSavedHips } from '../src/ai/motion/ardy/styleMotion';
import type { SavedMotion } from '../src/motion/engine';

const FRAMES = 4;

/** A small T-pose avatar whose hips, spine and chest are boxes of skinned vertices. */
function avatar() {
  const scene = new THREE.Group();
  const nodes: Record<string, THREE.Bone> = {};
  const bone = (name: string, parent: THREE.Object3D, x: number, y: number, z = 0) => {
    const node = new THREE.Bone();
    node.name = name;
    node.position.set(x, y, z);
    parent.add(node);
    nodes[name] = node;
    return node;
  };
  const hips = bone('hips', scene, 0, 0.8);
  const spine = bone('spine', hips, 0, 0.1);
  const chest = bone('upperChest', spine, 0, 0.2);
  bone('head', chest, 0, 0.25);
  for (const [side, sign] of [['left', 1], ['right', -1]] as const) {
    const upper = bone(`${side}UpperArm`, chest, sign * 0.12, 0.15);
    const lower = bone(`${side}LowerArm`, upper, sign * 0.22, 0);
    const hand = bone(`${side}Hand`, lower, sign * 0.2, 0);
    bone(`${side}MiddleProximal`, hand, sign * 0.08, 0);
    const upperLeg = bone(`${side}UpperLeg`, hips, sign * 0.08, -0.05);
    const lowerLeg = bone(`${side}LowerLeg`, upperLeg, 0, -0.35);
    bone(`${side}Foot`, lowerLeg, 0, -0.35);
  }
  scene.updateMatrixWorld(true);

  // Boxes of ±half extents around each torso bone, bound entirely to that bone.
  const boxes: [THREE.Bone, [number, number, number]][] = [[hips, [0.13, 0.08, 0.1]], [spine, [0.1, 0.06, 0.08]], [chest, [0.12, 0.1, 0.09]]];
  const bones = Object.values(nodes);
  const positions: number[] = [], skinIndex: number[] = [], skinWeight: number[] = [];
  for (const [owner, [hx, hy, hz]] of boxes) {
    const center = owner.getWorldPosition(new THREE.Vector3());
    for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
      positions.push(center.x + x * hx, center.y + y * hy, center.z + z * hz);
      skinIndex.push(bones.indexOf(owner), 0, 0, 0);
      skinWeight.push(1, 0, 0, 0);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  const mesh = new THREE.SkinnedMesh(geometry);
  scene.add(mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));

  const rest = new Map(bones.map(node => [node, node.position.clone()]));
  const vrm = {
    scene,
    meta: { metaVersion: '1' },
    humanoid: {
      humanBones: nodes,
      normalizedRestPose: { hips: { position: [0, 0.8, 0] } },
      getNormalizedBoneNode: (name: string) => nodes[name] ?? null,
      getRawBoneNode: (name: string) => nodes[name] ?? null,
      resetNormalizedPose: () => {
        for (const [node, position] of rest) { node.quaternion.identity(); node.position.copy(position); }
        scene.updateMatrixWorld(true);
      },
      update: () => {},
    },
  } as unknown as VRM;
  return { vrm, nodes };
}

/** A clip holding every bone at identity except the given rotations, with the hips at rest height. */
function clip(nodes: Record<string, THREE.Bone>, rotations: Record<string, THREE.Quaternion[]> = {}): THREE.AnimationClip {
  const times = Array.from({ length: FRAMES }, (_, frame) => frame / 20);
  const tracks: THREE.KeyframeTrack[] = Object.entries(nodes).map(([name, node]) => new THREE.QuaternionKeyframeTrack(
    `${node.uuid}.quaternion`, times,
    Array.from({ length: FRAMES }, (_, frame) => (rotations[name]?.[frame] ?? new THREE.Quaternion()).toArray()).flat(),
  ));
  tracks.push(new THREE.VectorKeyframeTrack(`${nodes.hips.uuid}.position`, times, times.flatMap(() => [0, 0.8, 0])));
  return new THREE.AnimationClip('test', FRAMES / 20, tracks);
}

/** A source motion that puts the palms at the given positions and keeps its joints where fitting reads them. */
function motion(rightPalm: [number, number, number], leftPalm: [number, number, number]): StructuredMotionResult {
  const joints: Record<string, [number, number, number]> = {
    Hips: [0, 0.95, 0], Spine1: [0, 1.15, 0], Spine3: [0, 1.3, -0.07], Head: [0, 1.67, -0.08],
    RightHandEnd: rightPalm, LeftHandEnd: leftPalm,
  };
  const positions = new Float32Array(FRAMES * CORE27_JOINT_NAMES.length * 3);
  for (let frame = 0; frame < FRAMES; frame++) {
    CORE27_JOINT_NAMES.forEach((name, joint) => positions.set(joints[name] ?? [0, 5, 0], (frame * CORE27_JOINT_NAMES.length + joint) * 3));
  }
  return { skeleton: CORE27_SKELETON, positions, positionsShape: [FRAMES, CORE27_JOINT_NAMES.length, 3], frameCount: FRAMES, fps: 20 };
}

function pose(vrm: VRM, animation: THREE.AnimationClip, frame: number) {
  for (const track of animation.tracks) {
    const [uuid, property] = track.name.split('.');
    const node = vrm.scene.getObjectByProperty('uuid', uuid)!;
    if (property === 'quaternion') node.quaternion.fromArray(track.values, frame * 4);
    else node.position.fromArray(track.values, frame * 3);
  }
  vrm.scene.updateMatrixWorld(true);
}

const palmOf = (nodes: Record<string, THREE.Bone>, side: 'right' | 'left') => nodes[`${side}Hand`].getWorldPosition(new THREE.Vector3())
  .lerp(nodes[`${side}MiddleProximal`].getWorldPosition(new THREE.Vector3()), 0.75);

test('measures each torso region from the mesh bound to its bone, grown by the palm offset', () => {
  const { vrm } = avatar();
  const body = measureAvatarBody(vrm);
  expect(body.hips.radii.toArray().map(value => Number(value.toFixed(3)))).toEqual([0.15, 0.1, 0.12]);
  expect(body.chest.bone).toBe('upperChest');
  expect(body.hips.center.length()).toBeLessThan(1e-6);
});

test('a palm resting on the source hip is moved out of the avatar hips onto the matching surface', () => {
  const { vrm, nodes } = avatar();
  // Hang the right arm straight down, which leaves this avatar's palm inside its own hips.
  const down = Array(FRAMES).fill(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
  const source = clip(nodes, { rightUpperArm: down });
  pose(vrm, source, 0);
  const before = palmOf(nodes, 'right');
  expect(Math.abs(before.x)).toBeLessThan(0.15);

  // ardy-mini's palm rests just outside its own hips on the right side.
  const fitted = fitHandsToAvatar(source, motion([-0.2, 0.92, 0.01], [3, 3, 3]), vrm);
  for (let frame = 0; frame < FRAMES; frame++) {
    pose(vrm, fitted, frame);
    const palm = palmOf(nodes, 'right');
    // Source palm sits at -1.05 of its hips' half width, so the avatar's palm lands at -1.05 of 0.15.
    expect(palm.x).toBeCloseTo(-0.158, 2);
    expect(palm.y).toBeCloseTo(0.8, 1);
    // The arm keeps its bone lengths.
    const shoulder = nodes.rightUpperArm.getWorldPosition(new THREE.Vector3());
    expect(shoulder.distanceTo(nodes.rightLowerArm.getWorldPosition(new THREE.Vector3()))).toBeCloseTo(0.22, 5);
    // The far-away left hand is untouched.
    expect(nodes.leftUpperArm.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-6);
  }
});

test('locking the legs holds the legs, hips rotation and height while the upper body keeps its pose', () => {
  const { vrm, nodes } = avatar();
  const turn = (angle: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
  const source = clip(nodes, {
    hips: [0, 0.1, 0.2, 0.3].map(turn),
    spine: [0, 0.05, 0.1, 0.15].map(turn),
    leftUpperLeg: [0, 0.3, 0.6, 0.9].map(turn),
  });
  (source.tracks.at(-1)!.values as Float32Array).set([0, 0.8, 0, 0, 0.78, 0, 0, 0.75, 0, 0, 0.72, 0]);
  const chestBefore: THREE.Quaternion[] = [];
  for (let frame = 0; frame < FRAMES; frame++) {
    pose(vrm, source, frame);
    chestBefore.push(nodes.upperChest.getWorldQuaternion(new THREE.Quaternion()));
  }
  const styled = styleMotion(source, vrm, { lockLegs: true });
  for (let frame = 0; frame < FRAMES; frame++) {
    pose(vrm, styled, frame);
    expect(nodes.hips.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-6);
    expect(nodes.leftUpperLeg.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-6);
    expect(nodes.hips.position.y).toBeCloseTo(0.8, 6);
    expect(nodes.upperChest.getWorldQuaternion(new THREE.Quaternion()).angleTo(chestBefore[frame])).toBeLessThan(1e-5);
  }
});

test('amplitude scales rotations toward upright with the arms lowered', () => {
  const { vrm, nodes } = avatar();
  const up = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.2);
  const lean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.4);
  const source = clip(nodes, { spine: Array(FRAMES).fill(lean), leftUpperArm: Array(FRAMES).fill(up) });
  const styled = styleMotion(source, vrm, { amplitude: 0.5 });
  pose(vrm, styled, 1);
  expect(nodes.spine.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0.2, 5);
  // Halfway between the lowered arm (-70 degrees) and the raised one (+1.2 rad).
  const lowered = THREE.MathUtils.degToRad(-70);
  const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (lowered + 1.2) / 2);
  expect(nodes.leftUpperArm.quaternion.angleTo(expected)).toBeLessThan(1e-5);
  expect(() => styleMotion(source, vrm, { amplitude: 2 })).toThrow(/Amplitude/);
});

test('saved hips follow the style: held at the first height, or scaled around rest', () => {
  const saved: SavedMotion = {
    id: 'saved:test', name: 'test', duration: 0.1, mask: '全身', times: [0, 0.05, 0.1],
    tracks: [{ bone: 'Hips', positions: [0, 100, 0, 0, 90, 0, 0, 80, 0], rotations: [] }],
  };
  expect(styleSavedHips(saved, {}, 100)).toBe(saved);
  expect(styleSavedHips(saved, { lockLegs: true }, 100).tracks[0].positions).toEqual([0, 100, 0, 0, 100, 0, 0, 100, 0]);
  expect(styleSavedHips(saved, { amplitude: 0.5 }, 100).tracks[0].positions).toEqual([0, 100, 0, 0, 95, 0, 0, 90, 0]);
});
