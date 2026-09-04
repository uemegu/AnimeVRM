import { resolveAssetUrl } from '../utils/path';
import type { AvatarConfig } from '../Config';

export type TimeOfDayId = 'morning' | 'day' | 'evening' | 'rainy' | 'bright_indoor' | 'dark_indoor';
export type LocationId = 'modern_park' | 'school_gate' | 'classroom' | 'old_park' | 'none';

export type ScenePresetId =
  | 'morning_park'
  | 'day_park'
  | 'evening_park'
  | 'rainy_park'
  | 'morning_school'
  | 'day_school'
  | 'evening_school'
  | 'rainy_school'
  | 'bright_indoor'
  | 'dark_indoor'
  | 'morning_outdoor'
  | 'day_outdoor'
  | 'evening_outdoor'
  | 'rainy_outdoor';

export interface TimeOfDayPresetData {
  id: TimeOfDayId;
  name: string;
  description: string;
  lighting: AvatarConfig['lighting'];
  postProcessing: AvatarConfig['postProcessing'];
  materials: AvatarConfig['materials'];
  outline: AvatarConfig['outline'];
  wind: AvatarConfig['wind'];
  rain: AvatarConfig['rain'];
  environment?: Partial<AvatarConfig['environment']>;
  eyeGlow?: AvatarConfig['eyeGlow'];
}

export interface LocationPresetData {
  id: LocationId;
  name: string;
  category: 'outdoor' | 'indoor';
  environment: AvatarConfig['environment'];
}

export interface ScenePresetData {
  id: ScenePresetId;
  name: string;
  category: 'outdoor' | 'indoor';
  description: string;
  environment: AvatarConfig['environment'];
  lighting: AvatarConfig['lighting'];
  postProcessing: AvatarConfig['postProcessing'];
  materials: AvatarConfig['materials'];
  outline: AvatarConfig['outline'];
  wind: AvatarConfig['wind'];
  rain: AvatarConfig['rain'];
  eyeGlow?: AvatarConfig['eyeGlow'];
}

const DEFAULT_CINEMATIC_CONFIG: AvatarConfig['postProcessing']['cinematic'] = {
  diffusion: {
    enabled: true,
    strength: 0.24,
    radius: 2.0,
  },
  filmGrain: {
    enabled: false,
    strength: 0.035,
    speed: 1.0,
  },
  vignette: {
    enabled: true,
    offset: 1.15,
    darkness: 0.08,
    color: '#1a1829',
  },
  chromaticAberration: {
    enabled: true,
    offset: 0.0015,
  },
  sharpening: {
    enabled: false,
    amount: 0.22,
  },
};

