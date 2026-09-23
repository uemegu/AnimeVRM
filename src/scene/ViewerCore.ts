import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { HairShadowRenderer } from '../shader/HairShadow';
import { CharacterMaskRenderer, LightWrapShader, applyLightWrapParams } from '../postprocessing/LightWrap';
import { setHairRingParams, setHairRingTint } from '../shader/HairRing';
import Stats from 'three/addons/libs/stats.module.js';

import { AvatarConfig, DEFAULT_CONFIG } from '../Config';
import { CinematicAnimeShader } from '../postprocessing/CinematicAnimeShader';
import { GodRaysShader } from '../postprocessing/GodRaysShader';
import { SunEffect } from '../postprocessing/SunEffect';
import { WindParticles } from '../wind/WindParticles';
import { RainEffect } from '../effects/rain';
import { EffectTextManager } from '../effects/text';
import { ColorHistogram } from '../histogram/ColorHistogram';
import { SkyBackground } from './SkyBackground';
import { PanoramaBackgroundController } from './PanoramaBackgroundController';

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

export interface ViewportSizeInfo {
  width: number;
  height: number;
  containerWidth: number;
  containerHeight: number;
  isPortrait: boolean;
  isLandscapeMobile: boolean;
  messageHeight: number;
}

export function getViewportSize(): ViewportSizeInfo {
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

  const isPortrait = availableHeight > availableWidth;
  const isLandscapeMobile = !isPortrait && availableHeight <= 520;

  if (isPortrait) {
    // 縦向き（Portrait）: メッセージウィンドウをキャンバス下方に配置するため高さを分離
    const messageHeight = Math.min(210, Math.max(140, Math.floor(availableHeight * 0.24)));
    const canvasWidth = Math.floor(availableWidth);
    const canvasHeight = Math.max(100, Math.floor(availableHeight - messageHeight));

    return {
      width: canvasWidth,
      height: canvasHeight,
      containerWidth: canvasWidth,
      containerHeight: Math.floor(availableHeight),
      isPortrait: true,
      isLandscapeMobile: false,
      messageHeight,
    };
  }

  // 横向き（Landscape）および デスクトップ: キャンバスを縦方向（16:9）にFitさせる
  const targetAspect = 16 / 9;
  const areaAspect = availableWidth / availableHeight;

  let width: number;
  let height: number;

  if (areaAspect > targetAspect) {
    // 横に広い -> 縦方向（高さ）にFit（左右ピラーボックス）
    height = Math.floor(availableHeight);
    width = Math.floor(height * targetAspect);
  } else {
    // 縦に広い -> 横幅にFit
    width = Math.floor(availableWidth);
    height = Math.floor(width / targetAspect);
  }

  return {
    width,
    height,
    containerWidth: width,
    containerHeight: height,
    isPortrait: false,
    isLandscapeMobile,
    messageHeight: 0,
  };
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
    // このパスは OutputPass の後（sRGB 空間）で動くため、色は sRGB の値のまま渡す
    (pass.uniforms['uShadowTint'].value as THREE.Color).set(pp.colorGrading.shadowTint).convertLinearToSRGB();
    (pass.uniforms['uHighlightTint'].value as THREE.Color).set(pp.colorGrading.highlightTint).convertLinearToSRGB();
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
    (pass.uniforms['uVignetteColor'].value as THREE.Color).set(cin.vignette.color).convertLinearToSRGB();
  }

  // 6. Film Grain
  pass.uniforms['uFilmGrainEnabled'].value = (cin?.filmGrain?.enabled ?? false) ? 1.0 : 0.0;
  pass.uniforms['uFilmGrainStrength'].value = cin?.filmGrain?.strength ?? 0.035;
  pass.uniforms['uFilmGrainSpeed'].value = cin?.filmGrain?.speed ?? 1.0;

  // 7. Smart Sharpening
  pass.uniforms['uSharpenEnabled'].value = (cin?.sharpening?.enabled ?? false) ? 1.0 : 0.0;
  pass.uniforms['uSharpenAmount'].value = cin?.sharpening?.amount ?? 0.22;

  // 8. Fisheye Lens Distortion
  pass.uniforms['uFisheyeEnabled'].value = (cin?.fisheye?.enabled ?? false) ? 1.0 : 0.0;
  pass.uniforms['uFisheyeStrength'].value = cin?.fisheye?.strength ?? 0.5;
  pass.uniforms['uFisheyeZoom'].value = cin?.fisheye?.zoom ?? 1.0;
  pass.uniforms['uFisheyeCircular'].value = (cin?.fisheye?.circular ?? false) ? 1.0 : 0.0;
}

