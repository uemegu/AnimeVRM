import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { resolveAssetUrl } from '../../utils/path';
import { castShadows } from '../castShadows';
import {
  BACK_Z, BED, BED_TOP_LENGTH, BOOKCASE, DESK, DESK_CHAIR, FRONT_Z, HEIGHT, LEFT_X, LOW_TABLE, NIGHTSTAND, RIGHT_X, RUG,
} from './layout';

/**
 * Painted 2.5D bedroom of Aoi: each wall is one generated painting, the floor and rug
 * are tiles, and the furniture is modelled with painted faces (bed side/foot/top,
 * bookcase front, table top) so it can be sat on and shot from any side. The sky
 * outside the balcony door is not painted: the viewer's SkyBackground shows through.
 * Layout and units: see layout.ts.
 */
const TEXTURE_DIR = '/textures/painted-aoi-room';

const WOOD_DARK = '#b98656';
const WHITE_WOOD = '#f1e9dc';

async function texture(file: string): Promise<THREE.Texture> {
  const map = await new THREE.TextureLoader().loadAsync(resolveAssetUrl(`${TEXTURE_DIR}/${file}`));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

function painted(map: THREE.Texture, cutout = false): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ map, toneMapped: false, side: THREE.DoubleSide });
  // The paintings carry their own light; only the plain modelled parts get the cel light/shade.
  material.userData.cel = false;
  if (cutout) {
    material.alphaTest = 0.5;
    material.alphaToCoverage = true;
  }
  return material;
}

function flat(color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false });
}

function plane(name: string, material: THREE.Material, width: number, height: number,
  position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  return mesh;
}

/** wood.avif covers this many metres; box UVs are rescaled so the grain keeps its size on every part. */
const WOOD_TILE = 0.6;

/** Box UVs in metres / WOOD_TILE, grain (texture u) along each face's longer side. */
function woodBox(size: [number, number, number]): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(...size);
  const uv = geometry.getAttribute('uv');
  const [x, y, z] = size;
  // Face order +x, -x, +y, -y, +z, -z; each face's (u, v) extents in metres.
  const faces: [number, number][] = [[z, y], [z, y], [x, z], [x, z], [x, y], [x, y]];
  faces.forEach(([w, h], face) => {
    for (let i = face * 4; i < face * 4 + 4; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      if (w >= h) uv.setXY(i, u * w / WOOD_TILE, v * h / WOOD_TILE);
      else uv.setXY(i, v * h / WOOD_TILE, u * w / WOOD_TILE);
    }
  });
  return geometry;
}

function box(name: string, material: THREE.Material | THREE.Material[], size: [number, number, number],
  position: [number, number, number]): THREE.Mesh {
  const mesh = new THREE.Mesh(woodBox(size), material);
  mesh.name = name;
  mesh.position.set(...position);
  return mesh;
}

/** Yellow-and-white gingham for pillows and cushions. */
function ginghamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fffaf0';
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = 'rgba(244, 196, 64, 0.55)';
  for (let i = 0; i < 4; i++) {
    context.fillRect(i * 32, 0, 16, 128);
    context.fillRect(0, i * 32, 128, 16);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);
  return map;
}

