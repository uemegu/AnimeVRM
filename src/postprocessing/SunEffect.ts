import * as THREE from 'three';
import type { AvatarConfig, SunShaftsConfig, LensFlareConfig } from '../Config';

/**
 * Procedural texture helpers for anime-style lens flare & sun glow
 */
function createSunGlowTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.1, 'rgba(255, 250, 230, 0.95)');
  grad.addColorStop(0.3, 'rgba(255, 220, 150, 0.6)');
  grad.addColorStop(0.6, 'rgba(255, 180, 80, 0.15)');
  grad.addColorStop(1.0, 'rgba(255, 150, 50, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStarburstTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;

  // Star points (6-axis anime starburst)
  const numSpikes = 6;
  ctx.save();
  ctx.translate(center, center);

  for (let i = 0; i < numSpikes; i++) {
    ctx.rotate((Math.PI * 2) / numSpikes);

    const rayGrad = ctx.createLinearGradient(0, 0, center, 0);
    rayGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.9)');
    rayGrad.addColorStop(0.2, 'rgba(255, 245, 200, 0.6)');
    rayGrad.addColorStop(0.7, 'rgba(255, 200, 100, 0.15)');
    rayGrad.addColorStop(1.0, 'rgba(255, 180, 50, 0.0)');

    ctx.fillStyle = rayGrad;

    // Draw needle ray
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(center * 0.95, 0);
    ctx.lineTo(0, 3);
    ctx.closePath();
    ctx.fill();

    // Opposite side needle
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(-center * 0.95, 0);
    ctx.lineTo(0, 3);
    ctx.closePath();
    ctx.fill();
  }

  // Soft center core
  const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, center * 0.35);
  coreGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  coreGrad.addColorStop(0.4, 'rgba(255, 235, 180, 0.6)');
  coreGrad.addColorStop(1.0, 'rgba(255, 200, 100, 0.0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, center * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createAnamorphicStreakTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const cx = width / 2;
  const cy = height / 2;

  // Horizontal gradient (sharp drop vertically, wide horizontally)
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, width / 2);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.15, 'rgba(200, 230, 255, 0.7)');
  grad.addColorStop(0.5, 'rgba(160, 200, 255, 0.3)');
  grad.addColorStop(1.0, 'rgba(100, 160, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createHaloTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;
  const radius = size * 0.38;

  // Thin luminous ring with chromatic rainbow fringe
  const grad = ctx.createRadialGradient(center, center, radius - 20, center, center, radius + 20);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
  grad.addColorStop(0.3, 'rgba(255, 180, 150, 0.25)');
  grad.addColorStop(0.5, 'rgba(255, 240, 200, 0.55)');
  grad.addColorStop(0.7, 'rgba(160, 220, 255, 0.35)');
  grad.addColorStop(1.0, 'rgba(120, 180, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGhostTexture(isHexagon = false): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;
  const r = size * 0.42;

  if (isHexagon) {
    ctx.save();
    ctx.translate(center, center);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0.0, 'rgba(255, 240, 200, 0.1)');
    grad.addColorStop(0.7, 'rgba(200, 230, 255, 0.35)');
    grad.addColorStop(0.95, 'rgba(160, 200, 255, 0.6)');
    grad.addColorStop(1.0, 'rgba(120, 180, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  } else {
    const grad = ctx.createRadialGradient(center, center, 0, center, center, r);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.5)');
    grad.addColorStop(0.6, 'rgba(255, 220, 180, 0.3)');
    grad.addColorStop(0.9, 'rgba(180, 210, 255, 0.4)');
    grad.addColorStop(1.0, 'rgba(150, 180, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface GhostElement {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  posOffset: number; // Position along screen-center ray (-1.0 to 1.5)
  baseScale: number;
  baseOpacity: number;
}

/**
 * Sun & Lens Flare Effect Controller
 */
export class SunEffect {
  public scene: THREE.Scene;
  public sunGroup: THREE.Group;
  public flareGroup: THREE.Group;

  // Billboard Sprites
  private sunCoronaSprite: THREE.Sprite;
  private sunCoronaMat: THREE.SpriteMaterial;

  private starburstSprite: THREE.Sprite;
  private starburstMat: THREE.SpriteMaterial;

  private streakSprite: THREE.Sprite;
  private streakMat: THREE.SpriteMaterial;

  private haloSprite: THREE.Sprite;
  private haloMat: THREE.SpriteMaterial;

  private ghosts: GhostElement[] = [];

  // Occlusion & Screen states
  public sunWorldPosition: THREE.Vector3 = new THREE.Vector3();
  public sunScreenPosition: THREE.Vector2 = new THREE.Vector2(0.5, 0.5);
  public sunVisibility: number = 1.0;
  private currentOcclusion: number = 0.0;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.sunGroup = new THREE.Group();
    this.sunGroup.name = 'SunEffectGroup';
    this.flareGroup = new THREE.Group();
    this.flareGroup.name = 'LensFlareGroup';

    // 1. Sun Corona / Core
    const glowTex = createSunGlowTexture();
    this.sunCoronaMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xfff5eb,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.sunCoronaSprite = new THREE.Sprite(this.sunCoronaMat);
    this.sunCoronaSprite.renderOrder = 9990;
    this.sunCoronaSprite.scale.set(6, 6, 1);
    this.sunGroup.add(this.sunCoronaSprite);

    // 2. Starburst (6-point sparkle)
    const burstTex = createStarburstTexture();
    this.starburstMat = new THREE.SpriteMaterial({
      map: burstTex,
      color: 0xfff0dd,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.starburstSprite = new THREE.Sprite(this.starburstMat);
    this.starburstSprite.renderOrder = 9991;
    this.starburstSprite.scale.set(9, 9, 1);
    this.sunGroup.add(this.starburstSprite);

    // 3. Anamorphic Horizontal Streak
    const streakTex = createAnamorphicStreakTexture();
    this.streakMat = new THREE.SpriteMaterial({
      map: streakTex,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.streakSprite = new THREE.Sprite(this.streakMat);
    this.streakSprite.renderOrder = 9992;
    this.streakSprite.scale.set(24, 2.0, 1);
    this.sunGroup.add(this.streakSprite);

    // 4. Ring Halo
    const haloTex = createHaloTexture();
    this.haloMat = new THREE.SpriteMaterial({
      map: haloTex,
      color: 0xfff2e0,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.haloSprite = new THREE.Sprite(this.haloMat);
    this.haloSprite.renderOrder = 9995;
    this.haloSprite.scale.set(8, 8, 1);
    this.flareGroup.add(this.haloSprite);

    // 5. Lens Flare Ghost Orbs & Hexagons along axis
    const circleGhostTex = createGhostTexture(false);
    const hexGhostTex = createGhostTexture(true);

    const ghostSpecs = [
      { tex: hexGhostTex, offset: 0.6, scale: 2.2, opacity: 0.35, color: 0x90d5ff },
      { tex: circleGhostTex, offset: 0.35, scale: 1.4, opacity: 0.45, color: 0xffd188 },
      { tex: hexGhostTex, offset: 0.15, scale: 0.8, opacity: 0.3, color: 0xafffc0 },
      { tex: circleGhostTex, offset: -0.2, scale: 1.8, opacity: 0.25, color: 0xffa0b0 },
      { tex: hexGhostTex, offset: -0.45, scale: 3.0, opacity: 0.2, color: 0x70b8ff },
      { tex: circleGhostTex, offset: -0.7, scale: 1.2, opacity: 0.3, color: 0xffd990 },
    ];

    for (const spec of ghostSpecs) {
      const mat = new THREE.SpriteMaterial({
        map: spec.tex,
        color: spec.color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 9996;
      sprite.scale.set(spec.scale, spec.scale, 1);
      this.flareGroup.add(sprite);
      this.ghosts.push({
        sprite,
        material: mat,
        posOffset: spec.offset,
        baseScale: spec.scale,
        baseOpacity: spec.opacity,
      });
    }

    this.scene.add(this.sunGroup);
    this.scene.add(this.flareGroup);
  }

  /**
   * Update Sun Position, Screen Coordinates, and Occlusion Raycasting
   */
  public update(
    camera: THREE.Camera,
    delta: number,
    elapsed: number,
    config: AvatarConfig,
    dirLight: THREE.DirectionalLight,
    vrmMeshes?: THREE.Object3D[]
  ): {
    sunScreenPosition: THREE.Vector2;
    sunVisibility: number;
    sunWorldPosition: THREE.Vector3;
  } {
    const sunCfg = config.lighting.sunShafts;
    const flareCfg = config.lighting.lensFlare;

    const isEffectActive = sunCfg.enabled || flareCfg.enabled;

    if (!isEffectActive) {
      this.sunGroup.visible = false;
      this.flareGroup.visible = false;
      this.sunVisibility = 0;
      return {
        sunScreenPosition: this.sunScreenPosition,
        sunVisibility: 0,
        sunWorldPosition: this.sunWorldPosition,
      };
    }

    // 1. Determine Sun World Position
    if (sunCfg.followDirectionalLight) {
      const dir = dirLight.position.clone().normalize();
      this.sunWorldPosition.copy(dir.multiplyScalar(8.0));
    } else {
      this.sunWorldPosition.set(
        sunCfg.sunPosition.x,
        sunCfg.sunPosition.y,
        sunCfg.sunPosition.z
      );
    }

    this.sunGroup.position.copy(this.sunWorldPosition);

    // 2. Camera Orientation & Screen projection
    const camForward = new THREE.Vector3();
    camera.getWorldDirection(camForward);
    const toSun = this.sunWorldPosition.clone().sub(camera.position).normalize();
    const forwardDot = camForward.dot(toSun);
    const inFront = forwardDot > 0.02; // Sun is in front of camera

    this.sunGroup.visible = (sunCfg.enabled || flareCfg.enabled) && inFront;
    this.flareGroup.visible = flareCfg.enabled && inFront;

    // Project Sun to Normalized Device Coordinates (NDC)
    const ndc = this.sunWorldPosition.clone().project(camera);
    const screenX = (ndc.x + 1) * 0.5;
    const screenY = (ndc.y + 1) * 0.5;
    this.sunScreenPosition.set(screenX, screenY);

    // Viewport edge falloff
    let edgeFactor = 0.0;
    if (inFront) {
      const distFromCenter = Math.sqrt(ndc.x * ndc.x + ndc.y * ndc.y);
      edgeFactor = Math.max(0.0, Math.min(1.0, (2.8 - distFromCenter) / 1.8));
    }

    // 3. Occlusion Raycast check (smooth transition)
    let targetOcclusion = 0.0;
    if (inFront && edgeFactor > 0.01 && vrmMeshes && vrmMeshes.length > 0) {
      const camPos = camera.position.clone();
      const rayDir = this.sunWorldPosition.clone().sub(camPos).normalize();
      const distToSun = this.sunWorldPosition.distanceTo(camPos);
      this.raycaster.camera = camera;
      this.raycaster.set(camPos, rayDir);
      this.raycaster.far = distToSun;

      // Only check solid 3D meshes (exclude 2D sprites like sweat marks or effect texts)
      const solidMeshes: THREE.Object3D[] = [];
      for (const root of vrmMeshes) {
        root.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && !(child as any).isSprite) {
            solidMeshes.push(child);
          }
        });
      }

      const intersects = this.raycaster.intersectObjects(solidMeshes, false);
      if (intersects.length > 0) {
        // Occluded by character
        targetOcclusion = 0.7; // Keep 30% backlight rim
      }
    }

    // Smooth damp occlusion factor
    this.currentOcclusion = THREE.MathUtils.damp(
      this.currentOcclusion,
      targetOcclusion,
      12.0,
      delta
    );

    this.sunVisibility = inFront ? edgeFactor * (1.0 - this.currentOcclusion) : 0.0;

    // 4. Update Sun Billboard Sprites & Materials
    const sunColor = new THREE.Color(flareCfg.sunColor);
    const sunScale = flareCfg.sunSize;

    this.sunCoronaMat.color.copy(sunColor);
    this.sunCoronaMat.opacity = flareCfg.glowIntensity * (0.7 + 0.3 * this.sunVisibility);
    this.sunCoronaSprite.scale.set(3.8 * sunScale, 3.8 * sunScale, 1);

    this.starburstMat.color.copy(sunColor);
    this.starburstMat.opacity = flareCfg.starburstIntensity * this.sunVisibility;
    this.starburstSprite.scale.set(5.5 * sunScale, 5.5 * sunScale, 1);
    this.starburstSprite.material.rotation = elapsed * 0.04;

    this.streakMat.color.copy(sunColor);
    this.streakMat.opacity = flareCfg.anamorphicIntensity * this.sunVisibility;
    this.streakSprite.scale.set(16 * sunScale, 1.4 * sunScale, 1);

    // 5. Position & Scale Lens Flare Ghosts and Halo along optical axis
    if (flareCfg.enabled && inFront && this.sunVisibility > 0.01) {
      // Place ghost billboards in front of camera
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      const camPos = camera.position;
      const baseDist = 1.6;

      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

      const sunOffsetX = ndc.x;
      const sunOffsetY = ndc.y;

      // Update Halo ring
      const haloDist = baseDist * 0.85;
      const haloCenter = camPos.clone()
        .addScaledVector(forward, haloDist)
        .addScaledVector(right, sunOffsetX * 0.3)
        .addScaledVector(up, sunOffsetY * 0.3);
      this.haloSprite.position.copy(haloCenter);
      this.haloSprite.quaternion.copy(camera.quaternion);
      this.haloMat.opacity = flareCfg.haloIntensity * this.sunVisibility * 0.85;
      this.haloSprite.scale.set(2.2 * sunScale, 2.2 * sunScale, 1);

      // Update Ghosts
      for (const ghost of this.ghosts) {
        const gPos = camPos.clone()
          .addScaledVector(forward, baseDist)
          .addScaledVector(right, -sunOffsetX * ghost.posOffset * 0.65)
          .addScaledVector(up, -sunOffsetY * ghost.posOffset * 0.65);

        ghost.sprite.position.copy(gPos);
        ghost.sprite.quaternion.copy(camera.quaternion);
        ghost.material.opacity = ghost.baseOpacity * flareCfg.ghostIntensity * this.sunVisibility;
        const gScale = ghost.baseScale * 0.3 * sunScale;
        ghost.sprite.scale.set(gScale, gScale, 1);
      }
    } else {
      this.haloMat.opacity = 0;
      for (const ghost of this.ghosts) {
        ghost.material.opacity = 0;
      }
    }

    return {
      sunScreenPosition: this.sunScreenPosition,
      sunVisibility: this.sunVisibility,
      sunWorldPosition: this.sunWorldPosition,
    };
  }

  public dispose(): void {
    this.scene.remove(this.sunGroup);
    this.scene.remove(this.flareGroup);
    this.sunCoronaMat.dispose();
    this.starburstMat.dispose();
    this.streakMat.dispose();
    this.haloMat.dispose();
    for (const g of this.ghosts) {
      g.material.dispose();
    }
  }
}
