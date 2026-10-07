import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { resolveAssetUrl } from '../../utils/path';
import { farStandee, groundPlane, skyDome } from '../painted-gate/PaintedGate';
import { annex, haiden, temizuya } from './Buildings';
import { box, canvasTexture, paint, ropeTexture, shideTexture, waterTexture, worldUvs, type ShrineMaterials } from './geometry';
import { FAR, HAIDEN, PRECINCT, SANDO, TORII } from './layout';
import { emaRack, lantern, massha, stoneFence, torii } from './Props';

async function texture(file: string, repeat?: [number, number]): Promise<THREE.Texture> {
  const map = await new THREE.TextureLoader().loadAsync(resolveAssetUrl(`/textures/painted-shrine/${file}`));
  map.name = `Shrine | ${file}`; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  if (repeat) { map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(...repeat); }
  return map;
}

const cutout = (map: THREE.Texture) =>
  new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false, fog: false });

/** Batch static details by their shared material, retaining UVs and all world transforms. */
function batch(root: THREE.Group): void {
  root.updateMatrixWorld(true);
  const groups = new Map<THREE.Material, THREE.Mesh[]>();
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material) || o.material instanceof THREE.ShaderMaterial) return;
    const list = groups.get(o.material) ?? []; list.push(o); groups.set(o.material, list);
  });
  for (const [material, objects] of groups) {
    if (objects.length < 2) continue;
    const parts = objects.map(o => {
      const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      return g;
    });
    const merged = mergeGeometries(parts);
    parts.forEach(p => p.dispose());
    if (!merged) continue;
    for (const o of objects) { o.removeFromParent(); o.geometry.dispose(); }
    const mesh = new THREE.Mesh(merged, material); mesh.name = `Shrine | ${objects.length} static pieces`; root.add(mesh);
  }
}

/** Dappled leaf shade, fixed on the ground under the canopies. */
function leafShade(): THREE.MeshBasicMaterial {
  const map = canvasTexture(512, 512, ctx => {
    for (let i = 0; i < 520; i++) {
      const random = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const radius = Math.sqrt(random) * 230, angle = i * 2.39996;
      const x = 256 + Math.cos(angle) * radius, y = 256 + Math.sin(angle) * radius;
      const fade = Math.max(0, 1 - radius / 240);
      ctx.fillStyle = `rgba(70,62,34,${0.05 + 0.2 * fade})`;
      ctx.beginPath(); ctx.ellipse(x, y, 9 + i % 13, 5 + i % 6, i, 0, Math.PI * 2); ctx.fill();
    }
  });
  return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false, fog: false });
}

