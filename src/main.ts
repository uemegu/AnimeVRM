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
import { ColorHistogram } from './histogram/ColorHistogram';
import { TypographyOverlay } from './animation/TypographyOverlay';
import { ShortAnimationPlayer } from './animation/ShortAnimationPlayer';
import { ScenarioPlayer } from './animation/ScenarioPlayer';
import { ScenarioEngine } from './scenario/ScenarioEngine';
import { DialogueCameraController } from './scenario/DialogueCameraController';
import { PARK_CONFESSION_SCENARIO, getParkConfessionScenario } from './scenario/parkConfessionScenario';
import { getTwoGirlsConversationScenario } from './scenario/twoGirlsConversationScenario';
import { ScenarioCharacterPlacement, AvatarSlotPosition, AVATAR_POSITION_PRESETS, AVATAR_ROTATION_PRESETS } from './scenario/types';
import { MasterDataManager } from './master/MasterDataManager';
import { WindController, WIND_PRESETS } from './wind/WindController';
import { WindParticles } from './wind/WindParticles';
import { RainEffect, DEFAULT_RAIN_CONFIG } from './effects/rain';
import { EffectTextManager } from './effects/text';
import { getLanguage, setLanguage, t, onLanguageChange, Language } from './i18n';
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
  TimeOfDayId,
  LocationId,
  getScenePreset,
  getTimeOfDayPreset,
  getLocationPreset,
  SCENE_PRESETS,
  TIME_OF_DAY_PRESETS,
  LOCATION_PRESETS,
  createCombinedSceneConfig,
} from './presets/ScenePresets';

// Active configuration state
const currentConfig: AvatarConfig = cloneConfig(DEFAULT_CONFIG);

const windController = new WindController();

function getActiveTimeOfDay(): TimeOfDayId {
  const tod = currentConfig.activeScene?.timeOfDay as TimeOfDayId;
  if (tod && tod in TIME_OF_DAY_PRESETS) {
    return tod;
  }
  return 'morning';
}

function getScenePresetIdFromState(tod: TimeOfDayId, loc?: string): ScenePresetId {
  if (loc === 'school_gate') {
    if (tod === 'morning') return 'morning_school';
    if (tod === 'day') return 'day_school';
    if (tod === 'evening') return 'evening_school';
    if (tod === 'rainy') return 'rainy_school';
  } else if (loc === 'classroom') {
    if (tod === 'dark_indoor') return 'dark_indoor';
    return 'bright_indoor';
  }
  if (tod === 'morning') return 'morning_park';
  if (tod === 'day') return 'day_park';
  if (tod === 'evening') return 'evening_park';
  if (tod === 'rainy') return 'rainy_park';
  if (tod === 'dark_indoor') return 'dark_indoor';
  if (tod === 'bright_indoor') return 'bright_indoor';
  return 'morning_park';
}

function getActivePresetId(): ScenePresetId {
  if (currentConfig.activeScene?.presetId && currentConfig.activeScene.presetId in SCENE_PRESETS) {
    return currentConfig.activeScene.presetId as ScenePresetId;
  }
  const tod = getActiveTimeOfDay();
  const loc = currentConfig.activeScene?.location;
  return getScenePresetIdFromState(tod, loc);
}

function syncTimeOfDayButtons(): void {
  const activeTod = getActiveTimeOfDay();
  const todButtons = document.querySelectorAll<HTMLButtonElement>('.timeofday-btn');
  todButtons.forEach((btn) => {
    const id = btn.getAttribute('data-timeofday');
    btn.classList.toggle('active', id === activeTod);
  });
}

function applySceneConfig(combined: {
  environment: AvatarConfig['environment'];
  lighting: AvatarConfig['lighting'];
  postProcessing: AvatarConfig['postProcessing'];
  materials: AvatarConfig['materials'];
  outline: AvatarConfig['outline'];
  wind: AvatarConfig['wind'];
  rain: AvatarConfig['rain'];
}): void {
  currentConfig.environment = JSON.parse(JSON.stringify(combined.environment));
  currentConfig.lighting = JSON.parse(JSON.stringify(combined.lighting));
  currentConfig.postProcessing = JSON.parse(JSON.stringify(combined.postProcessing));
  currentConfig.materials = JSON.parse(JSON.stringify(combined.materials));
  currentConfig.outline = JSON.parse(JSON.stringify(combined.outline));
  currentConfig.wind = JSON.parse(JSON.stringify(combined.wind));
  currentConfig.rain = JSON.parse(JSON.stringify(combined.rain));

  applyConfigToSceneAndRenderer(currentConfig);
  updateAllGuisDisplay();
  syncTimeOfDayButtons();
  syncBgButtons();
}

function switchTimeOfDay(timeOfDayId: TimeOfDayId, notify = true): void {
  const currentLoc = (currentConfig.activeScene?.location || 'modern_park') as LocationId;
  const currentPresetId = getScenePresetIdFromState(timeOfDayId, currentLoc);
  currentConfig.activeScene = {
    presetId: currentPresetId,
    timeOfDay: timeOfDayId,
    location: currentLoc,
  };

  const combined = createCombinedSceneConfig(timeOfDayId, currentLoc);
  applySceneConfig(combined);

  const todPreset = getTimeOfDayPreset(timeOfDayId);
  if (notify) {
    showToast(`${t().toasts.sceneChanged}${todPreset.name}`);
  }
}

function switchLocation(locationId: LocationId, notify = false): void {
  const currentTod = (currentConfig.activeScene?.timeOfDay || 'morning') as TimeOfDayId;
  const currentPresetId = getScenePresetIdFromState(currentTod, locationId);
  currentConfig.activeScene = {
    presetId: currentPresetId,
    timeOfDay: currentTod,
    location: locationId,
  };

  const combined = createCombinedSceneConfig(currentTod, locationId);
  applySceneConfig(combined);

  const loc = getLocationPreset(locationId);
  if (notify) {
    showToast(`${loc.name}`);
  }
}

function switchScene(presetId: ScenePresetId, notify = true): void {
  const preset = getScenePreset(presetId);
  const tod = (presetId.startsWith('morning')
    ? 'morning'
    : presetId.startsWith('day')
    ? 'day'
    : presetId.startsWith('evening')
    ? 'evening'
    : presetId.startsWith('rainy')
    ? 'rainy'
    : presetId === 'bright_indoor'
    ? 'bright_indoor'
    : presetId === 'dark_indoor'
    ? 'dark_indoor'
    : 'morning') as TimeOfDayId;

  const loc = (presetId.includes('school')
    ? 'school_gate'
    : presetId.includes('indoor')
    ? 'classroom'
    : 'modern_park') as LocationId;

  currentConfig.activeScene = {
    presetId,
    location: loc,
    timeOfDay: tod,
  };

  const combined = createCombinedSceneConfig(tod, loc);
  applySceneConfig(combined);

  if (notify) {
    showToast(`${t().toasts.sceneChanged}${preset.name}`);
  }
}


import { AvatarChatController } from './ai/AvatarChatController';

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
// AI Avatar Chat Controller
// --------------------------------------------------
const avatarChatController = new AvatarChatController();
avatarChatController.setAudioLipSync(audioLipSync);
let isTtsGpuExclusive = false;

// --------------------------------------------------
// Viewport & 16:9 Aspect Ratio Calculation
// --------------------------------------------------
function getViewportSize(): { width: number; height: number } {
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const targetAspect = 16 / 9;
  const windowAspect = windowWidth / windowHeight;

  let width: number;
  let height: number;

  if (windowAspect > targetAspect) {
    // Window is wider than 16:9 -> Fit to height (pillarboxing)
    height = windowHeight;
    width = Math.round(height * targetAspect);
  } else {
    // Window is taller than 16:9 -> Fit to width (letterboxing)
    width = windowWidth;
    height = Math.round(width / targetAspect);
  }

  return { width, height };
}

// --------------------------------------------------
// Renderer
// --------------------------------------------------
const canvas = document.querySelector<HTMLCanvasElement>('#app')!;
const initialViewport = getViewportSize();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});

renderer.setSize(initialViewport.width, initialViewport.height, false);
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
const effectTextScene = new THREE.Scene();
const sharedEffectTextManager = new EffectTextManager(effectTextScene);

