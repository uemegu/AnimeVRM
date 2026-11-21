import * as THREE from 'three';

import { createFan } from './fan';

/** 吹き出し口から前方に広がり、縁と遠方で弱まる風。 */
export function createWindLane(scene: THREE.Scene, start: THREE.Vector3, heading: number) {
  const length = 5.6;
  const lane = new THREE.Group();
  lane.rotation.y = heading;
  lane.position.copy(start);
  lane.translateX(-1.65);
  const { frame, rotor } = createFan();
  frame.rotation.y = Math.PI / 2;
  lane.add(frame);
  scene.add(lane);

  // 二つ折りの葉を一度に描く。端では小さくして、次の葉への切り替わりを隠す。
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.045, 0, 0,  0, 0, -0.019,  0.048, 0, 0,
    0, 0, 0.019,  0, 0.009, 0,
  ], 3));
  geometry.setIndex([0, 4, 1, 1, 4, 2, 2, 4, 3, 3, 4, 0]);
  geometry.computeVertexNormals();
  const count = 32;
  const leaves = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), count);
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  leaves.frustumCulled = false;
  lane.add(leaves);
  const colors = [0xb69b52, 0x91aa55, 0xdfb665, 0x799441];
  for (let i = 0; i < count; i++) leaves.setColorAt(i, new THREE.Color(colors[i % colors.length]));

  const cs = Math.cos(heading), sn = Math.sin(heading);
  const wind = { direction: { x: cs, y: 0.06, z: -sn }, strength: 0, gust: 0 };
  const leaf = new THREE.Object3D();
  let time = 0, travel = 0, motorSpeed = 2;
  // 突風（gust()）：0.25 秒で強まり、1.6 秒吹いて、1.2 秒で収まる。送風機の風に足す
  let gustAt = -Infinity;
  const GUST_SPEED = 14, GUST_RISE = 0.25, GUST_HOLD = 1.6, GUST_FALL = 1.2;
  const gustEnvelope = () => {
    const t = time - gustAt;
    if (t < 0 || t > GUST_RISE + GUST_HOLD + GUST_FALL) return 0;
    if (t < GUST_RISE) return THREE.MathUtils.smoothstep(t, 0, GUST_RISE);
    if (t < GUST_RISE + GUST_HOLD) return 1;
    return 1 - THREE.MathUtils.smoothstep(t, GUST_RISE + GUST_HOLD, GUST_RISE + GUST_HOLD + GUST_FALL);
  };
  const sample = (dt: number, position: THREE.Vector3, baseSpeed: number) => {
    time += dt;
    const targetSpeed = baseSpeed + GUST_SPEED * gustEnvelope();
    // 同じ突風を葉・髪・スカート・上着に渡す。立ち止まっても風は吹き過ぎていく。
    const swell = 0.65 * Math.sin(time * 2.15) + 0.35 * Math.sin(time * 3.7 + 0.8);
    motorSpeed += (targetSpeed - motorSpeed) * (1 - Math.exp(-dt * 3));
    const speed = motorSpeed * (1 + (targetSpeed >= 15 ? 0.55 : 0.22) * swell);
    rotor.rotation.z -= dt * motorSpeed * 2.4;
    const turn = 0.24 * Math.sin(time * 1.65);
    const lift = 0.16 + 0.15 * swell;
    travel += dt * speed / 4;
    for (let i = 0; i < count; i++) {
      const phase = (i * 0.618034 + travel * (0.21 + (i % 5) * 0.016)) % 1;
      const flutter = time * 2.4 + i * 2.7;
      leaf.position.set(0.22 + phase * length,
        0.24 + (i % 7) * 0.09 + (0.13 + lift * 0.2) * Math.sin(flutter),
        Math.sin(i * 8.1) * 0.68 + 0.12 * Math.cos(flutter) + 0.3 * turn);
      leaf.rotation.set(flutter, 0.4 * Math.sin(flutter), 0.4 * Math.cos(flutter));
      leaf.scale.setScalar(THREE.MathUtils.smoothstep(Math.min(phase, 1 - phase), 0, 0.09));
      leaf.updateMatrix();
      leaves.setMatrixAt(i, leaf.matrix);
    }
    leaves.instanceMatrix.needsUpdate = true;

    const dx = position.x - lane.position.x, dz = position.z - lane.position.z;
    const along = dx * cs - dz * sn, across = dx * sn + dz * cs;
    const direction = heading + turn;
    wind.direction.x = Math.cos(direction);
    wind.direction.z = -Math.sin(direction);
    wind.direction.y = lift;
    const halfWidth = 0.73 + 0.12 * Math.max(0, along);
    wind.strength = speed / 20 * THREE.MathUtils.smoothstep(along - 0.17, 0, 0.18)
      * THREE.MathUtils.smoothstep(length - along, 0, 1.5)
      * THREE.MathUtils.smoothstep(halfWidth - Math.abs(across), 0, 0.45);
    return wind.strength > 0 ? wind : null;
  };
  return Object.assign(sample, { gust: () => { gustAt = time; }, get gusting() { return gustEnvelope() > 0; } });
}
