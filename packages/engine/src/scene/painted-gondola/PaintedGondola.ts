import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { resolveAssetUrl } from '../../utils/path';
import { castShadows } from '../castShadows';
import { BENCH, CORNER, DOOR, FRAME, HALF_DEPTH, HALF_WIDTH, HANDRAIL, HEIGHT, SILL, WINDOW_TOP } from './layout';
import { buildPanorama } from './Panorama';
import { buildWheel } from './Wheel';

/**
 * Painted 2.5D Ferris wheel gondola at sunset: a steel cabin with windows on all four
 * sides and two facing benches, hanging from a modelled wheel, with the amusement park,
 * the bay and the town as a painted panorama all around. Window panes are open (no glass),
 * so the sky is the viewer's SkyBackground. Layout and units: see layout.ts.
 */
const TEXTURE_DIR = '/textures/painted-gondola';

async function texture(file: string): Promise<THREE.Texture> {
  const map = await new THREE.TextureLoader().loadAsync(resolveAssetUrl(`${TEXTURE_DIR}/${file}`));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

/** Box whose UVs are in metres / tile, so a seamless texture keeps its size on every part. */
function tiledBox(size: [number, number, number], tile: number): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(...size);
  const uv = geometry.getAttribute('uv');
  const [x, y, z] = size;
  // Face order +x, -x, +y, -y, +z, -z; each face's (u, v) extents in metres.
  const faces: [number, number][] = [[z, y], [z, y], [x, z], [x, z], [x, y], [x, y]];
  faces.forEach(([w, h], face) => {
    for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
  });
  return geometry;
}

function box(name: string, material: THREE.Material, size: [number, number, number],
  position: [number, number, number], tile = 1): THREE.Mesh {
  const mesh = new THREE.Mesh(tiledBox(size, tile), material);
  mesh.name = name;
  mesh.position.set(...position);
  return mesh;
}

/** Ventilation grille: dark slats on steel. */
function grilleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#b9a8a4';
  context.fillRect(0, 0, 128, 64);
  context.fillStyle = '#2c2433';
  context.fillRect(6, 6, 116, 52);
  context.fillStyle = '#8f7f86';
  for (let y = 10; y < 56; y += 7) context.fillRect(8, y, 112, 2);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

/**
 * The cabin: floor, ceiling, steel walls below the sills and above the window heads,
 * corner pillars and window frames. Returns the frame members that cast the window-bar
 * shadows separately (the walls themselves cast nothing: their shadow would fall outside).
 */
function cabin(steel: THREE.Material, floorMap: THREE.Texture, grille: THREE.Material): { shell: THREE.Group; frames: THREE.Group } {
  const shell = new THREE.Group();
  shell.name = 'Cabin';
  const frames = new THREE.Group();
  frames.name = 'Window frames';
  const W = HALF_WIDTH * 2, D = HALF_DEPTH * 2, T = 0.06;

  floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping;
  floorMap.repeat.set(W, D);
  const floorMaterial = new THREE.MeshBasicMaterial({ map: floorMap, toneMapped: false });
  floorMaterial.userData.cel = false;
  shell.add(box('Floor', floorMaterial, [W + 2 * T, 0.1, D + 2 * T], [0, -0.05, 0], 1));
  shell.add(box('Roof', steel, [W + 2 * T, 0.12, D + 2 * T], [0, HEIGHT + 0.06, 0]));

  const header = HEIGHT - WINDOW_TOP;
  for (const z of [-1, 1]) {
    shell.add(box('End wall', steel, [W, SILL.front, T], [0, SILL.front / 2, z * (HALF_DEPTH + T / 2)]));
    shell.add(box('End header', steel, [W, header, T], [0, WINDOW_TOP + header / 2, z * (HALF_DEPTH + T / 2)]));
  }
  for (const x of [-1, 1]) {
    shell.add(box('Side wall', steel, [T, SILL.side, D], [x * (HALF_WIDTH + T / 2), SILL.side / 2, 0]));
    shell.add(box('Side header', steel, [T, header, D], [x * (HALF_WIDTH + T / 2), WINDOW_TOP + header / 2, 0]));
  }
  // Vents in the front header, as in the painting.
  for (const x of [-0.42, 0.42]) {
    const vent = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.1), grille);
    vent.name = 'Vent';
    vent.position.set(x, WINDOW_TOP + header * 0.55, -HALF_DEPTH + 0.002);
    shell.add(vent);
  }

  // Chamfered corner columns, sill ledges, head rails and the side mullions.
  for (const x of [-1, 1]) for (const z of [-1, 1]) frames.add(cornerColumn(steel, x, z));
  for (const z of [-1, 1]) {
    shell.add(box('End sill', steel, [W, FRAME, 0.1], [0, SILL.front + FRAME / 2, z * (HALF_DEPTH - 0.02)]));
    frames.add(box('End head', steel, [W, FRAME, 0.08], [0, WINDOW_TOP - FRAME / 2, z * (HALF_DEPTH - 0.01)]));
  }
  for (const x of [-1, 1]) {
    shell.add(box('Side sill', steel, [0.1, FRAME, D], [x * (HALF_WIDTH - 0.02), SILL.side + FRAME / 2, 0]));
    frames.add(box('Side head', steel, [0.08, FRAME, D], [x * (HALF_WIDTH - 0.01), WINDOW_TOP - FRAME / 2, 0]));
  }
  // The left side window is split by a mullion; the right side holds the door.
  frames.add(box('Side mullion', steel, [0.06, WINDOW_TOP - SILL.side, 0.07], [-(HALF_WIDTH + 0.01), (WINDOW_TOP + SILL.side) / 2, 0]));
  frames.add(door(steel));
  return { shell, frames };
}

