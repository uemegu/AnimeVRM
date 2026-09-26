import * as THREE from 'three';

/**
 * Shared layout of the painted library. Metres. Camera side is +z, the far
 * bookshelf wall is at FRONT_Z and the window wall is -x. Shion sits across the
 * reading table from the camera, with the window close on her right (screen left).
 *
 * The projected standees (reading-tables.avif) were painted over blockout renders
 * of exactly this layout (painted-library-blockout.html), so changing their numbers
 * means regenerating them.
 */
export const LEFT_X = -2.6;
export const RIGHT_X = 5.4;
export const FRONT_Z = -9;
export const BACK_Z = 1.5;
export const HEIGHT = 3.2;

/** The table between the camera and Shion. */
export const TABLE = { minX: -0.85, maxX: 0.85, nearZ: -0.5, farZ: -1.66, top: 0.745, thickness: 0.04 } as const;
/** Shion's chair; its back stands just behind her. */
export const CHAIR = { x: 0, z: -2.02, width: 0.46, seat: 0.44, top: 0.86 } as const;
/** Avatar root. The chin-rest clip floats the hips at 0.71 m, so it is lowered onto the seat. */
export const AVATAR_POSITION: [number, number, number] = [0, -0.2, -1.8];

/** Freestanding double-sided shelf seen face on, behind Shion. */
export const SHELF_ROW = { minX: -0.2, maxX: RIGHT_X, z: -4.4, height: 2.1 } as const;
/** Reading table with chairs by the windows, between the shelf row and the far wall. */
export const FAR_TABLE = { minX: -2.3, maxX: -0.6, z: -6.2, depth: 0.9, height: 0.72, chairTop: 0.86 } as const;

/** Standees are painted from this camera: the conversation shot, levelled. */
export const REFERENCE_CAMERA = { position: [0, 1.12, 0.25], target: [0, 1.12, -1], fov: 40, aspect: 16 / 9 } as const;
export const REFERENCE_FRAME: [number, number] = [1920, 1080];
export const FAR_TABLE_IMAGE_SIZE: [number, number] = [1536, 1024];

export const LIBRARY_SHOTS = [
  { label: '向かいの席から', position: [0, 1.12, 0.25], target: [0, 0.98, -1.8], fov: 40 },
  { label: '寄り', position: [0.05, 1.1, -0.1], target: [0, 1.0, -1.8], fov: 36 },
  { label: '窓側から', position: [-0.9, 1.2, 0.35], target: [0, 0.95, -1.9], fov: 44 },
  { label: '通路側から', position: [1.1, 1.3, 0.5], target: [0, 0.9, -2.0], fov: 46 },
  { label: '引き', position: [0.4, 1.45, 1.3], target: [0, 0.95, -2.4], fov: 50 },
] as const;

function referenceCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(REFERENCE_CAMERA.fov, REFERENCE_CAMERA.aspect, 0.05, 60);
  camera.position.fromArray(REFERENCE_CAMERA.position);
  camera.lookAt(new THREE.Vector3(...REFERENCE_CAMERA.target));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

/** Corners of the far reading table set (table and chairs on both sides). */
function farTableBox(): THREE.Box3 {
  return new THREE.Box3(
    new THREE.Vector3(FAR_TABLE.minX - 0.05, 0, FAR_TABLE.z - FAR_TABLE.depth / 2 - 0.45),
    new THREE.Vector3(FAR_TABLE.maxX + 0.05, 0.95, FAR_TABLE.z + FAR_TABLE.depth / 2 + 0.45),
  );
}

/** Reference camera cropped (via view offset) to the far table set at the image's aspect. */
export function farTableCamera(): THREE.PerspectiveCamera {
  const camera = referenceCamera();
  const [fullWidth, fullHeight] = REFERENCE_FRAME;
  const box = farTableBox();
  const min = new THREE.Vector2(Infinity, Infinity), max = new THREE.Vector2(-Infinity, -Infinity);
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new THREE.Vector3(x, y, z).project(camera);
    const px = new THREE.Vector2((p.x + 1) / 2 * fullWidth, (1 - p.y) / 2 * fullHeight);
    min.min(px);
    max.max(px);
  }
  const [imageWidth, imageHeight] = FAR_TABLE_IMAGE_SIZE;
  const margin = (max.x - min.x) * 0.04;
  let width = max.x - min.x + margin * 2;
  let height = max.y - min.y + margin * 2;
  if (width / height > imageWidth / imageHeight) height = width * imageHeight / imageWidth;
  else width = height * imageWidth / imageHeight;
  const center = min.clone().add(max).multiplyScalar(0.5);
  camera.setViewOffset(fullWidth, fullHeight, center.x - width / 2, center.y - height / 2, width, height);
  return camera;
}

/** Vertical plane through the middle of the far table, covering the far-table camera's
 * view and UV-mapped so the painting projects from that camera. */
export function farTableGeometry(): THREE.BufferGeometry {
  const camera = farTableCamera();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -FAR_TABLE.z);
  const geometry = new THREE.PlaneGeometry(1, 1, 16, 12);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const ray = new THREE.Ray();
  const point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.set(uv.getX(i) * 2 - 1, uv.getY(i) * 2 - 1, 0.5).unproject(camera);
    ray.set(camera.position, point.sub(camera.position).normalize());
    if (!ray.intersectPlane(plane, point)) throw new Error('Far table plane is behind the camera');
    positions.setXYZ(i, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
