import * as THREE from 'three';
import { resolveAssetUrl } from '../../utils/path';
import { BACK_Z, DESK, DESK_COLUMNS_X, DESK_ROWS_Z, FRONT_Z, HALF_WIDTH, HEIGHT, PLACED_DESK_ROWS, PLATFORM, ROW_PAINTING_FIT, TEACHER_DESK_FRONT_Z, rowGeometry } from './layout';

/**
 * Painted 2.5D classroom: every surface is one generated painting, and furniture
 * is acrylic-standee cards (transparent outside the furniture). Each desk row is
 * painted over a blockout render of its own row and projected back from that
 * camera, so the painted perspective matches the set. The sky is not painted: the
 * window cut-outs show the viewer's own sky (SkyBackground, via SKY_ONLY_BACKGROUND).
 * Layout and units: see layout.ts.
 */
const TEXTURE_DIR = '/textures/painted-classroom';
/** Fully transparent background image: the viewer then draws only its sky behind the set. */
export const SKY_ONLY_BACKGROUND = `${TEXTURE_DIR}/sky-only.png`;

export const AVATAR_POSITION: [number, number, number] = [0, 0, -1.9];
export const PAINTED_CLASSROOM_SHOTS = [
  { label: '教室後方から', position: [0, 1.25, 0], target: [0, 1.19, -1], fov: 50 },
  { label: '会話', position: [0, 1.25, -0.12], target: [0, 1.14, -1.9], fov: 46 },
  { label: '左から', position: [-0.3, 1.25, 0], target: [0, 1.14, -1.9], fov: 50 },
  { label: '右から', position: [0.3, 1.25, 0], target: [0, 1.14, -1.9], fov: 50 },
] as const;

async function paintedMaterial(file: string, cutout: boolean): Promise<THREE.MeshBasicMaterial> {
  const map = await new THREE.TextureLoader().loadAsync(resolveAssetUrl(`${TEXTURE_DIR}/${file}`));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const material = new THREE.MeshBasicMaterial({ map, toneMapped: false, side: THREE.DoubleSide });
  if (cutout) {
    material.alphaTest = 0.5;
    material.alphaToCoverage = true;
  }
  material.name = file;
  return material;
}

function plane(name: string, material: THREE.Material, width: number, height: number,
  position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  return mesh;
}

