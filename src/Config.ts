import { resolveAssetUrl } from './utils/path';
import type { ShortAnimationConfig } from './animation/types';
import { type RainConfig, DEFAULT_RAIN_CONFIG } from './effects/rain';

export type { RainConfig };

export interface MaterialStyleParams {
  color: string;
  shadowHueShift: number;
  shadowLightnessFactor: number;
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

export interface WindParticlesConfig {
  enabled: boolean;
  count: number;
  size: number;
  color: string;
  opacity: number;
  speedFactor: number;
}

export interface WindConfig {
  enabled: boolean;
  speed: number;
  direction: number; // degrees 0-360
  elevation: number; // degrees -45 to 45
  turbulence: number;
  gustFrequency: number;
  gustStrength: number;
  particles: WindParticlesConfig;
}

export interface EnvironmentConfig {
  showBackgroundImage: boolean;
  backgroundImageUrl: string;
  backgroundColor: string;
  showFloor: boolean;
  floorColor: string;
  showMidground: boolean;
  midgroundImageUrl?: string;
  midgroundPosition: {
    x: number;
    y: number;
    z: number;
  };
  midgroundScale: number;
  midgroundOpacity: number;
  farFogEnabled: boolean;
  farFogColor: string;
  farFogIntensity: number;
}

export interface LipSyncConfig {
  enabled: boolean;
  gain: number;
  smoothing: number;
  rmsThreshold: number;
  audioDelay: number;
  voiceGender: 'female' | 'male';
}

export interface AvatarConfig {
  materials: {
    body: MaterialStyleParams;
    hair: MaterialStyleParams;
    cloth: MaterialStyleParams;
  };
  outline: {
    enabled: boolean;
    useSmoothNormal: boolean;
    screenSpaceWidth: boolean;
    autoLineWeight: boolean;
    darknessFactor: number;
    widthFactor: number;
    lightingMixFactor: number;
  };
  environment: EnvironmentConfig;
  lighting: {
    castShadows: boolean;
    ambient: {
      color: string;
      intensity: number;
    };
    directional: {
      color: string;
      intensity: number;
      posX: number;
      posY: number;
      posZ: number;
    };
    rim: {
      enabled: boolean;
      color: string;
      intensity: number;
      posX: number;
      posY: number;
      posZ: number;
    };
    depthRim: DepthRimConfig;
    sunShafts: SunShaftsConfig;
    lensFlare: LensFlareConfig;
  };
  postProcessing: {
    toneMappingMode: 'ACESFilmic' | 'Reinhard' | 'AgX' | 'Linear' | 'None';
    toneMappingExposure: number;
    antialiasing: {
      msaaSamples: number;
      smaa: boolean;
    };
    bloom: {
      enabled: boolean;
      strength: number;
      radius: number;
      threshold: number;
    };
    colorGrading: {
      enabled: boolean;
      shadowTint: string;
      highlightTint: string;
      strength: number;
      contrast: number;
      gamma: number;
    };
    saturation: number;
    brightness: number;
    contrast: number;
  };
  camera: {
    fov: number;
    position: {
      x: number;
      y: number;
      z: number;
    };
    target: {
      x: number;
      y: number;
      z: number;
    };
    minDistance: number;
    maxDistance: number;
  };
  lipSync: LipSyncConfig;
  activeScene?: {
    presetId?: string;
    timeOfDay?: 'morning' | 'day' | 'evening' | 'bright_indoor' | 'dark_indoor' | string;
    location?: 'modern_park' | 'school_gate' | 'classroom' | 'old_park' | 'none' | 'outdoor' | 'indoor' | string;
  };
  wind: WindConfig;
  rain: RainConfig;
  shortAnimation: ShortAnimationConfig;
}

export const DEFAULT_CONFIG: AvatarConfig = {
  activeScene: {
    presetId: 'morning_park',
    timeOfDay: 'morning',
    location: 'modern_park',
  },
  materials: {
    body: {
      color: '#fffffa',
      shadowHueShift: 0.02,
      shadowLightnessFactor: 0.16,
      shadingToonyFactor: 1.0,
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
      shadingToonyFactor: 1.0,
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
      shadingToonyFactor: 1.0,
      shadingShiftFactor: -0.05,
      giEqualizationFactor: 0.9,
      matcapEnabled: true,
      emissiveIntensity: 0.0,
      rimEnabled: false,
      rimColor: '#202942',
      parametricRimFresnelPowerFactor: 4,
      parametricRimLiftFactor: 0.02,
      rimLightingMixFactor: 1.0,
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
    lightingMixFactor: 0.0,
  },
  environment: {
    showBackgroundImage: true,
    backgroundImageUrl: resolveAssetUrl('/textures/modern-park-far.jpg'),
    backgroundColor: '#ffffff',
    showFloor: false,
    floorColor: '#ffffff',
    showMidground: true,
    midgroundImageUrl: resolveAssetUrl('/textures/modern-park-mid.jpg'),
    midgroundPosition: {
      x: 0,
      y: 1.35,
      z: -0.25,
    },
    midgroundScale: 1.15,
    midgroundOpacity: 1.0,
    farFogEnabled: true,
    farFogColor: '#ffffff',
    farFogIntensity: 0.24,
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
      posZ: 2.0,
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
      exposure: 0.24,
      decay: 0.88,
      density: 0.8,
      weight: 0.24,
      color: '#dcdbff',
      shimmer: 0.4,
    },
    lensFlare: {
      enabled: true,
      sunSize: 1.25,
      sunColor: '#fff8ee',
      glowIntensity: 1.15,
      starburstIntensity: 0.95,
      anamorphicIntensity: 1.1,
      ghostIntensity: 0.3,
      haloIntensity: 0.5,
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
    brightness: 0.0,
    contrast: 0.0,
  },
  camera: {
    fov: 30,
    position: {
      x: 0,
      y: 1.1,
      z: 2.65,
    },
    target: {
      x: 0,
      y: 1.15,
      z: 0,
    },
    minDistance: 0.5,
    maxDistance: 10,
  },
  lipSync: {
    enabled: true,
    gain: 0.65,
    smoothing: 0.17,
    rmsThreshold: 0.008,
    audioDelay: 0.05,
    voiceGender: 'female',
  },
  shortAnimation: {
    cuts: [
      {
        enabled: true,
        duration: 1.5,
        startAngle: 'farFront',
        cameraDistance: 1.8,
        cameraPreset: 'pushIn',
        cameraStrength: 1.2,
        motion: resolveAssetUrl('/animations/Walking.fbx'),
        backText: {
          text: 'AnimeVRM',
          animationPreset: 'slideLeft',
          x: 50,
          y: 35,
          fontSize: 14,
          color: '#ffffff',
          fontWeight: 800,
        },
        frontText: {
          text: 'MOTION',
          animationPreset: 'scaleIn',
          x: 50,
          y: 72,
          fontSize: 8,
          color: '#818cf8',
          fontWeight: 800,
        },
      },
      {
        enabled: true,
        duration: 2.0,
        startAngle: 'right',
        cameraDistance: 1.2,
        cameraPreset: 'orbitLeftHalf',
        cameraStrength: 1.0,
        motion: resolveAssetUrl('/animations/Idle.fbx'),
        backText: {
          text: 'THREE.JS',
          animationPreset: 'fade',
          x: 50,
          y: 30,
          fontSize: 13,
          color: '#f43f5e',
          fontWeight: 800,
        },
        frontText: {
          text: 'GROOVE',
          animationPreset: 'slideRight',
          x: 50,
          y: 75,
          fontSize: 9,
          color: '#ffffff',
          fontWeight: 700,
        },
      },
      {
        enabled: true,
        duration: 1.5,
        startAngle: 'lowAngle',
        cameraDistance: 1.0,
        cameraPreset: 'lowAngleUp',
        cameraStrength: 1.0,
        motion: resolveAssetUrl('/animations/Idle.fbx'),
        backText: {
          text: 'POWER',
          animationPreset: 'slideUp',
          x: 50,
          y: 38,
          fontSize: 12,
          color: '#ffffff',
          fontWeight: 800,
        },
        frontText: {
          text: 'FEATURING',
          animationPreset: 'static',
          x: 50,
          y: 68,
          fontSize: 7,
          color: '#38bdf8',
          fontWeight: 700,
        },
      },
      {
        enabled: true,
        duration: 3.0,
        startAngle: 'front',
        cameraDistance: 1.0,
        cameraPreset: 'punchIn',
        cameraStrength: 1.0,
        motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
        backText: {
          text: 'CLIMAX',
          animationPreset: 'punch',
          x: 50,
          y: 35,
          fontSize: 16,
          color: '#fbbf24',
          fontWeight: 900,
        },
        frontText: {
          text: 'VRM TOON',
          animationPreset: 'punch',
          x: 50,
          y: 75,
          fontSize: 9,
          color: '#ffffff',
          fontWeight: 800,
        },
      },
    ],
  },
  wind: {
    enabled: false,
    speed: 0.1,
    direction: 45, // degrees
    elevation: 5, // degrees
    turbulence: 0.15,
    gustFrequency: 0.2,
    gustStrength: 0.15,
    particles: {
      enabled: false,
      count: 160,
      size: 0.035,
      color: '#ffd5e5',
      opacity: 0.85,
      speedFactor: 1.0,
    },
  },
  rain: { ...DEFAULT_RAIN_CONFIG },
};

export function cloneConfig(cfg: AvatarConfig): AvatarConfig {
  return JSON.parse(JSON.stringify(cfg));
}

export function deepAssign(target: any, source: any): any {
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = {};
      }
      deepAssign(target[key], source[key]);
    } else if (Array.isArray(source[key])) {
      target[key] = JSON.parse(JSON.stringify(source[key]));
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

export function exportConfigJSON(cfg: AvatarConfig): string {
  return JSON.stringify(cfg, null, 2);
}

export function downloadConfigJSON(cfg: AvatarConfig, filename = 'avatar-config.json'): void {
  const jsonStr = exportConfigJSON(cfg);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyConfigToClipboard(cfg: AvatarConfig): Promise<boolean> {
  try {
    const jsonStr = exportConfigJSON(cfg);
    await navigator.clipboard.writeText(jsonStr);
    return true;
  } catch {
    return false;
  }
}

