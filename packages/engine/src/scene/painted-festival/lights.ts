import * as THREE from 'three';
import { ANDON_POSTS, LANTERN_STRINGS, RAILING, STALL, STALLS } from './layout';

/**
 * Light shared across the festival set. The set is unlit paintings, so the
 * lights are faked where they matter:
 * - uFlash: the colour of the fireworks' light right now (Fireworks.ts sets
 *   it every frame); surfaces facing the sky and the river add it.
 * - WARM_POOLS: where the stalls and lanterns light the ground (Ground in
 *   PaintedFestival.ts draws warm pools around them).
 * The avatars are lit by real three.js lights (PaintedFestival.ts): warm
 * point lights at the stalls nearest the stage and a light that follows the
 * fireworks.
 */
export const festivalUniforms = {
  uFlash: { value: new THREE.Color(0, 0, 0) },
  uTime: { value: 0 },
};

/** Warm light on the ground: x, z, radius (m), strength. */
export type Pool = [number, number, number, number];

export const WARM_POOLS: Pool[] = [
  // In front of each stall's counter.
  ...STALLS.map((stall): Pool => [stall.x + stall.facing[0] * 0.1, stall.z + stall.facing[1] * 0.1, 1.9, 0.85]),
  // Under the lantern strings.
  ...LANTERN_STRINGS.strings.map(({ from, to }): Pool => [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 2.2, 0.2]),
  // Andons on the railing posts.
  ...ANDON_POSTS.map((x): Pool => [x, RAILING.z + 0.3, 1.6, 0.7]),
];

/**
 * Point lights that light the avatars: the stall fronts nearest the places the
 * avatars stand (the street by the origin and the promenade in front of it).
 * Each light is a uniform in every avatar material, so keep them few.
 */
const LIT_SPOTS = [[0, 0, 3.5], [0, -9.2, 10]];
export const AVATAR_LIGHTS = STALLS
  .filter((stall) => LIT_SPOTS.some(([x, z, radius]) => Math.hypot(stall.x - x, stall.z - z) < radius))
  .map((stall) => ({ position: [stall.x - stall.facing[0] * 0.2, STALL.headerBottom - 0.2, stall.z - stall.facing[1] * 0.2] as const, color: '#ffb066' }));
