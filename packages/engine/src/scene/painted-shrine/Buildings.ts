import * as THREE from 'three';
import { HAIDEN, HONDEN } from './layout';
import { beam, box, cylinder, polygon, shimenawa, type ShrineMaterials } from './geometry';

type Roof = { hx: number; hz: number; eaveY: number; ridgeY: number };

/** Board edges, rafter tails and soffit shared by every roof: gives the eaves real thickness. */
function eaves(group: THREE.Group, m: ShrineMaterials, r: Roof, body: { x: number; z: number }, rafters: boolean): void {
  box(group, 'Eave soffit boards', [r.hx * 2, 0.1, r.hz * 2], [0, r.eaveY - 0.06, 0], m.darkWood);
  for (const s of [-1, 1]) {
    box(group, 'Eave fascia', [r.hx * 2 + 0.12, 0.26, 0.12], [0, r.eaveY - 0.04, s * r.hz], m.wood);
    box(group, 'Eave fascia', [0.12, 0.26, r.hz * 2 + 0.12], [s * r.hx, r.eaveY - 0.04, 0], m.wood);
  }
  if (!rafters) return;
  const tail = (r.hz - body.z) + 0.05, side = (r.hx - body.x) + 0.05;
  for (let x = -r.hx + 0.25; x < r.hx - 0.1; x += 0.3) for (const s of [-1, 1])
    box(group, 'Rafter tail', [0.08, 0.09, tail], [x, r.eaveY - 0.15, s * (r.hz - tail / 2)], m.wood);
  for (let z = -r.hz + 0.25; z < r.hz - 0.1; z += 0.3) for (const s of [-1, 1])
    box(group, 'Rafter tail', [side, 0.09, 0.08], [s * (r.hx - side / 2), r.eaveY - 0.15, z], m.wood);
}

/**
 * Hip-and-gable (irimoya) roof with its ridge along local x and painted gable faces at both ends.
 * The front/back slopes and the hipped side slopes share their hip edges exactly.
 */
export function irimoyaRoof(group: THREE.Group, m: ShrineMaterials, r: Roof & { hipY: number; ridgeHalf: number },
  roof: THREE.Material, body: { x: number; z: number }): void {
  const { hx, hz, eaveY: e, hipY: h, ridgeY: top, ridgeHalf: rh } = r;
  const zh = hz * (1 - (h - e) / (top - e));
  for (const s of [-1, 1]) {
    polygon(group, 'Roof slope', [[-hx, e, s * hz], [hx, e, s * hz], [rh, h, s * zh], [rh, top, 0], [-rh, top, 0], [-rh, h, s * zh]], roof, 1);
    polygon(group, 'Hipped roof end', [[s * hx, e, -hz], [s * hx, e, hz], [s * rh, h, zh], [s * rh, h, -zh]], roof, 1);
    const gable = s > 0
      ? polygon(group, 'Painted gable face', [[rh, h, -zh], [rh, h, zh], [rh, top, 0]], m.gable, 1, [[0, 0], [1, 0], [0.5, 1]])
      : polygon(group, 'Painted gable face', [[-rh, h, zh], [-rh, h, -zh], [-rh, top, 0]], m.gable, 1, [[0, 0], [1, 0], [0.5, 1]]);
    gable.position.x = s * 0.04;
    polygon(group, 'Gable backing', [[s * (rh - 0.08), h, -zh], [s * (rh - 0.08), h, zh], [s * (rh - 0.08), top, 0]], m.darkWood);
    for (const z of [-1, 1]) {
      beam(group, 'Bargeboard', [s * (rh + 0.1), h - 0.12, z * (zh + 0.35)], [s * (rh + 0.1), top + 0.18, 0], 0.12, 0.34, m.darkWood);
      beam(group, 'Copper hip ridge', [s * hx, e + 0.08, z * hz], [s * rh, h + 0.08, z * zh], 0.2, 0.18, roof);
      cylinder(group, 'Gold bargeboard tip', 0.09, 0.09, 0.16, [s * (rh + 0.17), h - 0.1, z * (zh + 0.32)], m.gold);
    }
    box(group, 'Gable ledge', [0.5, 0.12, zh * 2 + 0.2], [s * (rh + 0.2), h - 0.02, 0], roof);
    box(group, 'Onigawara ridge end', [0.28, 0.6, 0.5], [s * (rh + 0.14), top + 0.36, 0], roof);
  }
  box(group, 'Copper ridge cap', [rh * 2 + 0.2, 0.32, 0.36], [0, top + 0.12, 0], roof);
  eaves(group, m, r, body, true);
}

