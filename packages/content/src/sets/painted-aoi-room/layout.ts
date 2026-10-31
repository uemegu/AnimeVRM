/**
 * Shared layout of Aoi's bedroom (painted after assets/textures/aoi_room_far.avif).
 * Metres. Camera side is +z, the balcony window wall is at FRONT_Z, the bed stands
 * along the left wall (-x) and the desk/bookcase along the right wall (+x).
 * The room is 3.6 m square (about 8 tatami) so each wall painting is 3:2.
 */
export const LEFT_X = -1.8;
export const RIGHT_X = 1.8;
export const FRONT_Z = -2.4;
export const BACK_Z = 1.2;
export const HEIGHT = 2.4;

/**
 * A modelled prop (props/<file>.glb, front at +z, bottom on y=0) placed in the room.
 * size: width, height, depth in the model's own axes, before rotationY; mirror flips it left-right.
 */
export interface PropPlacement {
  file: string;
  size: [number, number, number];
  at: [number, number];
  rotationY?: number;
  mirror?: boolean;
  /** Flat props (the rug) lie under the shadow plane and cast nothing. */
  shadow?: boolean;
}

/** Single bed against the left wall, headboard against the window wall; mattress top 0.5 m (the bed-edge seat). */
export const BED = { minX: LEFT_X, maxX: -0.83, headZ: -2.36, footZ: -0.61, top: 0.5 } as const;
/** Study desk against the right wall (top 0.66 m), its chair facing the wall. */
export const DESK = { minX: 1.24, maxX: RIGHT_X, minZ: -2.36, maxZ: -1.26, height: 0.66 } as const;

export const PROPS: PropPlacement[] = [
  // The model's mattress is at 0.345 of its height; stretched to the 0.5 m seat.
  { file: 'bed', size: [BED.maxX - BED.minX, 1.03, BED.footZ - BED.headZ], at: [(BED.minX + BED.maxX) / 2, (BED.headZ + BED.footZ) / 2] },
  // Nightstand with books at the head of the bed (top 0.55 m).
  { file: 'nightstand', size: [0.48, 0.75, 0.36], at: [-0.55, FRONT_Z + 0.2] },
  // Desk top at 0.591 of the model's height. Facing -x, mirrored so the drawers are on the window side
  // and the knees of the chin-rest seat stay clear.
  { file: 'desk', size: [DESK.maxZ - DESK.minZ, 1.115, DESK.maxX - DESK.minX], at: [(DESK.minX + DESK.maxX) / 2, (DESK.minZ + DESK.maxZ) / 2], rotationY: -Math.PI / 2, mirror: true },
  // Seat at 0.45 m, facing the desk.
  { file: 'chair', size: [0.417, 0.91, 0.5], at: [1.0, -1.66], rotationY: Math.PI / 2 },
  { file: 'bookcase', size: [0.8, 1.8, 0.36], at: [RIGHT_X - 0.18, -0.75], rotationY: -Math.PI / 2 },
  // Oval low table, top at 0.36 m.
  { file: 'low-table', size: [1.05, 0.607, 0.64], at: [0.15, -1.75] },
  { file: 'rug', size: [1.56, 0.018, 2.15], at: [0.25, -1.45], rotationY: Math.PI / 2, shadow: false },
  { file: 'cushion-yellow', size: [0.5, 0.21, 0.5], at: [-0.5, -1.3] },
  { file: 'cushion-flower', size: [0.55, 0.22, 0.55], at: [1.0, -1.0] },
  { file: 'teddy', size: [0.36, 0.45, 0.34], at: [1.45, 0.1], rotationY: -1.15 },
];

/**
 * Where the "aoi_house" location puts its origin (room coordinates): the open floor in
 * front of the table, so the default standing slots (±0.45 m) and the conversation
 * cameras (about 2 m in front) fit inside the room.
 */
export const STANDING_ORIGIN: [number, number, number] = [0.2, 0, -0.9];
