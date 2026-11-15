import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { castShadows } from '@anime-vrm/engine/scene/castShadows';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';
import { farStandee, groundPlane, skyDome } from '../painted-gate/PaintedGate';
import { box, canvasTexture, paint } from '../shopping-street/materials';
import { CROSS, FAR, HOUSE, LOT, POLE, ROAD, VERGE, WALL, isCrossStreet, lotZ } from './layout';

async function texture(file: string, repeat = false): Promise<THREE.Texture> {
  const map = await new THREE.TextureLoader().loadAsync(resolveAssetUrl(`/textures/residential-street/${file}`));
  map.name = `Residential street | ${file}`; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  if (repeat) map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

/** 絵に光が描き込まれた面。面の向きでの明暗（セル調）は付けない */
function painted(map: THREE.Texture, color = '#ffffff'): THREE.MeshBasicMaterial {
  const material = paint(color, map);
  material.userData.cel = false;
  return material;
}

/** 繰り返しの絵を実寸で貼った箱（tile = 絵1枚ぶんの幅と高さ、メートル） */
function tiledBox(parent: THREE.Object3D, name: string, size: [number, number, number], at: [number, number, number],
  material: THREE.Material, tile: [number, number]): THREE.Mesh {
  const mesh = box(parent, name, size, at, material);
  const uv = mesh.geometry.getAttribute('uv');
  // BoxGeometry の面は +x, -x, +y, -y, +z, -z の順に4頂点ずつ
  const faces: Array<[number, number]> = [[size[2], size[1]], [size[2], size[1]], [size[0], size[2]], [size[0], size[2]], [size[0], size[1]], [size[0], size[1]]];
  for (let i = 0; i < uv.count; i++) {
    const [w, h] = faces[Math.floor(i / 4)];
    uv.setXY(i, uv.getX(i) * w / tile[0], uv.getY(i) * h / tile[1]);
  }
  return mesh;
}

/** 繰り返しの絵を実寸で貼った地面（y=0） */
function tiledGround(name: string, material: THREE.Material, minX: number, maxX: number, nearZ: number, farZ: number, tile: number): THREE.Mesh {
  const mesh = groundPlane(name, material, minX, maxX, nearZ, farZ);
  const uv = mesh.geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (maxX - minX) / tile, uv.getY(i) * (nearZ - farZ) / tile);
  return mesh;
}

/** 瓦の屋根（色違いは material の色で付ける） */
function roofTileTexture(): THREE.Texture {
  const map = canvasTexture(256, 256, ctx => {
    ctx.fillStyle = '#b9bcc0'; ctx.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) for (let column = -1; column < 9; column++) {
      const x = column * 32 + (row % 2) * 16, y = row * 32;
      const shade = 178 + Math.round(Math.sin(row * 7.3 + column * 3.1) * 12);
      ctx.fillStyle = `rgb(${shade},${shade},${shade + 4})`;
      ctx.fillRect(x + 1, y + 1, 30, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 2, y + 2, 28, 3);
      ctx.fillStyle = 'rgba(40,44,52,0.35)'; ctx.fillRect(x + 1, y + 27, 30, 4);
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 3);
  return map;
}

type HouseMaterials = { fronts: THREE.Material[]; side: THREE.Material; roofs: THREE.Material[]; eave: THREE.Material; plain: THREE.Material };

/** 2階建ての家。道路側の面に正面の絵、ほかの3面に側面の絵。屋根は実形状の切妻 */
function house(parent: THREE.Group, m: HouseMaterials, type: number, x: number, z: number, facing: number): void {
  const group = new THREE.Group(); group.name = `Detached house ${type}`;
  const { width: w, height: h, depth: d, roofRise: rise } = HOUSE;
  // 箱の面の順は +x, -x, +y, -y, +z（道路側）, -z
  box(group, 'House walls', [w, h, d], [0, h / 2, 0], [m.side, m.side, m.plain, m.plain, m.fronts[type % m.fronts.length], m.side]);
  const roof = m.roofs[type % m.roofs.length];
  const over = 0.45;
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2 - over, 0); shape.lineTo(0, rise); shape.lineTo(d / 2 + over, 0); shape.closePath();
  const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }), m.eave);
  gable.name = 'Gable end walls'; gable.rotation.y = Math.PI / 2; gable.position.set(-w / 2, h, 0); group.add(gable);
  const slope = Math.atan2(rise, d / 2 + over);
  for (const direction of [-1, 1]) {
    const pitch = box(group, 'Tiled roof slope', [w + 0.7, 0.12, Math.hypot(d / 2 + over, rise) + 0.1], [0, h + rise / 2 + 0.05, direction * (d / 4 + over / 2)], roof);
    pitch.rotation.x = direction * slope;
  }
  box(group, 'Ridge cap', [w + 0.8, 0.16, 0.3], [0, h + rise + 0.08, 0], roof);
  box(group, 'Eave board', [w + 0.5, 0.12, d + over * 2], [0, h - 0.02, 0], m.eave);
  group.position.set(x, 0, z); group.rotation.y = facing; parent.add(group);
}

