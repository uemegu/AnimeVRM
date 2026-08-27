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
import { GTToneMappingShader } from './shader/GTToneMappingShader';
import { ScreenSpaceOutlinePass } from './postprocessing/ScreenSpaceOutlinePass';
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

// Active configuration state
const currentConfig: AvatarConfig = cloneConfig(DEFAULT_CONFIG);

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

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);

renderer.outputColorSpace = THREE.SRGBColorSpace;

function getToneMappingMode(mode: string): THREE.ToneMapping {
  switch (mode) {
    case 'GranTurismo':
      // Gran Turismo Tone Mapping is handled by custom shader pass before OutputPass
      return THREE.NoToneMapping;
    case 'ACESFilmic':
      return THREE.ACESFilmicToneMapping;
    case 'Reinhard':
      return THREE.ReinhardToneMapping;
    case 'AgX':
      return THREE.AgXToneMapping;
    case 'Linear':
      return THREE.LinearToneMapping;
    case 'None':
      return THREE.NoToneMapping;
    default:
      return THREE.NoToneMapping;
  }
}

renderer.toneMapping = getToneMappingMode(currentConfig.postProcessing.toneMappingMode);
renderer.toneMappingExposure = currentConfig.postProcessing.toneMappingExposure;
renderer.shadowMap.enabled = currentConfig.lighting.castShadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// --------------------------------------------------
// Scene & Camera
// --------------------------------------------------
const scene = new THREE.Scene();

const textureLoader = new THREE.TextureLoader();
const backgroundTextureCache = new Map<string, THREE.Texture>();

function getBackgroundTexture(url: string): THREE.Texture {
  if (backgroundTextureCache.has(url)) {
    return backgroundTextureCache.get(url)!;
  }
  const texture = textureLoader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  backgroundTextureCache.set(url, texture);
  return texture;
}

function updateBackgroundDisplay(cfg: AvatarConfig): void {
  if (cfg.environment.showBackgroundImage && cfg.environment.backgroundImageUrl) {
    scene.background = getBackgroundTexture(cfg.environment.backgroundImageUrl);
    document.body.style.backgroundColor = '#000000';
  } else {
    scene.background = new THREE.Color(cfg.environment.backgroundColor);
    document.body.style.backgroundColor = cfg.environment.backgroundColor;
  }
}

updateBackgroundDisplay(currentConfig);

