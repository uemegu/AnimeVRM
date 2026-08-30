import './style.css';

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { HueSaturationShader } from 'three/addons/shaders/HueSaturationShader.js';
import { BrightnessContrastShader } from 'three/addons/shaders/BrightnessContrastShader.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';

import { Avatar } from './Avatar';
import { AudioLipSync, Phoneme } from './AudioLipSync';
import { ColorGradingShader } from './ColorGradingShader';
import { GodRaysShader } from './postprocessing/GodRaysShader';
import { SunEffect } from './postprocessing/SunEffect';
import { TypographyOverlay } from './animation/TypographyOverlay';
import { ShortAnimationPlayer } from './animation/ShortAnimationPlayer';
import { ScenarioPlayer } from './animation/ScenarioPlayer';
import { ScenarioEngine } from './scenario/ScenarioEngine';
import { PARK_CONFESSION_SCENARIO } from './scenario/parkConfessionScenario';
import { WindController, WIND_PRESETS } from './wind/WindController';
import { WindParticles } from './wind/WindParticles';
import {
  DEFAULT_CONFIG,
  AvatarConfig,
  cloneConfig,
  deepAssign,
  exportConfigJSON,
  downloadConfigJSON,
  copyConfigToClipboard,
} from './Config';
import { resolveAssetUrl } from './utils/path';
import {
  ScenePresetId,
  getScenePreset,
  SCENE_PRESETS,
} from './presets/ScenePresets';

// Active configuration state
const currentConfig: AvatarConfig = cloneConfig(DEFAULT_CONFIG);

const windController = new WindController();

function getActivePresetId(): ScenePresetId {
  if (currentConfig.activeScene?.presetId && currentConfig.activeScene.presetId in SCENE_PRESETS) {
    return currentConfig.activeScene.presetId as ScenePresetId;
  }
  if (currentConfig.activeScene?.location === 'indoor') {
    return 'bright_indoor';
  }
  const tod = currentConfig.activeScene?.timeOfDay;
  if (tod === 'morning') return 'morning_park';
  return 'evening_park';
}

function syncSceneButtons(): void {
  const activeId = getActivePresetId();

  const sceneButtons = document.querySelectorAll<HTMLButtonElement>('.scene-preset-btn');
  sceneButtons.forEach((btn) => {
    const sceneId = btn.getAttribute('data-scene');
    const isActive = sceneId === activeId;
    btn.classList.toggle('active', isActive);
  });
}

function switchScene(presetId: ScenePresetId, notify = true): void {
  const preset = getScenePreset(presetId);
  currentConfig.activeScene = {
    presetId,
    location: preset.category,
    timeOfDay: presetId.startsWith('morning')
      ? 'morning'
      : presetId.startsWith('evening')
      ? 'evening'
      : undefined,
  };
  deepAssign(currentConfig.environment, preset.environment);
  deepAssign(currentConfig.lighting, preset.lighting);
  deepAssign(currentConfig.postProcessing, preset.postProcessing);
  if (preset.materials) {
    deepAssign(currentConfig.materials, preset.materials);
  }
  if (preset.wind) {
    deepAssign(currentConfig.wind, preset.wind);
  }

  applyConfigToSceneAndRenderer(currentConfig);
  if (gui) {
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  }
  syncSceneButtons();
  syncBgButtons();
  if (notify) {
    showToast(`🌅 シーンを変更しました: ${preset.name}`);
  }
}


// --------------------------------------------------
// Audio Lip-Sync Controller
// --------------------------------------------------
const audioLipSync = new AudioLipSync({
  onPhonemeChange: (phoneme) => {
    updateLipSyncPhonemeDisplay(phoneme);
  },
  onPlayStateChange: (isPlaying) => {
    updatePlayStateUI(isPlaying);
  },
  onTimeUpdate: (currentTime, duration) => {
    updateAudioTimeUI(currentTime, duration);
  },
  onEnded: () => {
    updatePlayStateUI(false);
  },
});

// --------------------------------------------------
// Renderer
// --------------------------------------------------
const canvas = document.querySelector<HTMLCanvasElement>('#app')!;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = getToneMappingMode(currentConfig.postProcessing.toneMappingMode);
renderer.toneMappingExposure = currentConfig.postProcessing.toneMappingExposure;

function getToneMappingMode(mode: string): THREE.ToneMapping {
  switch (mode) {
    case 'ACESFilmic':
      return THREE.ACESFilmicToneMapping;
    case 'Reinhard':
      return THREE.ReinhardToneMapping;
    case 'AgX':
      return (THREE as any).AgXToneMapping ?? THREE.ACESFilmicToneMapping;
    case 'Linear':
      return THREE.LinearToneMapping;
    case 'None':
    default:
      return THREE.NoToneMapping;
  }
}

// --------------------------------------------------
// Scene & Camera
// --------------------------------------------------
const scene = new THREE.Scene();
const windParticles = new WindParticles(scene);

const textureLoader = new THREE.TextureLoader();
const backgroundTextureCache = new Map<string, THREE.Texture>();

