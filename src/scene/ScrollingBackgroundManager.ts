import * as THREE from 'three';
import { resolveAssetUrl } from '../utils/path';

const ScrollingBlurShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uBlurAmount: { value: 0.0 }, // 0.0 (sharp) - 1.0 (strong anime blur)
    uOpacity: { value: 1.0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uZoomScale: { value: 1.0 },
    uPanOffset: { value: new THREE.Vector2(0, 0) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uBlurAmount;
    uniform float uOpacity;
    uniform vec3 uTint;
    uniform float uZoomScale;
    uniform vec2 uPanOffset;
    varying vec2 vUv;

    // High frequency pseudo-random hash for frosted glass micro-facet roughness
    float hash21(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      // Dynamic camera parallax & zoom transform (matches other scenario scene.background)
      vec2 baseUv = (vUv - 0.5) / max(1.0, uZoomScale) + 0.5 - uPanOffset;

      if (uBlurAmount <= 0.002) {
        vec4 col = texture2D(tDiffuse, baseUv);
        gl_FragColor = vec4(col.rgb * uTint, col.a * uOpacity);
        return;
      }

      // Frosted Glass Effect (すりガラス調・散乱と微細ノイズテクスチャ)
      // 1. Calculate frosted micro-jitter
      float noise = (hash21(gl_FragCoord.xy) - 0.5) * 2.0;
      float baseRadius = uBlurAmount * 0.012;

      // 2. 16-tap Poisson-disk distributed samples with frosted jitter
      vec4 sum = vec4(0.0);
      float totalWeight = 0.0;

      // 16 sampling points
      vec2 taps[16];
      taps[0]  = vec2( 0.0,      0.0);
      taps[1]  = vec2( 0.28,     0.15);
      taps[2]  = vec2(-0.25,     0.32);
      taps[3]  = vec2( 0.35,    -0.28);
      taps[4]  = vec2(-0.38,    -0.18);
      taps[5]  = vec2( 0.58,     0.42);
      taps[6]  = vec2(-0.62,     0.38);
      taps[7]  = vec2( 0.45,    -0.58);
      taps[8]  = vec2(-0.52,    -0.55);
      taps[9]  = vec2( 0.82,     0.12);
      taps[10] = vec2(-0.85,    -0.10);
      taps[11] = vec2( 0.12,     0.85);
      taps[12] = vec2(-0.15,    -0.88);
      taps[13] = vec2( 0.75,    -0.65);
      taps[14] = vec2(-0.72,     0.68);
      taps[15] = vec2( 0.95,     0.75);

      for (int i = 0; i < 16; i++) {
        // Micro-displacement per tap imitating ground glass surface refraction
        vec2 jitterOffset = vec2(noise * 0.0018 * uBlurAmount);
        vec2 sampleUv = baseUv + taps[i] * baseRadius + jitterOffset;
        float w = 1.0 - length(taps[i]) * 0.45;
        sum += texture2D(tDiffuse, sampleUv) * w;
        totalWeight += w;
      }

      vec4 frostedColor = sum / totalWeight;

      // 3. Subtle frosted luminescence / milky white diffuse veil (すりガラスの白濁散乱)
      vec3 milkyWhite = vec3(0.96, 0.98, 1.0);
      vec3 finalRgb = mix(frostedColor.rgb, milkyWhite, 0.09 * uBlurAmount);

      // 4. Micro-grain dither for tactile matte texture
      finalRgb += (noise * 0.014 * uBlurAmount);

      gl_FragColor = vec4(finalRgb * uTint, frostedColor.a * uOpacity);
    }
  `,
};

export interface ScrollingBackgroundOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  textureUrl?: string;
  speed?: number; // units per second
  blur?: number;  // 0.0 - 1.0
  direction?: 'left' | 'right';
  planeDistance?: number;
}

export class ScrollingBackgroundManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private rootGroup: THREE.Group;
  private planeMeshes: [THREE.Mesh, THREE.Mesh];
  private materials: [THREE.ShaderMaterial, THREE.ShaderMaterial];
  private geometry: THREE.PlaneGeometry;

  private textureLoader = new THREE.TextureLoader();
  private currentTexture: THREE.Texture | null = null;
  private currentTextureUrl = '';

  private _isVisible = false;
  private _isSliding = false;
  private speed = 0.65; // default slide speed (slow walking pace)
  private direction: 'left' | 'right' = 'left';
  private targetBlur = 0.0;
  private currentBlur = 0.0;
  private planeDistance = 4.5; // distance in front of camera

  private slideOffset = 0.0;
  private planeWidth = 12.0;
  private planeHeight = 6.75; // approx 16:9

  constructor(options: { scene: THREE.Scene; camera: THREE.PerspectiveCamera }) {
    this.scene = options.scene;
    this.camera = options.camera;

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'ScrollingBackgroundGroup';
    this.rootGroup.visible = false;
    // Set renderOrder to render behind avatars but in front of clear scene background
    this.rootGroup.renderOrder = -5;

    // Create plane geometry
    this.geometry = new THREE.PlaneGeometry(1, 1);

    // Create 2 materials
    const matA = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(ScrollingBlurShader.uniforms),
      vertexShader: ScrollingBlurShader.vertexShader,
      fragmentShader: ScrollingBlurShader.fragmentShader,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    const matB = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(ScrollingBlurShader.uniforms),
      vertexShader: ScrollingBlurShader.vertexShader,
      fragmentShader: ScrollingBlurShader.fragmentShader,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    this.materials = [matA, matB];

    const meshA = new THREE.Mesh(this.geometry, matA);
    const meshB = new THREE.Mesh(this.geometry, matB);
    meshA.renderOrder = -5;
    meshB.renderOrder = -5;
    this.planeMeshes = [meshA, meshB];

    this.rootGroup.add(meshA);
    this.rootGroup.add(meshB);
    this.scene.add(this.rootGroup);
  }

  public get isVisible(): boolean {
    return this._isVisible;
  }

  public get isSliding(): boolean {
    return this._isSliding;
  }

  public show(options?: {
    textureUrl?: string;
    speed?: number;
    blur?: number;
    direction?: 'left' | 'right';
    instantBlur?: boolean;
  }): void {
    const url = options?.textureUrl || '/textures/town_far.png';
    this.speed = options?.speed ?? this.speed;
    this.direction = options?.direction ?? this.direction;
    this.targetBlur = Math.max(0, Math.min(1, options?.blur ?? 0.0));

    if (options?.instantBlur) {
      this.currentBlur = this.targetBlur;
      this.applyBlurToMaterials(this.currentBlur);
    }

    this._isSliding = options?.speed !== undefined ? options.speed > 0 : true;
    this._isVisible = true;
    this.rootGroup.visible = true;

    this.loadTexture(url);
    this.updatePlanesTransform(0);
  }

  public hide(): void {
    this._isVisible = false;
    this._isSliding = false;
    this.rootGroup.visible = false;
    this.slideOffset = 0.0;
  }

  public setSliding(sliding: boolean): void {
    this._isSliding = sliding;
  }

  public setSpeed(speed: number): void {
    this.speed = speed;
    if (speed <= 0) {
      this._isSliding = false;
    }
  }

  public setBlur(blur: number, instant = false): void {
    this.targetBlur = Math.max(0, Math.min(1, blur));
    if (instant) {
      this.currentBlur = this.targetBlur;
      this.applyBlurToMaterials(this.currentBlur);
    }
  }

  public loadTexture(url: string): void {
    const resolvedUrl = resolveAssetUrl(url);
    if (this.currentTextureUrl === resolvedUrl && this.currentTexture) {
      return;
    }

    this.currentTextureUrl = resolvedUrl;
    this.textureLoader.load(
      resolvedUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        this.currentTexture = tex;

        this.materials[0].uniforms.tDiffuse.value = tex;
        this.materials[1].uniforms.tDiffuse.value = tex;
        this.materials[0].needsUpdate = true;
        this.materials[1].needsUpdate = true;
      },
      undefined,
      (err) => {
        console.error('Failed to load scrolling background texture:', err);
      }
    );
  }

  private applyBlurToMaterials(blurVal: number): void {
    this.materials[0].uniforms.uBlurAmount.value = blurVal;
    this.materials[1].uniforms.uBlurAmount.value = blurVal;
  }

  public update(
    delta: number,
    dialogueBackgroundTransform?: { zoomScale: number; panOffsetX: number; panOffsetY: number } | null
  ): void {
    if (!this._isVisible) return;

    // Apply camera zoom & pan transform (matching ViewerCore.updateBackgroundZoom in other scenarios)
    const zoomScale = dialogueBackgroundTransform ? Math.max(1.0, dialogueBackgroundTransform.zoomScale) : 1.0;
    const panX = dialogueBackgroundTransform ? dialogueBackgroundTransform.panOffsetX : 0.0;
    const panY = dialogueBackgroundTransform ? dialogueBackgroundTransform.panOffsetY : 0.0;

    for (const mat of this.materials) {
      mat.uniforms.uZoomScale.value = zoomScale;
      mat.uniforms.uPanOffset.value.set(panX, panY);
    }

    // Smooth blur transition
    if (Math.abs(this.currentBlur - this.targetBlur) > 0.001) {
      const step = delta * 3.5; // smooth interpolation rate
      if (this.currentBlur < this.targetBlur) {
        this.currentBlur = Math.min(this.targetBlur, this.currentBlur + step);
      } else {
        this.currentBlur = Math.max(this.targetBlur, this.currentBlur - step);
      }
      this.applyBlurToMaterials(this.currentBlur);
    }

    // Slide offset animation
    if (this._isSliding && this.speed > 0) {
      const dirSign = this.direction === 'left' ? -1 : 1;
      this.slideOffset += dirSign * this.speed * delta;
    }

    this.updatePlanesTransform(delta);
  }

  /**
   * Position and scale the 2 planes aligned with camera view frustum.
   */
  private updatePlanesTransform(_delta: number): void {
    // 1. Calculate camera coordinate frame
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    // 2. Center plane position in front of camera
    const centerPos = this.camera.position
      .clone()
      .addScaledVector(forward, this.planeDistance);

    this.rootGroup.position.copy(centerPos);
    this.rootGroup.quaternion.copy(this.camera.quaternion);

    // 3. Frustum size calculation at planeDistance
    const vFovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const frustumHeight = 2 * this.planeDistance * Math.tan(vFovRad / 2);
    const frustumWidth = frustumHeight * this.camera.aspect;

    // Expand width and height to ensure no screen edges bleed
    this.planeHeight = frustumHeight * 1.6;
    // Each plane width covers 1.8x the frustum width for seamless loop
    this.planeWidth = frustumWidth * 1.8;

    // 4. Modulo wrap slideOffset within [-planeWidth, 0]
    const loopSpan = this.planeWidth;
    let normOffset = this.slideOffset % loopSpan;
    if (normOffset > 0) {
      normOffset -= loopSpan;
    }

    // Plane 0 and Plane 1 seamless contiguous alignment
    const posX0 = normOffset;
    const posX1 = normOffset + loopSpan;

    const meshA = this.planeMeshes[0];
    const meshB = this.planeMeshes[1];

    meshA.position.set(posX0, 0, 0);
    meshA.scale.set(this.planeWidth, this.planeHeight, 1);

    meshB.position.set(posX1, 0, 0);
    meshB.scale.set(this.planeWidth, this.planeHeight, 1);
  }

  public dispose(): void {
    this.hide();
    this.geometry.dispose();
    this.materials[0].dispose();
    this.materials[1].dispose();
    if (this.currentTexture) {
      this.currentTexture.dispose();
    }
    this.scene.remove(this.rootGroup);
  }
}
