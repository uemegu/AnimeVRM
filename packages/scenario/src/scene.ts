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
  kind?: 'color' | 'image' | 'environment';
  /** 未指定のときに使われる値（フォームで表示し、項目を足すときの初期値にする） */
  default?: unknown;
  /** 選択肢の表示名 */
  options?: Record<string, { ja: string; en: string }>;
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

/** 時間帯（光の設定）。indoor_dark は暗い店内など、外の明るさとの対比を見せる室内 */
export const TIME_OF_DAY_IDS = ['morning', 'day', 'evening', 'night', 'indoor_dark', 'divine'] as const;
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
    /** フィルムの粒子。アニメ映画のフィルム撮影っぽさを足す */
    filmGrain: group('フィルムグレイン', 'Film grain', {
      enabled: bool('有効', 'Enabled'),
      strength: num('強さ', 'Strength', 0, 0.2, 0.005),
      size: num('粒の大きさ（px）', 'Grain size (px)', 1, 4, 0.1, 1.5).optional(),
    }).optional(),
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
  /** 暗い色の光が当たる側を明るくする量（影の側はテクスチャの色のまま）。濃紺の服などで明暗が見えるようにする */
  darkLitLift: num('暗い色の明るい側の持ち上げ', 'Dark color lit lift', 0, 4, 0.1, 0).optional(),
  /** 白に近い色の光が当たる側に掛ける倍率（1 でそのまま）。白いシャツが光って見えないように抑える */
  brightLitScale: num('白に近い色の明るい側の倍率', 'Bright color lit scale', 0.5, 1, 0.01, 1).optional(),
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

/** カメラ構図ごとの置き方（高さは登場キャラの頭の高さからの差。side の distance は横の距離） */
export interface ShotRig {
  distance: number;
  height: number;
  targetHeight: number;
}

/** 構図の既定値（場所で指定がなければこれを使う） */
export const DEFAULT_SHOT_RIGS: Record<'wide' | 'medium' | 'speaker' | 'close' | 'side', ShotRig> = {
  wide: { distance: 2.3, height: -0.22, targetHeight: -0.37 },
  medium: { distance: 2.2, height: -0.2, targetHeight: -0.3 },
  speaker: { distance: 1.6, height: -0.17, targetHeight: -0.27 },
  close: { distance: 1.2, height: -0.09, targetHeight: -0.14 },
  // 歩きながらの会話（カメラを話者の左横・少し手前に置き、話者が画面の左から3割ほどに横向きで映る）
  side: { distance: 1.3, height: -0.17, targetHeight: -0.12 },
};
export const DEFAULT_CAMERA_FOV = 32;
export const DEFAULT_SLOT_POSITIONS: Record<'left' | 'center' | 'right', [number, number, number]> = {
  left: [-0.45, 0, 0],
  center: [0, 0, 0],
  right: [0.45, 0, 0],
};
export const DEFAULT_DEPTH_OF_FIELD = { aperture: 0.03, maxBlur: 0.012, sharpRange: 0 } as const;
/** 遠景の既定は3D空間に置く（旧ルートと同じく、カメラの動きで背景の見え方も変わる） */
export const DEFAULT_BACKDROP: { mode: 'screen' | 'world'; distance: number; height: number; offsetY: number } = { mode: 'world', distance: 8, height: 7.5, offsetY: 1.0 };

const shotRig = (ja: string, en: string, def: ShotRig) =>
  group(ja, en, {
    distance: num('距離', 'Distance', 0.6, 6, 0.05, def.distance),
    height: num('カメラの高さ（頭から）', 'Height (from head)', -1.2, 1, 0.01, def.height),
    targetHeight: num('注視点の高さ（頭から）', 'Look-at height (from head)', -1.2, 1, 0.01, def.targetHeight),
  });

