/**
 * Shared layout of the summer festival set. Metres. A T junction: the avatar
 * stands at the origin in a street lined with food stalls on both sides; the
 * street runs into a promenade along the river (-z), stalls along its land
 * side, a railing on its river side, and the river and the lit far bank
 * beyond. Fireworks go up over the river. Camera side is +z.
 */

/** River side of the promenade: the railing stands on this line. */
export const EDGE_Z = -12;
/** Land side of the promenade: the fronts of the riverside stalls. */
export const PROMENADE_Z = -6.3;
/** Water level (the street is at 0). */
export const RIVER_Y = -1.8;

/** The street (stone paving). */
export const GROUND = { minX: -40, maxX: 40, nearZ: 40, farZ: EDGE_Z } as const;
/** Stone embankment along the edge, its river side running down into the water. */
export const EMBANKMENT = { minX: GROUND.minX, maxX: GROUND.maxX, z: EDGE_Z, depth: 0.4, top: 0.15 } as const;

/** Wooden railing with square stone posts; andon lanterns on some posts. */
export const RAILING = {
  z: EDGE_Z - 0.2, minX: GROUND.minX, maxX: GROUND.maxX, postSpacing: 2.4, height: 1.0,
  rails: [0.45, 0.95], postSize: 0.16, railSize: [0.07, 0.09] as const,
} as const;
export const ANDON_POSTS = [-4.8, 4.8, -14.4, 14.4, -24, 24] as const;

/**
 * A stall, in its own frame: the open front faces +z, the counter along the
 * front. The front painting (codex) is a straight-on elevation `width` wide
 * and `height` tall: the signboard at the top (header), the lit interior and
 * goods in the middle (mapped on the back wall), the counter front at the
 * bottom.
 */
export const STALL = {
  width: 2.6, depth: 1.9, height: 2.6,
  counterHeight: 0.9, counterDepth: 0.45,
  headerBottom: 2.1,
  roofFront: 2.62, roofBack: 2.85, overhang: 0.4,
  postSize: 0.08,
} as const;

export type StallKind = 'takoyaki' | 'kingyo' | 'kakigori' | 'ringoame' | 'yakisoba' | 'omen';
/** Awning stripes per stall (two colours). */
export const STALL_COLORS: Record<StallKind, [string, string]> = {
  takoyaki: ['#c8323a', '#f4efe4'],
  kingyo: ['#2f6fb5', '#f4efe4'],
  kakigori: ['#3d9bc7', '#f4efe4'],
  ringoame: ['#d0414a', '#f7d2d4'],
  yakisoba: ['#e08a1e', '#f4efe4'],
  omen: ['#7a4aa8', '#f4efe4'],
};

/**
 * Where the bands lie in each front painting (fractions of the image height
 * from the top): the bottom of the signboard and the top of the counter. The
 * generated paintings drift a little from the guide, so they are measured.
 */
export const STALL_BANDS: Record<StallKind, { header: number; counter: number }> = {
  takoyaki: { header: 0.23, counter: 0.655 },
  kingyo: { header: 0.21, counter: 0.645 },
  kakigori: { header: 0.21, counter: 0.655 },
  ringoame: { header: 0.195, counter: 0.65 },
  yakisoba: { header: 0.225, counter: 0.64 },
  omen: { header: 0.2, counter: 0.68 },
};

/** Street: stall fronts at x = ±STREET_HALF, facing the middle. */
export const STREET_HALF = 2.7;

/**
 * Every stall: the middle of its counter front (x, z) and the way it faces.
 * The street rows face each other; the promenade row faces the river, its
 * stalls starting just outside the street's corner stalls.
 */
