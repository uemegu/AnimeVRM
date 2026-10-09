import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { resolveAssetUrl } from '../../utils/path';
import { farStandee, groundPlane, skyDome } from '../painted-gate/PaintedGate';
import { building } from './Buildings';
import { bench, bookTable, chalkboard, lamp, planter, type FurnitureMaterials } from './StreetFurniture';
import { FAR, SHOP_ROWS, STREET, TREE_ROWS } from './layout';
import { box, canvasTexture, paint, roofTexture, timberTexture } from './materials';

async function texture(file: string, repeat = false): Promise<THREE.Texture> {
  const map = await new THREE.TextureLoader().loadAsync(resolveAssetUrl(`/textures/shopping-street/${file}`));
  map.name = `Shopping street | ${file}`; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  if (repeat) map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

/** Batch static details by their shared material, retaining UVs and all world transforms. */
function batch(root: THREE.Group): void {
  root.updateMatrixWorld(true);
  // Shadow casters stay apart from the buildings that share their materials.
  const groups = new Map<string, THREE.Mesh[]>();
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material) || o.material instanceof THREE.ShaderMaterial) return;
    const key = `${o.material.uuid}:${o.castShadow}`;
    const list = groups.get(key) ?? []; list.push(o); groups.set(key, list);
  });
  for (const objects of groups.values()) {
    const material = objects[0].material as THREE.Material;
    if (objects.length < 2) continue;
    const parts = objects.map(o => (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld));
    const merged = mergeGeometries(parts);
    parts.forEach(p => p.dispose());
    if (!merged) continue;
    for (const o of objects) { o.removeFromParent(); o.geometry.dispose(); }
    const mesh = new THREE.Mesh(merged, material); mesh.name = `Shopping street | ${objects.length} static pieces`;
    mesh.castShadow = objects[0].castShadow; root.add(mesh);
  }
}

/** UV-painted buildings and crossed plants, following the courtyard/sports-ground construction. */
export async function loadShoppingStreet(): Promise<THREE.Group> {
  const [bookshop, florist, gallery, stoneMap, paving, flowers, tree, belt] = await Promise.all([
    texture('bookshop-front.avif'), texture('florist-front.avif'), texture('gallery-front.avif'),
    texture('tile-wall.avif', true), texture('tile-paving.avif', true), texture('flowers.avif'),
    texture('tree.avif'), texture('far-tree-belt.avif'),
  ]);
  const root = new THREE.Group(); root.name = 'Shopping street | walkable painted buildings'; root.add(skyDome());
  paving.repeat.set(30, 38); stoneMap.repeat.set(2, 3);
  root.add(groundPlane('Continuous cobblestone paving', paint('#fff7e9', paving), FAR.west, FAR.east, FAR.south, FAR.north));
  const stone = paint('#e4cda5', stoneMap), iron = paint('#323a36'), gold = paint('#b79a63');
  const wood = paint('#ffffff', timberTexture()), roof = paint('#ffffff', roofTexture());
  const floral = new THREE.MeshBasicMaterial({map:flowers,alphaTest:0.5,side:THREE.DoubleSide,toneMapped:false,fog:false});
  const furniture: FurnitureMaterials = { wood, iron, gold, stone, soil: paint('#483f2e'), flowers: floral };
  const fronts = [bookshop, florist, gallery].map(map => paint('#ffffff', map));
  // Side/rear walls use only the upper residential floors above a separate masonry ground floor.
  const sides = [bookshop, florist, gallery].map(map => {
    const side = map.clone(); side.offset.y = 0.44; side.repeat.y = 0.56; side.needsUpdate = true;
    return paint('#e6dccb', side);
  });
  const materials = { fronts, sides, stone, roof, iron, gold };
  for (const side of [-1, 1]) for (let row = 0; row < SHOP_ROWS.length; row++) {
    const z = SHOP_ROWS[row], facing = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const type = side < 0 ? row % 3 : (row + 2) % 3;
    building(root, materials, type, side * STREET.buildingX, z, facing);
    planter(root, furniture, side * 4.8, z - 2.55, facing);
    planter(root, furniture, side * 4.8, z + 2.55, facing);
    if (type === 0) {
      chalkboard(root, furniture, side * 4.1, z + 1.2, facing);
      bookTable(root, furniture, side * 4.65, z - 1.1, facing);
    } else if (type === 2) bench(root, furniture, side * 4.6, z + 0.7, facing);
  }
  // Both ends of the lane have shops, including behind the starting camera.
  for (const end of [-1, 1]) for (let i = -1; i <= 1; i++) {
    building(root, materials, i + 1, i * 7.5, end * 43, end < 0 ? 0 : Math.PI);
    planter(root, furniture, i * 7.5 - 2.4, end * 38.8);
    planter(root, furniture, i * 7.5 + 2.4, end * 38.8);
  }
  for (const side of [-1, 1]) {
    box(root, 'Continuous curb at tree verge', [0.12, 0.08, 67], [side * 3.15, 0.04, 3], stone);
    for (const z of [-20, -4, 12, 28]) lamp(root, furniture, side * 3.6, z);
  }
  const treeMaterial = new THREE.MeshBasicMaterial({ map: tree, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const shadowMap = canvasTexture(512, 512, ctx => {
    const gradient = ctx.createRadialGradient(256, 256, 20, 256, 256, 250);
    gradient.addColorStop(0, 'rgba(55,55,27,0.3)'); gradient.addColorStop(1, 'rgba(55,55,27,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 380; i++) {
      const x = 256 + Math.sin(i * 43.12) * 235, y = 256 + Math.sin(i * 17.71) * 225;
      ctx.fillStyle = `rgba(61,70,37,${0.035 + 0.1 * (1 - Math.hypot(x - 256, y - 256) / 340)})`;
      ctx.beginPath(); ctx.ellipse(x, y, 6 + i % 8, 3 + i % 4, i, 0, Math.PI * 2); ctx.fill();
    }
  });
  const shade = new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,toneMapped:false,fog:false});
  for (const side of [-1, 1]) for (let i = 0; i < TREE_ROWS.length; i++) {
    const x = side * 3.65, z = TREE_ROWS[i], height = 6.7 + i % 2 * 0.5;
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.74, 0.2, 20), stone); bed.position.set(x, 0.1, z); root.add(bed);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.61, 0.61, 0.015, 20), furniture.soil); soil.position.set(x, 0.208, z); root.add(soil);
    for (let angle = 0; angle < 3; angle++) {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(height * 1043 / 1450, height), treeMaterial);
      card.position.set(x, height / 2 + 0.21, z); card.rotation.y = angle * Math.PI / 3 + i * 0.21; card.castShadow = true; root.add(card);
    }
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 9), shade);
    shadow.rotation.x = -Math.PI / 2; shadow.rotation.z = -0.35; shadow.position.set(x + 0.5, 0.012, z - 1.5); root.add(shadow);
  }
  const edges: Array<[[number, number], [number, number]]> = [
    [[FAR.west, FAR.north], [FAR.east, FAR.north]], [[FAR.east, FAR.south], [FAR.west, FAR.south]],
    [[FAR.west, FAR.south], [FAR.west, FAR.north]], [[FAR.east, FAR.north], [FAR.east, FAR.south]],
  ];
  for (const [from, to] of edges) root.add(farStandee('Distant gardens', belt, from, to, 38));
  batch(root);
  return root;
}

export function disposeShoppingStreet(group: THREE.Group): void {
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
