import * as THREE from 'three';
import { castShadows } from '../castShadows';
import { box, canvasTexture, paint } from './materials';

export type FurnitureMaterials = { wood: THREE.Material; iron: THREE.Material; gold: THREE.Material; stone: THREE.Material; soil: THREE.Material; flowers: THREE.Material };

function cylinder(parent: THREE.Group, radiusTop: number, radiusBottom: number, height: number, at: [number, number, number], material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 12), material);
  mesh.position.set(...at); parent.add(mesh); return mesh;
}

export function planter(parent: THREE.Group, m: FurnitureMaterials, x: number, z: number, rotation = 0): void {
  const group = new THREE.Group(); group.name = 'Flower box | hollow timber and crossed foliage';
  for (const sx of [-0.68, 0.68]) box(group, 'Planter end', [0.08, 0.5, 0.73], [sx, 0.25, 0], m.wood);
  for (const sz of [-0.34, 0.34]) {
    for (let row = 0; row < 4; row++) box(group, 'Planter wooden slat', [1.42, 0.116, 0.055], [0, 0.068 + row * 0.126, sz], m.wood);
    for (const sx of [-0.58, 0.58]) box(group, 'Iron planter strap', [0.035, 0.5, 0.015], [sx, 0.25, sz * 1.1], m.iron);
  }
  box(group, 'Soil inside box', [1.25, 0.06, 0.61], [0, 0.43, 0], m.soil);
  for (let i = 0; i < 3; i++) {
    const flowers = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.97), m.flowers);
    flowers.position.y = 0.85; flowers.rotation.y = i * Math.PI / 3; group.add(flowers);
  }
  group.position.set(x, 0, z); group.rotation.y = rotation; castShadows(group); parent.add(group);
}

export function bench(parent: THREE.Group, m: FurnitureMaterials, x: number, z: number, rotation: number): void {
  const group = new THREE.Group(); group.name = 'Bench | wooden slats and wrought iron frame';
  for (let i = 0; i < 5; i++) box(group, 'Seat slat', [1.65, 0.055, 0.085], [0, 0.46, -0.18 + i * 0.1], m.wood);
  for (let i = 0; i < 4; i++) box(group, 'Backrest slat', [1.65, 0.09, 0.05], [0, 0.69 + i * 0.115, -0.25 - i * 0.014], m.wood);
  for (const sx of [-0.65, 0.65]) {
    for (const sz of [-0.19, 0.22]) box(group, 'Bench legs', [0.06, 0.46, 0.06], [sx, 0.23, sz], m.iron);
    box(group, 'Backrest frame', [0.04, 0.63, 0.04], [sx, 0.72, -0.28], m.iron);
    const curve = new THREE.CatmullRomCurve3([[sx, 0.47, 0.2], [sx, 0.72, 0.2], [sx, 0.76, 0], [sx, 0.74, -0.25]].map(p => new THREE.Vector3(...p)));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.027, 6, false), m.iron));
  }
  group.position.set(x, 0, z); group.rotation.y = rotation; castShadows(group); parent.add(group);
}

export function lamp(parent: THREE.Group, m: FurnitureMaterials, x: number, z: number): void {
  const group = new THREE.Group(); group.name = 'Streetlamp | solid lantern and ornate post';
  cylinder(group, 0.22, 0.29, 0.12, [0, 0.06, 0], m.iron);
  cylinder(group, 0.12, 0.2, 0.5, [0, 0.34, 0], m.iron);
  cylinder(group, 0.046, 0.078, 2.65, [0, 1.84, 0], m.iron);
  for (const y of [0.6, 2.7, 3.1]) cylinder(group, 0.09, 0.09, 0.07, [0, y, 0], m.gold);
  const glass = paint('#ffe8aa');
  box(group, 'Warm lantern glass', [0.28, 0.42, 0.28], [0, 3.4, 0], glass);
  for (const sx of [-0.16, 0.16]) for (const sz of [-0.16, 0.16]) box(group, 'Lantern frame', [0.027, 0.46, 0.027], [sx, 3.4, sz], m.iron);
  box(group, 'Lantern rim', [0.38, 0.05, 0.38], [0, 3.16, 0], m.iron);
  cylinder(group, 0.03, 0.31, 0.24, [0, 3.74, 0], m.iron);
  cylinder(group, 0.028, 0.055, 0.18, [0, 3.92, 0], m.gold);
  group.position.set(x, 0, z); castShadows(group); parent.add(group);
}

export function chalkboard(parent: THREE.Group, m: FurnitureMaterials, x: number, z: number, rotation: number): void {
  const group = new THREE.Group(); group.name = 'Bookshop | real A-frame chalkboard';
  const map = canvasTexture(384, 512, ctx => {
    ctx.fillStyle = '#25322e'; ctx.fillRect(0, 0, 384, 512);
    ctx.fillStyle = '#e6d6a5'; ctx.textAlign = 'center';
    ctx.font = 'italic 41px Georgia'; ctx.fillText('Bienvenue', 192, 100);
    ctx.font = '27px Georgia'; ctx.fillText('Livres & Poésie', 192, 182); ctx.fillText('Nouveautés', 192, 237);
    ctx.font = '23px Georgia'; ctx.fillText('Les belles histoires', 192, 342); ctx.fillText('commencent ici', 192, 380);
    ctx.strokeStyle = '#dcc798'; ctx.lineWidth = 2; ctx.strokeRect(22, 25, 340, 452);
  });
  box(group, 'Wooden board', [0.72, 1, 0.05], [0, 0.74, 0], m.wood);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.61, 0.85), paint('#ffffff', map)); face.position.set(0, 0.75, 0.031); group.add(face);
  for (const sx of [-0.33, 0.33]) for (const side of [-1, 1]) {
    const leg = box(group, 'A-frame legs', [0.055, 1.22, 0.055], [sx, 0.6, side * -0.13], m.wood);
    leg.rotation.x = side * 0.22;
  }
  box(group, 'A-frame hinge', [0.73, 0.055, 0.05], [0, 1.2, -0.13], m.iron);
  group.position.set(x, 0, z); group.rotation.y = rotation; castShadows(group); parent.add(group);
}

export function bookTable(parent: THREE.Group, m: FurnitureMaterials, x: number, z: number, rotation: number): void {
  const group = new THREE.Group(); group.name = 'Bookstall | table and piles of books';
  box(group, 'Table top', [1.35, 0.08, 0.7], [0, 0.75, 0], m.wood);
  for (const sx of [-0.54, 0.54]) for (const sz of [-0.24, 0.24]) box(group, 'Table legs', [0.055, 0.73, 0.055], [sx, 0.365, sz], m.wood);
  const colours = ['#713039', '#2c5352', '#a18655', '#485b78'];
  const covers = colours.map(c => paint(c)); const paper = paint('#e5d5b0');
  for (let i = 0; i < 10; i++) {
    const px = -0.46 + (i % 3) * 0.43, pz = i > 5 ? -0.17 : 0.15, y = 0.82 + (Math.floor(i / 3) % 2) * 0.11;
    box(group, 'Book pages', [0.28, 0.065, 0.22], [px, y, pz], paper);
    for (const dy of [-0.04, 0.04]) box(group, 'Book cover', [0.3, 0.012, 0.24], [px, y + dy, pz], covers[i % 4]);
  }
  group.position.set(x, 0, z); group.rotation.y = rotation; castShadows(group); parent.add(group);
}
