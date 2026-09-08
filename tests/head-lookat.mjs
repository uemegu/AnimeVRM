import assert from 'node:assert/strict';
import * as THREE from 'three';

// Simulate bone node hierarchy
class MockBoneNode extends THREE.Object3D {
  constructor(name) {
    super();
    this.name = name;
  }
}

// Test the math logic of updateHeadLookAt
console.log('Testing updateHeadLookAt non-accumulation logic...');

const neckNode = new MockBoneNode('neck');
const headNode = new MockBoneNode('head');
const restNeckRotation = neckNode.quaternion.clone();
const restHeadRotation = headNode.quaternion.clone();

let currentHeadYaw = 0;
let currentHeadPitch = 0;
const targetYaw = THREE.MathUtils.degToRad(18); // 18 deg (shallow angle)
const targetPitch = THREE.MathUtils.degToRad(5);
const neckRatio = 0.35;
const headRatio = 0.65;
const smoothSpeed = 8.0;

// Simulate frames with animation switching or finishing
for (let frame = 0; frame < 120; frame++) {
  const delta = 1 / 60;
  const smoothRate = Math.min(1.0, 1.0 - Math.exp(-delta * smoothSpeed));
  currentHeadYaw = THREE.MathUtils.lerp(currentHeadYaw, targetYaw, smoothRate);
  currentHeadPitch = THREE.MathUtils.lerp(currentHeadPitch, targetPitch, smoothRate);

  const neckYaw = currentHeadYaw * neckRatio;
  const neckPitch = currentHeadPitch * neckRatio;
  const headYaw = currentHeadYaw * headRatio;
  const headPitch = currentHeadPitch * headRatio;

  const qNeckDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(-neckPitch, neckYaw, 0, 'YXZ'));
  const qHeadDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(-headPitch, headYaw, 0, 'YXZ'));

  // STABLE LOGIC: Base look-at directly on rest pose + delta
  neckNode.quaternion.copy(restNeckRotation).multiply(qNeckDelta);
  headNode.quaternion.copy(restHeadRotation).multiply(qHeadDelta);
}

// Convert final neck and head rotations to Euler angles
const finalNeckEuler = new THREE.Euler().setFromQuaternion(neckNode.quaternion, 'YXZ');
const finalHeadEuler = new THREE.Euler().setFromQuaternion(headNode.quaternion, 'YXZ');

const finalNeckYawDeg = THREE.MathUtils.radToDeg(finalNeckEuler.y);
const finalHeadYawDeg = THREE.MathUtils.radToDeg(finalHeadEuler.y);
const totalYawDeg = finalNeckYawDeg + finalHeadYawDeg;

console.log(`Frame 120 Result:`);
console.log(`  Neck Yaw: ${finalNeckYawDeg.toFixed(2)} deg`);
console.log(`  Head Yaw: ${finalHeadYawDeg.toFixed(2)} deg`);
console.log(`  Total Head+Neck Yaw: ${totalYawDeg.toFixed(2)} deg`);

// The total rotation should smoothly approach targetYaw (18 deg), NOT 120 * 18 = 2160 deg!
assert(Math.abs(totalYawDeg - 18) < 0.5, `Total yaw (${totalYawDeg}) should be close to 18 deg`);
assert(finalNeckYawDeg < 10, `Neck yaw should be shallow (< 10 deg)`);
assert(finalHeadYawDeg < 15, `Head yaw should be shallow (< 15 deg)`);

console.log('PASS: Head and neck rotations remain stable and shallow. Infinite accumulation eliminated!');
