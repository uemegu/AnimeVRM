import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { VRMSpringBoneJoint } from '@pixiv/three-vrm-springbone';
import type { WindConfig } from '../Config';

export interface WindPreset {
  name: string;
  label: string;
  config: Partial<WindConfig>;
}

export const WIND_PRESETS: Record<string, WindPreset> = {
  calm: {
    name: 'calm',
    label: '🍃 無風 (Calm)',
    config: {
      enabled: false,
      speed: 0.0,
      turbulence: 0.0,
      gustStrength: 0.0,
      particles: {
        enabled: false,
        count: 160,
        size: 0.035,
        color: '#e2f8ff',
        opacity: 0.8,
        speedFactor: 1.0,
      },
    },
  },
  breeze: {
    name: 'breeze',
    label: '🌸 そよ風 (Gentle Breeze)',
    config: {
      enabled: true,
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
        color: '#e2f8ff',
        opacity: 0.8,
        speedFactor: 1.0,
      },
    },
  },
  strong: {
    name: 'strong',
    label: '💨 強風 (Strong Wind)',
    config: {
      enabled: true,
      speed: 1.5,
      direction: 70,
      elevation: 10,
      turbulence: 0.5,
      gustFrequency: 0.4,
      gustStrength: 0.8,
      particles: {
        enabled: false,
        count: 160,
        size: 0.035,
        color: '#e2f8ff',
        opacity: 0.8,
        speedFactor: 1.0,
      },
    },
  },
  gusty: {
    name: 'gusty',
    label: '🌪️ 突風・嵐 (Gusty Storm)',
    config: {
      enabled: true,
      speed: 1.2,
      direction: 120,
      elevation: 12,
      turbulence: 0.8,
      gustFrequency: 0.6,
      gustStrength: 1.5,
      particles: {
        enabled: false,
        count: 160,
        size: 0.035,
        color: '#e2f8ff',
        opacity: 0.8,
        speedFactor: 1.0,
      },
    },
  },
  anemo: {
    name: 'anemo',
    label: '✨ 原神風・疾風 (Anemo Gale)',
    config: {
      enabled: true,
      speed: 1.2,
      direction: 215,
      elevation: 15,
      turbulence: 0.6,
      gustFrequency: 0.5,
      gustStrength: 1.2,
      particles: {
        enabled: false,
        count: 160,
        size: 0.035,
        color: '#e2f8ff',
        opacity: 0.8,
        speedFactor: 1.0,
      },
    },
  },
};

interface CachedJointData {
  origGravityDir: THREE.Vector3;
  origGravityPower: number;
}

export class WindController {
  public currentWindVector: THREE.Vector3 = new THREE.Vector3();
  public currentWindSpeed: number = 0;

  private cachedJoints: Map<VRMSpringBoneJoint, CachedJointData> = new Map();
  private lastVrm: VRM | null = null;

  private _baseDir: THREE.Vector3 = new THREE.Vector3();
  private _turbVec: THREE.Vector3 = new THREE.Vector3();
  private _effGravity: THREE.Vector3 = new THREE.Vector3();

  constructor() {}

  /**
   * Reset cached joints when VRM model changes or is disposed
   */
  public resetModel(): void {
    this.cachedJoints.clear();
    this.lastVrm = null;
  }

  /**
   * Cache initial gravity settings of VRM SpringBones
   */
  private cacheSpringBones(vrm: VRM): void {
    if (this.lastVrm === vrm && this.cachedJoints.size > 0) return;

    this.cachedJoints.clear();
    this.lastVrm = vrm;

    const joints = vrm.springBoneManager?.joints;
    if (!joints) return;

    joints.forEach((joint) => {
      this.cachedJoints.set(joint, {
        origGravityDir: joint.settings.gravityDir ? joint.settings.gravityDir.clone() : new THREE.Vector3(0, -1, 0),
        origGravityPower: joint.settings.gravityPower !== undefined ? joint.settings.gravityPower : 0,
      });
    });
  }

