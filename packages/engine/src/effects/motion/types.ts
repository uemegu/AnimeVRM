import * as THREE from 'three';

export type LimbType = 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';

export interface LimbJointNodes {
  root: THREE.Object3D;   // upperArm or upperLeg
  mid: THREE.Object3D;    // lowerArm or lowerLeg
  tip: THREE.Object3D;    // hand or foot
}

export interface LimbHistorySample {
  time: number;           // Absolute timestamp in seconds
  rootPos: THREE.Vector3; // World position of root
  midPos: THREE.Vector3;  // World position of mid
  tipPos: THREE.Vector3;  // World position of tip
  relativeTipVel: THREE.Vector3; // Velocity vector of tip (m/s)
  relativeMidVel: THREE.Vector3; // Velocity vector of mid (m/s)
  relativeRootVel: THREE.Vector3;// Velocity vector of root (m/s)
  speed: number;          // Tip relative speed (m/s)
}

export interface FastMotionConfig {
  enabled: boolean;
  enableArms: boolean;
  enableLegs: boolean;

  // 速度しきい値
  minSpeed: number;           // エフェクト開始速度 (m/s)
  maxSpeed: number;           // 最大効果になる速度 (m/s)
  stopSpeed: number;          // エフェクト終了速度 (ヒステリシスしきい値, m/s)

  // スピード線（軌跡）
  speedLinesEnabled: boolean;
  trailDuration: number;      // 軌跡の保持時間 (秒, 0.10〜0.18s)
  ribbonCount: number;        // 軌跡の本数 (2〜4本)
  ribbonMaxWidth: number;     // 軌跡の最大幅 (メートル単位)

  // 残像
  afterimagesEnabled: boolean;
  afterimageCount: number;    // 残像数 (2〜3体)
  afterimageInterval: number; // 残像間隔 (秒, 例: 0.04s)
  afterimageOpacity: number;  // 残像の基本不透明度

  // 方向性アウトラインブラー
  directionalBlurEnabled: boolean;
  blurSamples: number;        // 方向性ブラーのサンプル数
  blurMaxDistance: number;    // ブラー最大距離 (メートル単位)

  // スタイル・色調
  effectColor: string;        // メイン色 (白またはキャラ固有色)
  accentColor: string;        // アクセント・グラデーション色 (薄青・シアン等)
}

export const DEFAULT_FAST_MOTION_CONFIG: FastMotionConfig = {
  enabled: true,
  enableArms: true,
  enableLegs: true,

  // 速度しきい値 (アニメ的に手足を振ったり突き出したりした時に自然に発動)
  minSpeed: 1.2,             // 1.2 m/s 超えで発火
  maxSpeed: 2.4,             // 2.4 m/s で最大強度 (パンチ・手振り・キックで完全発火)
  stopSpeed: 0.8,            // 0.8 m/s 以下に減速するまで維持 (チャタリング防止)

  // スピード線: 初期状態ではスピード線が主体
  speedLinesEnabled: true,
  trailDuration: 0.16,       // 160ms
  ribbonCount: 3,            // 3本のシャープなライン
  ribbonMaxWidth: 0.055,     // 5.5cm幅

  // 残像: 薄く残る腕・脚のシルエット
  afterimagesEnabled: true,
  afterimageCount: 3,
  afterimageInterval: 0.038, // 約38ms間隔
  afterimageOpacity: 0.35,   // 適度な存在感の残像

  // 方向性ブラー (シーンや演出で明示的に有効化されるまでデフォルトはOFF)
  directionalBlurEnabled: false,
  blurSamples: 8,
  blurMaxDistance: 0.065,    // 6.5cm

  // カラー
  effectColor: '#ffffff',    // 発光ホワイト
  accentColor: '#93c5fd',    // 淡いアニメ風ライトシアンブルー
};