// ====================================================
// 1. 時間帯パラメータ定義 (Time of Day Parameters)
// ====================================================
export const TIME_OF_DAY_PRESETS: Record<TimeOfDayId, TimeOfDayPresetData> = {
  // 1. 朝 (Morning) - ユーザー指定の新パラメータ
  morning: {
    id: 'morning',
    name: '朝',
    description: '澄んだ朝陽と淡い光条、透明感あふれるブルー・バイオレットのグラデーション',
    materials: {
      body: {
        color: '#fff6f0',
        shadowHueShift: 0.02,
        shadowLightnessFactor: 0.16,
        shadowBoundaryTint: 0.35,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 0,
        rimEnabled: false,
        rimColor: '#ffffff',
        parametricRimFresnelPowerFactor: 5,
        parametricRimLiftFactor: 0.1,
        rimLightingMixFactor: 0.1,
        outlineWidthFactor: 0.001,
      },
      hair: {
        color: '#ffffff',
        shadowHueShift: 0.03,
        shadowLightnessFactor: 0.2,
        shadowBoundaryTint: 0.2,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 1.5,
        rimEnabled: false,
        rimColor: '#ffffff',
        parametricRimFresnelPowerFactor: 0,
        parametricRimLiftFactor: 0.1,
        rimLightingMixFactor: 0.2,
        outlineWidthFactor: 0.0008,
      },
      cloth: {
        color: '#ffffff',
        shadowHueShift: 0.03,
        shadowLightnessFactor: 0.2,
        shadowBoundaryTint: 0.1,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 0,
        rimEnabled: false,
        rimColor: '#202942',
        parametricRimFresnelPowerFactor: 4,
        parametricRimLiftFactor: 0.02,
        rimLightingMixFactor: 1,
        outlineWidthFactor: 0.001,
      },
    },
    outline: {
      enabled: true,
      useSmoothNormal: true,
      screenSpaceWidth: true,
      autoLineWeight: true,
      darknessFactor: 0.1,
      widthFactor: 0.001,
      lightingMixFactor: 0,
    },
    lighting: {
      castShadows: false,
      ambient: {
        color: '#f6ccff',
        intensity: 0.35,
      },
      directional: {
        color: '#ffffff',
        intensity: 2.6,
        posX: 4.1,
        posY: 0.1,
        posZ: 2,
      },
      rim: {
        enabled: false,
        color: '#dde8ff',
        intensity: 0.05,
        posX: 0,
        posY: 1.5,
        posZ: 2.5,
      },
      depthRim: {
        enabled: true,
        power: 4,
        threshold: 0.15,
        intensity: 0.8,
      },
      sunShafts: {
        enabled: true,
        followDirectionalLight: false,
        sunPosition: {
          x: 3.2,
          y: 4.3,
          z: -3.8,
        },
        exposure: 0.24,
        decay: 0.82,
        density: 0.35,
        weight: 0.14,
        color: '#dcdbff',
        shimmer: 0.4,
      },
      lensFlare: {
        enabled: true,
        sunSize: 1.25,
        sunColor: '#fff8ee',
        glowIntensity: 1.15,
        starburstIntensity: 0.05,
        anamorphicIntensity: 1.1,
        ghostIntensity: 0.3,
        haloIntensity: 0.5,
      },
    },
    postProcessing: {
      toneMappingMode: 'None',
      toneMappingExposure: 1,
      antialiasing: {
        msaaSamples: 4,
        smaa: true,
      },
      bloom: {
        enabled: true,
        strength: 0.09,
        radius: 0.06,
        threshold: 0.9,
      },
      colorGrading: {
        enabled: true,
        shadowTint: '#3d61ff',
        highlightTint: '#99c0ff',
        strength: 0.28,
        contrast: 0.31,
        gamma: 0.84,
      },
      saturation: 0.26,
      brightness: 0,
      contrast: 0,
      cinematic: { ...DEFAULT_CINEMATIC_CONFIG },
    },
    wind: {
      enabled: false,
      speed: 0.1,
      direction: 45,
      elevation: 5,
      turbulence: 0.15,
      gustFrequency: 0.2,
      gustStrength: 0.15,
      particles: {
        enabled: false,
        count: 160,
        size: 0.035,
        color: '#ffd5e5',
        opacity: 0.85,
        speedFactor: 1,
      },
    },
    rain: {
      enabled: false,
      count: 600,
      speed: 9.5,
      length: 0.14,
      angle: 2,
      color: '#cce2ff',
      opacity: 0.45,
      splashEnabled: false,
      splashCount: 110,
    },
  },

  // 2. 昼 (Day) - 以前の朝パラメータ（明るく抜けの良い日中光）
  day: {
    id: 'day',
    name: '昼',
    description: '青空と強い太陽光、抜けの良い昼光サンシャフトと華やかなアニメフレア',
    materials: {
      body: {
        color: '#fff6f0',
        shadowHueShift: 0.02,
        shadowLightnessFactor: 0.16,
        shadowBoundaryTint: 0.35,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 0.0,
        rimEnabled: false,
        rimColor: '#ffffff',
        parametricRimFresnelPowerFactor: 5,
        parametricRimLiftFactor: 0.1,
        rimLightingMixFactor: 0.1,
        outlineWidthFactor: 0.001,
      },
      hair: {
        color: '#ffffff',
        shadowHueShift: 0.03,
        shadowLightnessFactor: 0.2,
        shadowBoundaryTint: 0.2,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 1.5,
        rimEnabled: false,
        rimColor: '#ffffff',
        parametricRimFresnelPowerFactor: 0,
        parametricRimLiftFactor: 0.1,
        rimLightingMixFactor: 0.2,
        outlineWidthFactor: 0.0008,
      },
      cloth: {
        color: '#ffffff',
        shadowHueShift: 0.03,
        shadowLightnessFactor: 0.2,
        shadowBoundaryTint: 0.1,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 0.0,
        rimEnabled: false,
        rimColor: '#202942',
        parametricRimFresnelPowerFactor: 4,
        parametricRimLiftFactor: 0.02,
        rimLightingMixFactor: 1,
        outlineWidthFactor: 0.001,
      },
    },
    eyeGlow: {
      enabled: true,
      intensity: 1.25,
    },
    outline: {
      enabled: true,
      useSmoothNormal: true,
      screenSpaceWidth: true,
      autoLineWeight: true,
      darknessFactor: 0.08,
      widthFactor: 0.001,
      lightingMixFactor: 0,
    },
    lighting: {
      castShadows: false,
      ambient: {
        color: '#ffb8b8',
        intensity: 0.5,
      },
      directional: {
        color: '#ffffff',
        intensity: 2.6,
        posX: -0.7,
        posY: 0.5,
        posZ: 0.4,
      },
      rim: {
        enabled: false,
        color: '#dde8ff',
        intensity: 0.05,
        posX: 0,
        posY: 1.5,
        posZ: 2.5,
      },
      depthRim: {
        enabled: true,
        power: 4.0,
        threshold: 0.15,
        intensity: 0.8,
      },
      sunShafts: {
        enabled: true,
        followDirectionalLight: false,
        sunPosition: {
          x: 3.2,
          y: 4.3,
          z: -3.8,
        },
        exposure: 0.38,
        decay: 0.87,
        density: 0.4,
        weight: 0.08,
        color: '#fff2db',
        shimmer: 0.25,
      },
      lensFlare: {
        enabled: true,
        sunSize: 1.25,
        sunColor: '#fff8ee',
        glowIntensity: 1.25,
        starburstIntensity: 0.05,
        anamorphicIntensity: 1.2,
        ghostIntensity: 0.85,
        haloIntensity: 0.9,
      },
    },
    environment: {
      farFogIntensity: 0.12,
    },
    postProcessing: {
      toneMappingMode: 'None',
      toneMappingExposure: 1.0,
      antialiasing: {
        msaaSamples: 4,
        smaa: true,
      },
      bloom: {
        enabled: true,
        strength: 0.08,
        radius: 0.06,
        threshold: 0.9,
      },
      colorGrading: {
        enabled: true,
        shadowTint: '#2038a2',
        highlightTint: '#949494',
        strength: 0.5,
        contrast: 0.13,
        gamma: 1.0,
      },
      saturation: 0.26,
      brightness: 0.0,
      contrast: 0,
      cinematic: { ...DEFAULT_CINEMATIC_CONFIG },
    },
    wind: {
      enabled: false,
      speed: 0.1,
      direction: 45,
      elevation: 5,
      turbulence: 0.15,
      gustFrequency: 0.2,
      gustStrength: 0.15,
      particles: {
        enabled: false,
        count: 160,
        size: 0.035,
        color: '#ffd5e5',
        opacity: 0.85,
        speedFactor: 1,
      },
    },
    rain: {
      enabled: false,
      count: 600,
      speed: 9.5,
      length: 0.14,
      angle: 2,
      color: '#cce2ff',
      opacity: 0.45,
      splashEnabled: false,
      splashCount: 110,
    },
  },

  // 3. 夕方 (Evening) - 元の夕方パラメータ
  evening: {
    id: 'evening',
    name: '夕方',
    description: 'ドラマチックな茜色の夕日、西日のサンシャフトと夕焼けレンズフレア',
    materials: {
      body: {
        color: '#fff6f0',
        shadowHueShift: 0.02,
        shadowLightnessFactor: 0.16,
        shadowBoundaryTint: 0.45,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 0.0,
        rimEnabled: true,
        rimColor: '#ffffff',
        parametricRimFresnelPowerFactor: 5,
        parametricRimLiftFactor: 0.1,
        rimLightingMixFactor: 0.1,
        outlineWidthFactor: 0.001,
      },
      hair: {
        color: '#ffffff',
        shadowHueShift: 0.03,
        shadowLightnessFactor: 0.2,
        shadowBoundaryTint: 0.3,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 1.5,
        rimEnabled: false,
        rimColor: '#ffffff',
        parametricRimFresnelPowerFactor: 0,
        parametricRimLiftFactor: 0.1,
        rimLightingMixFactor: 0.2,
        outlineWidthFactor: 0.0008,
      },
      cloth: {
        color: '#ffffff',
        shadowHueShift: 0.03,
        shadowLightnessFactor: 0.2,
        shadowBoundaryTint: 0.15,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 0.0,
        rimEnabled: false,
        rimColor: '#202942',
        parametricRimFresnelPowerFactor: 4,
        parametricRimLiftFactor: 0.02,
        rimLightingMixFactor: 1,
        outlineWidthFactor: 0.001,
      },
    },
    outline: {
      enabled: true,
      useSmoothNormal: true,
      screenSpaceWidth: true,
      autoLineWeight: true,
      darknessFactor: 0.1,
      widthFactor: 0.001,
      lightingMixFactor: 0,
    },
    lighting: {
      castShadows: false,
      ambient: {
        color: '#3e407a',
        intensity: 0.5,
      },
      directional: {
        color: '#fffbf0',
        intensity: 1.8,
        posX: -3.7,
        posY: 0.8,
        posZ: 1.3,
      },
      rim: {
        enabled: true,
        color: '#ffaa60',
        intensity: 0.3,
        posX: 0,
        posY: 1.5,
        posZ: 2.5,
      },
      depthRim: {
        enabled: true,
        power: 3.5,
        threshold: 0.12,
        intensity: 1.0,
      },
      sunShafts: {
        enabled: true,
        followDirectionalLight: false,
        sunPosition: {
          x: -5.5,
          y: 1.6,
          z: -3.5,
        },
        exposure: 0.56,
        decay: 0.885,
        density: 0.25,
        weight: 0.2,
        color: '#ff7826',
        shimmer: 0.3,
      },
      lensFlare: {
        enabled: true,
        sunSize: 1.05,
        sunColor: '#ff6222',
        glowIntensity: 1.15,
        starburstIntensity: 1.05,
        anamorphicIntensity: 0.95,
        ghostIntensity: 0.95,
        haloIntensity: 0.3,
      },
    },
    environment: {
      farFogEnabled: true,
      farFogColor: '#ffe5e5',
      farFogIntensity: 0.28,
    },
    postProcessing: {
      toneMappingMode: 'None',
      toneMappingExposure: 1.0,
      antialiasing: {
        msaaSamples: 4,
        smaa: true,
      },
      bloom: {
        enabled: true,
        strength: 0.09,
        radius: 0.06,
        threshold: 0.9,
      },
      colorGrading: {
        enabled: true,
        shadowTint: '#391752',
        highlightTint: '#ffad70',
        strength: 0.65,
        contrast: 0.18,
        gamma: 0.95,
      },
      saturation: 0.26,
      brightness: 0.0,
      contrast: 0.02,
      cinematic: {
        diffusion: { enabled: true, strength: 0.35, radius: 2.2 },
        filmGrain: { enabled: false, strength: 0.04, speed: 1.0 },
        vignette: { enabled: true, offset: 1.15, darkness: 0.12, color: '#2a1435' },
        chromaticAberration: { enabled: true, offset: 0.002 },
        sharpening: { enabled: false, amount: 0.24 },
      },
    },
    wind: {
      enabled: false,
      speed: 0.1,
      direction: 45,
      elevation: 5,
      turbulence: 0.15,
      gustFrequency: 0.2,
      gustStrength: 0.15,
      particles: {
        enabled: false,
        count: 160,
        size: 0.035,
        color: '#ffd5e5',
        opacity: 0.85,
        speedFactor: 1,
      },
    },
    rain: {
      enabled: false,
      count: 600,
      speed: 9.5,
      length: 0.14,
      angle: 2,
      color: '#cce2ff',
      opacity: 0.45,
      splashEnabled: false,
      splashCount: 110,
    },
  },

  // 3.5 雨 (Rainy) - 雨天・雨の日の屋外ライティング
  rainy: {
    id: 'rainy',
    name: '雨',
    description: 'しっとりとした雨天・雨雲越しの柔らかな拡散光と雨粒パーティクル',
    materials: {
      body: {
        color: '#fff6f0',
        shadowHueShift: 0,
        shadowLightnessFactor: 0.14,
        shadowBoundaryTint: 0.25,
        shadingToonyFactor: 1,
        shadingShiftFactor: 0.02,
        giEqualizationFactor: 0.88,
        matcapEnabled: true,
        emissiveIntensity: 0,
        rimEnabled: false,
        rimColor: '#ffffff',
        parametricRimFresnelPowerFactor: 5,
        parametricRimLiftFactor: 0.1,
        rimLightingMixFactor: 0.1,
        outlineWidthFactor: 0.001,
      },
      hair: {
        color: '#ffffff',
        shadowHueShift: 0.03,
        shadowLightnessFactor: 0.2,
        shadowBoundaryTint: 0.15,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 0,
        rimEnabled: false,
        rimColor: '#ffffff',
        parametricRimFresnelPowerFactor: 0,
        parametricRimLiftFactor: 0.1,
        rimLightingMixFactor: 0.2,
        outlineWidthFactor: 0.0008,
      },
      cloth: {
        color: '#ffffff',
        shadowHueShift: 0.03,
        shadowLightnessFactor: 0.2,
        shadowBoundaryTint: 0.05,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 0,
        rimEnabled: false,
        rimColor: '#202942',
        parametricRimFresnelPowerFactor: 4,
        parametricRimLiftFactor: 0.02,
        rimLightingMixFactor: 1,
        outlineWidthFactor: 0.001,
      },
    },
    outline: {
      enabled: true,
      useSmoothNormal: true,
      screenSpaceWidth: true,
      autoLineWeight: true,
      darknessFactor: 0.08,
      widthFactor: 0.001,
      lightingMixFactor: 0,
    },
    lighting: {
      castShadows: false,
      ambient: {
        color: '#f5f8ff',
        intensity: 0.65,
      },
      directional: {
        color: '#ffffff',
        intensity: 1.8,
        posX: 0.4,
        posY: 1,
        posZ: 0.7,
      },
      rim: {
        enabled: false,
        color: '#fff0f7',
        intensity: 1,
        posX: 0,
        posY: 1.5,
        posZ: 2.5,
      },
      depthRim: {
        enabled: true,
        power: 4.2,
        threshold: 0.18,
        intensity: 0.6,
      },
      sunShafts: {
        enabled: false,
        followDirectionalLight: false,
        sunPosition: {
          x: 0,
          y: 5,
          z: 0,
        },
        exposure: 0,
        decay: 0.9,
        density: 0.5,
        weight: 0.1,
        color: '#ffffff',
        shimmer: 0,
      },
      lensFlare: {
        enabled: false,
        sunSize: 0.8,
        sunColor: '#ffffff',
        glowIntensity: 0,
        starburstIntensity: 0,
        anamorphicIntensity: 0,
        ghostIntensity: 0,
        haloIntensity: 0,
      },
    },
    postProcessing: {
      toneMappingMode: 'None',
      toneMappingExposure: 1,
      antialiasing: {
        msaaSamples: 4,
        smaa: true,
      },
      bloom: {
        enabled: false,
        strength: 0.05,
        radius: 0.12,
        threshold: 0.9,
      },
      colorGrading: {
        enabled: true,
        shadowTint: '#000000',
        highlightTint: '#635e87',
        strength: 0.5,
        contrast: 0.09,
        gamma: 0.9,
      },
      saturation: 0.2,
      brightness: 0,
      contrast: -0.07,
      cinematic: {
        diffusion: { enabled: true, strength: 0.28, radius: 2.0 },
        filmGrain: { enabled: false, strength: 0.045, speed: 1.2 },
        vignette: { enabled: true, offset: 1.15, darkness: 0.10, color: '#161c28' },
        chromaticAberration: { enabled: true, offset: 0.0018 },
        sharpening: { enabled: true, amount: 0.2 },
      },
    },
    wind: {
      enabled: false,
      speed: 0.1,
      direction: 45,
      elevation: 5,
      turbulence: 0.15,
      gustFrequency: 0.2,
      gustStrength: 0.15,
      particles: {
        enabled: false,
        count: 160,
        size: 0.035,
        color: '#ffd5e5',
        opacity: 0.85,
        speedFactor: 1,
      },
    },
    environment: {
      farFogEnabled: true,
      farFogColor: '#292843',
      farFogIntensity: 0.44,
    },
    rain: {
      enabled: true,
      count: 600,
      speed: 9.5,
      length: 0.14,
      angle: 2,
      color: '#cce2ff',
      opacity: 0.45,
      splashEnabled: false,
      splashCount: 110,
    },
  },

  // 4. 室内・明 (Bright Indoor) - 元のパラメータ
  bright_indoor: {
    id: 'bright_indoor',
    name: '室内・明',
    description: '均一で明るい室内照明、教室やオフィスに最適な自然なセルルック',
    materials: {
      body: {
        color: '#fff6f0',
        shadowHueShift: 0.02,
        shadowLightnessFactor: 0.16,
        shadowBoundaryTint: 0.3,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 0.0,
        rimEnabled: false,
        rimColor: '#ffffff',
        parametricRimFresnelPowerFactor: 5,
        parametricRimLiftFactor: 0.1,
        rimLightingMixFactor: 0.1,
        outlineWidthFactor: 0.001,
      },
      hair: {
        color: '#ffffff',
        shadowHueShift: 0.03,
        shadowLightnessFactor: 0.2,
        shadowBoundaryTint: 0.2,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 0.4,
        rimEnabled: false,
        rimColor: '#ffffff',
        parametricRimFresnelPowerFactor: 0,
        parametricRimLiftFactor: 0.1,
        rimLightingMixFactor: 0.2,
        outlineWidthFactor: 0.0008,
      },
      cloth: {
        color: '#ffffff',
        shadowHueShift: 0.03,
        shadowLightnessFactor: 0.2,
        shadowBoundaryTint: 0.1,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 0.0,
        rimEnabled: false,
        rimColor: '#202942',
        parametricRimFresnelPowerFactor: 4,
        parametricRimLiftFactor: 0.02,
        rimLightingMixFactor: 1,
        outlineWidthFactor: 0.001,
      },
    },
    outline: {
      enabled: true,
      useSmoothNormal: true,
      screenSpaceWidth: true,
      autoLineWeight: true,
      darknessFactor: 0.08,
      widthFactor: 0.001,
      lightingMixFactor: 0,
    },
    environment: {
      showMidground: false,
      farFogEnabled: false,
      farFogIntensity: 0,
    },
    lighting: {
      castShadows: false,
      ambient: {
        color: '#ffebeb',
        intensity: 0.65,
      },
      directional: {
        color: '#ffffff',
        intensity: 2.2,
        posX: -3.5,
        posY: 0,
        posZ: 1.8,
      },
      rim: {
        enabled: false,
        color: '#ffebeb',
        intensity: 0.2,
        posX: 0,
        posY: 1.5,
        posZ: 2.5,
      },
      depthRim: {
        enabled: true,
        power: 4.2,
        threshold: 0.18,
        intensity: 0.6,
      },
      sunShafts: {
        enabled: false,
        followDirectionalLight: false,
        sunPosition: { x: 0, y: 5, z: 0 },
        exposure: 0,
        decay: 0.9,
        density: 0.5,
        weight: 0.1,
        color: '#ffffff',
        shimmer: 0,
      },
      lensFlare: {
        enabled: false,
        sunSize: 0.8,
        sunColor: '#ffffff',
        glowIntensity: 0,
        starburstIntensity: 0,
        anamorphicIntensity: 0,
        ghostIntensity: 0,
        haloIntensity: 0,
      },
    },
    postProcessing: {
      toneMappingMode: 'None',
      toneMappingExposure: 1.0,
      antialiasing: {
        msaaSamples: 4,
        smaa: true,
      },
      bloom: {
        enabled: true,
        strength: 0.05,
        radius: 0.12,
        threshold: 0.9,
      },
      colorGrading: {
        enabled: true,
        shadowTint: '#505068',
        highlightTint: '#ffffff',
        strength: 0.25,
        contrast: 0.08,
        gamma: 1.0,
      },
      saturation: 0.4,
      brightness: 0.0,
      contrast: 0.0,
      cinematic: {
        ...DEFAULT_CINEMATIC_CONFIG,
        diffusion: {
          enabled: true,
          strength: 0.38,
          radius: 2.0,
        },
      },
    },
    wind: {
      enabled: false,
      speed: 0.1,
      direction: 45,
      elevation: 5,
      turbulence: 0.15,
      gustFrequency: 0.2,
      gustStrength: 0.15,
      particles: {
        enabled: false,
        count: 160,
        size: 0.035,
        color: '#ffd5e5',
        opacity: 0.85,
        speedFactor: 1,
      },
    },
    rain: {
      enabled: false,
      count: 600,
      speed: 9.5,
      length: 0.14,
      angle: 2,
      color: '#cce2ff',
      opacity: 0.45,
      splashEnabled: false,
      splashCount: 110,
    },
  },

  // 5. 室内・暗 (Dark Indoor) - 元のパラメータ
  dark_indoor: {
    id: 'dark_indoor',
    name: '室内・暗',
    description: '窓からの夜光と落ち着いた間接照明、エモーショナルな夜間教室・室内',
    materials: {
      body: {
        color: '#fff6f0',
        shadowHueShift: 0.02,
        shadowLightnessFactor: 0.16,
        shadowBoundaryTint: 0.2,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 0.0,
        rimEnabled: false,
        rimColor: '#ffffff',
        parametricRimFresnelPowerFactor: 5,
        parametricRimLiftFactor: 0.1,
        rimLightingMixFactor: 0.1,
        outlineWidthFactor: 0.001,
      },
      hair: {
        color: '#ffffff',
        shadowHueShift: 0.03,
        shadowLightnessFactor: 0.2,
        shadowBoundaryTint: 0.1,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: false,
        emissiveIntensity: 0.0,
        rimEnabled: false,
        rimColor: '#ffffff',
        parametricRimFresnelPowerFactor: 0,
        parametricRimLiftFactor: 0.1,
        rimLightingMixFactor: 0.2,
        outlineWidthFactor: 0.0008,
      },
      cloth: {
        color: '#ffffff',
        shadowHueShift: 0.03,
        shadowLightnessFactor: 0.2,
        shadowBoundaryTint: 0.05,
        shadingToonyFactor: 1,
        shadingShiftFactor: -0.05,
        giEqualizationFactor: 0.9,
        matcapEnabled: true,
        emissiveIntensity: 0.0,
        rimEnabled: false,
        rimColor: '#202942',
        parametricRimFresnelPowerFactor: 4,
        parametricRimLiftFactor: 0.02,
        rimLightingMixFactor: 1,
        outlineWidthFactor: 0.001,
      },
    },
    outline: {
      enabled: true,
      useSmoothNormal: true,
      screenSpaceWidth: true,
      autoLineWeight: true,
      darknessFactor: 0.08,
      widthFactor: 0.001,
      lightingMixFactor: 0,
    },
    lighting: {
      castShadows: false,
      ambient: {
        color: '#ffebeb',
        intensity: 0.3,
      },
      directional: {
        color: '#a0b6d9',
        intensity: 2.5,
        posX: -3.5,
        posY: 0,
        posZ: 2.0,
      },
      rim: {
        enabled: false,
        color: '#8fa8db',
        intensity: 0.22,
        posX: 0,
        posY: 1.5,
        posZ: 2.5,
      },
      depthRim: {
        enabled: true,
        power: 3.8,
        threshold: 0.15,
        intensity: 0.75,
      },
      sunShafts: {
        enabled: false,
        followDirectionalLight: false,
        sunPosition: {
          x: -3.5,
          y: 2.2,
          z: -2.0,
        },
        exposure: 0,
        decay: 0.86,
        density: 0.55,
        weight: 0.18,
        color: '#7898d0',
        shimmer: 0,
      },
      lensFlare: {
        enabled: false,
        sunSize: 0.8,
        sunColor: '#8ca8db',
        glowIntensity: 0,
        starburstIntensity: 0,
        anamorphicIntensity: 0,
        ghostIntensity: 0,
        haloIntensity: 0,
      },
    },
    environment: {
      showMidground: false,
      farFogEnabled: true,
      farFogColor: '#262d5a',
      farFogIntensity: 0.56,
    },
    postProcessing: {
      toneMappingMode: 'None',
      toneMappingExposure: 1.0,
      antialiasing: {
        msaaSamples: 4,
        smaa: true,
      },
      bloom: {
        enabled: false,
        strength: 0.12,
        radius: 0.2,
        threshold: 0.75,
      },
      colorGrading: {
        enabled: true,
        shadowTint: '#1c1c30',
        highlightTint: '#9aacc6',
        strength: 0.76,
        contrast: 0.3,
        gamma: 0.78,
      },
      saturation: 0.26,
      brightness: 0.0,
      contrast: 0.0,
      cinematic: {
        diffusion: { enabled: true, strength: 0.2, radius: 1.5 },
        filmGrain: { enabled: false, strength: 0.05, speed: 0.8 },
        vignette: { enabled: true, offset: 1.15, darkness: 0.14, color: '#0d111d' },
        chromaticAberration: { enabled: true, offset: 0.002 },
        sharpening: { enabled: false, amount: 0.22 },
      },
    },
    wind: {
      enabled: false,
      speed: 0.1,
      direction: 45,
      elevation: 5,
      turbulence: 0.15,
      gustFrequency: 0.2,
      gustStrength: 0.15,
      particles: {
        enabled: false,
        count: 160,
        size: 0.035,
        color: '#ffd5e5',
        opacity: 0.85,
        speedFactor: 1,
      },
    },
    rain: {
      enabled: false,
      count: 600,
      speed: 9.5,
      length: 0.14,
      angle: 2,
      color: '#cce2ff',
      opacity: 0.45,
      splashEnabled: false,
      splashCount: 110,
    },
  },
};

