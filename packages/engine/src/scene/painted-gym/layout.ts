/** Metres, floor y=0. North (-z) is the stage; west (-x) receives sunset light. */
export const GYM = { width: 24, depth: 32, wallHeight: 8.5, ridgeHeight: 10.7 } as const;
export const STAGE = { width: 14, depth: 3.2, height: 1.35, z: -14.4 } as const;
/** Actual generated elevation has seven bays; use its measured divisions. */
export const WINDOW_BAYS = [-13.71, -9.14, -4.57, 0, 4.57, 9.14, 13.71] as const;
export const COURT = { halfLength: 10, halfWidth: 6, z: -2.5, hoopX: 10.2 } as const;

/** The first four cuts rotate horizontally at exactly the same point and height. */
export const GYM_SHOTS = [
  { id: 'forward', label: '正面・舞台', position: [0, 1.65, 5], target: [0, 1.65, -15], fov: 62 },
  { id: 'left_90', label: '左90度・夕日の窓とゴール', position: [0, 1.65, 5], target: [-20, 1.65, 5], fov: 62 },
  { id: 'right_90', label: '右90度・窓とギャラリー', position: [0, 1.65, 5], target: [20, 1.65, 5], fov: 62 },
  { id: 'back_180', label: '後ろ180度・入口', position: [0, 1.65, 5], target: [0, 1.65, 25], fov: 62 },
  { id: 'stage_corner', label: '舞台と階段を斜めから', position: [8, 2.2, -7], target: [0, 2.8, -14], fov: 66 },
  { id: 'equipment', label: '跳び箱・マット・ボールかご', position: [-3, 1.65, -5], target: [-8, 0.8, -10], fov: 58 },
  { id: 'reverse', label: '舞台側から入口へ', position: [0, 2, -12], target: [0, 3, 10], fov: 66 },
  { id: 'overview', label: 'ギャラリーから床と鉄骨天井を見渡す', position: [10.6, 6.3, 12], target: [-1, 3.4, -7], fov: 74 },
] as const;
