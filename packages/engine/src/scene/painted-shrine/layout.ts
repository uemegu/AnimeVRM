/** All dimensions are metres. North is -z; the worship hall faces south (+z) toward the talking spot at the origin. */
export const HAIDEN = {
  z: -17, width: 9, depth: 9, wall: 6, plinth: 0.72,
  eave: 2.2, eaveY: 5.9, hipY: 8.4, ridgeY: 10.5, ridgeHalf: 4.2,
  veranda: 1.6, stepWidth: 3.6,
} as const;
export const HONDEN = { z: -28.5, width: 6, depth: 6, wall: 5, eave: 1.5, ridgeY: 8.4 } as const;
export const TORII = { z: 7, span: 4.6, height: 5.1 } as const;
export const SANDO = { halfWidth: 1.3, north: -9.4, south: 33 } as const;
export const PRECINCT = { west: -18, east: 18, north: -36, south: 26 } as const;
export const FAR = { west: -42, east: 42, north: -48, south: 46 } as const;

/** Same standing point, with actual rotations of 90/180 degrees, rather than lateral camera shifts. */
export const SHRINE_SHOTS = [
  { id: 'forward', label: '正面・拝殿', position: [0, 1.65, 3], target: [0, 3.2, -17], fov: 60 },
  { id: 'left_90', label: '同じ場所から左90度・絵馬掛けと社務所', position: [0, 1.65, 3], target: [-20, 2.4, 3], fov: 60 },
  { id: 'right_90', label: '同じ場所から右90度・手水舎', position: [0, 1.65, 3], target: [20, 2.4, 3], fov: 60 },
  { id: 'back_180', label: '同じ場所から後ろ180度・鳥居', position: [0, 1.65, 3], target: [0, 2.6, 23], fov: 60 },
] as const;
