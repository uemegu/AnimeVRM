import * as THREE from 'three';
import { FastMotionConfig, LimbType, LimbHistorySample } from './types';
import { LimbProxyGeometry } from './LimbProxyGeometry';

const MAX_AFTERIMAGES = 3;

const AFTERIMAGE_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const AFTERIMAGE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uSaturation;
  varying vec2 vUv;

  void main() {
    if (uOpacity <= 0.005) discard;

    // Anime silhouette shading: soft fill with defined anime edge lines
    float edgeDist = abs(vUv.x - 0.5) * 2.0; // 0 at center, 1 at edge
    float edgeOutline = smoothstep(0.72, 0.98, edgeDist);
    float centerFill = 0.45 + 0.55 * (1.0 - pow(edgeDist, 1.5));

    // Desaturation calculation (older afterimages become paler/monochrome)
    float luma = dot(uColor, vec3(0.299, 0.587, 0.114));
    vec3 desatColor = mix(vec3(luma), uColor, uSaturation);

    // Edge gets slightly brighter outline
    vec3 finalColor = mix(desatColor, vec3(1.0), edgeOutline * 0.4);
    float finalAlpha = uOpacity * (centerFill * 0.6 + edgeOutline * 0.4);

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

interface AfterimageSlot {
  proxy: LimbProxyGeometry;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
}

export class LimbAfterimageRenderer {
  private group: THREE.Group;
  private config: FastMotionConfig;

  // Limb -> array of AfterimageSlots
  private slotsByLimb: Map<LimbType, AfterimageSlot[]> = new Map();

  // Temporary vectors for interpolation and offset
  private _interpRoot = new THREE.Vector3();
  private _interpMid = new THREE.Vector3();
  private _interpTip = new THREE.Vector3();
  private _offsetVec = new THREE.Vector3();
  private _avgVel = new THREE.Vector3();

  constructor(config: FastMotionConfig) {
    this.config = config;
    this.group = new THREE.Group();
    this.group.name = 'LimbAfterimages';

    this.initSlots();
  }

  private initSlots(): void {
    const limbTypes: LimbType[] = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

    for (const limb of limbTypes) {
      const slots: AfterimageSlot[] = [];

      for (let k = 0; k < MAX_AFTERIMAGES; k++) {
        const proxy = new LimbProxyGeometry(limb);
        const material = new THREE.ShaderMaterial({
          vertexShader: AFTERIMAGE_VERTEX_SHADER,
          fragmentShader: AFTERIMAGE_FRAGMENT_SHADER,
          uniforms: {
            uColor: { value: new THREE.Color(this.config.accentColor) },
            uOpacity: { value: 0.0 },
            uSaturation: { value: 1.0 },
          },
          transparent: true,
          depthTest: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.NormalBlending,
        });

        const mesh = new THREE.Mesh(proxy.geometry, material);
        mesh.frustumCulled = false;
        // Render behind the main character meshes (renderOrder = 0)
        mesh.renderOrder = 0;
        this.group.add(mesh);

        slots.push({ proxy, material, mesh });
      }

      this.slotsByLimb.set(limb, slots);
    }
  }

  public getRootObject(): THREE.Group {
    return this.group;
  }

  public updateConfig(config: FastMotionConfig): void {
    this.config = config;
  }

  public update(
    limb: LimbType,
    history: LimbHistorySample[],
    intensity: number,
    currentTime: number,
    camera: THREE.Camera
  ): void {
    const slots = this.slotsByLimb.get(limb);
    if (!slots) return;

    if (!this.config.enabled || !this.config.afterimagesEnabled || intensity <= 0.03 || history.length < 2) {
      for (const slot of slots) {
        slot.proxy.hide();
        slot.mesh.visible = false;
      }
      return;
    }

    const count = Math.min(this.config.afterimageCount, MAX_AFTERIMAGES);
    const interval = this.config.afterimageInterval;

    for (let k = 0; k < MAX_AFTERIMAGES; k++) {
      const slot = slots[k];
      if (k >= count) {
        slot.proxy.hide();
        slot.mesh.visible = false;
        continue;
      }

      // Past target time
      const targetTime = currentTime - (k + 1) * interval;
      const interpolated = this.sampleHistoryAtTime(history, targetTime);
      if (!interpolated) {
        slot.proxy.hide();
        slot.mesh.visible = false;
        continue;
      }

      // Older afterimages: lower opacity, lower saturation, thinner stroke width
      const ageFactor = (k + 1) / (count + 1); // 0.25, 0.5, 0.75
      const opacity = this.config.afterimageOpacity * intensity * Math.pow(1.0 - ageFactor * 0.7, 1.2);
      const saturation = Math.max(0.2, 1.0 - ageFactor * 0.85);
      const radiusScale = Math.max(0.65, 1.0 - ageFactor * 0.35);

      // Backwards offset opposite to velocity direction
      const backwardShift = 0.015 * (k + 1);
      this._offsetVec.copy(this._avgVel).normalize().multiplyScalar(-backwardShift);

      slot.proxy.update(
        this._interpRoot,
        this._interpMid,
        this._interpTip,
        camera,
        radiusScale,
        this._offsetVec
      );

      slot.material.uniforms.uColor.value.set(this.config.accentColor);
      slot.material.uniforms.uOpacity.value = opacity;
      slot.material.uniforms.uSaturation.value = saturation;
      slot.mesh.visible = opacity > 0.005;
    }
  }

  private sampleHistoryAtTime(
    history: LimbHistorySample[],
    targetTime: number
  ): boolean {
    if (history.length === 0) return false;

    // History is ordered chronologically from oldest (0) to newest (length-1)
    const oldest = history[0];
    const newest = history[history.length - 1];

    if (targetTime < oldest.time || targetTime > newest.time) {
      return false;
    }

    // Binary search or linear search for adjacent time samples
    let idxA = 0;
    for (let i = 0; i < history.length - 1; i++) {
      if (history[i].time <= targetTime && history[i + 1].time >= targetTime) {
        idxA = i;
        break;
      }
    }
    const idxB = idxA + 1;
    const sA = history[idxA];
    const sB = history[idxB];

    const timeSpan = sB.time - sA.time;
    const frac = timeSpan > 0.00001 ? (targetTime - sA.time) / timeSpan : 0.0;

    this._interpRoot.lerpVectors(sA.rootPos, sB.rootPos, frac);
    this._interpMid.lerpVectors(sA.midPos, sB.midPos, frac);
    this._interpTip.lerpVectors(sA.tipPos, sB.tipPos, frac);
    this._avgVel.lerpVectors(sA.relativeTipVel, sB.relativeTipVel, frac);

    return true;
  }

  public hideAll(): void {
    for (const slots of this.slotsByLimb.values()) {
      for (const slot of slots) {
        slot.proxy.hide();
        slot.mesh.visible = false;
      }
    }
  }

  public dispose(): void {
    this.hideAll();
    for (const slots of this.slotsByLimb.values()) {
      for (const slot of slots) {
        slot.proxy.dispose();
        slot.material.dispose();
        if (slot.mesh.parent) {
          slot.mesh.parent.remove(slot.mesh);
        }
      }
    }
    this.slotsByLimb.clear();
  }
}
