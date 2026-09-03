import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import Stats from 'three/addons/libs/stats.module.js';

import { AvatarConfig, DEFAULT_CONFIG } from '../Config';
import { CinematicAnimeShader } from '../postprocessing/CinematicAnimeShader';
import { GodRaysShader } from '../postprocessing/GodRaysShader';
import { SunEffect } from '../postprocessing/SunEffect';
import { WindParticles } from '../wind/WindParticles';
import { RainEffect } from '../effects/rain';
import { EffectTextManager } from '../effects/text';
import { ColorHistogram } from '../histogram/ColorHistogram';

export function getToneMappingMode(mode: string): THREE.ToneMapping {
  switch (mode) {
    case 'Linear':
      return THREE.LinearToneMapping;
    case 'Reinhard':
      return THREE.ReinhardToneMapping;
    case 'Cineon':
      return THREE.CineonToneMapping;
    case 'ACESFilmic':
      return THREE.ACESFilmicToneMapping;
    case 'AgX':
      return THREE.AgXToneMapping;
    case 'Neutral':
      return THREE.NeutralToneMapping;
    case 'None':
    default:
      return THREE.NoToneMapping;
  }
}

export function getViewportSize(): { width: number; height: number } {
  const wrapper = document.getElementById('viewport-wrapper');
  let availableWidth = window.innerWidth;
  let availableHeight = window.innerHeight;

  if (wrapper) {
    const rect = wrapper.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      availableWidth = rect.width;
      availableHeight = rect.height;
    }
  }

  const targetAspect = 16 / 9;
  const areaAspect = availableWidth / availableHeight;

  let width: number;
  let height: number;

  if (areaAspect > targetAspect) {
    // Window/Wrapper is wider than 16:9 -> Fit to height (pillarboxing)
    height = Math.floor(availableHeight);
    width = Math.floor(height * targetAspect);
  } else {
    // Window/Wrapper is taller than 16:9 -> Fit to width (letterboxing)
    width = Math.floor(availableWidth);
    height = Math.floor(width / targetAspect);
  }

  return { width, height };
}

export function updateCinematicPassUniforms(pass: ShaderPass, cfg: AvatarConfig): void {
  const pp = cfg.postProcessing;
  const cin = pp.cinematic;

  // 1. Chromatic Aberration
  pass.uniforms['uChromaticAberrationEnabled'].value = (cin?.chromaticAberration?.enabled ?? false) ? 1.0 : 0.0;
  pass.uniforms['uChromaticAberrationOffset'].value = cin?.chromaticAberration?.offset ?? 0.0015;

  // 2. Diffusion / Soft Glow
  pass.uniforms['uDiffusionEnabled'].value = (cin?.diffusion?.enabled ?? false) ? 1.0 : 0.0;
  pass.uniforms['uDiffusionStrength'].value = cin?.diffusion?.strength ?? 0.25;
  pass.uniforms['uDiffusionRadius'].value = cin?.diffusion?.radius ?? 1.8;

  // 3. Color Grading
  if (pp.colorGrading) {
    pass.uniforms['uColorGradingEnabled'].value = pp.colorGrading.enabled ? 1.0 : 0.0;
    (pass.uniforms['uShadowTint'].value as THREE.Color).set(pp.colorGrading.shadowTint);
    (pass.uniforms['uHighlightTint'].value as THREE.Color).set(pp.colorGrading.highlightTint);
    pass.uniforms['uGradingStrength'].value = pp.colorGrading.strength;
    pass.uniforms['uGradingContrast'].value = pp.colorGrading.contrast;
    pass.uniforms['uGamma'].value = pp.colorGrading.gamma;
  }

  // 4. Basic Adjustments
  pass.uniforms['uSaturation'].value = pp.saturation;
  pass.uniforms['uBrightness'].value = pp.brightness;
  pass.uniforms['uContrast'].value = pp.contrast;

  // 5. Vignette
  pass.uniforms['uVignetteEnabled'].value = (cin?.vignette?.enabled ?? false) ? 1.0 : 0.0;
  pass.uniforms['uVignetteOffset'].value = cin?.vignette?.offset ?? 1.1;
  pass.uniforms['uVignetteDarkness'].value = cin?.vignette?.darkness ?? 0.35;
  if (cin?.vignette?.color) {
    (pass.uniforms['uVignetteColor'].value as THREE.Color).set(cin.vignette.color);
  }

  // 6. Film Grain
  pass.uniforms['uFilmGrainEnabled'].value = (cin?.filmGrain?.enabled ?? false) ? 1.0 : 0.0;
  pass.uniforms['uFilmGrainStrength'].value = cin?.filmGrain?.strength ?? 0.035;
  pass.uniforms['uFilmGrainSpeed'].value = cin?.filmGrain?.speed ?? 1.0;

  // 7. Smart Sharpening
  pass.uniforms['uSharpenEnabled'].value = (cin?.sharpening?.enabled ?? false) ? 1.0 : 0.0;
  pass.uniforms['uSharpenAmount'].value = cin?.sharpening?.amount ?? 0.22;
}

