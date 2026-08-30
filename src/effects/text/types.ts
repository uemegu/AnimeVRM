import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

/**
 * Supported animation types for effect text
 */
export type EffectAnimationType =
  | 'pop'       // Scale pops up with overshoot/bounce at spawn
  | 'shake'     // High-frequency jitter in position/rotation
  | 'float'     // Smooth floating up and down
  | 'rise'      // Floats upward steadily (for rising stream particles)
  | 'drop'      // Slowly falls downward (for "gaan")
  | 'spinSmall' // Gentle rotational wobble
  | 'pulse'     // Rhythmic heartbeat-like scaling
  | 'fadeOut';  // Fades out over lifetime

/**
 * Anchor positions for VRM humanoid bones or custom Object3D
 */
export type VRMAnchorName =
  | 'head'
  | 'neck'
  | 'chest'
  | 'spine'
  | 'hips'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftHand'
  | 'rightHand'
  | 'leftFoot'
  | 'rightFoot';

export type EffectAnchor = VRMAnchorName | 'custom' | THREE.Object3D;

/**
 * Built-in preset names
 */
export type EffectPresetName =
  | 'wanawana'  // 震え・緊張・悔しさ（左右から「ワナ」が上昇）
  | 'iraira'    // 怒り・トゲ・振動（左右から「イラ」が上昇）
  | 'gaan'      // ショック・落ち込み・縦線（頭上中央・落下）
  | 'shiin'     // 静寂・沈黙・点々（頭上中央・浮遊）
  | 'kirakira'  // 輝き・星・ポップ（頭上中央・星装飾）
  | 'doki'      // ドキドキ・鼓動（左右から「ドキ」が拍動上昇）
  | 'biku'      // ビクッ・驚き（頭上中央・衝撃）
  | 'yatta';    // やったー！・歓喜・喜び（頭上中央・ポップジャンプ）

/**
 * Decoration types drawn onto the 2D canvas
 */
export type DecorationType =
  | 'sweat'        // 汗マーク (💧)
  | 'anger'        // 怒りマーク (💢)
  | 'sparkle'      // キラキラ星・星屑 (✦, ★)
  | 'spikes'       // トゲトゲ・ギザギザ集中線
  | 'shockLines'   // ガーン縦線ストライプ
  | 'dots'         // 点々 (・・・・)
  | 'question'     // はてな (?)
  | 'exclamation'; // ビックリ (!)

/**
 * Style configuration for canvas rendering
 */
export interface EffectTextStyle {
  /** Font family stack */
  fontFamily?: string;
  /** Font weight (default: '900') */
  fontWeight?: string | number;
  /** Primary text fill color or gradient colors [start, end] */
  textColor: string | [string, string];
  /** Gradient direction: 'vertical' | 'horizontal' */
  gradientDirection?: 'vertical' | 'horizontal';
  /** Primary text stroke/outline color */
  strokeColor?: string;
  /** Primary stroke width in canvas pixels */
  strokeWidth?: number;
  /** Secondary outer stroke color (for double outline) */
  outerStrokeColor?: string;
  /** Secondary outer stroke width */
  outerStrokeWidth?: number;
  /** Drop shadow color */
  shadowColor?: string;
  /** Drop shadow offset { x, y } */
  shadowOffset?: { x: number; y: number };
  /** Drop shadow blur radius */
  shadowBlur?: number;
  /** Canvas background style (e.g. comic bubble, spikes, or none) */
  background?: 'none' | 'spikes' | 'cloud' | 'speedLines';
  /** Background color */
  backgroundColor?: string;
  /** Background stroke */
  backgroundStroke?: string;
  /** Decorations to draw around text */
  decorations?: DecorationType[];
  /** Decoration color override */
  decorationColor?: string;
  /** Individual character slant/rotation jitter (for hand-drawn comic feel) */
  charJitter?: {
    rotationRange?: number;
    offsetYRange?: number;
    scaleRange?: number;
  };
  /** Base text slant (skewX in degrees) */
  slant?: number;
}

/**
 * Stream configuration for bubbling / rising texts (e.g. 「ワナ」「ワナ」「ワナ」)
 */
export interface StreamConfig {
  /** Subphrase to repeat or split (e.g. 'ワナ', 'イラ', 'ドキ') */
  phrase?: string;
  /** Total number of word particles to spawn */
  count?: number;
  /** Interval in seconds between particle spawns */
  interval?: number;
  /** Horizontal spread width (distance from center, e.g. 0.3) */
  spreadX?: number;
  /** Upward rising speed in Three.js units/s */
  riseSpeed?: number;
  /** Base lifetime per particle in seconds */
  particleDuration?: number;
  /** Particle scale multiplier */
  particleScale?: number;
}

/**
 * Spawn mode
 */
export type EffectSpawnMode = 'single' | 'stream' | 'surround';

/**
 * Preset definition
 */
export interface EffectTextPreset {
  name: string;
  style: EffectTextStyle;
  /** Default spawn mode: 'single' (centered banner) or 'stream' (rising bubbling words) */
  spawnMode?: EffectSpawnMode;
  /** Default animations to apply to instances */
  animations: EffectAnimationType[];
  /** Default lifespan in seconds */
  defaultDuration: number;
  /** Default 3D scale in Three.js units (width) */
  defaultScale: number;
  /** Default offset from anchor (relative to target bone center) */
  defaultOffset: THREE.Vector3Like;
  /** Shake intensity if 'shake' is enabled */
  shakeIntensity?: {
    position?: number;
    rotation?: number;
    frequency?: number;
  };
  /** Float speed and height */
  floatParams?: {
    speed?: number;
    height?: number;
  };
  /** Drop speed (Three.js units / s) */
  dropSpeed?: number;
  /** Upward rise speed (Three.js units / s) */
  riseSpeed?: number;
  /** Stream configuration if spawnMode is 'stream' */
  streamConfig?: StreamConfig;
}

/**
 * Options when showing an effect text
 */
export interface ShowEffectTextOptions {
  /** The text string to display (e.g. "ワナワナ", "ガーン") */
  text: string;
  /** Target VRM instance or THREE.Object3D */
  target?: VRM | THREE.Object3D;
  /** Anchor bone or position (default: 'head') */
  anchor?: EffectAnchor;
  /** World or local offset from anchor position (default: centered above anchor) */
  offset?: THREE.Vector3Like;
  /** Style preset to use */
  stylePreset?: EffectPresetName | string;
  /** Spawn mode override: 'single' or 'stream' */
  mode?: EffectSpawnMode;
  /** Stream configuration override */
  streamConfig?: Partial<StreamConfig>;
  /** Custom style overrides */
  customStyle?: Partial<EffectTextStyle>;
  /** Total duration in seconds */
  duration?: number;
  /** 3D Scale multiplier */
  scale?: number;
  /** Custom animations override */
  animations?: EffectAnimationType[];
  /** Optional custom update callback */
  onUpdate?: (progress: number, instance: any) => void;
  /** Optional onComplete callback */
  onComplete?: () => void;
}
