import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { resolveAssetUrl } from '../../utils/path';
import { farStandee, groundPlane, skyDome } from '../painted-gate/PaintedGate';
import { BENCH, CENTRAL_TREE, CYCLE_PARKING, FAR, FIELD, FIELD_ENTRY, GATE, GYM, OUTER_VERGES, PLANTERS, SCHOOL, SCHOOL_ROOF_HEIGHT, TRACK, TREES, WING, type Planter } from './layout';

const TEXTURES = '/textures/painted-ground';

async function texture(url: string, repeat = false): Promise<THREE.Texture> {
  const map = await new THREE.TextureLoader().loadAsync(resolveAssetUrl(url));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  map.name = url;
  if (repeat) map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

function paint(color: string, map?: THREE.Texture): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, map, toneMapped: false, fog: false });
}

function box(name: string, size: [number, number, number], at: [number, number, number], material: THREE.Material | THREE.Material[]): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...at);
  return mesh;
}

/** All thin bars/nets are batched into one draw per colour. */
function bars(name: string, segments: THREE.BufferGeometry[], color: string): THREE.Mesh {
  const geometry = mergeGeometries(segments);
  segments.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(geometry, paint(color));
  mesh.name = name;
  return mesh;
}

/** Oval chalk lines are real horizontal ribbons; they stay readable from eye level. */
function track(): THREE.Mesh {
  const vertices: number[] = [];
  const line = (points: THREE.Vector2[], closed: boolean) => {
    const count = points.length;
    for (let i = 0; i < count - (closed ? 0 : 1); i++) {
      const a = points[i], b = points[(i + 1) % count];
      const n = new THREE.Vector2(b.y - a.y, a.x - b.x).normalize().multiplyScalar(0.055);
      const p = (v: THREE.Vector2, side: number) => [v.x + n.x * side, 0.025, v.y + n.y * side];
      vertices.push(...p(a, -1), ...p(b, -1), ...p(a, 1), ...p(a, 1), ...p(b, -1), ...p(b, 1));
    }
  };
  for (let lane = 0; lane <= TRACK.lanes; lane++) {
    const radius = TRACK.radius + lane * TRACK.laneWidth;
    const points: THREE.Vector2[] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = i / 64 * Math.PI;
      points.push(new THREE.Vector2(TRACK.x + Math.cos(angle) * radius, TRACK.z - TRACK.straight - Math.sin(angle) * radius));
    }
    for (let i = 0; i <= 64; i++) {
      const angle = i / 64 * Math.PI;
      points.push(new THREE.Vector2(TRACK.x - Math.cos(angle) * radius, TRACK.z + TRACK.straight + Math.sin(angle) * radius));
    }
    line(points, true);
  }
  // Finish line across the near straight; the football rectangle inside the track.
  line([new THREE.Vector2(TRACK.x + TRACK.radius, 10), new THREE.Vector2(TRACK.x + TRACK.radius + TRACK.lanes * TRACK.laneWidth, 10)], false);
  const corners = [[-37, -24], [-13, -24], [-13, 20], [-37, 20]].map(([x, z]) => new THREE.Vector2(x, z));
  line(corners, true);
  line([new THREE.Vector2(-37, -2), new THREE.Vector2(-13, -2)], false);
  const circle = Array.from({ length: 65 }, (_, i) => new THREE.Vector2(-25 + 4 * Math.cos(i / 65 * Math.PI * 2), -2 + 4 * Math.sin(i / 65 * Math.PI * 2)));
  line(circle, true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  const material = paint('#f5eedb');
  material.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Track | four lanes and football markings';
  return mesh;
}

