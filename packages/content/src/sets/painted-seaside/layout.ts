import * as THREE from 'three';

/**
 * Shared layout of the painted seaside park. Metres. The avatar stands at the
 * origin on the promenade; the sea is along -z beyond the railing at EDGE_Z
 * (camera side is +z).
 *
 * The promenade painting was generated over a blockout render of these
 * surfaces (scripts/painted-seaside-blockout.ts) from REFERENCE_CAMERA and is
 * projected back from that camera, so changing the ground, the edge or the
 * camera means regenerating it. The railing, the sea and the standees are not
 * part of the painting and can move freely.
 */
export type Box = { name: string; min: [number, number, number]; max: [number, number, number] };

/** Sea side of the promenade. */
export const EDGE_Z = -2.2;
/** Water level (the promenade is at 0). */
export const SEA_Y = -1.6;

/** The promenade (painted ground), from the edge back to the park behind the camera. */
export const GROUND = { minX: -50, maxX: 50, nearZ: 30, farZ: EDGE_Z } as const;
/** Low stone kerb along the edge; its sea side runs down into the water as the sea wall. */
export const KERB: Box = { name: 'Kerb', min: [GROUND.minX, SEA_Y - 0.6, EDGE_Z - 0.35], max: [GROUND.maxX, 0.18, EDGE_Z] };

/** Railing on the kerb (real geometry): posts every POST_SPACING m, a top rail and a middle rail. */
export const RAILING = { z: EDGE_Z - 0.17, minX: GROUND.minX, maxX: GROUND.maxX, postSpacing: 2, height: 1.05, rails: [0.55, 1.05], postSize: 0.06, railRadius: 0.025 } as const;

/** Sea (procedural): a disc and a surrounding wall of this radius; the shader intersects each view ray with the water plane. */
export const SEA_RADIUS = 90;
/** Distant islands standee: its bottom edge sits on the water in the haze at this distance; the painting is stretched to repeat every `repeat` m. */
export const ISLANDS = { z: -82, minX: -60, maxX: 60, bottom: 0.2, height: 4.5, repeat: 120 } as const;
/** Trees and lamps along the promenade (standees that turn to face the camera). x, z of the trunk; height of the painted object. */
export const TREES = [
  { x: -6.2, z: -0.9, height: 7.2, image: 'tree-a' },
  { x: 6.8, z: -1.0, height: 6.6, image: 'tree-b' },
  { x: -19, z: -0.9, height: 6.8, image: 'tree-b' },
  { x: 20, z: -0.9, height: 7.2, image: 'tree-a' },
  { x: -32, z: -0.9, height: 7, image: 'tree-a' },
  { x: 33, z: -0.9, height: 6.8, image: 'tree-b' },
] as const;
export const LAMPS = [
  { x: -2.8, z: -1.75 }, { x: 12.8, z: -1.75 }, { x: -12.6, z: -1.75 }, { x: 26.6, z: -1.75 }, { x: -26, z: -1.75 },
] as const;
export const LAMP_HEIGHT = 3.6;

/** Standee paintings around the land side (park trees and the town), bottoms on the ground. */
export const FAR = { south: GROUND.nearZ, west: GROUND.minX, east: GROUND.maxX, repeat: 60 } as const;
export const SKY_RADIUS = 150;
/** The painting on the ground fades to the paving tile between these distances (m) from the reference camera. */
export const GROUND_PAINTING_FADE = [16, 26] as const;
export const TILES = { paving: 3, stone: 1.2 } as const;

/**
 * The sun, low over the sea ahead and to the left, so the glitter path lies in
 * the reference view (as in the painting). The set is backlit: the character
 * light (locations.json) comes from the same side, so shadows fall towards the
 * camera.
 */
export const SUN_DIRECTION = [-0.5, 0.26, -1] as const;

/** Paintings are generated from this camera: a standing eye line, level so verticals stay vertical. */
export const REFERENCE_CAMERA = { position: [0, 1.4, 4.5], target: [0, 1.4, 0], fov: 60, aspect: 3 / 2 } as const;
export const REFERENCE_FRAME: [number, number] = [1536, 1024];

export const SEASIDE_SHOTS = [
  { label: '手すりの前で', position: [0, 1.35, 2.2], target: [0, 1.2, 0], fov: 44 },
  { label: '左から', position: [-1.2, 1.35, 2.2], target: [0, 1.15, -0.6], fov: 46 },
  { label: '引き', position: [0.3, 1.5, 4.2], target: [0, 1.2, -2], fov: 50 },
] as const;

export function referenceCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(REFERENCE_CAMERA.fov, REFERENCE_CAMERA.aspect, 0.05, 200);
  camera.position.fromArray(REFERENCE_CAMERA.position);
  camera.lookAt(new THREE.Vector3(...REFERENCE_CAMERA.target));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}
