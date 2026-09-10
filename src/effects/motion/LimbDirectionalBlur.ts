import * as THREE from 'three';
import { FastMotionConfig, LimbType } from './types';
import { LimbProxyGeometry } from './LimbProxyGeometry';

const BLUR_SUBDIVISIONS = 8;
const TOTAL_VERTS = (BLUR_SUBDIVISIONS + 1) * 2;
const TOTAL_INDICES = BLUR_SUBDIVISIONS * 6;

const MASK_VERTEX_SHADER = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MASK_FRAGMENT_SHADER = /* glsl */ `
  void main() {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
  }
`;

const BLUR_OUTLINE_VERTEX_SHADER = /* glsl */ `
  attribute vec2 aScreenVel;
  varying vec2 vScreenUv;
  varying vec2 vScreenVel;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vScreenVel = aScreenVel;
    vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vScreenUv = (clipPos.xy / clipPos.w) * 0.5 + 0.5;
    gl_Position = clipPos;
  }
`;

const BLUR_OUTLINE_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uMaskTexture;
  uniform vec3 uColor;
  uniform vec3 uAccentColor;
  uniform float uIntensity;
  uniform float uBlurDistance;
  uniform int uSamples;

  varying vec2 vScreenUv;
  varying vec2 vScreenVel;
  varying vec2 vUv;

  void main() {
    if (uIntensity <= 0.005) discard;

    float speedLen = length(vScreenVel);
    if (speedLen < 0.001) discard;

    // Direction opposite to motion in screen space
    vec2 trailDir = -normalize(vScreenVel);

    // Directional trailing sampling along negative velocity
    float accumTrail = 0.0;
    float totalWeight = 0.0;
    float maxDist = uBlurDistance * clamp(speedLen * 4.0, 0.25, 1.0);

    for (int i = 0; i < 12; i++) {
      if (i >= uSamples) break;
      float t = float(i) / float(uSamples);
      vec2 sampleUv = vScreenUv + trailDir * (t * maxDist);

      // Clamp UV to valid screen range
      sampleUv = clamp(sampleUv, vec2(0.001), vec2(0.999));
      float maskVal = texture2D(uMaskTexture, sampleUv).r;

      // Leading edge is sharp, trailing edge softly decays
      float weight = pow(1.0 - t, 1.35);
      accumTrail += maskVal * weight;
      totalWeight += weight;
    }

    float blurredMask = totalWeight > 0.0 ? accumTrail / totalWeight : 0.0;
    float directMask = texture2D(uMaskTexture, clamp(vScreenUv, vec2(0.001), vec2(0.999))).r;

    // Outline extraction: keep trailing trail and outline, soften current arm interior
    float outlineAlpha = clamp(blurredMask * 1.5 - directMask * 0.65, 0.0, 1.0);
    outlineAlpha *= pow(uIntensity, 0.65);

    if (outlineAlpha <= 0.01) discard;

    // Stylized anime color gradient (accent edge to luminous core)
    vec3 outColor = mix(uAccentColor, uColor, pow(blurredMask, 0.8));

    gl_FragColor = vec4(outColor, outlineAlpha * 0.72);
  }
