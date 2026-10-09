import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { resolveAssetUrl } from '../../utils/path';
import { castShadowsOfAdded } from '../castShadows';
import { COURT, GYM, STAGE, WINDOW_BAYS } from './layout';

const paint = (color: string, map?: THREE.Texture) =>
  new THREE.MeshBasicMaterial({ color, map, toneMapped: false, fog: false });

/** Supplementary straight grain for solid joinery; the walls/floor retain their paintings. */
function joineryTexture(): THREE.Texture {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('体育館の木目素材を作成できません');
  ctx.fillStyle = '#b78b5d'; ctx.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 90; i++) {
    const y = i * 31 % 128;
    ctx.strokeStyle = i % 3 ? 'rgba(91,58,32,0.14)' : 'rgba(246,218,174,0.2)';
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.026 + i) * 1.3);
    ctx.stroke();
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
}

function box(root: THREE.Object3D, name: string, size: [number, number, number],
  at: [number, number, number], material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name; mesh.position.set(...at); root.add(mesh); return mesh;
}

function rod(root: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material): void {
  const delta = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 6), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); root.add(mesh);
}

function floorLine(root: THREE.Group, points: Array<[number, number]>, material: THREE.Material, width = 0.045): void {
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const dx = bx - ax, dz = bz - az;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(dx, dz) + width / 2, width), material);
    mesh.rotation.set(-Math.PI / 2, 0, -Math.atan2(dz, dx));
    mesh.position.set((ax + bx) / 2, 0.009, (az + bz) / 2); root.add(mesh);
  }
}

function circle(root: THREE.Group, x: number, z: number, radius: number, material: THREE.Material,
  start = 0, end = Math.PI * 2): void {
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= 80; i++) {
    const angle = start + (end - start) * i / 80;
    points.push([x + Math.cos(angle) * radius, z + Math.sin(angle) * radius]);
  }
  floorLine(root, points, material);
}

function goal(root: THREE.Group, side: number, iron: THREE.Material, white: THREE.Material): void {
  const x = side * COURT.hoopX, z = COURT.z;
  box(root, 'Basketball backboard', [0.065, 1.05, 1.8], [x, 3.55, z], white);
  const border = paint('#4c3930'), rim = paint('#c36730'), net = paint('#dcc9a2');
  for (const edge of [-1, 1]) {
    box(root, 'Backboard edge', [0.08, 0.035, 1.82], [x - side * 0.045, 3.55 + edge * 0.51, z], border);
    box(root, 'Backboard edge', [0.08, 1.05, 0.035], [x - side * 0.045, 3.55, z + edge * 0.89], border);
    box(root, 'Target square', [0.085, 0.035, 0.6], [x - side * 0.05, 3.4 + edge * 0.225, z], border);
    box(root, 'Target square', [0.085, 0.45, 0.035], [x - side * 0.05, 3.4, z + edge * 0.3], border);
    rod(root, new THREE.Vector3(side * 11.8, 4.1, z + edge * 0.6), new THREE.Vector3(x, 3.6, z + edge * 0.6), 0.045, iron);
    rod(root, new THREE.Vector3(side * 11.8, 2.65, z + edge * 0.6), new THREE.Vector3(x, 3.2, z + edge * 0.6), 0.045, iron);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.018, 6, 32), rim);
  ring.rotation.x = Math.PI / 2; ring.position.set(x - side * 0.3, 3.05, z); root.add(ring);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    for (const direction of [-1, 1]) rod(root,
      new THREE.Vector3(x - side * 0.3 + Math.cos(a) * 0.23, 3.05, z + Math.sin(a) * 0.23),
      new THREE.Vector3(x - side * 0.3 + Math.cos(a + direction * 0.5) * 0.12, 2.63, z + Math.sin(a + direction * 0.5) * 0.12), 0.004, net);
  }
}