const camera = new THREE.PerspectiveCamera(
  30,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0.0, 1.25, 2.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.15, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 0.8;
controls.maxDistance = 6.0;
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = Math.PI / 2 + 0.1;

// --------------------------------------------------
// Lights
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
dirLight.castShadow = currentConfig.lighting.castShadows;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -2;
dirLight.shadow.camera.right = 2;
dirLight.shadow.camera.top = 2.5;
dirLight.shadow.camera.bottom = -0.5;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 12;
dirLight.shadow.bias = -0.0001;
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

// --------------------------------------------------
// Environment / Floor
// --------------------------------------------------
const floorGeo = new THREE.CircleGeometry(8, 64);
const floorMat = new THREE.MeshStandardMaterial({
  color: currentConfig.environment.floorColor,
  roughness: 0.9,
  metalness: 0.0,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
floor.visible = currentConfig.environment.showFloor;
scene.add(floor);

// --------------------------------------------------
// Post Processing Pipeline
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

// 2. Screen-Space Depth & Normal Edge Outline Pass (for interior intersection edges)
const screenSpaceOutlinePass = new ScreenSpaceOutlinePass(
  scene,
  camera,
  window.innerWidth * pixelRatio,
  window.innerHeight * pixelRatio,
  currentConfig.outline.screenSpaceOutline
);
composer.addPass(screenSpaceOutlinePass);

// 3. Bloom Pass (HDR high brightness glow)
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  currentConfig.postProcessing.bloom.strength,
  currentConfig.postProcessing.bloom.radius,
  currentConfig.postProcessing.bloom.threshold
);
composer.addPass(bloomPass);

// 4. Gran Turismo (GT) Tone Mapping Shader Pass
const gtToneMappingPass = new ShaderPass(GTToneMappingShader);
gtToneMappingPass.uniforms['uEnabled'].value = currentConfig.postProcessing.toneMappingMode === 'GranTurismo' ? 1.0 : 0.0;
gtToneMappingPass.uniforms['uMaxLuminance'].value = currentConfig.postProcessing.granTurismo.maxLuminance;
gtToneMappingPass.uniforms['uContrast'].value = currentConfig.postProcessing.granTurismo.contrast;
gtToneMappingPass.uniforms['uLinearSection'].value = currentConfig.postProcessing.granTurismo.linearSection;
gtToneMappingPass.uniforms['uLinearLength'].value = currentConfig.postProcessing.granTurismo.linearLength;
gtToneMappingPass.uniforms['uBlackTightness'].value = currentConfig.postProcessing.granTurismo.blackTightness;
gtToneMappingPass.uniforms['uPedestal'].value = currentConfig.postProcessing.granTurismo.pedestal;
composer.addPass(gtToneMappingPass);

// 5. OutputPass: Converts Linear HDR to sRGB color space & applies Tone Mapping if standard mode
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

  // Screen Space Outline
  if (cfg.outline.screenSpaceOutline) {
    screenSpaceOutlinePass.updateParams(cfg.outline.screenSpaceOutline);
  }

  // Tone Mapping (Standard vs Gran Turismo)
  renderer.toneMapping = getToneMappingMode(cfg.postProcessing.toneMappingMode);
  renderer.toneMappingExposure = cfg.postProcessing.toneMappingExposure;

  const isGT = cfg.postProcessing.toneMappingMode === 'GranTurismo';
  gtToneMappingPass.uniforms['uEnabled'].value = isGT ? 1.0 : 0.0;
  if (cfg.postProcessing.granTurismo) {
    gtToneMappingPass.uniforms['uMaxLuminance'].value = cfg.postProcessing.granTurismo.maxLuminance;
    gtToneMappingPass.uniforms['uContrast'].value = cfg.postProcessing.granTurismo.contrast;
    gtToneMappingPass.uniforms['uLinearSection'].value = cfg.postProcessing.granTurismo.linearSection;
    gtToneMappingPass.uniforms['uLinearLength'].value = cfg.postProcessing.granTurismo.linearLength;
    gtToneMappingPass.uniforms['uBlackTightness'].value = cfg.postProcessing.granTurismo.blackTightness;
    gtToneMappingPass.uniforms['uPedestal'].value = cfg.postProcessing.granTurismo.pedestal;
  }

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
  }
}

// --------------------------------------------------
// Lil-GUI Setup
// --------------------------------------------------
let gui: GUI;