/** Bench against the wall at z = side * HALF_DEPTH: steel base, seat and back cushions. */
function bench(side: -1 | 1, steel: THREE.Material, cushion: THREE.Material, grille: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = side < 0 ? 'Front bench' : 'Back bench';
  const width = HALF_WIDTH * 2 - 0.02;
  // Built facing +z at the -z wall, then turned for the back wall.
  const wall = -HALF_DEPTH;
  const baseDepth = BENCH.depth - 0.04;
  group.add(box('Bench base', steel, [width, BENCH.seat, baseDepth], [0, BENCH.seat / 2, wall + baseDepth / 2]));
  for (const x of [-0.82, 0.82]) {
    const vent = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), grille);
    vent.name = 'Bench vent';
    vent.position.set(x, BENCH.seat * 0.45, wall + baseDepth + 0.002);
    group.add(vent);
  }
  const seat = new THREE.Mesh(new RoundedBoxGeometry(width, BENCH.cushion + 0.02, BENCH.depth, 3, 0.035), cushion);
  seat.name = 'Seat cushion';
  seat.position.set(0, BENCH.seat + BENCH.cushion / 2 - 0.01, wall + BENCH.depth / 2);
  group.add(seat);
  const backBottom = BENCH.seat + BENCH.cushion;
  const backHeight = BENCH.backTop - backBottom;
  const back = new THREE.Mesh(new RoundedBoxGeometry(width, backHeight, BENCH.backThickness, 3, 0.035), cushion);
  back.name = 'Back cushion';
  back.position.set(0, backBottom + backHeight / 2, wall + BENCH.backThickness / 2 + 0.02);
  back.rotation.x = -0.08;
  group.add(back);
  if (side > 0) group.rotation.y = Math.PI;
  return group;
}

/**
 * The door in the right side wall (seen from inside): two door posts, the steel leaf panel up
 * to the sill with its window frame above, the dark gap round the leaf, hinges, a latch
 * lever and the threshold. The glass is left open like the other windows.
 */