/** Shaggy rug: tiled pile with a rounded, slightly ragged outline. */
function rug(pile: THREE.Texture): THREE.Mesh {
  const width = RUG.maxX - RUG.minX, depth = RUG.maxZ - RUG.minZ;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round(512 * depth / width);
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff';
  const r = 18, pad = 6;
  context.beginPath();
  context.roundRect(pad, pad, canvas.width - pad * 2, canvas.height - pad * 2, r);
  context.fill();
  // Ragged tufts along the edge.
  const random = (seed: number) => { const x = Math.sin(seed * 91.7) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < 900; i++) {
    const t = random(i) * 2 * (canvas.width + canvas.height);
    const x = t < canvas.width ? t : t < canvas.width + canvas.height ? canvas.width - pad : t < 2 * canvas.width + canvas.height ? t - canvas.width - canvas.height : pad;
    const y = t < canvas.width ? pad : t < canvas.width + canvas.height ? t - canvas.width : t < 2 * canvas.width + canvas.height ? canvas.height - pad : t - 2 * canvas.width - canvas.height;
    context.fillStyle = random(i + 0.5) > 0.45 ? '#fff' : '#000';
    context.beginPath();
    context.arc(x, y, 2 + random(i + 0.3) * 4, 0, Math.PI * 2);
    context.fill();
  }
  const alphaMap = new THREE.CanvasTexture(canvas);
  pile.wrapS = pile.wrapT = THREE.RepeatWrapping;
  pile.repeat.set(width / 0.8, depth / 0.8);
  const material = new THREE.MeshBasicMaterial({ map: pile, alphaMap, alphaTest: 0.5, toneMapped: false });
  material.userData.cel = false;
  const mesh = plane('Rug', material, width, depth, [(RUG.minX + RUG.maxX) / 2, 0.012, (RUG.minZ + RUG.maxZ) / 2], [-Math.PI / 2, 0, 0]);
  return mesh;
}

/** Opaque bounding box of a cut-out painting, in UV (0-1, v up). */
function alphaBounds(map: THREE.Texture): { u0: number; u1: number; v0: number; v1: number } {
  const image = map.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width, right = 0, top = canvas.height, bottom = 0;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    if (data[(y * canvas.width + x) * 4 + 3] < 128) continue;
    left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
  }
  return { u0: left / canvas.width, u1: right / canvas.width, v0: 1 - bottom / canvas.height, v1: 1 - top / canvas.height };
}

/** A cut-out painting cropped to its opaque bounds and stretched over width x height (optionally mirrored). */
function croppedCutout(name: string, map: THREE.Texture, width: number, height: number, mirror = false): THREE.Mesh {
  const b = alphaBounds(map);
  map.offset.set(mirror ? b.u1 : b.u0, b.v0);
  map.repeat.set((mirror ? -1 : 1) * (b.u1 - b.u0), b.v1 - b.v0);
  return plane(name, painted(map, true), width, height, [0, 0, 0]);
}

/** Card standing on y=0 whose opaque part is `height` metres tall, keeping the painting's aspect. */
function standee(name: string, map: THREE.Texture, height: number): THREE.Mesh {
  const b = alphaBounds(map);
  const image = map.image as { width: number; height: number };
  const aspect = (b.u1 - b.u0) * image.width / ((b.v1 - b.v0) * image.height);
  const mesh = croppedCutout(name, map, height * aspect, height);
  mesh.geometry.translate(0, height / 2, 0);
  return mesh;
}

