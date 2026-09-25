import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { resolveAssetUrl } from '../../utils/path';

type Point = [number, number];
type Quad = [Point, Point, Point, Point];
export const PAINTED_CLASSROOM_IMAGE = '/textures/school-classroom-far2.avif';
export const PAINTED_CLASSROOM_GLB = '/models/school-environments/school-classroom-far2-standee.glb';
export const REFERENCE_ASPECT = 1672 / 941;
export const AVATAR_POSITION: [number, number, number] = [0, 0, -1.9];
// The image is the composition, not a reference for rearranging its furniture.
// This camera is also stored inside the GLB, so other viewers can recover it.
export const PAINTED_CLASSROOM_SHOTS = [
  { label: '元絵の構図', position: [0, 1.25, 0], target: [0, 1.19, -1], fov: 50 },
  { label: '会話', position: [0, 1.25, -0.12], target: [0, 1.14, -1.9], fov: 46 },
  { label: '左から', position: [-0.12, 1.25, 0], target: [0, 1.14, -1.9], fov: 50 },
  { label: '右から', position: [0.12, 1.25, 0], target: [0, 1.14, -1.9], fov: 50 },
] as const;

export async function loadPaintedClassroom(): Promise<THREE.Group> {
  const room = (await new GLTFLoader().loadAsync(resolveAssetUrl(PAINTED_CLASSROOM_GLB))).scene;
  // The shell extends past the painting's edges. Clamped UVs smear the edge pixels
  // into streaks once the camera turns toward a side wall; mirroring continues the
  // window frames and ceiling lights instead.
  room.traverse((object) => {
    const map = object instanceof THREE.Mesh ? (object.material as THREE.MeshBasicMaterial).map : null;
    if (!map) return;
    map.wrapS = map.wrapT = THREE.MirroredRepeatWrapping;
    map.needsUpdate = true;
  });
  return room;
}

export function referenceCamera(): THREE.PerspectiveCamera {
  const shot = PAINTED_CLASSROOM_SHOTS[0];
  const camera = new THREE.PerspectiveCamera(shot.fov, REFERENCE_ASPECT, 0.05, 60);
  camera.name = 'Reference camera | original image composition';
  camera.position.fromArray(shot.position);
  camera.lookAt(new THREE.Vector3(...shot.target));
  camera.updateMatrixWorld();
  return camera;
}

/** Match the original image's cover crop even outside its native 1672:941 ratio. */
export function coverFov(fov: number, aspect: number): number {
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * Math.min(1, REFERENCE_ASPECT / aspect)));
}

/** Project the unmodified source image onto a surface from its reference camera.
 * Subdivided UVs approximate projective texturing using portable glTF materials;
 * there are no custom shaders or runtime camera-facing billboards in the asset. */