/** Goal frames with fine open netting, including sides and roof. */
function goal(x: number, z: number, facing: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Football goal';
  const frame: THREE.BufferGeometry[] = [];
  const net: THREE.BufferGeometry[] = [];
  const beam = (w: number, h: number, d: number, px: number, py: number, pz: number) => new THREE.BoxGeometry(w, h, d).translate(px, py, pz);
  for (const side of [-1, 1]) {
    frame.push(beam(0.09, 2.4, 0.09, side * 3, 1.2, 0), beam(0.06, 2.4, 0.06, side * 3, 1.2, -1.3));
    frame.push(beam(0.06, 0.06, 1.3, side * 3, 0.05, -0.65), beam(0.06, 0.06, 1.3, side * 3, 2.4, -0.65));
    for (let y = 0.2; y < 2.4; y += 0.2) net.push(beam(0.009, 0.009, 1.3, side * 3, y, -0.65));
    for (let nz = -1.3; nz < 0; nz += 0.2) net.push(beam(0.009, 2.4, 0.009, side * 3, 1.2, nz));
  }
  frame.push(beam(6.1, 0.09, 0.09, 0, 2.4, 0), beam(6, 0.06, 0.06, 0, 2.4, -1.3));
  for (let px = -3; px <= 3; px += 0.2) {
    net.push(beam(0.009, 2.4, 0.009, px, 1.2, -1.3), beam(0.009, 0.009, 1.3, px, 2.4, -0.65));
  }
  for (let y = 0.2; y < 2.4; y += 0.2) net.push(beam(6, 0.009, 0.009, 0, y, -1.3));
  for (let nz = -1.3; nz < 0; nz += 0.2) net.push(beam(6, 0.009, 0.009, 0, 2.4, nz));
  group.add(bars('Goal | frame', frame, '#eeeadd'), bars('Goal | net', net, '#cbd1c3'));
  group.position.set(x, 0, z);
  group.rotation.y = facing;
  return group;
}

/** Plain school sideline bench: three wooden slats, a backrest and painted steel legs. */
function bench(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Sideline bench | wooden slats on steel legs';
  const { length, seatHeight } = BENCH;
  // Lit top, shaded front, darker ends, matching the unlit painted look of the set.
  const wood = [paint('#7a5232'), paint('#7a5232'), paint('#a97b4f'), paint('#4f3420'), paint('#8c603a'), paint('#8c603a')];
  for (const z of [-0.12, 0, 0.12]) group.add(box('Bench | seat slat', [length, 0.035, 0.1], [0, seatHeight - 0.018, z], wood));
  for (const y of [0.62, 0.76]) group.add(box('Bench | backrest slat', [length, 0.09, 0.03], [0, y, -0.22], wood));
  const frame: THREE.BufferGeometry[] = [];
  for (const x of [-length / 2 + 0.2, length / 2 - 0.2]) {
    frame.push(new THREE.BoxGeometry(0.04, seatHeight - 0.035, 0.04).translate(x, (seatHeight - 0.035) / 2, 0.14));
    frame.push(new THREE.BoxGeometry(0.04, 0.82, 0.04).translate(x, 0.41, -0.2));
    frame.push(new THREE.BoxGeometry(0.04, 0.03, 0.4).translate(x, seatHeight - 0.05, -0.03));
    frame.push(new THREE.BoxGeometry(0.04, 0.03, 0.36).translate(x, 0.08, -0.03));
  }
  group.add(bars('Bench | steel frame', frame, '#3f5f67'));
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(length + 0.3, 0.7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#5b4a36', transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false, fog: false }));
  shade.name = 'Bench | ground shade';
  shade.position.set(0.12, 0.015, 0.05);
  group.add(shade);
  group.position.set(BENCH.x, 0, BENCH.z);
  group.rotation.y = BENCH.facing;
  return group;
}

/** Open chain-link mesh, with a real post/rail frame and a clear passage to the courtyard. */
function fence(from: [number, number], to: [number, number], height: number): THREE.Group {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const group = new THREE.Group();
  group.name = height > 3 ? 'Ball-stop fence' : 'Campus boundary fence';
  const frame: THREE.BufferGeometry[] = [];
  for (let x = 0; x <= length + 0.01; x += length / Math.ceil(length / 5)) {
    frame.push(new THREE.BoxGeometry(0.09, height + 0.1, 0.09).translate(x, height / 2, 0));
  }
  for (const y of [0.2, height / 2, height]) frame.push(new THREE.BoxGeometry(length, 0.055, 0.055).translate(length / 2, y, 0));
  group.add(bars('Fence | posts', frame, '#527a76'));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = '#628f87';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 32); ctx.lineTo(32, 0); ctx.lineTo(64, 32); ctx.lineTo(32, 64); ctx.closePath();
  ctx.stroke();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(length / 0.24, height / 0.24);
  const material = new THREE.MeshBasicMaterial({ map, alphaTest: 0.25, alphaToCoverage: true, side: THREE.DoubleSide, toneMapped: false });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(length, height), material);
  net.position.set(length / 2, height / 2, 0);
  net.name = 'Fence | open mesh';
  group.add(net);
  group.position.set(from[0], 0, from[1]);
  group.rotation.y = -Math.atan2(to[1] - from[1], to[0] - from[0]);
  return group;
}