function bed(side: THREE.Texture, foot: THREE.Texture, top: THREE.Texture, gingham: THREE.Texture, wood: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Bed';
  const width = BED.maxX - BED.minX, length = BED.footZ - BED.headZ;
  const cx = (BED.minX + BED.maxX) / 2, cz = (BED.headZ + BED.footZ) / 2;
  // Inner block kept just inside the painted faces.
  group.add(box('Bed body', flat('#fbf6ec'), [width - 0.02, BED.top - 0.01, length - 0.02], [cx, (BED.top - 0.01) / 2, cz]));
  // Painted with the head end on the left; seen from the room the head end is on the right, so mirror it.
  const sideMesh = croppedCutout('Bed side', side, length, BED.top, true);
  sideMesh.position.set(BED.maxX + 0.004, BED.top / 2, cz);
  sideMesh.rotation.y = Math.PI / 2;
  group.add(sideMesh);
  const footMesh = croppedCutout('Bed foot', foot, width, BED.top);
  footMesh.position.set(cx, BED.top / 2, BED.footZ + 0.004);
  group.add(footMesh);
  top.wrapS = top.wrapT = THREE.ClampToEdgeWrapping;
  group.add(plane('Bed top', painted(top), width, BED_TOP_LENGTH, [cx, BED.top + 0.002, BED.footZ - BED_TOP_LENGTH / 2], [-Math.PI / 2, 0, 0]));
  const pillowZone = length - BED_TOP_LENGTH;
  group.add(plane('Bed top under pillows', flat('#fbf6ec'), width, pillowZone, [cx, BED.top + 0.002, BED.headZ + pillowZone / 2], [-Math.PI / 2, 0, 0]));
  // Headboard with a shelf on top.
  const headboard = new THREE.MeshBasicMaterial({ map: wood, toneMapped: false });
  group.add(box('Headboard', headboard, [width + 0.04, BED.headboardTop, 0.05], [cx, BED.headboardTop / 2, FRONT_Z + 0.025]));
  group.add(box('Headboard shelf', headboard, [width + 0.04, 0.03, 0.16], [cx, BED.headboardTop + 0.015, FRONT_Z + 0.08]));
  // Pillows: a white one, a gingham one and a round white "flower" cushion in front.
  const white = flat('#fffdf7');
  const check = new THREE.MeshBasicMaterial({ map: gingham, toneMapped: false });
  const pillow = (name: string, material: THREE.Material, size: [number, number, number], at: [number, number, number], tilt: number) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 3, Math.min(...size) * 0.45), material);
    mesh.name = name;
    mesh.position.set(...at);
    mesh.rotation.x = tilt;
    group.add(mesh);
  };
  pillow('Pillow', white, [0.62, 0.14, 0.38], [cx - 0.08, BED.top + 0.09, BED.headZ + 0.24], -0.5);
  pillow('Pillow gingham', check, [0.46, 0.4, 0.13], [cx + 0.12, BED.top + 0.2, BED.headZ + 0.32], -0.25);
  const petals = new THREE.Group();
  petals.name = 'Flower cushion';
  for (let i = 0; i < 6; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), white);
    const a = (i / 6) * Math.PI * 2;
    petal.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0);
    petal.scale.set(1, 1, 0.5);
    petals.add(petal);
  }
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), flat('#f2c53d'));
  heart.scale.set(1, 1, 0.6);
  heart.position.z = 0.03;
  petals.add(heart);
  petals.position.set(cx - 0.18, BED.top + 0.2, BED.headZ + 0.45);
  petals.rotation.x = -0.25;
  group.add(petals);
  return group;
}

/**
 * The yellow throw: a separate cloth laid across the foot of the bed, hanging over the room
 * side and the foot end (the bed paintings show only the duvet). throw.avif is the whole
 * blanket laid flat (fringe on the short ends); its flat grid is wrapped over the mattress
 * edges with a small radius, and waves are added where it hangs.
 */
const THROW = { width: 1.3, length: 1.0, onTopZ: 0.72, edgeRadius: 0.025, lift: 0.012 } as const;

function throwBlanket(map: THREE.Texture): THREE.Mesh {
  const { width, length, onTopZ, edgeRadius: r, lift } = THROW;
  const geometry = new THREE.PlaneGeometry(width, length, 64, 48);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const b = alphaBounds(map);
  const top = BED.top + lift;
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    // Flat position on the bed's top plane: u runs across the bed from the wall, v toward the foot.
    const xf = BED.minX + 0.01 + u * width;
    const zf = BED.footZ - onTopZ + (1 - v) * length;
    const bx = Math.min(xf, BED.maxX), bz = Math.min(zf, BED.footZ);
    const ox = xf - bx, oz = zf - bz, d = Math.hypot(ox, oz);
    // Gentle lumps on top, deeper waves where it hangs.
    const wave = Math.sin(xf * 23 + zf * 7) * 0.5 + Math.sin(zf * 31 - xf * 11) * 0.5;
    if (d === 0) {
      point.set(xf, top + wave * 0.006, zf);
    } else {
      const dx = ox / d, dz = oz / d;
      const arc = r * Math.PI / 2;
      let out: number, down: number;
      if (d < arc) {
        const angle = d / r;
        out = r * Math.sin(angle);
        down = r * (1 - Math.cos(angle));
      } else {
        out = r;
        down = r + d - arc;
      }
      // Folds along the hem grow with the hanging depth.
      const along = dx > dz ? zf : xf;
      out += Math.sin(along * 26) * 0.012 * Math.min(1, down / 0.12);
      point.set(bx + dx * (out + 0.006), Math.max(0.03, top - down), bz + dz * (out + 0.006));
    }
    position.setXYZ(i, point.x, point.y, point.z);
    uv.setXY(i, b.u0 + u * (b.u1 - b.u0), b.v0 + v * (b.v1 - b.v0));
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = painted(map, true);
  // The generated knit is more saturated than the reference room; tone it toward the duvet's warm white.
  material.color.set('#f2e3bf');
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Throw blanket';
  return mesh;
}