/** Shrine precinct after shrine_far.avif: haiden with painted elevations, stone torii, lanterns, temizuya and forest. */
export async function loadPaintedShrine(): Promise<THREE.Group> {
  const [hFront, hSide, annexFront, ema, copperMap, kawaraMap, gravel, sando, granite, woodMap, gableMap, shrubMap, treeMap, belt] = await Promise.all([
    texture('haiden-front.avif'), texture('haiden-side.avif'), texture('annex-front.avif'), texture('ema.avif'),
    texture('roof-copper.avif', [1 / 2.4, 1 / 2.4]), texture('roof-kawara.avif', [1 / 2, 1 / 2]),
    texture('ground-gravel.avif', [(FAR.east - FAR.west) / 3, (FAR.south - FAR.north) / 3]),
    texture('sando-stone.avif', [SANDO.halfWidth * 2 / 2.4, (SANDO.south - SANDO.north) / 2.4]),
    texture('stone-granite.avif', [1, 1]), texture('wood-timber.avif', [1, 1]),
    texture('gable.avif'), texture('shrub.avif'), texture('tree.avif'), texture('far-tree-belt.avif'),
  ]);
  const root = new THREE.Group(); root.name = 'Shrine | walkable painted precinct'; root.add(skyDome());
  const roofMaterial = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const m: ShrineMaterials = {
    copper: roofMaterial(copperMap), kawara: roofMaterial(kawaraMap), gable: cutout(gableMap),
    wood: paint('#ffffff', woodMap), darkWood: paint('#9a8270', woodMap), plaster: paint('#ece5d6'),
    stone: paint('#cfcbc2', granite), gold: paint('#c9a24f'), rope: paint('#e2d3a8', ropeTexture()),
    shide: cutout(shideTexture()), bamboo: paint('#8c9455'), water: paint('#ffffff', waterTexture()), ema: paint('#ffffff', ema),
  };
  (m.darkWood as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
  root.add(groundPlane('Gravel courtyard', paint('#ffffff', gravel), FAR.west - 3, FAR.east + 3, FAR.south + 3, FAR.north - 3));
  const path = groundPlane('Granite approach (sando)', paint('#ffffff', sando), -SANDO.halfWidth, SANDO.halfWidth, SANDO.south, SANDO.north);
  path.position.y = 0.02; root.add(path);
  for (const s of [-1, 1]) box(root, 'Sando kerb', [0.14, 0.06, SANDO.south - SANDO.north], [s * (SANDO.halfWidth + 0.07), 0.03, (SANDO.south + SANDO.north) / 2], m.stone);

  haiden(root, m, paint('#ffffff', hFront), paint('#ffffff', hSide));
  // Granite tamagaki: across the front of the hall (open at the steps) and around it.
  const fz = HAIDEN.z + HAIDEN.depth / 2 + HAIDEN.veranda + 1.75 + 0.6, back = -34;
  stoneFence(root, m, [-9, fz], [-2.6, fz]); stoneFence(root, m, [2.6, fz], [9, fz]);
  for (const s of [-1, 1]) stoneFence(root, m, [s * 9, fz], [s * 9, back]);
  stoneFence(root, m, [-9, back], [9, back]);
  torii(root, m, TORII.z);
  for (const s of [-1, 1]) {
    lantern(root, m, s * 3.4, fz + 1.4);
    lantern(root, m, s * 2.5, TORII.z + 3);
    lantern(root, m, s * 2.5, 19, 0.9);
  }
  temizuya(root, m, 6.4, -2.2, -Math.PI / 2);
  emaRack(root, m, -5.8, -3.6, Math.PI / 2);
  annex(root, m, annexFront, 16, -14, -15, Math.PI / 2);
  annex(root, m, annexFront, 12, 14.5, -21, -Math.PI / 2);
  annex(root, m, annexFront, 9, 13.5, 14, -Math.PI / 2);
  annex(root, m, annexFront, 10, -14, 5, Math.PI / 2);
  massha(root, m, paint('#ffffff', hSide), -9.5, 15.5, Math.PI / 2);
  // South boundary with an opening for the approach.
  stoneFence(root, m, [PRECINCT.west, PRECINCT.south], [-3, PRECINCT.south]);
  stoneFence(root, m, [3, PRECINCT.south], [PRECINCT.east, PRECINCT.south]);

  // Trees: three fixed crossed cards each, never turned toward the camera.
  const treeMaterial = cutout(treeMap), shrubMaterial = cutout(shrubMap), shade = leafShade();
  const treeAspect = (treeMap.image as { width: number; height: number }).width / (treeMap.image as { height: number }).height;
  const shrubAspect = (shrubMap.image as { width: number; height: number }).width / (shrubMap.image as { height: number }).height;
  const trees: Array<[number, number, number]> = [
    [-8.5, -0.5, 13], [9.5, -8, 12], [-10.5, 6, 12.5], [10.5, 5.5, 13.5], [-6.5, 15, 11], [7, 17.5, 12],
    [-12, -26, 14], [12, -30, 13], [-4, -38, 14], [6, -39, 13.5], [-5.5, -9, 10],
  ];
  for (let z = -40; z <= 30; z += 6.5) for (const s of [-1, 1]) trees.push([s * (PRECINCT.east + 1.5 + Math.sin(z) * 1.2), z, 12 + Math.abs(Math.sin(z * 1.7)) * 3]);
  for (let x = -16; x <= 16; x += 6) if (Math.abs(x) > 4) trees.push([x + Math.sin(x) * 1.2, PRECINCT.south + 3, 12 + Math.abs(Math.cos(x)) * 2.5]);
  for (let x = -20; x <= 20; x += 7) trees.push([x, -43, 14 + Math.abs(Math.sin(x)) * 2]);
  // Chinju forest between the precinct and the far belt, so no bare ground shows from inside.
  for (const ring of [25, 31, 37]) {
    for (let z = FAR.north + 4; z <= FAR.south - 4; z += 5.5) for (const s of [-1, 1])
      trees.push([s * (ring + Math.sin(z * 2.3 + ring) * 1.5), z + Math.cos(ring) * 2, 13 + Math.abs(Math.sin(z + ring)) * 4]);
    for (let x = -ring; x <= ring; x += 5.5) {
      if (Math.abs(x) > 3.5 || ring > 25) trees.push([x + Math.sin(x + ring) * 1.4, PRECINCT.south + ring - 19, 13 + Math.abs(Math.cos(x)) * 3]);
    }
  }
  trees.forEach(([x, z, height], i) => {
    for (let a = 0; a < 3; a++) {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(height * treeAspect, height), treeMaterial);
      card.position.set(x, height / 2 - 0.05, z); card.rotation.y = a * Math.PI / 3 + i * 0.37; root.add(card);
    }
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(height * 0.85, height * 0.85), shade);
    shadow.rotation.x = -Math.PI / 2; shadow.rotation.z = i; shadow.position.set(x + 0.8, 0.03 + (i % 5) * 0.002, z - 1.2); root.add(shadow);
  });
  const shrubs: Array<[number, number, number]> = [
    [-6.5, fz - 0.8, 1.7], [6.5, fz - 0.8, 1.7], [-9.8, fz - 3, 1.9], [9.8, fz - 4, 1.8],
    [-4.6, TORII.z + 0.8, 1.5], [4.6, TORII.z + 0.6, 1.6], [-7.8, -6, 1.8], [8.6, -5, 1.7],
    [-10.6, -6.5, 1.6], [10.8, -12, 1.8], [-4.5, 23, 1.6], [4.5, 24, 1.7], [9, 21, 1.8], [-11, 18, 1.7],
    [-15, 2, 2], [15.5, 0, 2.1], [-3.2, -33, 1.8], [3.4, -33.5, 1.8],
  ];
  for (const [x, z, height] of shrubs) for (let a = 0; a < 3; a++) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(height * shrubAspect, height), shrubMaterial);
    card.position.set(x, height / 2 - 0.03, z); card.rotation.y = a * Math.PI / 3 + x; root.add(card);
  }
  const edges: Array<[[number, number], [number, number]]> = [
    [[FAR.west, FAR.north], [FAR.east, FAR.north]], [[FAR.east, FAR.south], [FAR.west, FAR.south]],
    [[FAR.west, FAR.south], [FAR.west, FAR.north]], [[FAR.east, FAR.north], [FAR.east, FAR.south]],
  ];
  for (const [from, to] of edges) {
    // Sunk slightly so the belt's soft bottom edge never shows the sky under it.
    const standee = farStandee('Shrine forest', belt, from, to, 64); standee.position.y -= 0.8; root.add(standee);
  }
  worldUvs(root, new Set([m.stone, m.wood, m.darkWood]), 1.6);
  batch(root);
  return root;
}

export function disposePaintedShrine(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  group.removeFromParent();
  for (const resource of [...textures, ...materials, ...geometries]) resource.dispose();
}