/** Barrel roof is a curved shell, rather than a gym painting that floats above a box. */
function gym(facade: THREE.Material, wall: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Gym | east of the courtyard';
  group.add(box('Gym walls', [GYM.width, GYM.wallHeight, GYM.depth], [GYM.x, GYM.wallHeight / 2, GYM.z], [facade, facade, wall, wall, facade, facade]));
  const cross = new THREE.Shape();
  cross.moveTo(-GYM.width / 2, 0);
  for (let i = 0; i <= 32; i++) {
    const angle = Math.PI - i / 32 * Math.PI;
    cross.lineTo(Math.cos(angle) * GYM.width / 2, Math.sin(angle) * GYM.roofRise);
  }
  cross.lineTo(-GYM.width / 2, 0);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(cross, { depth: GYM.depth, bevelEnabled: false, steps: 1 }), paint('#9dabb8'));
  roof.position.set(GYM.x, GYM.wallHeight, GYM.z - GYM.depth / 2);
  roof.name = 'Gym | arched metal roof';
  group.add(roof);
  const ribs: THREE.BufferGeometry[] = [];
  for (let z = -GYM.depth / 2; z <= GYM.depth / 2; z += 1.4) {
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 33 }, (_, i) => {
      const angle = Math.PI - i / 32 * Math.PI;
      return new THREE.Vector3(GYM.x + Math.cos(angle) * (GYM.width / 2 + 0.03), GYM.wallHeight + Math.sin(angle) * (GYM.roofRise + 0.04), GYM.z + z);
    }));
    ribs.push(new THREE.TubeGeometry(curve, 32, 0.025, 3, false));
  }
  group.add(bars('Gym | roof seams', ribs, '#e0e5e5'));
  return group;
}

function bedOutline(bed: Planter, inset = 0): THREE.Shape {
  const shape = new THREE.Shape();
  const w = bed.width / 2 - inset, d = bed.depth / 2 - inset;
  if (bed.circular) {
    shape.absarc(0, 0, w, 0, Math.PI * 2, false);
    return shape;
  }
  const r = Math.max(0.05, Math.min(bed.radius - inset, w, d));
  shape.moveTo(-w + r, -d);
  shape.lineTo(w - r, -d); shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r); shape.quadraticCurveTo(w, d, w - r, d);
  shape.lineTo(-w + r, d); shape.quadraticCurveTo(-w, d, -w, d - r);
  shape.lineTo(-w, -d + r); shape.quadraticCurveTo(-w, -d, -w + r, -d);
  shape.closePath();
  return shape;
}

/** A hollow raised edging, with lower soil inside; foliage cannot cover its rim. */
function planter(bed: Planter, top: THREE.Material, side: THREE.Material, soil: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = `Planted enclosure | ${bed.id}`;
  const shape = bedOutline(bed);
  const hole = new THREE.Path(bedOutline(bed, 0.26).getPoints(24).reverse());
  shape.holes.push(hole);
  const edge = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.36, bevelEnabled: false, curveSegments: 8 }).rotateX(-Math.PI / 2), [top, side]);
  edge.name = 'Planter | continuous raised stone rim';
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(bedOutline(bed, 0.28), 24).rotateX(-Math.PI / 2), soil);
  fill.position.y = CENTRAL_TREE.base;
  fill.name = 'Planter | recessed planted soil';
  group.add(edge, fill);
  group.position.set(bed.x, 0, bed.z);
  return group;
}