function nightstand(wood: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Nightstand';
  const w = NIGHTSTAND.maxX - NIGHTSTAND.minX, d = NIGHTSTAND.frontZ - FRONT_Z, h = NIGHTSTAND.height;
  const cx = (NIGHTSTAND.minX + NIGHTSTAND.maxX) / 2;
  const body = new THREE.MeshBasicMaterial({ map: wood, toneMapped: false });
  group.add(box('Nightstand body', body, [w, h, d], [cx, h / 2, FRONT_Z + d / 2]));
  for (const y of [0.17, 0.4]) {
    group.add(box('Nightstand drawer gap', flat(WOOD_DARK), [w - 0.06, 0.008, 0.004], [cx, y, NIGHTSTAND.frontZ + 0.002]));
    group.add(box('Nightstand knob', flat('#e9dfcf'), [0.04, 0.015, 0.015], [cx, y - 0.1, NIGHTSTAND.frontZ + 0.008]));
  }
  // Table lamp.
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 20), flat('#f6efe1'));
  lampBase.position.set(cx, h + 0.09, FRONT_Z + d / 2);
  group.add(lampBase);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.16, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#fff4d8', toneMapped: false, side: THREE.DoubleSide }));
  shade.position.set(cx, h + 0.25, FRONT_Z + d / 2);
  group.add(shade);
  return group;
}

/** Oval low table: painted top (cut-out stadium), wood edge, splayed white legs. */
function lowTable(top: THREE.Texture, wood: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Low table';
  const { width, depth, height } = LOW_TABLE;
  const topMesh = croppedCutout('Low table top', top, width, depth);
  topMesh.rotation.x = -Math.PI / 2;
  topMesh.position.y = height + 0.001;
  group.add(topMesh);
  // Stadium outline like the painted top (straight sides, round ends).
  const r = depth / 2 - 0.004, half = width / 2 - 0.004 - r;
  const shape = new THREE.Shape();
  shape.moveTo(-half, -r);
  shape.lineTo(half, -r);
  shape.absarc(half, 0, r, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-half, r);
  shape.absarc(-half, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false, curveSegments: 48 }),
    new THREE.MeshBasicMaterial({ map: wood, toneMapped: false }));
  slab.name = 'Low table edge';
  slab.rotation.x = Math.PI / 2;
  slab.position.y = height - 0.001;
  group.add(slab);
  const legMaterial = flat('#ece8e2');
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.011, height - 0.02, 12), legMaterial);
    leg.name = 'Low table leg';
    leg.position.set(sx * width * 0.3, (height - 0.02) / 2, sz * depth * 0.24);
    leg.rotation.set(sz * 0.12, 0, -sx * 0.12);
    group.add(leg);
  }
  group.position.set(LOW_TABLE.x, 0, LOW_TABLE.z);
  return group;
}

