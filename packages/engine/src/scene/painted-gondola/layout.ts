/**
 * Shared layout of the Ferris wheel gondola at sunset (after
 * tmp/夕暮れの観覧車ゴンドラから望む遊園地.png). Metres, floor at y = 0.
 * The gondola faces the sunset over the bay at -z (the reference painting looks that way);
 * the wheel itself stands behind it at +z, so the front window has a clear view and the
 * back window looks into the spokes. Benches line the front and back walls, facing each other.
 */
export const HALF_WIDTH = 1.0;
export const HALF_DEPTH = 1.2;
export const HEIGHT = 2.1;
/** Wall panels: steel below the sills and above the window heads. */
export const SILL = { front: 0.9, side: 0.78 } as const;
export const WINDOW_TOP = 1.86;
/**
 * The corners are chamfered: a steel column runs diagonally across each corner between the
 * end window and the side window, CORNER metres along each wall (as in the painting).
 */
export const CORNER = { leg: 0.2, thickness: 0.05 } as const;
/** Window frames (square section). */
export const FRAME = 0.05;

/** Benches against the front (-z) and back (+z) walls. */
export const BENCH = { depth: 0.5, seat: 0.41, cushion: 0.09, backTop: 0.88, backThickness: 0.1 } as const;
/**
 * Hinged door in the right (+x) side wall: the opening spans z within ±halfWidth from the floor
 * to the window head, between two door posts that stand proud of the wall into the cabin.
 * The leaf hinges on its +z edge and latches on its -z edge.
 */
export const DOOR = { halfWidth: 0.42, post: 0.05, postDepth: 0.13 } as const;
/** Handrails across the side windows: ends on the corner columns, clamped to the mullion. */
export const HANDRAIL = { y: 1.06, standoff: 0.07, radius: 0.02 } as const;

/**
 * The wheel: its plane is z = PLANE_Z (behind the back wall), our gondola hangs from the rim
 * point straight above its roof, ANGLE degrees past the top towards -x.
 */
export const WHEEL = {
  radius: 40,
  planeZ: 3.2,
  /** Distance between the two rim/spoke chords of the truss, along z. */
  truss: 1.3,
  pivotY: HEIGHT + 0.55,
  angle: 22,
  spokes: 16,
  gondolas: 32,
} as const;
export const HUB = {
  x: WHEEL.radius * Math.sin(WHEEL.angle * Math.PI / 180),
  y: WHEEL.pivotY - WHEEL.radius * Math.cos(WHEEL.angle * Math.PI / 180),
  z: WHEEL.planeZ,
} as const;

/** The ground of the amusement park far below, and the panorama around it. */
export const GROUND_Y = HUB.y - WHEEL.radius - 6;
/** Panorama cylinder: radius, and the height of the painted horizon (eye level). */
export const PANORAMA = { radius: 110, horizonY: 1.25 } as const;

/** Seats (gondola coordinates) for pose_sit_seat: two people per bench, the root 0.2 m in from the seat edge so the shins clear the bench base. rotationY faces the opposite bench. */
export const SEATS = {
  front: { z: -HALF_DEPTH + 0.3, rotationY: 0 },
  back: { z: HALF_DEPTH - 0.3, rotationY: Math.PI },
  x: 0.42,
} as const;