function equipment(root: THREE.Group, wood: THREE.Material, iron: THREE.Material): void {
  const blue = paint('#334c76'), blueTop = paint('#62789a'), leather = paint('#d2b287'), dark = paint('#493326');
  // Actual layered vaults with a padded top, handles and visible thickness on every side.
  for (const x of [-7.7, -6.3]) {
    for (let level = 0; level < 6; level++) {
      const width = 1.05 - level * 0.065, y = 0.1 + level * 0.155;
      box(root, 'Vault wooden tier', [width, 0.145, 1.15 - level * 0.06], [x, y, -10], wood);
      for (const side of [-1, 1]) box(root, 'Vault handle inset', [0.2, 0.035, 0.008], [x, y, -10 + side * (1.15 - level * 0.06) / 2], dark);
    }
    box(root, 'Padded vault top', [0.75, 0.16, 0.86], [x, 1.02, -10], leather);
  }
  box(root, 'Stacked blue exercise mat', [3.6, 0.28, 1.85], [-3.7, 0.14, -10.8], blue);
  box(root, 'Upper padded mat', [3.6, 0.1, 1.85], [-3.7, 0.33, -10.8], blueTop);
  box(root, 'Mat seam', [3.6, 0.012, 0.013], [-3.7, 0.24, -9.87], blueTop);
  // Open wire basket, wheels and individual basketballs, rather than a furniture cutout.
  const cartX = -10.3, cartZ = -10.6;
  for (const dx of [-0.65, 0.65]) for (const dz of [-0.4, 0.4]) {
    box(root, 'Ball cart post', [0.025, 1.0, 0.025], [cartX + dx, 0.68, cartZ + dz], iron);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.055, 12), dark);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(cartX + dx, 0.09, cartZ + dz); root.add(wheel);
  }
  for (const y of [0.25, 0.55, 0.85, 1.15]) {
    for (const dz of [-0.4, 0.4]) box(root, 'Cart horizontal wire', [1.3, 0.018, 0.018], [cartX, y, cartZ + dz], iron);
    for (const dx of [-0.65, 0.65]) box(root, 'Cart horizontal wire', [0.018, 0.018, 0.8], [cartX + dx, y, cartZ], iron);
  }
  for (let i = 0; i <= 8; i++) for (const dz of [-0.4, 0.4])
    box(root, 'Cart vertical wire', [0.012, 0.9, 0.012], [cartX - 0.65 + i * 1.3 / 8, 0.7, cartZ + dz], iron);
  box(root, 'Cart bottom', [1.3, 0.03, 0.8], [cartX, 0.23, cartZ], iron);
  const ball = paint('#ab592a'), seam = paint('#563424');
  for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 3; i++) for (const j of [-1, 1]) {
    const center = new THREE.Vector3(cartX - 0.42 + i * 0.4, 0.46 + layer * 0.38, cartZ + j * 0.19);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), ball); mesh.position.copy(center); root.add(mesh);
    for (let axis = 0; axis < 2; axis++) {
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.004, 4, 24), seam);
      stripe.position.copy(center); stripe.rotation.y = axis * Math.PI / 2; root.add(stripe);
    }
  }
  for (const x of [-9, 9]) {
    box(root, 'Bench seat', [3.2, 0.07, 0.43], [x, 0.45, 13.8], wood);
    for (const dx of [-1.25, 1.25]) box(root, 'Bench legs', [0.09, 0.42, 0.35], [x + dx, 0.21, 13.8], iron);
  }
}

/** Keep this batch local to an identity root, before Stage applies location placement. */
function batch(root: THREE.Group): void {
  root.updateMatrixWorld(true);
  // Shadow casters stay apart from the walls that share their materials.
  const groups = new Map<string, THREE.Mesh[]>();
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material) || o.material.transparent) return;
    const key = `${o.material.uuid}:${o.castShadow}`;
    const list = groups.get(key) ?? []; list.push(o); groups.set(key, list);
  });
  for (const objects of groups.values()) {
    const material = objects[0].material as THREE.Material;
    if (objects.length < 2) continue;
    const parts = objects.map(o => (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld));
    const merged = mergeGeometries(parts); parts.forEach(p => p.dispose());
    if (!merged) continue;
    for (const o of objects) { o.removeFromParent(); o.geometry.dispose(); }
    const mesh = new THREE.Mesh(merged, material); mesh.name = `Gym | ${objects.length} static pieces`;
    mesh.castShadow = objects[0].castShadow; root.add(mesh);
  }
}