const slot = (ja: string, en: string, def: [number, number, number]) =>
  z
    .tuple([z.number(), z.number(), z.number()])
    .meta({ ...label(ja, en), min: -3, max: 3, step: 0.01, default: def });

export const LocationStage = group('配置とカメラ', 'Staging & camera', {
  slots: group('立ち位置', 'Standing slots', {
    left: slot('左', 'Left', DEFAULT_SLOT_POSITIONS.left).optional(),
    center: slot('中央', 'Center', DEFAULT_SLOT_POSITIONS.center).optional(),
    right: slot('右', 'Right', DEFAULT_SLOT_POSITIONS.right).optional(),
  }).optional(),
  camera: group('カメラ', 'Camera', {
    fov: num('画角', 'Field of view', 15, 60, 1, DEFAULT_CAMERA_FOV).optional(),
    wide: shotRig('引き', 'Wide', DEFAULT_SHOT_RIGS.wide).optional(),
    medium: shotRig('会話', 'Two-shot', DEFAULT_SHOT_RIGS.medium).optional(),
    speaker: shotRig('話者', 'Speaker', DEFAULT_SHOT_RIGS.speaker).optional(),
    close: shotRig('アップ', 'Close', DEFAULT_SHOT_RIGS.close).optional(),
    side: shotRig('横から', 'From the side', DEFAULT_SHOT_RIGS.side).optional(),
    /** 注視点（話者の顔あたり）にピントを合わせ、離れた物を距離に応じてぼかす。なければぼかさない */
    depthOfField: group('背景ぼかし', 'Depth of field', {
      aperture: num('ぼけの強さ（レンズの口径 m）', 'Aperture (m)', 0, 0.2, 0.005, DEFAULT_DEPTH_OF_FIELD.aperture),
      maxBlur: num('ぼけの上限（画面の高さに対する割合）', 'Max blur (of screen height)', 0, 0.05, 0.001, DEFAULT_DEPTH_OF_FIELD.maxBlur),
      /** ピントより奥でもぼかさない幅。キャラのすぐ後ろの物（門など）はくっきり見せ、遠景だけぼかす */
      sharpRange: num('ピントの奥でぼかさない幅（m）', 'Sharp range behind focus (m)', 0, 20, 0.1, DEFAULT_DEPTH_OF_FIELD.sharpRange).optional(),
    }).optional(),
    /** 明るい所の光のにじみ。夜祭りの灯りのように場所の絵で決まるものは、時間帯の設定より優先する */
    bloom: group('光のにじみ（ブルーム）', 'Bloom', {
      strength: num('強さ', 'Strength', 0, 0.8, 0.01),
      radius: num('広がり', 'Radius', 0, 1, 0.02),
      threshold: num('しきい値', 'Threshold', 0.1, 1, 0.01),
    }).optional(),
  }).optional(),
  backdrop: group('遠景の置き方', 'Backdrop placement', {
    mode: z.enum(['screen', 'world']).meta({
      ...label('方式', 'Mode'),
      options: {
        screen: { ja: '画面に貼る（カメラが動いても同じ見え方）', en: 'Screen (same view for every shot)' },
        world: { ja: '3D空間に置く（寄ると背景も拡大）', en: 'In the world (zooms with the camera)' },
      },
    }),
    distance: num('奥行き', 'Distance', 2, 30, 0.1, DEFAULT_BACKDROP.distance),
    height: num('高さ（大きさ）', 'Height (size)', 1, 30, 0.1, DEFAULT_BACKDROP.height),
    offsetY: num('上下の位置', 'Vertical offset', -5, 10, 0.05, DEFAULT_BACKDROP.offsetY),
  }).optional(),
});
export type LocationStage = z.infer<typeof LocationStage>;

