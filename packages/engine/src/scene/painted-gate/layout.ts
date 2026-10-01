import * as THREE from 'three';

/**
 * Shared layout of the painted school gate. Metres. The avatar stands at the
 * origin on the pavement outside the gate; the gate line is at GATE_Z (camera
 * side is +z) and the school is further along -z.
 *
 * Both paintings were generated over blockout renders of exactly these boxes
 * (scripts/painted-gate-blockout.ts) from REFERENCE_CAMERA and are projected back from that camera,
 * so changing these numbers means regenerating the paintings.
 */
export type Box = { name: string; min: [number, number, number]; max: [number, number, number] };

export const GATE_Z = -3;

/** Gate layer (gate.avif): wall, pillars and the half-open sliding gate. */
export const GATE_BOXES: Box[] = [
  { name: 'Left wall', min: [-50, 0, GATE_Z - 0.3], max: [-3.7, 1.9, GATE_Z] },
  { name: 'Right wall', min: [3.7, 0, GATE_Z - 0.3], max: [50, 1.9, GATE_Z] },
  { name: 'Left pillar', min: [-3.7, 0, GATE_Z - 0.4], max: [-2.9, 2.3, GATE_Z + 0.4] },
  { name: 'Right pillar', min: [2.9, 0, GATE_Z - 0.4], max: [3.7, 2.3, GATE_Z + 0.4] },
  { name: 'Sliding gate', min: [-2.9, 0, GATE_Z - 0.25], max: [-0.9, 1.6, GATE_Z - 0.2] },
];

/** Scene layer (scene.avif): everything behind the gate and the guardhouse, plus the ground on both sides. */
export const GROUND = { minX: -50, maxX: 50, nearZ: 6, farZ: -50 } as const;
/** Guardhouse layer (guardhouse.avif). */
export const GUARDHOUSE: Box = { name: 'Guardhouse', min: [4.2, 0, -8], max: [8, 2.9, -4] };
/** The school building and the trees along it are painted onto this vertical plane; past the painting it continues as the facade tile. */
export const BACKDROP = { z: -30, minX: GROUND.minX, maxX: GROUND.maxX, height: 25 } as const;
/** Blockout only: the building front, and the trees in front of it (painted onto the backdrop). */
export const BUILDING: Box = { name: 'Building', min: [-30, 0, -42], max: [30, 14, -30] };
export const TREES_X = [-22, -14, 14, 22];
export const TREES_Z = -28;

/**
 * Outside the paintings (every direction but the reference view). Surfaces the
 * paintings do not cover fall back to seamless tiles; the distance is standee
 * paintings on the four sides; the sky is a dome (hidden in the viewer, which
 * draws its own time-of-day sky).
 */
/** The street in front of the gate: kerb, road and the far pavement (tile-road.avif spans it). */
export const ROAD = { nearZ: GROUND.nearZ, farZ: 17 } as const;
/** Standee paintings around the set, bottoms on the ground. */
export const FAR = { north: GROUND.farZ, south: ROAD.farZ, west: GROUND.minX, east: GROUND.maxX, housesRepeat: 110, campusRepeat: 75 } as const;
export const SKY_RADIUS = 150;
/** The painting on the ground fades to the paving tile between these distances (m) from the reference camera. */
export const GROUND_PAINTING_FADE = [14, 22] as const;
/** Tile sizes in metres. */
export const TILES = { paving: 3, wall: [2.85, 1.9], stone: 1.2 } as const;
/** Top of the facade (px) in tile-facade.avif; above it is sky. */
export const FACADE_TILE_TOP = 334;

/** Paintings are generated from this camera: a standing eye line, level so verticals stay vertical. */
export const REFERENCE_CAMERA = { position: [0, 1.4, 4.5], target: [0, 1.4, 0], fov: 60, aspect: 3 / 2 } as const;
export const REFERENCE_FRAME: [number, number] = [1536, 1024];

export const GATE_SHOTS = [
  { label: '門の前で', position: [0, 1.35, 2.2], target: [0, 1.15, 0], fov: 44 },
  { label: '寄り', position: [0.1, 1.3, 1.6], target: [0, 1.25, 0], fov: 38 },
  { label: '左から', position: [-0.8, 1.35, 2.4], target: [0, 1.1, -0.5], fov: 46 },
  { label: '引き', position: [0.3, 1.5, 4.2], target: [0, 1.1, -2], fov: 50 },
] as const;

export function referenceCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(REFERENCE_CAMERA.fov, REFERENCE_CAMERA.aspect, 0.05, 200);
  camera.position.fromArray(REFERENCE_CAMERA.position);
  camera.lookAt(new THREE.Vector3(...REFERENCE_CAMERA.target));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}