/** Low hedges stay inside the stone rim, with the same painted foliage as the trees. */
function shrubs(beds: readonly Planter[], foliage: THREE.Texture): THREE.Mesh {
  const geometries: THREE.BufferGeometry[] = [];
  for (const { x, z, width, depth, circular } of beds) {
    const columns = Math.max(1, Math.floor((width - 2) / 1.2) + 1);
    const rows = Math.max(1, Math.floor((depth - 2) / 1.2) + 1);
    for (let col = 0; col < columns; col++) {
      for (let row = 0; row < rows; row++) {
        const px = (col - (columns - 1) / 2) * 1.2, pz = (row - (rows - 1) / 2) * 1.2;
        if (circular && Math.hypot(px, pz) > width / 2 - 1) continue;
        const variation = Math.sin((px + x) * 13.7 + (pz + z) * 4.6);
        for (let face = 0; face < 2; face++) {
          const height = 0.65 + variation * 0.07;
          const g = new THREE.PlaneGeometry(1.35, height);
          const uv = g.getAttribute('uv');
          for (let i = 0; i < uv.count; i++) uv.setY(i, 0.35 + uv.getY(i) * 0.65);
          g.rotateY(face * Math.PI / 2 + variation * 0.2).translate(x + px, CENTRAL_TREE.base + height / 2, z + pz);
          geometries.push(g);
        }
      }
    }
  }
  const merged = mergeGeometries(geometries);
  geometries.forEach((g) => g.dispose());
  const material = new THREE.MeshBasicMaterial({ map: foliage, color: '#c5d5aa', alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const mesh = new THREE.Mesh(merged, material);
  mesh.name = 'Courtyard | painted low hedges';
  return mesh;
}

/** The map's bicycle shelter is across the courtyard, behind the planted divider. */
function cycleParking(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Cycle parking | beyond the courtyard planting';
  const p = CYCLE_PARKING;
  const asphalt = groundPlane('Cycle parking | asphalt bays', paint('#859093'), p.minX, p.maxX, p.maxZ, p.minZ);
  asphalt.position.y = 0.02;
  group.add(asphalt);
  const steel: THREE.BufferGeometry[] = [];
  const roofRibs: THREE.BufferGeometry[] = [];
  const markings: THREE.BufferGeometry[] = [];
  const beam = (from: THREE.Vector3, to: THREE.Vector3, radius: number): THREE.BufferGeometry => {
    const direction = new THREE.Vector3().subVectors(to, from);
    const g = new THREE.CylinderGeometry(radius, radius, direction.length(), 5);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
    const middle = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    return g.translate(middle.x, middle.y, middle.z);
  };
  const x0 = p.roofX - p.roofWidth / 2, x1 = p.roofX + p.roofWidth / 2;
  const z0 = p.roofZ - p.roofDepth / 2, z1 = p.roofZ + p.roofDepth / 2;
  // Long edge parallels the main school facade, as in the map.
  for (let x = x0; x <= x1 + 0.01; x += p.roofWidth / 5) {
    for (const z of [z0 + 0.2, z1 - 0.2]) {
      const height = z < p.roofZ ? 2.7 : 2.35;
      steel.push(new THREE.BoxGeometry(0.085, height, 0.085).translate(x, height / 2, z));
    }
    steel.push(beam(new THREE.Vector3(x, 2.7, z0), new THREE.Vector3(x, 2.35, z1), 0.035));
  }
  for (const z of [z0 + 0.2, z1 - 0.2]) steel.push(new THREE.BoxGeometry(p.roofWidth, 0.1, 0.06).translate(p.roofX, z < p.roofZ ? 2.65 : 2.3, z));
  const roofGeometry = new THREE.BufferGeometry();
  roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    x0 - 0.25, 2.75, z0 - 0.4, x0 - 0.25, 2.38, z1 + 0.4, x1 + 0.25, 2.75, z0 - 0.4,
    x1 + 0.25, 2.75, z0 - 0.4, x0 - 0.25, 2.38, z1 + 0.4, x1 + 0.25, 2.38, z1 + 0.4,
  ], 3));
  roofGeometry.computeVertexNormals();
  const roofMaterial = paint('#d3dce0');
  roofMaterial.side = THREE.DoubleSide;
  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.name = 'Cycle parking | sloping silver roof';
  group.add(roof);
  for (let x = x0 - 0.25; x <= x1 + 0.25; x += 0.55) roofRibs.push(beam(new THREE.Vector3(x, 2.77, z0 - 0.4), new THREE.Vector3(x, 2.4, z1 + 0.4), 0.014));
  group.add(bars('Cycle parking | steel columns and beams', steel, '#596e77'));
  group.add(bars('Cycle parking | roof seams', roofRibs, '#f1f2ea'));
  for (let z = p.minZ + 1; z < p.maxZ; z += 2.2) {
    markings.push(new THREE.BoxGeometry(p.maxX - p.minX - 1.5, 0.004, 0.06).translate((p.minX + p.maxX) / 2, 0.03, z));
  }
  markings.push(new THREE.BoxGeometry(0.06, 0.004, p.maxZ - p.minZ - 1).translate(p.minX + 0.6, 0.03, (p.minZ + p.maxZ) / 2));
  group.add(bars('Cycle parking | painted bay lines', markings, '#d6dcda'));
  const tires: THREE.BufferGeometry[] = [], frames: THREE.BufferGeometry[] = [], rims: THREE.BufferGeometry[] = [];
  for (const row of [0, 1]) {
    for (let i = 0; i < 12; i++) {
      const at = new THREE.Matrix4().makeRotationY(row ? Math.PI / 2 - 0.12 : -Math.PI / 2 - 0.12);
      at.setPosition(x0 + 0.65 + i * 1.15, 0, p.roofZ + (row ? 1.2 : -1.2));
      for (const x of [-0.57, 0.57]) {
        tires.push(new THREE.TorusGeometry(0.33, 0.024, 5, 20).translate(x, 0.36, 0).applyMatrix4(at));
        rims.push(new THREE.TorusGeometry(0.295, 0.009, 4, 20).translate(x, 0.36, 0).applyMatrix4(at));
        for (let spoke = 0; spoke < 6; spoke++) {
          const angle = spoke * Math.PI / 3;
          rims.push(beam(new THREE.Vector3(x, 0.36, 0), new THREE.Vector3(x + Math.cos(angle) * 0.29, 0.36 + Math.sin(angle) * 0.29, 0), 0.004).applyMatrix4(at));
        }
      }
      const points = [new THREE.Vector3(-0.57, 0.36, 0), new THREE.Vector3(-0.2, 0.83, 0), new THREE.Vector3(0.04, 0.38, 0), new THREE.Vector3(0.43, 0.81, 0), new THREE.Vector3(0.57, 0.36, 0)];
      for (const [a, b] of [[0, 1], [1, 2], [2, 0], [1, 3], [3, 2], [3, 4]]) frames.push(beam(points[a], points[b], 0.017).applyMatrix4(at));
      frames.push(beam(points[3], new THREE.Vector3(0.4, 1.02, 0), 0.013).applyMatrix4(at));
      rims.push(beam(new THREE.Vector3(0.4, 1.02, -0.23), new THREE.Vector3(0.4, 1.02, 0.23), 0.012).applyMatrix4(at));
      tires.push(new THREE.BoxGeometry(0.25, 0.045, 0.15).translate(-0.2, 0.91, 0).applyMatrix4(at));
    }
  }
  group.add(bars('Cycle parking | bicycle tires and saddles', tires, '#35464d'));
  group.add(bars('Cycle parking | bicycle frames', frames, '#526b7d'));
  group.add(bars('Cycle parking | bicycle rims and handlebars', rims, '#bac4c7'));
  return group;
}