export class ViewerCore {
  public canvas: HTMLCanvasElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public controls: OrbitControls;

  public effectTextScene: THREE.Scene;
  public sharedEffectTextManager: EffectTextManager;
  public skyBackground: SkyBackground;
  private backgroundRequest = 0;
  public panoramaController: PanoramaBackgroundController;

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
  // 前髪の影（髪の深度マスク）
  public hairShadow: HairShadowRenderer;
  // キャラのマスクとライトラップ
  public characterMask: CharacterMaskRenderer;
  public lightWrapPass: ShaderPass;

  public stats: Stats;
  public perfBadge: HTMLDivElement;
  public isPerformanceMonitorVisible: boolean = false;

  private textureLoader = new THREE.TextureLoader();
  private backgroundTextureCache = new Map<string, THREE.Texture>();
  private midgroundTextureCache = new Map<string, THREE.Texture>();
  private neargroundTextureCache = new Map<string, THREE.Texture>();

  public midgroundMat: THREE.MeshBasicMaterial;
  public midgroundMesh: THREE.Mesh;
  public neargroundMat: THREE.MeshBasicMaterial;
  public neargroundMesh: THREE.Mesh;
  public initialControlsTarget: THREE.Vector3;
  private framingAnimationId: number | null = null;

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
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(initialViewport.width, initialViewport.height, true);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = getToneMappingMode(initialConfig.postProcessing.toneMappingMode);
    this.renderer.toneMappingExposure = initialConfig.postProcessing.toneMappingExposure;
    this.renderer.shadowMap.enabled = initialConfig.lighting.castShadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Stats & PerfBadge (Default OFF)
    this.stats = new Stats();
    this.stats.showPanel(0);
    this.stats.dom.id = 'stats-panel';
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.top = '10px';
    this.stats.dom.style.left = '10px';
    this.stats.dom.style.zIndex = '100';
    this.stats.dom.style.display = 'none';
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
    this.perfBadge.style.display = 'none';
    this.perfBadge.textContent = 'Calls: 0 | Tris: 0';
    document.body.appendChild(this.perfBadge);

    // 3. Scene
    this.scene = new THREE.Scene();
    this.skyBackground = new SkyBackground(this.scene);
    this.effectTextScene = new THREE.Scene();
    this.sharedEffectTextManager = new EffectTextManager(this.effectTextScene);

    this.windParticles = new WindParticles(this.scene);
    this.rainEffect = new RainEffect(this.scene, initialConfig.rain);

    // 4. Midground Setup (Behind avatar)
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
    this.midgroundMesh.visible = false;
    this.scene.add(this.midgroundMesh);

    // 4.1 Nearground Setup (In front of avatar, e.g. cafe table)
    this.neargroundMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    const neargroundGeo = new THREE.PlaneGeometry(16 / 9, 1);
    this.neargroundMesh = new THREE.Mesh(neargroundGeo, this.neargroundMat);
    this.neargroundMesh.renderOrder = 2; // Avatar is 0, near layer is in front
    this.neargroundMesh.visible = false;
    this.scene.add(this.neargroundMesh);

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
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 10;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.1;
    this.camera.lookAt(this.controls.target);
    this.controls.update();

    this.panoramaController = new PanoramaBackgroundController({
      scene: this.scene,
      camera: this.camera,
      controls: this.controls,
      domElement: this.canvas,
      onStateChange: (active) => {
        if (active) {
          this.backgroundRequest++;
          this.skyBackground.mesh.visible = false;
          this.floor.visible = false;
          this.midgroundMesh.visible = false;
          this.neargroundMesh.visible = false;
        } else {
          this.updateBackgroundDisplay(initialConfig);
          this.floor.visible = initialConfig.environment.showFloor;
          this.updateMidgroundDisplay(initialConfig);
          this.updateNeargroundDisplay(initialConfig);
        }
      },
    });

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

