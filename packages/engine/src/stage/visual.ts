/**
 * 見た目（時間帯・場所）の型。中身の定義はシーン設定のスキーマ（packages/scenario/src/scene.ts）にある
 */
import type {
  FogConfig,
  LensFlareConfig,
  LightingConfig,
  LocationVisualPreset,
  MaterialStyleParams,
  OutlineConfig,
  PostProcessingConfig,
  SunShaftsConfig,
  TimeOfDayId,
  TimeOfDayPreset,
} from '@anime-vrm/scenario';

export type {
  FogConfig,
  LensFlareConfig,
  LightingConfig,
  LocationVisualPreset,
  MaterialStyleParams,
  OutlineConfig,
  PostProcessingConfig,
  SunShaftsConfig,
  TimeOfDayId,
  TimeOfDayPreset,
};

export type DirectionalLightConfig = LightingConfig['directional'];
export type AmbientLightConfig = LightingConfig['ambient'];
export type RimLightConfig = NonNullable<LightingConfig['rim']>;
export type BloomConfig = PostProcessingConfig['bloom'];
export type CinematicShaderConfig = PostProcessingConfig['cinematic'];
export type DiffusionConfig = CinematicShaderConfig['diffusion'];
export type ColorGradingConfig = CinematicShaderConfig['colorGrading'];
export type AdjustmentsConfig = CinematicShaderConfig['adjustments'];
export type VignetteConfig = CinematicShaderConfig['vignette'];
export type ChromaticAberrationConfig = CinematicShaderConfig['chromaticAberration'];
export type SharpenConfig = CinematicShaderConfig['sharpen'];
export type LayeredBackgroundConfig = LocationVisualPreset['layers'];
export type BackgroundLayer = LayeredBackgroundConfig['background'];
export type MidgroundLayer = NonNullable<LayeredBackgroundConfig['midground']>;
export type NeargroundLayer = NonNullable<LayeredBackgroundConfig['nearground']>;
