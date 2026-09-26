/**
 * シーン設定（assets/studio/time-of-day.json・locations.json）のスキーマ。
 * 各項目の meta に表示名（日英）と数値の範囲を持たせ、Studio の編集フォームはここから組み立てる。
 */
import { z } from 'zod';

export interface FieldMeta {
  label: { ja: string; en: string };
  min?: number;
  max?: number;
  step?: number;
  /** 文字列の入力方法（色・画像の選択） */
  kind?: 'color' | 'image';
  /** 未指定のときに使われる値（フォームで表示し、項目を足すときの初期値にする） */
  default?: unknown;
}

declare module 'zod' {
  interface GlobalMeta extends Partial<FieldMeta> {}
}

const label = (ja: string, en: string) => ({ label: { ja, en } });
const num = (ja: string, en: string, min: number, max: number, step: number, def?: number) =>
  z.number().meta({ ...label(ja, en), min, max, step, default: def });
const color = (ja: string, en: string) => z.string().regex(/^#[0-9a-fA-F]{6}$/).meta({ ...label(ja, en), kind: 'color' });
const bool = (ja: string, en: string) => z.boolean().meta(label(ja, en));
const group = <T extends z.core.$ZodLooseShape>(ja: string, en: string, shape: T) => z.strictObject(shape).meta(label(ja, en));
const vec3 = (ja: string, en: string, min: number, max: number, step: number) =>
  group(ja, en, { x: num('X', 'X', min, max, step), y: num('Y', 'Y', min, max, step), z: num('Z', 'Z', min, max, step) });

export const TIME_OF_DAY_IDS = ['morning', 'day', 'evening', 'night', 'divine'] as const;
export const TimeOfDayId = z.enum(TIME_OF_DAY_IDS);
export type TimeOfDayId = z.infer<typeof TimeOfDayId>;

export const SunShaftsConfig = group('光条', 'Sun shafts', {
  enabled: bool('有効', 'Enabled'),
  followDirectionalLight: bool('太陽を平行光の向きに置く', 'Follow directional light'),
  sunPosition: vec3('太陽の位置', 'Sun position', -20, 25, 0.1),
  exposure: num('露出', 'Exposure', 0, 1.5, 0.02),
  decay: num('減衰', 'Decay', 0.8, 0.99, 0.005),
  density: num('密度', 'Density', 0.2, 1.8, 0.05),
  weight: num('重み', 'Weight', 0.05, 1, 0.02),
  color: color('色', 'Color'),
  shimmer: num('揺らぎ', 'Shimmer', 0, 1, 0.05),
});

export const LensFlareConfig = group('レンズフレア', 'Lens flare', {
  enabled: bool('有効', 'Enabled'),
  sunSize: num('太陽の大きさ', 'Sun size', 0.2, 3, 0.05),
  sunColor: color('太陽の色', 'Sun color'),
  glowIntensity: num('グロー', 'Glow', 0, 2, 0.05),
  starburstIntensity: num('光芒', 'Starburst', 0, 2, 0.05),
  anamorphicIntensity: num('横長フレア', 'Anamorphic', 0, 2, 0.05),
  ghostIntensity: num('ゴースト', 'Ghosts', 0, 2, 0.05),
  haloIntensity: num('ハロ', 'Halo', 0, 2, 0.05),
});

export const LightingConfig = group('ライト', 'Lighting', {
  directional: group('平行光（主光源）', 'Directional light', {
    color: color('色', 'Color'),
    intensity: num('強さ', 'Intensity', 0, 8, 0.1),
    position: vec3('向き', 'Direction', -10, 10, 0.1),
  }),
  ambient: group('環境光', 'Ambient light', {
    color: color('色', 'Color'),
    intensity: num('強さ', 'Intensity', 0, 3, 0.05),
  }),
  rim: group('リムライト', 'Rim light', {
    enabled: bool('有効', 'Enabled'),
    color: color('色', 'Color'),
    intensity: num('強さ', 'Intensity', 0, 3, 0.05),
    position: vec3('向き', 'Direction', -10, 10, 0.1),
  }).optional(),
  hairRingTint: color('天使の輪の色', 'Hair highlight tint').optional(),
  sunShafts: SunShaftsConfig.optional(),
  lensFlare: LensFlareConfig.optional(),
});

export const PostProcessingConfig = group('ポストプロセス', 'Post-processing', {
  bloom: group('ブルーム', 'Bloom', {
    enabled: bool('有効', 'Enabled'),
    strength: num('強さ', 'Strength', 0, 0.8, 0.01),
    radius: num('広がり', 'Radius', 0, 1, 0.02),
    threshold: num('しきい値', 'Threshold', 0.1, 1, 0.01),
  }),
  cinematic: group('画作り', 'Cinematic', {
    diffusion: group('ディフュージョン', 'Diffusion', {
      enabled: bool('有効', 'Enabled'),
      strength: num('強さ', 'Strength', 0, 1, 0.02),
      radius: num('広がり', 'Radius', 0.1, 5, 0.1),
    }),
    colorGrading: group('カラーグレーディング', 'Color grading', {
      enabled: bool('有効', 'Enabled'),
      shadowTint: color('影の色味', 'Shadow tint'),
      highlightTint: color('明部の色味', 'Highlight tint'),
      strength: num('強さ', 'Strength', 0, 1, 0.02),
      contrast: num('コントラスト', 'Contrast', 0, 0.5, 0.01),
      gamma: num('ガンマ', 'Gamma', 0.7, 1.4, 0.02),
    }),
    adjustments: group('色調補正', 'Adjustments', {
      saturation: num('彩度', 'Saturation', -1, 1, 0.02),
      brightness: num('明るさ', 'Brightness', -0.5, 0.5, 0.01),
      contrast: num('コントラスト', 'Contrast', -0.5, 0.5, 0.01),
    }),
    vignette: group('周辺減光', 'Vignette', {
      enabled: bool('有効', 'Enabled'),
      offset: num('範囲', 'Offset', 0.2, 2, 0.05),
      darkness: num('暗さ', 'Darkness', 0, 1, 0.02),
      color: color('色', 'Color'),
    }),
    chromaticAberration: group('色収差', 'Chromatic aberration', {
      enabled: bool('有効', 'Enabled'),
      offset: num('ずれ', 'Offset', 0, 0.008, 0.0002),
    }),
    sharpen: group('シャープ', 'Sharpen', {
      enabled: bool('有効', 'Enabled'),
      amount: num('強さ', 'Amount', 0, 1, 0.02),
    }),
  }),
  para: group('パラ（空気感）', 'Atmosphere gradient', {
    enabled: bool('有効', 'Enabled').optional(),
    topOpacity: num('上端の濃さ', 'Top opacity', 0, 1, 0.01, 0.3).optional(),
    bottomOpacity: num('下端の濃さ', 'Bottom opacity', 0, 1, 0.01, 0.05).optional(),
    desaturate: num('彩度を落とす量', 'Desaturate', 0, 1, 0.01, 0.2).optional(),
    tintAmount: num('色合わせ', 'Tint amount', 0, 1, 0.01, 1).optional(),
  }).optional(),
});

export const FogConfig = group('フォグ', 'Fog', {
  enabled: bool('有効', 'Enabled'),
  color: color('色', 'Color'),
  density: num('濃さ', 'Density', 0, 0.2, 0.001),
});

export const MaterialStyleParams = z.strictObject({
  color: color('基本色', 'Base color'),
  shadeMultiply: color('影の乗算色', 'Shade multiply'),
  shadingToonyFactor: num('影の硬さ', 'Toony factor', 0, 1, 0.001),
  shadingShiftFactor: num('影のずれ', 'Shading shift', -1, 1, 0.01),
  giEqualizationFactor: num('環境光のならし', 'GI equalization', 0, 1, 0.01),
  matcapEnabled: bool('マットキャップ', 'Matcap'),
  emissiveIntensity: num('発光', 'Emissive', 0, 5, 0.1),
  rimEnabled: bool('リム', 'Rim'),
  rimColor: color('リムの色', 'Rim color'),
  parametricRimFresnelPowerFactor: num('リムの鋭さ', 'Rim fresnel power', 0, 10, 0.1),
  parametricRimLiftFactor: num('リムの持ち上げ', 'Rim lift', 0, 5, 0.01),
  rimLightingMixFactor: num('リムの光の混ぜ具合', 'Rim lighting mix', 0, 2, 0.01),
  outlineWidthFactor: num('輪郭の太さ', 'Outline width', 0, 0.01, 0.0002),
});

export const OutlineConfig = group('輪郭線', 'Outline', {
  enabled: bool('有効', 'Enabled'),
  useSmoothNormal: bool('なめらかな法線', 'Smooth normals'),
  screenSpaceWidth: bool('画面上で一定の太さ', 'Screen-space width'),
  autoLineWeight: bool('線の強弱', 'Auto line weight'),
  darknessFactor: num('暗さ', 'Darkness', 0.01, 0.5, 0.01),
  widthFactor: num('太さ', 'Width', 0, 0.01, 0.0002),
  lightingMixFactor: num('光の混ぜ具合', 'Lighting mix', 0, 1, 0.01),
});

export const TimeOfDayPreset = z.strictObject({
  id: TimeOfDayId,
  name: z.string().meta(label('名前', 'Name')),
  /** 狙いの説明 */
  description: z.string().meta(label('説明', 'Description')).optional(),
  lighting: LightingConfig,
  postProcessing: PostProcessingConfig,
  fog: FogConfig,
  materials: group('マテリアル', 'Materials', {
    body: MaterialStyleParams.meta(label('肌', 'Skin')),
    hair: MaterialStyleParams.meta(label('髪', 'Hair')),
    cloth: MaterialStyleParams.meta(label('服', 'Clothes')),
  }).optional(),
  outline: OutlineConfig.optional(),
});
export type TimeOfDayPreset = z.infer<typeof TimeOfDayPreset>;

const layerPosition = (ja: string, en: string) => vec3(ja, en, -5, 5, 0.05);

export const LocationVisualPreset = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().meta(label('名前', 'Name')),
  isIndoor: bool('屋内', 'Indoor').optional(),
  layers: group('背景', 'Backdrop', {
    background: group('遠景', 'Background', {
      url: z.string().meta({ ...label('画像', 'Image'), kind: 'image' }).optional(),
      color: color('単色', 'Solid color').optional(),
    }),
    midground: group('中景（キャラの奥）', 'Midground (behind characters)', {
      url: z.string().meta({ ...label('画像', 'Image'), kind: 'image' }).optional(),
      position: layerPosition('位置', 'Position'),
      scale: num('大きさ', 'Scale', 0.5, 10, 0.1),
      opacity: num('不透明度', 'Opacity', 0, 1, 0.05),
    }).optional(),
    nearground: group('近景（キャラの手前）', 'Nearground (in front)', {
      url: z.string().meta({ ...label('画像', 'Image'), kind: 'image' }).optional(),
      position: layerPosition('位置', 'Position'),
      scale: num('大きさ', 'Scale', 0.5, 5, 0.05),
      opacity: num('不透明度', 'Opacity', 0, 1, 0.05),
    }).optional(),
  }),
});
export type LocationVisualPreset = z.infer<typeof LocationVisualPreset>;

/** ファイル全体（{ description, presets: { <id>: 設定 } }）。キーと id が同じであること */
function presetFile<T extends z.ZodType<{ id: string }>>(preset: T) {
  return z
    .strictObject({ description: z.string().optional(), presets: z.record(z.string(), preset) })
    .superRefine((file, ctx) => {
      for (const [key, value] of Object.entries(file.presets)) {
        if (value.id !== key) ctx.addIssue({ code: 'custom', path: ['presets', key, 'id'], message: `id はキー（${key}）と同じにしてください` });
      }
    });
}

export const TimeOfDayFile = presetFile(TimeOfDayPreset);
export const LocationFile = presetFile(LocationVisualPreset);

export type SunShaftsConfig = z.infer<typeof SunShaftsConfig>;
export type LensFlareConfig = z.infer<typeof LensFlareConfig>;
export type LightingConfig = z.infer<typeof LightingConfig>;
export type PostProcessingConfig = z.infer<typeof PostProcessingConfig>;
export type FogConfig = z.infer<typeof FogConfig>;
export type MaterialStyleParams = z.infer<typeof MaterialStyleParams>;
export type OutlineConfig = z.infer<typeof OutlineConfig>;