/** Four independently UV-painted walls, a tiled floor, and solid stage/equipment/roof. */
export async function loadPaintedGym(): Promise<THREE.Group> {
  const [stageMap, windowMap, rearMap, floorMap] = await Promise.all(
    ['stage-wall', 'window-wall', 'rear-wall', 'floor-tile'].map(async file => {
      const map = await new THREE.TextureLoader().loadAsync(resolveAssetUrl(`/textures/painted-gym/${file}.avif`));
      map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; return map;
    }));
  const root = new THREE.Group(); root.name = 'Painted gym | sunset school sports hall';
  const floorTile = floorMap.clone(); floorTile.wrapS = floorTile.wrapT = THREE.RepeatWrapping;
  floorTile.repeat.set(GYM.width / 4, GYM.depth / 4); floorTile.needsUpdate = true;
  const wood = paint('#ffffff', joineryTexture()), iron = paint('#716355'), trim = paint('#b78b59');
  const roofMap = floorMap.clone(); roofMap.wrapS = roofMap.wrapT = THREE.RepeatWrapping;
  roofMap.repeat.set(3, 8); roofMap.needsUpdate = true;
  const roof = paint('#6f665f', roofMap), white = paint('#e4d7bb');
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(GYM.width, GYM.depth), paint('#ffffff', floorTile));
  floor.rotation.x = -Math.PI / 2; floor.name = 'Continuous wood sports floor'; root.add(floor);
  // Thick walls enclose all sides; the images are local elevations, independent of viewing angle.
  const wallEdge = paint('#987753');
  box(root, 'North wall thickness', [24.4, 8.5, 0.2], [0, 4.25, -16.1], wallEdge);
  // Window sky cutouts must not have an opaque box behind them.
  box(root, 'South lower wall thickness', [24.4, 4.7, 0.2], [0, 2.35, 16.1], wallEdge);
  box(root, 'South upper wall thickness', [24.4, 0.3, 0.2], [0, 8.35, 16.1], wallEdge);
  for (const side of [-1, 1]) {
    box(root, 'Side lower wall thickness', [0.2, 3.3, 32], [side * 12.1, 1.65, 0], wallEdge);
    box(root, 'Side upper wall thickness', [0.2, 0.6, 32], [side * 12.1, 8.2, 0], wallEdge);
  }
  const stageWall = new THREE.Mesh(new THREE.PlaneGeometry(24, 8.5), paint('#ffffff', stageMap));
  stageWall.position.set(0, 4.25, -15.994); root.add(stageWall);
  const rearWall = new THREE.Mesh(new THREE.PlaneGeometry(24, 8.5), paint('#ffffff', rearMap));
  (rearWall.material as THREE.MeshBasicMaterial).alphaTest = 0.5;
  (rearWall.material as THREE.MeshBasicMaterial).alphaToCoverage = true;
  rearWall.position.set(0, 4.25, 15.994); rearWall.rotation.y = Math.PI; root.add(rearWall);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(32, 8.5), paint(side < 0 ? '#ffffff' : '#cfc4b6', windowMap));
    (wall.material as THREE.MeshBasicMaterial).alphaTest = 0.5;
    (wall.material as THREE.MeshBasicMaterial).alphaToCoverage = true;
    wall.rotation.y = -side * Math.PI / 2; wall.position.set(side * 11.994, 4.25, 0); root.add(wall);
    box(root, 'Gallery ledge', [0.88, 0.14, 32], [side * 11.52, 2.75, 0], wood);
    for (const y of [2.98, 3.6]) box(root, 'Gallery continuous rail', [0.045, 0.045, 32], [side * 11.08, y, 0], iron);
    for (let z = -15.8; z <= 16; z += 0.55) box(root, 'Gallery baluster', [0.028, 0.82, 0.028], [side * 11.08, 3.19, z], iron);
    for (let bay = 0; bay <= 7; bay++) box(root, 'Structural wall column', [0.14, 8.5, 0.2], [side * 11.86, 4.25, -16 + bay * 32 / 7], iron);
    castShadowsOfAdded(root, () => goal(root, side, iron, white));
  }
  // Pitched roof planes, closed gables and real steel trusses visible from the gallery.
  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(12, 2.2), 32).rotateX(-Math.PI / 2), roof);
    slope.material.side = THREE.DoubleSide;
    slope.rotation.z = -side * Math.atan2(2.2, 12);
    slope.position.set(side * 6, 9.6, 0); root.add(slope);
  }
  const gable = new THREE.Shape(); gable.moveTo(-12, 0); gable.lineTo(12, 0); gable.lineTo(0, 2.2); gable.closePath();
  const gableMaterial = paint('#76695d'); gableMaterial.side = THREE.DoubleSide;
  for (const z of [-16, 16]) {
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(gable), gableMaterial); mesh.position.set(0, 8.5, z); root.add(mesh);
  }
  for (const z of [-14, -10, -6, -2, 2, 6, 10, 14]) {
    rod(root, new THREE.Vector3(-12, 8.2, z), new THREE.Vector3(12, 8.2, z), 0.065, iron);
    for (const side of [-1, 1]) {
      rod(root, new THREE.Vector3(side * 12, 8.5, z), new THREE.Vector3(0, 10.7, z), 0.085, iron);
      for (let i = 0; i < 4; i++) {
        const x = side * i * 3;
        rod(root, new THREE.Vector3(x, 10.7 - Math.abs(x) * 2.2 / 12, z), new THREE.Vector3(x + side * 3, 8.2, z), 0.035, iron);
        rod(root, new THREE.Vector3(x, 8.2, z), new THREE.Vector3(x, 10.7 - Math.abs(x) * 2.2 / 12, z), 0.032, iron);
      }
    }
    for (const x of [-6, 6]) {
      rod(root, new THREE.Vector3(x, 9.6, z), new THREE.Vector3(x, 7.7, z), 0.012, iron);
      const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 16, 1, true), trim);
      lamp.position.set(x, 7.6, z); root.add(lamp);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.21, 20), paint('#ffe0a0'));
      glow.rotation.x = Math.PI / 2; glow.position.set(x, 7.48, z); root.add(glow);
    }
  }
  box(root, 'Solid stage platform', [STAGE.width, STAGE.height, STAGE.depth], [0, STAGE.height / 2, STAGE.z], wood);
  box(root, 'Stage front molding', [14, 0.09, 0.09], [0, STAGE.height - 0.04, -12.75], trim);
  for (const side of [-1, 1]) for (let step = 0; step < 7; step++) {
    const height = (step + 1) * STAGE.height / 7;
    box(root, 'Stage side stairs', [0.95, height, 0.35], [side * 7.53, height / 2, -12.6 - step * 0.35], wood);
  }
  castShadowsOfAdded(root, () => equipment(root, wood, iron));
  const courtPaint = paint('#e8ddba'), yellow = paint('#b9a154'), green = paint('#667d65');
  floorLine(root, [[-10, -8.5], [10, -8.5], [10, 3.5], [-10, 3.5], [-10, -8.5]], courtPaint);
  floorLine(root, [[0, -8.5], [0, 3.5]], courtPaint); circle(root, 0, COURT.z, 1.8, courtPaint);
  for (const side of [-1, 1]) {
    floorLine(root, [[side * 10, -4.95], [side * 6.4, -4.95], [side * 6.4, -0.05], [side * 10, -0.05]], courtPaint);
    circle(root, side * 6.4, COURT.z, 1.5, courtPaint, side < 0 ? -Math.PI / 2 : Math.PI / 2, side < 0 ? Math.PI / 2 : 3 * Math.PI / 2);
  }
  floorLine(root, [[-6.7, -9], [6.7, -9], [6.7, 9], [-6.7, 9], [-6.7, -9]], yellow, 0.035);
  for (const z of [-3, 0, 3]) floorLine(root, [[-6.7, z], [6.7, z]], yellow, 0.035);
  floorLine(root, [[-3.1, -11], [3.1, -11], [3.1, 11], [-3.1, 11], [-3.1, -11]], green, 0.03);
  // Fixed translucent window-light patches preserve the reference's warm floor lighting.
  // These are separate geometry from the court marks, so the painted floor remains tileable.
  const sun = new THREE.MeshBasicMaterial({ color: '#ffd37c', transparent: true, opacity: 0.17, depthWrite: false, toneMapped: false, fog: false });
  for (const z of WINDOW_BAYS) {
    const shape = new THREE.Shape(); shape.moveTo(-11.6, z - 1.4); shape.lineTo(-2.6, z - 5); shape.lineTo(-2.6, z - 2.2); shape.lineTo(-11.6, z + 1.4); shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), sun); mesh.rotation.x = -Math.PI / 2;
    // Shape y becomes world -z; reflect the polygon to match its intended north/south position.
    mesh.scale.y = -1; mesh.position.y = 0.012; mesh.material.side = THREE.DoubleSide; root.add(mesh);
  }
  batch(root); return root;
}

export function disposePaintedGym(root: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  root.removeFromParent(); for (const resource of [...textures, ...materials, ...geometries]) resource.dispose();
}