/** Plain gable (kirizuma) roof, ridge along local x; `gableFace` fills the end triangles. */
export function gableRoof(group: THREE.Group, m: ShrineMaterials, r: Roof & { inset: number }, roof: THREE.Material,
  gableFace: THREE.Material, body: { x: number; z: number }, rafters = false): void {
  const { hx, hz, eaveY: e, ridgeY: top, inset } = r;
  for (const s of [-1, 1]) {
    polygon(group, 'Roof slope', [[-hx, e, s * hz], [hx, e, s * hz], [hx, top, 0], [-hx, top, 0]], roof, 1);
    const gx = s * (hx - inset), zAt = body.z;
    const yAt = e + (top - e) * (1 - zAt / hz);
    polygon(group, 'Gable end', [[gx, yAt - 0.02, -zAt], [gx, yAt - 0.02, zAt], [gx, top - 0.05, 0]], gableFace, 1,
      gableFace === m.gable ? (s > 0 ? [[0, 0], [1, 0], [0.5, 1]] : [[1, 0], [0, 0], [0.5, 1]]) : undefined);
    for (const z of [-1, 1]) beam(group, 'Bargeboard', [s * (hx + 0.05), e - 0.05, z * (hz + 0.05)], [s * (hx + 0.05), top + 0.1, 0], 0.1, 0.26, m.darkWood);
  }
  box(group, 'Ridge cap', [hx * 2 + 0.3, 0.26, 0.3], [0, top + 0.08, 0], roof);
  for (const s of [-1, 1]) box(group, 'Ridge end tile', [0.22, 0.42, 0.4], [s * (hx + 0.12), top + 0.2, 0], roof);
  box(group, 'Eave fascia', [hx * 2, 0.22, 0.1], [0, e - 0.04, hz], m.wood);
  box(group, 'Eave fascia', [hx * 2, 0.22, 0.1], [0, e - 0.04, -hz], m.wood);
  if (rafters) for (let x = -hx + 0.2; x < hx - 0.1; x += 0.3) for (const s of [-1, 1]) {
    const tail = hz - body.z + 0.05;
    box(group, 'Rafter tail', [0.07, 0.08, tail], [x, e - 0.12, s * (hz - tail / 2)], m.wood);
  }
}