/** 組み込みの3D背景（コードで組み立てるセット） */
export const BUILTIN_ENVIRONMENTS = {
  'builtin:painted-classroom': { ja: '簡易3D 教室', en: 'Painted classroom' },
  'builtin:painted-library': { ja: '簡易3D 図書室', en: 'Painted library' },
  'builtin:painted-gate': { ja: '簡易3D 校門', en: 'Painted school gate' },
  'builtin:painted-seaside': { ja: '簡易3D 海の見える公園', en: 'Painted seaside park' },
  'builtin:painted-festival': { ja: '簡易3D 夏祭り', en: 'Painted summer festival' },
} as const;

export const LocationEnvironment = group('3D背景', '3D set', {
  /** builtin:<名前>、または glb の URL（assets/ 基準） */
  model: z.string().min(1).meta({ ...label('モデル', 'Model'), kind: 'environment' }),
  position: vec3('位置', 'Position', -20, 20, 0.05),
  rotationY: num('向き（度）', 'Rotation (deg)', -180, 180, 1, 0),
  scale: num('大きさ', 'Scale', 0.1, 10, 0.05, 1),
});
export type LocationEnvironment = z.infer<typeof LocationEnvironment>;

/**
 * 3D背景の絵に描き込んである光。絵の光は時間帯で変わらないので、キャラを照らす光の向きを
 * 時間帯の設定より優先してこれに合わせ、キャラの影を地面に落とす（光の色は、指定がなければ時間帯のまま）
 */
export const LocationLight = group('絵の光', 'Painted light', {
  direction: vec3('光の来る向き', 'Direction to the light', -5, 5, 0.05),
  /** 光の色と強さ。夜祭りのように光まで絵と決まっている場所だけ指定し、省略時は時間帯のまま */
  color: color('色', 'Color').optional(),
  intensity: num('強さ', 'Intensity', 0, 8, 0.1, 1).optional(),
  ambient: group('環境光', 'Ambient light', {
    color: color('色', 'Color'),
    intensity: num('強さ', 'Intensity', 0, 3, 0.05),
  }).optional(),
  shadow: group('地面に落とすキャラの影', 'Character shadow on the ground', {
    color: color('色', 'Color'),
    opacity: num('濃さ', 'Opacity', 0, 1, 0.05, 0.4),
    softness: num('ぼかし', 'Softness', 0, 12, 0.5, 4),
  }).optional(),
});
export type LocationLight = z.infer<typeof LocationLight>;

/**
 * 髪とスカートを揺らす風（揺れものの重力に足す）。揺れものは簡単なバネなので、強いと髪が頭に入ったり
 * 形が崩れたりする。そよ風（強さ 0.1 前後まで）に留めること
 */
export const LocationWind = group('風', 'Wind', {
  direction: vec3('風の吹いていく向き', 'Direction the wind blows to', -1, 1, 0.05),
  strength: num('強さ', 'Strength', 0, 0.3, 0.01, 0.06),
  gust: num('強弱の揺らぎ', 'Gustiness', 0, 1, 0.05, 0.6).optional(),
});
export type LocationWind = z.infer<typeof LocationWind>;

export const LocationVisualPreset = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().meta(label('名前', 'Name')),
  isIndoor: bool('屋内', 'Indoor').optional(),
  /** 一覧に出すサムネイル。なければ遠景の画像を使う（3D背景の場所は遠景が空だけなので、撮影した画像を置く） */
  thumbnail: z.string().meta({ ...label('サムネイル', 'Thumbnail'), kind: 'image' }).optional(),
  layers: group('背景', 'Backdrop', {
    background: group('遠景', 'Background', {
      url: z.string().meta({ ...label('画像', 'Image'), kind: 'image' }).optional(),
      color: color('単色', 'Solid color').optional(),
      /** 暗い室内から見た明るい屋外のように、遠景だけ明るくする */
      exposure: num('明るさ', 'Exposure', 0.2, 3, 0.05, 1).optional(),
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
  environment: LocationEnvironment.optional(),
  light: LocationLight.optional(),
  wind: LocationWind.optional(),
  stage: LocationStage.optional(),
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