function door(steel: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Door';
  const hw = DOOR.halfWidth, wall = HALF_WIDTH;
  const gap = new THREE.MeshBasicMaterial({ color: '#2a2230', toneMapped: false });
  const dark = new THREE.MeshBasicMaterial({ color: '#6d6170', toneMapped: false });
  for (const sz of [-1, 1]) {
    group.add(box('Door post', steel, [DOOR.postDepth, WINDOW_TOP, DOOR.post],
      [wall + 0.03 - DOOR.postDepth / 2, WINDOW_TOP / 2, sz * (hw + DOOR.post / 2)]));
    // Leaf stiles round the door window, and the gap between leaf and post.
    group.add(box('Door stile', steel, [0.04, WINDOW_TOP - SILL.side, 0.04], [wall - 0.015, (WINDOW_TOP + SILL.side) / 2, sz * (hw - 0.025)]));
    group.add(box('Door gap', gap, [0.004, WINDOW_TOP, 0.008], [wall - DOOR.postDepth + 0.03 + 0.002, WINDOW_TOP / 2, sz * (hw - 0.002)]));
  }
  group.add(box('Door leaf', steel, [0.02, SILL.side, hw * 2 - 0.01], [wall - 0.01, SILL.side / 2, 0]));
  group.add(box('Door top rail', steel, [0.04, 0.04, hw * 2], [wall - 0.015, WINDOW_TOP - 0.02, 0]));
  for (const y of [0.3, 1.55]) {
    const hinge = along(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 12), steel, new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(wall - 0.035, y, hw - 0.006), 'Door hinge');
    group.add(hinge);
  }
  // Latch lever on the -z edge.
  group.add(box('Latch plate', dark, [0.012, 0.12, 0.04], [wall - 0.026, 0.62, -(hw - 0.07)]));
  group.add(box('Latch lever', steel, [0.03, 0.022, 0.11], [wall - 0.045, 0.64, -(hw - 0.11)]));
  group.add(box('Threshold', dark, [0.12, 0.014, hw * 2], [wall - 0.06, 0.007, 0]));
  return group;
}

/** Tube with UVs in metres (u round the tube, v along it), so the steel tile keeps its size. */
function tube(radius: number, length: number): THREE.CylinderGeometry {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 24, 1, true);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * radius, uv.getY(i) * length);
  return geometry;
}

/**
 * Diagonal steel column across the corner (sx, sz): its inner face is the line
 * sx * x + sz * z = HALF_WIDTH + HALF_DEPTH - CORNER.leg, from the side wall to the end wall.
 */
function cornerColumn(steel: THREE.Material, sx: number, sz: number): THREE.Mesh {
  const width = CORNER.leg * Math.SQRT2 + 0.08;
  const column = box('Corner column', steel, [width, HEIGHT, CORNER.thickness], [
    sx * (HALF_WIDTH - CORNER.leg / 2) + sx * CORNER.thickness / 2 / Math.SQRT2,
    HEIGHT / 2,
    sz * (HALF_DEPTH - CORNER.leg / 2) + sz * CORNER.thickness / 2 / Math.SQRT2,
  ]);
  // Local x runs along the chamfer, from (sx * W, sz * (D - leg)) towards (sx * (W - leg), sz * D).
  column.rotation.y = Math.atan2(-sz, -sx);
  return column;
}

/** Steel part along `axis` (unit), centred at `at`. */
function along(geometry: THREE.BufferGeometry, steel: THREE.Material, axis: THREE.Vector3, at: THREE.Vector3, name: string): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, steel);
  mesh.name = name;
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  mesh.position.copy(at);
  return mesh;
}

/**
 * Handrails across both side windows, the same steel as the walls (as in the painting):
 * each end butts onto the inner face of a corner column with a round foot plate, and in
 * the middle a clamp holds it to the window mullion. On the door side the rail stops at
 * the door posts and the leaf carries its own grab bar.
 */
