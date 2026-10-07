import * as THREE from 'three';
import { gableRoof } from './Buildings';
import { TORII } from './layout';
import { box, cylinder, polygon, shimenawa, type ShrineMaterials } from './geometry';

/** Granite myojin torii with upturned lintel ends, tie beam, tablet strut and rope. */
export function torii(parent: THREE.Group, m: ShrineMaterials, z: number): void {
  const group = new THREE.Group(); group.name = 'Stone torii';
  const half = TORII.span / 2, h = TORII.height;
  for (const s of [-1, 1]) {
    cylinder(group, 'Torii pillar', 0.27, 0.31, h - 0.2, [s * half, (h - 0.2) / 2, 0], m.stone, 16);
    cylinder(group, 'Pillar base (kamebara)', 0.36, 0.42, 0.5, [s * half, 0.25, 0], m.stone, 16);
    cylinder(group, 'Pillar collar (daiwa)', 0.36, 0.36, 0.22, [s * half, h - 0.42, 0], m.stone, 16);
  }
  box(group, 'Tie beam (nuki)', [TORII.span + 1.6, 0.34, 0.26], [0, h - 1.15, 0], m.stone);
  box(group, 'Lower lintel (shimaki)', [TORII.span + 2.0, 0.3, 0.5], [0, h - 0.17, 0], m.stone);
  box(group, 'Upper lintel (kasagi)', [TORII.span + 1.4, 0.36, 0.6], [0, h + 0.15, 0], m.stone);
  for (const s of [-1, 1]) {
    const end = box(group, 'Upturned lintel end', [0.9, 0.36, 0.6], [s * (half + 1.1), h + 0.21, 0], m.stone);
    end.rotation.z = s * 0.14;
  }
  box(group, 'Tablet strut (gakuzuka)', [0.36, 0.72, 0.24], [0, h - 0.66, 0], m.stone);
  shimenawa(group, m, [-half + 0.25, h - 1.45, 0.3], [half - 0.25, h - 1.45, 0.3], 0.55, 0.09, 4, 0.55);
  group.position.z = z; parent.add(group);
}

/** Kasuga-style stone lantern: hexagonal base, pole, platform, firebox with windows, flared cap and jewel. */
export function lantern(parent: THREE.Group, m: ShrineMaterials, x: number, z: number, scale = 1): void {
  const group = new THREE.Group(); group.name = 'Stone lantern (toro)';
  box(group, 'Lantern plinth', [0.95, 0.35, 0.95], [0, 0.175, 0], m.stone);
  box(group, 'Lantern plinth step', [0.75, 0.2, 0.75], [0, 0.45, 0], m.stone);
  cylinder(group, 'Lantern base', 0.36, 0.4, 0.22, [0, 0.66, 0], m.stone, 6);
  cylinder(group, 'Lantern pole', 0.15, 0.17, 1.0, [0, 1.27, 0], m.stone, 10);
  cylinder(group, 'Lantern platform', 0.38, 0.24, 0.24, [0, 1.89, 0], m.stone, 6);
  box(group, 'Firebox', [0.42, 0.44, 0.42], [0, 2.23, 0], m.stone);
  for (const r of [0, Math.PI / 2]) {
    const window = box(group, 'Firebox window', [0.2, 0.22, 0.44], [0, 2.25, 0], m.darkWood);
    window.rotation.y = r;
  }
  cylinder(group, 'Flared cap', 0.12, 0.56, 0.32, [0, 2.6, 0], m.stone, 6);
  cylinder(group, 'Cap rim', 0.56, 0.56, 0.06, [0, 2.44, 0], m.stone, 6);
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), m.stone);
  jewel.name = 'Jewel finial'; jewel.position.y = 2.86; group.add(jewel);
  cylinder(group, 'Jewel tip', 0.0, 0.07, 0.14, [0, 3.0, 0], m.stone, 8);
  group.position.set(x, 0, z); group.scale.setScalar(scale); parent.add(group);
}

