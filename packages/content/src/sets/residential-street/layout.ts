/**
 * 住宅街と長い直線道路。寸法はメートル。地面は y=0、道路は z 方向にまっすぐ伸び、北が -z。
 * 立ち位置（原点）は道路の中央で、北へ 330m、南へ 70m 見通せる。
 */
export const ROAD = { halfWidth: 2.75, gutter: 0.45, south: 70, north: -330 } as const;
/** 道路の端（側溝の外側）= 塀の内側の線 */
export const VERGE = ROAD.halfWidth + ROAD.gutter;
export const WALL = { thickness: 0.15, height: 1.3, gate: 2.6 } as const;
/** 1区画の間口（道路沿いの長さ）と、区画の並びはじめ（南端の区画の中心 z） */
export const LOT = { pitch: 13, firstZ: 58, count: 30, crossEvery: 5 } as const;
/** 家：間口 width（道路沿い）× 奥行 depth、軒の高さ height、屋根の立ち上がり roofRise。塀から setback だけ下がる */
export const HOUSE = { width: 9.5, depth: 8, height: 6.2, roofRise: 1.9, setback: 2.5 } as const;
/** 交差する道の半分の幅と、東西の外周（遠景の樹木帯を立てる位置） */
export const CROSS = { halfWidth: 3 } as const;
export const FAR = { west: -62, east: 62, north: ROAD.north - 2, south: ROAD.south + 2 } as const;
export const POLE = { x: VERGE - 0.22, every: 26, height: 9 } as const;

/** 区画 i（0 = 南端）の中心 z。crossEvery ごとに1区画ぶんを交差する道にする */
export const lotZ = (i: number) => LOT.firstZ - LOT.pitch * i;
export const isCrossStreet = (i: number) => i % LOT.crossEvery === LOT.crossEvery - 1;

/** 同じ立ち位置から 90 度・180 度まわして撮る確認用のカット */
export const STREET_SHOTS = [
  { id: 'forward', label: '正面（北へ伸びる道路）', position: [0, 1.5, 2], target: [0, 1.5, -40], fov: 50 },
  { id: 'left_90', label: '同じ場所から左90度', position: [0, 1.5, 2], target: [-20, 1.8, 2], fov: 58 },
  { id: 'right_90', label: '同じ場所から右90度', position: [0, 1.5, 2], target: [20, 1.8, 2], fov: 58 },
  { id: 'back_180', label: '同じ場所から後ろ180度', position: [0, 1.5, 2], target: [0, 1.5, 40], fov: 50 },
] as const;