    // ライトラップ（背景の光をキャラの輪郭の内側ににじませる。リニア空間で行う）
    this.characterMask = new CharacterMaskRenderer(
      Math.floor(window.innerWidth * pixelRatio),
      Math.floor(window.innerHeight * pixelRatio)
    );
    this.lightWrapPass = new ShaderPass(LightWrapShader);
    this.lightWrapPass.uniforms['uResolution'].value.set(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio);
    this.lightWrapPass.uniforms['tMask'].value = this.characterMask.texture;
    if (initialConfig.lightWrap) applyLightWrapParams(this.lightWrapPass.uniforms as typeof LightWrapShader.uniforms, initialConfig.lightWrap);
    this.composer.addPass(this.lightWrapPass);

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

    // ここまでリニア空間。OutputPass で表示用の sRGB に変換する
    this.composer.addPass(new OutputPass());

    // 色調補正（明度0.5基準の影/ハイライト判定・S字カーブ）とSMAAのエッジ検出は sRGB 値を前提にする
    this.cinematicAnimePass = new ShaderPass(CinematicAnimeShader);
    this.cinematicAnimePass.uniforms['uResolution'].value.set(
      window.innerWidth * pixelRatio,
      window.innerHeight * pixelRatio
    );
    updateCinematicPassUniforms(this.cinematicAnimePass, initialConfig);
    this.composer.addPass(this.cinematicAnimePass);

    this.smaaPass = new SMAAPass();
    this.smaaPass.enabled = initialConfig.postProcessing.antialiasing.smaa;
    this.composer.addPass(this.smaaPass);