/** Low granite balustrade (tamagaki) between two points, posts every ~1.6 m. */
export function stoneFence(parent: THREE.Group, m: ShrineMaterials, from: [number, number], to: [number, number], height = 1.05): void {
  const dx = to[0] - from[0], dz = to[1] - from[1], length = Math.hypot(dx, dz);
  const group = new THREE.Group(); group.name = 'Stone fence (tamagaki)';
  const count = Math.max(1, Math.round(length / 1.6));
  for (let i = 0; i <= count; i++) {
    const t = i / count - 0.5;
    box(group, 'Fence post', [0.2, height + 0.08, 0.2], [t * length, (height + 0.08) / 2, 0], m.stone);
    box(group, 'Post cap', [0.24, 0.08, 0.24], [t * length, height + 0.12, 0], m.stone);
  }
  box(group, 'Top rail', [length, 0.12, 0.14], [0, height - 0.1, 0], m.stone);
  box(group, 'Lower rail', [length, 0.1, 0.12], [0, 0.42, 0], m.stone);
  box(group, 'Fence curb', [length + 0.2, 0.2, 0.3], [0, 0.1, 0], m.stone);
  group.position.set((from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2); group.rotation.y = -Math.atan2(dz, dx);
  parent.add(group);
}

/** Covered rack of ema votive plaques, readable from both sides. */
export function emaRack(parent: THREE.Group, m: ShrineMaterials, x: number, z: number, facing: number): void {
  const group = new THREE.Group(); group.name = 'Ema rack';
  const w = 2.4, bh = 1.2;
  for (const s of [-1, 1]) box(group, 'Rack post', [0.12, 2.15, 0.12], [s * (w / 2 + 0.06), 1.075, 0], m.darkWood);
  const board = box(group, 'Ema plaques | both faces', [w, bh, 0.08], [0, 1.25, 0], m.darkWood);
  board.material = [m.darkWood, m.darkWood, m.darkWood, m.darkWood, m.ema, m.ema];
  box(group, 'Rack sill', [w + 0.2, 0.08, 0.2], [0, 0.62, 0], m.darkWood);
  const hx = w / 2 + 0.35, hz = 0.5;
  for (const s of [-1, 1]) {
    polygon(group, 'Small roof slope', [[-hx, 2.15, s * hz], [hx, 2.15, s * hz], [hx, 2.55, 0], [-hx, 2.55, 0]], m.kawara, 1);
    box(group, 'Roof fascia', [hx * 2, 0.08, 0.06], [0, 2.13, s * hz], m.darkWood);
  }
  box(group, 'Small ridge', [hx * 2 + 0.1, 0.1, 0.14], [0, 2.58, 0], m.kawara);
  group.position.set(x, 0, z); group.rotation.y = facing; parent.add(group);
}

/** Small subsidiary shrine (massha) on a stone base, with its own miniature torii. */
export function massha(parent: THREE.Group, m: ShrineMaterials, wall: THREE.Material, x: number, z: number, facing: number): void {
  const group = new THREE.Group(); group.name = 'Massha | subsidiary shrine';
  box(group, 'Stone base', [2.6, 0.6, 2.4], [0, 0.3, 0], m.stone);
  box(group, 'Stone base step', [1.2, 0.3, 0.5], [0, 0.15, 1.45], m.stone);
  box(group, 'Shrine body | painted wall', [1.6, 1.3, 1.4], [0, 1.25, 0], wall);
  box(group, 'Front doors', [0.9, 0.9, 0.04], [0, 1.15, 0.72], m.darkWood);
  for (const s of [-1, 1]) box(group, 'Gold door fitting', [0.06, 0.06, 0.05], [s * 0.08, 1.15, 0.75], m.gold);
  const roof = new THREE.Group(); roof.rotation.y = Math.PI / 2;
  gableRoof(roof, m, { hx: 1.25, hz: 1.25, eaveY: 1.9, ridgeY: 2.65, inset: 0.55 }, m.copper, m.gable, { x: 0.7, z: 0.8 }, true);
  group.add(roof);
  shimenawa(group, m, [-0.65, 1.78, 0.85], [0.65, 1.78, 0.85], 0.12, 0.035, 3, 0.22);
  const gate = new THREE.Group(); gate.position.z = 2.6;
  for (const s of [-1, 1]) cylinder(gate, 'Mini torii pillar', 0.08, 0.09, 1.9, [s * 0.75, 0.95, 0], m.stone, 12);
  box(gate, 'Mini torii nuki', [1.8, 0.1, 0.08], [0, 1.5, 0], m.stone);
  box(gate, 'Mini torii kasagi', [2.1, 0.14, 0.18], [0, 1.95, 0], m.stone);
  group.add(gate);
  for (const s of [-1, 1]) lantern(group, m, s * 1.3, 2.0, 0.42);
  group.position.set(x, 0, z); group.rotation.y = facing; parent.add(group);
}