// ====================================================
// 2. 場所・背景定義 (Location / Environment)
// ====================================================
export const LOCATION_PRESETS: Record<LocationId, LocationPresetData> = {
  modern_park: {
    id: 'modern_park',
    name: '近代公園 (多層)',
    category: 'outdoor',
    environment: {
      showBackgroundImage: true,
      backgroundImageUrl: resolveAssetUrl('/textures/modern-park-far.jpg'),
      backgroundColor: '#ffffff',
      showFloor: false,
      floorColor: '#ffffff',
      showMidground: true,
      midgroundImageUrl: resolveAssetUrl('/textures/modern-park-mid.jpg'),
      midgroundPosition: { x: 0, y: 1.35, z: -0.25 },
      midgroundScale: 1.15,
      midgroundOpacity: 1.0,
      farFogEnabled: true,
      farFogColor: '#ffffff',
      farFogIntensity: 0.24,
    },
  },
  school_gate: {
    id: 'school_gate',
    name: '校門',
    category: 'outdoor',
    environment: {
      showBackgroundImage: true,
      backgroundImageUrl: resolveAssetUrl('/textures/school-gate-far.jpeg'),
      backgroundColor: '#ffffff',
      showFloor: false,
      floorColor: '#ffffff',
      showMidground: false,
      midgroundImageUrl: undefined,
      midgroundPosition: { x: 0, y: 1.35, z: -0.25 },
      midgroundScale: 1.15,
      midgroundOpacity: 1.0,
      farFogEnabled: true,
      farFogColor: '#ffffff',
      farFogIntensity: 0.15,
    },
  },
  classroom: {
    id: 'classroom',
    name: '教室・廊下',
    category: 'indoor',
    environment: {
      showBackgroundImage: true,
      backgroundImageUrl: resolveAssetUrl('/textures/school-corridor-far.jpg'),
      backgroundColor: '#ffffff',
      showFloor: false,
      floorColor: '#ffffff',
      showMidground: false,
      midgroundImageUrl: undefined,
      midgroundPosition: { x: 0, y: 1.35, z: -0.25 },
      midgroundScale: 1.15,
      midgroundOpacity: 1.0,
      farFogEnabled: false,
      farFogColor: '#ffffff',
      farFogIntensity: 0.0,
    },
  },
  old_park: {
    id: 'old_park',
    name: '旧公園',
    category: 'outdoor',
    environment: {
      showBackgroundImage: true,
      backgroundImageUrl: resolveAssetUrl('/textures/park-background.jpg'),
      backgroundColor: '#ffffff',
      showFloor: false,
      floorColor: '#ffffff',
      showMidground: false,
      midgroundImageUrl: undefined,
      midgroundPosition: { x: 0, y: 1.35, z: -0.25 },
      midgroundScale: 1.15,
      midgroundOpacity: 1.0,
      farFogEnabled: false,
      farFogColor: '#ffffff',
      farFogIntensity: 0.0,
    },
  },
  none: {
    id: 'none',
    name: '単色背景 (OFF)',
    category: 'indoor',
    environment: {
      showBackgroundImage: false,
      backgroundImageUrl: '',
      backgroundColor: '#1a1a1a',
      showFloor: false,
      floorColor: '#ffffff',
      showMidground: false,
      midgroundImageUrl: undefined,
      midgroundPosition: { x: 0, y: 1.35, z: -0.25 },
      midgroundScale: 1.15,
      midgroundOpacity: 1.0,
      farFogEnabled: false,
      farFogColor: '#ffffff',
      farFogIntensity: 0.0,
    },
  },
};