const windParticles = new WindParticles(scene);
const rainEffect = new RainEffect(scene, currentConfig.rain);

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
  const container = document.getElementById('viewport-container');
  if (cfg.environment.showBackgroundImage && cfg.environment.backgroundImageUrl) {
    if (container) container.style.backgroundColor = '#000000';
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
    if (container) container.style.backgroundColor = cfg.environment.backgroundColor;
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

let dialogueCameraController: DialogueCameraController | null = null;

function updateBackgroundZoom(): void {
  if (!scene.background || !(scene.background instanceof THREE.Texture)) return;
  const bgTex = scene.background;

  if (dialogueCameraController?.isActive) {
    const bgTrans = dialogueCameraController.getBackgroundTransform();
    const zoom = Math.max(1.0, bgTrans.zoomScale);
    const invZoom = 1.0 / zoom;
    bgTex.center.set(0.5, 0.5);
    bgTex.repeat.set(invZoom, invZoom);
    bgTex.offset.set(
      (1 - invZoom) * 0.5 - bgTrans.panOffsetX,
      (1 - invZoom) * 0.5 - bgTrans.panOffsetY
    );
  } else {
    if (bgTex.repeat.x !== 1 || bgTex.repeat.y !== 1 || bgTex.offset.x !== 0 || bgTex.offset.y !== 0) {
      bgTex.center.set(0, 0);
      bgTex.repeat.set(1, 1);
      bgTex.offset.set(0, 0);
    }
  }
}

function updateMidgroundTransform(): void {
  if (!midgroundMesh.visible || typeof controls === 'undefined' || typeof camera === 'undefined') return;

  const cfg = currentConfig.environment;
  const offsetX = cfg.midgroundPosition?.x ?? 0;
  const offsetY = (cfg.midgroundPosition?.y ?? 1.35) - 1.35;
  const baseScaleMul = cfg.midgroundScale ?? 1.15;

  // 会話カメラズーム連動 (Dialogue Camera Zoom)
  let zoomMultiplier = 1.0;
  let panZoomOffsetX = 0;
  let panZoomOffsetY = 0;
  if (dialogueCameraController?.isActive) {
    const bgTrans = dialogueCameraController.getBackgroundTransform();
    zoomMultiplier = bgTrans.zoomScale;
    panZoomOffsetX = bgTrans.panOffsetX;
    panZoomOffsetY = bgTrans.panOffsetY;
  }
  const scaleMul = baseScaleMul * zoomMultiplier;

  // パン（平行移動）による移動量のみを算出（回転時は 0 のまま）
  const panDeltaX = controls.target.x - initialControlsTarget.x;
  const panDeltaY = controls.target.y - initialControlsTarget.y;

  // カメラの視線ベクトル（正規化）
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);

  // カメラの上方向・右方向ベクトル
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();

  // カメラ正面のアバター（target）の背後（+0.3m）に配置し、パン（平行移動）のオフセットのみを適用
  const targetDist = camera.position.distanceTo(controls.target);
  const baseDist = Math.max(targetDist + 0.3, 2.1);
  const planePos = camera.position.clone()
    .addScaledVector(forward, baseDist)
    .addScaledVector(right, offsetX - panDeltaX + panZoomOffsetX * 0.8)
    .addScaledVector(up, offsetY - panDeltaY + panZoomOffsetY * 0.8);

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
  16 / 9,
  0.05,
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

let avatarInstance: Avatar | null = null;
let currentModelUrl = resolveAssetUrl('/models/girl.vrm');
let currentMotionUrl = resolveAssetUrl('/animations/Idle.fbx');
let currentExprName = 'neutral';
const scenarioAvatars = new Map<string, Avatar>();
let isMultiAvatarScenarioActive = false;

const masterManager = new MasterDataManager();

// --------------------------------------------------
// Dialogue Camera Controller (話者ズーム＆背景ズーム連動)
// --------------------------------------------------
dialogueCameraController = new DialogueCameraController({
  camera,
  controls,
  getAvatar: (charId?: string) => {
    if (isMultiAvatarScenarioActive) {
      if (charId && scenarioAvatars.has(charId)) {
        return scenarioAvatars.get(charId)!;
      }
      return scenarioAvatars.values().next().value ?? null;
    }
    return avatarInstance;
  },
  getAvatars: () => {
    if (isMultiAvatarScenarioActive) {
      return Array.from(scenarioAvatars.values());
    }
    return avatarInstance ? [avatarInstance] : [];
  },
});

const scenarioPlayer = new ScenarioPlayer({
  getAvatar: () => (isMultiAvatarScenarioActive ? scenarioAvatars.values().next().value ?? null : avatarInstance),
  getAudioLipSync: () => audioLipSync,
  onStepChange: (index, step) => {
    updateScenarioStepUI(index, step);
  },
  onApplyStepCamera: (step) => {
    dialogueCameraController?.applyScene({
      id: `step_${step.displayText || step.text}`,
      text: step.text,
      cameraZoom: step.cameraZoom,
      cameraDistance: step.cameraDistance,
      cameraPreset: step.cameraPreset,
      cameraStrength: step.cameraStrength,
      cameraStartAngle: step.cameraStartAngle,
      cameraTransitionDuration: step.cameraTransitionDuration,
      cameraTransitionEasing: step.cameraTransitionEasing,
    });
  },
  onPlayStateChange: (isPlaying) => {
    if (!isPlaying) {
      dialogueCameraController?.stop();
    }
    updateScenarioPlayStateUI(isPlaying);
  },
  onFinished: () => {
    dialogueCameraController?.stop();
  },
});

let savedCameraPosBeforeMultiAvatar: THREE.Vector3 | null = null;
let savedCameraTargetBeforeMultiAvatar: THREE.Vector3 | null = null;

async function setupScenarioCharacters(characters: ScenarioCharacterPlacement[]): Promise<void> {
  if (avatarInstance) {
    avatarInstance.dispose();
    avatarInstance = null;
  }
  scenarioAvatars.forEach((av) => av.dispose());
  scenarioAvatars.clear();
  windController.resetModel();

  isMultiAvatarScenarioActive = true;

  // Save current camera state before adjusting for multi-avatar scene
  if (!savedCameraPosBeforeMultiAvatar) {
    savedCameraPosBeforeMultiAvatar = camera.position.clone();
    savedCameraTargetBeforeMultiAvatar = controls.target.clone();
  }

  // Adjust camera distance to comfortably view multiple characters
  if (characters.length > 1) {
    camera.position.set(0, 1.15, 3.45);
    controls.target.set(0, 0.95, 0);
    controls.update();
  }

  const loadPromises = characters.map((placement) => {
    return new Promise<void>((resolve, reject) => {
      const modelUrl = masterManager.resolveCharacterModelUrl(placement.character) || resolveAssetUrl(placement.character);
      let posX = 0, posY = 0, posZ = 0;
      let rotY = placement.rotationY ?? 0;

      if (typeof placement.position === 'string' && placement.position in AVATAR_POSITION_PRESETS) {
        const p = AVATAR_POSITION_PRESETS[placement.position as AvatarSlotPosition];
        posX = p[0];
        posY = p[1];
        posZ = p[2];
        if (placement.rotationY === undefined && placement.position in AVATAR_ROTATION_PRESETS) {
          rotY = AVATAR_ROTATION_PRESETS[placement.position as AvatarSlotPosition];
        }
      } else if (Array.isArray(placement.position)) {
        posX = placement.position[0];
        posY = placement.position[1];
        posZ = placement.position[2];
      }

      const avatar = new Avatar(scene, camera, {
        modelUrl: modelUrl,
        defaultAnimationUrl: resolveAssetUrl('/animations/Idle.fbx'),
        position: [posX, posY, posZ],
        rotationY: rotY,
        config: currentConfig,
        autoBlink: true,
        lookAtCamera: false,
        enableBreathing: true,
        effectTextManager: sharedEffectTextManager,
        onLoaded: (loadedAvatar) => {
          scenarioAvatars.set(placement.id, loadedAvatar);
          resolve();
        },
        onError: (err) => {
          console.error(`Failed to load scenario character ${placement.id}:`, err);
          reject(err);
        },
      });
    });
  });

  await Promise.all(loadPromises);
  applyConfigToSceneAndRenderer(currentConfig);
}

async function restoreSingleAvatar(): Promise<void> {
  if (!isMultiAvatarScenarioActive) return;
  scenarioAvatars.forEach((av) => av.dispose());
  scenarioAvatars.clear();
  isMultiAvatarScenarioActive = false;

  // Restore previous camera position
  if (savedCameraPosBeforeMultiAvatar && savedCameraTargetBeforeMultiAvatar) {
    camera.position.copy(savedCameraPosBeforeMultiAvatar);
    controls.target.copy(savedCameraTargetBeforeMultiAvatar);
    controls.update();
    savedCameraPosBeforeMultiAvatar = null;
    savedCameraTargetBeforeMultiAvatar = null;
  }

  loadAvatarModel(currentModelUrl);
}

const scenarioEngine = new ScenarioEngine({
  getAvatar: (charId?: string) => {
    if (isMultiAvatarScenarioActive) {
      if (charId && scenarioAvatars.has(charId)) {
        return scenarioAvatars.get(charId)!;
      }
      return scenarioAvatars.values().next().value ?? null;
    }
    return avatarInstance;
  },
  getAvatars: () => {
    if (isMultiAvatarScenarioActive) {
      return Array.from(scenarioAvatars.values());
    }
    return avatarInstance ? [avatarInstance] : [];
  },
  getAudioLipSync: () => audioLipSync,
  masterManager,
  onPlayStateChange: (isPlaying) => {
    if (!isPlaying) {
      dialogueCameraController?.stop();
    }
    updateScenarioPlayStateUI(isPlaying);
  },
  onSceneChange: (scene, state) => {
    updateScenarioDebugUI(scene, state);
  },
  onApplySceneCamera: (scene) => {
    dialogueCameraController?.applyScene(scene);
  },
  onSwitchAvatar: async (modelUrl) => {
    loadAvatarModel(modelUrl);
  },
  onSetupScenarioCharacters: async (characters) => {
    await setupScenarioCharacters(characters);
  },
  onRestoreAvatar: async () => {
    await restoreSingleAvatar();
  },
  onSwitchScenePreset: (presetId) => {
    switchScene(presetId, false);
  },
  onFinished: () => {
    dialogueCameraController?.stop();
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
composer.setPixelRatio(pixelRatio);

// 1. Render base scene
composer.addPass(new RenderPass(scene, camera));

// 2. Bloom Pass (HDR high brightness glow)
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio),
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
    effectTextManager: sharedEffectTextManager,
    onProgress: (progress) => {
      const el = document.getElementById('progress-text');
      if (el) el.textContent = `${progress.toFixed(0)}%`;
    },
    onLoaded: (avatar) => {
      avatarChatController.setAvatar(avatar);
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
  if (isMultiAvatarScenarioActive) {
    scenarioAvatars.forEach((av) => av.applyConfig(cfg));
  } else {
    avatarInstance?.applyConfig(cfg);
  }

  // Audio Lip-Sync Settings
  if (cfg.lipSync) {
    audioLipSync.rmsThreshold = cfg.lipSync.rmsThreshold;
    audioLipSync.setAudioDelay(cfg.lipSync.audioDelay ?? 0.05);
    audioLipSync.setVoiceGender(cfg.lipSync.voiceGender ?? 'female');
  }

  // Rain Effect
  if (cfg.rain) {
    rainEffect.updateConfig(cfg.rain);
  } else {
    rainEffect.updateConfig({ enabled: false });
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
  rain: false,
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
  toggleState.rain = currentConfig.rain?.enabled ?? false;
}

let guis: GUI[] = [];

function updateAllGuisDisplay(): void {
  guis.forEach((g) => {
    try {
      g.controllersRecursive().forEach((c) => c.updateDisplay());
    } catch {
      // ignore
    }
  });
}

function destroyAllGuis(): void {
  guis.forEach((g) => {
    try {
      g.destroy();
    } catch {
      // ignore
    }
  });
  guis = [];
}



function setupStageGUI(container: HTMLElement): void {
  const tr = t();
  const stageGui = new GUI({
    title: tr.render.detailedParamsTitle,
    container,
    autoPlace: false,
  });
  guis.push(stageGui);

  // 1. Wind & SpringBone Physics Folder
  const windFolder = stageGui.addFolder(tr.gui.windFolder);

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
    .name(tr.gui.windSpeed)
    .onChange((key: string) => {
      WindController.applyPreset(currentConfig.wind, key);
      toggleState.wind = currentConfig.wind.enabled;
      updateAllGuisDisplay();
      showToast(`🍃 風プリセット適用: ${WIND_PRESETS[key]?.label || key}`);
    });

  windFolder
    .add(currentConfig.wind, 'enabled')
    .name(tr.gui.windEnabled)
    .onChange((val: boolean) => {
      toggleState.wind = val;
      updateAllGuisDisplay();
    });

  windFolder.add(currentConfig.wind, 'speed', 0.0, 5.0, 0.1).name(tr.gui.windSpeed);
  windFolder.add(currentConfig.wind, 'direction', 0, 360, 1).name(tr.gui.windDirection);
  windFolder.add(currentConfig.wind, 'elevation', -45, 45, 1).name(tr.gui.windElevation);
  windFolder.add(currentConfig.wind, 'turbulence', 0.0, 2.0, 0.05).name(tr.gui.windTurbulence);
  windFolder.add(currentConfig.wind, 'gustFrequency', 0.0, 1.0, 0.05).name(tr.gui.windGustFreq);
  windFolder.add(currentConfig.wind, 'gustStrength', 0.0, 3.0, 0.1).name(tr.gui.windGustStrength);

  const particleFolder = windFolder.addFolder(tr.gui.particlesFolder);
  particleFolder.add(currentConfig.wind.particles, 'enabled').name(tr.gui.particlesEnabled);
  particleFolder.add(currentConfig.wind.particles, 'count', 20, 500, 10).name(tr.gui.particlesCount);
  particleFolder.add(currentConfig.wind.particles, 'size', 0.005, 0.08, 0.002).name(tr.gui.particlesSize);
  particleFolder.addColor(currentConfig.wind.particles, 'color').name(tr.gui.particlesColor);
  particleFolder.add(currentConfig.wind.particles, 'opacity', 0.1, 1.0, 0.05).name(tr.gui.particlesOpacity);
  particleFolder.add(currentConfig.wind.particles, 'speedFactor', 0.2, 3.0, 0.1).name(tr.gui.particlesSpeed);
  particleFolder.close();
  windFolder.close();

  // 2. Rain Particles Folder
  if (!currentConfig.rain) currentConfig.rain = { ...DEFAULT_RAIN_CONFIG };
  const rainFolder = stageGui.addFolder('🌧️ 雨エフェクト (Rain Particles)');
  rainFolder
    .add(currentConfig.rain, 'enabled')
    .name('雨有効 (Enable)')
    .onChange((val: boolean) => {
      toggleState.rain = val;
      rainEffect.updateConfig(currentConfig.rain!);
      updateAllGuisDisplay();
    });
  rainFolder
    .add(currentConfig.rain, 'count', 100, 4000, 100)
    .name('雨量・粒子数 (Count)')
    .onChange(() => rainEffect.updateConfig(currentConfig.rain!));
  rainFolder
    .add(currentConfig.rain, 'speed', 2.0, 30.0, 0.5)
    .name('落下速度 (Speed)')
    .onChange(() => rainEffect.updateConfig(currentConfig.rain!));
  rainFolder
    .add(currentConfig.rain, 'length', 0.05, 1.0, 0.01)
    .name('雨筋の長さ (Streak Length)')
    .onChange(() => rainEffect.updateConfig(currentConfig.rain!));
  rainFolder
    .add(currentConfig.rain, 'angle', -30, 30, 1)
    .name('傾き角度 (Slant Angle)')
    .onChange(() => rainEffect.updateConfig(currentConfig.rain!));
  rainFolder
    .addColor(currentConfig.rain, 'color')
    .name('雨の色 (Rain Color)')
    .onChange(() => rainEffect.updateConfig(currentConfig.rain!));
  rainFolder
    .add(currentConfig.rain, 'opacity', 0.05, 1.0, 0.05)
    .name('不透明度 (Opacity)')
    .onChange(() => rainEffect.updateConfig(currentConfig.rain!));
  rainFolder
    .add(currentConfig.rain, 'splashEnabled')
    .name('地面の水しぶき (Splashes)')
    .onChange(() => rainEffect.updateConfig(currentConfig.rain!));
  rainFolder
    .add(currentConfig.rain, 'splashCount', 20, 500, 10)
    .name('水しぶき数 (Splash Count)')
    .onChange(() => rainEffect.updateConfig(currentConfig.rain!));
  rainFolder.close();

  // 3. Short Animation Cuts Folder
  const animFolder = stageGui.addFolder(tr.gui.animCutFolder);

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
    const cutAny = cut as any;
    cutFolder.add(cut, 'enabled').name(tr.gui.cutEnabled);
    cutFolder.add(cut, 'duration', [0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0]).name(tr.gui.cutDuration);
    cutFolder.add(cutAny, 'startAngle', cameraAngleOptions).name(tr.gui.startAngle);
    cutFolder.add(cutAny, 'cameraDistance', 0.5, 3.0, 0.1).name(tr.gui.cameraDistance);
    cutFolder.add(cutAny, 'cameraPreset', cameraPresetOptions).name(tr.gui.camera);
    cutFolder.add(cutAny, 'cameraStrength', 0.1, 5.0, 0.1).name(tr.gui.cameraStrength);
    cutFolder.add(cutAny, 'motion', motionPresetOptions).name(tr.gui.motion);

    // Back Text
    const backFolder = cutFolder.addFolder(tr.gui.backTextFolder);
    const backTextAny = cut.backText as any;
    backFolder.add(cut.backText, 'text').name(tr.gui.text);
    backFolder.add(backTextAny, 'animationPreset', textPresetOptions).name(tr.gui.animation);
    backFolder.add(cut.backText, 'x', 0, 100, 1).name('X (%)');
    backFolder.add(cut.backText, 'y', 0, 100, 1).name('Y (%)');
    backFolder.add(cut.backText, 'fontSize', 5, 40, 1).name(tr.gui.size);
    backFolder.addColor(cut.backText, 'color').name(tr.gui.textColor);
    backFolder.add(cut.backText, 'fontWeight', [100, 200, 300, 400, 500, 600, 700, 800, 900]).name(tr.gui.fontWeight);
    backFolder.close();

    // Front Text
    const frontFolder = cutFolder.addFolder(tr.gui.frontTextFolder);
    const frontTextAny = cut.frontText as any;
    frontFolder.add(cut.frontText, 'text').name(tr.gui.text);
    frontFolder.add(frontTextAny, 'animationPreset', textPresetOptions).name(tr.gui.animation);
    frontFolder.add(cut.frontText, 'x', 0, 100, 1).name('X (%)');
    frontFolder.add(cut.frontText, 'y', 0, 100, 1).name('Y (%)');
    frontFolder.add(cut.frontText, 'fontSize', 5, 40, 1).name(tr.gui.size);
    frontFolder.addColor(cut.frontText, 'color').name(tr.gui.textColor);
    frontFolder.add(cut.frontText, 'fontWeight', [100, 200, 300, 400, 500, 600, 700, 800, 900]).name(tr.gui.fontWeight);
    frontFolder.close();

    cutFolder.close();
  });
  animFolder.close();

  stageGui.folders.forEach((folder) => folder.close());
}

function setupVisualGUI(container: HTMLElement): void {
  const tr = t();
  const visualGui = new GUI({
    title: tr.render.detailedParamsTitle,
    container,
    autoPlace: false,
  });
  guis.push(visualGui);

  // Helper to add material folder
  const addMaterialFolder = (title: string, kind: 'body' | 'hair' | 'cloth') => {
    const folder = visualGui.addFolder(title);
    const params = currentConfig.materials[kind];
    const update = () => avatarInstance?.shaderController?.updateMaterialStyle(kind, params);

    folder.addColor(params, 'color').name(tr.gui.baseColor).onChange(update);
    folder.add(params, 'matcapEnabled').name(tr.gui.highlightMatcap).onChange(update);
    folder.add(params, 'emissiveIntensity', 0.0, 5.0, 0.1).name(tr.gui.emissiveIntensity).onChange(update);
    folder.add(params, 'shadowHueShift', -0.5, 0.5, 0.01).name(tr.gui.shadowHueShift).onChange(update);
    folder.add(params, 'shadowLightnessFactor', 0.02, 1.0, 0.01).name(tr.gui.shadowLightness).onChange(update);
    folder.add(params, 'shadingToonyFactor', 0, 1, 0.01).name(tr.gui.toonyFactor).onChange(update);
    folder.add(params, 'shadingShiftFactor', -1, 1, 0.01).name(tr.gui.shadingShift).onChange(update);
    folder.add(params, 'giEqualizationFactor', 0, 1, 0.01).name(tr.gui.giFactor).onChange(update);

    folder.add(params, 'rimEnabled').name(tr.gui.rimEnabled).onChange(update);
    folder.addColor(params, 'rimColor').name(tr.gui.rimColor).onChange(update);
    folder.add(params, 'parametricRimFresnelPowerFactor', 0, 10, 0.1).name(tr.gui.rimFresnelPower).onChange(update);
    folder.add(params, 'parametricRimLiftFactor', 0, 5, 0.01).name(tr.gui.rimLift).onChange(update);
    folder.add(params, 'rimLightingMixFactor', 0, 2, 0.01).name(tr.gui.rimMix).onChange(update);
    folder.add(params, 'outlineWidthFactor', 0, 0.01, 0.0002).name(tr.gui.outlineWidth).onChange(update);
    folder.close();
  };

  // 1. Material Folders
  addMaterialFolder(tr.gui.matBody, 'body');
  addMaterialFolder(tr.gui.matHair, 'hair');
  addMaterialFolder(tr.gui.matCloth, 'cloth');

  // 2. Outline Folder
  const outlineFolder = visualGui.addFolder(tr.gui.outlineFolder);
  outlineFolder
    .add(currentConfig.outline, 'enabled')
    .name(tr.gui.outlineInvertedHull)
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'useSmoothNormal')
    .name(tr.gui.outlineSmoothNormal)
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'screenSpaceWidth')
    .name(tr.gui.outlineScreenSpace)
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'autoLineWeight')
    .name(tr.gui.outlineAutoWeight)
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'darknessFactor', 0.01, 0.5, 0.02)
    .name(tr.gui.outlineDarkness)
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'widthFactor', 0, 0.01, 0.0002)
    .name(tr.gui.outlineWidth)
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'lightingMixFactor', 0, 1, 0.01)
    .name(tr.gui.outlineLightingMix)
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder.close();

  // 3. Lighting Folder
  const lightFolder = visualGui.addFolder(tr.gui.lightFolder);
  lightFolder
    .add(currentConfig.lighting, 'castShadows')
    .name(tr.gui.castShadows)
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
    .name(tr.gui.keyIntensity)
    .onChange((val: number) => (dirLight.intensity = val));
  lightFolder
    .addColor(currentConfig.lighting.directional, 'color')
    .name(tr.gui.keyColor)
    .onChange((val: string) => dirLight.color.set(val));
  lightFolder
    .add(currentConfig.lighting.directional, 'posX', -10, 10, 0.1)
    .name(tr.gui.keyPosX)
    .onChange((val: number) => (dirLight.position.x = val));
  lightFolder
    .add(currentConfig.lighting.directional, 'posY', -10, 10, 0.1)
    .name(tr.gui.keyPosY)
    .onChange((val: number) => (dirLight.position.y = val));
  lightFolder
    .add(currentConfig.lighting.directional, 'posZ', -10, 10, 0.1)
    .name(tr.gui.keyPosZ)
    .onChange((val: number) => (dirLight.position.z = val));

  // Ambient Light
  lightFolder
    .add(currentConfig.lighting.ambient, 'intensity', 0, 3, 0.05)
    .name(tr.gui.ambientIntensity)
    .onChange((val: number) => (ambientLight.intensity = val));
  lightFolder
    .addColor(currentConfig.lighting.ambient, 'color')
    .name(tr.gui.ambientColor)
    .onChange((val: string) => ambientLight.color.set(val));

  // Rim Light
  lightFolder
    .add(currentConfig.lighting.rim, 'enabled')
    .name(tr.gui.rimLightEnabled)
    .onChange((val: boolean) => {
      rimLight.visible = val;
      rimLight.intensity = val ? currentConfig.lighting.rim.intensity : 0;
    });
  lightFolder
    .add(currentConfig.lighting.rim, 'intensity', 0, 3, 0.05)
    .name(tr.gui.rimLightIntensity)
    .onChange((val: number) => {
      rimLight.intensity = currentConfig.lighting.rim.enabled !== false ? val : 0;
    });
  lightFolder
    .addColor(currentConfig.lighting.rim, 'color')
    .name(tr.gui.rimLightColor)
    .onChange((val: string) => rimLight.color.set(val));
  lightFolder
    .add(currentConfig.lighting.rim, 'posX', -10, 10, 0.1)
    .name(tr.gui.rimLightPosX)
    .onChange((val: number) => (rimLight.position.x = val));
  lightFolder
    .add(currentConfig.lighting.rim, 'posY', -10, 10, 0.1)
    .name(tr.gui.rimLightPosY)
    .onChange((val: number) => (rimLight.position.y = val));
  lightFolder
    .add(currentConfig.lighting.rim, 'posZ', -10, 10, 0.1)
    .name(tr.gui.rimLightPosZ)
    .onChange((val: number) => (rimLight.position.z = val));
  lightFolder.close();

  // 4. Sun & Atmosphere Folder
  const sunFolder = visualGui.addFolder(tr.gui.sunFolder);

  // Sun Transform / Light Tracking
  const sunPosFolder = sunFolder.addFolder(tr.gui.sunPosFolder);
  sunPosFolder
    .add(currentConfig.lighting.sunShafts, 'followDirectionalLight')
    .name(tr.gui.sunAutoFollow)
    .onChange((val: boolean) => {
      currentConfig.lighting.sunShafts.followDirectionalLight = val;
    });
  sunPosFolder
    .add(currentConfig.lighting.sunShafts.sunPosition, 'x', -20, 20, 0.1)
    .name(tr.gui.sunPosX)
    .onChange((val: number) => {
      currentConfig.lighting.sunShafts.sunPosition.x = val;
    });
  sunPosFolder
    .add(currentConfig.lighting.sunShafts.sunPosition, 'y', -5, 25, 0.1)
    .name(tr.gui.sunPosY)
    .onChange((val: number) => {
      currentConfig.lighting.sunShafts.sunPosition.y = val;
    });
  sunPosFolder
    .add(currentConfig.lighting.sunShafts.sunPosition, 'z', -20, 20, 0.1)
    .name(tr.gui.sunPosZ)
    .onChange((val: number) => {
      currentConfig.lighting.sunShafts.sunPosition.z = val;
    });
  sunPosFolder.close();

  // God Rays (Sun Shafts / Komorebi)
  const godRaysFolder = sunFolder.addFolder(tr.gui.godRaysFolder);
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'enabled')
    .name(tr.gui.godRaysEnabled)
    .onChange((enabled: boolean) => {
      godRaysPass.uniforms['uExposure'].value = enabled ? currentConfig.lighting.sunShafts.exposure : 0;
    });
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'exposure', 0.0, 1.5, 0.02)
    .name(tr.gui.godRaysExposure)
    .onChange((val: number) => {
      if (currentConfig.lighting.sunShafts.enabled) {
        godRaysPass.uniforms['uExposure'].value = val;
      }
    });
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'decay', 0.8, 0.99, 0.005)
    .name(tr.gui.godRaysDecay)
    .onChange((val: number) => {
      godRaysPass.uniforms['uDecay'].value = val;
    });
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'density', 0.2, 1.8, 0.05)
    .name(tr.gui.godRaysDensity)
    .onChange((val: number) => {
      godRaysPass.uniforms['uDensity'].value = val;
    });
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'weight', 0.05, 1.0, 0.02)
    .name(tr.gui.godRaysWeight)
    .onChange((val: number) => {
      godRaysPass.uniforms['uWeight'].value = val;
    });
  godRaysFolder
    .addColor(currentConfig.lighting.sunShafts, 'color')
    .name(tr.gui.godRaysColor)
    .onChange((hex: string) => {
      (godRaysPass.uniforms['uRayColor'].value as THREE.Color).set(hex);
    });
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'shimmer', 0.0, 1.0, 0.05)
    .name(tr.gui.godRaysShimmer)
    .onChange((val: number) => {
      godRaysPass.uniforms['uShimmer'].value = val;
    });
  godRaysFolder.close();

  // Lens Flare
  const flareFolder = sunFolder.addFolder(tr.gui.flareFolder);
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'enabled')
    .name(tr.gui.flareEnabled)
    .onChange((enabled: boolean) => {
      sunEffect.flareGroup.visible = enabled;
    });
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'sunSize', 0.2, 3.0, 0.05)
    .name(tr.gui.flareSize);
  flareFolder
    .addColor(currentConfig.lighting.lensFlare, 'sunColor')
    .name(tr.gui.flareColor);
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'glowIntensity', 0.0, 2.0, 0.05)
    .name(tr.gui.flareCorona);
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'starburstIntensity', 0.0, 2.0, 0.05)
    .name(tr.gui.flareStarburst);
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'anamorphicIntensity', 0.0, 2.0, 0.05)
    .name(tr.gui.flareAnamorphic);
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'ghostIntensity', 0.0, 2.0, 0.05)
    .name(tr.gui.flareGhosts);
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'haloIntensity', 0.0, 2.0, 0.05)
    .name(tr.gui.flareHalo);
  flareFolder.close();

  // Atmosphere / Far Fog
  const fogFolder = sunFolder.addFolder(tr.gui.fogFolder);
  fogFolder
    .add(currentConfig.environment, 'farFogEnabled')
    .name(tr.gui.fogEnabled)
    .onChange(() => updateBackgroundDisplay(currentConfig));
  fogFolder
    .addColor(currentConfig.environment, 'farFogColor')
    .name(tr.gui.fogColor)
    .onChange(() => updateBackgroundDisplay(currentConfig));
  fogFolder
    .add(currentConfig.environment, 'farFogIntensity', 0, 1, 0.02)
    .name(tr.gui.fogIntensity)
    .onChange(() => updateBackgroundDisplay(currentConfig));
  fogFolder.close();

  // Midground layer folder
  const midFolder = sunFolder.addFolder(tr.gui.midFolder);
  if (!currentConfig.environment.midgroundPosition) {
    currentConfig.environment.midgroundPosition = { x: 0, y: 1.05, z: -0.6 };
  }
  midFolder
    .add(currentConfig.environment, 'showMidground')
    .name(tr.gui.showMidground)
    .onChange(() => updateMidgroundDisplay(currentConfig));
  midFolder
    .add(currentConfig.environment.midgroundPosition, 'x', -5, 5, 0.05)
    .name(tr.gui.midX)
    .onChange(() => updateMidgroundDisplay(currentConfig));
  midFolder
    .add(currentConfig.environment.midgroundPosition, 'y', -2, 5, 0.05)
    .name(tr.gui.midY)
    .onChange(() => updateMidgroundDisplay(currentConfig));
  midFolder
    .add(currentConfig.environment.midgroundPosition, 'z', -5, 2, 0.05)
    .name(tr.gui.midZ)
    .onChange(() => updateMidgroundDisplay(currentConfig));
  midFolder
    .add(currentConfig.environment, 'midgroundScale', 0.5, 10, 0.1)
    .name(tr.gui.midScale)
    .onChange(() => updateMidgroundDisplay(currentConfig));
  midFolder
    .add(currentConfig.environment, 'midgroundOpacity', 0, 1, 0.05)
    .name(tr.gui.midOpacity)
    .onChange(() => updateMidgroundDisplay(currentConfig));
  midFolder.close();

  // Floor
  const floorFolder = sunFolder.addFolder(tr.gui.envFolder);
  floorFolder
    .add(currentConfig.environment, 'showFloor')
    .name(tr.gui.showFloor)
    .onChange((show: boolean) => {
      floor.visible = show;
    });
  floorFolder
    .addColor(currentConfig.environment, 'floorColor')
    .name(tr.gui.floorColor)
    .onChange((color: string) => {
      floorMat.color.set(color);
    });
  floorFolder.close();

  sunFolder.close();

  // 5. Post Processing Folder
  const postFolder = visualGui.addFolder(tr.gui.postFolder);
  postFolder
    .add(currentConfig.postProcessing, 'toneMappingMode', ['ACESFilmic', 'Reinhard', 'AgX', 'Linear', 'None'])
    .name(tr.gui.toneMapping)
    .onChange(() => {
      applyConfigToSceneAndRenderer(currentConfig);
    });

  postFolder
    .add(currentConfig.postProcessing, 'toneMappingExposure', 0.2, 2.5, 0.05)
    .name(tr.gui.exposure)
    .onChange((val: number) => (renderer.toneMappingExposure = val));

  // Antialiasing Folder
  const aaFolder = postFolder.addFolder(tr.gui.aaFolder);
  aaFolder
    .add(currentConfig.postProcessing.antialiasing, 'msaaSamples', [0, 2, 4, 8])
    .name(tr.gui.msaaSamples)
    .onChange((samples: number) => {
      if (composer.renderTarget1) composer.renderTarget1.samples = samples;
      if (composer.renderTarget2) composer.renderTarget2.samples = samples;
    });
  aaFolder
    .add(currentConfig.postProcessing.antialiasing, 'smaa')
    .name(tr.gui.smaaPass)
    .onChange((val: boolean) => {
      smaaPass.enabled = val;
    });
  aaFolder.close();

  // Bloom
  postFolder
    .add(currentConfig.postProcessing.bloom, 'enabled')
    .name(tr.gui.bloomEnabled)
    .onChange((enabled: boolean) => {
      bloomPass.strength = enabled ? currentConfig.postProcessing.bloom.strength : 0;
    });
  postFolder
    .add(currentConfig.postProcessing.bloom, 'strength', 0, 0.8, 0.01)
    .name(tr.gui.bloomStrength)
    .onChange((val: number) => {
      if (currentConfig.postProcessing.bloom.enabled) bloomPass.strength = val;
    });
  postFolder
    .add(currentConfig.postProcessing.bloom, 'threshold', 0.1, 1.0, 0.01)
    .name(tr.gui.bloomThreshold)
    .onChange((val: number) => (bloomPass.threshold = val));
  postFolder
    .add(currentConfig.postProcessing.bloom, 'radius', 0.0, 1.0, 0.02)
    .name(tr.gui.bloomRadius)
    .onChange((val: number) => (bloomPass.radius = val));

  // Color Grading
  const cgFolder = postFolder.addFolder(tr.gui.cgFolder);
  cgFolder
    .add(currentConfig.postProcessing.colorGrading, 'enabled')
    .name(tr.gui.cgEnabled)
    .onChange((enabled: boolean) => {
      colorGradingPass.uniforms['uEnabled'].value = enabled ? 1.0 : 0.0;
    });
  cgFolder
    .addColor(currentConfig.postProcessing.colorGrading, 'shadowTint')
    .name(tr.gui.cgShadowTint)
    .onChange((hex: string) => {
      (colorGradingPass.uniforms['uShadowTint'].value as THREE.Color).set(hex);
    });
  cgFolder
    .addColor(currentConfig.postProcessing.colorGrading, 'highlightTint')
    .name(tr.gui.cgHighlightTint)
    .onChange((hex: string) => {
      (colorGradingPass.uniforms['uHighlightTint'].value as THREE.Color).set(hex);
    });
  cgFolder
    .add(currentConfig.postProcessing.colorGrading, 'strength', 0, 1, 0.02)
    .name(tr.gui.cgStrength)
    .onChange((val: number) => {
      colorGradingPass.uniforms['uStrength'].value = val;
    });
  cgFolder
    .add(currentConfig.postProcessing.colorGrading, 'contrast', 0, 0.5, 0.01)
    .name(tr.gui.cgContrast)
    .onChange((val: number) => {
      colorGradingPass.uniforms['uGradingContrast'].value = val;
    });
  cgFolder
    .add(currentConfig.postProcessing.colorGrading, 'gamma', 0.7, 1.4, 0.02)
    .name(tr.gui.cgGamma)
    .onChange((val: number) => {
      colorGradingPass.uniforms['uGamma'].value = val;
    });
  cgFolder.close();

  // Basic Grading
  postFolder
    .add(currentConfig.postProcessing, 'saturation', -1.0, 1.0, 0.02)
    .name(tr.gui.saturation)
    .onChange((val: number) => (hueSaturationPass.uniforms['saturation'].value = val));
  postFolder
    .add(currentConfig.postProcessing, 'brightness', -0.5, 0.5, 0.01)
    .name(tr.gui.brightness)
    .onChange((val: number) => (brightnessContrastPass.uniforms['brightness'].value = val));
  postFolder
    .add(currentConfig.postProcessing, 'contrast', -0.5, 0.5, 0.01)
    .name(tr.gui.contrast)
    .onChange((val: number) => (brightnessContrastPass.uniforms['contrast'].value = val));
  postFolder.close();

  // 6. Manga Emotion Effect Text Folder
  const effectTextFolder = visualGui.addFolder(tr.character.emotionEffectText);
  const effectTextState = {
    text: 'ワナワナ',
    preset: 'wanawana',
    mode: 'auto',
    anchor: 'head',
    duration: 1.8,
    scale: 1.0,
    offsetX: 0.0,
    offsetY: 0.04,
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
      showToast(`💬 「${effectTextState.text}」`);
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
      showToast('💥 複数エフェクト文字表示');
    },
    clearAll: () => {
      avatarInstance?.effectTextManager?.clear();
      showToast('🧹 全てのエフェクト文字をクリアしました');
    },
  };

  effectTextFolder.add(effectTextState, 'text').name(tr.gui.text);
  effectTextFolder
    .add(effectTextState, 'preset', {
      '🟣 ワナワナ (wanawana)': 'wanawana',
      '🔴 イライラ (iraira)': 'iraira',
      '💖 ドキドキ (doki)': 'doki',
      '🔵 ガーン (gaan)': 'gaan',
      '⚪ しーん (shiin)': 'shiin',
      '✨ キラキラ (kirakira)': 'kirakira',
      '⚡ ビクッ (biku)': 'biku',
    })
    .name('プリセット (Preset)');
  effectTextFolder
    .add(effectTextState, 'mode', {
      '自動 (Auto)': 'auto',
      '連続湧き上がり (Stream)': 'stream',
      '単一・中央表示 (Single)': 'single',
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
  effectTextFolder.add(effectTextState, 'duration', 0.5, 5.0, 0.1).name(tr.gui.cutDuration);
  effectTextFolder.add(effectTextState, 'scale', 0.3, 2.5, 0.05).name(tr.gui.size);
  effectTextFolder.add(effectTextState, 'offsetX', -1.5, 1.5, 0.02).name('X');
  effectTextFolder.add(effectTextState, 'offsetY', -1.5, 1.5, 0.02).name('Y');
  effectTextFolder.add(effectTextState, 'offsetZ', -1.5, 1.5, 0.02).name('Z');
  effectTextFolder.add(effectTextState, 'show').name(`▶ ${tr.character.show}`);
  effectTextFolder.add(effectTextState, 'clearAll').name(`✕ ${tr.character.clearAll}`);
  effectTextFolder.close();

  // 7. Glowing Tears Effect Folder
  const tearFolder = visualGui.addFolder('💧 涙・発光筋エフェクト (Glowing Tears)');
  const tearState = {
    enabled: false,
    side: 'left',
    speed: 0.45,
    glowIntensity: 1.8,
    trailLength: 1.0,
    tearColor: '#c8f0ff',
    glowColor: '#ffffff',
    width: 0.0032,
    loop: false,
    leftOffsetX: 0.054,
    leftOffsetY: 0.047,
    leftOffsetZ: 0.085,
    restart: () => {
      if (avatarInstance?.tearEffect) {
        avatarInstance.tearEffect.restart();
        showToast('💧 涙がスーッと流れます');
      }
    },
    toggleSadExpression: () => {
      if (!avatarInstance) return;
      avatarInstance.setExpression('sad', 1.0);
      tearState.enabled = true;
      avatarInstance.setTearsEnabled(true);
      avatarInstance.restartTears();
      tearFolder.controllersRecursive().forEach((c) => c.updateDisplay());
      showToast('😢 悲しい表情 + 涙を一筋流しました');
    },
  };

  const updateTearConfig = () => {
    if (!avatarInstance?.tearEffect) return;
    avatarInstance.setTearConfig({
      enabled: tearState.enabled,
      side: tearState.side as any,
      speed: tearState.speed,
      glowIntensity: tearState.glowIntensity,
      trailLength: tearState.trailLength,
      tearColor: tearState.tearColor,
      glowColor: tearState.glowColor,
      width: tearState.width,
      loop: tearState.loop,
      leftEyeOffset: { x: tearState.leftOffsetX, y: tearState.leftOffsetY, z: tearState.leftOffsetZ },
      rightEyeOffset: { x: -tearState.leftOffsetX, y: tearState.leftOffsetY, z: tearState.leftOffsetZ },
    });
  };

  tearFolder
    .add(tearState, 'enabled')
    .name('涙エフェクト ON/OFF')
    .onChange((val: boolean) => {
      if (avatarInstance?.tearEffect) {
        tearState.leftOffsetX = avatarInstance.tearEffect.config.leftEyeOffset.x;
        tearState.leftOffsetY = avatarInstance.tearEffect.config.leftEyeOffset.y;
        tearState.leftOffsetZ = avatarInstance.tearEffect.config.leftEyeOffset.z;
        tearFolder.controllersRecursive().forEach((c) => c.updateDisplay());
      }
      avatarInstance?.setTearsEnabled(val);
      if (val) {
        if (!currentConfig.postProcessing.bloom.enabled) {
          currentConfig.postProcessing.bloom.enabled = true;
          bloomPass.strength = currentConfig.postProcessing.bloom.strength;
          showToast('💧 涙を光らせるため Bloom を有効化しました');
        }
      }
    });

  tearFolder
    .add(tearState, 'side', {
      '左目から一筋 (Left)': 'left',
      '右目から一筋 (Right)': 'right',
      '両目 (Both)': 'both',
    })
    .name('流す位置 (Side)')
    .onChange(updateTearConfig);

  tearFolder.add(tearState, 'toggleSadExpression').name('😢 泣き顔プリセット');
  tearFolder.add(tearState, 'restart').name('🔄 最初から流す');

  tearFolder.add(tearState, 'speed', 0.1, 1.5, 0.05).name('流れる速度').onChange(updateTearConfig);
  tearFolder.add(tearState, 'glowIntensity', 0.5, 5.0, 0.1).name('発光強度').onChange(updateTearConfig);
  tearFolder.add(tearState, 'trailLength', 0.2, 1.0, 0.05).name('残る筋の長さ').onChange(updateTearConfig);
  tearFolder.add(tearState, 'width', 0.001, 0.015, 0.0005).name('涙の太さ').onChange(updateTearConfig);
  tearFolder.addColor(tearState, 'tearColor').name('涙の基本色').onChange(updateTearConfig);
  tearFolder.addColor(tearState, 'glowColor').name('発光色').onChange(updateTearConfig);
  tearFolder.add(tearState, 'loop').name(tr.common.loop).onChange(updateTearConfig);

  const posFolder = tearFolder.addFolder('📍 位置微調整 (Eye Offset)');
  posFolder.add(tearState, 'leftOffsetX', 0.01, 0.1, 0.001).name('目の左右間隔 (X)').onChange(updateTearConfig);
  posFolder.add(tearState, 'leftOffsetY', 0.0, 0.15, 0.001).name('目の上下高さ (Y)').onChange(updateTearConfig);
  posFolder.add(tearState, 'leftOffsetZ', 0.02, 0.2, 0.001).name('顔の表面奥行き (Z)').onChange(updateTearConfig);
  posFolder.close();
  tearFolder.close();

  // 8. Sweat (Manga Mark) Effect Folder
  const sweatFolder = visualGui.addFolder('💦 漫符汗エフェクト (焦り / じとー)');
  const sweatState = {
    enabled: false,
    mode: 'fly4',
    side: 'right',
    scale: 0.045,
    jitoScale: 0.04,
    flySpeed: 1.0,
    gravity: 1.8,
    spawnInterval: 0.38,
    dripSpeed: 0.025,
    duration: 3.0,
    loop: false,
    color: '#38bdf8',
    accentColor: '#0284c7',
    originX: 0.0,
    originY: 0.18,
    originZ: 0.06,
    jitoOffsetX: 0.10,
    jitoOffsetY: 0.07,
    jitoOffsetZ: 0.085,
    toggleNervousExpression: () => {
      if (!avatarInstance) return;
      avatarInstance.setExpression('surprised', 1.0);
      sweatState.enabled = true;
      sweatState.mode = 'fly4';
      avatarInstance.setSweatEnabled(true);
      avatarInstance.restartSweat('fly4', sweatState.duration);
      sweatFolder.controllersRecursive().forEach((c) => c.updateDisplay());
      showToast('💦 焦り表情 ＋ 4方向放物線汗マークを発動しました');
    },
    toggleJitoExpression: () => {
      if (!avatarInstance) return;
      avatarInstance.setExpression('relaxed', 1.0);
      sweatState.enabled = true;
      sweatState.mode = 'jito';
      avatarInstance.setSweatEnabled(true);
      avatarInstance.restartSweat('jito', sweatState.duration);
      sweatFolder.controllersRecursive().forEach((c) => c.updateDisplay());
      showToast('😑 ジト目表情 ＋ こめかみ冷や汗（タラーッ…）を発動しました');
    },
    restart: () => {
      if (avatarInstance?.sweatEffect) {
        avatarInstance.sweatEffect.restart(sweatState.mode as any, sweatState.duration);
        showToast(sweatState.mode === 'jito' ? '😑 こめかみ冷や汗を再生しました' : '💦 4方向に汗マークを噴出しました');
      }
    },
  };

  const updateSweatConfig = () => {
    if (!avatarInstance?.sweatEffect) return;
    avatarInstance.setSweatConfig({
      enabled: sweatState.enabled,
      mode: sweatState.mode as any,
      side: sweatState.side as any,
      scale: sweatState.scale,
      jitoScale: sweatState.jitoScale,
      flySpeed: sweatState.flySpeed,
      gravity: sweatState.gravity,
      spawnInterval: sweatState.spawnInterval,
      dripSpeed: sweatState.dripSpeed,
      duration: sweatState.duration,
      loop: sweatState.loop,
      color: sweatState.color,
      accentColor: sweatState.accentColor,
      originOffset: { x: sweatState.originX, y: sweatState.originY, z: sweatState.originZ },
      jitoRightOffset: { x: sweatState.jitoOffsetX, y: sweatState.jitoOffsetY, z: sweatState.jitoOffsetZ },
      jitoLeftOffset: { x: -sweatState.jitoOffsetX, y: sweatState.jitoOffsetY, z: sweatState.jitoOffsetZ },
    });
  };

  sweatFolder
    .add(sweatState, 'enabled')
    .name('汗エフェクト ON/OFF')
    .onChange((val: boolean) => {
      if (avatarInstance?.sweatEffect) {
        sweatState.originX = avatarInstance.sweatEffect.config.originOffset.x;
        sweatState.originY = avatarInstance.sweatEffect.config.originOffset.y;
        sweatState.originZ = avatarInstance.sweatEffect.config.originOffset.z;
        sweatState.jitoOffsetX = avatarInstance.sweatEffect.config.jitoRightOffset.x;
        sweatState.jitoOffsetY = avatarInstance.sweatEffect.config.jitoRightOffset.y;
        sweatState.jitoOffsetZ = avatarInstance.sweatEffect.config.jitoRightOffset.z;
        sweatFolder.controllersRecursive().forEach((c) => c.updateDisplay());
      }
      avatarInstance?.setSweatEnabled(val);
    });

  sweatFolder
    .add(sweatState, 'mode', {
      '4方向放物線 (焦り)': 'fly4',
      'こめかみタラーッ (じとー)': 'jito',
    })
    .name('演出モード (Mode)')
    .onChange(updateSweatConfig);

  sweatFolder
    .add(sweatState, 'side', {
      '右こめかみ (Right)': 'right',
      '左こめかみ (Left)': 'left',
      '両側 (Both)': 'both',
    })
    .name('じとー表示側 (Side)')
    .onChange(updateSweatConfig);

  sweatFolder.add(sweatState, 'toggleNervousExpression').name('💦 焦り顔プリセット');
  sweatFolder.add(sweatState, 'toggleJitoExpression').name('😑 じとー顔プリセット');
  sweatFolder.add(sweatState, 'restart').name('🔄 最初から再生');

  sweatFolder.add(sweatState, 'scale', 0.01, 0.15, 0.005).name('焦り汗のサイズ').onChange(updateSweatConfig);
  sweatFolder.add(sweatState, 'jitoScale', 0.01, 0.15, 0.005).name('じとー汗のサイズ').onChange(updateSweatConfig);
  sweatFolder.add(sweatState, 'flySpeed', 0.4, 2.5, 0.1).name('飛び散る勢い (速度)').onChange(updateSweatConfig);
  sweatFolder.add(sweatState, 'gravity', 0.5, 4.0, 0.1).name('重力 (落下の強さ)').onChange(updateSweatConfig);
  sweatFolder.add(sweatState, 'spawnInterval', 0.15, 1.0, 0.02).name('噴出間隔 (秒)').onChange(updateSweatConfig);
  sweatFolder.add(sweatState, 'dripSpeed', 0.005, 0.08, 0.005).name('タラーッと垂れる距離').onChange(updateSweatConfig);
  sweatFolder.add(sweatState, 'duration', 0.5, 10.0, 0.5).name('表示秒数 (Duration)').onChange(updateSweatConfig);
  sweatFolder.add(sweatState, 'loop').name(tr.common.loop).onChange(updateSweatConfig);
  sweatFolder.addColor(sweatState, 'color').name('汗のメイン色').onChange(updateSweatConfig);
  sweatFolder.addColor(sweatState, 'accentColor').name('汗の濃い色').onChange(updateSweatConfig);

  const sweatPosFolder = sweatFolder.addFolder('📍 位置微調整 (Offset)');
  sweatPosFolder.add(sweatState, 'originY', 0.0, 0.35, 0.005).name('頭上の高さ (Y: fly4)').onChange(updateSweatConfig);
  sweatPosFolder.add(sweatState, 'originZ', -0.2, 0.2, 0.005).name('頭上の前後 (Z: fly4)').onChange(updateSweatConfig);
  sweatPosFolder.add(sweatState, 'jitoOffsetX', 0.02, 0.2, 0.005).name('こめかみ横幅 (X: jito)').onChange(updateSweatConfig);
  sweatPosFolder.add(sweatState, 'jitoOffsetY', -0.05, 0.2, 0.005).name('こめかみ高さ (Y: jito)').onChange(updateSweatConfig);
  sweatPosFolder.add(sweatState, 'jitoOffsetZ', -0.05, 0.2, 0.005).name('こめかみ前後 (Z: jito)').onChange(updateSweatConfig);
  sweatPosFolder.close();
  sweatFolder.close();

  // 9. Lip Sync Folder
  const lipFolder = visualGui.addFolder(tr.gui.lipSyncFolder);
  lipFolder
    .add(currentConfig.lipSync, 'enabled')
    .name(tr.gui.lipSyncEnabled);
  lipFolder
    .add(currentConfig.lipSync, 'voiceGender', {
      '女性 / 高音 (Female)': 'female',
      '男性 / 低音 (Male)': 'male',
    })
    .name(tr.gui.lipSyncGender)
    .onChange((val: 'female' | 'male') => {
      audioLipSync.setVoiceGender(val);
    });
  lipFolder
    .add(currentConfig.lipSync, 'gain', 0.0, 1.5, 0.05)
    .name(tr.gui.lipSyncGain);
  lipFolder
    .add(currentConfig.lipSync, 'smoothing', 0.05, 0.6, 0.01)
    .name(tr.gui.lipSyncSmoothing);
  lipFolder
    .add(currentConfig.lipSync, 'audioDelay', 0.0, 0.2, 0.005)
    .name(tr.gui.lipSyncAudioDelay)
    .onChange((val: number) => {
      audioLipSync.setAudioDelay(val);
    });
  lipFolder
    .add(currentConfig.lipSync, 'rmsThreshold', 0.001, 0.05, 0.001)
    .name(tr.gui.lipSyncRmsThreshold)
    .onChange((val: number) => {
      audioLipSync.rmsThreshold = val;
    });
  lipFolder.close();

  visualGui.folders.forEach((folder) => folder.close());
}

function setupGUI(): void {
  destroyAllGuis();
  syncToggleState();

  const stageMount = document.getElementById('gui-mount-point-stage');
  if (stageMount) setupStageGUI(stageMount);

  const visualMount = document.getElementById('gui-mount-point-visual');
  if (visualMount) setupVisualGUI(visualMount);
}

function rebuildGUI(): void {
  setupGUI();
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
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
    modal.style.backdropFilter = 'blur(4px)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '10000';

    const tr = t();
    modal.innerHTML = `
      <div style="background: #242424; border: 1px solid #383838; border-radius: 6px; padding: 20px; width: 90%; max-width: 500px; box-shadow: 0 20px 35px -5px rgba(0, 0, 0, 0.6); color: #cccccc;">
        <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 15px; color: #ffffff;">${tr.render.importModalTitle}</h3>
        <p style="font-size: 11.5px; color: #aaaaaa; margin-bottom: 12px;">${tr.render.importModalDesc}</p>
        <textarea id="import-textarea" rows="12" style="width: 100%; box-sizing: border-box; font-family: monospace; font-size: 11.5px; padding: 8px; background: #181818; color: #e0e0e0; border: 1px solid #383838; border-radius: 4px; resize: vertical; outline: none;"></textarea>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
          <button id="modal-cancel-btn" style="padding: 6px 14px; background: #383838; border: 1px solid #484848; color: #cccccc; border-radius: 4px; cursor: pointer; font-size: 12px;">${tr.common.cancel}</button>
          <button id="modal-apply-btn" style="padding: 6px 14px; background: #4772b3; color: white; border: 1px solid #385e94; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">${tr.render.applyConfig}</button>
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
          updateAllGuisDisplay();
          syncTimeOfDayButtons();
          syncBgButtons();
          modal!.style.display = 'none';
          showToast(t().toasts.configImported);
        } catch (err) {
          alert(t().render.parseError);
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
    playBtn.style.background = isPlaying ? '#ea580c' : '#4772b3';
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
  const twogirlsBtn = document.getElementById('scenario-twogirls-btn');
  const statusBox = document.getElementById('scenario-status-box');
  const panel = document.getElementById('panel-container');
  const gearBtn = document.getElementById('settings-open-btn');
  const tr = t();

  if (playBtn) {
    playBtn.textContent = scenarioPlayer.isPlaying ? `⏹ ${tr.common.stop}` : tr.scenario.playSequence;
    playBtn.style.background = scenarioPlayer.isPlaying ? '#ea580c' : '#4772b3';
  }
  if (confessionBtn) {
    const isConfessionPlaying = scenarioEngine.isPlaying && !isMultiAvatarScenarioActive;
    confessionBtn.textContent = isConfessionPlaying ? `⏹ ${tr.common.stop}` : tr.scenario.playConfession;
    confessionBtn.style.background = isConfessionPlaying
      ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
      : 'linear-gradient(135deg, #db2777 0%, #be185d 100%)';
  }
  if (twogirlsBtn) {
    const isTwoGirlsPlaying = scenarioEngine.isPlaying && isMultiAvatarScenarioActive;
    twogirlsBtn.textContent = isTwoGirlsPlaying ? `⏹ ${tr.common.stop}` : tr.scenario.playTwoGirls;
    twogirlsBtn.style.background = isTwoGirlsPlaying
      ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
      : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
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
  const tr = t();
  if (stepLabel) {
    const stepNames = [tr.scenario.steps.step1Title, tr.scenario.steps.step2Title, tr.scenario.steps.step3Title];
    stepLabel.textContent = stepNames[index] || `Step ${index + 1}`;
  }
  if (stepText) {
    stepText.textContent = `「${step.text}」`;
  }
}

function updateScenarioDebugUI(scene: any, state: any): void {
  const sceneLabel = document.getElementById('scenario-engine-scene-id');
  const speakerLabel = document.getElementById('scenario-engine-speaker');
  const flagsLabel = document.getElementById('scenario-engine-flags');
  const textLabel = document.getElementById('scenario-engine-text');
  const tr = t();
  if (sceneLabel) sceneLabel.textContent = scene.id || '-';
  if (speakerLabel) speakerLabel.textContent = scene.speaker || (getLanguage() === 'en' ? '(Narration)' : '(地の文/ナレーション)');
  if (flagsLabel) {
    const flagArray = Array.from(state.flags as Set<string>);
    flagsLabel.textContent = flagArray.length > 0 ? flagArray.join(', ') : tr.scenario.noneFlags;
  }
  if (textLabel) textLabel.textContent = scene.text || '';
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
    playBtn.style.background = isPlaying ? '#ea580c' : '#4772b3';
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
// Color Histogram Controller
// --------------------------------------------------
const colorHistogram = new ColorHistogram();

function captureAndRenderHistogram(): void {
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
  colorHistogram.computeHistogram(renderer);
}

// --------------------------------------------------
// Unified Control Panel (Right Side HUD & Settings)
// --------------------------------------------------
function setupUnifiedUI(): void {
  // 1. Floating Settings Gear Button (shown when minimized)
  let gearBtn = document.getElementById('settings-open-btn') as HTMLButtonElement | null;
  if (!gearBtn) {
    gearBtn = document.createElement('button');
    gearBtn.id = 'settings-open-btn';
    gearBtn.title = t().common.openSettings;
    gearBtn.innerHTML = '⚙️';
    document.body.appendChild(gearBtn);
  }

  // 2. Main Right-Side Unified Panel (Studio Layout)
  let panel = document.getElementById('panel-container') as HTMLDivElement | null;
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'panel-container';
    document.body.appendChild(panel);
  }

  let currentActiveTab = 'character';
  let isLooping = false;

  const renderUI = () => {
    const tr = t();
    const lang = getLanguage();
    gearBtn!.title = tr.common.openSettings;

    panel!.innerHTML = `
      <div id="panel-header">
        <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 13px; color: #ffffff;">
          <span style="color: #5684c8; font-size: 15px;">🎮</span> ${tr.common.title}
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <select id="language-select" style="font-size: 11px; padding: 2px 6px; border-radius: 4px; border: 1px solid #3d3d3d; background: #1e1e1e; cursor: pointer; color: #dcdcdc; font-weight: 500;">
            <option value="ja" ${lang === 'ja' ? 'selected' : ''}>🇯🇵 日本語</option>
            <option value="en" ${lang === 'en' ? 'selected' : ''}>🇺🇸 English</option>
          </select>
          <button id="panel-close-btn" class="panel-close-btn" title="${tr.common.close}">✕</button>
        </div>
      </div>

      <!-- Studio Tab Navigation Bar -->
      <div id="panel-tabs">
        <button class="studio-tab-btn ${currentActiveTab === 'character' ? 'active' : ''}" data-tab="character">
          <span>${tr.tabs.character}</span>
        </button>
        <button class="studio-tab-btn ${currentActiveTab === 'stage' ? 'active' : ''}" data-tab="stage">
          <span>${tr.tabs.stage}</span>
        </button>
        <button class="studio-tab-btn ${currentActiveTab === 'visual' ? 'active' : ''}" data-tab="visual">
          <span>${tr.tabs.visual}</span>
        </button>
        <button class="studio-tab-btn ${currentActiveTab === 'system' ? 'active' : ''}" data-tab="system">
          <span>${tr.tabs.system}</span>
        </button>
      </div>

      <div id="panel-body">
        <!-- ==================================================== -->
        <!-- TAB 1: Character (Model, Motion, Expression, FX, LipSync) -->
        <!-- ==================================================== -->
        <div id="tab-pane-character" class="tab-pane ${currentActiveTab === 'character' ? 'active' : ''}">
          <!-- VRM Model Selector -->
          <div class="section-box">
            <label class="section-label">${tr.character.modelSwitch}</label>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="model-buttons">
              <button data-model="${resolveAssetUrl('/models/girl.vrm')}" class="model-btn active">👧 girl.vrm</button>
              <button data-model="${resolveAssetUrl('/models/girl2.vrm')}" class="model-btn">👱‍♀️ girl2.vrm</button>
              <button data-model="${resolveAssetUrl('/models/girl3.vrm')}" class="model-btn">👩 girl3.vrm</button>
              <button id="open-local-vrm-btn" class="model-btn">${tr.character.selectFile}</button>
            </div>
            <!-- Loading Status (Inside Character Model Selector) -->
            <div id="loading-status" class="status-box" style="margin-top: 4px;">
              ${avatarInstance?.vrm
                ? `<span style="color: #16a34a; font-weight: 600;">✓ ロード完了</span> (${currentModelUrl.startsWith('blob:') ? 'ローカルVRM' : currentModelUrl.split('/').pop()})`
                : `${tr.common.loadingModel} <span id="progress-text" style="color: #ffffff; font-weight: 600;">0%</span>`}
            </div>
          </div>

          <!-- Motions -->
          <div class="section-box">
            <label class="section-label">${tr.character.motion}</label>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="motion-buttons">
              <button data-motion="${resolveAssetUrl('/animations/Idle.fbx')}" class="motion-btn active">${tr.character.motions.idle}</button>
              <button data-motion="${resolveAssetUrl('/animations/Standing Idle.fbx')}" class="motion-btn">${tr.character.motions.standingIdle}</button>
              <button data-motion="${resolveAssetUrl('/animations/Female Standing Pose.fbx')}" class="motion-btn">${tr.character.motions.standingPose}</button>
              <button data-motion="${resolveAssetUrl('/animations/Walking.fbx')}" class="motion-btn">${tr.character.motions.walking}</button>
              <button data-motion="${resolveAssetUrl('/animations/Jogging.fbx')}" class="motion-btn">${tr.character.motions.jogging}</button>
              <button data-motion="${resolveAssetUrl('/animations/Standing Greeting.fbx')}" class="motion-btn">${tr.character.motions.greeting}</button>
              <button data-motion="${resolveAssetUrl('/animations/Quick Formal Bow.fbx')}" class="motion-btn">${tr.character.motions.bow}</button>
              <button data-motion="${resolveAssetUrl('/animations/Acknowledging.fbx')}" class="motion-btn">${tr.character.motions.acknowledging}</button>
              <button data-motion="${resolveAssetUrl('/animations/Dismissing Gesture.fbx')}" class="motion-btn">${tr.character.motions.dismissing}</button>
              <button data-motion="${resolveAssetUrl('/animations/Salute.fbx')}" class="motion-btn">${tr.character.motions.salute}</button>
              <button data-motion="${resolveAssetUrl('/animations/Excited.fbx')}" class="motion-btn">${tr.character.motions.excited}</button>
              <button data-motion="${resolveAssetUrl('/animations/Angry.fbx')}" class="motion-btn">${tr.character.motions.angry}</button>
              <button data-motion="${resolveAssetUrl('/animations/Punching.fbx')}" class="motion-btn">${tr.character.motions.punching}</button>
              <button data-motion="none" class="motion-btn">${tr.character.motions.stop}</button>
            </div>
          </div>

          <!-- Expressions -->
          <div class="section-box">
            <label class="section-label">${tr.character.expression}</label>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="expression-buttons">
              <button data-expr="neutral" class="expr-btn active">${tr.character.expressions.neutral}</button>
              <button data-expr="happy" class="expr-btn">${tr.character.expressions.happy}</button>
              <button data-expr="angry" class="expr-btn">${tr.character.expressions.angry}</button>
              <button data-expr="sad" class="expr-btn">${tr.character.expressions.sad}</button>
              <button data-expr="surprised" class="expr-btn">${tr.character.expressions.surprised}</button>
              <button data-expr="relaxed" class="expr-btn">${tr.character.expressions.relaxed}</button>
              <button data-expr="aa" class="expr-btn">${tr.character.expressions.aa}</button>
              <button data-expr="ee" class="expr-btn">${tr.character.expressions.ee}</button>
              <button data-expr="oh" class="expr-btn">${tr.character.expressions.oh}</button>
            </div>
          </div>

          <!-- Manga Emotion Effect Texts -->
          <div class="section-box" style="background: #202020; border: 1px solid #333333; border-left: 3px solid #ec4899; padding: 8px; border-radius: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label class="section-label" style="color: #f472b6; font-weight: 700;">${tr.character.emotionEffectText}</label>
              <button id="quick-clear-effect-text-btn" style="font-size: 10px; padding: 2px 6px; background: #2a2a2a; border: 1px solid #444444; color: #f472b6; border-radius: 4px; cursor: pointer; font-weight: 600;">${tr.character.clearAll}</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 4px;" id="effect-text-buttons">
              <button class="effect-text-btn" data-preset="wanawana" data-text="ワナワナ" data-expr="angry" style="border-color: #7c3aed; color: #c4b5fd;">${tr.character.presets.wanawana}</button>
              <button class="effect-text-btn" data-preset="iraira" data-text="イライラ" data-expr="angry" style="border-color: #dc2626; color: #fca5a5;">${tr.character.presets.iraira}</button>
              <button class="effect-text-btn" data-preset="gaan" data-text="ガーン" data-expr="sad" style="border-color: #2563eb; color: #93c5fd;">${tr.character.presets.gaan}</button>
              <button class="effect-text-btn" data-preset="kirakira" data-text="キラキラ" data-expr="happy" style="border-color: #ca8a04; color: #fde047;">${tr.character.presets.kirakira}</button>
              <button class="effect-text-btn" data-preset="shiin" data-text="しーん" data-expr="neutral" style="border-color: #475569; color: #cbd5e1;">${tr.character.presets.shiin}</button>
              <button class="effect-text-btn" data-preset="doki" data-text="ドキドキ" data-expr="happy" style="border-color: #e11d48; color: #fda4af;">${tr.character.presets.doki}</button>
              <button class="effect-text-btn" data-preset="biku" data-text="ビクッ！" data-expr="surprised" style="border-color: #ca8a04; color: #fde047;">${tr.character.presets.biku}</button>
              <button class="effect-text-btn" data-preset="kirakira" data-text="やったー！" data-expr="happy" style="border-color: #16a34a; color: #86efac;">${tr.character.presets.yatta}</button>
              <button id="quick-sweat-btn" class="effect-text-btn" data-expr="surprised" style="border-color: #0284c7; color: #7dd3fc; font-weight: 700;">${tr.character.presets.sweat}</button>
              <button id="quick-jito-btn" class="effect-text-btn" data-expr="relaxed" style="border-color: #0f766e; color: #99f6e4; font-weight: 700; grid-column: span 2;">${tr.character.presets.jito}</button>
            </div>
            <div style="display: flex; gap: 4px; margin-top: 6px;">
              <input type="text" id="quick-custom-effect-text" placeholder="${tr.character.customTextPlaceholder}" style="flex: 1; min-width: 0; padding: 4px 6px; font-size: 11px; border: 1px solid #3d3d3d; background: #1c1c1c; color: #e0e0e0; border-radius: 4px; outline: none;">
              <select id="quick-custom-effect-preset" style="font-size: 10.5px; padding: 4px 2px; border: 1px solid #3d3d3d; background: #1c1c1c; color: #e0e0e0; border-radius: 4px;">
                <option value="kirakira">${tr.character.presets.kirakira}</option>
                <option value="wanawana">${tr.character.presets.wanawana}</option>
                <option value="iraira">${tr.character.presets.iraira}</option>
                <option value="gaan">${tr.character.presets.gaan}</option>
                <option value="shiin">${tr.character.presets.shiin}</option>
                <option value="doki">${tr.character.presets.doki}</option>
                <option value="biku">${tr.character.presets.biku}</option>
              </select>
              <button id="quick-custom-effect-btn" class="action-btn primary" style="padding: 4px 8px; font-size: 11px; background: #db2777; border-color: #be185d;">${tr.character.show}</button>
            </div>
          </div>

          <!-- Audio Lip-Sync & Player -->
          <div class="section-box">
            <label class="section-label">${tr.character.lipSyncTitle}</label>
            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px;">
              <button id="sample-voice-default" class="model-btn voice-btn active" data-voice="${resolveAssetUrl('/voices/001.wav')}">🎙️ 001.wav</button>
              <button class="model-btn voice-btn" data-voice="${resolveAssetUrl('/voices/scenario_01.wav')}">🎙️ 1. ${lang === 'en' ? 'Stalker?' : 'ストーカー？'}</button>
              <button class="model-btn voice-btn" data-voice="${resolveAssetUrl('/voices/scenario_02.wav')}">🎙️ 2. ${lang === 'en' ? 'Kidding' : '冗談だ'}</button>
              <button class="model-btn voice-btn" data-voice="${resolveAssetUrl('/voices/scenario_03.wav')}">🎙️ 3. ${lang === 'en' ? 'What are you doing?' : '何してるの？'}</button>
              <button id="open-audio-file-btn" class="model-btn" style="flex: 1; min-width: 90px;">${tr.character.openAudioFile}</button>
            </div>
            <div class="player-box">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span id="audio-title" style="font-size: 11px; font-weight: 600; color: #e0e0e0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">001.wav</span>
                <span id="audio-time" style="font-size: 10px; color: #888888; font-family: monospace;">0:00 / 0:00</span>
              </div>
              <input type="range" id="audio-seekbar" min="0" max="100" value="0" step="0.1" style="width: 100%; cursor: pointer; accent-color: #4772b3; height: 4px;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                <div style="display: flex; gap: 4px;">
                  <button id="audio-play-pause-btn" class="action-btn primary" style="padding: 3px 8px; font-size: 11px; font-weight: 600;">▶ ${tr.common.play}</button>
                  <button id="audio-stop-btn" class="action-btn" style="padding: 3px 6px; font-size: 11px;">⏹ ${tr.common.stop}</button>
                  <button id="audio-loop-btn" class="action-btn" style="padding: 3px 6px; font-size: 11px; background: ${isLooping ? '#4772b3' : '#363636'}; color: ${isLooping ? '#ffffff' : '#cccccc'};">🔁 ${tr.common.loop}</button>
                </div>
                <div style="display: flex; align-items: center; gap: 2px;">
                  <span style="font-size: 10px;">🔊</span>
                  <input type="range" id="audio-volume" min="0" max="1" step="0.05" value="1" style="width: 50px; accent-color: #4772b3; height: 4px; cursor: pointer;">
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                <span style="font-size: 10px; color: #888888; min-width: 45px;">${tr.character.detectedPhoneme}</span>
                <div style="display: flex; gap: 3px; flex: 1;">
                  <span class="phoneme-tag" data-phoneme="aa">あ</span>
                  <span class="phoneme-tag" data-phoneme="ih">い</span>
                  <span class="phoneme-tag" data-phoneme="ou">う</span>
                  <span class="phoneme-tag" data-phoneme="ee">え</span>
                  <span class="phoneme-tag" data-phoneme="oh">お</span>
                  <span class="phoneme-tag active" data-phoneme="nn">${tr.character.phonemeClosed}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ==================================================== -->
        <!-- TAB 2: Stage (Time of Day, Scenes, Scenarios, FX)    -->
        <!-- ==================================================== -->
        <div id="tab-pane-stage" class="tab-pane ${currentActiveTab === 'stage' ? 'active' : ''}">
          <!-- 1. 時間帯・ライティング (Time of Day & Lighting) -->
          <div class="section-box" style="border-left: 3px solid #f59e0b; padding-left: 6px;">
            <label class="section-label" style="color: #fbbf24; font-weight: 700;">${tr.scenes.timeOfDayTitle}</label>
            <p style="font-size: 10px; color: #888888; margin: 2px 0 6px 0;">時間帯によってライティング・マテリアル・ポストプロセスが変化します。</p>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div>
                <span style="font-size: 10.5px; color: #aaaaaa; font-weight: 600; display: block; margin-bottom: 3px;">屋外 (Outdoor)</span>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
                  <button data-timeofday="morning" class="timeofday-btn ${currentConfig.activeScene?.timeOfDay === 'morning' ? 'active' : ''}" title="${tr.scenes.presetMorningParkTip}">${tr.scenes.morning}</button>
                  <button data-timeofday="day" class="timeofday-btn ${currentConfig.activeScene?.timeOfDay === 'day' ? 'active' : ''}" title="${tr.scenes.presetDayParkTip}">${tr.scenes.day}</button>
                  <button data-timeofday="evening" class="timeofday-btn ${currentConfig.activeScene?.timeOfDay === 'evening' ? 'active' : ''}" title="${tr.scenes.presetEveningParkTip}">${tr.scenes.evening}</button>
                  <button data-timeofday="rainy" class="timeofday-btn ${currentConfig.activeScene?.timeOfDay === 'rainy' ? 'active' : ''}" title="${tr.scenes.presetRainyParkTip}">${tr.scenes.rainy}</button>
                </div>
              </div>
              <div>
                <span style="font-size: 10.5px; color: #aaaaaa; font-weight: 600; display: block; margin-bottom: 3px;">室内 (Indoor)</span>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px;">
                  <button data-timeofday="bright_indoor" class="timeofday-btn ${currentConfig.activeScene?.timeOfDay === 'bright_indoor' ? 'active' : ''}" title="${tr.scenes.presetBrightIndoorTip}">${tr.scenes.bright}</button>
                  <button data-timeofday="dark_indoor" class="timeofday-btn ${currentConfig.activeScene?.timeOfDay === 'dark_indoor' ? 'active' : ''}" title="${tr.scenes.presetDarkIndoorTip}">${tr.scenes.dark}</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. 場所・背景 (Location & Background) -->
          <div class="section-box">
            <label class="section-label">${tr.scenes.locationTitle}</label>
            <p style="font-size: 10px; color: #888888; margin: 2px 0 6px 0;">背景（場所）のみを切り替えます。時間帯パラメータは維持されます。</p>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="bg-buttons">
              <button data-location="modern_park" data-bg="${resolveAssetUrl('/textures/modern-park-far.jpg')}" data-mid="${resolveAssetUrl('/textures/modern-park-mid.jpg')}" class="bg-btn active">${tr.scenes.backgrounds.modernPark}</button>
              <button data-location="school_gate" data-bg="${resolveAssetUrl('/textures/school-gate-far.jpeg')}" class="bg-btn">${tr.scenes.backgrounds.schoolGate}</button>
              <button data-location="classroom" data-bg="${resolveAssetUrl('/textures/school-corridor-far.jpg')}" class="bg-btn">${tr.scenes.backgrounds.classroom}</button>
              <button data-location="old_park" data-bg="${resolveAssetUrl('/textures/park-background.jpg')}" class="bg-btn">${tr.scenes.backgrounds.oldPark}</button>
              <button data-location="none" data-bg="none" class="bg-btn">${tr.scenes.backgrounds.offSingleColor}</button>
            </div>
          </div>

          <!-- 3. シナリオ・アニメーション演出 (Scenario & Sequences) -->
          <div class="section-box" style="background: #202020; border: 1px solid #333333; border-left: 3px solid #ec4899; padding: 8px; border-radius: 4px;">
            <label class="section-label" style="color: #f472b6; font-weight: 700;">${tr.scenario.confessionTitle}</label>
            <div style="display: flex; gap: 4px; margin-top: 4px;">
              <button id="scenario-confession-btn" class="action-btn primary" style="flex: 1; background: linear-gradient(135deg, #db2777 0%, #be185d 100%); font-weight: 700; box-shadow: 0 4px 12px rgba(219, 39, 119, 0.25); font-size: 12px; padding: 7px;">${tr.scenario.playConfession}</button>
              <button id="scenario-confession-stop-btn" class="action-btn">${tr.scenario.stopScenario}</button>
            </div>
            <div style="font-size: 10.5px; color: #fbcfe8; line-height: 1.4; margin-top: 5px;">
              ${tr.scenario.confessionDesc}
            </div>
          </div>

          <div class="section-box" style="background: #202020; border: 1px solid #333333; border-left: 3px solid #3b82f6; padding: 8px; border-radius: 4px;">
            <label class="section-label" style="color: #60a5fa; font-weight: 700;">${tr.scenario.twoGirlsTitle}</label>
            <div style="display: flex; gap: 4px; margin-top: 4px;">
              <button id="scenario-twogirls-btn" class="action-btn primary" style="flex: 1; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); font-weight: 700; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); font-size: 12px; padding: 7px;">${tr.scenario.playTwoGirls}</button>
              <button id="scenario-twogirls-stop-btn" class="action-btn">${tr.scenario.stopScenario}</button>
            </div>
            <div style="font-size: 10.5px; color: #bfdbfe; line-height: 1.4; margin-top: 5px;">
              ${tr.scenario.twoGirlsDesc}
            </div>
          </div>

          <!-- Scenario Engine Live Debugger -->
          <div class="section-box" style="background: #202020; border: 1px solid #333333; border-radius: 4px; padding: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 600; font-size: 11px; color: #aaaaaa;">${tr.scenario.liveStatus}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 3px; font-size: 11px;">
              <div><span style="color: #888888;">${tr.scenario.sceneId}</span> <strong id="scenario-engine-scene-id" style="color: #5684c8;">-</strong></div>
              <div><span style="color: #888888;">${tr.scenario.speaker}</span> <span id="scenario-engine-speaker" style="font-weight: 600; color: #e0e0e0;">-</span></div>
              <div><span style="color: #888888;">${tr.scenario.acquiredFlags}</span> <span id="scenario-engine-flags" style="color: #72b27b; font-weight: 600;">${tr.scenario.noneFlags}</span></div>
              <div style="margin-top: 2px; padding: 4px 6px; background: #181818; border: 1px solid #333333; border-radius: 4px; min-height: 28px; font-style: italic; color: #cccccc;" id="scenario-engine-text">
                ${tr.scenario.waiting}
              </div>
            </div>
          </div>

          <!-- External Scenario JSON Runner -->
          <div class="section-box">
            <label class="section-label">${tr.scenario.externalJsonTitle}</label>
            <input type="file" id="scenario-json-file-input" accept=".json" style="display: none;">
            <button id="scenario-json-file-btn" class="action-btn" style="width: 100%; padding: 6px;">${tr.scenario.selectJsonFile}</button>
          </div>

          <!-- Conversation Scenario Sequence Controls -->
          <div class="section-box" style="border-left: 3px solid #8b5cf6; padding-left: 6px;">
            <label class="section-label" style="color: #a78bfa; font-weight: 700;">${tr.scenario.conversationTitle}</label>
            <div style="display: flex; gap: 4px;">
              <button id="scenario-play-btn" class="action-btn primary" style="flex: 1; background: #7c3aed; border-color: #6d28d9;">${tr.scenario.playSequence}</button>
              <button id="scenario-stop-btn" class="action-btn">${tr.scenario.stopScenario}</button>
            </div>
            <div id="scenario-status-box" style="display: none; padding: 6px 8px; background: #202020; border: 1px solid #5b21b6; border-radius: 4px; font-size: 11px; margin-top: 4px;">
              <div style="display: flex; align-items: center; justify-content: space-between; font-weight: 700; color: #c4b5fd;">
                <span id="scenario-current-step">${tr.scenario.steps.step1Title}</span>
                <span style="font-size: 10px; color: #a78bfa;">${tr.scenario.playing}</span>
              </div>
              <div id="scenario-current-text" style="color: #d1d5db; margin-top: 2px; font-size: 10.5px; font-style: italic;"></div>
            </div>
          </div>

          <!-- Short Animation Controls -->
          <div class="section-box">
            <label class="section-label">${tr.scenario.shortAnimTitle}</label>
            <div style="display: flex; gap: 4px;">
              <button id="anim-play-btn" class="action-btn primary" style="flex: 1;">${tr.scenario.playAnim}</button>
              <button id="anim-stop-btn" class="action-btn">${tr.scenario.stopScenario}</button>
            </div>
          </div>

          <!-- Stage Details GUI Mount Point -->
          <div id="gui-mount-point-stage" style="margin-top: 6px;"></div>
        </div>

        <!-- ==================================================== -->
        <!-- TAB 3: Visual (Materials, Light, PostFX, FX, Hist)  -->
        <!-- ==================================================== -->
        <div id="tab-pane-visual" class="tab-pane ${currentActiveTab === 'visual' ? 'active' : ''}">
          <!-- Visual Details GUI Mount Point -->
          <div id="gui-mount-point-visual"></div>

          <!-- Color Histogram Mount Container (Below detailed parameters) -->
          <div id="histogram-mount-point" style="margin-top: 8px;"></div>
        </div>

        <!-- ==================================================== -->
        <!-- TAB 4: AI & System (AI Chat, Config JSON, Masters)   -->
        <!-- ==================================================== -->
        <div id="tab-pane-system" class="tab-pane ${currentActiveTab === 'system' ? 'active' : ''}">
          <!-- AI Avatar Chat -->
          <div class="aichat-container">
            <div class="aichat-status-card">
              <div class="aichat-status-header">
                <span class="aichat-status-title">${tr.aichat.title}</span>
                <span id="ai-chat-badge" class="aichat-badge">${tr.aichat.statusUnloaded}</span>
              </div>
              <div id="ai-chat-status-msg" class="aichat-status-detail">${tr.aichat.description}</div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px;">
                <label style="color: #aaaaaa; white-space: nowrap;">${tr.aichat.ttsSteps}:</label>
                <select id="ai-chat-tts-steps-select" style="flex: 1; font-size: 11px; padding: 4px 6px; border-radius: 4px; border: 1px solid #3d3d3d; background: #1e1e1e; color: #ffffff; cursor: pointer;">
                  ${[4, 6, 8, 12, 16]
                    .map(
                      (steps) =>
                        `<option value="${steps}" ${avatarChatController.getTtsNumSteps() === steps ? 'selected' : ''}>${steps}</option>`
                    )
                    .join('')}
                </select>
              </div>
              <button id="ai-chat-init-btn" class="aichat-init-btn">${tr.aichat.prepareAi}</button>
              <div id="ai-chat-webgpu-warn" class="aichat-warning" style="display: none;">${tr.aichat.webgpuWarning}</div>
            </div>

            <div id="ai-chat-messages" class="aichat-messages-box">
              <div id="ai-chat-empty-hint" class="aichat-empty-hint">${tr.aichat.emptyHistory}</div>
            </div>

            <div class="aichat-input-row">
              <input type="text" id="ai-chat-input" class="aichat-input" placeholder="${tr.aichat.inputPlaceholder}" disabled />
              <button id="ai-chat-send-btn" class="aichat-send-btn" disabled>${tr.aichat.send}</button>
            </div>
          </div>

          <!-- Configuration & Master Management -->
          <div class="section-box" style="margin-top: 8px;">
            <label class="section-label">⚙️ 設定JSON管理 (Config JSON)</label>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button id="quick-copy-json" class="action-btn primary" style="flex: 1; min-width: 70px;">📋 ${tr.common.copy}</button>
              <button id="quick-download-json" class="action-btn" style="flex: 1; min-width: 70px;">💾 ${tr.common.save}</button>
              <button id="quick-import-json" class="action-btn" style="flex: 1; min-width: 70px;">📥 ${tr.common.load}</button>
              <button id="quick-reset-json" class="action-btn" style="flex: 1; min-width: 70px;">🔄 ${tr.common.reset}</button>
            </div>
          </div>

          <!-- Master Data Management -->
          <div class="section-box" style="background: #202020; border: 1px solid #333333; border-radius: 4px; padding: 10px;">
            <label class="section-label" style="color: #cccccc; font-size: 11px; margin-bottom: 6px;">${tr.masters.overviewTitle}</label>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 11px;">
              <div style="background: #282828; padding: 6px; border-radius: 4px; border: 1px solid #383838;">
                <span style="color: #888888;">${tr.masters.characterCount}</span> <strong id="master-count-characters" style="color: #ffffff;">2</strong> ${tr.masters.unitCount}
              </div>
              <div style="background: #282828; padding: 6px; border-radius: 4px; border: 1px solid #383838;">
                <span style="color: #888888;">${tr.masters.motionCount}</span> <strong id="master-count-motions" style="color: #ffffff;">13</strong> ${tr.masters.unitType}
              </div>
              <div style="background: #282828; padding: 6px; border-radius: 4px; border: 1px solid #383838;">
                <span style="color: #888888;">${tr.masters.soundCount}</span> <strong id="master-count-sounds" style="color: #ffffff;">14</strong> ${tr.masters.unitType}
              </div>
              <div style="background: #282828; padding: 6px; border-radius: 4px; border: 1px solid #383838;">
                <span style="color: #888888;">${tr.masters.sceneCount}</span> <strong id="master-count-scenes" style="color: #ffffff;">6</strong> ${tr.masters.unitType}
              </div>
            </div>
          </div>

          <div class="section-box">
            <label class="section-label">${tr.masters.batchTitle}</label>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; gap: 4px;">
                <button id="master-export-json-btn" class="action-btn primary" style="flex: 1;">${tr.masters.saveMasters}</button>
                <button id="master-copy-json-btn" class="action-btn">${tr.masters.copyMasters}</button>
              </div>
              <input type="file" id="master-import-file-input" accept=".json" style="display: none;">
              <button id="master-import-json-btn" class="action-btn">${tr.masters.loadMasters}</button>
              <button id="master-reset-btn" class="action-btn" style="color: #f87171; border-color: #7f1d1d; background: #2d1e1e;">${tr.masters.resetMasters}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    bindEvents();
  };

  const bindEvents = () => {
    // Mount Color Histogram UI
    const histMount = document.getElementById('histogram-mount-point');
    if (histMount) {
      colorHistogram.mount(histMount, () => {
        captureAndRenderHistogram();
      });
      if (currentActiveTab === 'histogram') {
        requestAnimationFrame(() => {
          captureAndRenderHistogram();
        });
      }
    }

    // Language Selector
    const langSelect = document.getElementById('language-select') as HTMLSelectElement | null;
    langSelect?.addEventListener('change', () => {
      const selected = langSelect.value as Language;
      setLanguage(selected);
    });

    // Close button
    document.getElementById('panel-close-btn')?.addEventListener('click', () => {
      setPanelOpen(false);
    });

    // Setup Tab Navigation
    const tabBtns = panel!.querySelectorAll<HTMLButtonElement>('.studio-tab-btn');
    const tabPanes = panel!.querySelectorAll<HTMLElement>('.tab-pane');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab') || 'character';
        currentActiveTab = target;
        tabBtns.forEach((b) => b.classList.toggle('active', b === btn));
        tabPanes.forEach((pane) => {
          pane.classList.toggle('active', pane.id === `tab-pane-${target}`);
        });
        if (target === 'visual') {
          requestAnimationFrame(() => {
            captureAndRenderHistogram();
          });
        }
      });
    });

    // Master Data Manager Labels Update
    const updateMasterCountLabels = () => {
      const charEl = document.getElementById('master-count-characters');
      const motEl = document.getElementById('master-count-motions');
      const sndEl = document.getElementById('master-count-sounds');
      const scnEl = document.getElementById('master-count-scenes');
      if (charEl) charEl.textContent = masterManager.getCharacters().length.toString();
      if (motEl) motEl.textContent = masterManager.getMotions().length.toString();
      if (sndEl) sndEl.textContent = masterManager.getSounds().length.toString();
      if (scnEl) scnEl.textContent = masterManager.getScenes().length.toString();
    };
    masterManager.subscribe(updateMasterCountLabels);
    updateMasterCountLabels();

    // --------------------------------------------------
    // Setup AI Avatar Chat UI
    // --------------------------------------------------
    const aiInitBtn = document.getElementById('ai-chat-init-btn') as HTMLButtonElement | null;
    const aiSendBtn = document.getElementById('ai-chat-send-btn') as HTMLButtonElement | null;
    const aiInput = document.getElementById('ai-chat-input') as HTMLInputElement | null;
    const aiBadge = document.getElementById('ai-chat-badge');
    const aiStatusMsg = document.getElementById('ai-chat-status-msg');
    const aiMessages = document.getElementById('ai-chat-messages');
    const aiEmptyHint = document.getElementById('ai-chat-empty-hint');
    const aiWebgpuWarn = document.getElementById('ai-chat-webgpu-warn');

    if (!navigator.gpu && aiWebgpuWarn) {
      aiWebgpuWarn.style.display = 'block';
    }

    const renderChatState = (state: string, statusText?: string) => {
      if (!aiBadge) return;
      aiBadge.className = `aichat-badge ${state}`;

      const curTr = t();
      const stateLabels: Record<string, string> = {
        unloaded: curTr.aichat.statusUnloaded,
        loading: curTr.aichat.statusLoading,
        ready: curTr.aichat.statusReady,
        generating: curTr.aichat.statusGenerating,
        synthesizing: curTr.aichat.statusSynthesizing,
        speaking: curTr.aichat.statusSpeaking,
        error: curTr.aichat.statusError,
      };

      aiBadge.textContent = stateLabels[state] || state;
      if (statusText && aiStatusMsg) {
        aiStatusMsg.textContent = statusText;
      }

      if (aiInitBtn) {
        const isReadyOrActive = state === 'ready' || state === 'speaking' || state === 'generating' || state === 'synthesizing';
        aiInitBtn.style.display = isReadyOrActive ? 'none' : 'block';
        aiInitBtn.disabled = state === 'loading';
      }

      if (aiInput && aiSendBtn) {
        const canSend = state === 'ready';
        aiInput.disabled = !canSend;
        aiSendBtn.disabled = !canSend;
        if (canSend) {
          aiInput.focus();
        }
      }
    };

    avatarChatController.setEvents({
      onStateChange: (state, statusText) => {
        renderChatState(state, statusText);
      },
      onTtsGpuActivityChange: (active) => {
        if (isTtsGpuExclusive === active) return;
        isTtsGpuExclusive = active;
        console.log(
          `[TTS] GPU exclusive mode ${active ? 'enabled (Three.js rendering paused)' : 'disabled'}`
        );
      },
      onMessageAdded: (msg, replyMeta) => {
        if (aiEmptyHint) aiEmptyHint.style.display = 'none';
        if (aiMessages) {
          const msgEl = document.createElement('div');
          msgEl.className = `aichat-msg ${msg.role}`;

          const textEl = document.createElement('div');
          textEl.textContent = msg.content;
          msgEl.appendChild(textEl);

          if (replyMeta) {
            const metaEl = document.createElement('div');
            metaEl.className = 'aichat-msg-meta';
            metaEl.innerHTML = `<span class="aichat-tag">${replyMeta.expression}</span><span class="aichat-tag">${replyMeta.motion}</span>`;
            msgEl.appendChild(metaEl);
          }

          aiMessages.appendChild(msgEl);
          aiMessages.scrollTop = aiMessages.scrollHeight;
        }
      },
      onError: (err) => {
        const msg = typeof err === 'string' ? err : err.message;
        if (aiStatusMsg) aiStatusMsg.textContent = msg;
        renderChatState('error', msg);
      },
    });

    // Initial state reflection
    renderChatState(avatarChatController.getState());

    // Restore existing chat messages
    const existingHistory = avatarChatController.getHistory();
    if (existingHistory.length > 0) {
      if (aiEmptyHint) aiEmptyHint.style.display = 'none';
      if (aiMessages) {
        aiMessages.innerHTML = '';
        existingHistory.forEach((msg) => {
          const msgEl = document.createElement('div');
          msgEl.className = `aichat-msg ${msg.role}`;
          const textEl = document.createElement('div');
          textEl.textContent = msg.content;
          msgEl.appendChild(textEl);
          aiMessages.appendChild(msgEl);
        });
        aiMessages.scrollTop = aiMessages.scrollHeight;
      }
    }

    const aiTtsStepsSelect = document.getElementById(
      'ai-chat-tts-steps-select'
    ) as HTMLSelectElement | null;
    aiTtsStepsSelect?.addEventListener('change', () => {
      avatarChatController.setTtsNumSteps(Number(aiTtsStepsSelect.value));
    });

    aiInitBtn?.addEventListener('click', async () => {
      // AudioContext unblocking
      if ((audioLipSync as any).audioContext?.state === 'suspended') {
        await (audioLipSync as any).audioContext.resume();
      }
      await avatarChatController.initialize();
    });

    const handleSendMessage = async () => {
      if (!aiInput || !aiInput.value.trim()) return;
      const text = aiInput.value.trim();
      aiInput.value = '';
      if ((audioLipSync as any).audioContext?.state === 'suspended') {
        await (audioLipSync as any).audioContext.resume();
      }
      await avatarChatController.sendMessage(text);
    };

    aiSendBtn?.addEventListener('click', handleSendMessage);
    aiInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    document.getElementById('master-export-json-btn')?.addEventListener('click', () => {
      masterManager.downloadJSON('masters.json');
      showToast(t().toasts.mastersDownloaded);
    });

    document.getElementById('master-copy-json-btn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(masterManager.exportJSON());
        showToast(t().toasts.mastersCopied);
      } catch {
        showToast(t().common.copyFailed);
      }
    });

    const masterImportInput = document.getElementById('master-import-file-input') as HTMLInputElement | null;
    document.getElementById('master-import-json-btn')?.addEventListener('click', () => {
      masterImportInput?.click();
    });
    masterImportInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        const ok = masterManager.importJSON(text);
        showToast(ok ? t().toasts.mastersImported : t().toasts.mastersImportFailed);
      }
    });

    document.getElementById('master-reset-btn')?.addEventListener('click', () => {
      masterManager.resetToDefault();
      showToast(t().toasts.mastersReset);
    });

    // External Scenario JSON Runner
    const scenarioJsonInput = document.getElementById('scenario-json-file-input') as HTMLInputElement | null;
    document.getElementById('scenario-json-file-btn')?.addEventListener('click', () => {
      scenarioJsonInput?.click();
    });
    scenarioJsonInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const customScenario = JSON.parse(text);
          if (scenarioPlayer.isPlaying) scenarioPlayer.stop();
          if (animationPlayer.isPlaying) animationPlayer.stop();
          scenarioEngine.play(customScenario);
          showToast(`${t().toasts.scenarioStarted}「${customScenario.title || file.name}」`);
        } catch (err) {
          showToast(t().toasts.scenarioJsonFailed);
        }
      }
    });

    // Setup Modular lil-guis for each tab
    setupGUI();

    // Setup Quick JSON Actions
    document.getElementById('quick-copy-json')?.addEventListener('click', async () => {
      const ok = await copyConfigToClipboard(currentConfig);
      showToast(ok ? t().toasts.configCopied : t().common.copyFailed);
    });

    document.getElementById('quick-download-json')?.addEventListener('click', () => {
      downloadConfigJSON(currentConfig);
      showToast(t().toasts.configSaved);
    });

    document.getElementById('quick-import-json')?.addEventListener('click', () => {
      openImportModal();
    });

    document.getElementById('quick-reset-json')?.addEventListener('click', () => {
      deepAssign(currentConfig, DEFAULT_CONFIG);
      applyConfigToSceneAndRenderer(currentConfig);
      updateAllGuisDisplay();
      syncTimeOfDayButtons();
      syncBgButtons();
      showToast(t().toasts.configReset);
    });

    // Time of Day Buttons
    const timeOfDayButtons = document.querySelectorAll<HTMLButtonElement>('.timeofday-btn');
    timeOfDayButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const todId = btn.getAttribute('data-timeofday') as TimeOfDayId;
        if (todId) {
          switchTimeOfDay(todId);
        }
      });
    });
    syncTimeOfDayButtons();

    // Animation Play/Stop
    document.getElementById('anim-play-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      animationPlayer.play();
      showToast(t().toasts.animStarted);
    });

    document.getElementById('anim-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      animationPlayer.stop();
      showToast(t().toasts.animStopped);
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
        scenarioEngine.play(getParkConfessionScenario(getLanguage()));
        showToast(t().toasts.confessionStarted);
      }
    });

    document.getElementById('scenario-confession-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scenarioEngine.stop();
      showToast(t().toasts.scenarioStopped);
    });

    // Interactive 2-Girl Dialogue Scenario Play/Stop
    document.getElementById('scenario-twogirls-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (scenarioEngine.isPlaying) {
        scenarioEngine.stop();
      } else {
        if (scenarioPlayer.isPlaying) scenarioPlayer.stop();
        if (animationPlayer.isPlaying) animationPlayer.stop();
        scenarioEngine.play(getTwoGirlsConversationScenario(getLanguage()));
        showToast(t().toasts.twoGirlsStarted);
      }
    });

    document.getElementById('scenario-twogirls-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scenarioEngine.stop();
      showToast(t().toasts.scenarioStopped);
    });

    // Background Buttons
    const bgButtons = document.querySelectorAll<HTMLButtonElement>('.bg-btn');
    bgButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const bg = btn.getAttribute('data-bg');
        const mid = btn.getAttribute('data-mid');
        const loc = btn.getAttribute('data-location');
        if (loc) {
          if (!currentConfig.activeScene) {
            currentConfig.activeScene = { location: loc };
          } else {
            currentConfig.activeScene.location = loc;
          }
        }
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
        updateAllGuisDisplay();
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
    document.querySelectorAll<HTMLButtonElement>('.effect-text-btn[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset');
        const text = btn.getAttribute('data-text');
        const expr = btn.getAttribute('data-expr');

        if (!preset || !text) return;

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
          showToast(`💬 「${text}」`);
        }
      });
    });

    // Quick Sweat Mark Button (4-way parabolic burst)
    document.getElementById('quick-sweat-btn')?.addEventListener('click', () => {
      if (avatarInstance) {
        avatarInstance.setExpression('surprised', 1.0);
        exprButtons.forEach((b) => {
          b.classList.toggle('active', b.getAttribute('data-expr') === 'surprised');
        });
        avatarInstance.showFlySweat({ duration: 3.0 });
        showToast('💦 焦り表情 ＋ 4方向放物線の汗マークを発動しました');
      }
    });

    // Quick Jito Sweat Button (Temple cold sweat drip)
    document.getElementById('quick-jito-btn')?.addEventListener('click', () => {
      if (avatarInstance) {
        avatarInstance.setExpression('relaxed', 1.0);
        exprButtons.forEach((b) => {
          b.classList.toggle('active', b.getAttribute('data-expr') === 'relaxed');
        });
        avatarInstance.showJitoSweat({ side: 'right', duration: 3.0 });
        showToast('😑 ジト目表情 ＋ こめかみ冷や汗（タラーッ…）を発動しました');
      }
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
        showToast(`💬 「${text}」`);
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
          showToast(`🎙️ ${title}`);
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

    loopBtn?.addEventListener('click', () => {
      isLooping = !isLooping;
      audioLipSync.setLoop(isLooping);
      loopBtn.classList.toggle('active', isLooping);
      loopBtn.style.background = isLooping ? '#4772b3' : '#363636';
      loopBtn.style.color = isLooping ? '#ffffff' : '#cccccc';
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
  };

  // Setup Minimize / Open toggle
  let isPanelOpen = true;
  setPanelOpen = (open: boolean) => {
    isPanelOpen = open;
    panel!.style.display = isPanelOpen ? 'flex' : 'none';
    gearBtn!.style.display = isPanelOpen ? 'none' : 'flex';
  };

  gearBtn.addEventListener('click', () => {
    setPanelOpen(true);
  });

  // Render initial UI
  renderUI();
  setPanelOpen(true);

  // Listen for language changes
  onLanguageChange(() => {
    renderUI();
    rebuildGUI();
  });
}

setupUnifiedUI();

// Initial load of default voice (001.wav)
audioLipSync.loadAudioUrl(resolveAssetUrl('/voices/001.wav'), '001.wav');


// --------------------------------------------------
// Resize & Render Loop
// --------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document);

function onResize(): void {
  const { width, height } = getViewportSize();
  const pr = Math.min(window.devicePixelRatio, 2);

  camera.aspect = 16 / 9;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height, false);
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
  composer.setSize(width, height);
  if (smaaPass) {
    smaaPass.setSize(width * pr, height * pr);
  }
}
window.addEventListener('resize', onResize);

function tick(timestamp?: number): void {
  timer.update(timestamp);
  const delta = timer.getDelta();
  const elapsed = timer.getElapsed();

  // Three.js/WebGL and ORT/WebGPU otherwise compete for the same Metal GPU.
  // Keep rAF alive for a clean clock, but submit no rendering work while an
  // Irodori inference run is active. Rendering resumes between TTS chunks.
  if (isTtsGpuExclusive) {
    requestAnimationFrame(tick);
    return;
  }

  if (animationPlayer.isPlaying) {
    animationPlayer.update(delta);
  } else if (dialogueCameraController?.isActive) {
    dialogueCameraController.update(delta);
  } else {
    controls.update();
  }

  // Update dynamic background zoom
  updateBackgroundZoom();

  // Keep midground properly aligned to camera perspective & zoom
  updateMidgroundTransform();

  if (isMultiAvatarScenarioActive) {
    const activeSpeakerId = scenarioEngine.currentScene?.speakerCharacterId;
    for (const [charId, av] of scenarioAvatars.entries()) {
      const isSpeaking = activeSpeakerId ? (activeSpeakerId === charId) : true;
      if (currentConfig.lipSync.enabled && isSpeaking) {
        av.updateLipSync(
          audioLipSync.currentPhoneme,
          currentConfig.lipSync.gain,
          currentConfig.lipSync.smoothing,
          delta
        );
      } else {
        av.updateLipSync(undefined, currentConfig.lipSync.gain, currentConfig.lipSync.smoothing, delta);
      }
      av.update(delta, elapsed, () => {
        windController.update(av.vrm ?? null, currentConfig.wind, elapsed);
      });
    }
  } else if (avatarInstance) {
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

  // Update Rain Particles
  rainEffect.setCameraPosition(camera.position);
  rainEffect.update(elapsed);

  // Update Sun & Lens Flare effect
  const vrmMeshes: THREE.Object3D[] = [];
  if (isMultiAvatarScenarioActive) {
    for (const av of scenarioAvatars.values()) {
      if (av.vrm?.scene) vrmMeshes.push(av.vrm.scene);
    }
  } else if (avatarInstance?.vrm?.scene) {
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

  // Render Effect Texts (漫符・文字エフェクト) on top of post-processing & sun effects
  if (effectTextScene.children.length > 0) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(effectTextScene, camera);
    renderer.autoClear = true;
  }

  requestAnimationFrame(tick);
}


tick();