/** Worship hall: painted front/side elevations, raised veranda, steps, rope, bell and offering box. */
export function haiden(parent: THREE.Group, m: ShrineMaterials, front: THREE.Material, side: THREE.Material): THREE.Group {
  const group = new THREE.Group(); group.name = 'Haiden | worship hall';
  const { width: w, depth: d, wall, plinth, eave, eaveY, hipY, ridgeY, ridgeHalf, veranda, stepWidth } = HAIDEN;
  box(group, 'Hall walls | painted elevations', [w, wall, d], [0, wall / 2, 0], [side, side, m.darkWood, m.darkWood, front, side]);
  box(group, 'Granite foundation', [w + 0.3, 0.25, d + 0.3], [0, 0.125, 0], m.stone);
  // The ridge runs front-to-back so the painted gable faces the approach, as in the original painting.
  const roof = new THREE.Group(); roof.rotation.y = Math.PI / 2;
  irimoyaRoof(roof, m, { hx: d / 2 + eave, hz: w / 2 + eave, eaveY, hipY, ridgeY, ridgeHalf }, m.copper, { x: d / 2, z: w / 2 });
  group.add(roof);
  box(group, 'Wall-top beam', [w + 0.2, 0.3, d + 0.2], [0, wall - 0.12, 0], m.wood);

  // Raised veranda across the front, with railings broken by the steps.
  const deckY = plinth + 0.08, front0 = d / 2, deckEdge = d / 2 + veranda;
  box(group, 'Veranda deck boards', [w + 1.2, 0.1, veranda], [0, deckY - 0.05, front0 + veranda / 2], m.wood);
  box(group, 'Veranda edge beam', [w + 1.2, 0.22, 0.14], [0, deckY - 0.16, deckEdge], m.darkWood);
  for (const x of [-w / 2 - 0.5, -w / 4, w / 4, w / 2 + 0.5]) box(group, 'Veranda post', [0.18, deckY - 0.1, 0.18], [x, (deckY - 0.1) / 2, deckEdge - 0.12], m.darkWood);
  const railY = deckY + 0.62;
  for (const s of [-1, 1]) {
    const x0 = s * (stepWidth / 2 + 0.15), x1 = s * (w / 2 + 0.55), len = Math.abs(x1 - x0), cx = (x0 + x1) / 2;
    box(group, 'Railing top rail', [len, 0.08, 0.1], [cx, railY, deckEdge - 0.08], m.darkWood);
    box(group, 'Railing lower rail', [len, 0.06, 0.06], [cx, deckY + 0.22, deckEdge - 0.08], m.darkWood);
    box(group, 'Railing side rail', [0.1, 0.08, veranda], [x1, railY, front0 + veranda / 2], m.darkWood);
    for (let i = 0; i <= 5; i++) box(group, 'Railing post', [0.08, 0.66, 0.08], [x0 + (x1 - x0) * i / 5, deckY + 0.31, deckEdge - 0.08], m.darkWood);
    cylinder(group, 'Gilded railing cap', 0.07, 0.07, 0.1, [x0, railY + 0.08, deckEdge - 0.08], m.gold);
  }
  const steps = 5, rise = deckY / steps, tread = 0.34;
  for (let i = 0; i < steps; i++) {
    box(group, 'Wooden step', [stepWidth, 0.06, tread + 0.04], [0, deckY - rise * (i + 1) + 0.03 + rise - 0.06, deckEdge + tread * (i + 0.5)], m.wood);
    box(group, 'Step riser', [stepWidth, rise, 0.03], [0, deckY - rise * (i + 0.5), deckEdge + tread * i + 0.01], m.darkWood);
  }
  for (const s of [-1, 1]) beam(group, 'Step stringer', [s * stepWidth / 2, deckY, deckEdge], [s * stepWidth / 2, 0.05, deckEdge + tread * steps], 0.1, 0.24, m.darkWood);
  box(group, 'Granite landing', [stepWidth + 1.2, 0.12, 1.4], [0, 0.06, deckEdge + tread * steps + 0.7], m.stone);

  // Offering box, bell rope and the shimenawa across the front eave.
  box(group, 'Offering box (saisen-bako)', [1.6, 0.7, 0.62], [0, deckY + 0.35, deckEdge - 0.5], m.wood);
  for (let i = 0; i < 6; i++) box(group, 'Offering box slat', [1.5, 0.03, 0.06], [0, deckY + 0.71, deckEdge - 0.75 + i * 0.1], m.darkWood);
  box(group, 'Offering box base', [1.64, 0.08, 0.66], [0, deckY + 0.04, deckEdge - 0.5], m.darkWood);
  for (const s of [-1, 1]) box(group, 'Offering box gold corner', [0.12, 0.12, 0.66], [s * 0.78, deckY + 0.64, deckEdge - 0.5], m.gold);
  const ropeZ = front0 + 0.95;
  box(group, 'Front eave tie beam', [w + 1, 0.22, 0.2], [0, eaveY - 0.32, ropeZ - 0.05], m.darkWood);
  cylinder(group, 'Bell (suzu)', 0.2, 0.2, 0.3, [0, eaveY - 0.62, ropeZ], m.gold, 16);
  const bellRope = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, eaveY - 2.1, 8), m.rope);
  bellRope.position.set(0, (eaveY - 0.75 + deckY + 1.35) / 2, ropeZ); bellRope.name = 'Bell rope'; group.add(bellRope);
  cylinder(group, 'Bell rope tassel', 0.05, 0.13, 0.5, [0, deckY + 1.1, ropeZ], m.rope);
  shimenawa(group, m, [-3.6, eaveY - 0.55, ropeZ + 0.05], [3.6, eaveY - 0.55, ropeZ + 0.05], 0.55, 0.075, 8, 0.45);

  // Connecting corridor and the inner sanctuary behind.
  const link = new THREE.Group(); link.name = 'Heiden | connecting hall'; link.position.z = (HONDEN.z - HAIDEN.z + HONDEN.depth / 2 + d / 2) / 2 - 0.4;
  const linkLen = Math.abs(HONDEN.z - HAIDEN.z) - HONDEN.depth / 2 - d / 2 + 1;
  box(link, 'Corridor walls', [3.4, 4.2, linkLen], [0, 2.1, 0], side);
  const linkRoof = new THREE.Group(); linkRoof.rotation.y = Math.PI / 2;
  gableRoof(linkRoof, m, { hx: linkLen / 2, hz: 2.4, eaveY: 4.2, ridgeY: 5.6, inset: 0 }, m.copper, m.darkWood, { x: linkLen / 2, z: 1.7 });
  link.add(linkRoof); group.add(link);
  const honden = new THREE.Group(); honden.name = 'Honden | sanctuary'; honden.position.z = HONDEN.z - HAIDEN.z;
  const hw = HONDEN.width;
  box(honden, 'Sanctuary walls', [hw, HONDEN.wall, HONDEN.depth], [0, HONDEN.wall / 2 + 0.4, 0], side);
  box(honden, 'Sanctuary plinth', [hw + 0.4, 0.4, HONDEN.depth + 0.4], [0, 0.2, 0], m.stone);
  const hRoof = new THREE.Group(); hRoof.rotation.y = Math.PI / 2;
  gableRoof(hRoof, m, { hx: hw / 2 + HONDEN.eave, hz: hw / 2 + HONDEN.eave, eaveY: HONDEN.wall + 0.4, ridgeY: HONDEN.ridgeY, inset: HONDEN.eave },
    m.copper, m.gable, { x: hw / 2, z: hw / 2 }, true);
  honden.add(hRoof);
  for (let i = -2; i <= 2; i++) box(honden, 'Katsuogi ridge log', [0.28, 0.28, 0.8], [0, HONDEN.ridgeY + 0.38, i * 0.9], m.darkWood);
  for (const s of [-1, 1]) for (const z of [-1, 1]) {
    beam(honden, 'Chigi crossed finial', [s * 0.2, HONDEN.ridgeY - 0.2, z * (hw / 2 + HONDEN.eave)], [-s * 0.55, HONDEN.ridgeY + 1.1, z * (hw / 2 + HONDEN.eave + 0.15)], 0.12, 0.08, m.darkWood);
  }
  group.add(honden);
  group.position.z = HAIDEN.z; parent.add(group);
  return group;
}