function loadAtmosphericBackground(
  url: string,
  fogEnabled: boolean,
  fogColor: string,
  fogIntensity: number
): Promise<THREE.Texture> {
  const cacheKey = `${url}_fog_${fogEnabled}_${fogColor}_${fogIntensity.toFixed(2)}`;
  if (backgroundTextureCache.has(cacheKey)) {
    return Promise.resolve(backgroundTextureCache.get(cacheKey)!);
  }

  if (!fogEnabled || fogIntensity <= 0) {
    const tex = textureLoader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    backgroundTextureCache.set(cacheKey, tex);
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
        const tex = textureLoader.load(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        backgroundTextureCache.set(cacheKey, tex);
        resolve(tex);
        return;
      }

      // 1. 元の遠景画像を描画
      ctx.drawImage(img, 0, 0);

      // 2. 空気の層（大気霞み）のグラデーションを作成
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      const c = new THREE.Color(fogColor);
      const r = Math.round(c.r * 255);
      const g = Math.round(c.g * 255);
      const b = Math.round(c.b * 255);

      grad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, ${(fogIntensity * 0.25).toFixed(3)})`); // 上空
      grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${(fogIntensity * 0.55).toFixed(3)})`); // 中空
      grad.addColorStop(0.65, `rgba(${r}, ${g}, ${b}, ${(fogIntensity * 1.0).toFixed(3)})`); // 地平線・高層ビル群
      grad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, ${(fogIntensity * 0.8).toFixed(3)})`); // 地表

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      backgroundTextureCache.set(cacheKey, tex);
      resolve(tex);
    };
    img.onerror = () => {
      const tex = textureLoader.load(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      backgroundTextureCache.set(cacheKey, tex);
      resolve(tex);
    };
    img.src = url;
  });
}

function updateBackgroundDisplay(cfg: AvatarConfig): void {
  if (cfg.environment.showBackgroundImage && cfg.environment.backgroundImageUrl) {
    document.body.style.backgroundColor = '#000000';
    loadAtmosphericBackground(
      cfg.environment.backgroundImageUrl,
      cfg.environment.farFogEnabled !== false,
      cfg.environment.farFogColor || '#ffffff',
      cfg.environment.farFogIntensity ?? 0.24
    ).then((tex) => {
      scene.background = tex;
    });
  } else {
    scene.background = new THREE.Color(cfg.environment.backgroundColor);
    document.body.style.backgroundColor = cfg.environment.backgroundColor;
  }
}

// --------------------------------------------------
// Midground (Layered Background) Setup with Keying
// --------------------------------------------------
const midgroundTextureCache = new Map<string, THREE.Texture>();

function loadTransparentKeyedTexture(url: string, threshold = 238, feather = 18): Promise<THREE.Texture> {
  if (midgroundTextureCache.has(url)) {
    return Promise.resolve(midgroundTextureCache.get(url)!);
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
      midgroundTextureCache.set(url, texture);
      resolve(texture);
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

const midgroundMat = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 1.0,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
});
// 16:9 plane geometry (aspect 16/9 = 1.7778)
const midgroundGeo = new THREE.PlaneGeometry(16 / 9, 1);
const midgroundMesh = new THREE.Mesh(midgroundGeo, midgroundMat);
midgroundMesh.renderOrder = -1;
scene.add(midgroundMesh);

const initialControlsTarget = new THREE.Vector3(
  DEFAULT_CONFIG.camera.target.x,
  DEFAULT_CONFIG.camera.target.y,
  DEFAULT_CONFIG.camera.target.z
);

function updateMidgroundTransform(): void {
  if (!midgroundMesh.visible || typeof controls === 'undefined' || typeof camera === 'undefined') return;

  const cfg = currentConfig.environment;
  const offsetX = cfg.midgroundPosition?.x ?? 0;
  const offsetY = (cfg.midgroundPosition?.y ?? 1.35) - 1.35;
  const scaleMul = cfg.midgroundScale ?? 1.15;

  // パン（平行移動）による移動量のみを算出（回転時は 0 のまま）
  const panDeltaX = controls.target.x - initialControlsTarget.x;
  const panDeltaY = controls.target.y - initialControlsTarget.y;

  // カメラの視線ベクトル（正規化）
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);

  // カメラの上方向・右方向ベクトル
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();

  // カメラ正面の一定距離（2.0m）に配置し、パン（平行移動）のオフセットのみを適用
  const baseDist = 2.05;
  const planePos = camera.position.clone()
    .addScaledVector(forward, baseDist)
    .addScaledVector(right, offsetX - panDeltaX)
    .addScaledVector(up, offsetY - panDeltaY);

  midgroundMesh.position.copy(planePos);
  midgroundMesh.quaternion.copy(camera.quaternion);

  // カメラからプレーンまでの距離に応じた視野角スケーリング
  const vFovRad = THREE.MathUtils.degToRad(camera.fov);
  const frustumHeight = 2 * baseDist * Math.tan(vFovRad / 2);
  const finalScale = frustumHeight * scaleMul;
  midgroundMesh.scale.set(finalScale, finalScale, 1);
}

function updateMidgroundDisplay(cfg: AvatarConfig): void {
  const show = cfg.environment.showBackgroundImage && cfg.environment.showMidground !== false && !!cfg.environment.midgroundImageUrl;
  midgroundMesh.visible = show;
  if (!show || !cfg.environment.midgroundImageUrl) return;

  midgroundMat.opacity = cfg.environment.midgroundOpacity ?? 1.0;

  loadTransparentKeyedTexture(cfg.environment.midgroundImageUrl).then((texture) => {
    midgroundMat.map = texture;
    midgroundMat.needsUpdate = true;
  });

  updateMidgroundTransform();
}

const camera = new THREE.PerspectiveCamera(
  currentConfig.camera.fov,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(
  currentConfig.camera.position.x,
  currentConfig.camera.position.y,
  currentConfig.camera.position.z
);

// --------------------------------------------------
// OrbitControls
// --------------------------------------------------
const controls = new OrbitControls(camera, canvas);
controls.target.set(
  currentConfig.camera.target.x,
  currentConfig.camera.target.y,
  currentConfig.camera.target.z
);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = currentConfig.camera.minDistance;
controls.maxDistance = currentConfig.camera.maxDistance;
controls.maxPolarAngle = Math.PI / 2 + 0.1;

updateBackgroundDisplay(currentConfig);
updateMidgroundDisplay(currentConfig);

function isMotionLoop(url: string): boolean {
  return url.includes('Idle') || url.includes('Walking') || url.includes('Jogging') || url.includes('Pose');
}

// --------------------------------------------------
// Typography Overlay & Short Animation Player
// --------------------------------------------------
let originalMotionUrlBeforeAnim = resolveAssetUrl('/animations/Idle.fbx');

const typographyOverlay = new TypographyOverlay();
const animationPlayer = new ShortAnimationPlayer({
  camera,
  controls,
  overlay: typographyOverlay,
  getConfig: () => currentConfig,
  onEnterTransparent: () => {
    scene.background = null;
    midgroundMesh.visible = false;
    sunEffect.sunGroup.visible = false;
    sunEffect.flareGroup.visible = false;
    renderer.setClearColor(0x000000, 0);
    originalMotionUrlBeforeAnim = currentMotionUrl;
  },
  onExitTransparent: () => {
    updateBackgroundDisplay(currentConfig);
    updateMidgroundDisplay(currentConfig);
    sunEffect.sunGroup.visible = (currentConfig.lighting.sunShafts?.enabled || currentConfig.lighting.lensFlare?.enabled) ?? false;
    sunEffect.flareGroup.visible = currentConfig.lighting.lensFlare?.enabled ?? false;
  },
  onPlayStateChange: (isPlaying) => {
    updateAnimationPlayStateUI(isPlaying);
  },
  onPlayMotion: (motionUrl) => {
    if (!avatarInstance) return;
    if (motionUrl === 'stop') {
      avatarInstance.stopAnimation();
      return;
    }
    if (motionUrl && motionUrl !== 'none') {
      const resolved = resolveAssetUrl(motionUrl);
      const isLoop = isMotionLoop(resolved);
      avatarInstance.playAnimation(resolved, isLoop);
    }
  },
  onRestoreMotion: () => {
    if (!avatarInstance) return;
    if (originalMotionUrlBeforeAnim === 'none') {
      avatarInstance.stopAnimation();
    } else if (originalMotionUrlBeforeAnim) {
      const isLoop = isMotionLoop(originalMotionUrlBeforeAnim);
      avatarInstance.playAnimation(originalMotionUrlBeforeAnim, isLoop);
    }
  },
});

const scenarioPlayer = new ScenarioPlayer({
  getAvatar: () => avatarInstance,
  getAudioLipSync: () => audioLipSync,
  onStepChange: (index, step) => {
    updateScenarioStepUI(index, step);
  },
  onPlayStateChange: (isPlaying) => {
    updateScenarioPlayStateUI(isPlaying);
  },
  onFinished: () => {
    // Finished naturally
  },
});

const scenarioEngine = new ScenarioEngine({
  getAvatar: () => avatarInstance,
  getAudioLipSync: () => audioLipSync,
  onPlayStateChange: (isPlaying) => {
    updateScenarioPlayStateUI(isPlaying);
  },
  onSwitchScenePreset: (presetId) => {
    switchScene(presetId, false);
  },
  onFinished: () => {
    showToast('✨ シナリオが終了しました');
  },
});



// --------------------------------------------------
// Environment & Lights
// --------------------------------------------------
const ambientLight = new THREE.AmbientLight(
  currentConfig.lighting.ambient.color,
  currentConfig.lighting.ambient.intensity
);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(
  currentConfig.lighting.directional.color,
  currentConfig.lighting.directional.intensity
);
dirLight.position.set(
  currentConfig.lighting.directional.posX,
  currentConfig.lighting.directional.posY,
  currentConfig.lighting.directional.posZ
);
scene.add(dirLight);

const rimLight = new THREE.DirectionalLight(
  currentConfig.lighting.rim.color,
  currentConfig.lighting.rim.intensity
);
rimLight.position.set(
  currentConfig.lighting.rim.posX,
  currentConfig.lighting.rim.posY,
  currentConfig.lighting.rim.posZ
);
scene.add(rimLight);

// Sun & Lens Flare effect
const sunEffect = new SunEffect(scene);

// Floor
const floorGeo = new THREE.PlaneGeometry(10, 10);
const floorMat = new THREE.MeshStandardMaterial({
  color: currentConfig.environment.floorColor,
  roughness: 0.8,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
floor.visible = currentConfig.environment.showFloor;
scene.add(floor);

// --------------------------------------------------
// Post-Processing Pipeline (EffectComposer)
// --------------------------------------------------
const pixelRatio = Math.min(window.devicePixelRatio, 2);
const composerRenderTarget = new THREE.WebGLRenderTarget(
  window.innerWidth * pixelRatio,
  window.innerHeight * pixelRatio,
  {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    samples: currentConfig.postProcessing.antialiasing.msaaSamples,
  }
);
const composer = new EffectComposer(renderer, composerRenderTarget);

// 1. Render base scene
composer.addPass(new RenderPass(scene, camera));

// 2. Bloom Pass (HDR high brightness glow)
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  currentConfig.postProcessing.bloom.strength,
  currentConfig.postProcessing.bloom.radius,
  currentConfig.postProcessing.bloom.threshold
);
composer.addPass(bloomPass);

// 3. God Rays Pass (Volumetric sun shafts & komorebi)
const godRaysPass = new ShaderPass(GodRaysShader);
godRaysPass.uniforms['uExposure'].value = currentConfig.lighting.sunShafts?.enabled ? currentConfig.lighting.sunShafts.exposure : 0;
godRaysPass.uniforms['uDecay'].value = currentConfig.lighting.sunShafts?.decay ?? 0.94;
godRaysPass.uniforms['uDensity'].value = currentConfig.lighting.sunShafts?.density ?? 0.85;
godRaysPass.uniforms['uWeight'].value = currentConfig.lighting.sunShafts?.weight ?? 0.4;
(godRaysPass.uniforms['uRayColor'].value as THREE.Color).set(currentConfig.lighting.sunShafts?.color ?? '#fff2db');
godRaysPass.uniforms['uShimmer'].value = currentConfig.lighting.sunShafts?.shimmer ?? 0.4;
composer.addPass(godRaysPass);

// 4. OutputPass: Converts Linear HDR to sRGB color space & applies Tone Mapping
composer.addPass(new OutputPass());

// 6. Perceptual sRGB Post-Processing Passes (Color Grading, Hue/Sat, Brightness/Contrast, SMAA)
const colorGradingPass = new ShaderPass(ColorGradingShader);
colorGradingPass.uniforms['uEnabled'].value = currentConfig.postProcessing.colorGrading.enabled ? 1.0 : 0.0;
(colorGradingPass.uniforms['uShadowTint'].value as THREE.Color).set(currentConfig.postProcessing.colorGrading.shadowTint);
(colorGradingPass.uniforms['uHighlightTint'].value as THREE.Color).set(currentConfig.postProcessing.colorGrading.highlightTint);
colorGradingPass.uniforms['uStrength'].value = currentConfig.postProcessing.colorGrading.strength;
colorGradingPass.uniforms['uGradingContrast'].value = currentConfig.postProcessing.colorGrading.contrast;
colorGradingPass.uniforms['uGamma'].value = currentConfig.postProcessing.colorGrading.gamma;
composer.addPass(colorGradingPass);

const hueSaturationPass = new ShaderPass(HueSaturationShader);
hueSaturationPass.uniforms['saturation'].value = currentConfig.postProcessing.saturation;
composer.addPass(hueSaturationPass);

const brightnessContrastPass = new ShaderPass(BrightnessContrastShader);
brightnessContrastPass.uniforms['brightness'].value = currentConfig.postProcessing.brightness;
brightnessContrastPass.uniforms['contrast'].value = currentConfig.postProcessing.contrast;
composer.addPass(brightnessContrastPass);

// 7. SMAA (Subpixel Morphological Antialiasing) on sRGB edges
const smaaPass = new SMAAPass();
smaaPass.enabled = currentConfig.postProcessing.antialiasing.smaa;
composer.addPass(smaaPass);

// --------------------------------------------------
// Avatar Initialization & Model Loading
// --------------------------------------------------
let avatarInstance: Avatar | null = null;
let currentModelUrl = resolveAssetUrl('/models/girl.vrm');
let currentMotionUrl = resolveAssetUrl('/animations/Idle.fbx');
let currentExprName = 'neutral';

function loadAvatarModel(modelUrl: string): void {
  currentModelUrl = modelUrl;

  const loadingStatus = document.getElementById('loading-status');
  if (loadingStatus) {
    loadingStatus.innerHTML = `モデル読み込み中... <span id="progress-text">0%</span>`;
  }

  // Dispose previous avatar if existing
  if (avatarInstance) {
    avatarInstance.dispose();
    avatarInstance = null;
    windController.resetModel();
  }

  avatarInstance = new Avatar(scene, camera, {
    modelUrl: modelUrl,
    defaultAnimationUrl: currentMotionUrl !== 'none' ? currentMotionUrl : undefined,
    config: currentConfig,
    autoBlink: true,
    lookAtCamera: true,
    enableBreathing: true,
    onProgress: (progress) => {
      const el = document.getElementById('progress-text');
      if (el) el.textContent = `${progress.toFixed(0)}%`;
    },
    onLoaded: (avatar) => {
      applyConfigToSceneAndRenderer(currentConfig);
      if (currentExprName !== 'neutral') {
        avatar.setExpression(currentExprName, 1.0);
      }
      const el = document.getElementById('loading-status');
      if (el) {
        const displayName = modelUrl.startsWith('blob:') ? 'ローカルVRM' : modelUrl.split('/').pop();
        el.innerHTML = `<span style="color: #16a34a; font-weight: 600;">✓ ロード完了</span> (${displayName})`;
      }
      const displayName = modelUrl.startsWith('blob:') ? 'ローカルVRM' : modelUrl.split('/').pop();
      showToast(`👤 モデルを読み込みました: ${displayName}`);

      // Sync active state in UI buttons
      document.querySelectorAll<HTMLButtonElement>('.model-btn').forEach((btn) => {
        const btnModel = btn.getAttribute('data-model');
        btn.classList.toggle('active', btnModel === modelUrl);
      });
    },
    onError: (error) => {
      console.error('Failed to load VRM avatar:', error);
      const el = document.getElementById('loading-status');
      if (el) {
        el.innerHTML = `<span style="color: #dc2626; font-weight: 600;">✗ ロード失敗</span>`;
      }
      showToast('❌ モデルの読み込みに失敗しました');
    },
  });
}

// Initial load
loadAvatarModel(currentModelUrl);

// --------------------------------------------------
// Apply Configuration updates to Scene & Shaders
// --------------------------------------------------
function applyConfigToSceneAndRenderer(cfg: AvatarConfig): void {
  // Environment / Background
  updateBackgroundDisplay(cfg);
  updateMidgroundDisplay(cfg);
  floor.visible = cfg.environment.showFloor;
  floorMat.color.set(cfg.environment.floorColor);

  // Shadow mapping control (disable for pure single-step flat anime shading)
  renderer.shadowMap.enabled = cfg.lighting.castShadows;
  dirLight.castShadow = cfg.lighting.castShadows;
  if (avatarInstance?.vrm) {
    avatarInstance.vrm.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).castShadow = cfg.lighting.castShadows;
      }
    });
  }

  // Antialiasing
  smaaPass.enabled = cfg.postProcessing.antialiasing.smaa;
  if (composer.renderTarget1) {
    composer.renderTarget1.samples = cfg.postProcessing.antialiasing.msaaSamples;
  }
  if (composer.renderTarget2) {
    composer.renderTarget2.samples = cfg.postProcessing.antialiasing.msaaSamples;
  }

  // Tone Mapping
  renderer.toneMapping = getToneMappingMode(cfg.postProcessing.toneMappingMode);
  renderer.toneMappingExposure = cfg.postProcessing.toneMappingExposure;

  bloomPass.strength = cfg.postProcessing.bloom.enabled ? cfg.postProcessing.bloom.strength : 0;
  bloomPass.radius = cfg.postProcessing.bloom.radius;
  bloomPass.threshold = cfg.postProcessing.bloom.threshold;

  if (cfg.postProcessing.colorGrading) {
    colorGradingPass.uniforms['uEnabled'].value = cfg.postProcessing.colorGrading.enabled ? 1.0 : 0.0;
    (colorGradingPass.uniforms['uShadowTint'].value as THREE.Color).set(cfg.postProcessing.colorGrading.shadowTint);
    (colorGradingPass.uniforms['uHighlightTint'].value as THREE.Color).set(cfg.postProcessing.colorGrading.highlightTint);
    colorGradingPass.uniforms['uStrength'].value = cfg.postProcessing.colorGrading.strength;
    colorGradingPass.uniforms['uGradingContrast'].value = cfg.postProcessing.colorGrading.contrast;
    colorGradingPass.uniforms['uGamma'].value = cfg.postProcessing.colorGrading.gamma;
  }

  if (cfg.lighting.sunShafts) {
    godRaysPass.uniforms['uExposure'].value = cfg.lighting.sunShafts.enabled ? cfg.lighting.sunShafts.exposure : 0;
    godRaysPass.uniforms['uDecay'].value = cfg.lighting.sunShafts.decay;
    godRaysPass.uniforms['uDensity'].value = cfg.lighting.sunShafts.density;
    godRaysPass.uniforms['uWeight'].value = cfg.lighting.sunShafts.weight;
    (godRaysPass.uniforms['uRayColor'].value as THREE.Color).set(cfg.lighting.sunShafts.color);
    godRaysPass.uniforms['uShimmer'].value = cfg.lighting.sunShafts.shimmer;
  }

  hueSaturationPass.uniforms['saturation'].value = cfg.postProcessing.saturation;
  brightnessContrastPass.uniforms['brightness'].value = cfg.postProcessing.brightness;
  brightnessContrastPass.uniforms['contrast'].value = cfg.postProcessing.contrast;

  // Lighting
  ambientLight.color.set(cfg.lighting.ambient.color);
  ambientLight.intensity = cfg.lighting.ambient.intensity;

  dirLight.color.set(cfg.lighting.directional.color);
  dirLight.intensity = cfg.lighting.directional.intensity;
  dirLight.position.set(
    cfg.lighting.directional.posX,
    cfg.lighting.directional.posY,
    cfg.lighting.directional.posZ
  );

  rimLight.visible = cfg.lighting.rim.enabled !== false;
  rimLight.color.set(cfg.lighting.rim.color);
  rimLight.intensity = cfg.lighting.rim.enabled !== false ? cfg.lighting.rim.intensity : 0;
  rimLight.position.set(
    cfg.lighting.rim.posX,
    cfg.lighting.rim.posY,
    cfg.lighting.rim.posZ
  );

  // Avatar Shader & Materials
  avatarInstance?.applyConfig(cfg);

  // Audio Lip-Sync Settings
  if (cfg.lipSync) {
    audioLipSync.rmsThreshold = cfg.lipSync.rmsThreshold;
    audioLipSync.setAudioDelay(cfg.lipSync.audioDelay ?? 0.05);
    audioLipSync.setVoiceGender(cfg.lipSync.voiceGender ?? 'female');
  }

  syncToggleState();
}

const toggleState = {
  colorGrading: true,
  bloom: true,
  smoothNormal: true,
  screenSpaceWidth: true,
  rimBody: true,
  rimCloth: true,
  rimLight: true,
  wind: true,
};

function syncToggleState(): void {
  toggleState.colorGrading = currentConfig.postProcessing.colorGrading?.enabled ?? false;
  toggleState.bloom = currentConfig.postProcessing.bloom?.enabled ?? false;
  toggleState.smoothNormal = currentConfig.outline.useSmoothNormal;
  toggleState.screenSpaceWidth = currentConfig.outline.screenSpaceWidth;
  toggleState.rimBody = currentConfig.materials.body.rimEnabled ?? false;
  toggleState.rimCloth = currentConfig.materials.cloth.rimEnabled ?? false;
  toggleState.rimLight = currentConfig.lighting.rim.enabled !== false;
  toggleState.wind = currentConfig.wind.enabled;
}

let gui: GUI;

function setupGUI(mountPoint?: HTMLElement): void {
  syncToggleState();
  gui = new GUI({
    title: '詳細パラメータ',
    container: mountPoint,
    autoPlace: !mountPoint,
  });

  // 0. Scene Presets Folder
  const sceneFolder = gui.addFolder('🌅 シーン・ライティング一括プリセット (Scene Presets)');
  const sceneState = {
    preset: getActivePresetId(),
  };

  const sceneOptions: Record<string, ScenePresetId> = {
    '🌳 朝・公園 (Morning Park)': 'morning_park',
    '🌳 夕方・公園 (Evening Park)': 'evening_park',
    '🏫 朝・校門 (Morning School Gate)': 'morning_school',
    '🏫 夕方・校門 (Evening School Gate)': 'evening_school',
    '💡 明るい・室内 (Bright Indoor)': 'bright_indoor',
    '🌙 暗い・室内 (Dark Indoor)': 'dark_indoor',
  };

  sceneFolder
    .add(sceneState, 'preset', sceneOptions)
    .name('シーン選択')
    .onChange((val: ScenePresetId) => {
      switchScene(val);
    });

  const sceneActions = {
    morningPark: () => switchScene('morning_park'),
    eveningPark: () => switchScene('evening_park'),
    morningSchool: () => switchScene('morning_school'),
    eveningSchool: () => switchScene('evening_school'),
    brightIndoor: () => switchScene('bright_indoor'),
    darkIndoor: () => switchScene('dark_indoor'),
  };

  const subFolder = sceneFolder.addFolder('クイック切り替えボタン');
  subFolder.add(sceneActions, 'morningPark').name('🌳 朝・公園');
  subFolder.add(sceneActions, 'eveningPark').name('🌳 夕方・公園');
  subFolder.add(sceneActions, 'morningSchool').name('🏫 朝・校門');
  subFolder.add(sceneActions, 'eveningSchool').name('🏫 夕方・校門');
  subFolder.add(sceneActions, 'brightIndoor').name('💡 明るい・室内');
  subFolder.add(sceneActions, 'darkIndoor').name('🌙 暗い・室内');
  subFolder.close();
  sceneFolder.open();

  // 1. Short Animation Cuts Folder
  const animFolder = gui.addFolder('🎬 ショートアニメーション各Cut設定');

  const cameraAngleOptions = {
    'Continue (前Cutを引き継ぐ)': 'continue',
    'Front (正面)': 'front',
    'Far Front (遠景・正面)': 'farFront',
    'Right (右サイド 90°)': 'right',
    'Left (左サイド -90°)': 'left',
    'Back (背面 180°)': 'back',
    'Low Angle (足元見上げ)': 'lowAngle',
    'High Angle (見下ろし)': 'highAngle',
    'Close Up (顔寄り)': 'closeUp',
  };

  const cameraPresetOptions = {
    'Hold (固定)': 'hold',
    'Push In (寄り)': 'pushIn',
    'Pull Out (引き)': 'pullOut',
    'Pan Left (左流し)': 'panLeft',
    'Pan Right (右流し)': 'panRight',
    'Orbit Left (左旋回)': 'orbitLeft',
    'Orbit Right (右旋回)': 'orbitRight',
    'Orbit Left Half (左半周 180°)': 'orbitLeftHalf',
    'Orbit Right Half (右半周 180°)': 'orbitRightHalf',
    'Low Angle Up (足元から見上げ)': 'lowAngleUp',
    'Rise Up (上昇)': 'riseUp',
    'Dive Down (下降)': 'diveDown',
    'Punch In (パンチ)': 'punchIn',
  };

  const motionPresetOptions = {
    'None (維持 / 変更なし)': 'none',
    '待機 (Idle)': resolveAssetUrl('/animations/Idle.fbx'),
    '立ち待機 (Standing Idle)': resolveAssetUrl('/animations/Standing Idle.fbx'),
    '立ちポーズ (Female Standing Pose)': resolveAssetUrl('/animations/Female Standing Pose.fbx'),
    '歩行 (Walking)': resolveAssetUrl('/animations/Walking.fbx'),
    'ジョギング (Jogging)': resolveAssetUrl('/animations/Jogging.fbx'),
    '挨拶 (Standing Greeting)': resolveAssetUrl('/animations/Standing Greeting.fbx'),
    'お辞儀 (Quick Formal Bow)': resolveAssetUrl('/animations/Quick Formal Bow.fbx'),
    'うなずく (Acknowledging)': resolveAssetUrl('/animations/Acknowledging.fbx'),
    '手を振る (Dismissing Gesture)': resolveAssetUrl('/animations/Dismissing Gesture.fbx'),
    '敬礼 (Salute)': resolveAssetUrl('/animations/Salute.fbx'),
    '喜ぶ (Excited)': resolveAssetUrl('/animations/Excited.fbx'),
    '怒り (Angry)': resolveAssetUrl('/animations/Angry.fbx'),
    'パンチ (Punching)': resolveAssetUrl('/animations/Punching.fbx'),
    '停止 (Stop)': 'stop',
  };

  const textPresetOptions = {
    'Static (静止)': 'static',
    'Fade (フェード)': 'fade',
    'Slide Left (左スライド)': 'slideLeft',
    'Slide Right (右スライド)': 'slideRight',
    'Slide Up (上スライド)': 'slideUp',
    'Scale In (拡大)': 'scaleIn',
    'Punch (パンチ)': 'punch',
  };

  currentConfig.shortAnimation.cuts.forEach((cut, index) => {
    const cutFolder = animFolder.addFolder(`Cut ${index + 1}`);
    cutFolder.add(cut, 'enabled').name('有効');
    cutFolder.add(cut, 'duration', [0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0]).name('再生時間 (秒)');
    cutFolder.add(cut, 'startAngle', cameraAngleOptions).name('開始アングル (Jump)');
    cutFolder.add(cut, 'cameraDistance', 0.5, 3.0, 0.1).name('カメラ距離倍率 (Distance)');
    cutFolder.add(cut, 'cameraPreset', cameraPresetOptions).name('カメラ');
    cutFolder.add(cut, 'cameraStrength', 0.1, 5.0, 0.1).name('カメラ強度');
    cutFolder.add(cut, 'motion', motionPresetOptions).name('モーション (Motion)');

    // Back Text
    const backFolder = cutFolder.addFolder('Back Text (背景側)');
    backFolder.add(cut.backText, 'text').name('テキスト');
    backFolder.add(cut.backText, 'animationPreset', textPresetOptions).name('アニメーション');
    backFolder.add(cut.backText, 'x', 0, 100, 1).name('X (%)');
    backFolder.add(cut.backText, 'y', 0, 100, 1).name('Y (%)');
    backFolder.add(cut.backText, 'fontSize', 5, 40, 1).name('サイズ (vw)');
    backFolder.addColor(cut.backText, 'color').name('文字色');
    backFolder.add(cut.backText, 'fontWeight', [100, 200, 300, 400, 500, 600, 700, 800, 900]).name('太さ');
    backFolder.close();

    // Front Text
    const frontFolder = cutFolder.addFolder('Front Text (前面側)');
    frontFolder.add(cut.frontText, 'text').name('テキスト');
    frontFolder.add(cut.frontText, 'animationPreset', textPresetOptions).name('アニメーション');
    frontFolder.add(cut.frontText, 'x', 0, 100, 1).name('X (%)');
    frontFolder.add(cut.frontText, 'y', 0, 100, 1).name('Y (%)');
    frontFolder.add(cut.frontText, 'fontSize', 5, 40, 1).name('サイズ (vw)');
    frontFolder.addColor(cut.frontText, 'color').name('文字色');
    frontFolder.add(cut.frontText, 'fontWeight', [100, 200, 300, 400, 500, 600, 700, 800, 900]).name('太さ');
    frontFolder.close();

    cutFolder.close();
  });
  animFolder.close();

  // 2. Quick Feature Toggles
  const toggleFolder = gui.addFolder('⚡ 各機能 個別 ON/OFF トグル (Feature Toggles)');
  syncToggleState();

  toggleFolder
    .add(toggleState, 'colorGrading')
    .name('🎬 アニメカラーグレーディング')
    .onChange((val: boolean) => {
      currentConfig.postProcessing.colorGrading.enabled = val;
      applyConfigToSceneAndRenderer(currentConfig);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

  toggleFolder
    .add(toggleState, 'bloom')
    .name('🌟 ブルーム (Bloom)')
    .onChange((val: boolean) => {
      currentConfig.postProcessing.bloom.enabled = val;
      applyConfigToSceneAndRenderer(currentConfig);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

  toggleFolder
    .add(toggleState, 'wind')
    .name('🍃 風・揺れもの物理 (Wind Effect)')
    .onChange((val: boolean) => {
      currentConfig.wind.enabled = val;
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

  toggleFolder
    .add(toggleState, 'smoothNormal')
    .name('✨ スムーズ法線アウトライン')
    .onChange((val: boolean) => {
      currentConfig.outline.useSmoothNormal = val;
      avatarInstance?.shaderController?.updateOutline(currentConfig.outline);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

  toggleFolder
    .add(toggleState, 'screenSpaceWidth')
    .name('📐 画面固定線幅 (NDC)')
    .onChange((val: boolean) => {
      currentConfig.outline.screenSpaceWidth = val;
      avatarInstance?.shaderController?.updateOutline(currentConfig.outline);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

  toggleFolder
    .add(toggleState, 'rimBody')
    .name('💡 リムライト (肌/体)')
    .onChange((val: boolean) => {
      currentConfig.materials.body.rimEnabled = val;
      avatarInstance?.shaderController?.updateMaterialStyle('body', currentConfig.materials.body);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

  toggleFolder
    .add(toggleState, 'rimCloth')
    .name('💡 リムライト (衣装)')
    .onChange((val: boolean) => {
      currentConfig.materials.cloth.rimEnabled = val;
      avatarInstance?.shaderController?.updateMaterialStyle('cloth', currentConfig.materials.cloth);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

  toggleFolder
    .add(toggleState, 'rimLight')
    .name('💡 補助環境リム光')
    .onChange((val: boolean) => {
      currentConfig.lighting.rim.enabled = val;
      applyConfigToSceneAndRenderer(currentConfig);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

  toggleFolder.close();

  // Helper to add material folder
  const addMaterialFolder = (title: string, kind: 'body' | 'hair' | 'cloth') => {
    const folder = gui.addFolder(title);
    const params = currentConfig.materials[kind];
    const update = () => avatarInstance?.shaderController?.updateMaterialStyle(kind, params);

    folder.addColor(params, 'color').name('基本色・血色感 (Base Color / Tint)').onChange(update);
    folder.add(params, 'matcapEnabled').name('✨ ハイライト表示 (Highlight / MatCap)').onChange(update);
    folder.add(params, 'shadowHueShift', -0.5, 0.5, 0.01).name('影の色相シフト (Hue Shift)').onChange(update);
    folder.add(params, 'shadowLightnessFactor', 0.02, 1.0, 0.01).name('影の明度比率 (Lightness)').onChange(update);
    folder.add(params, 'shadingToonyFactor', 0, 1, 0.01).name('トゥーン度 (Toony)').onChange(update);
    folder.add(params, 'shadingShiftFactor', -1, 1, 0.01).name('明暗境界シフト (Shift)').onChange(update);
    folder.add(params, 'giEqualizationFactor', 0, 1, 0.01).name('環境光均一化 (GI)').onChange(update);

    folder.add(params, 'rimEnabled').name('リムライト有効 (Rim ON)').onChange(update);
    folder.addColor(params, 'rimColor').name('リムライト色 (Rim Color)').onChange(update);
    folder.add(params, 'parametricRimFresnelPowerFactor', 0, 10, 0.1).name('リム急峻度 (Fresnel Power)').onChange(update);
    folder.add(params, 'parametricRimLiftFactor', 0, 5, 0.01).name('リム持ち上げ (Lift)').onChange(update);
    folder.add(params, 'rimLightingMixFactor', 0, 2, 0.01).name('リム光合成比率 (Mix)').onChange(update);
    folder.add(params, 'outlineWidthFactor', 0, 0.01, 0.0002).name('輪郭線の太さ (Outline Width)').onChange(update);
    folder.close();
  };

  // 3. Material Folders
  addMaterialFolder('体・肌マテリアル (Body / Skin)', 'body');
  addMaterialFolder('髪マテリアル (Hair)', 'hair');
  addMaterialFolder('衣装マテリアル (Cloth / Shoes)', 'cloth');

  // 4. Outline Folder
  const outlineFolder = gui.addFolder('輪郭線・アウトライン (Outline)');
  outlineFolder
    .add(currentConfig.outline, 'enabled')
    .name('外周線表示 (Inverted Hull)')
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'useSmoothNormal')
    .name('✨ スムーズ法線 (Smooth Normal)')
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'screenSpaceWidth')
    .name('📐 画面固定線幅 (Screen-Space)')
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'autoLineWeight')
    .name('✒️ 線の抑揚自動調整 (Auto Weight)')
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'darknessFactor', 0.01, 0.5, 0.02)
    .name('線の暗さ (Darkness)')
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'widthFactor', 0, 0.01, 0.0002)
    .name('輪郭線の太さ (Width)')
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'lightingMixFactor', 0, 1, 0.01)
    .name('光影響比率 (Lighting Mix)')
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder.close();

  // 5. Environment Folder
  const envFolder = gui.addFolder('環境・多層背景・床 (Environment / Layers)');
  envFolder
    .add(currentConfig.environment, 'showBackgroundImage')
    .name('遠景背景表示 (Show Background)')
    .onChange(() => {
      updateBackgroundDisplay(currentConfig);
      updateMidgroundDisplay(currentConfig);
    });
  envFolder
    .addColor(currentConfig.environment, 'backgroundColor')
    .name('単色背景 (Background Color)')
    .onChange(() => updateBackgroundDisplay(currentConfig));

  // Far Fog (Atmospheric Perspective) folder
  const fogFolder = envFolder.addFolder('🌫️ 遠景大気フォグ (Far Fog / Haze)');
  fogFolder
    .add(currentConfig.environment, 'farFogEnabled')
    .name('フォグ有効化 (Enable Fog)')
    .onChange(() => updateBackgroundDisplay(currentConfig));
  fogFolder
    .addColor(currentConfig.environment, 'farFogColor')
    .name('空気色 (Fog Color)')
    .onChange(() => updateBackgroundDisplay(currentConfig));
  fogFolder
    .add(currentConfig.environment, 'farFogIntensity', 0, 1, 0.02)
    .name('霞み強度 (Intensity)')
    .onChange(() => updateBackgroundDisplay(currentConfig));
  
  // Midground layer folder
  const midFolder = envFolder.addFolder('🌳 中景レイヤー (Midground Layer)');
  if (!currentConfig.environment.midgroundPosition) {
    currentConfig.environment.midgroundPosition = { x: 0, y: 1.05, z: -0.6 };
  }
  midFolder
    .add(currentConfig.environment, 'showMidground')
    .name('中景の表示 (Show Midground)')
    .onChange(() => updateMidgroundDisplay(currentConfig));
  midFolder
    .add(currentConfig.environment.midgroundPosition, 'x', -5, 5, 0.05)
    .name('X位置 (Pos X)')
    .onChange(() => updateMidgroundDisplay(currentConfig));
  midFolder
    .add(currentConfig.environment.midgroundPosition, 'y', -2, 5, 0.05)
    .name('Y高さ (Pos Y)')
    .onChange(() => updateMidgroundDisplay(currentConfig));
  midFolder
    .add(currentConfig.environment.midgroundPosition, 'z', -5, 2, 0.05)
    .name('Z深度 (Pos Z / Depth)')
    .onChange(() => updateMidgroundDisplay(currentConfig));
  midFolder
    .add(currentConfig.environment, 'midgroundScale', 0.5, 10, 0.1)
    .name('サイズ (Scale)')
    .onChange(() => updateMidgroundDisplay(currentConfig));
  midFolder
    .add(currentConfig.environment, 'midgroundOpacity', 0, 1, 0.05)
    .name('不透明度 (Opacity)')
    .onChange(() => updateMidgroundDisplay(currentConfig));

  envFolder
    .add(currentConfig.environment, 'showFloor')
    .name('床の表示 (Show Floor)')
    .onChange((show: boolean) => {
      floor.visible = show;
    });
  envFolder
    .addColor(currentConfig.environment, 'floorColor')
    .name('床の色 (Floor Color)')
    .onChange((color: string) => {
      floorMat.color.set(color);
    });
  envFolder.close();

  // 6. Lighting Folder
  const lightFolder = gui.addFolder('ライティング (Lighting)');
  lightFolder
    .add(currentConfig.lighting, 'castShadows')
    .name('落ち影 (Cast Shadows)')
    .onChange((enabled: boolean) => {
      renderer.shadowMap.enabled = enabled;
      dirLight.castShadow = enabled;
      if (avatarInstance?.vrm) {
        avatarInstance.vrm.scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            (obj as THREE.Mesh).castShadow = enabled;
          }
        });
      }
    });

  // Directional Light
  lightFolder
    .add(currentConfig.lighting.directional, 'intensity', 0, 8, 0.1)
    .name('主光強度 (Key Intensity)')
    .onChange((val: number) => (dirLight.intensity = val));
  lightFolder
    .addColor(currentConfig.lighting.directional, 'color')
    .name('主光色 (Key Color)')
    .onChange((val: string) => dirLight.color.set(val));
  lightFolder
    .add(currentConfig.lighting.directional, 'posX', -10, 10, 0.1)
    .name('主光 位置 X')
    .onChange((val: number) => (dirLight.position.x = val));
  lightFolder
    .add(currentConfig.lighting.directional, 'posY', -10, 10, 0.1)
    .name('主光 位置 Y')
    .onChange((val: number) => (dirLight.position.y = val));
  lightFolder
    .add(currentConfig.lighting.directional, 'posZ', -10, 10, 0.1)
    .name('主光 位置 Z')
    .onChange((val: number) => (dirLight.position.z = val));

  // Ambient Light
  lightFolder
    .add(currentConfig.lighting.ambient, 'intensity', 0, 3, 0.05)
    .name('環境光強度 (Ambient Int)')
    .onChange((val: number) => (ambientLight.intensity = val));
  lightFolder
    .addColor(currentConfig.lighting.ambient, 'color')
    .name('環境光色 (Ambient Color)')
    .onChange((val: string) => ambientLight.color.set(val));

  // Rim Light
  lightFolder
    .add(currentConfig.lighting.rim, 'enabled')
    .name('補助光有効 (Rim ON)')
    .onChange((val: boolean) => {
      rimLight.visible = val;
      rimLight.intensity = val ? currentConfig.lighting.rim.intensity : 0;
    });
  lightFolder
    .add(currentConfig.lighting.rim, 'intensity', 0, 3, 0.05)
    .name('補助光強度 (Rim Int)')
    .onChange((val: number) => {
      rimLight.intensity = currentConfig.lighting.rim.enabled !== false ? val : 0;
    });
  lightFolder
    .addColor(currentConfig.lighting.rim, 'color')
    .name('補助光色 (Rim Color)')
    .onChange((val: string) => rimLight.color.set(val));
  lightFolder
    .add(currentConfig.lighting.rim, 'posX', -10, 10, 0.1)
    .name('補助光 位置 X')
    .onChange((val: number) => (rimLight.position.x = val));
  lightFolder
    .add(currentConfig.lighting.rim, 'posY', -10, 10, 0.1)
    .name('補助光 位置 Y')
    .onChange((val: number) => (rimLight.position.y = val));
  lightFolder
    .add(currentConfig.lighting.rim, 'posZ', -10, 10, 0.1)
    .name('補助光 位置 Z')
    .onChange((val: number) => (rimLight.position.z = val));
  lightFolder.close();

  // 6.5 Sun & God Rays & Lens Flare Folder
  const sunFolder = gui.addFolder('☀️ 太陽・サンシャフト・フレア (Sun & God Rays)');

  // Sun Transform / Light Tracking
  const sunPosFolder = sunFolder.addFolder('📍 太陽位置 (Sun Position)');
  sunPosFolder
    .add(currentConfig.lighting.sunShafts, 'followDirectionalLight')
    .name('主光の向きに自動追従')
    .onChange((val: boolean) => {
      currentConfig.lighting.sunShafts.followDirectionalLight = val;
    });
  sunPosFolder
    .add(currentConfig.lighting.sunShafts.sunPosition, 'x', -20, 20, 0.1)
    .name('太陽 位置 X')
    .onChange((val: number) => {
      currentConfig.lighting.sunShafts.sunPosition.x = val;
    });
  sunPosFolder
    .add(currentConfig.lighting.sunShafts.sunPosition, 'y', -5, 25, 0.1)
    .name('太陽 位置 Y')
    .onChange((val: number) => {
      currentConfig.lighting.sunShafts.sunPosition.y = val;
    });
  sunPosFolder
    .add(currentConfig.lighting.sunShafts.sunPosition, 'z', -20, 20, 0.1)
    .name('太陽 位置 Z')
    .onChange((val: number) => {
      currentConfig.lighting.sunShafts.sunPosition.z = val;
    });
  sunPosFolder.open();

  // God Rays (Sun Shafts / Komorebi)
  const godRaysFolder = sunFolder.addFolder('✨ サンシャフト / 木漏れ日 (God Rays)');
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'enabled')
    .name('サンシャフト有効')
    .onChange((enabled: boolean) => {
      godRaysPass.uniforms['uExposure'].value = enabled ? currentConfig.lighting.sunShafts.exposure : 0;
    });
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'exposure', 0.0, 1.5, 0.02)
    .name('光条強度 (Exposure)')
    .onChange((val: number) => {
      if (currentConfig.lighting.sunShafts.enabled) {
        godRaysPass.uniforms['uExposure'].value = val;
      }
    });
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'decay', 0.8, 0.99, 0.005)
    .name('光条長さ・減衰 (Decay)')
    .onChange((val: number) => {
      godRaysPass.uniforms['uDecay'].value = val;
    });
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'density', 0.2, 1.8, 0.05)
    .name('光線密度 (Density)')
    .onChange((val: number) => {
      godRaysPass.uniforms['uDensity'].value = val;
    });
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'weight', 0.05, 1.0, 0.02)
    .name('光線寄与率 (Weight)')
    .onChange((val: number) => {
      godRaysPass.uniforms['uWeight'].value = val;
    });
  godRaysFolder
    .addColor(currentConfig.lighting.sunShafts, 'color')
    .name('光条カラー (Ray Color)')
    .onChange((hex: string) => {
      (godRaysPass.uniforms['uRayColor'].value as THREE.Color).set(hex);
    });
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'shimmer', 0.0, 1.0, 0.05)
    .name('木漏れ日揺らめき (Shimmer)')
    .onChange((val: number) => {
      godRaysPass.uniforms['uShimmer'].value = val;
    });
  godRaysFolder.open();

  // Lens Flare
  const flareFolder = sunFolder.addFolder('🌟 太陽レンズフレア (Lens Flare)');
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'enabled')
    .name('レンズフレア有効')
    .onChange((enabled: boolean) => {
      sunEffect.flareGroup.visible = enabled;
    });
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'sunSize', 0.2, 3.0, 0.05)
    .name('太陽サイズ (Sun Size)');
  flareFolder
    .addColor(currentConfig.lighting.lensFlare, 'sunColor')
    .name('フレア光色 (Sun Color)');
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'glowIntensity', 0.0, 2.0, 0.05)
    .name('コロナグロー (Corona Glow)');
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'starburstIntensity', 0.0, 2.0, 0.05)
    .name('星型光芒 (Starburst)');
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'anamorphicIntensity', 0.0, 2.0, 0.05)
    .name('横光条 (Anamorphic Streak)');
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'ghostIntensity', 0.0, 2.0, 0.05)
    .name('ゴースト (Ghosts)');
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'haloIntensity', 0.0, 2.0, 0.05)
    .name('光輪 (Ring Halo)');
  flareFolder.open();

  sunFolder.close();

  // 7. Post Processing Folder
  const postFolder = gui.addFolder('ポストプロセス (Post Processing)');
  postFolder
    .add(currentConfig.postProcessing, 'toneMappingMode', ['ACESFilmic', 'Reinhard', 'AgX', 'Linear', 'None'])
    .name('トーンマッピング方式')
    .onChange(() => {
      applyConfigToSceneAndRenderer(currentConfig);
    });

  postFolder
    .add(currentConfig.postProcessing, 'toneMappingExposure', 0.2, 2.5, 0.05)
    .name('露出 (Exposure)')
    .onChange((val: number) => (renderer.toneMappingExposure = val));

  // Antialiasing Folder
  const aaFolder = postFolder.addFolder('✨ アンチエイリアス (Anti-Aliasing)');
  aaFolder
    .add(currentConfig.postProcessing.antialiasing, 'msaaSamples', [0, 2, 4, 8])
    .name('MSAA サンプル数 (輪郭線/幾何)')
    .onChange((samples: number) => {
      if (composer.renderTarget1) composer.renderTarget1.samples = samples;
      if (composer.renderTarget2) composer.renderTarget2.samples = samples;
    });
  aaFolder
    .add(currentConfig.postProcessing.antialiasing, 'smaa')
    .name('SMAA パス有効 (画面全体)')
    .onChange((val: boolean) => {
      smaaPass.enabled = val;
    });
  aaFolder.open();

  // Bloom
  postFolder
    .add(currentConfig.postProcessing.bloom, 'enabled')
    .name('ブルーム有効 (Bloom)')
    .onChange((enabled: boolean) => {
      bloomPass.strength = enabled ? currentConfig.postProcessing.bloom.strength : 0;
    });
  postFolder
    .add(currentConfig.postProcessing.bloom, 'strength', 0, 0.8, 0.01)
    .name('ブルーム強度 (Strength)')
    .onChange((val: number) => {
      if (currentConfig.postProcessing.bloom.enabled) bloomPass.strength = val;
    });
  postFolder
    .add(currentConfig.postProcessing.bloom, 'threshold', 0.1, 1.0, 0.01)
    .name('ブルーム閾値 (Threshold)')
    .onChange((val: number) => (bloomPass.threshold = val));
  postFolder
    .add(currentConfig.postProcessing.bloom, 'radius', 0.0, 1.0, 0.02)
    .name('ブルーム半径 (Radius)')
    .onChange((val: number) => (bloomPass.radius = val));

  // Color Grading (Split Toning / Film Look)
  const cgFolder = postFolder.addFolder('🎬 アニメカラーグレーディング (Color Grading)');
  cgFolder
    .add(currentConfig.postProcessing.colorGrading, 'enabled')
    .name('グレーディング有効')
    .onChange((enabled: boolean) => {
      colorGradingPass.uniforms['uEnabled'].value = enabled ? 1.0 : 0.0;
    });
  cgFolder
    .addColor(currentConfig.postProcessing.colorGrading, 'shadowTint')
    .name('影の色味 (Shadow Tint)')
    .onChange((hex: string) => {
      (colorGradingPass.uniforms['uShadowTint'].value as THREE.Color).set(hex);
    });
  cgFolder
    .addColor(currentConfig.postProcessing.colorGrading, 'highlightTint')
    .name('光の色味 (Highlight Tint)')
    .onChange((hex: string) => {
      (colorGradingPass.uniforms['uHighlightTint'].value as THREE.Color).set(hex);
    });
  cgFolder
    .add(currentConfig.postProcessing.colorGrading, 'strength', 0, 1, 0.02)
    .name('グレーディング強度')
    .onChange((val: number) => {
      colorGradingPass.uniforms['uStrength'].value = val;
    });
  cgFolder
    .add(currentConfig.postProcessing.colorGrading, 'contrast', 0, 0.5, 0.01)
    .name('フィルムS字コントラスト')
    .onChange((val: number) => {
      colorGradingPass.uniforms['uGradingContrast'].value = val;
    });
  cgFolder
    .add(currentConfig.postProcessing.colorGrading, 'gamma', 0.7, 1.4, 0.02)
    .name('ガンマ (Gamma)')
    .onChange((val: number) => {
      colorGradingPass.uniforms['uGamma'].value = val;
    });
  cgFolder.open();

  // Basic Grading
  postFolder
    .add(currentConfig.postProcessing, 'saturation', -1.0, 1.0, 0.02)
    .name('彩度 (Saturation)')
    .onChange((val: number) => (hueSaturationPass.uniforms['saturation'].value = val));
  postFolder
    .add(currentConfig.postProcessing, 'brightness', -0.5, 0.5, 0.01)
    .name('明度 (Brightness)')
    .onChange((val: number) => (brightnessContrastPass.uniforms['brightness'].value = val));
  postFolder
    .add(currentConfig.postProcessing, 'contrast', -0.5, 0.5, 0.01)
    .name('コントラスト (Contrast)')
    .onChange((val: number) => (brightnessContrastPass.uniforms['contrast'].value = val));
  postFolder.close();

  // 8. Wind & SpringBone Physics Folder
  const windFolder = gui.addFolder('🍃 風・揺れもの物理設定 (Wind & Physics)');

  const windPresetKeys: Record<string, string> = {
    '🌸 そよ風 (Gentle Breeze)': 'breeze',
    '💨 強風 (Strong Wind)': 'strong',
    '🌪️ 突風・嵐 (Gusty Storm)': 'gusty',
    '✨ 原神風・疾風 (Anemo Gale)': 'anemo',
    '🍃 無風 (Calm)': 'calm',
  };

  const windPresetObj = { preset: 'breeze' };
  windFolder
    .add(windPresetObj, 'preset', windPresetKeys)
    .name('風プリセット')
    .onChange((key: string) => {
      WindController.applyPreset(currentConfig.wind, key);
      toggleState.wind = currentConfig.wind.enabled;
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      showToast(`🍃 風プリセット適用: ${WIND_PRESETS[key]?.label || key}`);
    });

  windFolder
    .add(currentConfig.wind, 'enabled')
    .name('風物理有効 (Enabled)')
    .onChange((val: boolean) => {
      toggleState.wind = val;
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

  windFolder.add(currentConfig.wind, 'speed', 0.0, 5.0, 0.1).name('風速 (Speed)');
  windFolder.add(currentConfig.wind, 'direction', 0, 360, 1).name('風向角度 (Direction °)');
  windFolder.add(currentConfig.wind, 'elevation', -45, 45, 1).name('仰角 (Elevation °)');
  windFolder.add(currentConfig.wind, 'turbulence', 0.0, 2.0, 0.05).name('乱流・揺らぎ (Turbulence)');
  windFolder.add(currentConfig.wind, 'gustFrequency', 0.0, 1.0, 0.05).name('突風頻度 (Gust Freq)');
  windFolder.add(currentConfig.wind, 'gustStrength', 0.0, 3.0, 0.1).name('突風強度 (Gust Strength)');

  const particleFolder = windFolder.addFolder('🌸 風・花びらパーティクル (Petals)');
  particleFolder.add(currentConfig.wind.particles, 'enabled').name('花びら表示 (Enabled)');
  particleFolder.add(currentConfig.wind.particles, 'count', 20, 500, 10).name('花びら数 (Count)');
  particleFolder.add(currentConfig.wind.particles, 'size', 0.005, 0.08, 0.002).name('サイズ (Size)');
  particleFolder.addColor(currentConfig.wind.particles, 'color').name('カラー (Color)');
  particleFolder.add(currentConfig.wind.particles, 'opacity', 0.1, 1.0, 0.05).name('不透明度 (Opacity)');
  particleFolder.add(currentConfig.wind.particles, 'speedFactor', 0.2, 3.0, 0.1).name('速度倍率 (Speed Factor)');
  particleFolder.close();

  windFolder.close();

  // 9. Lip Sync Folder
  const lipFolder = gui.addFolder('🎵 リップシンク設定 (Lip Sync)');
  lipFolder
    .add(currentConfig.lipSync, 'enabled')
    .name('リップシンク有効 (Enabled)');
  lipFolder
    .add(currentConfig.lipSync, 'voiceGender', {
      '女性 / 高音 (Female)': 'female',
      '男性 / 低音 (Male)': 'male',
    })
    .name('声質プロファイル (Voice Gender)')
    .onChange((val: 'female' | 'male') => {
      audioLipSync.setVoiceGender(val);
    });
  lipFolder
    .add(currentConfig.lipSync, 'gain', 0.0, 1.5, 0.05)
    .name('口の開き倍率 (Gain)');
  lipFolder
    .add(currentConfig.lipSync, 'smoothing', 0.05, 0.6, 0.01)
    .name('スムージング速度 (Smoothing)');
  lipFolder
    .add(currentConfig.lipSync, 'audioDelay', 0.0, 0.2, 0.005)
    .name('音声遅延補正秒 (Audio Delay)')
    .onChange((val: number) => {
      audioLipSync.setAudioDelay(val);
    });
  lipFolder
    .add(currentConfig.lipSync, 'rmsThreshold', 0.001, 0.05, 0.001)
    .name('無音判定閾値 (RMS Threshold)')
    .onChange((val: number) => {
      audioLipSync.rmsThreshold = val;
    });
  lipFolder.close();

  // 10. Manga Emotion Effect Text Folder
  const effectTextFolder = gui.addFolder('💬 感情エフェクト文字 (Emotion Effect Text)');
  const effectTextState = {
    text: 'ワナワナ',
    preset: 'wanawana',
    mode: 'auto',
    anchor: 'head',
    duration: 1.8,
    scale: 1.0,
    offsetX: 0.0,
    offsetY: 0.22,
    offsetZ: 0.04,
    show: () => {
      if (!avatarInstance) return;
      const modeParam = effectTextState.mode === 'auto' ? undefined : (effectTextState.mode as any);
      avatarInstance.showEffectText({
        text: effectTextState.text || 'ワナワナ',
        stylePreset: effectTextState.preset,
        mode: modeParam,
        anchor: effectTextState.anchor as any,
        offset: {
          x: effectTextState.offsetX,
          y: effectTextState.offsetY,
          z: effectTextState.offsetZ,
        },
        duration: effectTextState.duration,
        scale: effectTextState.scale,
      });
      showToast(`💬 「${effectTextState.text}」を表示しました`);
    },
    showMulti: () => {
      if (!avatarInstance?.effectTextManager || !avatarInstance.vrm) return;
      avatarInstance.effectTextManager.showMultiple([
        {
          text: 'ガーン',
          target: avatarInstance.vrm,
          anchor: 'head',
          stylePreset: 'gaan',
          offset: { x: 0, y: 0.22, z: 0.04 },
        },
        {
          text: '・・・・',
          target: avatarInstance.vrm,
          anchor: 'head',
          stylePreset: 'shiin',
          offset: { x: 0.22, y: 0.12, z: 0 },
        },
        {
          text: 'イライラ',
          target: avatarInstance.vrm,
          anchor: 'rightHand',
          stylePreset: 'iraira',
          offset: { x: 0.14, y: 0.08, z: 0 },
        },
      ]);
      showToast('💥 複数エフェクト文字を同時表示しました');
    },
    clearAll: () => {
      avatarInstance?.effectTextManager?.clear();
      showToast('🧹 全てのエフェクト文字をクリアしました');
    },
  };

  effectTextFolder.add(effectTextState, 'text').name('表示テキスト (Text)');
  effectTextFolder
    .add(effectTextState, 'preset', {
      '🟣 ワナワナ (wanawana: 湧き上がり)': 'wanawana',
      '🔴 イライラ (iraira: 湧き上がり)': 'iraira',
      '💖 ドキドキ (doki: 湧き上がり)': 'doki',
      '🔵 ガーン (gaan: 中央落下)': 'gaan',
      '⚪ しーん (shiin: 中央浮遊)': 'shiin',
      '✨ キラキラ (kirakira: 中央ポップ)': 'kirakira',
      '⚡ ビクッ (biku: 中央衝撃)': 'biku',
    })
    .name('プリセット (Preset)');
  effectTextFolder
    .add(effectTextState, 'mode', {
      '自動 (Auto - プリセット設定に従う)': 'auto',
      '連続湧き上がり (Rising Stream)': 'stream',
      '単一・中央表示 (Single Banner)': 'single',
    })
    .name('表示モード (Mode)');
  effectTextFolder
    .add(effectTextState, 'anchor', {
      '頭 (Head)': 'head',
      '首 (Neck)': 'neck',
      '胸 (Chest)': 'chest',
      '腰 (Hips)': 'hips',
      '左肩 (Left Shoulder)': 'leftShoulder',
      '右肩 (Right Shoulder)': 'rightShoulder',
      '左手 (Left Hand)': 'leftHand',
      '右手 (Right Hand)': 'rightHand',
    })
    .name('追従ボーン (Anchor)');
  effectTextFolder.add(effectTextState, 'duration', 0.5, 5.0, 0.1).name('表示時間秒 (Duration)');
  effectTextFolder.add(effectTextState, 'scale', 0.3, 2.5, 0.05).name('サイズ倍率 (Scale)');
  effectTextFolder.add(effectTextState, 'offsetX', -1.5, 1.5, 0.02).name('オフセット X (0で中央)');
  effectTextFolder.add(effectTextState, 'offsetY', -1.5, 1.5, 0.02).name('オフセット Y');
  effectTextFolder.add(effectTextState, 'offsetZ', -1.5, 1.5, 0.02).name('オフセット Z');
  effectTextFolder.add(effectTextState, 'show').name('▶ エフェクト表示 (Show)');
  effectTextFolder.add(effectTextState, 'showMulti').name('💥 複数同時表示テスト');
  effectTextFolder.add(effectTextState, 'clearAll').name('✕ 全消去 (Clear All)');
  effectTextFolder.open();
}

// --------------------------------------------------
// Toast Notification Helper
// --------------------------------------------------
function showToast(message: string): void {
  let toast = document.getElementById('toast-msg');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-msg';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    toast.style.color = '#ffffff';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '8px';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)';
    toast.style.zIndex = '9999';
    toast.style.transition = 'opacity 0.3s ease';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  setTimeout(() => {
    if (toast) toast.style.opacity = '0';
  }, 2500);
}

// --------------------------------------------------
// Import Modal Setup
// --------------------------------------------------
function openImportModal(): void {
  let modal = document.getElementById('import-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'import-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modal.style.backdropFilter = 'blur(4px)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '10000';

    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 20px; width: 90%; max-width: 500px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);">
        <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 16px; color: #1e293b;">📥 設定JSONの読み込み</h3>
        <p style="font-size: 12px; color: #64748b; margin-bottom: 12px;">設定JSONコードを貼り付けて「適用」を押してください。</p>
        <textarea id="import-textarea" rows="12" style="width: 100%; box-sizing: border-box; font-family: monospace; font-size: 12px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; resize: vertical;"></textarea>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
          <button id="modal-cancel-btn" style="padding: 6px 14px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 13px;">キャンセル</button>
          <button id="modal-apply-btn" style="padding: 6px 14px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">設定を適用</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('modal-cancel-btn')?.addEventListener('click', () => {
      modal!.style.display = 'none';
    });

    document.getElementById('modal-apply-btn')?.addEventListener('click', () => {
      const textarea = document.getElementById('import-textarea') as HTMLTextAreaElement;
      if (textarea && textarea.value) {
        try {
          const parsed = JSON.parse(textarea.value);
          if (!parsed.shortAnimation || !Array.isArray(parsed.shortAnimation.cuts)) {
            parsed.shortAnimation = cloneConfig(DEFAULT_CONFIG).shortAnimation;
          }
          deepAssign(currentConfig, parsed);
          applyConfigToSceneAndRenderer(currentConfig);
          gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
          syncSceneButtons();
          syncBgButtons();
          modal!.style.display = 'none';
          showToast('✓ 設定JSONを正常に適用しました！');
        } catch (err) {
          alert('JSONのパースに失敗しました。書式をご確認ください。');
        }
      }
    });
  }

  const textarea = document.getElementById('import-textarea') as HTMLTextAreaElement;
  if (textarea) textarea.value = exportConfigJSON(currentConfig);
  modal.style.display = 'flex';
}

// --------------------------------------------------
// Animation UI Helper Functions
// --------------------------------------------------
let setPanelOpen: (open: boolean) => void = () => {};

function updateAnimationPlayStateUI(isPlaying: boolean): void {
  const playBtn = document.getElementById('anim-play-btn');
  if (playBtn) {
    playBtn.textContent = isPlaying ? '⏹ 再生中 (停止/再開)' : '▶ アニメーション再生';
    playBtn.style.background = isPlaying ? '#ea580c' : '#4f46e5';
  }

  const panel = document.getElementById('panel-container');
  const gearBtn = document.getElementById('settings-open-btn');

  if (isPlaying) {
    // 再生開始時: パネル・ギアボタンを両方非表示にして画面をクリアにする
    if (panel) panel.style.display = 'none';
    if (gearBtn) gearBtn.style.display = 'none';
  } else {
    // 停止/終了時: パネルを開いて元の状態に戻す
    setPanelOpen(true);
  }
}

function updateScenarioPlayStateUI(isPlaying: boolean): void {
  const playBtn = document.getElementById('scenario-play-btn');
  const confessionBtn = document.getElementById('scenario-confession-btn');
  const statusBox = document.getElementById('scenario-status-box');
  const panel = document.getElementById('panel-container');
  const gearBtn = document.getElementById('settings-open-btn');

  if (playBtn) {
    playBtn.textContent = scenarioPlayer.isPlaying ? '⏹ シーケンス停止' : '▶ 会話シーケンス再生';
    playBtn.style.background = scenarioPlayer.isPlaying ? '#ea580c' : '#4f46e5';
  }
  if (confessionBtn) {
    confessionBtn.textContent = scenarioEngine.isPlaying ? '⏹ シナリオ停止' : '🌸 告白イベントシナリオ再生';
    confessionBtn.style.background = scenarioEngine.isPlaying
      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
      : 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)';
  }
  if (statusBox) {
    statusBox.style.display = scenarioPlayer.isPlaying ? 'block' : 'none';
  }

  if (isPlaying) {
    // アドベンチャー再生中: パネル・ギアボタンを両方非表示にして画面に没入
    if (panel) panel.style.display = 'none';
    if (gearBtn) gearBtn.style.display = 'none';
  } else {
    // 停止/終了時: パネルを開いて元の状態に戻す
    setPanelOpen(true);
  }
}

function updateScenarioStepUI(index: number, step: { text: string; motionUrl?: string; expression?: string }): void {
  const stepLabel = document.getElementById('scenario-current-step');
  const stepText = document.getElementById('scenario-current-text');
  if (stepLabel) {
    const stepNames = ['Step 1: 手を振る', 'Step 2: 笑顔', 'Step 3: うなずく (通常表情)'];
    stepLabel.textContent = stepNames[index] || `Step ${index + 1}`;
  }
  if (stepText) {
    stepText.textContent = `「${step.text}」`;
  }
}

// --------------------------------------------------
// Audio UI Helper Functions
// --------------------------------------------------
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateLipSyncPhonemeDisplay(phoneme: Phoneme | 'nn' | undefined): void {
  const pTags = document.querySelectorAll<HTMLElement>('.phoneme-tag');
  pTags.forEach((el) => {
    const p = el.getAttribute('data-phoneme');
    if (phoneme === p || (!phoneme && p === 'nn')) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

function updatePlayStateUI(isPlaying: boolean): void {
  const playBtn = document.getElementById('audio-play-pause-btn');
  if (playBtn) {
    playBtn.textContent = isPlaying ? '⏸ 一時停止' : '▶ 再生';
    playBtn.style.background = isPlaying ? '#ea580c' : '#4f46e5';
  }
}

function updateAudioTimeUI(currentTime: number, duration: number): void {
  const timeLabel = document.getElementById('audio-time');
  const seekbar = document.getElementById('audio-seekbar') as HTMLInputElement | null;

  if (timeLabel) {
    timeLabel.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  }
  if (seekbar && duration > 0 && !seekbar.matches(':active')) {
    seekbar.value = ((currentTime / duration) * 100).toString();
  }
}

function syncBgButtons(): void {
  const bgButtons = document.querySelectorAll<HTMLButtonElement>('.bg-btn');
  bgButtons.forEach((b) => {
    const val = b.getAttribute('data-bg');
    if (!currentConfig.environment.showBackgroundImage) {
      b.classList.toggle('active', val === 'none');
    } else {
      b.classList.toggle('active', val === currentConfig.environment.backgroundImageUrl);
    }
  });
}

// --------------------------------------------------
// Unified Control Panel (Right Side HUD & Settings)
// --------------------------------------------------
function setupUnifiedUI(): void {
  // 1. Floating Settings Gear Button (shown when minimized)
  const gearBtn = document.createElement('button');
  gearBtn.id = 'settings-open-btn';
  gearBtn.title = '設定パネルを開く';
  gearBtn.innerHTML = '⚙️';
  document.body.appendChild(gearBtn);

  // 2. Main Right-Side Unified Panel
  const panel = document.createElement('div');
  panel.id = 'panel-container';
  panel.innerHTML = `
    <div id="panel-header">
      <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 14px;">
        <span style="color: #4f46e5; font-size: 16px;">✨</span> VRM Controller
      </div>
      <button id="panel-close-btn" class="panel-close-btn" title="最小化">✕</button>
    </div>
    <div id="panel-body">
      <!-- Loading Status -->
      <div id="loading-status" class="status-box">
        モデル読み込み中... <span id="progress-text">0%</span>
      </div>

      <!-- Quick JSON Actions -->
      <div class="section-box">
        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
          <button id="quick-copy-json" class="action-btn primary" style="flex: 1; min-width: 80px;">📋 コピー</button>
          <button id="quick-download-json" class="action-btn">💾 保存</button>
          <button id="quick-import-json" class="action-btn">📥 読込</button>
          <button id="quick-reset-json" class="action-btn">🔄 リセット</button>
        </div>
      </div>

      <!-- VRM Model Selector -->
      <div class="section-box">
        <label class="section-label">👤 モデル切替 (VRM Model)</label>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="model-buttons">
          <button data-model="${resolveAssetUrl('/models/girl.vrm')}" class="model-btn active">👧 girl.vrm</button>
          <button data-model="${resolveAssetUrl('/models/girl2.vrm')}" class="model-btn">👱‍♀️ girl2.vrm</button>
          <button id="open-local-vrm-btn" class="model-btn">📁 ファイル選択</button>
        </div>
      </div>

      <!-- Motions -->
      <div class="section-box">
        <label class="section-label">💃 モーション (Motion: 全13種)</label>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="motion-buttons">
          <button data-motion="${resolveAssetUrl('/animations/Idle.fbx')}" class="motion-btn active">待機</button>
          <button data-motion="${resolveAssetUrl('/animations/Standing Idle.fbx')}" class="motion-btn">立ち待機</button>
          <button data-motion="${resolveAssetUrl('/animations/Female Standing Pose.fbx')}" class="motion-btn">立ちポーズ</button>
          <button data-motion="${resolveAssetUrl('/animations/Walking.fbx')}" class="motion-btn">歩行</button>
          <button data-motion="${resolveAssetUrl('/animations/Jogging.fbx')}" class="motion-btn">ジョギング</button>
          <button data-motion="${resolveAssetUrl('/animations/Standing Greeting.fbx')}" class="motion-btn">挨拶</button>
          <button data-motion="${resolveAssetUrl('/animations/Quick Formal Bow.fbx')}" class="motion-btn">お辞儀</button>
          <button data-motion="${resolveAssetUrl('/animations/Acknowledging.fbx')}" class="motion-btn">うなずく</button>
          <button data-motion="${resolveAssetUrl('/animations/Dismissing Gesture.fbx')}" class="motion-btn">手を振る</button>
          <button data-motion="${resolveAssetUrl('/animations/Salute.fbx')}" class="motion-btn">敬礼</button>
          <button data-motion="${resolveAssetUrl('/animations/Excited.fbx')}" class="motion-btn">喜ぶ</button>
          <button data-motion="${resolveAssetUrl('/animations/Angry.fbx')}" class="motion-btn">怒り</button>
          <button data-motion="${resolveAssetUrl('/animations/Punching.fbx')}" class="motion-btn">パンチ</button>
          <button data-motion="none" class="motion-btn">停止</button>
        </div>
      </div>

      <!-- Expressions -->
      <div class="section-box">
        <label class="section-label">😄 表情 (Expression)</label>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="expression-buttons">
          <button data-expr="neutral" class="expr-btn active">通常</button>
          <button data-expr="happy" class="expr-btn">笑顔</button>
          <button data-expr="angry" class="expr-btn">怒り</button>
          <button data-expr="sad" class="expr-btn">悲しみ</button>
          <button data-expr="surprised" class="expr-btn">驚き</button>
          <button data-expr="relaxed" class="expr-btn">リラックス</button>
          <button data-expr="aa" class="expr-btn">あ</button>
          <button data-expr="ee" class="expr-btn">え</button>
          <button data-expr="oh" class="expr-btn">お</button>
        </div>
      </div>

      <!-- Manga Emotion Effect Texts -->
      <div class="section-box" style="border-left: 3px solid #ec4899; padding-left: 2px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <label class="section-label" style="color: #db2777; font-weight: 700;">💬 感情エフェクト文字 (Emotion Text)</label>
          <button id="quick-clear-effect-text-btn" style="font-size: 10px; padding: 2px 6px; background: #fdf2f8; border: 1px solid #fbcfe8; color: #db2777; border-radius: 4px; cursor: pointer; font-weight: 600;">全消去</button>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;" id="effect-text-buttons">
          <button class="effect-text-btn" data-preset="wanawana" data-text="ワナワナ" data-expr="angry" style="background: #fdf4ff; border-color: #f0abfc; color: #a21caf;">🟣 ワナワナ</button>
          <button class="effect-text-btn" data-preset="iraira" data-text="イライラ" data-expr="angry" style="background: #fef2f2; border-color: #fca5a5; color: #dc2626;">🔴 イライラ</button>
          <button class="effect-text-btn" data-preset="gaan" data-text="ガーン" data-expr="sad" style="background: #eff6ff; border-color: #93c5fd; color: #1d4ed8;">🔵 ガーン</button>
          <button class="effect-text-btn" data-preset="kirakira" data-text="キラキラ" data-expr="happy" style="background: #fefce8; border-color: #fde047; color: #ca8a04;">✨ キラキラ</button>
          <button class="effect-text-btn" data-preset="shiin" data-text="しーん" data-expr="neutral" style="background: #f8fafc; border-color: #cbd5e1; color: #475569;">⚪ しーん</button>
          <button class="effect-text-btn" data-preset="doki" data-text="ドキドキ" data-expr="happy" style="background: #fff1f2; border-color: #fda4af; color: #e11d48;">💖 ドキドキ</button>
          <button class="effect-text-btn" data-preset="biku" data-text="ビクッ！" data-expr="surprised" style="background: #fef9c3; border-color: #facc15; color: #854d0e;">⚡ ビクッ！</button>
          <button class="effect-text-btn" data-preset="kirakira" data-text="やったー！" data-expr="happy" style="background: #f0fdf4; border-color: #86efac; color: #15803d;">🎉 やったー！</button>
          <button class="effect-text-btn" data-preset="wanawana" data-text="ゾクッ…" data-expr="surprised" style="background: #faf5ff; border-color: #d8b4fe; color: #7e22ce;">🥶 ゾクッ…</button>
        </div>
        <div style="display: flex; gap: 4px; margin-top: 3px;">
          <input type="text" id="quick-custom-effect-text" placeholder="自由な文字 (例: ぷんぷん)" style="flex: 1; min-width: 0; padding: 4px 6px; font-size: 11px; border: 1px solid #cbd5e1; border-radius: 4px;">
          <select id="quick-custom-effect-preset" style="font-size: 10.5px; padding: 4px 2px; border: 1px solid #cbd5e1; border-radius: 4px; background: white;">
            <option value="kirakira">✨ キラキラ</option>
            <option value="wanawana">🟣 ワナワナ</option>
            <option value="iraira">🔴 イライラ</option>
            <option value="gaan">🔵 ガーン</option>
            <option value="shiin">⚪ しーん</option>
            <option value="doki">💖 ドキドキ</option>
            <option value="biku">⚡ ビクッ</option>
          </select>
          <button id="quick-custom-effect-btn" class="action-btn primary" style="padding: 4px 8px; font-size: 11px; background: #db2777; border-color: #be185d;">表示</button>
        </div>
      </div>

      <!-- Short Animation Controls -->
      <div class="section-box">
        <label class="section-label">🎬 ショートアニメーション</label>
        <div style="display: flex; gap: 4px;">
          <button id="anim-play-btn" class="action-btn primary" style="flex: 1;">▶ アニメーション再生</button>
          <button id="anim-stop-btn" class="action-btn">■ 停止</button>
        </div>
      </div>

      <!-- Conversation Scenario Sequence Controls -->
      <div class="section-box" style="border-left: 3px solid #8b5cf6;">
        <label class="section-label" style="color: #6d28d9; font-weight: 700;">🎭 会話連動アニメーション (セリフ1〜3連続)</label>
        <div style="display: flex; gap: 4px; margin-bottom: 4px;">
          <button id="scenario-play-btn" class="action-btn primary" style="flex: 1; background: #6d28d9;">▶ 会話シーケンス再生</button>
          <button id="scenario-stop-btn" class="action-btn">■ 停止</button>
        </div>
        <div id="scenario-status-box" style="display: none; padding: 6px 8px; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; font-size: 11px;">
          <div style="display: flex; align-items: center; justify-content: space-between; font-weight: 700; color: #6d28d9;">
            <span id="scenario-current-step">Step 1: 手を振る</span>
            <span style="font-size: 10px; color: #7c3aed;">再生中...</span>
          </div>
          <div id="scenario-current-text" style="color: #4b5563; margin-top: 2px; font-size: 10.5px; font-style: italic;"></div>
        </div>
      </div>

      <!-- Interactive Branching Scenario Controls -->
      <div class="section-box" style="border-left: 3px solid #ec4899; background: #fdf2f8;">
        <label class="section-label" style="color: #db2777; font-weight: 700;">🌸 インタラクティブ・シナリオ (選択肢・感情エフェクト)</label>
        <div style="display: flex; gap: 4px; margin-bottom: 4px;">
          <button id="scenario-confession-btn" class="action-btn primary" style="flex: 1; background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); font-weight: 700; box-shadow: 0 4px 12px rgba(219, 39, 119, 0.25); font-size: 12.5px; padding: 10px 8px;">🌸 告白イベントシナリオ再生</button>
          <button id="scenario-confession-stop-btn" class="action-btn">■ 停止</button>
        </div>
        <div style="font-size: 10px; color: #9d174d; line-height: 1.4; margin-top: 3px;">
          ※クリックで会話送り・タイピングスキップ。選択肢（告白/500円/沈黙）で分岐し、ドキドキ・ガーン・シーン等の感情エフェクトが発動します。
        </div>
      </div>

      <!-- Audio Lip-Sync & Player -->
      <div class="section-box">
        <label class="section-label">🎵 音声リップシンク ＆ プレイヤー</label>
        <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px;">
          <button id="sample-voice-default" class="model-btn voice-btn active" data-voice="${resolveAssetUrl('/voices/001.wav')}">🎙️ 001.wav</button>
          <button class="model-btn voice-btn" data-voice="${resolveAssetUrl('/voices/scenario_01.wav')}">🎙️ 1. ストーカー？</button>
          <button class="model-btn voice-btn" data-voice="${resolveAssetUrl('/voices/scenario_02.wav')}">🎙️ 2. 冗談だ</button>
          <button class="model-btn voice-btn" data-voice="${resolveAssetUrl('/voices/scenario_03.wav')}">🎙️ 3. 何してるの？</button>
          <button id="open-audio-file-btn" class="model-btn" style="flex: 1; min-width: 90px;">📁 音声を開く</button>
        </div>
        <div class="player-box">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span id="audio-title" style="font-size: 11px; font-weight: 600; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">001.wav</span>
            <span id="audio-time" style="font-size: 10px; color: #64748b; font-family: monospace;">0:00 / 0:00</span>
          </div>
          <input type="range" id="audio-seekbar" min="0" max="100" value="0" step="0.1" style="width: 100%; cursor: pointer; accent-color: #4f46e5; height: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
            <div style="display: flex; gap: 4px;">
              <button id="audio-play-pause-btn" style="padding: 3px 8px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">▶ 再生</button>
              <button id="audio-stop-btn" style="padding: 3px 6px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; font-size: 11px;">⏹ 停止</button>
              <button id="audio-loop-btn" style="padding: 3px 6px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; font-size: 11px;">🔁 ループ</button>
            </div>
            <div style="display: flex; align-items: center; gap: 2px;">
              <span style="font-size: 10px;">🔊</span>
              <input type="range" id="audio-volume" min="0" max="1" step="0.05" value="1" style="width: 50px; accent-color: #4f46e5; height: 4px; cursor: pointer;">
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
            <span style="font-size: 10px; color: #64748b; min-width: 45px;">判定音素:</span>
            <div style="display: flex; gap: 3px; flex: 1;">
              <span class="phoneme-tag" data-phoneme="aa">あ</span>
              <span class="phoneme-tag" data-phoneme="ih">い</span>
              <span class="phoneme-tag" data-phoneme="ou">う</span>
              <span class="phoneme-tag" data-phoneme="ee">え</span>
              <span class="phoneme-tag" data-phoneme="oh">お</span>
              <span class="phoneme-tag active" data-phoneme="nn">閉</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Scene & Lighting Presets (Park 3, School Gate 3, Indoor 2) -->
      <div class="section-box" style="border-left: 3px solid #f59e0b;">
        <label class="section-label" style="color: #d97706; font-weight: 700;">🌅 シーン・ライティング (Scene & Lighting)</label>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <!-- Park -->
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 10.5px; color: #64748b; font-weight: 600;">🌳 公園</span>
            <span style="font-size: 10px; color: #94a3b8;">朝 / 夕</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px;">
            <button data-scene="morning_park" class="scene-preset-btn" title="青空・強い太陽光・昼光フレア（多層）">🌅 朝</button>
            <button data-scene="evening_park" class="scene-preset-btn active" title="茜色夕日・西日光条・夕焼けフレア（多層）">🌇 夕方</button>
          </div>
          <!-- School Gate -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 2px;">
            <span style="font-size: 10.5px; color: #64748b; font-weight: 600;">🏫 校門</span>
            <span style="font-size: 10px; color: #94a3b8;">朝 / 夕</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px;">
            <button data-scene="morning_school" class="scene-preset-btn" title="青空・澄んだ朝陽・校門">🌅 朝</button>
            <button data-scene="evening_school" class="scene-preset-btn" title="茜色夕焼け・西日・校門">🌇 夕方</button>
          </div>
          <!-- Indoor Classroom -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 2px;">
            <span style="font-size: 10.5px; color: #64748b; font-weight: 600;">🏠 室内 (教室)</span>
            <span style="font-size: 10px; color: #94a3b8;">明るい / 暗い</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px;">
            <button data-scene="bright_indoor" class="scene-preset-btn" title="教室背景・均一で明るい室内照明">💡 明るい</button>
            <button data-scene="dark_indoor" class="scene-preset-btn" title="教室背景・薄暗い間接照明・夜光">🌙 暗い</button>
          </div>
        </div>
      </div>

      <!-- Background selector -->
      <div class="section-box">
        <label class="section-label">🌄 背景 (Background)</label>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="bg-buttons">
          <button data-bg="${resolveAssetUrl('/textures/modern-park-far.jpg')}" data-mid="${resolveAssetUrl('/textures/modern-park-mid.jpg')}" class="bg-btn active">🌳 近代公園 (多層)</button>
          <button data-bg="${resolveAssetUrl('/textures/school-gate-far.jpeg')}" class="bg-btn">🏫 校門</button>
          <button data-bg="${resolveAssetUrl('/textures/school-corridor-far.jpg')}" class="bg-btn">🏫 教室</button>
          <button data-bg="${resolveAssetUrl('/textures/park-background.jpg')}" class="bg-btn">🌲 旧公園</button>
          <button data-bg="none" class="bg-btn">OFF (単色)</button>
        </div>
      </div>

      <!-- lil-gui mount container -->
      <div class="section-box" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
        <label class="section-label" style="color: #6366f1; font-size: 12px; margin-bottom: 2px;">⚙️ 詳細パラメータ調整</label>
        <div id="gui-mount-point"></div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // Setup Minimize / Open toggle
  let isPanelOpen = true;
  setPanelOpen = (open: boolean) => {
    isPanelOpen = open;
    panel.style.display = isPanelOpen ? 'flex' : 'none';
    gearBtn.style.display = isPanelOpen ? 'none' : 'flex';
  };

  document.getElementById('panel-close-btn')?.addEventListener('click', () => {
    setPanelOpen(false);
  });

  gearBtn.addEventListener('click', () => {
    setPanelOpen(true);
  });

  // Setup lil-gui inside gui-mount-point
  const mountPoint = document.getElementById('gui-mount-point');
  if (mountPoint) {
    setupGUI(mountPoint);
  }

  // Setup Quick JSON Actions
  document.getElementById('quick-copy-json')?.addEventListener('click', async () => {
    const ok = await copyConfigToClipboard(currentConfig);
    showToast(ok ? '📋 設定JSONをクリップボードにコピーしました！' : 'コピーに失敗しました');
  });

  document.getElementById('quick-download-json')?.addEventListener('click', () => {
    downloadConfigJSON(currentConfig);
    showToast('💾 avatar-config.json をダウンロードしました');
  });

  document.getElementById('quick-import-json')?.addEventListener('click', () => {
    openImportModal();
  });

  document.getElementById('quick-reset-json')?.addEventListener('click', () => {
    deepAssign(currentConfig, DEFAULT_CONFIG);
    applyConfigToSceneAndRenderer(currentConfig);
    gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
    syncSceneButtons();
    syncBgButtons();
    showToast('🔄 デフォルト設定にリセットしました');
  });

  // Scene Preset Buttons
  const sceneButtons = document.querySelectorAll<HTMLButtonElement>('.scene-preset-btn');
  sceneButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const sceneId = btn.getAttribute('data-scene') as ScenePresetId;
      if (sceneId) {
        switchScene(sceneId);
      }
    });
  });
  syncSceneButtons();

  // Animation Play/Stop
  document.getElementById('anim-play-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    animationPlayer.play();
    showToast('🎬 ショートアニメーションを再生します');
  });

  document.getElementById('anim-stop-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    animationPlayer.stop();
    showToast('⏹ アニメーションを停止しました');
  });

  // Scenario Sequence Play/Stop
  document.getElementById('scenario-play-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (scenarioPlayer.isPlaying) {
      scenarioPlayer.stop();
    } else {
      if (scenarioEngine.isPlaying) scenarioEngine.stop();
      if (animationPlayer.isPlaying) animationPlayer.stop();
      scenarioPlayer.play();
    }
  });

  document.getElementById('scenario-stop-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    scenarioPlayer.stop();
  });

  // Interactive Confession Scenario Play/Stop
  document.getElementById('scenario-confession-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (scenarioEngine.isPlaying) {
      scenarioEngine.stop();
    } else {
      if (scenarioPlayer.isPlaying) scenarioPlayer.stop();
      if (animationPlayer.isPlaying) animationPlayer.stop();
      scenarioEngine.play(PARK_CONFESSION_SCENARIO);
      showToast('🌸 告白イベントシナリオを開始しました');
    }
  });

  document.getElementById('scenario-confession-stop-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    scenarioEngine.stop();
    showToast('⏹ シナリオを停止しました');
  });

  // Background Buttons
  const bgButtons = document.querySelectorAll<HTMLButtonElement>('.bg-btn');
  bgButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const bg = btn.getAttribute('data-bg');
      const mid = btn.getAttribute('data-mid');
      if (bg === 'none') {
        currentConfig.environment.showBackgroundImage = false;
        currentConfig.environment.showMidground = false;
      } else if (bg) {
        currentConfig.environment.showBackgroundImage = true;
        currentConfig.environment.backgroundImageUrl = bg;
        if (mid) {
          currentConfig.environment.showMidground = true;
          currentConfig.environment.midgroundImageUrl = mid;
        } else {
          currentConfig.environment.showMidground = false;
        }
      }
      updateBackgroundDisplay(currentConfig);
      updateMidgroundDisplay(currentConfig);
      syncBgButtons();
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });
  });

  // Model Buttons
  const modelButtons = document.querySelectorAll<HTMLButtonElement>('.model-btn');
  modelButtons.forEach((btn) => {
    if (btn.classList.contains('voice-btn') || btn.id === 'open-audio-file-btn') return;
    btn.addEventListener('click', () => {
      const modelUrl = btn.getAttribute('data-model');
      if (modelUrl) {
        modelButtons.forEach((b) => {
          if (!b.classList.contains('voice-btn') && b.id !== 'open-audio-file-btn') {
            b.classList.remove('active');
          }
        });
        btn.classList.add('active');
        loadAvatarModel(modelUrl);
      }
    });
  });

  document.getElementById('open-local-vrm-btn')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vrm';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const blobUrl = URL.createObjectURL(file);
        modelButtons.forEach((b) => {
          if (!b.classList.contains('voice-btn') && b.id !== 'open-audio-file-btn') {
            b.classList.remove('active');
          }
        });
        document.getElementById('open-local-vrm-btn')?.classList.add('active');
        loadAvatarModel(blobUrl);
      }
    };
    input.click();
  });

  // Motion Buttons
  const motionButtons = document.querySelectorAll<HTMLButtonElement>('.motion-btn');
  motionButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      motionButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const motionUrl = btn.getAttribute('data-motion');
      if (!avatarInstance) return;

      if (motionUrl === 'none') {
        avatarInstance.stopAnimation();
      } else if (motionUrl) {
        const isLoop = isMotionLoop(motionUrl);
        await avatarInstance.playAnimation(motionUrl, isLoop);
      }
    });
  });

  // Expression Buttons
  const exprButtons = document.querySelectorAll<HTMLButtonElement>('.expr-btn');
  exprButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      exprButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const expr = btn.getAttribute('data-expr');
      if (expr) {
        currentExprName = expr;
        if (avatarInstance) {
          avatarInstance.setExpression(expr, 1.0);
        }
      }
    });
  });

  // Manga Emotion Effect Text Buttons
  document.querySelectorAll<HTMLButtonElement>('.effect-text-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset') || 'wanawana';
      const text = btn.getAttribute('data-text') || 'ワナワナ';
      const expr = btn.getAttribute('data-expr');

      if (avatarInstance) {
        if (expr) {
          avatarInstance.setExpression(expr, 1.0);
          exprButtons.forEach((b) => {
            b.classList.toggle('active', b.getAttribute('data-expr') === expr);
          });
        }
        avatarInstance.showEffectText({
          text,
          stylePreset: preset,
          anchor: 'head',
        });
        showToast(`💬 「${text}」を表示しました`);
      }
    });
  });

  // Custom Effect Text Trigger
  const customEffectInput = document.getElementById('quick-custom-effect-text') as HTMLInputElement | null;
  const customEffectPreset = document.getElementById('quick-custom-effect-preset') as HTMLSelectElement | null;
  const customEffectBtn = document.getElementById('quick-custom-effect-btn');

  const triggerCustomEffect = () => {
    const text = customEffectInput?.value.trim() || 'キラキラ';
    const preset = customEffectPreset?.value || 'kirakira';
    if (avatarInstance) {
      avatarInstance.showEffectText({
        text,
        stylePreset: preset,
        anchor: 'head',
      });
      showToast(`💬 「${text}」を表示しました`);
    }
  };

  customEffectBtn?.addEventListener('click', triggerCustomEffect);
  customEffectInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      triggerCustomEffect();
    }
  });

  // Quick Clear Button
  document.getElementById('quick-clear-effect-text-btn')?.addEventListener('click', () => {
    avatarInstance?.effectTextManager?.clear();
    showToast('🧹 全てのエフェクト文字をクリアしました');
  });

  // Audio LipSync Controls
  const audioTitleEl = document.getElementById('audio-title');
  const playPauseBtn = document.getElementById('audio-play-pause-btn');
  const stopBtn = document.getElementById('audio-stop-btn');
  const loopBtn = document.getElementById('audio-loop-btn');
  const seekbar = document.getElementById('audio-seekbar') as HTMLInputElement | null;
  const volumeSlider = document.getElementById('audio-volume') as HTMLInputElement | null;

  document.getElementById('open-audio-file-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (file) {
        audioLipSync.loadAudioFile(file);
        if (audioTitleEl) audioTitleEl.textContent = file.name;
        document.querySelectorAll<HTMLButtonElement>('.voice-btn').forEach((b) => b.classList.remove('active'));
        audioLipSync.play();
        showToast(`🎵 音声ファイルを読み込みました: ${file.name}`);
      }
    };
    input.click();
  });

  document.querySelectorAll<HTMLButtonElement>('.voice-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const voiceUrl = btn.getAttribute('data-voice');
      if (voiceUrl) {
        document.querySelectorAll<HTMLButtonElement>('.voice-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const title = btn.textContent || 'サンプル音声';
        audioLipSync.loadAudioUrl(voiceUrl, title);
        if (audioTitleEl) audioTitleEl.textContent = title;
        audioLipSync.play();
        showToast(`🎙️ ${title} を再生します`);
      }
    });
  });

  playPauseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!audioLipSync.audioElement.src) {
      const sampleBtn = document.getElementById('sample-voice-default') as HTMLButtonElement | null;
      sampleBtn?.click();
      return;
    }
    if (audioLipSync.isPlaying) {
      audioLipSync.pause();
    } else {
      audioLipSync.play();
    }
  });

  stopBtn?.addEventListener('click', () => {
    audioLipSync.stop();
  });

  let isLooping = false;
  loopBtn?.addEventListener('click', () => {
    isLooping = !isLooping;
    audioLipSync.setLoop(isLooping);
    loopBtn.classList.toggle('active', isLooping);
    loopBtn.style.background = isLooping ? '#4f46e5' : '#f1f5f9';
    loopBtn.style.color = isLooping ? '#ffffff' : '#334155';
    showToast(isLooping ? '🔁 ループ再生 ON' : '🔁 ループ再生 OFF');
  });

  seekbar?.addEventListener('input', () => {
    const percent = parseFloat(seekbar.value);
    const duration = audioLipSync.audioElement.duration || 0;
    if (duration > 0) {
      const targetTime = (percent / 100) * duration;
      audioLipSync.seek(targetTime);
    }
  });

  volumeSlider?.addEventListener('input', () => {
    const vol = parseFloat(volumeSlider.value);
    audioLipSync.setVolume(vol);
  });
}

