/**
 * 3D・ビジュアル描画用型定義
 * 時間帯（ライト・ポストプロセス・マテリアル）とロケーション（背景）を直交・独立管理
 */

export type TimeOfDayId = 'morning' | 'day' | 'evening' | 'night' | 'divine';

export interface DirectionalLightConfig {
  color: string;
  intensity: number;
  position: { x: number; y: number; z: number };
}

export interface AmbientLightConfig {
  color: string;
  intensity: number;
}

export interface RimLightConfig {
  enabled: boolean;
  color: string;
  intensity: number;
  position: { x: number; y: number; z: number };
}

export interface DepthRimConfig {
  enabled: boolean;
  power: number;
  threshold: number;
  intensity: number;
}

export interface SunShaftsConfig {
  enabled: boolean;
  followDirectionalLight: boolean;
  sunPosition: {
    x: number;
    y: number;
    z: number;
  };
  exposure: number;
  decay: number;
  density: number;
  weight: number;
  color: string;
  shimmer: number;
}

export interface LensFlareConfig {
  enabled: boolean;
  sunSize: number;
  sunColor: string;
  glowIntensity: number;
  starburstIntensity: number;
  anamorphicIntensity: number;
  ghostIntensity: number;
  haloIntensity: number;
}

export interface LightingConfig {
  directional: DirectionalLightConfig;
  ambient: AmbientLightConfig;
  rim?: RimLightConfig;
  depthRim?: DepthRimConfig;
  // 天使の輪を寄せる色（sRGB）。時間帯の光になじませる。未指定なら白
  hairRingTint?: string;
  sunShafts?: SunShaftsConfig;
  lensFlare?: LensFlareConfig;
}

export interface BloomConfig {
  enabled: boolean;
  strength: number;
  radius: number;
  threshold: number;
}

export interface DiffusionConfig {
  enabled: boolean;
  strength: number;
  radius: number;
}

export interface ColorGradingConfig {
  enabled: boolean;
  shadowTint: string;
  highlightTint: string;
  strength: number;
  contrast: number;
  gamma: number;
}

export interface AdjustmentsConfig {
  saturation: number;
  brightness: number;
  contrast: number;
}

export interface VignetteConfig {
  enabled: boolean;
  offset: number;
  darkness: number;
  color: string;
}

export interface ChromaticAberrationConfig {
  enabled: boolean;
  offset: number;
}

export interface SharpenConfig {
  enabled: boolean;
  amount: number;
}

export interface CinematicShaderConfig {
  diffusion: DiffusionConfig;
  colorGrading: ColorGradingConfig;
  adjustments: AdjustmentsConfig;
  vignette: VignetteConfig;
  chromaticAberration: ChromaticAberrationConfig;
  sharpen: SharpenConfig;
}

export interface PostProcessingConfig {
  bloom: BloomConfig;
  cinematic: CinematicShaderConfig;
}

export interface FogConfig {
  enabled: boolean;
  color: string;
  density: number;
}

export interface MaterialStyleParams {
  color: string;
  shadowHueShift: number;
  shadowLightnessFactor: number;
  shadowBoundaryTint: number;
  // 影の乗算色（sRGB）。MToon の影は「この色 × マテリアル自身のテクスチャ」になるので、
  // アバターごとに服や髪の色が違ってもその色を暗くした影になる。未指定なら自動計算
  shadeMultiply?: string;
  shadingToonyFactor: number;
  shadingShiftFactor: number;
  faceShadingShiftFactor?: number;
  giEqualizationFactor: number;
  matcapEnabled: boolean;
  emissiveIntensity: number;
  rimEnabled: boolean;
  rimColor: string;
  parametricRimFresnelPowerFactor: number;
  parametricRimLiftFactor: number;
  rimLightingMixFactor: number;
  outlineWidthFactor: number;
}

export interface OutlineConfig {
  enabled: boolean;
  useSmoothNormal: boolean;
  screenSpaceWidth: boolean;
  autoLineWeight: boolean;
  darknessFactor: number;
  widthFactor: number;
  lightingMixFactor: number;
}

export interface TimeOfDayPreset {
  id: TimeOfDayId;
  name: string;
  lighting: LightingConfig;
  postProcessing: PostProcessingConfig;
  fog: FogConfig;
  materials?: {
    body: MaterialStyleParams;
    hair: MaterialStyleParams;
    cloth: MaterialStyleParams;
  };
  outline?: OutlineConfig;
}

export interface BackgroundLayer {
  url?: string;
  color?: string;
}

export interface MidgroundLayer {
  url?: string;
  position: { x: number; y: number; z: number };
  scale: number;
  opacity: number;
}

export interface NeargroundLayer {
  url?: string;
  position: { x: number; y: number; z: number };
  scale: number;
  opacity: number;
}

export interface LayeredBackgroundConfig {
  background: BackgroundLayer;
  midground?: MidgroundLayer;
  nearground?: NeargroundLayer;
}

export interface LocationVisualPreset {
  id: string;
  name: string;
  isIndoor?: boolean;
  layers: LayeredBackgroundConfig;
}