/** Long single-storey office/storehouse; `front` is a horizontally tiling 6 m painted bay. */
export function annex(parent: THREE.Group, m: ShrineMaterials, frontMap: THREE.Texture, length: number,
  x: number, z: number, facing: number): void {
  const group = new THREE.Group(); group.name = 'Shrine office | long annex';
  const depth = 6, wall = 4;
  const map = frontMap.clone(); map.wrapS = THREE.RepeatWrapping; map.repeat.x = length / 6; map.needsUpdate = true;
  const sideMap = frontMap.clone(); sideMap.wrapS = THREE.RepeatWrapping; sideMap.repeat.x = depth / 6; sideMap.needsUpdate = true;
  const front = new THREE.MeshBasicMaterial({ map, toneMapped: false, fog: false });
  const side = new THREE.MeshBasicMaterial({ map: sideMap, toneMapped: false, fog: false });
  box(group, 'Annex walls | painted bays', [length, wall, depth], [0, wall / 2, 0], [side, side, m.darkWood, m.darkWood, front, front]);
  box(group, 'Annex foundation', [length + 0.2, 0.18, depth + 0.2], [0, 0.09, 0], m.stone);
  gableRoof(group, m, { hx: length / 2 + 0.9, hz: depth / 2 + 1.2, eaveY: wall, ridgeY: wall + 2.3, inset: 0.9 }, m.kawara, m.plaster, { x: length / 2, z: depth / 2 }, true);
  box(group, 'Annex veranda', [length, 0.1, 0.9], [0, 0.45, depth / 2 + 0.45], m.wood);
  for (let i = 0; i <= Math.round(length / 3); i++) box(group, 'Veranda post', [0.12, 0.4, 0.12], [-length / 2 + i * length / Math.round(length / 3), 0.2, depth / 2 + 0.8], m.darkWood);
  group.position.set(x, 0, z); group.rotation.y = facing; parent.add(group);
}