`;

interface BlurMeshSlot {
  proxy: LimbProxyGeometry;
  mesh: THREE.Mesh;
  screenVelAttribute: THREE.BufferAttribute;
  screenVelocities: Float32Array;
}

export class LimbDirectionalBlur {
  private config: FastMotionConfig;
  private renderTarget: THREE.WebGLRenderTarget;
  private maskScene: THREE.Scene;
  private maskMaterial: THREE.ShaderMaterial;
  private blurMaterial: THREE.ShaderMaterial;
  private compositeGroup: THREE.Group;

  // Mask proxy meshes (rendered to offscreen RenderTarget)
  private maskProxies: Map<LimbType, LimbProxyGeometry> = new Map();
  private maskMeshes: Map<LimbType, THREE.Mesh> = new Map();

  // Dilated outline blur meshes (rendered in main scene behind character arm)
  private blurSlots: Map<LimbType, BlurMeshSlot> = new Map();

  // Scratch vectors to prevent GC allocations
  private _projA = new THREE.Vector3();
  private _projB = new THREE.Vector3();
  private _rootScreenVel = new THREE.Vector2();
  private _midScreenVel = new THREE.Vector2();
  private _tipScreenVel = new THREE.Vector2();
  private _ankleScratch = new THREE.Vector3();
  private _footEndScratch = new THREE.Vector3();
  private _tangentLeg = new THREE.Vector3();

  constructor(config: FastMotionConfig) {
    this.config = config;

    // Dedicated low-resolution RenderTarget (512x512 is sharp yet lightweight)
    this.renderTarget = new THREE.WebGLRenderTarget(512, 512, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });

    this.maskScene = new THREE.Scene();

    this.maskMaterial = new THREE.ShaderMaterial({
      vertexShader: MASK_VERTEX_SHADER,
      fragmentShader: MASK_FRAGMENT_SHADER,
      depthTest: true,
      depthWrite: true,
    });

    this.blurMaterial = new THREE.ShaderMaterial({
      vertexShader: BLUR_OUTLINE_VERTEX_SHADER,
      fragmentShader: BLUR_OUTLINE_FRAGMENT_SHADER,
      uniforms: {
        uMaskTexture: { value: this.renderTarget.texture },
        uColor: { value: new THREE.Color(config.effectColor) },
        uAccentColor: { value: new THREE.Color(config.accentColor) },
        uIntensity: { value: 0.0 },
        uBlurDistance: { value: config.blurMaxDistance },
        uSamples: { value: config.blurSamples },
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });

    this.compositeGroup = new THREE.Group();
    this.compositeGroup.name = 'LimbDirectionalBlur';

    this.initMeshes();
  }

  private initMeshes(): void {
    const limbTypes: LimbType[] = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

    for (const limb of limbTypes) {
      // 1. Offscreen Mask Mesh
      const maskProxy = new LimbProxyGeometry(limb);
      const maskMesh = new THREE.Mesh(maskProxy.geometry, this.maskMaterial);
      maskMesh.frustumCulled = false;
      this.maskScene.add(maskMesh);
      this.maskProxies.set(limb, maskProxy);
      this.maskMeshes.set(limb, maskMesh);

      // 2. Main Scene Dilated Blur Outline Mesh
      const blurProxy = new LimbProxyGeometry(limb);
      const screenVelocities = new Float32Array(TOTAL_VERTS * 2);
      const screenVelAttr = new THREE.BufferAttribute(screenVelocities, 2);
      blurProxy.geometry.setAttribute('aScreenVel', screenVelAttr);

      const blurMesh = new THREE.Mesh(blurProxy.geometry, this.blurMaterial);
      blurMesh.frustumCulled = false;
      // Render behind character's arm (renderOrder = 0)
      blurMesh.renderOrder = 0;
      this.compositeGroup.add(blurMesh);

      this.blurSlots.set(limb, {
        proxy: blurProxy,
        mesh: blurMesh,
        screenVelAttribute: screenVelAttr,
        screenVelocities,
      });
    }
  }

  public getRootObject(): THREE.Group {
    return this.compositeGroup;
  }

  public updateConfig(config: FastMotionConfig): void {
    this.config = config;
    this.blurMaterial.uniforms.uColor.value.set(config.effectColor);
    this.blurMaterial.uniforms.uAccentColor.value.set(config.accentColor);
    this.blurMaterial.uniforms.uBlurDistance.value = config.blurMaxDistance;
    this.blurMaterial.uniforms.uSamples.value = config.blurSamples;
  }

  /**
   * Prepares and updates geometries for each limb before offscreen rendering.
   */
  public updateLimbGeometry(
    limb: LimbType,
    rootPos: THREE.Vector3,
    midPos: THREE.Vector3,
    tipPos: THREE.Vector3,
    rootVel: THREE.Vector3,
    midVel: THREE.Vector3,
    tipVel: THREE.Vector3,
    intensity: number,
    camera: THREE.Camera
  ): void {
    const maskProxy = this.maskProxies.get(limb);
    const maskMesh = this.maskMeshes.get(limb);
    const blurSlot = this.blurSlots.get(limb);

    if (!maskProxy || !maskMesh || !blurSlot) return;

    if (!this.config.enabled || !this.config.directionalBlurEnabled || intensity <= 0.03) {
      maskProxy.hide();
      maskMesh.visible = false;
      blurSlot.proxy.hide();
      blurSlot.mesh.visible = false;
      return;
    }

    maskMesh.visible = true;
    blurSlot.mesh.visible = true;

    // For legs, exclude thigh (upperLeg) and shin (lowerLeg) from blur.
    // Concentrate exclusively around ankle and foot.
    const isLeg = limb === 'leftLeg' || limb === 'rightLeg';
    let effRootPos = rootPos;
    let effMidPos = midPos;
    let effTipPos = tipPos;
    let effRootVel = rootVel;
    let effMidVel = midVel;
    let effTipVel = tipVel;

    if (isLeg) {
      // Ankle position: 88% down the lowerLeg towards the foot
      this._ankleScratch.lerpVectors(midPos, tipPos, 0.88);
      effRootPos = this._ankleScratch;
      effMidPos = tipPos;
      this._tangentLeg.subVectors(tipPos, midPos).normalize();
      this._footEndScratch.copy(tipPos).addScaledVector(this._tangentLeg, 0.10);
      effTipPos = this._footEndScratch;

      effRootVel = tipVel;
      effMidVel = tipVel;
      effTipVel = tipVel;
    }

    // 1. Update mask proxy at actual limb position (scale 1.0)
    maskProxy.update(effRootPos, effMidPos, effTipPos, camera, 1.0, undefined, { ankleOnly: isLeg });

    // 2. Compute screen-space velocity vectors for root, mid, and tip
    this.calcScreenVelocity(effRootPos, effRootVel, camera, this._rootScreenVel);
    this.calcScreenVelocity(effMidPos, effMidVel, camera, this._midScreenVel);
    this.calcScreenVelocity(effTipPos, effTipVel, camera, this._tipScreenVel);

    // 3. Update dilated blur proxy mesh (scale 1.8x to catch directional trailing blur)
    blurSlot.proxy.update(effRootPos, effMidPos, effTipPos, camera, 1.8, undefined, { ankleOnly: isLeg });

    // 4. Fill interpolated screen velocities along the limb proxy vertices
    const velArray = blurSlot.screenVelocities;
    let vIdx = 0;
    for (let i = 0; i <= BLUR_SUBDIVISIONS; i++) {
      const t = i / BLUR_SUBDIVISIONS; // 0 to 1

      // Interpolate between root -> mid -> tip
      let vx = 0;
      let vy = 0;
      if (t <= 0.5) {
        const u = t * 2.0;
        vx = THREE.MathUtils.lerp(this._rootScreenVel.x, this._midScreenVel.x, u);
        vy = THREE.MathUtils.lerp(this._rootScreenVel.y, this._midScreenVel.y, u);
      } else {
        const u = (t - 0.5) * 2.0;
        vx = THREE.MathUtils.lerp(this._midScreenVel.x, this._tipScreenVel.x, u);
        vy = THREE.MathUtils.lerp(this._midScreenVel.y, this._tipScreenVel.y, u);
      }

      // Left vertex
      velArray[vIdx++] = vx;
      velArray[vIdx++] = vy;
      // Right vertex
      velArray[vIdx++] = vx;
      velArray[vIdx++] = vy;
    }

    blurSlot.screenVelAttribute.needsUpdate = true;
  }

  private calcScreenVelocity(
    worldPos: THREE.Vector3,
    worldVel: THREE.Vector3,
    camera: THREE.Camera,
    targetScreenVel: THREE.Vector2
  ): void {
    // Project worldPos to NDC
    this._projA.copy(worldPos).project(camera);
    // Project displaced point to NDC
    this._projB.copy(worldPos).addScaledVector(worldVel, 0.05).project(camera);

    targetScreenVel.set(
      (this._projB.x - this._projA.x) * 0.5,
      (this._projB.y - this._projA.y) * 0.5
    );
  }

  /**
   * Renders the proxy mask to offscreen low-res RenderTarget.
   */
  public renderMask(renderer: THREE.WebGLRenderer, camera: THREE.Camera, maxIntensity: number): void {
    if (!this.config.enabled || !this.config.directionalBlurEnabled || maxIntensity <= 0.03) {
      return;
    }

    const prevTarget = renderer.getRenderTarget();
    const prevClearColor = renderer.getClearColor(new THREE.Color());
    const prevClearAlpha = renderer.getClearAlpha();

    renderer.setRenderTarget(this.renderTarget);
    renderer.setClearColor(0x000000, 0.0);
    renderer.clear();

    renderer.render(this.maskScene, camera);

    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClearColor, prevClearAlpha);

    this.blurMaterial.uniforms.uIntensity.value = maxIntensity;
    this.blurMaterial.uniforms.uMaskTexture.value = this.renderTarget.texture;
  }

  public hideAll(): void {
    for (const p of this.maskProxies.values()) p.hide();
    for (const m of this.maskMeshes.values()) m.visible = false;
    for (const b of this.blurSlots.values()) {
      b.proxy.hide();
      b.mesh.visible = false;
    }
  }

  public dispose(): void {
    this.hideAll();
    this.renderTarget.dispose();
    this.maskMaterial.dispose();
    this.blurMaterial.dispose();

    for (const p of this.maskProxies.values()) p.dispose();
    for (const b of this.blurSlots.values()) b.proxy.dispose();

    this.maskProxies.clear();
    this.maskMeshes.clear();
    this.blurSlots.clear();
  }
}