function imageQuad(corners: Quad, plane: THREE.Plane, camera: THREE.PerspectiveCamera): THREE.BufferGeometry {
  const cols = 48, rows = 24;
  const geometry = new THREE.PlaneGeometry(1, 1, cols, rows);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const ray = new THREE.Ray();
  const point = new THREE.Vector3();
  const [a, b, c, d] = corners;
  for (let i = 0; i < positions.count; i++) {
    const u = uv.getX(i), v = 1 - uv.getY(i);
    const x = THREE.MathUtils.lerp(THREE.MathUtils.lerp(a[0], b[0], u), THREE.MathUtils.lerp(d[0], c[0], u), v);
    const y = THREE.MathUtils.lerp(THREE.MathUtils.lerp(a[1], b[1], u), THREE.MathUtils.lerp(d[1], c[1], u), v);
    point.set(x / 1672 * 2 - 1, 1 - y / 941 * 2, 0.5).unproject(camera);
    ray.set(camera.position, point.sub(camera.position).normalize());
    if (!ray.intersectPlane(plane, point)) throw new Error('Source pixel misses classroom surface');
    positions.setXYZ(i, point.x, point.y, point.z);
    uv.setXY(i, x / 1672, 1 - y / 941);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

// Each pair of quads is ONE horizontal row mesh/material, with the aisle open.
// Preserve the source's desk sizes, overlap and perspective instead of placing
// copies of an isolated desk. Slight overlaps prevent cracks between row cards.
const ROWS: { depth: number; left: Quad; right: Quad }[] = [
  { depth: 4.0, left: [[218, 490], [735, 490], [739, 522], [150, 522]], right: [[805, 490], [1310, 490], [1418, 522], [817, 522]] },
  { depth: 3.6, left: [[145, 506], [738, 506], [744, 547], [10, 547]], right: [[816, 506], [1418, 506], [1558, 547], [835, 547]] },
  { depth: 3.2, left: [[0, 526], [744, 526], [748, 582], [0, 582]], right: [[835, 526], [1672, 526], [1672, 582], [869, 582]] },
  { depth: 2.8, left: [[0, 554], [748, 554], [752, 637], [0, 637]], right: [[862, 554], [1672, 554], [1672, 637], [914, 637]] },
  { depth: 2.45, left: [[0, 602], [752, 602], [770, 762], [0, 762]], right: [[895, 602], [1672, 602], [1672, 762], [978, 762]] },
  { depth: 2.1, left: [[0, 709], [770, 709], [770, 941], [0, 941]], right: [[975, 709], [1672, 709], [1672, 941], [982, 941]] },
];

export async function createPaintedClassroom(): Promise<THREE.Group> {
  const texture = await new THREE.TextureLoader().loadAsync(resolveAssetUrl(PAINTED_CLASSROOM_IMAGE));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false });
  material.name = 'Original classroom painting | unlit';
  const group = new THREE.Group();
  group.name = 'school-classroom-far2 | projected row set';
  const camera = referenceCamera();
  const back = new THREE.Plane(new THREE.Vector3(0, 0, 1), 7.2);
  const ray = new THREE.Ray();
  const rearCorner = new THREE.Vector3(330 / 1672 * 2 - 1, 1 - 110 / 941 * 2, 0.5).unproject(camera);
  ray.set(camera.position, rearCorner.sub(camera.position).normalize()).intersectPlane(back, rearCorner);
  const rearRight = new THREE.Vector3(1200 / 1672 * 2 - 1, 1 - 110 / 941 * 2, 0.5).unproject(camera);
  ray.set(camera.position, rearRight.sub(camera.position).normalize()).intersectPlane(back, rearRight);
  function surface(name: string, corners: Quad, plane: THREE.Plane) {
    const mesh = new THREE.Mesh(imageQuad(corners, plane, camera), material);
    mesh.name = name;
    group.add(mesh);
  }
  // A recessed safety painting covers tiny disocclusions at the edge of the
  // camera-projected shell; the six row layers still provide the foreground depth.
  surface('Occlusion safety painting', [[-160, -120], [1832, -120], [1832, 1101], [-160, 1101]], new THREE.Plane(new THREE.Vector3(0, 0, 1), 8.0));
  // These polygons tile the source exactly. The original painting supplies all
  // room details and lighting; no extra clock, cabinets or replacement windows.
  surface('Back wall | original blackboard', [[330, 110], [1200, 110], [1200, 580], [330, 580]], back);
  surface('Left window wall', [[-160, -120], [330, 110], [330, 580], [-160, 1101]], new THREE.Plane(new THREE.Vector3(1, 0, 0), -rearCorner.x));
  surface('Right corridor wall', [[1200, 110], [1832, -120], [1832, 1101], [1200, 580]], new THREE.Plane(new THREE.Vector3(1, 0, 0), -rearRight.x));
  surface('Ceiling', [[-160, -120], [1832, -120], [1200, 110], [330, 110]], new THREE.Plane(new THREE.Vector3(0, 1, 0), -rearCorner.y));
  surface('Floor', [[330, 580], [1200, 580], [1832, 1101], [-160, 1101]], new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  ROWS.forEach((row, index) => {
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), row.depth);
    const parts = [row.left, row.right].map((quad) => imageQuad(quad, plane, camera));
    const geometry = mergeGeometries(parts);
    parts.forEach((part) => part.dispose());
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Desk row ${index + 1} | original image strip`;
    mesh.userData = { kind: 'row-standee', row: index + 1, depthMetres: row.depth };
    group.add(mesh);
  });
  group.add(camera);
  group.userData = {
    source: 'school-classroom-far2', units: 'metres', referenceImageSize: [1672, 941],
    design: 'Original image projected onto room shell and six complete horizontal desk-row cards; no individual furniture models.',
    avatarPosition: AVATAR_POSITION,
    cameraUse: 'Use embedded reference camera. Approximate source reconstruction; lateral moves limited to +/- 0.12m.',
  };
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
      if (material.map) textures.add(material.map);
    }
  });
  group.removeFromParent();
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}
