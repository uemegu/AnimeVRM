/**
 * 描画の設定の型（ToonShader と太陽の演出が使う）。値は時間帯の設定（assets/studio/time-of-day.json）から渡す
 */

export interface MaterialStyleParams {
  color: string;
  // 影の乗算色（sRGB）。MToon の影は「この色 × マテリアル自身のテクスチャ」になるので、
  // アバターごとに服や髪の色が違ってもその色を暗くした影になる
  shadeMultiply: string;
  shadingToonyFactor: number;
  shadingShiftFactor: number;
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

export interface EyeGlowConfig {
  enabled: boolean;
  intensity: number;
}

export interface BottomGradientConfig {
  enabled: boolean;
  startY: number;
  endY: number;
  intensity: number;
  shadowWeight: number;
  color: string;
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

/** 肌・髪・服のマテリアル */
export interface MaterialSet {
  body: MaterialStyleParams;
  hair: MaterialStyleParams;
  cloth: MaterialStyleParams;
}

/** 輪郭線 */
export interface OutlineStyle {
  enabled: boolean;
  useSmoothNormal: boolean;
  screenSpaceWidth: boolean;
  autoLineWeight: boolean;
  darknessFactor: number;
  widthFactor: number;
  lightingMixFactor: number;
}
