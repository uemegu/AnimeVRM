/** All dimensions are metres. Every facade is a local elevation, independent of the camera. */
export const SHOP = { width: 7.2, depth: 7, height: 10.8, roofRise: 1.5 } as const;
export const STREET = { halfWidth: 5.5, buildingX: 9, length: 65 } as const;
export const SHOP_ROWS = [-24, -16, -8, 0, 8, 16, 24] as const;
export const TREE_ROWS = [-28, -12, 12, 28, 36] as const;
export const FAR = { west: -48, east: 48, north: -62, south: 62 } as const;

/** Same standing point, with actual rotations of 90/180 degrees, rather than lateral camera shifts. */
export const STREET_SHOTS = [
  { id: 'forward', label: '正面の商店街', position: [0, 1.65, 3], target: [0, 2.3, -24], fov: 60 },
  { id: 'left_90', label: '同じ場所から左90度・書店', position: [0, 1.65, 3], target: [-14, 2.5, 3], fov: 58 },
  { id: 'right_90', label: '同じ場所から右90度・ギャラリー', position: [0, 1.65, 3], target: [14, 2.5, 3], fov: 58 },
  { id: 'back_180', label: '同じ場所から後ろ180度', position: [0, 1.65, 3], target: [0, 2.3, 30], fov: 60 },
  { id: 'bookshop', label: '書店の店先を横から', position: [-2.7, 1.65, 7], target: [-5.6, 1.8, 0], fov: 58 },
  { id: 'boutique', label: 'ギャラリーの店先を横から', position: [2.7, 1.65, -4], target: [5.6, 1.8, 0], fov: 58 },
  { id: 'north_end', label: '通りの奥から入口へ振り返る', position: [0, 1.65, -28], target: [0, 2.2, 12], fov: 60 },
  { id: 'overview', label: '厚みのある店舗・屋根・並木の俯瞰', position: [26, 28, 33], target: [0, 1, -4], fov: 62 },
] as const;
