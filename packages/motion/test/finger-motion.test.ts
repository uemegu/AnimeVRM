import * as THREE from 'three';
import { expect, test } from 'vitest';
import { FingerMotionService, parseFingerMotion, applyFingerMotion, FINGER_MOTION_OPTIONS } from '../src/FingerMotion';

/** 指のボーンだけを持つ最小の VRM */
function fingerRig() {
  const scene = new THREE.Scene();
  const bones = new Map<string, THREE.Bone>();
  for (const side of ['right', 'left']) {
    for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Little']) {
      const segments = finger === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'];
      for (const segment of segments) {
        const bone = new THREE.Bone();
        scene.add(bone);
        bones.set(side + finger + segment, bone);
      }
    }
  }
  const wrist = new THREE.Bone();
  scene.add(wrist);
  bones.set('rightHand', wrist);
  const vrm = { scene, meta: { metaVersion: '1' }, humanoid: { getNormalizedBoneNode: (name: string) => bones.get(name) ?? null } };
  return { vrm: vrm as never, bones, wrist, scene };
}

test('指の形はプリセットどおりになり、1秒で形になって保ち、ほかのボーンは変えない', async () => {
  const { vrm, bones, wrist, scene } = fingerRig();
  const service = new FingerMotionService();
  const identity = new THREE.Quaternion();
  const openByPose: Record<string, string[]> = {
    index: ['Index'], peace: ['Index', 'Middle'], thumb: ['Thumb'], fist: [],
    open: ['Thumb', 'Index', 'Middle', 'Ring', 'Little'], three: ['Index', 'Middle', 'Ring'],
  };
  for (const { id } of FINGER_MOTION_OPTIONS) {
    const targets = await service.createTargets({ right: id, left: id }, vrm);
    expect(targets).toHaveLength(30);
    for (const target of targets) {
      const open = openByPose[id].some((finger) => target.bone.includes(finger));
      expect(target.rotation.angleTo(identity)).toBeCloseTo(open ? 0 : target.bone.includes('Thumb') ? 0.55 : 1.25, 3);
    }
  }

  const selection = parseFingerMotion({ right: { peace: 'YES', index: 'NO' }, left: { open: 'NO' } });
  const targets = await service.createTargets(selection, vrm);
  const mirrored = await service.createTargets(selection, { ...(vrm as object), meta: { metaVersion: '0' } } as never);
  targets.forEach((target, i) => {
    const q = target.rotation.clone();
    q.x *= -1;
    q.z *= -1;
    expect(q.angleTo(mirrored[i].rotation)).toBeLessThan(0.001);
  });

  const ring = bones.get('rightRingProximal')!;
  ring.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.2);
  const before = ring.quaternion.clone();
  const target = targets.find((t) => t.bone === 'rightRingProximal')!.rotation;
  const thumb = bones.get('rightThumbMetacarpal')!;
  const leftIndex = bones.get('leftIndexProximal')!;
  const wristQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4);
  const leftQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.3);
  const clip = new THREE.AnimationClip('body', 4, [
    new THREE.QuaternionKeyframeTrack(wrist.uuid + '.quaternion', [0, 4], [...wristQ.toArray(), ...wristQ.toArray()]),
    new THREE.QuaternionKeyframeTrack(thumb.uuid + '.quaternion', [0, 4], [...wristQ.toArray(), ...wristQ.toArray()]),
    new THREE.QuaternionKeyframeTrack(leftIndex.uuid + '.quaternion', [0, 4], [...leftQ.toArray(), ...leftQ.toArray()]),
  ]);
  applyFingerMotion(clip, vrm, targets);
  const mixer = new THREE.AnimationMixer(scene);
  mixer.clipAction(clip).play();
  mixer.update(0);
  expect(ring.quaternion.angleTo(before)).toBeLessThan(0.001);
  mixer.update(0.5);
  expect(ring.quaternion.angleTo(before.clone().slerp(target, 0.5))).toBeLessThan(0.001);
  mixer.update(0.5);
  expect(ring.quaternion.angleTo(target)).toBeLessThan(0.001);
  mixer.update(1);
  expect(ring.quaternion.angleTo(target)).toBeLessThan(0.001);
  expect(wrist.quaternion.angleTo(wristQ)).toBeLessThan(0.001);
  expect(leftIndex.quaternion.angleTo(leftQ)).toBeLessThan(0.001);
  expect(clip.tracks.filter((track) => track.name === thumb.uuid + '.quaternion')).toHaveLength(1);

  // 矛盾する指定は受け付けない。指定がなければクリップを変えない
  expect(() => parseFingerMotion({ right: { peace: 'YES', index: 'YES' } })).toThrow();
  expect(() => parseFingerMotion({ right: { peace: 'MAYBE' } })).toThrow();
  const trackCount = clip.tracks.length;
  applyFingerMotion(clip, vrm, await service.createTargets(parseFingerMotion({ right: { peace: 'NO' } }), vrm));
  expect(clip.tracks.length).toBe(trackCount);
});
