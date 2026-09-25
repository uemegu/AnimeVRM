import * as THREE from 'three';

/**
 * Shared layout of the painted classroom. The desk-row paintings were generated
 * over blockout renders of exactly this layout (painted-classroom-blockout.html),
 * so changing these numbers means regenerating the desk rows.
 *
 * Metres. Camera side is +z; blackboard wall at FRONT_Z; window wall is -x.
 */
export const HALF_WIDTH = 3.5;
export const FRONT_Z = -9;
export const BACK_Z = 1;
export const HEIGHT = 3;

/** z of each row's chair backs as painted (desk-row-N.avif). Row 1 is nearest the camera. */
export const DESK_ROWS_Z = [-2.6, -3.45, -4.3, -5.15, -6.0, -6.85];
/** Rows actually placed: painted rows 2-5, at the even spacing rows 2-6 had over the
 * painted span (the last one was dropped). Each row painting moves rigidly from where
 * it was painted to its placed z. */
const PLACED_ROW_PITCH = (DESK_ROWS_Z[DESK_ROWS_Z.length - 1] - DESK_ROWS_Z[0]) / 4;
export const PLACED_DESK_ROWS = [2, 3, 4, 5].map((row, i) => ({ row, z: DESK_ROWS_Z[0] + PLACED_ROW_PITCH * i }));
/** Furniture extents [left, right, top, bottom] in px, blockout guide vs generated
 * painting. The paintings drew the furniture a little too large, so the UVs are
 * remapped to put each painting's extents onto its guide's. */
export const ROW_PAINTING_FIT: Record<number, { guide: number[]; painting: number[] }> = {
  2: { guide: [142, 2029, 245, 508], painting: [131, 2055, 235, 516] },
  3: { guide: [140, 2031, 248, 507], painting: [128, 2043, 238, 515] },
  4: { guide: [139, 2032, 247, 506], painting: [124, 2043, 237, 510] },
  5: { guide: [138, 2033, 246, 506], painting: [85, 2088, 223, 524] },
};
export const DESK_COLUMNS_X = [-2.725, -1.775, -0.825, 0.825, 1.775, 2.725];
export const DESK = { width: 0.65, depth: 0.45, height: 0.72, backZ: -0.75 } as const;
export const CHAIR = { width: 0.4, seat: 0.42, top: 0.8 } as const;
/** Top of the region each row image covers; fixed so furniture sizes can change without moving the crop. */
const ROW_TOP = 0.85;

/** Desk rows are painted from this camera and projected back onto vertical planes.
 * It is level (no pitch) so the vertical pipes stay vertical in the painting, and
 * on a vertical plane they stay vertical 3D lines from every camera. */
export const REFERENCE_CAMERA = { position: [0, 1.25, 0], target: [0, 1.25, -1], fov: 50, aspect: 16 / 9 } as const;
export const REFERENCE_FRAME: [number, number] = [1920, 1080];
export const ROW_IMAGE_SIZE: [number, number] = [2172, 724];

/** Vertical plane through the middle of the row's depth (chair backs to desk backs). */
export function rowPlane(z: number): THREE.Plane {
  return new THREE.Plane(new THREE.Vector3(0, 0, 1), -(z + DESK.backZ / 2));
}

function baseCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(REFERENCE_CAMERA.fov, REFERENCE_CAMERA.aspect, 0.05, 60);
  camera.position.fromArray(REFERENCE_CAMERA.position);
  camera.lookAt(new THREE.Vector3(...REFERENCE_CAMERA.target));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

/** Reference camera cropped (via view offset) to one desk row at the row image's 3:1 aspect. */
export function rowCamera(z: number): THREE.PerspectiveCamera {
  const camera = baseCamera();
  const [fullWidth, fullHeight] = REFERENCE_FRAME;
  const min = new THREE.Vector2(Infinity, Infinity), max = new THREE.Vector2(-Infinity, -Infinity);
  const edge = HALF_WIDTH - 0.3;
  for (const x of [-edge, edge]) for (const y of [0, ROW_TOP]) for (const dz of [0.05, DESK.backZ - 0.05]) {
    const p = new THREE.Vector3(x, y, z + dz).project(camera);
    const px = new THREE.Vector2((p.x + 1) / 2 * fullWidth, (1 - p.y) / 2 * fullHeight);
    min.min(px);
    max.max(px);
  }
  const [imageWidth, imageHeight] = ROW_IMAGE_SIZE;
  const margin = (max.x - min.x) * 0.02;
  let width = max.x - min.x + margin * 2;
  let height = max.y - min.y + margin * 2;
  if (width / height > imageWidth / imageHeight) height = width * imageHeight / imageWidth;
  else width = height * imageWidth / imageHeight;
  const center = min.clone().add(max).multiplyScalar(0.5);
  camera.setViewOffset(fullWidth, fullHeight, center.x - width / 2, center.y - height / 2, width, height);
  return camera;
}

/** Plane mesh geometry covering the row camera's view, UV-mapped so the row painting
 * projects from that camera. Subdivision approximates the projective mapping. */
export function rowGeometry(z: number, fit?: { guide: number[]; painting: number[] }): THREE.BufferGeometry {
  const camera = rowCamera(z);
  const [imageWidth, imageHeight] = ROW_IMAGE_SIZE;
  const remap = (value: number, from: number[], to: number[], i: number) =>
    to[i] + (value - from[i]) * (to[i + 1] - to[i]) / (from[i + 1] - from[i]);
  const plane = rowPlane(z);
  const geometry = new THREE.PlaneGeometry(1, 1, 32, 12);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const ray = new THREE.Ray();
  const point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    point.set(u * 2 - 1, v * 2 - 1, 0.5).unproject(camera);
    ray.set(camera.position, point.sub(camera.position).normalize());
    if (!ray.intersectPlane(plane, point)) throw new Error('Desk row plane is behind the camera');
    positions.setXYZ(i, point.x, point.y, point.z);
    if (fit) {
      uv.setXY(i, remap(u * imageWidth, fit.guide, fit.painting, 0) / imageWidth,
        1 - remap((1 - v) * imageHeight, fit.guide, fit.painting, 2) / imageHeight);
    }
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