/** Same roof level and slender roof fencing on both arms of the L-shaped school. */
function terrace(name: string, minX: number, maxX: number, minZ: number, maxZ: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `${name} | roof terrace`;
  const rails: THREE.BufferGeometry[] = [];
  const height = 1.25;
  for (const z of [minZ, maxZ]) {
    for (const y of [SCHOOL_ROOF_HEIGHT + 0.2, SCHOOL_ROOF_HEIGHT + height]) rails.push(new THREE.BoxGeometry(maxX - minX, 0.035, 0.035).translate((minX + maxX) / 2, y, z));
    for (let x = minX; x <= maxX; x += 2) rails.push(new THREE.BoxGeometry(0.035, height, 0.035).translate(x, SCHOOL_ROOF_HEIGHT + height / 2, z));
  }
  for (const x of [minX, maxX]) {
    for (const y of [SCHOOL_ROOF_HEIGHT + 0.2, SCHOOL_ROOF_HEIGHT + height]) rails.push(new THREE.BoxGeometry(0.035, 0.035, maxZ - minZ).translate(x, y, (minZ + maxZ) / 2));
    for (let z = minZ; z <= maxZ; z += 2) rails.push(new THREE.BoxGeometry(0.035, height, 0.035).translate(x, SCHOOL_ROOF_HEIGHT + height / 2, z));
  }
  group.add(bars(`${name} | roof safety rails`, rails, '#8aabb6'));
  return group;
}

