import * as THREE from 'three';
import { ANDON_POSTS, LANTERN_STRINGS, RAILING, STALL, STALLS, STREET_HALF } from './layout';

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
  ...STALLS.map((stall): Pool => [stall.side * (STREET_HALF - 0.1), stall.z, 1.9, 0.85]),
  // Under the lantern strings.
  ...LANTERN_STRINGS.z.map((z): Pool => [0, z, 2.2, 0.2]),
  // Andons on the railing posts.
  ...ANDON_POSTS.map((x): Pool => [x, RAILING.z + 0.3, 1.6, 0.7]),
];

/** Point lights that light the avatars: the stall fronts nearest the stage. */
export const AVATAR_LIGHTS = STALLS
  .filter((stall) => Math.abs(stall.z) < 3.5)
  .map((stall) => ({ position: [stall.side * (STREET_HALF + 0.2), STALL.headerBottom - 0.2, stall.z] as const, color: '#ffb066' }));