function setupGUI(): void {
  gui = new GUI({ title: '✨ パラメータ' });
  gui.domElement.style.position = 'fixed';
  gui.domElement.style.top = '16px';
  gui.domElement.style.right = '16px';
  gui.domElement.style.zIndex = '1000';

  // 1. JSON Export / Import folder at the top
  const jsonFolder = gui.addFolder('💾 設定JSON エクスポート / 読込');
  const jsonActions = {
    copyJSON: async () => {
      const ok = await copyConfigToClipboard(currentConfig);
      showToast(ok ? '📋 設定JSONをクリップボードにコピーしました！' : 'コピーに失敗しました');
    },
    downloadJSON: () => {
      downloadConfigJSON(currentConfig);
      showToast('💾 avatar-config.json をダウンロードしました');
    },
    importJSON: () => {
      openImportModal();
    },
    resetDefaults: () => {
      deepAssign(currentConfig, DEFAULT_CONFIG);
      applyConfigToSceneAndRenderer(currentConfig);
      gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
      showToast('🔄 デフォルト設定にリセットしました');
    },
  };

  jsonFolder.add(jsonActions, 'copyJSON').name('📋 設定JSONをコピー');
  jsonFolder.add(jsonActions, 'downloadJSON').name('💾 JSONファイル保存');
  jsonFolder.add(jsonActions, 'importJSON').name('📥 JSONを読み込み');
  jsonFolder.add(jsonActions, 'resetDefaults').name('🔄 デフォルトにリセット');
  jsonFolder.close();

  // 2. Quick Feature Toggles (1クリックで各機能のON/OFFを切り替え)
  const toggleFolder = gui.addFolder('⚡ 各機能 個別 ON/OFF トグル (Feature Toggles)');
  const toggleState = {
    gtToneMapping: currentConfig.postProcessing.toneMappingMode === 'GranTurismo',
    colorGrading: currentConfig.postProcessing.colorGrading.enabled,
    bloom: currentConfig.postProcessing.bloom.enabled,
    customShadowBody: currentConfig.materials.body.useCustomShadeColor,
    customShadowHair: currentConfig.materials.hair.useCustomShadeColor,
    customShadowCloth: currentConfig.materials.cloth.useCustomShadeColor,
    autoShadowBody: currentConfig.materials.body.autoShadowColor,
    autoShadowHair: currentConfig.materials.hair.autoShadowColor,
    autoShadowCloth: currentConfig.materials.cloth.autoShadowColor,
    smoothNormal: currentConfig.outline.useSmoothNormal,
    screenSpaceWidth: currentConfig.outline.screenSpaceWidth,
    screenSpaceOutline: currentConfig.outline.screenSpaceOutline.enabled,
    rimBody: currentConfig.materials.body.rimEnabled,
    rimCloth: currentConfig.materials.cloth.rimEnabled,
    rimLight: currentConfig.lighting.rim.enabled,
  };

  toggleFolder
    .add(toggleState, 'gtToneMapping')
    .name('🏎️ GTトーンマッピング')
    .onChange((val: boolean) => {
      currentConfig.postProcessing.toneMappingMode = val ? 'GranTurismo' : 'None';
      applyConfigToSceneAndRenderer(currentConfig);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

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
    .add(toggleState, 'customShadowBody')
    .name('🎨 手動影色有効 (肌/体)')
    .onChange((val: boolean) => {
      currentConfig.materials.body.useCustomShadeColor = val;
      avatarInstance?.shaderController?.updateMaterialStyle('body', currentConfig.materials.body);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

  toggleFolder
    .add(toggleState, 'customShadowHair')
    .name('🎨 手動影色有効 (髪)')
    .onChange((val: boolean) => {
      currentConfig.materials.hair.useCustomShadeColor = val;
      avatarInstance?.shaderController?.updateMaterialStyle('hair', currentConfig.materials.hair);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

  toggleFolder
    .add(toggleState, 'customShadowCloth')
    .name('🎨 手動影色有効 (衣装)')
    .onChange((val: boolean) => {
      currentConfig.materials.cloth.useCustomShadeColor = val;
      avatarInstance?.shaderController?.updateMaterialStyle('cloth', currentConfig.materials.cloth);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

  toggleFolder
    .add(toggleState, 'autoShadowBody')
    .name('🤖 自動影色HSV (肌/体)')
    .onChange((val: boolean) => {
      currentConfig.materials.body.autoShadowColor = val;
      avatarInstance?.shaderController?.updateMaterialStyle('body', currentConfig.materials.body);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

  toggleFolder
    .add(toggleState, 'autoShadowHair')
    .name('🤖 自動影色HSV (髪)')
    .onChange((val: boolean) => {
      currentConfig.materials.hair.autoShadowColor = val;
      avatarInstance?.shaderController?.updateMaterialStyle('hair', currentConfig.materials.hair);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

  toggleFolder
    .add(toggleState, 'autoShadowCloth')
    .name('🤖 自動影色HSV (衣装)')
    .onChange((val: boolean) => {
      currentConfig.materials.cloth.autoShadowColor = val;
      avatarInstance?.shaderController?.updateMaterialStyle('cloth', currentConfig.materials.cloth);
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
    .add(toggleState, 'screenSpaceOutline')
    .name('🖼️ 内側交差線 (Edge Pass)')
    .onChange((val: boolean) => {
      currentConfig.outline.screenSpaceOutline.enabled = val;
      applyConfigToSceneAndRenderer(currentConfig);
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

  toggleFolder.open();

  // 3. VRM Model Folder
  const modelFolder = gui.addFolder('👤 VRMモデル切替 (Model Select)');
  const modelState = {
    model: currentModelUrl,
    openLocalFile: () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.vrm';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const blobUrl = URL.createObjectURL(file);
          loadAvatarModel(blobUrl);
        }
      };
      input.click();
    },
  };
  modelFolder
    .add(modelState, 'model', {
      '👧 girl.vrm (デフォルト)': resolveAssetUrl('/models/girl.vrm'),
      '👤 avatar.vrm': resolveAssetUrl('/models/avatar.vrm'),
    })
    .name('モデル選択')
    .onChange((url: string) => {
      loadAvatarModel(url);
    });
  modelFolder.add(modelState, 'openLocalFile').name('📁 VRMファイルを開く (PC内)');
  modelFolder.open();

  // Helper to add material folder
  const addMaterialFolder = (title: string, kind: 'body' | 'hair' | 'cloth') => {
    const folder = gui.addFolder(title);
    const params = currentConfig.materials[kind];
    const update = () => avatarInstance?.shaderController?.updateMaterialStyle(kind, params);

    folder.add(params, 'useCustomShadeColor').name('🎨 手動影色有効 (Custom Shade)').onChange(update);
    folder.addColor(params, 'shadeColor').name('手動影色 (Shade Color)').onChange(update);
    folder.add(params, 'autoShadowColor').name('🤖 自動影色 (Auto HSV)').onChange(update);
    folder.add(params, 'shadowHueShift', 0.0, 0.25, 0.01).name('影の寒色シフト (Hue Shift)').onChange(update);
    folder.add(params, 'shadingToonyFactor', 0, 1, 0.01).name('トゥーン度 (Toony)').onChange(update);
    folder.add(params, 'shadingShiftFactor', -1, 1, 0.01).name('明暗境界シフト (Shift)').onChange(update);
    folder.add(params, 'giEqualizationFactor', 0, 1, 0.01).name('環境光均一化 (GI)').onChange(update);

    folder.add(params, 'rimEnabled').name('リムライト有効 (Rim ON)').onChange(update);
    folder.addColor(params, 'rimColor').name('リムライト色 (Rim Color)').onChange(update);
    folder.add(params, 'parametricRimFresnelPowerFactor', 0, 10, 0.1).name('リム急峻度 (Fresnel Power)').onChange(update);
    folder.add(params, 'parametricRimLiftFactor', 0, 5, 0.01).name('リム持ち上げ (Lift)').onChange(update);
    folder.add(params, 'rimLightingMixFactor', 0, 2, 0.01).name('リム光合成比率 (Mix)').onChange(update);
    folder.addColor(params, 'outlineColor').name('輪郭線の色 (Outline Color)').onChange(update);
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
    .add(currentConfig.outline, 'autoColorFromMaterial')
    .name('🎨 マテリアル色から自動設定')
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'darknessFactor', 0.1, 0.9, 0.05)
    .name('線の暗さ (Darkness)')
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'usePerMaterialColor')
    .name('部位別カラー連動 (Per-Material)')
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .addColor(currentConfig.outline, 'color')
    .name('手動共通線色 (Manual Color)')
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'widthFactor', 0, 0.01, 0.0002)
    .name('輪郭線の太さ (Width)')
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'lightingMixFactor', 0, 1, 0.01)
    .name('光影響比率 (Lighting Mix)')
    .onChange(() => avatarInstance?.shaderController?.updateOutline(currentConfig.outline));

  // Screen Space Outline Sub-folder (Interior intersection lines)
  const ssoFolder = outlineFolder.addFolder('🖼️ 内側交差線 (Screen-space Outline)');
  const updateSSO = () => screenSpaceOutlinePass.updateParams(currentConfig.outline.screenSpaceOutline);
  ssoFolder.add(currentConfig.outline.screenSpaceOutline, 'enabled').name('内側交差線有効').onChange(updateSSO);
  ssoFolder.addColor(currentConfig.outline.screenSpaceOutline, 'color').name('線の色').onChange(updateSSO);
  ssoFolder.add(currentConfig.outline.screenSpaceOutline, 'edgeStrength', 0, 2.0, 0.05).name('線の濃さ (Strength)').onChange(updateSSO);
  ssoFolder.add(currentConfig.outline.screenSpaceOutline, 'depthThreshold', 0.0005, 0.02, 0.0005).name('深度感度 (Depth Sens)').onChange(updateSSO);
  ssoFolder.add(currentConfig.outline.screenSpaceOutline, 'normalThreshold', 0.1, 1.0, 0.02).name('法線感度 (Normal Sens)').onChange(updateSSO);
  ssoFolder.add(currentConfig.outline.screenSpaceOutline, 'thickness', 0.5, 3.0, 0.25).name('線幅 (Thickness)').onChange(updateSSO);
  ssoFolder.open();
  outlineFolder.close();

  // 5. Environment Folder
  const envFolder = gui.addFolder('環境・背景 (Environment)');
  envFolder
    .add(currentConfig.environment, 'showBackgroundImage')
    .name('背景画像 ON (Background Image)')
    .onChange(() => {
      updateBackgroundDisplay(currentConfig);
      syncBgButtons();
    });
  envFolder
    .add(currentConfig.environment, 'backgroundImageUrl', {
      '🌳 公園 (Park)': resolveAssetUrl('/textures/park-background.jpg'),
      '🏠 部屋 (Room)': resolveAssetUrl('/textures/room-background.jpg'),
    })
    .name('背景画像選択')
    .onChange(() => {
      updateBackgroundDisplay(currentConfig);
      syncBgButtons();
    });
  envFolder
    .addColor(currentConfig.environment, 'backgroundColor')
    .name('単色背景 (Background Color)')
    .onChange(() => updateBackgroundDisplay(currentConfig));
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
  lightFolder.close();

  // 7. Post Processing Folder
  const postFolder = gui.addFolder('ポストプロセス (Post Processing)');
  postFolder
    .add(currentConfig.postProcessing, 'toneMappingMode', ['GranTurismo', 'ACESFilmic', 'Reinhard', 'AgX', 'Linear', 'None'])
    .name('トーンマッピング方式')
    .onChange((mode: string) => {
      applyConfigToSceneAndRenderer(currentConfig);
    });

  postFolder
    .add(currentConfig.postProcessing, 'toneMappingExposure', 0.2, 2.5, 0.05)
    .name('露出 (Exposure)')
    .onChange((val: number) => (renderer.toneMappingExposure = val));

  // GT Tone Mapping Sub-folder
  const gtFolder = postFolder.addFolder('🏎️ Gran Turismo (GT) トーン設定');
  const updateGT = () => {
    if (currentConfig.postProcessing.granTurismo) {
      gtToneMappingPass.uniforms['uMaxLuminance'].value = currentConfig.postProcessing.granTurismo.maxLuminance;
      gtToneMappingPass.uniforms['uContrast'].value = currentConfig.postProcessing.granTurismo.contrast;
      gtToneMappingPass.uniforms['uLinearSection'].value = currentConfig.postProcessing.granTurismo.linearSection;
      gtToneMappingPass.uniforms['uLinearLength'].value = currentConfig.postProcessing.granTurismo.linearLength;
      gtToneMappingPass.uniforms['uBlackTightness'].value = currentConfig.postProcessing.granTurismo.blackTightness;
      gtToneMappingPass.uniforms['uPedestal'].value = currentConfig.postProcessing.granTurismo.pedestal;
    }
  };
  gtFolder.add(currentConfig.postProcessing.granTurismo, 'contrast', 0.5, 2.0, 0.05).name('コントラスト (a)').onChange(updateGT);
  gtFolder.add(currentConfig.postProcessing.granTurismo, 'linearSection', 0.05, 0.6, 0.02).name('リニア開始 (m)').onChange(updateGT);
  gtFolder.add(currentConfig.postProcessing.granTurismo, 'linearLength', 0.1, 0.8, 0.02).name('リニア長 (l)').onChange(updateGT);
  gtFolder.add(currentConfig.postProcessing.granTurismo, 'blackTightness', 0.5, 3.0, 0.1).name('黒の締まり (c)').onChange(updateGT);
  gtFolder.open();

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

  // 8. Lip Sync Folder
  const lipFolder = gui.addFolder('🎵 リップシンク設定 (Lip Sync)');
  lipFolder
    .add(currentConfig.lipSync, 'enabled')
    .name('リップシンク有効 (Enabled)');
  lipFolder
    .add(currentConfig.lipSync, 'gain', 0.0, 1.5, 0.05)
    .name('口の開き倍率 (Gain)');
  lipFolder
    .add(currentConfig.lipSync, 'smoothing', 0.05, 0.6, 0.01)
    .name('スムージング速度 (Smoothing)');
  lipFolder
    .add(currentConfig.lipSync, 'rmsThreshold', 0.001, 0.05, 0.001)
    .name('無音判定閾値 (RMS Threshold)')
    .onChange((val: number) => {
      audioLipSync.rmsThreshold = val;
    });
  lipFolder.open();
}

setupGUI();

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
          deepAssign(currentConfig, parsed);
          applyConfigToSceneAndRenderer(currentConfig);
          gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
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

// --------------------------------------------------
// UI Overlay (Left-side HUD for Expressions, Motions & Lip-Sync)
// --------------------------------------------------
function createUIOverlay() {
  const container = document.createElement('div');
  container.id = 'ui-container';
  container.style.position = 'fixed';
  container.style.top = '16px';
  container.style.left = '16px';
  container.style.zIndex = '100';
  container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  container.style.fontSize = '13px';
  container.style.color = '#1e293b';
  container.style.background = 'rgba(255, 255, 255, 0.92)';
  container.style.backdropFilter = 'blur(10px)';
  container.style.padding = '14px 18px';
  container.style.borderRadius = '12px';
  container.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)';
  container.style.maxWidth = '340px';
  container.style.maxHeight = '90vh';
  container.style.overflowY = 'auto';
  container.style.userSelect = 'none';

  container.innerHTML = `
    <div style="font-weight: 700; font-size: 15px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
      <span style="color: #4f46e5;">✨</span> VRM ビュワー
    </div>
    <div id="loading-status" style="font-size: 12px; color: #64748b; margin-bottom: 10px;">
      モデル読み込み中... <span id="progress-text">0%</span>
    </div>
    <div id="controls-panel" style="display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; gap: 4px; flex-wrap: wrap;">
        <button id="quick-copy-json" style="flex: 1; min-width: 90px; padding: 6px 8px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">📋 JSONコピー</button>
        <button id="quick-download-json" style="padding: 6px 8px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 11px;">💾 保存</button>
        <button id="quick-import-json" style="padding: 6px 8px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 11px;">📥 読込</button>
        <button id="quick-reset-json" style="padding: 6px 8px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 11px;">🔄 リセット</button>
      </div>

        <!-- 音声リップシンク (Audio Lip-Sync) セクション -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 8px;">
          <label style="font-weight: 600; display: block; margin-bottom: 4px;">🎵 音声リップシンク (Audio Lip-Sync)</label>
          <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px;">
            <button id="sample-voice-default" class="model-btn voice-btn active" data-voice="${resolveAssetUrl('/voices/001.wav')}">🎙️ 001.wav (デフォルト)</button>
            <button id="sample-voice-1" class="model-btn voice-btn" data-voice="${resolveAssetUrl('/voice/sample1.mp3')}">🎙️ サンプル1 (女声)</button>
            <button id="sample-voice-2" class="model-btn voice-btn" data-voice="${resolveAssetUrl('/voice/sample2.mp3')}">🎙️ サンプル2 (女声)</button>
            <button id="sample-voice-3" class="model-btn voice-btn" data-voice="${resolveAssetUrl('/voice/sample3.mp3')}">🎙️ サンプル3 (男声)</button>
            <button id="open-audio-file-btn" class="model-btn" style="flex: 1; min-width: 120px;">📁 音声ファイルを開く</button>
          </div>

          <!-- プレイヤーUI -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span id="audio-title" style="font-size: 11px; font-weight: 600; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">001.wav</span>
              <span id="audio-time" style="font-size: 10px; color: #64748b; font-family: monospace;">0:00 / 0:00</span>
            </div>

            <!-- シークバー -->
            <input type="range" id="audio-seekbar" min="0" max="100" value="0" step="0.1" style="width: 100%; cursor: pointer; accent-color: #4f46e5; height: 4px;">

            <!-- コントロールボタン群 -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
              <div style="display: flex; gap: 4px;">
                <button id="audio-play-pause-btn" style="padding: 3px 8px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">▶ 再生</button>
                <button id="audio-stop-btn" style="padding: 3px 6px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; font-size: 11px;">⏹ 停止</button>
                <button id="audio-loop-btn" style="padding: 3px 6px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; font-size: 11px;">🔁 ループ</button>
              </div>
              <!-- 音量 -->
              <div style="display: flex; align-items: center; gap: 2px;">
                <span style="font-size: 10px;">🔊</span>
                <input type="range" id="audio-volume" min="0" max="1" step="0.05" value="1" style="width: 50px; accent-color: #4f46e5; height: 4px; cursor: pointer;">
              </div>
            </div>

            <!-- 音素モニター (LipSync Phoneme Monitor) -->
            <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
              <span style="font-size: 10px; color: #64748b; min-width: 45px;">判定音素:</span>
              <div style="display: flex; gap: 3px; flex: 1;">
                <span class="phoneme-tag" data-phoneme="aa">あ (aa)</span>
                <span class="phoneme-tag" data-phoneme="ih">い (ih)</span>
                <span class="phoneme-tag" data-phoneme="ou">う (ou)</span>
                <span class="phoneme-tag" data-phoneme="ee">え (ee)</span>
                <span class="phoneme-tag" data-phoneme="oh">お (oh)</span>
                <span class="phoneme-tag active" data-phoneme="nn">閉 (nn)</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 4px;">背景画像 (Background)</label>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="bg-buttons">
            <button data-bg="${resolveAssetUrl('/textures/park-background.jpg')}" class="bg-btn active">🌳 公園 (ON)</button>
            <button data-bg="${resolveAssetUrl('/textures/room-background.jpg')}" class="bg-btn">🏠 部屋</button>
            <button data-bg="none" class="bg-btn">OFF (単色)</button>
          </div>
        </div>
        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 4px;">モデル切替 (VRM Model)</label>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="model-buttons">
            <button data-model="${resolveAssetUrl('/models/girl.vrm')}" class="model-btn active">👧 girl.vrm</button>
            <button data-model="${resolveAssetUrl('/models/avatar.vrm')}" class="model-btn">👤 avatar.vrm</button>
            <button id="open-local-vrm-btn" class="model-btn">📁 ファイル選択</button>
          </div>
        </div>
        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 4px;">モーション (Motion)</label>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="motion-buttons">
            <button data-motion="${resolveAssetUrl('/animations/Idle.fbx')}" class="motion-btn active">待機</button>
            <button data-motion="${resolveAssetUrl('/animations/Standing Greeting.fbx')}" class="motion-btn">挨拶</button>
            <button data-motion="${resolveAssetUrl('/animations/Quick Formal Bow.fbx')}" class="motion-btn">お辞儀</button>
            <button data-motion="${resolveAssetUrl('/animations/Joyful Jump.fbx')}" class="motion-btn">ジャンプ</button>
            <button data-motion="${resolveAssetUrl('/animations/Clapping.fbx')}" class="motion-btn">拍手</button>
            <button data-motion="${resolveAssetUrl('/animations/Cheering.fbx')}" class="motion-btn">応援</button>
            <button data-motion="${resolveAssetUrl('/animations/Dismissing Gesture.fbx')}" class="motion-btn">手を振る</button>
            <button data-motion="${resolveAssetUrl('/animations/Surprised.fbx')}" class="motion-btn">驚き</button>
            <button data-motion="${resolveAssetUrl('/animations/Angry.fbx')}" class="motion-btn">怒り</button>
            <button data-motion="${resolveAssetUrl('/animations/Defeat.fbx')}" class="motion-btn">落ち込む</button>
            <button data-motion="none" class="motion-btn">停止</button>
          </div>
        </div>
      <div>
        <label style="font-weight: 600; display: block; margin-bottom: 4px;">表情 (Expression)</label>
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
      <div style="font-size: 11px; color: #64748b; line-height: 1.4; border-top: 1px solid #e2e8f0; padding-top: 8px;">
        💡 右側GUIでシェーダー・アウトライン・光彩の全数値を微調整できます
      </div>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    .expr-btn, .motion-btn, .model-btn, .bg-btn {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
      color: #334155;
    }
    .expr-btn:hover, .motion-btn:hover, .model-btn:hover, .bg-btn:hover {
      background: #e2e8f0;
      border-color: #94a3b8;
    }
    .expr-btn.active, .motion-btn.active, .model-btn.active, .bg-btn.active {
      background: #4f46e5;
      color: #ffffff;
      border-color: #4338ca;
      font-weight: 600;
    }
    .phoneme-tag {
      flex: 1;
      text-align: center;
      padding: 2px 0;
      font-size: 9px;
      font-weight: 600;
      border-radius: 3px;
      background: #e2e8f0;
      color: #64748b;
      transition: all 0.1s ease;
    }
    .phoneme-tag.active {
      background: #4f46e5;
      color: #ffffff;
      transform: scale(1.05);
      box-shadow: 0 0 6px rgba(79, 70, 229, 0.6);
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(container);

  // Quick action listeners
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
    syncBgButtons();
    showToast('🔄 デフォルト設定にリセットしました');
  });

  // --------------------------------------------------
  // Audio Lip-Sync Event Listeners
  // --------------------------------------------------
  const audioTitleEl = document.getElementById('audio-title');
  const playPauseBtn = document.getElementById('audio-play-pause-btn');
  const stopBtn = document.getElementById('audio-stop-btn');
  const loopBtn = document.getElementById('audio-loop-btn');
  const seekbar = document.getElementById('audio-seekbar') as HTMLInputElement | null;
  const volumeSlider = document.getElementById('audio-volume') as HTMLInputElement | null;

  // File picker for audio
  document.getElementById('open-audio-file-btn')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
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

  // Preset sample voice buttons
  document.querySelectorAll<HTMLButtonElement>('.voice-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
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

  // Play / Pause toggle
  playPauseBtn?.addEventListener('click', () => {
    if (!audioLipSync.audioElement.src) {
      // Default to sample 1 if no audio loaded
      const sampleBtn = document.getElementById('sample-voice-1') as HTMLButtonElement | null;
      sampleBtn?.click();
      return;
    }
    if (audioLipSync.isPlaying) {
      audioLipSync.pause();
    } else {
      audioLipSync.play();
    }
  });

  // Stop button
  stopBtn?.addEventListener('click', () => {
    audioLipSync.stop();
  });

  // Loop button
  let isLooping = false;
  loopBtn?.addEventListener('click', () => {
    isLooping = !isLooping;
    audioLipSync.setLoop(isLooping);
    loopBtn.classList.toggle('active', isLooping);
    loopBtn.style.background = isLooping ? '#4f46e5' : '#f1f5f9';
    loopBtn.style.color = isLooping ? '#ffffff' : '#334155';
    showToast(isLooping ? '🔁 ループ再生 ON' : '🔁 ループ再生 OFF');
  });

  // Seekbar
  seekbar?.addEventListener('input', () => {
    const percent = parseFloat(seekbar.value);
    const duration = audioLipSync.audioElement.duration || 0;
    if (duration > 0) {
      const targetTime = (percent / 100) * duration;
      audioLipSync.seek(targetTime);
    }
  });

  // Volume slider
  volumeSlider?.addEventListener('input', () => {
    const vol = parseFloat(volumeSlider.value);
    audioLipSync.setVolume(vol);
  });

  return container;
}

createUIOverlay();

// Initial load of default voice (001.wav)
audioLipSync.loadAudioUrl(resolveAssetUrl('/voices/001.wav'), '001.wav');

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

// Setup background selector buttons
const bgButtons = document.querySelectorAll<HTMLButtonElement>('.bg-btn');
bgButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const bg = btn.getAttribute('data-bg');
    if (bg === 'none') {
      currentConfig.environment.showBackgroundImage = false;
    } else if (bg) {
      currentConfig.environment.showBackgroundImage = true;
      currentConfig.environment.backgroundImageUrl = bg;
    }
    updateBackgroundDisplay(currentConfig);
    syncBgButtons();
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  });
});

// Setup model selector buttons
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

// Setup expression buttons
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

// Setup motion buttons
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
      const isLoop = motionUrl.includes('Idle');
      await avatarInstance.playAnimation(motionUrl, isLoop);
    }
  });
});

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
  screenSpaceOutlinePass.setSize(width * pixelRatio, height * pixelRatio);
}
window.addEventListener('resize', onResize);

function tick(): void {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;

  controls.update();

  if (avatarInstance) {
    // Apply real-time lip sync if enabled
    if (currentConfig.lipSync.enabled) {
      avatarInstance.updateLipSync(
        audioLipSync.currentPhoneme,
        currentConfig.lipSync.gain,
        currentConfig.lipSync.smoothing
      );
    }

    avatarInstance.update(delta, elapsed);
  }

  const usePost = currentConfig.postProcessing.bloom.enabled ||
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

