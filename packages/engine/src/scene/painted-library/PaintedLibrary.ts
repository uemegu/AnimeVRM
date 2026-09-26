import * as THREE from 'three';
import { resolveAssetUrl } from '../../utils/path';
import { BACK_Z, CHAIR, FAR_TABLE, FRONT_Z, HEIGHT, LEFT_X, RIGHT_X, SHELF_ROW, TABLE, farTableGeometry } from './layout';

/**
 * Painted 2.5D library: every room surface is one generated painting, the reading
 * table in front of the camera is a box with a painted top, and the furniture
 * behind Shion is acrylic-standee cards. The far reading table was painted over a
 * blockout render and is projected back from that camera. The sky is not painted:
 * the window cut-outs show the viewer's own sky. Layout and units: see layout.ts.
 */
const TEXTURE_DIR = '/textures/painted-library';
/** Fully transparent background image: the viewer then draws only its sky behind the set. */
export const SKY_ONLY_BACKGROUND = '/textures/painted-classroom/sky-only.png';

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

/** Standee whose painting's object spans [left, right] x [top, bottom] px and is objectWidth metres wide, feet on the floor. */
function standee(name: string, material: THREE.MeshBasicMaterial, extent: { left: number; right: number; top: number; bottom: number },
  objectWidth: number, center: [number, number]): THREE.Mesh {
  const image = material.map!.image as { width: number; height: number };
  const metresPerPx = objectWidth / (extent.right - extent.left);
  const width = image.width * metresPerPx, height = image.height * metresPerPx;
  const mesh = plane(name, material, width, height, [
    center[0] + (image.width / 2 - (extent.left + extent.right) / 2) * metresPerPx,
    (extent.bottom - image.height / 2) * metresPerPx,
    center[1],
  ]);
  return mesh;
}

/** Opaque bounding box of a cut-out painting, in px. */
function alphaExtent(texture: THREE.Texture): { left: number; right: number; top: number; bottom: number } {
  const image = texture.image as CanvasImageSource & { width: number; height: number };
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
  return { left, right, top, bottom };
}

/** The reading table in front of the camera: painted top, plain wood edge and panel legs. */
function readingTable(top: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Reading table';
  const width = TABLE.maxX - TABLE.minX, depth = TABLE.nearZ - TABLE.farZ;
  const cx = (TABLE.minX + TABLE.maxX) / 2, cz = (TABLE.nearZ + TABLE.farZ) / 2;
  group.add(plane('Table top', top, width, depth, [cx, TABLE.top, cz], [-Math.PI / 2, 0, 0]));
  const edge = new THREE.MeshBasicMaterial({ color: '#b98553', toneMapped: false });
  const legs = new THREE.MeshBasicMaterial({ color: '#a67446', toneMapped: false });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(width, TABLE.thickness, depth), [edge, edge, new THREE.MeshBasicMaterial({ visible: false }), edge, edge, edge]);
  slab.name = 'Table edge';
  slab.position.set(cx, TABLE.top - TABLE.thickness / 2 - 0.001, cz);
  group.add(slab);
  for (const x of [TABLE.minX + 0.06, TABLE.maxX - 0.06]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, TABLE.top - TABLE.thickness, depth - 0.12), legs);
    leg.name = 'Table leg';
    leg.position.set(x, (TABLE.top - TABLE.thickness) / 2, cz);
    group.add(leg);
  }
  return group;
}

/** Soft floor shadow; the generated floor has no furniture shadows. */
function contactShadow(width: number, depth: number, x: number, z: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const material = new THREE.MeshBasicMaterial({
    color: '#3c4658', alphaMap: new THREE.CanvasTexture(canvas), transparent: true, opacity: 0.25,
    depthWrite: false, toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2), material);
  mesh.name = 'Contact shadow';
  mesh.position.set(x, 0.003, z);
  return mesh;
}

export async function loadPaintedLibrary(): Promise<THREE.Group> {
  const [floor, ceiling, front, windows, right, shelfRow, farTable, tableTop, chair] = await Promise.all([
    paintedMaterial('floor.avif', false),
    paintedMaterial('ceiling.avif', false),
    paintedMaterial('wall-front.avif', false),
    paintedMaterial('wall-left.avif', true),
    paintedMaterial('wall-right.avif', false),
    paintedMaterial('shelf-row.avif', true),
    paintedMaterial('far-table.avif', true),
    paintedMaterial('table-top.avif', false),
    paintedMaterial('chair.avif', true),
  ]);
  const width = RIGHT_X - LEFT_X, depth = BACK_Z - FRONT_Z;
  const cx = (LEFT_X + RIGHT_X) / 2, cz = (FRONT_Z + BACK_Z) / 2;
  const group = new THREE.Group();
  group.name = 'Painted library';
  // Floor/ceiling textures: top edge = far wall, left edge = window side.
  floor.depthWrite = false;
  const floorMesh = plane('Floor', floor, width, depth, [cx, 0, cz], [-Math.PI / 2, 0, 0]);
  floorMesh.renderOrder = -1;
  group.add(floorMesh);
  group.add(plane('Ceiling', ceiling, width, depth, [cx, HEIGHT, cz], [-Math.PI / 2, 0, 0]));
  group.add(plane('Far wall | shelves', front, width, HEIGHT, [cx, HEIGHT / 2, FRONT_Z]));
  // Wall textures are painted as seen from inside: the window wall's right edge and the right wall's left edge face the far wall.
  group.add(plane('Window wall', windows, depth, HEIGHT, [LEFT_X, HEIGHT / 2, cz], [0, Math.PI / 2, 0]));
  group.add(plane('Right wall | shelves', right, depth, HEIGHT, [RIGHT_X, HEIGHT / 2, cz], [0, -Math.PI / 2, 0]));
  group.add(plane('Back wall', new THREE.MeshBasicMaterial({ color: '#e8e4dc', toneMapped: false }),
    width, HEIGHT, [cx, HEIGHT / 2, BACK_Z], [0, Math.PI, 0]));

  const shelfWidth = SHELF_ROW.maxX - SHELF_ROW.minX;
  group.add(standee('Shelf row', shelfRow, alphaExtent(shelfRow.map!), shelfWidth, [(SHELF_ROW.minX + SHELF_ROW.maxX) / 2, SHELF_ROW.z + 0.25]));
  group.add(contactShadow(shelfWidth + 0.3, 0.9, (SHELF_ROW.minX + SHELF_ROW.maxX) / 2, SHELF_ROW.z));
  const far = new THREE.Mesh(farTableGeometry(), farTable);
  far.name = 'Far reading table';
  group.add(far);
  group.add(contactShadow(FAR_TABLE.maxX - FAR_TABLE.minX + 0.4, FAR_TABLE.depth + 1.4, (FAR_TABLE.minX + FAR_TABLE.maxX) / 2, FAR_TABLE.z));

  group.add(readingTable(tableTop));
  group.add(contactShadow(TABLE.maxX - TABLE.minX + 0.3, TABLE.nearZ - TABLE.farZ + 0.3, 0, (TABLE.nearZ + TABLE.farZ) / 2));
  group.add(standee('Chair', chair, alphaExtent(chair.map!), CHAIR.width, [CHAIR.x, CHAIR.z]));
  return group;
}

export function disposePaintedLibrary(group: THREE.Group): void {
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