// ====================================================
// 3. 複合プリセット (Backward Compatibility & Combined Presets)
// ====================================================
function buildScenePreset(id: ScenePresetId, timeOfDayId: TimeOfDayId, locationId: LocationId): ScenePresetData {
  const combined = createCombinedSceneConfig(timeOfDayId, locationId);
  const tod = TIME_OF_DAY_PRESETS[timeOfDayId] || TIME_OF_DAY_PRESETS.morning;
  const loc = LOCATION_PRESETS[locationId] || LOCATION_PRESETS.modern_park;
  return {
    id,
    name: `${tod.name}・${loc.name}`,
    category: loc.category,
    description: tod.description,
    ...combined,
  };
}

export const SCENE_PRESETS: Record<string, ScenePresetData> = {
  morning_park: buildScenePreset('morning_park', 'morning', 'modern_park'),
  day_park: buildScenePreset('day_park', 'day', 'modern_park'),
  evening_park: buildScenePreset('evening_park', 'evening', 'modern_park'),
  rainy_park: buildScenePreset('rainy_park', 'rainy', 'modern_park'),
  morning_school: buildScenePreset('morning_school', 'morning', 'school_gate'),
  day_school: buildScenePreset('day_school', 'day', 'school_gate'),
  evening_school: buildScenePreset('evening_school', 'evening', 'school_gate'),
  rainy_school: buildScenePreset('rainy_school', 'rainy', 'school_gate'),
  bright_indoor: buildScenePreset('bright_indoor', 'bright_indoor', 'classroom'),
  dark_indoor: buildScenePreset('dark_indoor', 'dark_indoor', 'classroom'),
  morning_outdoor: buildScenePreset('morning_outdoor', 'morning', 'modern_park'),
  day_outdoor: buildScenePreset('day_outdoor', 'day', 'modern_park'),
  evening_outdoor: buildScenePreset('evening_outdoor', 'evening', 'modern_park'),
  rainy_outdoor: buildScenePreset('rainy_outdoor', 'rainy', 'modern_park'),
};

