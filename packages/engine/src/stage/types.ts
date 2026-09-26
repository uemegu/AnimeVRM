/** 舞台に出すキャラ1人分（シナリオの avatars 指定を解決したもの） */
export interface StageCastMember {
  id: string;
  modelUrl: string;
  /** 立ち位置の座標。省略時は slot から、場所の設定（または既定）の位置を使う */
  position?: [number, number, number];
  slot?: 'left' | 'center' | 'right';
  /** 省略時は横に立つほど少し内側を向く */
  rotationY?: number;
  expression: string;
  expressionWeight: number;
  motion?: string;
  motionLoop: boolean;
  /** モーションを指定したシーン（変わったら同じモーションでも再生し直す） */
  motionCue?: string;
}