  /**
   * Calculate dynamic wind vector based on config, elapsed time, and turbulence
   */
  public calculateWindVector(config: WindConfig, elapsed: number): THREE.Vector3 {
    if (!config.enabled || config.speed <= 0) {
      this.currentWindVector.set(0, 0, 0);
      this.currentWindSpeed = 0;
      return this.currentWindVector;
    }

    const radDir = THREE.MathUtils.degToRad(config.direction);
    const radElev = THREE.MathUtils.degToRad(config.elevation);

    // Primary direction vector
    this._baseDir.set(
      Math.sin(radDir) * Math.cos(radElev),
      Math.sin(radElev),
      Math.cos(radDir) * Math.cos(radElev)
    ).normalize();

    // Multi-frequency sine wave turbulence for organic wind noise
    const t = elapsed;
    const turbX = Math.sin(t * 2.3) * 0.5 + Math.sin(t * 4.9 + 1.2) * 0.3 + Math.sin(t * 0.9 + 2.4) * 0.2;
    const turbY = Math.sin(t * 1.8 + 0.5) * 0.4 + Math.sin(t * 3.7 + 2.1) * 0.3;
    const turbZ = Math.cos(t * 2.1 + 0.8) * 0.5 + Math.sin(t * 5.3 + 0.4) * 0.3;

    this._turbVec.set(turbX, turbY, turbZ).multiplyScalar(config.turbulence * 0.5);

    // Periodic organic gusts
    const gFreq = config.gustFrequency;
    const gustRaw = Math.sin(t * gFreq * 1.2) * 0.6 + Math.sin(t * gFreq * 2.7 + 1.1) * 0.4;
    const gustFactor = Math.max(0, gustRaw * gustRaw * Math.sign(gustRaw)) * config.gustStrength;

    // Combined wind speed and direction
    const effectiveSpeed = Math.max(0, config.speed + gustFactor);
    this.currentWindSpeed = effectiveSpeed;

    this.currentWindVector.copy(this._baseDir)
      .multiplyScalar(effectiveSpeed)
      .add(this._turbVec);

    return this.currentWindVector;
  }

  /**
   * Apply calculated wind vector to VRM SpringBone joints
   */
  public update(vrm: VRM | null, config: WindConfig, elapsed: number): void {
    if (!vrm) return;

    this.cacheSpringBones(vrm);
    this.calculateWindVector(config, elapsed);

    const joints = vrm.springBoneManager?.joints;
    if (!joints) return;

    const isWindActive = config.enabled && this.currentWindSpeed > 0.001;

    joints.forEach((joint) => {
      const cached = this.cachedJoints.get(joint);
      if (!cached) return;

      if (!isWindActive) {
        // Restore original gravity
        joint.settings.gravityDir.copy(cached.origGravityDir);
        joint.settings.gravityPower = cached.origGravityPower;
      } else {
        // Compose original gravity with wind force vector
        this._effGravity.copy(cached.origGravityDir)
          .multiplyScalar(cached.origGravityPower)
          .add(this.currentWindVector);

        const effPower = this._effGravity.length();
        if (effPower > 1e-6) {
          joint.settings.gravityDir.copy(this._effGravity).divideScalar(effPower);
          joint.settings.gravityPower = effPower;
        } else {
          joint.settings.gravityDir.set(0, -1, 0);
          joint.settings.gravityPower = 0;
        }
      }
    });
  }

  /**
   * Apply preset to a target config object
   */
  public static applyPreset(targetConfig: WindConfig, presetKey: string): boolean {
    const preset = WIND_PRESETS[presetKey];
    if (!preset || !preset.config) return false;

    if (preset.config.enabled !== undefined) targetConfig.enabled = preset.config.enabled;
    if (preset.config.speed !== undefined) targetConfig.speed = preset.config.speed;
    if (preset.config.direction !== undefined) targetConfig.direction = preset.config.direction;
    if (preset.config.elevation !== undefined) targetConfig.elevation = preset.config.elevation;
    if (preset.config.turbulence !== undefined) targetConfig.turbulence = preset.config.turbulence;
    if (preset.config.gustFrequency !== undefined) targetConfig.gustFrequency = preset.config.gustFrequency;
    if (preset.config.gustStrength !== undefined) targetConfig.gustStrength = preset.config.gustStrength;
    if (preset.config.particles) {
      Object.assign(targetConfig.particles, preset.config.particles);
    }
    return true;
  }
}
