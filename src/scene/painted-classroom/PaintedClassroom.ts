import * as THREE from 'three';
import { resolveAssetUrl } from '../../utils/path';
import { BACK_Z, DESK, DESK_COLUMNS_X, DESK_ROWS_Z, FRONT_Z, HALF_WIDTH, HEIGHT, PLACED_DESK_ROWS, ROW_PAINTING_FIT, rowGeometry } from './layout';

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
 * podium.avif (1374x1145, 1208px wide podium = 1.2m, feet at y=1083) was painted
 * looking down on it, but from the back of the room the top is seen almost edge-on.
 * The top surface band (y 150-276) is squashed vertically; the front edge and body keep their size.
 */
function podiumStandee(material: THREE.Material): THREE.Mesh {
  const [imageWidth, imageHeight] = [1374, 1145];
  const metresPerPx = 1.2 / 1208;
  const feet = 1083, fold = 276, top = 150, topSquash = 0.25;
  const geometry = new THREE.PlaneGeometry(imageWidth * metresPerPx, 1, 1, 2);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  // PlaneGeometry rows run top to bottom: squashed top, fold, image bottom.
  const rows = [
    { imageY: top, y: (feet - fold + (fold - top) * topSquash) * metresPerPx },
    { imageY: fold, y: (feet - fold) * metresPerPx },
    { imageY: imageHeight, y: (feet - imageHeight) * metresPerPx },
  ];
  for (let i = 0; i < positions.count; i++) {
    const row = rows[Math.floor(i / 2)];
    positions.setY(i, row.y);
    uv.setY(i, 1 - row.imageY / imageHeight);
  }
  geometry.computeBoundingSphere();
  const podium = new THREE.Mesh(geometry, material);
  podium.name = 'Teacher podium';
  podium.position.set(0, 0, -7.9);
  return podium;
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
  group.add(podiumStandee(podium));
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
