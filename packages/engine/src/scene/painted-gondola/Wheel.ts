import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GROUND_Y, HALF_DEPTH, HALF_WIDTH, HEIGHT, HUB, WHEEL } from './layout';

/**
 * The Ferris wheel around our gondola, modelled (not painted) so the side and back windows
 * show real depth: a double-ring truss rim, truss spokes to the hub, an A-frame of legs on
 * the far side, the other gondolas hanging from the rim, and warm bulbs along the steel.
 * All steel is one InstancedMesh of unit cylinders (the stage's cel light shades it).
 */
const STEEL = '#e2d6d0';
const GONDOLA_COLORS = ['#e48c98', '#e6c271', '#7fb0d6', '#8cc49f', '#b6a0d6', '#e9a07d'];

const deg = THREE.MathUtils.degToRad;

/** Point on a circle of the wheel, `angle` degrees from the top towards -x. */
function onWheel(radius: number, angle: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(HUB.x - radius * Math.sin(deg(angle)), HUB.y + radius * Math.cos(deg(angle)), z);
}

class Struts {
  private readonly matrices: THREE.Matrix4[] = [];
  private readonly up = new THREE.Vector3(0, 1, 0);

  add(a: THREE.Vector3, b: THREE.Vector3, radius: number): void {
    const direction = b.clone().sub(a);
    const length = direction.length();
    const rotation = new THREE.Quaternion().setFromUnitVectors(this.up, direction.normalize());
    this.matrices.push(new THREE.Matrix4().compose(
      a.clone().add(b).multiplyScalar(0.5), rotation, new THREE.Vector3(radius, length, radius),
    ));
  }

  mesh(name: string, material: THREE.Material): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), material, this.matrices.length);
    mesh.name = name;
    this.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.computeBoundingSphere();
    return mesh;
  }
}

