import * as THREE from 'three';
import { CHAIR, DESK, DESK_COLUMNS_X, DESK_ROWS_Z, ROW_IMAGE_SIZE, rowCamera } from './layout';

/** Grey-box desks and chairs of one row, rendered from that row's projection camera. */
const row = Number(new URLSearchParams(location.search).get('row') ?? 1);
const z = DESK_ROWS_Z[row - 1];
const canvas = document.querySelector('canvas')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(...ROW_IMAGE_SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#d8d8d8');
scene.add(new THREE.HemisphereLight('#ffffff', '#777777', 1.6));
const sun = new THREE.DirectionalLight('#fff3e0', 2.2);
sun.position.set(-4, 3, 1);
scene.add(sun);

const wood = new THREE.MeshLambertMaterial({ color: '#c8904e' });
const steel = new THREE.MeshLambertMaterial({ color: '#7d8a9c' });
const box = (material: THREE.Material, size: [number, number, number], center: [number, number, number]) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...center);
  scene.add(mesh);
};
for (const x of DESK_COLUMNS_X) {
  // Desk: top, book tray, four legs.
  const deskZ = z + DESK.backZ + DESK.depth / 2;
  box(wood, [DESK.width, 0.03, DESK.depth], [x, DESK.height - 0.015, deskZ]);
  box(steel, [DESK.width - 0.06, 0.1, DESK.depth - 0.08], [x, DESK.height - 0.1, deskZ]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(steel, [0.025, DESK.height - 0.03, 0.025], [x + sx * (DESK.width / 2 - 0.03), (DESK.height - 0.03) / 2, deskZ + sz * (DESK.depth / 2 - 0.03)]);
  }
  // Chair: back panel on the camera side, seat, four legs.
  const seatZ = z - 0.2;
  box(wood, [CHAIR.width, 0.03, 0.38], [x, CHAIR.seat, seatZ]);
  box(wood, [CHAIR.width, 0.2, 0.02], [x, CHAIR.top - 0.1, z]);
  for (const sx of [-1, 1]) {
    box(steel, [0.022, CHAIR.top, 0.022], [x + sx * (CHAIR.width / 2 - 0.02), CHAIR.top / 2, z]);
    box(steel, [0.022, CHAIR.seat, 0.022], [x + sx * (CHAIR.width / 2 - 0.02), CHAIR.seat / 2, z - 0.37]);
  }
}
renderer.render(scene, rowCamera(z));
document.body.dataset.ready = 'true';