function campus(facade: THREE.Texture, side: THREE.Texture, foliage: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Campus | school, courtyard and gate';
  const wall = paint('#ddd6c6');
  const facadeTile = (width: number, height: number) => {
    const tile = side.clone();
    tile.repeat.set(width / 4.8, height / SCHOOL_ROOF_HEIGHT);
    return paint('#d5dde0', tile);
  };
  const sideWall = facadeTile(SCHOOL.depth, SCHOOL_ROOF_HEIGHT);
  const front = new THREE.MeshBasicMaterial({ map: facade, alphaTest: 0.5, toneMapped: false, side: THREE.DoubleSide, fog: false });
  // Solid box stops views through the painted facade; clock tower is in its cutout.
  group.add(box('Main school | volume', [SCHOOL.width, SCHOOL_ROOF_HEIGHT, SCHOOL.depth], [SCHOOL.x, SCHOOL_ROOF_HEIGHT / 2, SCHOOL.z - SCHOOL.depth / 2], [sideWall, sideWall, wall, wall, wall, facadeTile(SCHOOL.width, SCHOOL_ROOF_HEIGHT)]));
  group.add(box('Main school | clock tower depth', [SCHOOL.width * 0.12, SCHOOL.height - SCHOOL_ROOF_HEIGHT, 3], [SCHOOL.x, (SCHOOL.height + SCHOOL_ROOF_HEIGHT) / 2, SCHOOL.z - 1.5], wall));
  // The edited facade's clock centre is at pixel 1057 / 2171. Anchor that bay to
  // the courtyard axis while keeping both facade edges on the solid building.
  const elevationGeometry = new THREE.PlaneGeometry(SCHOOL.width, SCHOOL.height, 2, 1);
  const elevationUv = elevationGeometry.getAttribute('uv');
  for (let i = 0; i < elevationUv.count; i++) {
    if (elevationUv.getX(i) === 0.5) elevationUv.setX(i, 1057 / 2171);
  }
  const elevation = new THREE.Mesh(elevationGeometry, front);
  elevation.position.set(SCHOOL.x, SCHOOL.height / 2, SCHOOL.z + 0.02);
  elevation.name = 'Main school | painted clock facade';
  group.add(elevation);
  group.add(box('East school wing', [WING.width, WING.height, WING.depth], [WING.x, WING.height / 2, WING.z], [facadeTile(WING.depth, WING.height), facadeTile(WING.depth, WING.height), wall, wall, facadeTile(WING.width, WING.height), facadeTile(WING.width, WING.height)]));
  group.add(terrace('Main school', SCHOOL.x - SCHOOL.width / 2, SCHOOL.x + SCHOOL.width / 2, SCHOOL.z - SCHOOL.depth, SCHOOL.z));
  group.add(terrace('East school wing', WING.x - WING.width / 2, WING.x + WING.width / 2, WING.z - WING.depth / 2, WING.z + WING.depth / 2));
  group.add(box('School entrance | projecting canopy', [14, 0.18, 2.2], [SCHOOL.x, 4, SCHOOL.z + 1.1], wall));
  group.add(gym(facadeTile(GYM.width, GYM.wallHeight), wall));
  const curbTop = paint('#e4e1d5'), curbSide = paint('#9fa9ac'), plantedSoil = paint('#8b8064');
  const beds = [...PLANTERS, ...OUTER_VERGES];
  for (const bed of beds) group.add(planter(bed, curbTop, curbSide, plantedSoil));
  group.add(shrubs(beds, foliage), cycleParking());
  // Paths and courtyard are part of the continuous paved base, including both entry gaps.
  // Gate faces the street to the south. Leave the opening empty and keep the guardhouse to its east.
  for (const x of [GATE.x - GATE.opening / 2 - 0.4, GATE.x + GATE.opening / 2 + 0.4]) {
    group.add(box('Gate pillar', [0.8, GATE.height + 0.4, 0.8], [x, (GATE.height + 0.4) / 2, GATE.z], wall));
  }
  for (const [left, right] of [[FIELD.minX, GATE.x - GATE.opening / 2 - 0.8], [GATE.x + GATE.opening / 2 + 0.8, FAR.east]]) {
    group.add(box('South perimeter wall', [right - left, 0.7, 0.3], [(left + right) / 2, 0.35, GATE.z], wall));
  }
  const gateBars: THREE.BufferGeometry[] = [];
  const start = GATE.x - GATE.opening / 2, end = GATE.x - 1;
  for (let x = start; x <= end; x += 0.18) gateBars.push(new THREE.BoxGeometry(0.04, 1.8, 0.04).translate(x, 0.95, GATE.z));
  for (const y of [0.1, 1.85]) gateBars.push(new THREE.BoxGeometry(end - start, 0.07, 0.06).translate((start + end) / 2, y, GATE.z));
  group.add(bars('Gate | half-open sliding bars', gateBars, '#495c63'));
  const guardWindows = facadeTile(4.5, 3.3);
  group.add(box('Guardhouse', [4.5, 2.6, 4], [41, 1.3, 33], [guardWindows, guardWindows, wall, wall, guardWindows, guardWindows]));
  group.add(box('Guardhouse roof', [5, 0.16, 4.5], [41, 2.7, 33], wall));
  const street = groundPlane('South | street outside the gate', paint('#7a8592'), FAR.west, FAR.east, 45, 38);
  street.position.y = 0.02;
  group.add(street);
  for (let x = FAR.west; x < FAR.east; x += 8) group.add(box('Street | centre marking', [4, 0.01, 0.08], [x + 2, 0.035, 41.5], paint('#d7d8c8')));
  return group;
}