export class ViewerCore {
  public canvas: HTMLCanvasElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public controls: OrbitControls;

  public effectTextScene: THREE.Scene;
  public sharedEffectTextManager: EffectTextManager;

  public windParticles: WindParticles;
  public rainEffect: RainEffect;

  public ambientLight: THREE.AmbientLight;
  public dirLight: THREE.DirectionalLight;
  public rimLight: THREE.DirectionalLight;
  public sunEffect: SunEffect;

  public floorGeo: THREE.PlaneGeometry;
  public floorMat: THREE.MeshStandardMaterial;
  public floor: THREE.Mesh;

  public composer: EffectComposer;
  public renderPass: RenderPass;
  public bloomPass: UnrealBloomPass;
  public godRaysPass: ShaderPass;
  public cinematicAnimePass: ShaderPass;
  public smaaPass: SMAAPass;

  public stats: Stats;
  public perfBadge: HTMLDivElement;

  private textureLoader = new THREE.TextureLoader();
  private backgroundTextureCache = new Map<string, THREE.Texture>();
  private midgroundTextureCache = new Map<string, THREE.Texture>();

  public midgroundMat: THREE.MeshBasicMaterial;
  public midgroundMesh: THREE.Mesh;
  public initialControlsTarget: THREE.Vector3;

