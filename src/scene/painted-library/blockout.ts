import * as THREE from 'three';
import { BACK_Z, CHAIR, FAR_TABLE, FRONT_Z, HEIGHT, LEFT_X, RIGHT_X, SHELF_ROW, TABLE } from './layout';

/** Grey-box version of the library, used to settle the layout and as the guide the
 * projected standees are painted over. */
const wood = new THREE.MeshLambertMaterial({ color: '#c8904e' });
const cushion = new THREE.MeshLambertMaterial({ color: '#4d6a9c' });
const shelf = new THREE.MeshLambertMaterial({ color: '#b98a58' });
const books = new THREE.MeshLambertMaterial({ color: '#8a9cb4' });

function box(parent: THREE.Object3D, material: THREE.Material, size: [number, number, number], center: [number, number, number]): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...center);
  parent.add(mesh);
}

/** Chair facing -z (its back towards +z) or +z. */
function chair(parent: THREE.Object3D, x: number, z: number, facing: 1 | -1, seat: number, top: number): void {
  const w = CHAIR.width, d = 0.42;
  box(parent, cushion, [w, 0.05, d], [x, seat, z - facing * d / 2]);
  box(parent, cushion, [w, top - seat - 0.08, 0.04], [x, (top + seat) / 2 + 0.02, z]);
  for (const sx of [-1, 1]) {
    box(parent, wood, [0.04, top, 0.04], [x + sx * (w / 2 - 0.02), top / 2, z]);
    box(parent, wood, [0.04, seat, 0.04], [x + sx * (w / 2 - 0.02), seat / 2, z - facing * (d - 0.02)]);
  }
}

function table(parent: THREE.Object3D, minX: number, maxX: number, nearZ: number, farZ: number, top: number, thickness = 0.04): void {
  const cx = (minX + maxX) / 2, cz = (nearZ + farZ) / 2, depth = nearZ - farZ;
  box(parent, wood, [maxX - minX, thickness, depth], [cx, top - thickness / 2, cz]);
  // Panel legs at both ends, as in the reference library.
  for (const x of [minX + 0.06, maxX - 0.06]) box(parent, wood, [0.04, top - thickness, depth - 0.12], [x, (top - thickness) / 2, cz]);
}

export function farTableSet(): THREE.Group {
  const group = new THREE.Group();
  const { minX, maxX, z, depth, height, chairTop } = FAR_TABLE;
  table(group, minX, maxX, z + depth / 2, z - depth / 2, height);
  for (const t of [0.27, 0.73]) {
    const x = THREE.MathUtils.lerp(minX, maxX, t);
    chair(group, x, z + depth / 2 + 0.3, 1, 0.44, chairTop);
    chair(group, x, z - depth / 2 - 0.3, -1, 0.44, chairTop);
  }
  return group;
}

export function buildLibraryBlockout(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Library blockout';
  const width = RIGHT_X - LEFT_X, depth = BACK_Z - FRONT_Z, cx = (LEFT_X + RIGHT_X) / 2, cz = (FRONT_Z + BACK_Z) / 2;
  const flat = (color: string) => new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  const plane = (material: THREE.Material, w: number, h: number, p: [number, number, number], r: [number, number, number]) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(...p);
    mesh.rotation.set(...r);
    group.add(mesh);
  };
  plane(flat('#cfd3d8'), width, depth, [cx, 0, cz], [-Math.PI / 2, 0, 0]);
  plane(flat('#f0f0f0'), width, depth, [cx, HEIGHT, cz], [Math.PI / 2, 0, 0]);
  plane(flat('#e6e1d8'), width, HEIGHT, [cx, HEIGHT / 2, FRONT_Z], [0, 0, 0]);
  plane(flat('#aecde8'), depth, HEIGHT, [LEFT_X, HEIGHT / 2, cz], [0, Math.PI / 2, 0]);
  plane(flat('#e6e1d8'), depth, HEIGHT, [RIGHT_X, HEIGHT / 2, cz], [0, -Math.PI / 2, 0]);
  // Wall shelves on the far and right walls, low shelves under the windows.
  box(group, books, [width - 1.2, 2.2, 0.3], [cx + 0.6, 1.1, FRONT_Z + 0.15]);
  box(group, books, [0.3, 2.2, depth - 2], [RIGHT_X - 0.15, 1.1, cz]);
  box(group, shelf, [0.3, 0.9, depth - 1], [LEFT_X + 0.15, 0.45, cz]);
  // Shelf row behind Shion.
  box(group, books, [SHELF_ROW.maxX - SHELF_ROW.minX, SHELF_ROW.height, 0.5], [(SHELF_ROW.minX + SHELF_ROW.maxX) / 2, SHELF_ROW.height / 2, SHELF_ROW.z]);
  group.add(farTableSet());
  table(group, TABLE.minX, TABLE.maxX, TABLE.nearZ, TABLE.farZ, TABLE.top, TABLE.thickness);
  chair(group, CHAIR.x, CHAIR.z, -1, CHAIR.seat, CHAIR.top);
  return group;
}
