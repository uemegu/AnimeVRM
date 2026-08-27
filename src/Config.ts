import { resolveAssetUrl } from './utils/path';

export interface MaterialStyleParams {
  shadeColor: string;
  shadingToonyFactor: number;
  shadingShiftFactor: number;
  giEqualizationFactor: number;
  rimEnabled: boolean;
  rimColor: string;
  parametricRimFresnelPowerFactor: number;
  parametricRimLiftFactor: number;
  rimLightingMixFactor: number;
  outlineColor: string;
  outlineWidthFactor: number;
}

export interface AvatarConfig {
  materials: {
    body: MaterialStyleParams;
    hair: MaterialStyleParams;
    cloth: MaterialStyleParams;
  };
  outline: {
    enabled: boolean;
    autoColorFromMaterial: boolean;
    darknessFactor: number;
    usePerMaterialColor: boolean;
    color: string;
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
      shadeColor: '#bf8d9b',
      shadingToonyFactor: 1,
      shadingShiftFactor: -0.05,
      giEqualizationFactor: 0.9,
      rimEnabled: false,
      rimColor: '#ffffff',
      parametricRimFresnelPowerFactor: 5,
      parametricRimLiftFactor: 0.1,
      rimLightingMixFactor: 0.1,
      outlineColor: '#6a3b45',
      outlineWidthFactor: 0.001,
    },
    hair: {
      shadeColor: '#22222a',
      shadingToonyFactor: 1,
      shadingShiftFactor: -0.05,
      giEqualizationFactor: 0.9,
      rimEnabled: false,
      rimColor: '#ffffff',
      parametricRimFresnelPowerFactor: 0,
      parametricRimLiftFactor: 0.1,
      rimLightingMixFactor: 0.2,
      outlineColor: '#1a1c24',
      outlineWidthFactor: 0.0008,
    },
    cloth: {
      shadeColor: '#aeb7d0',
      shadingToonyFactor: 1,
      shadingShiftFactor: -0.05,
      giEqualizationFactor: 0.9,
      rimEnabled: true,
      rimColor: '#202942',
      parametricRimFresnelPowerFactor: 4,
      parametricRimLiftFactor: 0.02,
      rimLightingMixFactor: 1,
      outlineColor: '#1e2538',
      outlineWidthFactor: 0.001,
    },
  },
  outline: {
    enabled: true,
    autoColorFromMaterial: true,
    darknessFactor: 0.1,
    usePerMaterialColor: false,
    color: '#1f2430',
    widthFactor: 0.001,
    lightingMixFactor: 0,
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
      color: '#fff0f0',
      intensity: 0.15,
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
      radius: 0.16,
      threshold: 0.85,
    },
    colorGrading: {
      enabled: true,
      shadowTint: '#5471f2',
      highlightTint: '#fffafa',
      strength: 0.56,
      contrast: 0.13,
      gamma: 0.7,
    },
    saturation: 0.26,
    brightness: 0.05,
    contrast: 0,
  },
  lipSync: {
    enabled: true,
    gain: 1.1,
    smoothing: 0.2,
    rmsThreshold: 0.01,
  },
};

/** Deep clone a configuration object */
export function cloneConfig(cfg: AvatarConfig): AvatarConfig {
  return JSON.parse(JSON.stringify(cfg));
}

/** Export config as a formatted JSON string */
export function exportConfigJSON(config: AvatarConfig): string {
  return JSON.stringify(config, null, 2);
}

/** Download config as a .json file */
export function downloadConfigJSON(config: AvatarConfig, filename = 'avatar-config.json'): void {
  const jsonStr = exportConfigJSON(config);
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

/** Copy JSON string to clipboard */
export async function copyConfigToClipboard(config: AvatarConfig): Promise<boolean> {
  const jsonStr = exportConfigJSON(config);
  try {
    await navigator.clipboard.writeText(jsonStr);
    return true;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
}

/**
 * Recursively copy properties from source to target in-place,
 * preserving existing object references so lil-gui controller bindings stay connected.
 */
export function deepAssign<T extends Record<string, any>>(target: T, source: any): T {
  if (!source || typeof source !== 'object') return target;
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val !== undefined) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
          target[key] = {} as any;
        }
        deepAssign(target[key], val);
      } else {
        target[key] = val;
      }
    }
  }
  return target;
}