  constructor(canvas: HTMLCanvasElement, initialConfig: AvatarConfig) {
    this.canvas = canvas;
    const initialViewport = getViewportSize();
    const initialContainer = document.getElementById('viewport-container');
    if (initialContainer) {
      initialContainer.style.width = `${initialViewport.width}px`;
      initialContainer.style.height = `${initialViewport.height}px`;
    }

    // 1. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(initialViewport.width, initialViewport.height, true);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = getToneMappingMode(initialConfig.postProcessing.toneMappingMode);
    this.renderer.toneMappingExposure = initialConfig.postProcessing.toneMappingExposure;
    this.renderer.shadowMap.enabled = initialConfig.lighting.castShadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Stats & PerfBadge
    this.stats = new Stats();
    this.stats.showPanel(0);
    this.stats.dom.id = 'stats-panel';
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.top = '10px';
    this.stats.dom.style.left = '10px';
    this.stats.dom.style.zIndex = '100';
    document.body.appendChild(this.stats.dom);

    this.perfBadge = document.createElement('div');
    this.perfBadge.id = 'perf-badge';
    this.perfBadge.style.position = 'absolute';
    this.perfBadge.style.top = '62px';
    this.perfBadge.style.left = '10px';
    this.perfBadge.style.padding = '4px 8px';
    this.perfBadge.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
    this.perfBadge.style.backdropFilter = 'blur(4px)';
    this.perfBadge.style.color = '#94a3b8';
    this.perfBadge.style.fontFamily = 'monospace';
    this.perfBadge.style.fontSize = '11px';
    this.perfBadge.style.borderRadius = '4px';
    this.perfBadge.style.pointerEvents = 'none';
    this.perfBadge.style.zIndex = '100';
    this.perfBadge.textContent = 'Calls: 0 | Tris: 0';
    document.body.appendChild(this.perfBadge);

    // 3. Scene
    this.scene = new THREE.Scene();
    this.effectTextScene = new THREE.Scene();
    this.sharedEffectTextManager = new EffectTextManager(this.effectTextScene);

    this.windParticles = new WindParticles(this.scene);
    this.rainEffect = new RainEffect(this.scene, initialConfig.rain);

    // 4. Midground Setup
    this.midgroundMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    const midgroundGeo = new THREE.PlaneGeometry(16 / 9, 1);
    this.midgroundMesh = new THREE.Mesh(midgroundGeo, this.midgroundMat);
    this.midgroundMesh.renderOrder = -1;
    this.scene.add(this.midgroundMesh);

    this.initialControlsTarget = new THREE.Vector3(
      DEFAULT_CONFIG.camera.target.x,
      DEFAULT_CONFIG.camera.target.y,
      DEFAULT_CONFIG.camera.target.z
    );

    // 5. Camera & OrbitControls
    this.camera = new THREE.PerspectiveCamera(
      initialConfig.camera.fov,
      16 / 9,
      0.05,
      100
    );
    this.camera.position.set(
      initialConfig.camera.position.x,
      initialConfig.camera.position.y,
      initialConfig.camera.position.z
    );

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(
      initialConfig.camera.target.x,
      initialConfig.camera.target.y,
      initialConfig.camera.target.z
    );
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 10;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.1;

    // 6. Lights
    this.ambientLight = new THREE.AmbientLight(
      initialConfig.lighting.ambient.color,
      initialConfig.lighting.ambient.intensity
    );
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(
      initialConfig.lighting.directional.color,
      initialConfig.lighting.directional.intensity
    );
    this.dirLight.position.set(
      initialConfig.lighting.directional.posX,
      initialConfig.lighting.directional.posY,
      initialConfig.lighting.directional.posZ
    );
    this.scene.add(this.dirLight);

    this.rimLight = new THREE.DirectionalLight(
      initialConfig.lighting.rim.color,
      initialConfig.lighting.rim.intensity
    );
    this.rimLight.position.set(
      initialConfig.lighting.rim.posX,
      initialConfig.lighting.rim.posY,
      initialConfig.lighting.rim.posZ
    );
    this.scene.add(this.rimLight);

    this.sunEffect = new SunEffect(this.scene);

    // 7. Floor
    this.floorGeo = new THREE.PlaneGeometry(10, 10);
    this.floorMat = new THREE.MeshStandardMaterial({
      color: initialConfig.environment.floorColor,
      roughness: 0.8,
    });
    this.floor = new THREE.Mesh(this.floorGeo, this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = 0;
    this.floor.receiveShadow = true;
    this.floor.visible = initialConfig.environment.showFloor;
    this.scene.add(this.floor);

    // 8. Composer & Passes
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const composerRenderTarget = new THREE.WebGLRenderTarget(
      window.innerWidth * pixelRatio,
      window.innerHeight * pixelRatio,
      {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        samples: initialConfig.postProcessing.antialiasing.msaaSamples,
      }
    );
    this.composer = new EffectComposer(this.renderer, composerRenderTarget);
    this.composer.setPixelRatio(pixelRatio);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio),
      initialConfig.postProcessing.bloom.strength,
      initialConfig.postProcessing.bloom.radius,
      initialConfig.postProcessing.bloom.threshold
    );
    this.composer.addPass(this.bloomPass);