/** Purification pavilion: four posts, tiled gable roof, stone basin with bamboo spout and dippers. */
export function temizuya(parent: THREE.Group, m: ShrineMaterials, x: number, z: number, facing: number): void {
  const group = new THREE.Group(); group.name = 'Temizuya | purification pavilion';
  const px = 1.5, pz = 1.0, post = 2.55;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(group, 'Pavilion post', [0.2, post, 0.2], [sx * px, post / 2 + 0.12, sz * pz], m.wood);
    box(group, 'Granite post base', [0.36, 0.24, 0.36], [sx * px, 0.12, sz * pz], m.stone);
  }
  for (const sz of [-1, 1]) box(group, 'Long beam', [px * 2 + 0.6, 0.24, 0.18], [0, post, sz * pz], m.darkWood);
  for (const sx of [-1, 1]) box(group, 'Tie beam', [0.18, 0.2, pz * 2 + 0.5], [sx * px, post - 0.24, 0], m.darkWood);
  box(group, 'Ridge post', [0.14, 0.75, 0.14], [0, post + 0.45, 0], m.darkWood);
  gableRoof(group, m, { hx: px + 0.65, hz: pz + 0.85, eaveY: post + 0.12, ridgeY: post + 1.25, inset: 0.65 }, m.kawara, m.darkWood, { x: px, z: pz });
  shimenawa(group, m, [-px, post - 0.18, pz + 0.12], [px, post - 0.18, pz + 0.12], 0.22, 0.05, 4, 0.36);
  box(group, 'Granite pavement', [px * 2 + 1.2, 0.1, pz * 2 + 1.2], [0, 0.05, 0], m.stone);
  // Hollow stone basin: walls around a recessed water surface.
  const bw = 1.9, bd = 0.78, bh = 0.78;
  for (const s of [-1, 1]) {
    box(group, 'Basin long wall', [bw, bh, 0.16], [0, bh / 2 + 0.1, s * (bd / 2 - 0.08)], m.stone);
    box(group, 'Basin end wall', [0.16, bh, bd - 0.32], [s * (bw / 2 - 0.08), bh / 2 + 0.1, 0], m.stone);
  }
  box(group, 'Basin water', [bw - 0.3, 0.02, bd - 0.3], [0, bh + 0.03, 0], m.water);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 10), m.bamboo);
  spout.rotation.z = Math.PI / 2 - 0.12; spout.position.set(-bw / 2 + 0.25, bh + 0.42, -0.1); group.add(spout);
  cylinder(group, 'Bamboo spout post', 0.06, 0.06, 0.65, [-bw / 2 - 0.05, bh + 0.25, -0.1], m.bamboo);
  for (const s of [-1, 1]) box(group, 'Dipper rest rail', [bw - 0.2, 0.03, 0.03], [0, bh + 0.16, s * 0.16], m.bamboo);
  for (let i = 0; i < 5; i++) {
    const dx = -0.6 + i * 0.3;
    cylinder(group, 'Dipper cup', 0.06, 0.055, 0.1, [dx, bh + 0.2, 0.2], m.bamboo, 10);
    box(group, 'Dipper handle', [0.018, 0.016, 0.42], [dx, bh + 0.19, -0.02], m.bamboo);
  }
  group.position.set(x, 0, z); group.rotation.y = facing; parent.add(group);
}