function deskRows(materials: THREE.Material[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Desk rows';
  PLACED_DESK_ROWS.forEach(({ row, z }, i) => {
    const paintedZ = DESK_ROWS_Z[row - 1];
    const mesh = new THREE.Mesh(rowGeometry(paintedZ, ROW_PAINTING_FIT[row]).translate(0, 0, z - paintedZ), materials[i]);
    mesh.name = `Desk row ${i + 1} | painting ${row}`;
    group.add(mesh);
  });
  return group;
}

/**
 * podium.avif (1374x1145, feet at y=1083) is the teacher's desk seen from the front:
 * a slightly-from-above top (y 157-277), the front edge of the top (y 277-320, 1208px = 1.2 m)
 * and the body (y 320-1083). Each band goes on its own face of a desk-shaped solid so the
 * top keeps its depth from the 教壇 cameras; sides and back are plain panels.
 */
const PODIUM_IMAGE = [1374, 1145] as const;
const PODIUM_FEET = 1083;
const PODIUM_M_PER_PX = 1.2 / 1208;
const DESK_TOP = (PODIUM_FEET - 277) * PODIUM_M_PER_PX;
const DESK_SLAB_BOTTOM = (PODIUM_FEET - 320) * PODIUM_M_PER_PX;
const TEACHER_DESK_DEPTH = 0.6;

/** Quad with its four corners (front-left, front-right, back-left, back-right in world space)
 * taking podium.avif pixels at the matching corners; bilinear over a grid so it does not kink. */
function podiumQuad(name: string, material: THREE.Material, corners: THREE.Vector3[], pixels: [number, number][]): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(1, 1, 8, 8);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const [p00, p10, p01, p11] = corners;
  const point = new THREE.Vector3(), far = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    point.lerpVectors(p00, p10, u);
    far.lerpVectors(p01, p11, u);
    point.lerp(far, v);
    positions.setXYZ(i, point.x, point.y, point.z);
    const near = pixels[0][0] + (pixels[1][0] - pixels[0][0]) * u, nearY = pixels[0][1] + (pixels[1][1] - pixels[0][1]) * u;
    const back = pixels[2][0] + (pixels[3][0] - pixels[2][0]) * u, backY = pixels[2][1] + (pixels[3][1] - pixels[2][1]) * u;
    uv.setXY(i, (near + (back - near) * v) / PODIUM_IMAGE[0], 1 - (nearY + (backY - nearY) * v) / PODIUM_IMAGE[1]);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

/** Teacher's desk on the platform; local origin is the floor under the middle of its front edge. */
function teacherDesk(material: THREE.Material): THREE.Group {
  const desk = new THREE.Group();
  desk.name = 'Teacher desk';
  const half = 0.6, d = TEACHER_DESK_DEPTH, v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  desk.add(podiumQuad('Teacher desk top', material,
    [v(-half, DESK_TOP, 0), v(half, DESK_TOP, 0), v(-half, DESK_TOP, -d), v(half, DESK_TOP, -d)],
    [[83, 277], [1291, 277], [199, 157], [1176, 157]]));
  desk.add(podiumQuad('Teacher desk edge', material,
    [v(-half, DESK_SLAB_BOTTOM, 0), v(half, DESK_SLAB_BOTTOM, 0), v(-half, DESK_TOP, 0), v(half, DESK_TOP, 0)],
    [[83, 320], [1291, 320], [83, 277], [1291, 277]]));
  // The body is recessed under the top's overhang; its picture runs down to the feet.
  const bodyHalf = (1206 - 168) / 2 * PODIUM_M_PER_PX, bodyZ = -0.03;
  desk.add(podiumQuad('Teacher desk body', material,
    [v(-bodyHalf, 0, bodyZ), v(bodyHalf, 0, bodyZ), v(-bodyHalf, DESK_SLAB_BOTTOM, bodyZ), v(bodyHalf, DESK_SLAB_BOTTOM, bodyZ)],
    [[168, PODIUM_FEET], [1206, PODIUM_FEET], [168, 320], [1206, 320]]));
  // Top's side and back edges, and the steel side frames / modesty panel behind the painted front.
  const wood = new THREE.MeshBasicMaterial({ color: '#94664a', toneMapped: false });
  const steel = new THREE.MeshBasicMaterial({ color: '#9aa3b6', toneMapped: false });
  const box = (name: string, mat: THREE.Material, size: [number, number, number], at: [number, number, number]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    mesh.name = name;
    mesh.position.set(...at);
    desk.add(mesh);
  };
  const slab = DESK_TOP - DESK_SLAB_BOTTOM;
  // Kept 1-2 cm inside the painted faces so they never z-fight from a distance.
  box('Teacher desk top sides', wood, [half * 2 - 0.01, slab - 0.012, d - 0.02], [0, DESK_SLAB_BOTTOM + (slab - 0.012) / 2, -d / 2 - 0.01]);
  for (const side of [-1, 1]) {
    box('Teacher desk side frame', steel, [0.04, DESK_SLAB_BOTTOM - 0.005, d - 0.1], [side * (bodyHalf - 0.02), (DESK_SLAB_BOTTOM - 0.005) / 2, bodyZ - 0.015 - (d - 0.1) / 2]);
  }
  box('Teacher desk back rail', steel, [bodyHalf * 2, 0.12, 0.03], [0, DESK_SLAB_BOTTOM - 0.06, -d + 0.08]);
  return desk;
}

/** Wood-plank texture for the platform (planks run along x); tiled 1 plank-set per metre. */
function plankTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const planks = 4;
  const random = (seed: number) => { const x = Math.sin(seed * 127.1) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < planks; i++) {
    const shade = 0.92 + random(i + 1) * 0.12;
    context.fillStyle = `rgb(${Math.round(176 * shade)}, ${Math.round(138 * shade)}, ${Math.round(108 * shade)})`;
    context.fillRect(0, i * 64, 256, 64);
    // Faint grain.
    for (let g = 0; g < 7; g++) {
      context.strokeStyle = `rgba(110, 76, 52, ${0.06 + random(i * 13 + g) * 0.06})`;
      context.lineWidth = 1 + random(g + i * 7) * 1.5;
      const y = i * 64 + 6 + random(i * 31 + g) * 52;
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(85, y + random(g) * 4 - 2, 170, y - random(g + 3) * 4 + 2, 256, y);
      context.stroke();
    }
    context.fillStyle = 'rgba(80, 54, 38, 0.45)';
    context.fillRect(0, i * 64, 256, 1.5);
    // Butt joint, staggered per plank.
    context.fillRect(Math.round(random(i + 9) * 256), i * 64, 1.5, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** The 教壇: a 20 cm wooden platform from the front wall to PLATFORM.frontZ, with a darker riser. */
function platform(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Platform';
  const width = PLATFORM.halfWidth * 2, depth = PLATFORM.frontZ - FRONT_Z, h = PLATFORM.height;
  const topMap = plankTexture();
  topMap.repeat.set(width / 1.6, depth / 0.6);
  const top = plane('Platform top', new THREE.MeshBasicMaterial({ map: topMap, toneMapped: false }),
    width, depth, [0, h, (FRONT_Z + PLATFORM.frontZ) / 2], [-Math.PI / 2, 0, 0]);
  group.add(top);
  const riserMap = plankTexture();
  riserMap.repeat.set(width / 1.6, h / 0.6);
  const riser = new THREE.MeshBasicMaterial({ map: riserMap, color: '#9a8c84', toneMapped: false });
  group.add(plane('Platform front', riser, width, h, [0, h / 2, PLATFORM.frontZ]));
  for (const side of [-1, 1]) {
    group.add(plane('Platform side', riser, depth, h, [side * PLATFORM.halfWidth, h / 2, (FRONT_Z + PLATFORM.frontZ) / 2], [0, side * Math.PI / 2, 0]));
  }
  // Nosing strip along the front edge catches the light.
  const nosing = new THREE.Mesh(new THREE.BoxGeometry(width + 0.01, 0.02, 0.03),
    new THREE.MeshBasicMaterial({ color: '#c49b74', toneMapped: false }));
  nosing.name = 'Platform nosing';
  nosing.position.set(0, h - 0.01, PLATFORM.frontZ - 0.01);
  group.add(nosing);
  // Contact shade along the riser foot (the generated floor has no platform shadow).
  const shade = plane('Platform foot shade', new THREE.MeshBasicMaterial({
    color: '#3c4658', transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false,
  }), width + 0.1, 0.12, [0, 0.002, PLATFORM.frontZ + 0.06], [-Math.PI / 2, 0, 0]);
  group.add(shade);
  return group;
}

/** Soft floor shadow under each desk; the generated floor has no furniture shadows. */
function deskShadows(): THREE.InstancedMesh {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const material = new THREE.MeshBasicMaterial({
    color: '#3c4658', alphaMap: new THREE.CanvasTexture(canvas), transparent: true, opacity: 0.22,
    depthWrite: false, toneMapped: false,
  });
  const geometry = new THREE.PlaneGeometry(0.85, 0.8).rotateX(-Math.PI / 2);
  const shadows = new THREE.InstancedMesh(geometry, material, PLACED_DESK_ROWS.length * DESK_COLUMNS_X.length);
  shadows.name = 'Desk contact shadows';
  const matrix = new THREE.Matrix4();
  let i = 0;
  for (const { z } of PLACED_DESK_ROWS) {
    for (const x of DESK_COLUMNS_X) shadows.setMatrixAt(i++, matrix.makeTranslation(x, 0.003, z + DESK.backZ / 2));
  }
  return shadows;
}

export async function loadPaintedClassroom(): Promise<THREE.Group> {
  const deskRowMaterials = Promise.all(PLACED_DESK_ROWS.map(({ row }) => paintedMaterial(`desk-row-${row}.avif`, true)));
  const [floor, ceiling, front, windows, corridor, desks, podium, cabinet] = await Promise.all([
    paintedMaterial('floor.avif', false),
    paintedMaterial('ceiling.avif', false),
    paintedMaterial('wall-front.avif', false),
    paintedMaterial('wall-left.avif', true),
    paintedMaterial('wall-right.avif', false),
    deskRowMaterials,
    paintedMaterial('podium.avif', true),
    paintedMaterial('cabinet.avif', true),
  ]);
  const width = HALF_WIDTH * 2, depth = BACK_Z - FRONT_Z, centerZ = (FRONT_Z + BACK_Z) / 2;
  const group = new THREE.Group();
  group.name = 'Painted classroom';
  // Floor/ceiling textures: top edge = blackboard side, left edge = window side.
  // Desk row planes stand mid-desk, so the painted chair feet lie slightly below
  // floor level on them. The floor is drawn first without depth so it never hides them.
  floor.depthWrite = false;
  const floorMesh = plane('Floor', floor, width, depth, [0, 0, centerZ], [-Math.PI / 2, 0, 0]);
  floorMesh.renderOrder = -1;
  group.add(floorMesh);
  group.add(plane('Ceiling', ceiling, width, depth, [0, HEIGHT, centerZ], [-Math.PI / 2, 0, 0]));
  group.add(plane('Front wall | blackboard', front, width, HEIGHT, [0, HEIGHT / 2, FRONT_Z]));
  // Wall textures are painted as seen from inside: window wall's right edge and corridor wall's left edge face the blackboard.
  group.add(plane('Window wall', windows, depth, HEIGHT, [-HALF_WIDTH, HEIGHT / 2, centerZ], [0, Math.PI / 2, 0]));
  group.add(plane('Corridor wall', corridor, depth, HEIGHT, [HALF_WIDTH, HEIGHT / 2, centerZ], [0, -Math.PI / 2, 0]));
  group.add(plane('Back wall', new THREE.MeshBasicMaterial({ color: '#c3cddb', toneMapped: false }),
    width, HEIGHT, [0, HEIGHT / 2, BACK_Z], [0, Math.PI, 0]));
  group.add(deskRows(desks));
  group.add(deskShadows());
  group.add(platform());
  const desk = teacherDesk(podium);
  desk.position.set(0, PLATFORM.height, TEACHER_DESK_FRONT_Z);
  group.add(desk);
  // cabinet.avif 1024x1536: 629px wide cabinet = 0.9m.
  group.add(plane('Cabinet', cabinet, 1024 * 0.9 / 629, 1536 * 0.9 / 629, [-2.85, 1.006, -8.6]));
  return group;
}

export function disposePaintedClassroom(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const texture of [(material as THREE.MeshBasicMaterial).map, (material as THREE.MeshBasicMaterial).alphaMap]) {
        if (texture) textures.add(texture);
      }
    }
  });
  group.removeFromParent();
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}