export type StallPlacement = { kind: StallKind; x: number; z: number; facing: [number, number] };
const STREET_Z = [-4.3, -1.4, 1.5, 4.4, 7.3, 10.2, 13.1];
const STREET_LEFT: StallKind[] = ['kingyo', 'takoyaki', 'omen', 'kakigori', 'yakisoba', 'ringoame', 'takoyaki'];
const STREET_RIGHT: StallKind[] = ['ringoame', 'yakisoba', 'kakigori', 'kingyo', 'omen', 'takoyaki', 'yakisoba'];
const PROMENADE_X = [6.2, 9.1, 12, 14.9, 17.8, 20.7, 23.6, 26.5];
const PROMENADE_LEFT: StallKind[] = ['yakisoba', 'kakigori', 'ringoame', 'omen', 'takoyaki', 'kingyo', 'kakigori', 'yakisoba'];
const PROMENADE_RIGHT: StallKind[] = ['takoyaki', 'omen', 'kingyo', 'yakisoba', 'kakigori', 'ringoame', 'takoyaki', 'omen'];
export const STALLS: StallPlacement[] = [
  ...STREET_LEFT.map((kind, i): StallPlacement => ({ kind, x: -STREET_HALF, z: STREET_Z[i], facing: [1, 0] })),
  ...STREET_RIGHT.map((kind, i): StallPlacement => ({ kind, x: STREET_HALF, z: STREET_Z[i], facing: [-1, 0] })),
  ...PROMENADE_LEFT.map((kind, i): StallPlacement => ({ kind, x: -PROMENADE_X[i], z: PROMENADE_Z, facing: [0, -1] })),
  ...PROMENADE_RIGHT.map((kind, i): StallPlacement => ({ kind, x: PROMENADE_X[i], z: PROMENADE_Z, facing: [0, -1] })),
];

/**
 * Strings of paper lanterns: across the street between the stall roofs, and
 * along the promenade between wooden poles. Height at the ends, sag in the middle.
 */
export type LanternString = { from: [number, number]; to: [number, number]; poles?: boolean };
const LANTERN_HEIGHT = 3.8;
export const LANTERN_STRINGS = {
  height: LANTERN_HEIGHT, sag: 0.3, spacing: 0.9,
  strings: [
    ...[-3.2, 0.6, 4.4, 8.2, 12].map((z): LanternString => ({ from: [-STREET_HALF - 0.2, z], to: [STREET_HALF + 0.2, z] })),
    // Poles off the middle, so none stands in the shots straight at the river.
    ...[-33, -27, -21, -15, -9, -3, 3, 9, 15, 21, 27].map((x): LanternString => ({ from: [x, -9.2], to: [x + 6, -9.2], poles: true })),
  ],
} as const;

/** Far bank: a standee painting whose bottom edge is the water line, across the river. */
export const FAR_BANK = { z: -52, minX: -90, maxX: 90, bottom: RIVER_Y + 0.05, height: 18, repeat: 90 } as const;
/** Land side and the ends of the street: the town at night. */
export const FAR = { south: GROUND.nearZ, west: GROUND.minX, east: GROUND.maxX, repeat: 60 } as const;
export const SKY_RADIUS = 95;
export const TILES = { paving: 2.4 } as const;

/** Nobori banner by the railing (as in the reference picture). */
export const BANNER = { x: 3.6, z: EDGE_Z + 0.35, height: 4.2 } as const;
/** Where the street meets the promenade (for the bokeh and lights). */
export const JUNCTION_Z = PROMENADE_Z;

/** Fireworks burst over the river within this box (they must stay inside the 100 m draw distance). */
export const FIREWORKS = { minX: -32, maxX: 32, z: [-64, -78], height: [22, 38], launchY: RIVER_Y } as const;

/** Moon (for the cool key light and its glint on the water). */
export const MOON_DIRECTION = [-0.55, 0.42, -1] as const;

export const FESTIVAL_SHOTS = [
  { label: '屋台通り', position: [0, 1.35, 2.4], target: [0, 1.2, 0], fov: 44 },
  { label: '川を背に', position: [0, 1.35, -7.6], target: [0, 1.25, -10.2], fov: 44 },
  { label: '遊歩道の奥へ', position: [7, 1.45, -8.6], target: [-4, 1.3, -9.6], fov: 46 },
  { label: '花火を見上げる', position: [1.0, 1.1, -7.2], target: [0, 3.6, -16], fov: 55 },
] as const;