function desk(wood: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Desk';
  const w = DESK.maxX - DESK.minX, d = DESK.maxZ - DESK.minZ, h = DESK.height;
  const cx = (DESK.minX + DESK.maxX) / 2, cz = (DESK.minZ + DESK.maxZ) / 2;
  const body = new THREE.MeshBasicMaterial({ map: wood, toneMapped: false });
  group.add(box('Desk top', body, [w, 0.03, d], [cx, h - 0.015, cz]));
  // Drawer pedestal on the window side, open leg on the other.
  const pedestalD = 0.4;
  group.add(box('Desk pedestal', body, [w - 0.04, h - 0.03, pedestalD], [cx + 0.02, (h - 0.03) / 2, DESK.minZ + pedestalD / 2]));
  for (const y of [0.18, 0.42, 0.6]) {
    group.add(box('Desk drawer gap', flat(WOOD_DARK), [0.004, 0.008, pedestalD - 0.05], [DESK.minX + 0.019, y, DESK.minZ + pedestalD / 2]));
    group.add(box('Desk knob', flat('#e9dfcf'), [0.015, 0.015, 0.05], [DESK.minX + 0.017, y + 0.09, DESK.minZ + pedestalD / 2]));
  }
  group.add(box('Desk leg panel', body, [w - 0.04, h - 0.03, 0.025], [cx + 0.02, (h - 0.03) / 2, DESK.maxZ - 0.0125]));
  // Desk lamp (arm lamp at the bookcase end, clear of the shots from the window end) and a few books.
  const white = flat('#f7f3ea');
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 20), white);
  lampBase.position.set(RIGHT_X - 0.15, h + 0.01, DESK.maxZ - 0.12);
  group.add(lampBase);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 8), white);
  arm.position.set(RIGHT_X - 0.2, h + 0.21, DESK.maxZ - 0.12);
  arm.rotation.z = 0.25;
  group.add(arm);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#f7f3ea', side: THREE.DoubleSide, toneMapped: false }));
  shade.position.set(RIGHT_X - 0.3, h + 0.4, DESK.maxZ - 0.12);
  shade.rotation.z = 0.7;
  group.add(shade);
  const colors = ['#e9b949', '#9bc4a8', '#e8a0a0', '#8fb3d9'];
  colors.forEach((color, i) => {
    group.add(box('Desk book', flat(color), [0.16, 0.025, 0.23], [RIGHT_X - 0.14, h + 0.0125 + i * 0.026, DESK.minZ + 0.2 + (i % 2) * 0.02]));
  });
  group.add(box('Desk notebook', flat('#fbf6e8'), [0.22, 0.008, 0.3], [DESK.minX + 0.2, h + 0.004, cz + 0.1]));
  return group;
}

/** Wooden chair facing +x (the desk), yellow seat cushion. */
function chair(wood: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Desk chair';
  const body = new THREE.MeshBasicMaterial({ map: wood, toneMapped: false });
  const seat = DESK_CHAIR.seat, half = 0.21;
  group.add(box('Chair seat', body, [0.42, 0.03, 0.42], [0, seat - 0.05, 0]));
  group.add(box('Chair cushion', flat('#f3cd4f'), [0.38, 0.035, 0.38], [0, seat - 0.018, 0]));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const legHeight = sx < 0 ? DESK_CHAIR.top : seat - 0.065;
    group.add(box('Chair leg', body, [0.03, legHeight, 0.03], [sx * (half - 0.02), legHeight / 2, sz * (half - 0.02)]));
  }
  for (const y of [0.62, 0.78]) group.add(box('Chair back rail', body, [0.025, 0.06, 0.4], [-(half - 0.02), y, 0]));
  group.position.set(DESK_CHAIR.x, 0, DESK_CHAIR.z);
  return group;
}

function bookcase(front: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Bookcase';
  const d = BOOKCASE.maxX - BOOKCASE.minX, w = BOOKCASE.maxZ - BOOKCASE.minZ, h = BOOKCASE.height;
  const cz = (BOOKCASE.minZ + BOOKCASE.maxZ) / 2;
  group.add(box('Bookcase body', flat(WHITE_WOOD), [d - 0.01, h - 0.01, w - 0.01], [BOOKCASE.minX + d / 2 + 0.005, (h - 0.01) / 2, cz]));
  group.add(plane('Bookcase front', painted(front), w, h, [BOOKCASE.minX, h / 2, cz], [0, -Math.PI / 2, 0]));
  return group;
}

/** Floor cushion: a squashed rounded box. */
function cushion(name: string, material: THREE.Material, size: number, at: [number, number], round = false): THREE.Mesh {
  const geometry = round
    ? new THREE.SphereGeometry(size / 2, 32, 16).scale(1, 0.3, 1)
    : new RoundedBoxGeometry(size, 0.13, size, 4, 0.06);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(at[0], round ? size * 0.15 + 0.01 : 0.075, at[1]);
  return mesh;
}

