/** 舞台に出すキャラ1人分（シナリオの avatars 指定を解決したもの） */
export interface StageCastMember {
  id: string;
  modelUrl: string;
  position: [number, number, number];
  rotationY: number;
  expression: string;
  expressionWeight: number;
  motion?: string;
  motionLoop: boolean;
  /** モーションを指定したシーン（変わったら同じモーションでも再生し直す） */
  motionCue?: string;
}