    this.godRaysPass = new ShaderPass(GodRaysShader);
    this.godRaysPass.uniforms['uExposure'].value = initialConfig.lighting.sunShafts?.enabled
      ? initialConfig.lighting.sunShafts.exposure
      : 0;
    this.godRaysPass.uniforms['uDecay'].value = initialConfig.lighting.sunShafts?.decay ?? 0.94;
    this.godRaysPass.uniforms['uDensity'].value = initialConfig.lighting.sunShafts?.density ?? 0.85;
    this.godRaysPass.uniforms['uWeight'].value = initialConfig.lighting.sunShafts?.weight ?? 0.4;
    (this.godRaysPass.uniforms['uRayColor'].value as THREE.Color).set(
      initialConfig.lighting.sunShafts?.color ?? '#fff2db'
    );
    this.godRaysPass.uniforms['uShimmer'].value = initialConfig.lighting.sunShafts?.shimmer ?? 0.4;
    this.composer.addPass(this.godRaysPass);

    this.cinematicAnimePass = new ShaderPass(CinematicAnimeShader);
    this.cinematicAnimePass.uniforms['uResolution'].value.set(
      window.innerWidth * pixelRatio,
      window.innerHeight * pixelRatio
    );
    updateCinematicPassUniforms(this.cinematicAnimePass, initialConfig);
    this.composer.addPass(this.cinematicAnimePass);

    this.composer.addPass(new OutputPass());

    this.smaaPass = new SMAAPass();
    this.smaaPass.enabled = initialConfig.postProcessing.antialiasing.smaa;
    this.composer.addPass(this.smaaPass);