export async function loadPaintedAoiRoom(): Promise<THREE.Group> {
  const [front, left, right, back, floor, pile, bedSide, bedFoot, bedTop, shelf, tableTop, bear, shiba, wood, throwMap] = await Promise.all([
    'wall-front.avif', 'wall-left.avif', 'wall-right.avif', 'wall-back.avif', 'floor.avif', 'rug.avif',
    'bed-side.avif', 'bed-foot.avif', 'bed-top.avif', 'bookshelf.avif', 'table-top.avif', 'plush-bear.avif', 'plush-shiba.avif', 'wood.avif', 'throw.avif',
  ].map(texture));
  const width = RIGHT_X - LEFT_X, depth = BACK_Z - FRONT_Z;
  const cx = (LEFT_X + RIGHT_X) / 2, cz = (FRONT_Z + BACK_Z) / 2;
  const group = new THREE.Group();
  group.name = 'Painted Aoi room';

  floor.wrapS = floor.wrapT = THREE.RepeatWrapping;
  floor.repeat.set(width / 1.8, depth / 1.8);
  group.add(plane('Floor', painted(floor), width, depth, [cx, 0, cz], [-Math.PI / 2, 0, 0]));
  group.add(plane('Ceiling', flat('#f6f0e6'), width, depth, [cx, HEIGHT, cz], [Math.PI / 2, 0, 0]));
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.06, 40), flat('#fffaf0'));
  lamp.name = 'Ceiling light';
  lamp.position.set(cx, HEIGHT - 0.03, cz);
  group.add(lamp);
  // Wall paintings are seen from inside the room.
  group.add(plane('Window wall', painted(front, true), width, HEIGHT, [cx, HEIGHT / 2, FRONT_Z]));
  group.add(plane('Left wall | bed', painted(left), depth, HEIGHT, [LEFT_X, HEIGHT / 2, cz], [0, Math.PI / 2, 0]));
  group.add(plane('Right wall | desk', painted(right), depth, HEIGHT, [RIGHT_X, HEIGHT / 2, cz], [0, -Math.PI / 2, 0]));
  group.add(plane('Back wall | door', painted(back), width, HEIGHT, [cx, HEIGHT / 2, BACK_Z], [0, Math.PI, 0]));

  // Seamless painted wood for every modelled wooden part (each box face shows the whole tile).
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  const gingham = ginghamTexture();
  group.add(rug(pile));
  // Furniture casts onto the floor when the location has light.shadow (baked once by the stage).
  // The fake contact blobs are gone; paintings and the plush cards cast nothing.
  const furniture = [
    bed(bedSide, bedFoot, bedTop, gingham, wood), throwBlanket(throwMap), nightstand(wood), lowTable(tableTop, wood),
    desk(wood), chair(wood), bookcase(shelf),
    cushion('Yellow cushion', flat('#f2c443'), 0.5, [1.0, -0.95], true),
    cushion('Gingham cushion', new THREE.MeshBasicMaterial({ map: gingham, toneMapped: false }), 0.45, [0.6, -2.12]),
  ];
  for (const item of furniture) group.add(castShadows(item));

  const teddy = standee('Teddy bear', bear, 0.45);
  teddy.position.set(1.22, 0, 0.3);
  teddy.rotation.y = -Math.PI / 4;
  group.add(teddy);
  const plush = standee('Shiba plush', shiba, 0.2);
  plush.position.set(BED.minX + 0.3, BED.top, BED.headZ + 0.62);
  plush.rotation.y = Math.PI / 5;
  group.add(plush);
  return group;
}

export function disposePaintedAoiRoom(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const map of [(material as THREE.MeshBasicMaterial).map, (material as THREE.MeshBasicMaterial).alphaMap]) {
        if (map) textures.add(map);
      }
    }
  });
  group.removeFromParent();
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((map) => map.dispose());
}