/** 同じ素材の動かない部品をまとめる（影の目印の有無で分ける） */
function batch(root: THREE.Group): void {
  root.updateMatrixWorld(true);
  const groups = new Map<string, THREE.Mesh[]>();
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material) || o.material instanceof THREE.ShaderMaterial) return;
    const key = `${o.material.uuid}:${o.castShadow}`;
    const list = groups.get(key) ?? []; list.push(o); groups.set(key, list);
  });
  for (const objects of groups.values()) {
    if (objects.length < 2) continue;
    const parts = objects.map(o => (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld));
    const merged = mergeGeometries(parts);
    parts.forEach(p => p.dispose());
    if (!merged) continue;
    for (const o of objects) { o.removeFromParent(); o.geometry.dispose(); }
    const mesh = new THREE.Mesh(merged, objects[0].material as THREE.Material);
    mesh.name = `Residential street | ${objects.length} static pieces`;
    mesh.castShadow = objects[0].castShadow; root.add(mesh);
  }
}

/** 住宅街と長い直線道路。面ごとの絵を貼った家、実形状の屋根・塀・電柱、交差板の庭木 */
export async function loadResidentialStreet(): Promise<THREE.Group> {
  const [frontA, frontB, sideMap, asphaltMap, blockMap, treeMap, belt] = await Promise.all([
    texture('house-front-a.avif'), texture('house-front-b.avif'), texture('house-side.avif'),
    texture('tile-asphalt.avif', true), texture('tile-block-wall.avif', true),
    texture('tree.avif'), texture('far-tree-belt.avif'),
  ]);
  const root = new THREE.Group(); root.name = 'Residential street | long straight road'; root.add(skyDome());

  const asphalt = painted(asphaltMap), blockWall = painted(blockMap), yard = paint('#bdbab1'); yard.userData.cel = false;
  const concrete = paint('#c9c6bd'), poleGrey = paint('#8d8f8c'), dark = paint('#3b3f44');
  const roofMap = roofTileTexture();
  const houses: HouseMaterials = {
    fronts: [painted(frontA), painted(frontB)], side: painted(sideMap),
    roofs: [paint('#5d6470', roofMap), paint('#8b5a48', roofMap), paint('#4f6a7a', roofMap)],
    eave: paint('#efe9dc'), plain: concrete,
  };
  // 路面の線は道路と同じ高さに重ねるので、手前に描かせる
  const line = new THREE.MeshBasicMaterial({ color: '#f4f2ea', toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  line.userData.cel = false;

  // 道路と側溝（重ならない板に分ける）
  root.add(tiledGround('Asphalt road', asphalt, -ROAD.halfWidth, ROAD.halfWidth, ROAD.south, ROAD.north, 4));
  for (const side of [-1, 1]) {
    const inner = side * ROAD.halfWidth, outer = side * VERGE;
    root.add(groundPlane('Concrete gutter', concrete, Math.min(inner, outer), Math.max(inner, outer), ROAD.south, ROAD.north));
    root.add(groundPlane('Road edge line', line, side * (ROAD.halfWidth - 0.35) - 0.06, side * (ROAD.halfWidth - 0.35) + 0.06, ROAD.south, ROAD.north));
  }

  // 区画：交差する道か、家と塀と庭。区画の外の地面（東西の外周まで）も区画ごとに敷く
  const treeMaterial = new THREE.MeshBasicMaterial({ map: treeMap, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const half = LOT.pitch / 2;
  for (let i = 0; i < LOT.count; i++) {
    const z = lotZ(i);
    for (const side of [-1, 1]) {
      const inner = side * VERGE, outer = side > 0 ? FAR.east : FAR.west;
      const minX = Math.min(inner, outer), maxX = Math.max(inner, outer);
      if (isCrossStreet(i)) {
        // 交差する道（中央 CROSS.halfWidth*2 が路面、両脇は庭の地面）
        root.add(tiledGround('Cross street', asphalt, minX, maxX, z + CROSS.halfWidth, z - CROSS.halfWidth, 4));
        root.add(tiledGround('Yard', yard, minX, maxX, z + half, z + CROSS.halfWidth, 3));
        root.add(tiledGround('Yard', yard, minX, maxX, z - CROSS.halfWidth, z - half, 3));
        for (const edge of [1, -1]) {
          const wz = z + edge * (CROSS.halfWidth + 0.4);
          tiledBox(root, 'Corner block wall', [Math.abs(outer - inner) - 0.5, WALL.height, WALL.thickness], [(inner + outer) / 2 + side * 0.25, WALL.height / 2, wz], blockWall, [2.4, 1.3]);
          const fill = half - CROSS.halfWidth - 0.4;
          tiledBox(root, 'Block wall', [WALL.thickness, WALL.height, fill], [side * (VERGE + WALL.thickness / 2), WALL.height / 2, z + edge * (CROSS.halfWidth + 0.4 + fill / 2)], blockWall, [2.4, 1.3]);
        }
        continue;
      }
      root.add(tiledGround('Yard', yard, minX, maxX, z + half, z - half, 3));
      const type = i * 2 + (side > 0 ? 1 : 0);
      house(root, houses, type, side * (VERGE + WALL.thickness + HOUSE.setback + HOUSE.depth / 2), z, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      // 塀：門の開口を残して2枚。門柱と笠木は実形状
      const gateZ = z + (type % 3 - 1) * 2.4;
      const wallX = side * (VERGE + WALL.thickness / 2);
      const south = z + half - (gateZ + WALL.gate / 2), north = gateZ - WALL.gate / 2 - (z - half);
      tiledBox(root, 'Block wall', [WALL.thickness, WALL.height, south], [wallX, WALL.height / 2, gateZ + WALL.gate / 2 + south / 2], blockWall, [2.4, 1.3]);
      tiledBox(root, 'Block wall', [WALL.thickness, WALL.height, north], [wallX, WALL.height / 2, gateZ - WALL.gate / 2 - north / 2], blockWall, [2.4, 1.3]);
      for (const end of [-1, 1]) castShadows(box(root, 'Gate post', [0.32, WALL.height + 0.25, 0.32], [wallX, (WALL.height + 0.25) / 2, gateZ + end * (WALL.gate / 2 + 0.16)], concrete));
      box(root, 'Gate approach', [HOUSE.setback + 0.4, 0.02, WALL.gate - 0.6], [side * (VERGE + (HOUSE.setback + 0.4) / 2), 0.011, gateZ], concrete);
      // 庭木（3区画に2本）。固定の交差板
      if (type % 3 !== 1) {
        const tx = side * (VERGE + 1.5), tz = z + (type % 2 ? 4.6 : -4.6), height = 4.2 + (type % 4) * 0.35;
        for (let angle = 0; angle < 3; angle++) {
          const card = new THREE.Mesh(new THREE.PlaneGeometry(height * 1043 / 1450, height), treeMaterial);
          card.name = 'Garden tree'; card.position.set(tx, height / 2, tz); card.rotation.y = angle * Math.PI / 3 + i * 0.37; card.castShadow = true; root.add(card);
        }
      }
    }
  }

  // 電柱（東側の側溝の上）と電線
  const wires: number[] = [];
  const poles: number[] = [];
  for (let z = ROAD.south - 8; z > ROAD.north + 4; z -= POLE.every) poles.push(z);
  for (const z of poles) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, POLE.height, 10), poleGrey);
    pole.name = 'Utility pole'; pole.position.set(POLE.x, POLE.height / 2, z); root.add(castShadows(pole));
    castShadows(box(root, 'Pole crossarm', [1.5, 0.09, 0.09], [POLE.x, POLE.height - 0.6, z], poleGrey));
    castShadows(box(root, 'Pole transformer', [0.42, 0.62, 0.42], [POLE.x - 0.32, POLE.height - 1.7, z], dark));
  }
  for (let i = 0; i + 1 < poles.length; i++) for (const dx of [-0.65, 0, 0.65]) {
    // 電線は少したるませる（8分割）
    for (let k = 0; k < 8; k++) {
      const at = (t: number) => [POLE.x + dx, POLE.height - 0.55 - 0.5 * 4 * t * (1 - t), poles[i] + (poles[i + 1] - poles[i]) * t];
      wires.push(...at(k / 8), ...at((k + 1) / 8));
    }
  }
  const wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
  const wireLines = new THREE.LineSegments(wireGeometry, new THREE.LineBasicMaterial({ color: '#2c2f33', toneMapped: false, fog: false }));
  wireLines.name = 'Power lines'; root.add(wireLines);

  // 道の両端の止まれ線と、外周の樹木帯
  for (const z of [ROAD.south - 1, ROAD.north + 1]) root.add(groundPlane('Stop line', line, -ROAD.halfWidth + 0.5, ROAD.halfWidth - 0.5, z + 0.22, z - 0.22));
  const edges: Array<[[number, number], [number, number]]> = [
    [[FAR.west, FAR.north], [FAR.east, FAR.north]], [[FAR.east, FAR.south], [FAR.west, FAR.south]],
    [[FAR.west, FAR.south], [FAR.west, FAR.north]], [[FAR.east, FAR.north], [FAR.east, FAR.south]],
  ];
  for (const [from, to] of edges) root.add(farStandee('Distant trees', belt, from, to, 38));
  batch(root);
  return root;
}

export function disposeResidentialStreet(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  group.removeFromParent();
  for (const resource of [...textures, ...materials, ...geometries]) resource.dispose();
}