export function getScenePreset(presetId: ScenePresetId | string): ScenePresetData {
  if (presetId in SCENE_PRESETS) {
    return SCENE_PRESETS[presetId];
  }
  return SCENE_PRESETS.morning_park;
}

export function getTimeOfDayPreset(timeOfDayId: TimeOfDayId): TimeOfDayPresetData {
  return TIME_OF_DAY_PRESETS[timeOfDayId] || TIME_OF_DAY_PRESETS.morning;
}

export function getLocationPreset(locationId: LocationId): LocationPresetData {
  return LOCATION_PRESETS[locationId] || LOCATION_PRESETS.modern_park;
}

export function createCombinedSceneConfig(timeOfDayId: TimeOfDayId, locationId: LocationId): {
  environment: AvatarConfig['environment'];
  lighting: AvatarConfig['lighting'];
  postProcessing: AvatarConfig['postProcessing'];
  materials: AvatarConfig['materials'];
  outline: AvatarConfig['outline'];
  wind: AvatarConfig['wind'];
  rain: AvatarConfig['rain'];
  eyeGlow?: AvatarConfig['eyeGlow'];
} {
  const tod = TIME_OF_DAY_PRESETS[timeOfDayId] || TIME_OF_DAY_PRESETS.morning;
  const loc = LOCATION_PRESETS[locationId] || LOCATION_PRESETS.modern_park;

  const defaultOutline = {
    enabled: true,
    useSmoothNormal: true,
    screenSpaceWidth: true,
    autoLineWeight: true,
    darknessFactor: 0.1,
    widthFactor: 0.001,
    lightingMixFactor: 0,
  };

  const defaultWind = {
    enabled: false,
    speed: 0.1,
    direction: 45,
    elevation: 5,
    turbulence: 0.15,
    gustFrequency: 0.2,
    gustStrength: 0.15,
    particles: {
      enabled: false,
      count: 160,
      size: 0.035,
      color: '#ffd5e5',
      opacity: 0.85,
      speedFactor: 1,
    },
  };

  const defaultRain = {
    enabled: false,
    count: 600,
    speed: 9.5,
    length: 0.14,
    angle: 2,
    color: '#cce2ff',
    opacity: 0.45,
    splashEnabled: false,
    splashCount: 110,
  };

  return {
    environment: JSON.parse(JSON.stringify({ ...loc.environment, ...(tod.environment || {}) })),
    lighting: JSON.parse(JSON.stringify(tod.lighting)),
    postProcessing: JSON.parse(JSON.stringify(tod.postProcessing)),
    materials: JSON.parse(JSON.stringify(tod.materials)),
    outline: JSON.parse(JSON.stringify(tod.outline || defaultOutline)),
    wind: JSON.parse(JSON.stringify(tod.wind || defaultWind)),
    rain: JSON.parse(JSON.stringify(tod.rain || defaultRain)),
    eyeGlow: tod.eyeGlow ? JSON.parse(JSON.stringify(tod.eyeGlow)) : undefined,
  };
}
