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
  // 暗い色（濃紺のブレザーなど）の光が当たる側を明るくする量。影の側はテクスチャの色のままなので、
  // 暗い服でも明暗の差が見える（アニメで濃い色の服を明るめに塗り、影で締めるのと同じ）
  darkLitLift?: number;
  // 白に近い色の光が当たる側に掛ける倍率（1 でそのまま）。白いシャツが光って見えないように抑える
  brightLitScale?: number;
  // 明暗の境目に乗せる色（乗算、sRGB）と強さ。肌の中で光が散ったような、境目だけ赤みの強い帯にする
  terminatorColor?: string;
  terminatorStrength?: number;
  // 光が真っすぐ当たる面にもう一段明るい色を重ねる（肩・袖の上面、プリーツの山など）。
  // 強さは光が当たる側の色に足す割合（0 で無効）、しきい値は光の向きとの角度（法線・光の内積、-1〜1）。
  // 色はキーライトの色を掛けて足すので、時間帯の色が乗る（濃い服でも明るい面が見えるように）
  litHighlightStrength?: number;
  litHighlightThreshold?: number;
  litHighlightColor?: string;
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