export async function loadPaintedGround(): Promise<THREE.Group> {
  const [facade, tree, conifer, dirt, side, paving, treeBelt] = await Promise.all([
    texture(`${TEXTURES}/school-front.avif`), texture(`${TEXTURES}/tree.avif`), texture(`${TEXTURES}/conifer.avif`),
    texture(`${TEXTURES}/tile-soil.avif`, true), texture(`${TEXTURES}/school-side.avif`, true), texture('/textures/painted-gate/tile-paving.avif', true), texture(`${TEXTURES}/far-tree-belt.avif`),
  ]);
  side.repeat.set(2, 1);
  paving.repeat.set((FAR.east - FAR.west) / 4, (FAR.south - FAR.north) / 4);
  dirt.repeat.set((FIELD.maxX - FIELD.minX) / 5, (FIELD.maxZ - FIELD.minZ) / 5);
  const group = new THREE.Group();
  group.name = 'Painted sports ground';
  group.add(skyDome());
  group.add(groundPlane('Campus | continuous paving outside the sports ground', paint('#f0ece0', paving), FAR.west, FAR.east, FAR.south, FAR.north));
  const fieldSoil = groundPlane('Field | soil only inside the sports ground', paint('#dadbd5', dirt), FIELD.minX, FIELD.maxX, FIELD.maxZ, FIELD.minZ);
  fieldSoil.position.y = 0.01;
  group.add(fieldSoil);
  const greenBelt = paint('#5a785b');
  for (const [name, minX, maxX, nearZ, farZ] of [
    ['West tree-belt floor', FAR.west, -64, FIELD.maxZ, FAR.north],
    ['North tree-belt floor', FAR.west, FIELD.maxX, -49, FAR.north],
    ['East tree-belt floor', 67, FAR.east, 38, -8],
    ['South tree-belt floor', FAR.west, FAR.east, FAR.south, 48],
  ] as const) {
    const floor = groundPlane(name, greenBelt, minX, maxX, nearZ, farZ);
    floor.position.y = 0.02;
    group.add(floor);
  }
  group.add(track(), goal(-25, -24, 0), goal(-25, 20, Math.PI), bench());
  group.add(campus(facade, side, tree));
  side.dispose(); // Only the per-wall clones are used by the meshes.
  group.add(fence([FIELD.minX, FIELD.maxZ], [FIELD.minX, FIELD.minZ], 6));
  group.add(fence([FIELD.minX, FIELD.minZ], [FIELD.maxX, FIELD.minZ], 6));
  group.add(fence([FIELD.minX, FIELD.maxZ], [FIELD.maxX, FIELD.maxZ], 3));
  // The map has tall ball-stop netting along the courtyard side, with a clear passage.
  group.add(fence([FIELD.maxX, FIELD.minZ], [FIELD.maxX, FIELD_ENTRY.z - FIELD_ENTRY.halfWidth], 6));
  group.add(fence([FIELD.maxX, FIELD_ENTRY.z + FIELD_ENTRY.halfWidth], [FIELD.maxX, FIELD.maxZ], 6));
  const treeMaterial = new THREE.MeshBasicMaterial({ map: tree, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const image = tree.image as { width: number; height: number };
  const aspect = image.width / image.height;
  const treeGeometry = new THREE.PlaneGeometry(aspect, 1);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#526954', transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false });
  const shadowGeometry = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
  // Three intersecting cards keep foliage visible from all four sides; canopy layers have real depth.
  for (const [x, z, height] of TREES) {
    for (let angle = 0; angle < 3; angle++) {
      const mesh = new THREE.Mesh(treeGeometry, treeMaterial);
      mesh.name = 'Campus tree | painted cutout';
      mesh.position.set(x, CENTRAL_TREE.base + height / 2, z);
      mesh.scale.setScalar(height);
      mesh.rotation.y = angle * Math.PI / 3;
      group.add(mesh);
    }
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.name = 'Tree | ground shade';
    shadow.position.set(x + 1.2, CENTRAL_TREE.base + 0.003, z + 1.5);
    shadow.scale.set(height * 0.45, 1, height * 0.3);
    group.add(shadow);
  }
  const coniferImage = conifer.image as { width: number; height: number };
  const coniferGeometry = new THREE.PlaneGeometry(CENTRAL_TREE.height * coniferImage.width / coniferImage.height, CENTRAL_TREE.height);
  const coniferMaterial = new THREE.MeshBasicMaterial({ map: conifer, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, toneMapped: false, fog: false });
  for (let angle = 0; angle < 3; angle++) {
    const tree = new THREE.Mesh(coniferGeometry, coniferMaterial);
    tree.name = 'Courtyard | central conifer in round enclosure';
    tree.position.set(CENTRAL_TREE.x, CENTRAL_TREE.base + CENTRAL_TREE.height / 2, CENTRAL_TREE.z);
    tree.rotation.y = angle * Math.PI / 3;
    group.add(tree);
  }
  for (const [name, from, to] of [
    ['Far | west tree belt', [FAR.west, FAR.south], [FAR.west, FAR.north]],
    ['Far | north tree belt', [FAR.west, FAR.north], [FAR.east, FAR.north]],
    ['Far | tree belt beyond the south street', [FAR.east, FAR.south], [FAR.west, FAR.south]],
    ['Far | east tree belt', [FAR.east, FAR.north], [FAR.east, FAR.south]],
  ] as [string, [number, number], [number, number]][]) {
    const far = farStandee(name, treeBelt, from, to, FAR.repeat);
    // Fixed 12m canopy height, independent of image padding/aspect ratio.
    far.scale.y = 12 / (far.geometry as THREE.PlaneGeometry).parameters.height;
    far.position.y = 6;
    (far.material as THREE.MeshBasicMaterial).fog = false;
    (far.material as THREE.MeshBasicMaterial).color.set('#b4c8be');
    group.add(far);
  }
  return group;
}

export function disposePaintedGround(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  group.removeFromParent();
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((map) => map.dispose());
}