/** Bulbs: additive soft dots sized in metres, so the far rim twinkles and the near one glows. */
function bulbs(positions: THREE.Vector3[], color: string, size: number): THREE.Points {
  const geometry = new THREE.BufferGeometry().setFromPoints(positions);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uScale: { value: 700 } },
    vertexShader: /* glsl */ `
      uniform float uSize, uScale;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uSize * uScale / max(-mv.z, 0.05), 1.5, 40.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() {
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(c, c);
        if (r2 > 1.0) discard;
        gl_FragColor = vec4(uColor * (exp(-r2 * 6.0) * 1.6 + 0.25 * (1.0 - r2)), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  material.name = 'Wheel bulbs';
  const points = new THREE.Points(geometry, material);
  points.name = 'Wheel bulbs';
  points.frustumCulled = false;
  return points;
}

/** Window band of the other gondolas: dark glass catching the sunset, white frames at the corners and middle. */
function glassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 0, 0, 64);
  gradient.addColorStop(0, '#3b3355');
  gradient.addColorStop(0.55, '#8a5a6e');
  gradient.addColorStop(1, '#f3a464');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 64);
  context.fillStyle = '#efe7e2';
  for (const x of [0, 61, 122]) context.fillRect(x, 0, 6, 64);
  context.fillRect(0, 0, 128, 3);
  context.fillRect(0, 61, 128, 3);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

/** Another gondola: coloured body, glass band, white roof, and its hanger to the rim. */
function otherGondola(body: THREE.Material, glass: THREE.Material, white: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const w = HALF_WIDTH * 2 + 0.16, d = HALF_DEPTH * 2 + 0.16;
  const lower = new THREE.Mesh(new RoundedBoxGeometry(w, 1.0, d, 3, 0.12), body);
  lower.position.y = 0.5;
  const band = new THREE.Mesh(new RoundedBoxGeometry(w - 0.04, 0.9, d - 0.04, 3, 0.1), glass);
  band.position.y = 1.4;
  const roof = new THREE.Mesh(new RoundedBoxGeometry(w + 0.06, 0.32, d + 0.06, 3, 0.14), white);
  roof.position.y = HEIGHT - 0.1;
  group.add(lower, band, roof);
  return group;
}

export function buildWheel(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Ferris wheel';
  const steel = new THREE.MeshBasicMaterial({ color: STEEL, toneMapped: false, side: THREE.DoubleSide });
  const struts = new Struts();
  const lights: THREE.Vector3[] = [];
  const { radius: R, planeZ, truss } = WHEEL;
  const zFront = planeZ - truss / 2, zBack = planeZ + truss / 2;
  const inner = R - 1.3;

  // Rim: outer and inner rings on both faces, laced every 2 degrees.
  const step = 2;
  for (let a = 0; a < 360; a += step) {
    for (const z of [zFront, zBack]) {
      struts.add(onWheel(R, a, z), onWheel(R, a + step, z), 0.13);
      struts.add(onWheel(inner, a, z), onWheel(inner, a + step, z), 0.09);
      struts.add(onWheel(R, a, z), onWheel(inner, a + (a % 4 === 0 ? step : 0), z), 0.05);
    }
    struts.add(onWheel(R, a, zFront), onWheel(R, a, zBack), 0.05);
    if (a % 4 === 0) struts.add(onWheel(inner, a, zFront), onWheel(R, a + step, zBack), 0.04);
    lights.push(onWheel(R + 0.2, a, zFront), onWheel(R + 0.2, a + step / 2, zFront));
  }

  // Spokes: a pair of chords from each hub flange to the inner ring, with zig-zag lacing.
  const hubFront = new THREE.Vector3(HUB.x, HUB.y, planeZ - 2.2);
  const hubBack = new THREE.Vector3(HUB.x, HUB.y, planeZ + 2.2);
  for (let i = 0; i < WHEEL.spokes; i++) {
    const a = WHEEL.angle + 360 * (i + 0.5) / WHEEL.spokes;
    for (const [hub, z] of [[hubFront, zFront], [hubBack, zBack]] as const) {
      const tip = onWheel(inner, a, z);
      struts.add(hub, tip, 0.11);
      const lacing = 14;
      for (let k = 1; k < lacing; k++) {
        const t = k / lacing;
        const p = hub.clone().lerp(tip, t);
        const side = onWheel(inner * t, a + (k % 2 ? 4 : -4) * (1 - t * 0.6), p.z);
        struts.add(p, side, 0.035);
      }
      for (let k = 2; k < 20; k++) lights.push(hub.clone().lerp(tip, k / 20).add(new THREE.Vector3(0, 0, z < planeZ ? -0.15 : 0.15)));
    }
  }
  // A-frame legs on the far side of the wheel.
  for (const x of [-14, 14]) {
    for (const z of [planeZ + 2.2 + 3, planeZ + 2.2 + 12]) {
      struts.add(new THREE.Vector3(HUB.x, HUB.y, planeZ + 2.4), new THREE.Vector3(HUB.x + x, GROUND_Y, z), 0.7);
    }
  }
  group.add(struts.mesh('Wheel steel', steel));

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 5.2, 32), steel);
  hub.name = 'Wheel hub';
  hub.rotation.x = Math.PI / 2;
  hub.position.set(HUB.x, HUB.y, planeZ);
  group.add(hub);

  // Our own hanger: from the roof of the gondola back to the rim.
  const hanger = new Struts();
  const pivot = new THREE.Vector3(0, WHEEL.pivotY, 0);
  hanger.add(new THREE.Vector3(0, HEIGHT, 0), pivot, 0.12);
  hanger.add(pivot, new THREE.Vector3(0, WHEEL.pivotY, zBack), 0.16);
  group.add(hanger.mesh('Gondola hanger', steel));

  // The other gondolas hang the same way below their rim points.
  const white = new THREE.MeshBasicMaterial({ color: '#f7f2ec', toneMapped: false });
  const glass = new THREE.MeshBasicMaterial({ map: glassTexture(), toneMapped: false });
  glass.userData.cel = false;
  const bodies = GONDOLA_COLORS.map((color) => new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  const hangers = new Struts();
  for (let i = 1; i < WHEEL.gondolas; i++) {
    const a = WHEEL.angle + 360 * i / WHEEL.gondolas;
    const rim = onWheel(R, a, 0);
    const gondola = otherGondola(bodies[i % bodies.length], glass, white);
    gondola.position.set(rim.x, rim.y - WHEEL.pivotY, 0);
    group.add(gondola);
    hangers.add(new THREE.Vector3(rim.x, rim.y - WHEEL.pivotY + HEIGHT, 0), new THREE.Vector3(rim.x, rim.y, 0), 0.1);
    hangers.add(new THREE.Vector3(rim.x, rim.y, 0), new THREE.Vector3(rim.x, rim.y, zBack), 0.14);
  }
  group.add(hangers.mesh('Gondola hangers', steel));

  group.add(bulbs(lights, '#ffd9a0', 0.32));
  return group;
}
