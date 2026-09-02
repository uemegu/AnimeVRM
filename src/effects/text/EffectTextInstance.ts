import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { EffectAnimationType, EffectAnchor, EffectTextPreset, ShowEffectTextOptions } from './types';
import { createEffectTextTexture } from './textureGenerator';
import { EFFECT_TEXT_PRESETS } from './presets';

const _worldPos = new THREE.Vector3();

export class EffectTextInstance {
  public readonly id: string;
  public readonly sprite: THREE.Sprite;
  public readonly material: THREE.SpriteMaterial;

  public isAlive: boolean = true;
  public elapsedTime: number = 0;
  public readonly duration: number;

  private target?: VRM | THREE.Object3D;
  private anchor: EffectAnchor;
  private offset: THREE.Vector3;
  private preset: EffectTextPreset;
  private animations: Set<EffectAnimationType>;
  private baseScale: number;
  private aspect: number;
  private initialRotation: number;
  private riseSpeed: number;

  private onUpdateCallback?: (progress: number, instance: EffectTextInstance) => void;
  private onCompleteCallback?: () => void;

  constructor(options: ShowEffectTextOptions, id: string) {
    this.id = id;

    // Resolve preset
    const presetName = options.stylePreset || 'wanawana';
    this.preset = EFFECT_TEXT_PRESETS[presetName as keyof typeof EFFECT_TEXT_PRESETS] || EFFECT_TEXT_PRESETS.wanawana;

    // Merge style
    const mergedStyle = {
      ...this.preset.style,
      ...(options.customStyle || {}),
    };

    // Duration & Scale
    this.duration = options.duration ?? this.preset.defaultDuration;
    this.baseScale = (options.scale ?? 1.0) * this.preset.defaultScale;

    // Animations
    const animList = options.animations ?? this.preset.animations;
    this.animations = new Set(animList);

    // Rise speed
    this.riseSpeed = options.streamConfig?.riseSpeed ?? this.preset.riseSpeed ?? 0.28;

    // Target & Anchor
    this.target = options.target;
    this.anchor = options.anchor ?? 'head';

    // Offset (Default to preset defaultOffset)
    const defaultOff = this.preset.defaultOffset;
    const customOff = options.offset;
    this.offset = new THREE.Vector3(
      customOff?.x ?? defaultOff.x,
      customOff?.y ?? defaultOff.y,
      customOff?.z ?? defaultOff.z
    );

    this.onUpdateCallback = options.onUpdate;
    this.onCompleteCallback = options.onComplete;

    // Create Canvas Texture
    const { texture, aspect } = createEffectTextTexture(options.text, mergedStyle);
    this.aspect = aspect;

    // Initial Rotation
    this.initialRotation = (mergedStyle.slant ?? 0) * (Math.PI / 180) * 0.5;

    // Create Sprite Material
    this.material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      rotation: this.initialRotation,
    });

    // Create Sprite (Anchor point is center (0.5, 0.5) by default)
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.renderOrder = 10000;

    // Set initial transform
    this.updateSpriteTransform(0);
  }

  /**
   * Get world position of the target anchor
   */
  private getAnchorWorldPosition(out: THREE.Vector3): boolean {
    if (!this.target) {
      out.set(0, 0, 0);
      return false;
    }

    // If target is VRM instance
    if ('humanoid' in this.target && this.target.humanoid) {
      const vrm = this.target as VRM;
      const boneName =
        typeof this.anchor === 'string' && this.anchor !== 'custom'
          ? (this.anchor as VRMHumanBoneName)
          : 'head';

      const boneNode = vrm.humanoid.getNormalizedBoneNode(boneName) || vrm.humanoid.getRawBoneNode(boneName);
      if (boneNode) {
        boneNode.getWorldPosition(out);
        return true;
      }

      // Fallback to VRM scene position
      vrm.scene.getWorldPosition(out);
      return true;
    }

    // If target is an Object3D
    if (this.target instanceof THREE.Object3D) {
      this.target.getWorldPosition(out);
      return true;
    }

    return false;
  }

  /**
   * Update animation step
   */
  public update(delta: number, camera?: THREE.Camera): boolean {
    if (!this.isAlive) return false;

    this.elapsedTime += delta;
    const progress = THREE.MathUtils.clamp(this.elapsedTime / this.duration, 0, 1);

    if (progress >= 1.0) {
      this.isAlive = false;
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
      }
      return false;
    }

    this.updateSpriteTransform(progress);

    if (this.onUpdateCallback) {
      this.onUpdateCallback(progress, this);
    }

    return true;
  }

  /**
   * Calculate position, scale, opacity and rotation for current frame
   */
  private updateSpriteTransform(progress: number): void {
    // 1. Base Anchor Position
    this.getAnchorWorldPosition(_worldPos);

    let posX = _worldPos.x + this.offset.x;
    let posY = _worldPos.y + this.offset.y;
    let posZ = _worldPos.z + this.offset.z;

    let scaleMultiplier = 1.0;
    let rot = this.initialRotation;
    let opacity = 1.0;

    // 2. Pop Animation (bouncy pop-in at spawn)
    if (this.animations.has('pop')) {
      const popDuration = 0.22;
      if (this.elapsedTime < popDuration) {
        const p = this.elapsedTime / popDuration;
        const overshoot = 1.35;
        scaleMultiplier = p === 0 ? 0 : 1 + overshoot * Math.pow(p - 1, 3) + (overshoot - 1) * Math.pow(p - 1, 2);
        scaleMultiplier = Math.max(0, scaleMultiplier);
      }
    }

    // 3. Rise Animation (floats upward steadily from bottom to top)
    if (this.animations.has('rise')) {
      posY += this.riseSpeed * this.elapsedTime;
    }

    // 4. Drop Animation (slow fall for gaan)
    if (this.animations.has('drop')) {
      const dropSpeed = this.preset.dropSpeed ?? 0.09;
      posY -= dropSpeed * this.elapsedTime;
    }

    // 5. Shake Animation (jitter for wanawana / iraira / biku)
    if (this.animations.has('shake')) {
      const shakeCfg = this.preset.shakeIntensity ?? { position: 0.012, rotation: 0.08, frequency: 12 };
      const freq = (shakeCfg.frequency ?? 12) * Math.PI * 2;
      const pAmp = shakeCfg.position ?? 0.012;
      const rAmp = shakeCfg.rotation ?? 0.08;

      const t = this.elapsedTime * freq;
      posX += Math.sin(t) * pAmp;
      posY += Math.cos(t * 1.25) * pAmp * 0.6;
      rot += Math.sin(t * 0.9) * rAmp;
    }

    // 6. Float Animation (gentle up/down bobbing)
    if (this.animations.has('float')) {
      const floatCfg = this.preset.floatParams ?? { speed: 2.5, height: 0.04 };
      const fSpeed = floatCfg.speed ?? 2.5;
      const fHeight = floatCfg.height ?? 0.04;
      posY += Math.sin(this.elapsedTime * fSpeed) * fHeight;
    }

    // 7. SpinSmall Animation (gentle rotational tilt)
    if (this.animations.has('spinSmall')) {
      rot += Math.sin(this.elapsedTime * 4.0) * 0.12;
    }

    // 8. Pulse Animation (heartbeat scaling)
    if (this.animations.has('pulse')) {
      scaleMultiplier *= 1.0 + Math.sin(this.elapsedTime * 8.0) * 0.12;
    }

    // 9. FadeOut Animation (smooth decay near end of lifetime)
    if (this.animations.has('fadeOut')) {
      const fadeStart = 0.55;
      if (progress > fadeStart) {
        const fadeP = (progress - fadeStart) / (1 - fadeStart);
        opacity = 1.0 - THREE.MathUtils.smoothstep(fadeP, 0, 1);
      }
    }

    // Apply values to Sprite
    this.sprite.position.set(posX, posY, posZ);

    const finalScaleY = this.baseScale * scaleMultiplier;
    const finalScaleX = finalScaleY * this.aspect;
    this.sprite.scale.set(finalScaleX, finalScaleY, 1);

    this.material.opacity = opacity;
    this.material.rotation = rot;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.isAlive = false;
    if (this.sprite.parent) {
      this.sprite.parent.remove(this.sprite);
    }
    this.material.dispose();
  }
}
