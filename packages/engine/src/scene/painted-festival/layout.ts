/**
 * Shared layout of the summer festival set. Metres. The avatar stands at the
 * origin in a street lined with food stalls on both sides; the street ends at
 * a riverside railing (-z), with the river and the lit far bank beyond it.
 * Fireworks go up over the river. Camera side is +z.
 */

/** River side of the street: the railing stands on this line. */
export const EDGE_Z = -6;
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

/** Street: stall fronts at x = ±STREET_HALF, facing the middle; z of each stall's centre. */
export const STREET_HALF = 2.7;
const ROW_Z = [-4.3, -1.4, 1.5, 4.4, 7.3, 10.2, 13.1];
export const STALLS: { kind: StallKind; side: -1 | 1; z: number }[] = [
  ...(['kingyo', 'takoyaki', 'omen', 'kakigori', 'yakisoba', 'ringoame', 'takoyaki'] as const).map((kind, i) => ({ kind, side: -1 as const, z: ROW_Z[i] })),
  ...(['ringoame', 'yakisoba', 'kakigori', 'kingyo', 'omen', 'takoyaki', 'yakisoba'] as const).map((kind, i) => ({ kind, side: 1 as const, z: ROW_Z[i] })),
];

/** Strings of paper lanterns across the street (z of each string) and their height at the posts / the sag in the middle. */
export const LANTERN_STRINGS = { z: [-3.2, 0.6, 4.4, 8.2, 12], height: 3.8, sag: 0.3, spacing: 0.9 } as const;

/** Far bank: a standee painting whose bottom edge is the water line, across the river. */
export const FAR_BANK = { z: -46, minX: -90, maxX: 90, bottom: RIVER_Y + 0.05, height: 18, repeat: 90 } as const;
/** Land side and the ends of the street: the town at night. */
export const FAR = { south: GROUND.nearZ, west: GROUND.minX, east: GROUND.maxX, repeat: 60 } as const;
export const SKY_RADIUS = 95;
export const TILES = { paving: 2.4 } as const;

/** Nobori banner by the railing (as in the reference picture). */
export const BANNER = { x: 3.6, z: EDGE_Z + 0.35, height: 4.2 } as const;

/** Fireworks burst over the river within this box (they must stay inside the 100 m draw distance). */
export const FIREWORKS = { minX: -32, maxX: 32, z: [-60, -74], height: [22, 38], launchY: RIVER_Y } as const;

/** Moon (for the cool key light and its glint on the water). */
export const MOON_DIRECTION = [-0.55, 0.42, -1] as const;

export const FESTIVAL_SHOTS = [
  { label: '屋台通り', position: [0, 1.35, 2.4], target: [0, 1.2, 0], fov: 44 },
  { label: '花火を見上げる', position: [0.4, 1.0, 2.2], target: [0, 2.2, -4], fov: 50 },
  { label: '引き', position: [0.3, 1.6, 5.5], target: [0, 1.4, -3], fov: 50 },
] as const;