setupUnifiedUI();

// Initial load of default voice (001.wav)
audioLipSync.loadAudioUrl(resolveAssetUrl('/voices/001.wav'), '001.wav');


// --------------------------------------------------
// Resize & Render Loop
// --------------------------------------------------
const clock = new THREE.Clock();

function onResize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  composer.setSize(width, height);
}
window.addEventListener('resize', onResize);

function tick(): void {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;

  if (animationPlayer.isPlaying) {
    animationPlayer.update(delta);
  } else {
    controls.update();
  }

  // Keep midground properly aligned to camera perspective
  updateMidgroundTransform();

  if (avatarInstance) {
    // Apply real-time lip sync if enabled
    if (currentConfig.lipSync.enabled) {
      avatarInstance.updateLipSync(
        audioLipSync.currentPhoneme,
        currentConfig.lipSync.gain,
        currentConfig.lipSync.smoothing,
        delta
      );
    }

    avatarInstance.update(delta, elapsed, () => {
      windController.update(avatarInstance?.vrm ?? null, currentConfig.wind, elapsed);
    });
  }

  // Update Wind Particles
  windParticles.update(delta, elapsed, currentConfig.wind, windController.currentWindVector);

  // Update Sun & Lens Flare effect
  const vrmMeshes: THREE.Object3D[] = [];
  if (avatarInstance?.vrm?.scene) {
    vrmMeshes.push(avatarInstance.vrm.scene);
  }
  const sunInfo = sunEffect.update(
    camera,
    delta,
    elapsed,
    currentConfig,
    dirLight,
    vrmMeshes
  );

  // Update God Rays Pass uniforms & enabled state
  const sunShaftsEnabled = currentConfig.lighting.sunShafts?.enabled ?? false;
  godRaysPass.enabled = sunShaftsEnabled;
  if (sunShaftsEnabled) {
    godRaysPass.uniforms['uSunPosition'].value.copy(sunInfo.sunScreenPosition);
    godRaysPass.uniforms['uSunVisibility'].value = sunInfo.sunVisibility;
    godRaysPass.uniforms['uExposure'].value = currentConfig.lighting.sunShafts.exposure;
    godRaysPass.uniforms['uDecay'].value = currentConfig.lighting.sunShafts.decay;
    godRaysPass.uniforms['uDensity'].value = currentConfig.lighting.sunShafts.density;
    godRaysPass.uniforms['uWeight'].value = currentConfig.lighting.sunShafts.weight;
    (godRaysPass.uniforms['uRayColor'].value as THREE.Color).set(currentConfig.lighting.sunShafts.color);
    godRaysPass.uniforms['uShimmer'].value = currentConfig.lighting.sunShafts.shimmer;
    godRaysPass.uniforms['uTime'].value = elapsed;
  }

  const usePost = currentConfig.postProcessing.bloom.enabled ||
                  currentConfig.lighting.sunShafts?.enabled ||
                  currentConfig.postProcessing.colorGrading.enabled ||
                  currentConfig.postProcessing.saturation !== 0 ||
                  currentConfig.postProcessing.brightness !== 0 ||
                  currentConfig.postProcessing.contrast !== 0;

  if (usePost) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }

  requestAnimationFrame(tick);
}


tick();

