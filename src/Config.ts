import { resolveAssetUrl } from './utils/path';

export interface MaterialStyleParams {
  color: string;
  shadowHueShift: number;
  shadowLightnessFactor: number;
  shadingToonyFactor: number;
  shadingShiftFactor: number;
  giEqualizationFactor: number;
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
  environment: {
    showBackgroundImage: boolean;
    backgroundImageUrl: string;
    backgroundColor: string;
    showFloor: boolean;
    floorColor: string;
  };
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
  lipSync: {
    enabled: boolean;
    gain: number;
    smoothing: number;
    rmsThreshold: number;
  };
}

export const DEFAULT_CONFIG: AvatarConfig = {
  materials: {
    body: {
      color: '#fffafa',
      shadowHueShift: 0.02,
      shadowLightnessFactor: 0.16,
      shadingToonyFactor: 1.0,
      shadingShiftFactor: -0.05,
      giEqualizationFactor: 0.9,
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
    backgroundImageUrl: resolveAssetUrl('/textures/park-background.jpg'),
    backgroundColor: '#ffffff',
    showFloor: false,
    floorColor: '#ffffff',
  },
  lighting: {
    castShadows: false,
    ambient: {
      color: '#ffb8b8',
      intensity: 0.35,
    },
    directional: {
      color: '#ffffff',
      intensity: 2.6,
      posX: 4.1,
      posY: 2.5,
      posZ: 2,
    },
    rim: {
      enabled: true,
      color: '#dde8ff',
      intensity: 0.05,
      posX: -2,
      posY: 2.5,
      posZ: -2,
    },
    depthRim: {
      enabled: true,
      power: 4.0,
      threshold: 0.15,
      intensity: 0.8,
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
      radius: 0.16,
      threshold: 0.85,
    },
    colorGrading: {
      enabled: true,
      shadowTint: '#5471f2',
      highlightTint: '#ffffff',
      strength: 0.5,
      contrast: 0.13,
      gamma: 1.0,
    },
    saturation: 0.26,
    brightness: 0.0,
    contrast: 0.0,
  },
  camera: {
    fov: 30,
    position: {
      x: 0,
      y: 1.4,
      z: 1.8,
    },
    target: {
      x: 0,
      y: 1.3,
      z: 0,
    },
    minDistance: 0.5,
    maxDistance: 10,
  },
  lipSync: {
    enabled: true,
    gain: 1.5,
    smoothing: 0.45,
    rmsThreshold: 0.008,
  },
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
      if (!target[key]) target[key] = {};
      deepAssign(target[key], source[key]);
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