    // Initial resize setup
    window.addEventListener('resize', () => this.onResize());
    const viewportWrapperEl = document.getElementById('viewport-wrapper');
    if (viewportWrapperEl && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        this.onResize();
      });
      ro.observe(viewportWrapperEl);
    }
    this.onResize();
  }

  public loadAtmosphericBackground(
    url: string,
    fogEnabled: boolean,
    fogColor: string,
    fogIntensity: number
  ): Promise<THREE.Texture> {
    const cacheKey = `${url}_fog_${fogEnabled}_${fogColor}_${fogIntensity.toFixed(2)}`;
    if (this.backgroundTextureCache.has(cacheKey)) {
      return Promise.resolve(this.backgroundTextureCache.get(cacheKey)!);
    }

    if (!fogEnabled || fogIntensity <= 0) {
      const tex = this.textureLoader.load(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.backgroundTextureCache.set(cacheKey, tex);
      return Promise.resolve(tex);
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const tex = this.textureLoader.load(url);
          tex.colorSpace = THREE.SRGBColorSpace;
          this.backgroundTextureCache.set(cacheKey, tex);
          resolve(tex);
          return;
        }

        ctx.drawImage(img, 0, 0);

        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        const c = new THREE.Color(fogColor);
        const r = Math.round(c.r * 255);
        const g = Math.round(c.g * 255);
        const b = Math.round(c.b * 255);

        grad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, ${(fogIntensity * 0.25).toFixed(3)})`);
        grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${(fogIntensity * 0.55).toFixed(3)})`);
        grad.addColorStop(0.65, `rgba(${r}, ${g}, ${b}, ${(fogIntensity * 1.0).toFixed(3)})`);
        grad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, ${(fogIntensity * 0.8).toFixed(3)})`);

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        this.backgroundTextureCache.set(cacheKey, tex);
        resolve(tex);
      };
      img.onerror = () => {
        const tex = this.textureLoader.load(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        this.backgroundTextureCache.set(cacheKey, tex);
        resolve(tex);
      };
      img.src = url;
    });
  }

  public updateBackgroundDisplay(cfg: AvatarConfig): void {
    const container = document.getElementById('viewport-container');
    if (cfg.environment.showBackgroundImage && cfg.environment.backgroundImageUrl) {
      if (container) container.style.backgroundColor = '#000000';
      this.loadAtmosphericBackground(
        cfg.environment.backgroundImageUrl,
        cfg.environment.farFogEnabled !== false,
        cfg.environment.farFogColor || '#ffffff',
        cfg.environment.farFogIntensity ?? 0.24
      ).then((tex) => {
        this.scene.background = tex;
      });
    } else {
      this.scene.background = new THREE.Color(cfg.environment.backgroundColor);
      if (container) container.style.backgroundColor = cfg.environment.backgroundColor;
    }
  }

  public loadTransparentKeyedTexture(url: string, threshold = 238, feather = 18): Promise<THREE.Texture> {
    if (this.midgroundTextureCache.has(url)) {
      return Promise.resolve(this.midgroundTextureCache.get(url)!);
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const cvs = document.createElement('canvas');
        cvs.width = img.width;
        cvs.height = img.height;
        const ctx = cvs.getContext('2d');
        if (!ctx) {
          const tex = new THREE.Texture(img);
          resolve(tex);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const minVal = Math.min(r, g, b);
          if (minVal >= threshold) {
            data[i + 3] = 0;
          } else if (minVal > threshold - feather) {
            const factor = (threshold - minVal) / feather;
            data[i + 3] = Math.round(data[i + 3] * factor);
          }
        }
        ctx.putImageData(imgData, 0, 0);
        const texture = new THREE.CanvasTexture(cvs);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        this.midgroundTextureCache.set(url, texture);
        resolve(texture);
      };
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }

  public updateBackgroundZoom(dialogueBackgroundTransform?: { zoomScale: number; panOffsetX: number; panOffsetY: number } | null): void {
    if (!this.scene.background || !(this.scene.background instanceof THREE.Texture)) return;
    const bgTex = this.scene.background;

    if (dialogueBackgroundTransform) {
      const zoom = Math.max(1.0, dialogueBackgroundTransform.zoomScale);
      const invZoom = 1.0 / zoom;
      bgTex.center.set(0.5, 0.5);
      bgTex.repeat.set(invZoom, invZoom);
      bgTex.offset.set(
        (1 - invZoom) * 0.5 - dialogueBackgroundTransform.panOffsetX,
        (1 - invZoom) * 0.5 - dialogueBackgroundTransform.panOffsetY
      );
    } else {
      if (bgTex.repeat.x !== 1 || bgTex.repeat.y !== 1 || bgTex.offset.x !== 0 || bgTex.offset.y !== 0) {
        bgTex.center.set(0, 0);
        bgTex.repeat.set(1, 1);
        bgTex.offset.set(0, 0);
      }
    }
  }

  public updateMidgroundTransform(
    cfg: AvatarConfig,
    dialogueBackgroundTransform?: { zoomScale: number; panOffsetX: number; panOffsetY: number } | null
  ): void {
    if (!this.midgroundMesh.visible) return;

    const env = cfg.environment;
    const offsetX = env.midgroundPosition?.x ?? 0;
    const offsetY = (env.midgroundPosition?.y ?? 1.35) - 1.35;
    const baseScaleMul = env.midgroundScale ?? 1.15;

    let zoomMultiplier = 1.0;
    let panZoomOffsetX = 0;
    let panZoomOffsetY = 0;
    if (dialogueBackgroundTransform) {
      zoomMultiplier = dialogueBackgroundTransform.zoomScale;
      panZoomOffsetX = dialogueBackgroundTransform.panOffsetX;
      panZoomOffsetY = dialogueBackgroundTransform.panOffsetY;
    }
    const scaleMul = baseScaleMul * zoomMultiplier;

    const panDeltaX = this.controls.target.x - this.initialControlsTarget.x;
    const panDeltaY = this.controls.target.y - this.initialControlsTarget.y;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const targetDist = this.camera.position.distanceTo(this.controls.target);
    const baseDist = Math.max(targetDist + 0.3, 2.1);
    const planePos = this.camera.position
      .clone()
      .addScaledVector(forward, baseDist)
      .addScaledVector(right, offsetX - panDeltaX + panZoomOffsetX * 0.8)
      .addScaledVector(up, offsetY - panDeltaY + panZoomOffsetY * 0.8);

    this.midgroundMesh.position.copy(planePos);
    this.midgroundMesh.quaternion.copy(this.camera.quaternion);

    const vFovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const frustumHeight = 2 * baseDist * Math.tan(vFovRad / 2);
    const finalScale = frustumHeight * scaleMul;
    this.midgroundMesh.scale.set(finalScale, finalScale, 1);
  }

  public updateMidgroundDisplay(cfg: AvatarConfig): void {
    const show = cfg.environment.showBackgroundImage && cfg.environment.showMidground !== false && !!cfg.environment.midgroundImageUrl;
    this.midgroundMesh.visible = show;
    if (!show || !cfg.environment.midgroundImageUrl) return;

    this.midgroundMat.opacity = cfg.environment.midgroundOpacity ?? 1.0;

    this.loadTransparentKeyedTexture(cfg.environment.midgroundImageUrl).then((texture) => {
      this.midgroundMat.map = texture;
      this.midgroundMat.needsUpdate = true;
    });

    this.updateMidgroundTransform(cfg);
  }

  public onResize(): void {
    const { width, height } = getViewportSize();
    const pr = Math.min(window.devicePixelRatio, 2);

    const container = document.getElementById('viewport-container');
    if (container) {
      container.style.width = `${width}px`;
      container.style.height = `${height}px`;
    }

    this.camera.aspect = 16 / 9;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, true);
    this.renderer.setPixelRatio(pr);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(width, height);
    if (this.cinematicAnimePass) {
      this.cinematicAnimePass.uniforms['uResolution'].value.set(width * pr, height * pr);
    }
    if (this.smaaPass) {
      this.smaaPass.setSize(width * pr, height * pr);
    }
  }

  public applyConfig(cfg: AvatarConfig): void {
    this.updateBackgroundDisplay(cfg);
    this.updateMidgroundDisplay(cfg);
    this.floor.visible = cfg.environment.showFloor;
    this.floorMat.color.set(cfg.environment.floorColor);

    this.renderer.shadowMap.enabled = cfg.lighting.castShadows;
    this.dirLight.castShadow = cfg.lighting.castShadows;

    this.smaaPass.enabled = cfg.postProcessing.antialiasing.smaa;
    if (this.composer.renderTarget1) {
      this.composer.renderTarget1.samples = cfg.postProcessing.antialiasing.msaaSamples;
    }
    if (this.composer.renderTarget2) {
      this.composer.renderTarget2.samples = cfg.postProcessing.antialiasing.msaaSamples;
    }

    this.renderer.toneMapping = getToneMappingMode(cfg.postProcessing.toneMappingMode);
    this.renderer.toneMappingExposure = cfg.postProcessing.toneMappingExposure;

    this.bloomPass.strength = cfg.postProcessing.bloom.enabled ? cfg.postProcessing.bloom.strength : 0;
    this.bloomPass.radius = cfg.postProcessing.bloom.radius;
    this.bloomPass.threshold = cfg.postProcessing.bloom.threshold;

    updateCinematicPassUniforms(this.cinematicAnimePass, cfg);

    if (cfg.lighting.sunShafts) {
      this.godRaysPass.uniforms['uExposure'].value = cfg.lighting.sunShafts.enabled ? cfg.lighting.sunShafts.exposure : 0;
      this.godRaysPass.uniforms['uDecay'].value = cfg.lighting.sunShafts.decay;
      this.godRaysPass.uniforms['uDensity'].value = cfg.lighting.sunShafts.density;
      this.godRaysPass.uniforms['uWeight'].value = cfg.lighting.sunShafts.weight;
      (this.godRaysPass.uniforms['uRayColor'].value as THREE.Color).set(cfg.lighting.sunShafts.color);
      this.godRaysPass.uniforms['uShimmer'].value = cfg.lighting.sunShafts.shimmer;
    }

    this.ambientLight.color.set(cfg.lighting.ambient.color);
    this.ambientLight.intensity = cfg.lighting.ambient.intensity;

    this.dirLight.color.set(cfg.lighting.directional.color);
    this.dirLight.intensity = cfg.lighting.directional.intensity;
    this.dirLight.position.set(
      cfg.lighting.directional.posX,
      cfg.lighting.directional.posY,
      cfg.lighting.directional.posZ
    );

    this.rimLight.visible = cfg.lighting.rim.enabled !== false;
    this.rimLight.color.set(cfg.lighting.rim.color);
    this.rimLight.intensity = cfg.lighting.rim.enabled !== false ? cfg.lighting.rim.intensity : 0;
    this.rimLight.position.set(
      cfg.lighting.rim.posX,
      cfg.lighting.rim.posY,
      cfg.lighting.rim.posZ
    );

    if (cfg.rain) {
      this.rainEffect.updateConfig(cfg.rain);
    } else {
      this.rainEffect.updateConfig({ enabled: false });
    }
  }

  public render(
    delta: number,
    elapsed: number,
    cfg: AvatarConfig,
    vrmMeshes: THREE.Object3D[]
  ): void {
    // 1. Sun & Lens flare
    const sunInfo = this.sunEffect.update(
      this.camera,
      delta,
      elapsed,
      cfg,
      this.dirLight,
      vrmMeshes
    );

    // 2. God Rays
    const sunShaftsEnabled = cfg.lighting.sunShafts?.enabled ?? false;
    this.godRaysPass.enabled = sunShaftsEnabled;
    if (sunShaftsEnabled) {
      this.godRaysPass.uniforms['uSunPosition'].value.copy(sunInfo.sunScreenPosition);
      this.godRaysPass.uniforms['uSunVisibility'].value = sunInfo.sunVisibility;
      this.godRaysPass.uniforms['uExposure'].value = cfg.lighting.sunShafts.exposure;
      this.godRaysPass.uniforms['uDecay'].value = cfg.lighting.sunShafts.decay;
      this.godRaysPass.uniforms['uDensity'].value = cfg.lighting.sunShafts.density;
      this.godRaysPass.uniforms['uWeight'].value = cfg.lighting.sunShafts.weight;
      (this.godRaysPass.uniforms['uRayColor'].value as THREE.Color).set(cfg.lighting.sunShafts.color);
      this.godRaysPass.uniforms['uShimmer'].value = cfg.lighting.sunShafts.shimmer;
      this.godRaysPass.uniforms['uTime'].value = elapsed;
    }

    // 3. Cinematic Pass time
    this.cinematicAnimePass.uniforms['uTime'].value = elapsed;

    // 4. Composer render
    this.composer.render();

    // 5. Effect texts
    if (this.effectTextScene.children.length > 0) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.effectTextScene, this.camera);
      this.renderer.autoClear = true;
    }

    // 6. Metrics badge
    if (this.renderer.info.render.frame % 6 === 0) {
      const calls = this.renderer.info.render.calls;
      const tris = this.renderer.info.render.triangles;
      const triText = tris >= 1000 ? `${(tris / 1000).toFixed(1)}k` : `${tris}`;
      this.perfBadge.textContent = `Calls: ${calls} | Tris: ${triText}`;
    }
  }

  public captureAndRenderHistogram(colorHistogram: ColorHistogram, cfg: AvatarConfig): void {
    const usePost =
      cfg.postProcessing.bloom.enabled ||
      cfg.lighting.sunShafts?.enabled ||
      cfg.postProcessing.colorGrading.enabled ||
      cfg.postProcessing.saturation !== 0 ||
      cfg.postProcessing.brightness !== 0 ||
      cfg.postProcessing.contrast !== 0;

    if (usePost) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    colorHistogram.computeHistogram(this.renderer);
  }
}