    this.hairShadow = new HairShadowRenderer(
      Math.floor(window.innerWidth * pixelRatio),
      Math.floor(window.innerHeight * pixelRatio),
      initialConfig.hairShadow
    );
    // ライトラップで髪かどうかを判定するため、髪の深度を渡す
    this.lightWrapPass.uniforms['tHair'].value = this.hairShadow.depthTexture;
    this.hairShadow.setEnabled(initialConfig.hairShadow?.enabled ?? true);

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
      return this.textureLoader.loadAsync(url).then((tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        this.backgroundTextureCache.set(cacheKey, tex);
        return tex;
      });
    }

    return new Promise((resolve) => {
      const img = new Image();
      if (!url.startsWith('blob:') && !url.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
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

        // Tint only the painting: transparent sky openings must stay transparent.
        ctx.globalCompositeOperation = 'source-atop';
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

  public hideSkyBackground(): void {
    this.backgroundRequest++;
    this.skyBackground.mesh.visible = false;
  }

  public updateBackgroundDisplay(cfg: AvatarConfig): void {
    if (this.panoramaController?.isActive) return;
    const request = ++this.backgroundRequest;
    this.skyBackground.mesh.visible = false;
    const container = document.getElementById('viewport-container');
    const backgroundUrl = cfg.environment.backgroundImageUrl;
    if (cfg.environment.showBackgroundImage && backgroundUrl) {
      const isCafePainting = /(?:^|\/)cafe_far\.(?:avif|png)(?:[?#]|$)/.test(backgroundUrl);
      this.skyBackground.setTimeOfDay(cfg.activeScene?.timeOfDay);
      this.skyBackground.material.uniforms.uInteriorShadowStrength.value = isCafePainting ? 0.34 : 0;
      if (container) container.style.backgroundColor = '#000000';
      this.loadAtmosphericBackground(
        backgroundUrl,
        cfg.environment.farFogEnabled !== false,
        cfg.environment.farFogColor || '#ffffff',
        cfg.environment.farFogIntensity ?? 0.24
      ).then((texture) => {
        if (request !== this.backgroundRequest || this.panoramaController?.isActive) return;
        this.skyBackground.material.uniforms.uPainting.value = texture;
        this.skyBackground.mesh.visible = true;
        this.scene.background = null;
      }).catch((error) => {
        console.error('Failed to load background', error);
        if (request === this.backgroundRequest) this.scene.background = new THREE.Color(cfg.environment.backgroundColor);
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
      if (!url.startsWith('blob:') && !url.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
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
    if (this.panoramaController?.isActive) return;
    this.skyBackground.setTransform(dialogueBackgroundTransform);
    if (!this.scene.background || !(this.scene.background instanceof THREE.Texture)) return;
    const bgTex = this.scene.background;

    if (dialogueBackgroundTransform) {
      if (bgTex.wrapS !== THREE.RepeatWrapping) {
        bgTex.wrapS = THREE.RepeatWrapping;
        bgTex.needsUpdate = true;
      }
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
    const show = cfg.environment.showBackgroundImage && Boolean(cfg.environment.showMidground) && !!cfg.environment.midgroundImageUrl;
    this.midgroundMesh.visible = show;
    if (!show || !cfg.environment.midgroundImageUrl) return;

    this.midgroundMat.opacity = cfg.environment.midgroundOpacity ?? 1.0;

    this.loadTransparentKeyedTexture(cfg.environment.midgroundImageUrl).then((texture) => {
      this.midgroundMat.map = texture;
      this.midgroundMat.needsUpdate = true;
    });

    this.updateMidgroundTransform(cfg);
  }

  public loadNeargroundTexture(url: string): Promise<THREE.Texture> {
    if (this.neargroundTextureCache.has(url)) {
      return Promise.resolve(this.neargroundTextureCache.get(url)!);
    }
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;
          this.neargroundTextureCache.set(url, texture);
          resolve(texture);
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  public updateNeargroundTransform(
    cfg: AvatarConfig,
    dialogueBackgroundTransform?: { zoomScale: number; panOffsetX: number; panOffsetY: number } | null
  ): void {
    if (!this.neargroundMesh.visible) return;

    const env = cfg.environment;
    const userPosX = env.neargroundPosition?.x ?? 0;
    const userPosY = env.neargroundPosition?.y ?? 0;
    const baseScaleMul = env.neargroundScale ?? 1.0;

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

    // The nearground layer MUST be positioned in front of the avatar (controls.target)
    const targetDist = this.camera.position.distanceTo(this.controls.target);
    const baseDist = Math.max(targetDist * 0.65, 0.4);

    const vFovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const frustumHeight = 2 * baseDist * Math.tan(vFovRad / 2);
    const screenAspect = 16 / 9;
    const frustumWidth = frustumHeight * screenAspect;

    // Maintain texture aspect ratio (cafe_near is 1448 x 1086)
    const tex = this.neargroundMat.map;
    const imgAspect =
      tex && tex.image && (tex.image as any).width && (tex.image as any).height
        ? ((tex.image as any).width / (tex.image as any).height)
        : 1448 / 1086;

    // Near plane width matches frustum width, height calculated from aspect ratio
    const planeWidth = (frustumWidth / (16 / 9)) * (16 / 9) * scaleMul;
    const planeHeight = planeWidth / imgAspect;

    // Nearground is a foreground element fixed to the screen frame.
    // In the user-specified framing (cam.y=1.2549, baseDist=0.7774, frustumHeight=0.4166),
    // the target worldPosition is y=1.2194 (offset from camera center = -0.0355).
    // Ratio to frustumHeight: -0.0355 / 0.4166 ≈ -0.0852136.
    const defaultYOffset = -0.0852136 * frustumHeight;

    const planePos = this.camera.position
      .clone()
      .addScaledVector(forward, baseDist)
      .addScaledVector(right, userPosX + panZoomOffsetX * 0.8)
      .addScaledVector(up, defaultYOffset + userPosY + panZoomOffsetY * 0.8);

    this.neargroundMesh.position.copy(planePos);
    this.neargroundMesh.quaternion.copy(this.camera.quaternion);
    this.neargroundMesh.scale.set(planeWidth / (16 / 9), planeHeight, 1);
  }

  public updateNeargroundDisplay(cfg: AvatarConfig): void {
    const show =
      cfg.environment.showBackgroundImage &&
      Boolean(cfg.environment.showNearground) &&
      !!cfg.environment.neargroundImageUrl;
    this.neargroundMesh.visible = show;
    if (!show || !cfg.environment.neargroundImageUrl) return;

    this.neargroundMat.opacity = cfg.environment.neargroundOpacity ?? 1.0;

    this.loadNeargroundTexture(cfg.environment.neargroundImageUrl).then((texture) => {
      this.neargroundMat.map = texture;
      this.neargroundMat.needsUpdate = true;
      this.updateNeargroundTransform(cfg);
    });

    this.updateNeargroundTransform(cfg);
  }

  public setCameraFraming(framing: 'full' | 'bust' | 'close', duration = 0.35): void {
    if (this.framingAnimationId !== null) {
      cancelAnimationFrame(this.framingAnimationId);
      this.framingAnimationId = null;
    }

    const startTarget = this.controls.target.clone();
    const startPos = this.camera.position.clone();

    let endTarget: THREE.Vector3;
    let endPos: THREE.Vector3;

    switch (framing) {
      case 'full':
        endTarget = new THREE.Vector3(0, 0.85, 0);
        endPos = new THREE.Vector3(0, 0.85, 3.0);
        break;
      case 'bust':
        // Exactly matches user tuned coordinates: y=1.2549, z=1.196
        endTarget = new THREE.Vector3(0, 1.2549, 0);
        endPos = new THREE.Vector3(0, 1.2549, 1.196);
        break;
      case 'close':
        // Close-up on face
        endTarget = new THREE.Vector3(0, 1.30, 0);
        endPos = new THREE.Vector3(0, 1.30, 0.85);
        break;
    }

    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = (currentTime - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1.0);
      const ease = 1 - Math.pow(1 - progress, 3);

      this.controls.target.lerpVectors(startTarget, endTarget, ease);
      this.camera.position.lerpVectors(startPos, endPos, ease);
      this.camera.lookAt(this.controls.target);
      this.controls.update();

      if (progress < 1.0) {
        this.framingAnimationId = requestAnimationFrame(animate);
      } else {
        this.framingAnimationId = null;
        this.initialControlsTarget.copy(endTarget);
      }
    };
    this.framingAnimationId = requestAnimationFrame(animate);
  }

  public onResize(): void {
    const viewport = getViewportSize();
    const { width, height, containerWidth, containerHeight, isPortrait, isLandscapeMobile, messageHeight } = viewport;
    const pr = Math.min(window.devicePixelRatio, 2);

    document.body.classList.toggle('is-portrait', isPortrait);
    document.body.classList.toggle('is-landscape-mobile', isLandscapeMobile);
    document.documentElement.style.setProperty('--adv-msg-height', `${messageHeight}px`);

    const container = document.getElementById('viewport-container');
    if (container) {
      container.style.width = `${containerWidth}px`;
      container.style.height = `${containerHeight}px`;
      if (isPortrait) {
        container.style.aspectRatio = 'unset';
      } else {
        container.style.aspectRatio = '16 / 9';
      }
    }

    const appEl = document.getElementById('app');
    if (appEl) {
      if (isPortrait) {
        appEl.style.setProperty('height', `${height}px`, 'important');
        appEl.style.setProperty('max-height', `${height}px`, 'important');
      } else {
        appEl.style.height = '';
        appEl.style.maxHeight = '';
      }
    }

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, true);
    this.renderer.setPixelRatio(pr);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(width, height);
    const targetW = width * pr;
    const targetH = height * pr;
    if (this.cinematicAnimePass) {
      this.cinematicAnimePass.uniforms['uResolution'].value.set(targetW, targetH);
    }
    if (this.smaaPass) {
      this.smaaPass.setSize(targetW, targetH);
    }
    if (this.hairShadow) {
      this.hairShadow.setSize(Math.floor(targetW), Math.floor(targetH));
    }
    if (this.characterMask) {
      this.characterMask.setSize(Math.floor(targetW), Math.floor(targetH));
      this.lightWrapPass.uniforms['uResolution'].value.set(targetW, targetH);
    }
  }

  /**
   * Set MSAA sample count safely by resetting the composer's render targets.
   */
  public setMsaaSamples(samples: number): void {
    const currentSamples = this.composer.renderTarget1?.samples ?? 0;
    if (currentSamples === samples) return;

    const pr = Math.min(window.devicePixelRatio, 2);
    const size = this.renderer.getSize(new THREE.Vector2());
    const effectiveW = Math.floor(size.width * pr);
    const effectiveH = Math.floor(size.height * pr);

    const newRenderTarget = new THREE.WebGLRenderTarget(effectiveW, effectiveH, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      samples: samples,
    });
    this.composer.reset(newRenderTarget);
  }

  public applyConfig(cfg: AvatarConfig): void {
    this.updateBackgroundDisplay(cfg);
    this.updateMidgroundDisplay(cfg);
    this.updateNeargroundDisplay(cfg);
    this.floor.visible = cfg.environment.showFloor;
    this.floorMat.color.set(cfg.environment.floorColor);

    this.renderer.shadowMap.enabled = cfg.lighting.castShadows;
    this.dirLight.castShadow = cfg.lighting.castShadows;

    this.smaaPass.enabled = cfg.postProcessing.antialiasing.smaa;
    this.setMsaaSamples(cfg.postProcessing.antialiasing.msaaSamples);

    this.renderer.toneMapping = getToneMappingMode(cfg.postProcessing.toneMappingMode);
    this.renderer.toneMappingExposure = cfg.postProcessing.toneMappingExposure;

    this.bloomPass.strength = cfg.postProcessing.bloom.enabled ? cfg.postProcessing.bloom.strength : 0;
    this.bloomPass.radius = cfg.postProcessing.bloom.radius;
    this.bloomPass.threshold = cfg.postProcessing.bloom.threshold;

    updateCinematicPassUniforms(this.cinematicAnimePass, cfg);

    if (cfg.hairShadow) {
      this.hairShadow.setEnabled(cfg.hairShadow.enabled);
      this.hairShadow.setParams(cfg.hairShadow);
    }
    if (cfg.hairRing) {
      setHairRingParams(cfg.hairRing);
    }
    if (cfg.lightWrap) {
      applyLightWrapParams(this.lightWrapPass.uniforms as typeof LightWrapShader.uniforms, cfg.lightWrap);
    }
    setHairRingTint(cfg.lighting.hairRingTint);

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

    this.skyBackground.material.uniforms.uTime.value = elapsed;

    // 4. 前髪の影用に髪の深度を描いてから、Composer render
    this.hairShadow.render(this.renderer, this.scene, this.camera, this.dirLight);
    if (this.lightWrapPass.uniforms['uEnabled'].value > 0.5) {
      this.characterMask.render(this.renderer, this.scene, this.camera);
    }
    this.composer.render();

    // 5. Effect texts
    if (this.effectTextScene.children.length > 0) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.effectTextScene, this.camera);
      this.renderer.autoClear = true;
    }

    // 6. Metrics badge
    if (this.isPerformanceMonitorVisible && this.renderer.info.render.frame % 6 === 0) {
      const calls = this.renderer.info.render.calls;
      const tris = this.renderer.info.render.triangles;
      const triText = tris >= 1000 ? `${(tris / 1000).toFixed(1)}k` : `${tris}`;
      this.perfBadge.textContent = `Calls: ${calls} | Tris: ${triText}`;
    }
  }

  public setPerformanceMonitorVisible(visible: boolean): void {
    this.isPerformanceMonitorVisible = visible;
    const display = visible ? 'block' : 'none';
    if (this.stats?.dom) {
      this.stats.dom.style.display = display;
    }
    if (this.perfBadge) {
      this.perfBadge.style.display = display;
    }
  }

  public captureAndRenderHistogram(colorHistogram: ColorHistogram, _cfg?: AvatarConfig): void {
    colorHistogram.computeHistogram(this.canvas);
  }
}
