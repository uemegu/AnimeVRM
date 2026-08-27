export type CameraStartAngle =
  | 'continue'
  | 'front'
  | 'farFront'
  | 'right'
  | 'left'
  | 'back'
  | 'lowAngle'
  | 'highAngle'
  | 'closeUp';

export type CameraPreset =
  | 'hold'
  | 'pushIn'
  | 'pullOut'
  | 'panLeft'
  | 'panRight'
  | 'orbitLeft'
  | 'orbitRight'
  | 'orbitLeftHalf'
  | 'orbitRightHalf'
  | 'lowAngleUp'
  | 'riseUp'
  | 'diveDown'
  | 'punchIn';

export type TextAnimationPreset =
  | 'static'
  | 'fade'
  | 'slideLeft'
  | 'slideRight'
  | 'slideUp'
  | 'scaleIn'
  | 'punch';

export interface TextConfig {
  text: string;
  animationPreset: TextAnimationPreset;
  x: number; // 0 - 100 (%)
  y: number; // 0 - 100 (%)
  fontSize: number; // 5 - 40 (vw)
  color: string; // hex color
  fontWeight: number; // 100 - 900
}

export interface CutConfig {
  enabled: boolean;
  duration: number; // seconds
  startAngle?: CameraStartAngle; // Cut start camera position preset
  cameraDistance?: number; // Distance multiplier (0.5 - 3.0, default 1.0)
  cameraPreset: CameraPreset;
  cameraStrength: number; // multiplier, default 1.0
  motion?: string; // e.g. '/animations/Walking.fbx' or 'none'
  backText: TextConfig;
  frontText: TextConfig;
}



export interface ShortAnimationConfig {
  cuts: CutConfig[];
}
