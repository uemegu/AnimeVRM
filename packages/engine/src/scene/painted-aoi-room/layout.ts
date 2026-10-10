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

/** Single bed against the left wall, headboard against the window wall. top = mattress line. */
export const BED = { minX: LEFT_X, maxX: -0.83, headZ: -2.36, footZ: -0.4, top: 0.5, base: 0.3, headboardTop: 0.95 } as const;
/** bed-top.avif covers this much of the bed from the foot (the rest is under the pillows). */
export const BED_TOP_LENGTH = 1.5;
export const NIGHTSTAND = { minX: -0.78, maxX: -0.38, frontZ: -2.0, height: 0.55 } as const;

/** Oval low table on the rug, in front of the bed edge. */
export const LOW_TABLE = { x: 0.15, z: -1.75, width: 1.0, depth: 0.55, height: 0.36 } as const;
export const RUG = { minX: -0.8, maxX: 1.2, minZ: -2.3, maxZ: -0.5 } as const;

/** Study desk against the right wall, its chair facing the wall. */
export const DESK = { minX: 1.24, maxX: RIGHT_X, minZ: -2.36, maxZ: -1.34, height: 0.66 } as const;
export const DESK_CHAIR = { x: 1.0, z: -1.66, seat: 0.45, top: 0.9 } as const;
/** Bookcase against the right wall (front faces -x). */
export const BOOKCASE = { minX: 1.45, maxX: RIGHT_X, minZ: -1.2, maxZ: 0, height: 1.8 } as const;

/**
 * Where the "aoi_house" location puts its origin (room coordinates): the open floor in
 * front of the table, so the default standing slots (±0.45 m) and the conversation
 * cameras (about 2 m in front) fit inside the room.
 */
export const STANDING_ORIGIN: [number, number, number] = [0.2, 0, -0.9];
