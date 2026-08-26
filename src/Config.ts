export interface MaterialStyleParams {
  shadeColor: string;
  shadingToonyFactor: number;
  shadingShiftFactor: number;
  giEqualizationFactor: number;
  rimColor: string;
  parametricRimFresnelPowerFactor: number;
  parametricRimLiftFactor: number;
  rimLightingMixFactor: number;
  outlineColor: string;
  outlineWidthFactor: number;
  // Boundary Color Ramp (影の境界差し色)
  boundaryColor: string;
  boundaryWidth: number;
  boundaryStrength: number;
}

export interface GenshinAvatarConfig {
  faceShader: {
    shadowColor: string;
    shadowStrength: number;
    softness: number;
    thresholdOffset: number;
    materialStyleStrength: number;
    boundaryColor: string;
    boundaryWidth: number;
    boundaryStrength: number;
  };
  materials: {
    body: MaterialStyleParams;
    hair: MaterialStyleParams;
    cloth: MaterialStyleParams;
  };
  outline: {
    enabled: boolean;
    usePerMaterialColor: boolean;
    color: string;
    widthFactor: number;
    lightingMixFactor: number;
  };
  environment: {
    backgroundColor: string;
    showFloor: boolean;
    floorColor: string;
    useBackgroundImage: boolean;
    backgroundImageUrl: string;
    backgroundBlur: number;
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
}

export const DEFAULT_CONFIG: GenshinAvatarConfig = {
  faceShader: {
    shadowColor: '#c7abb5',
    shadowStrength: 0.55,
    softness: 0.018,
    thresholdOffset: 0,
    materialStyleStrength: 0.6,
    boundaryColor: '#ff8877',
    boundaryWidth: 0.04,
    boundaryStrength: 0.55,
  },
  materials: {
    body: {
      shadeColor: '#c8c4c6',
      shadingToonyFactor: 1,
      shadingShiftFactor: -0.16,
      giEqualizationFactor: 0.78,
      rimColor: '#1b1016',
      parametricRimFresnelPowerFactor: 5,
      parametricRimLiftFactor: 1.93,
      rimLightingMixFactor: 0.15,
      outlineColor: '#9e6b65',
      outlineWidthFactor: 0.001,
      boundaryColor: '#ff7766',
      boundaryWidth: 0.05,
      boundaryStrength: 0.6,
    },
    hair: {
      shadeColor: '#000000',
      shadingToonyFactor: 1,
      shadingShiftFactor: -0.64,
      giEqualizationFactor: 0.55,
      rimColor: '#000000',
      parametricRimFresnelPowerFactor: 10,
      parametricRimLiftFactor: 0.21,
      rimLightingMixFactor: 0.24,
      outlineColor: '#000000',
      outlineWidthFactor: 0.001,
      boundaryColor: '#a98e8e',
      boundaryWidth: 0.04,
      boundaryStrength: 0.65,
    },
    cloth: {
      shadeColor: '#aeb7d0',
      shadingToonyFactor: 1,
      shadingShiftFactor: 0.24,
      giEqualizationFactor: 0.75,
      rimColor: '#202942',
      parametricRimFresnelPowerFactor: 4,
      parametricRimLiftFactor: 0.02,
      rimLightingMixFactor: 1.16,
      outlineColor: '#1e2538',
      outlineWidthFactor: 0.0008,
      boundaryColor: '#556688',
      boundaryWidth: 0.03,
      boundaryStrength: 0.25,
    },
  },
  outline: {
    enabled: true,
    usePerMaterialColor: true,
    color: '#1f2430',
    widthFactor: 0.003,
    lightingMixFactor: 0,
  },
  environment: {
    backgroundColor: '#ffffff',
    showFloor: false,
    floorColor: '#ffffff',
    useBackgroundImage: true,
    backgroundImageUrl: '/textures/park-background.webp',
    backgroundBlur: 0,
  },
  lighting: {
    castShadows: false,
    ambient: {
      color: '#bb8888',
      intensity: 1,
    },
    directional: {
      color: '#ffffff',
      intensity: 2.5,
      posX: 1.4,
      posY: -0.1,
      posZ: 2,
    },
    rim: {
      color: '#dde8ff',
      intensity: 0.6,
      posX: -2,
      posY: 2.5,
      posZ: -2,
    },
  },
  postProcessing: {
    toneMappingMode: 'None',
    toneMappingExposure: 1.05,
    antialiasing: {
      msaaSamples: 4,
      smaa: true,
    },
    bloom: {
      enabled: true,
      strength: 0.1,
      radius: 0.32,
      threshold: 0.89,
    },
    colorGrading: {
      enabled: true,
      shadowTint: '#2d3559',
      highlightTint: '#fffbf2',
      strength: 0.4,
      contrast: 0.16,
      gamma: 0.96,
    },
    saturation: 0.5,
    brightness: 0,
    contrast: 0,
  },
};

/** Deep clone a configuration object */
export function cloneConfig(cfg: GenshinAvatarConfig): GenshinAvatarConfig {
  return JSON.parse(JSON.stringify(cfg));
}

/** Export config as a formatted JSON string */
export function exportConfigJSON(config: GenshinAvatarConfig): string {
  return JSON.stringify(config, null, 2);
}

/** Download config as a .json file */
export function downloadConfigJSON(config: GenshinAvatarConfig, filename = 'genshin-avatar-config.json'): void {
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
export async function copyConfigToClipboard(config: GenshinAvatarConfig): Promise<boolean> {
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
