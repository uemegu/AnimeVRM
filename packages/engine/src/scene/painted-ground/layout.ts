/**
 * School sports ground, metres. The app's school_aerial.avif places the field
 * west of the courtyard, the clock building north, the gym east and gate south.
 * These directions are a local convention, not geographic north from the map.
 * The origin is the east sideline, leaving the usual dialogue slots unobstructed.
 */
export const FIELD = { minX: -54, maxX: 4, minZ: -38, maxZ: 35 } as const;
export const TRACK = { x: -25, z: -2, radius: 16, straight: 16, lanes: 4, laneWidth: 1.05 } as const;
/** Shared three-story roof level; only the clock tower and gym arch rise above it. */
export const SCHOOL_ROOF_HEIGHT = 11.6;
export const SCHOOL = { x: 31, z: -36, width: 46, depth: 9, height: 14.5 } as const;
export const WING = { x: 59, z: -28.25, width: 10, depth: 33.5, height: SCHOOL_ROOF_HEIGHT } as const;
export const GYM = { x: 72, z: -24, width: 16, depth: 24, wallHeight: SCHOOL_ROOF_HEIGHT, roofRise: 5 } as const;
export const COURTYARD = { minX: 5.2, maxX: 56.8, minZ: -36, maxZ: 35.5 } as const;
export const GATE = { x: 31, z: 35.5, opening: 7, height: 2 } as const;
export const FIELD_ENTRY = { z: 0, halfWidth: 4 } as const;
/** This point becomes the dialogue origin for the existing courtyard location. */
export const COURTYARD_ORIGIN = { x: 27, z: 8 } as const;
export const FAR = { west: -74, east: 88, north: -69, south: 67, repeat: 38 } as const;

export interface Planter {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  radius: number;
  circular?: boolean;
}

/** Mirror paired beds around the clock / central-tree axis. Keep both entries open. */
export const PLANTERS: readonly Planter[] = [
  ...[20, 42].flatMap((x): Planter[] => [
    { id: `${x === 20 ? 'west' : 'east'}-front island`, x, z: 19, width: 8.5, depth: 12, radius: 1.1 },
    { id: `${x === 20 ? 'west' : 'east'}-rear island`, x, z: -23, width: 8.5, depth: 4.5, radius: 0.8 },
    { id: `${x === 20 ? 'west' : 'east'}-gate strip`, x, z: 30.5, width: 10, depth: 3.2, radius: 0.6 },
  ]),
  { id: 'central round island', x: 31, z: -10, width: 9, depth: 9, radius: 4.5, circular: true },
  ...[19, 43].map((x): Planter => ({ id: `school-front ${x === 19 ? 'west' : 'east'}`, x, z: -29.5, width: 16, depth: 3.2, radius: 0.6 })),
  ...[7.3, 54.7].flatMap((x): Planter[] => [-1, 1].map((sign): Planter => ({
    id: `${x === 7.3 ? 'field' : 'parking'}-side ${sign < 0 ? 'north' : 'south'}`,
    x, z: sign * 19.75, width: 3.2, depth: 31.5, radius: 0.6,
  }))),
  { id: 'parking-east strip', x: 82, z: 11, width: 3.5, depth: 35, radius: 0.6 },
  { id: 'parking-north strip', x: 69, z: -8, width: 24, depth: 3.2, radius: 0.6 },
] as const;

/** Tall fence -> planted verge -> path -> tree belt. Houses remain beyond the belt. */
export const OUTER_VERGES: readonly Planter[] = [
  { id: 'north verge outside the net', x: -25, z: -42, width: 57, depth: 3.2, radius: 0.5 },
  { id: 'west verge outside the net', x: -57.5, z: -1.5, width: 3.2, depth: 73, radius: 0.5 },
  { id: 'south boundary verge', x: -25, z: 37, width: 58, depth: 2.5, radius: 0.5 },
] as const;

export const CYCLE_PARKING = { minX: 57, maxX: 80, minZ: -5, maxZ: 28, roofX: 69, roofZ: 1, roofWidth: 18, roofDepth: 5.5 } as const;
/** Sideline bench inside the east net, facing the field; scenarios seat avatars on it (seat top in metres). */
export const BENCH = { x: 2.9, z: -6, facing: -Math.PI / 2, length: 1.8, seatHeight: 0.42 } as const;
export const CENTRAL_TREE = { x: 31, z: -10, height: 8, base: 0.14 } as const;

/** Cutout trees are separate from buildings, so their silhouettes have parallax. */
export const TREES: readonly (readonly [number, number, number])[] = [
  ...[7.3, 54.7].flatMap((x) => [-29, -17, -8, 8, 17, 29].map((z) => [x, z, 6.8] as const)),
  ...[20, 42].flatMap((x) => [[x + (x < 31 ? -1.2 : 1.2), 18, 7.4], [x + (x < 31 ? 1.2 : -1.2), 21, 6.2], [x, -23, 6.8], [x, 30.5, 6.8]] as const),
  ...[13, 23, 39, 49].map((x) => [x, -29.5, 6.8] as const),
  ...[-1, 12, 24].map((z) => [82, z, 6.8] as const),
  ...[61, 69, 77].map((x) => [x, -8, 6.8] as const),
  [-57.5, -31, 5.5], [-57.5, -18, 5.8], [-57.5, -5, 5.3], [-57.5, 8, 5.7], [-57.5, 22, 5.5],
  [-48, -42, 5.4], [-36, -42, 5.6], [-24, -42, 5.3], [-12, -42, 5.8], [0, -42, 5.5],
  [-45, 37, 6], [-30, 37, 5.5], [-15, 37, 6], [0, 37, 5.8],
] as const;

/** Coordinates relative to COURTYARD_ORIGIN, for courtyard location camera rigs. */
export const COURTYARD_SHOTS = [
  { id: 'axis', label: '左右対称の植栽と時計の校舎', position: [4, 1.65, 21], target: [4, 3, -26], fov: 58 },
  { id: 'field_entry', label: '植栽の切れ目から運動場へ', position: [-9, 1.65, -8], target: [-33, 1.3, -8], fov: 55 },
  { id: 'entrance', label: '校舎入口までつながる舗装', position: [4, 1.65, -25], target: [4, 2.5, -44], fov: 55 },
  { id: 'bikes', label: '中庭から駐輪場へ', position: [19, 1.65, -8], target: [42, 1.8, -7], fov: 55 },
  { id: 'conversation', label: '中庭の会話', position: [-1.5, 1.4, 3.2], target: [0, 1.2, 0], fov: 48 },
  { id: 'overview', label: '校舎・対称の植栽・運動場への通路', position: [-14, 23, 33], target: [4, 0, -9], fov: 65 },
] as const;

export const GROUND_SHOTS = [
  { id: 'school', label: '校舎と並木', position: [-1.5, 1.5, 5.2], target: [0, 1.2, -2], fov: 52 },
  { id: 'track', label: '防球ネットの奥の並木と樹木帯', position: [4, 1.5, 1], target: [-8, 1.3, -1], fov: 54 },
  { id: 'courtyard', label: '囲い付きの中庭と駐輪場', position: [-4, 1.5, 3], target: [40, 2.5, 5], fov: 58 },
  { id: 'gate', label: '校門側', position: [0, 1.6, -5], target: [27, 2, 30], fov: 55 },
  { id: 'parking', label: '運動場から中庭越しの駐輪場', position: [-5, 1.65, -8], target: [55, 1.7, 1], fov: 44 },
  { id: 'overview', label: '運動場の全景', position: [-30, 39, 48], target: [16, 0, -7], fov: 66 },
] as const;