function handrails(steel: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Handrails';
  const { y, standoff, radius } = HANDRAIL;
  // Where the rail line meets the corner columns' inner faces.
  const endZ = HALF_DEPTH - CORNER.leg + standoff;
  const mullionFace = HALF_WIDTH + 0.01 - 0.03;
  const foot = (at: THREE.Vector3, normal: THREE.Vector3) => along(
    new THREE.CylinderGeometry(radius * 1.9, radius * 1.9, 0.012, 24), steel, normal,
    at.clone().addScaledVector(normal, -0.006), 'Handrail foot');
  const zAxis = new THREE.Vector3(0, 0, 1);

  // Left: one rail from corner column to corner column, clamped to the mullion.
  const leftX = -(HALF_WIDTH - standoff);
  group.add(along(tube(radius, endZ * 2), steel, zAxis, new THREE.Vector3(leftX, y, 0), 'Handrail'));
  for (const sz of [-1, 1]) group.add(foot(new THREE.Vector3(leftX, y, sz * endZ), new THREE.Vector3(-1, 0, sz).normalize()));
  group.add(along(new THREE.CylinderGeometry(radius * 1.35, radius * 1.35, 0.05, 24), steel, zAxis,
    new THREE.Vector3(leftX, y, 0), 'Handrail clamp'));
  const arm = mullionFace - Math.abs(leftX) + 0.01;
  group.add(along(new THREE.BoxGeometry(0.025, arm, 0.03), steel, new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(-(Math.abs(leftX) + arm / 2), y, 0), 'Handrail clamp arm'));

  // Right: the door breaks the rail. A rail from each corner column to its door post,
  // and a grab bar on the door leaf held by short arms on its stiles.
  const rightX = HALF_WIDTH - standoff;
  const postZ = DOOR.halfWidth + DOOR.post;
  for (const sz of [-1, 1]) {
    const length = endZ - postZ;
    group.add(along(tube(radius, length), steel, zAxis, new THREE.Vector3(rightX, y, sz * (postZ + length / 2)), 'Handrail'));
    group.add(foot(new THREE.Vector3(rightX, y, sz * endZ), new THREE.Vector3(1, 0, sz).normalize()));
    group.add(foot(new THREE.Vector3(rightX, y, sz * postZ), new THREE.Vector3(0, 0, -sz)));
  }
  const barZ = DOOR.halfWidth - 0.025;
  group.add(along(tube(radius * 0.9, barZ * 2), steel, zAxis, new THREE.Vector3(rightX, y, 0), 'Door grab bar'));
  const stileFace = HALF_WIDTH - 0.035;
  for (const sz of [-1, 1]) {
    const reach = stileFace - rightX + 0.005;
    group.add(along(new THREE.BoxGeometry(0.022, reach, 0.026), steel, new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(rightX + reach / 2, y, sz * barZ), 'Door grab bar arm'));
  }
  return group;
}

export async function loadPaintedGondola(): Promise<THREE.Group> {
  const [[steelMap, cushionMap, floorMap, groundMap, ...panorama], seaMask] = await Promise.all([
    Promise.all(['steel.avif', 'cushion.avif', 'floor.avif', 'ground.avif', 'pano-0.avif', 'pano-1.avif', 'pano-2.avif', 'pano-3.avif'].map(texture)),
    // Data, not colour: the water mask and the waterline rows (Panorama.ts).
    new THREE.TextureLoader().loadAsync(resolveAssetUrl(`${TEXTURE_DIR}/sea-mask.avif`)),
  ]);
  const group = new THREE.Group();
  group.name = 'Painted gondola';

  steelMap.wrapS = steelMap.wrapT = THREE.RepeatWrapping;
  // Slightly dimmed so the painted reflections stay below the bloom threshold.
  const steel = new THREE.MeshBasicMaterial({ map: steelMap, color: '#ddd3d8', toneMapped: false });
  cushionMap.wrapS = cushionMap.wrapT = THREE.RepeatWrapping;
  cushionMap.repeat.set(3, 1);
  const cushion = new THREE.MeshBasicMaterial({ map: cushionMap, toneMapped: false });
  const grille = new THREE.MeshBasicMaterial({ map: grilleTexture(), toneMapped: false });
  grille.userData.cel = false;

  const { shell, frames } = cabin(steel, floorMap, grille);
  group.add(shell);
  // The window bars, benches and rails throw the streaks of sunset light across the floor.
  group.add(castShadows(frames));
  group.add(castShadows(bench(-1, steel, cushion, grille)));
  group.add(castShadows(bench(1, steel, cushion, grille)));
  group.add(castShadows(handrails(steel)));

  group.add(buildWheel());
  group.add(buildPanorama(panorama, groundMap, seaMask));
  return group;
}

export function disposePaintedGondola(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      const map = (material as THREE.MeshBasicMaterial).map;
      if (map) textures.add(map);
    }
  });
  group.removeFromParent();
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((map) => map.dispose());
}
