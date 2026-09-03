import './style.css';

import * as THREE from 'three';
import {
  DEFAULT_CONFIG,
  AvatarConfig,
  cloneConfig,
} from './Config';
import { resolveAssetUrl } from './utils/path';
import { AudioLipSync } from './AudioLipSync';
import { AvatarChatController } from './ai/AvatarChatController';
import { WindController } from './wind/WindController';
import { ColorHistogram } from './histogram/ColorHistogram';
import { ViewerCore } from './scene/ViewerCore';
import { ScenePresetManager } from './scene/ScenePresetManager';
import { AvatarManager } from './avatar/AvatarManager';
import { ScenarioController } from './scenario/ScenarioController';
import { InspectorManager } from './ui/inspector/InspectorManager';
import { setupUnifiedPanel } from './ui/UnifiedPanel';
import {
  syncBgButtons,
  updateLipSyncPhonemeDisplay,
  updatePlayStateUI,
  updateAudioTimeUI,
} from './ui/helpers';

// --------------------------------------------------
// 1. Application State & Controllers
// --------------------------------------------------
const currentConfig: AvatarConfig = cloneConfig(DEFAULT_CONFIG);
let isTtsGpuExclusive = false;

const windController = new WindController();
const colorHistogram = new ColorHistogram();

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

const avatarChatController = new AvatarChatController();

// --------------------------------------------------
// 2. Three.js Core Setup (ViewerCore)
// --------------------------------------------------
const canvas = document.querySelector<HTMLCanvasElement>('#app')!;
const viewerCore = new ViewerCore(canvas, currentConfig);

// --------------------------------------------------
// 3. Avatar & Scenario Management
// --------------------------------------------------
const avatarManager = new AvatarManager({
  scene: viewerCore.scene,
  camera: viewerCore.camera,
  controls: viewerCore.controls,
  sharedEffectTextManager: viewerCore.sharedEffectTextManager,
  windController,
  getConfig: () => currentConfig,
  avatarChatController,
  onEnterTransparent: () => {
    viewerCore.scene.background = null;
    viewerCore.midgroundMesh.visible = false;
    viewerCore.sunEffect.sunGroup.visible = false;
    viewerCore.sunEffect.flareGroup.visible = false;
    viewerCore.renderer.setClearColor(0x000000, 0);
  },
  onExitTransparent: () => {
    viewerCore.updateBackgroundDisplay(currentConfig);
    viewerCore.updateMidgroundDisplay(currentConfig);
    viewerCore.sunEffect.sunGroup.visible =
      (currentConfig.lighting.sunShafts?.enabled || currentConfig.lighting.lensFlare?.enabled) ?? false;
    viewerCore.sunEffect.flareGroup.visible = currentConfig.lighting.lensFlare?.enabled ?? false;
  },
  onAvatarLoaded: () => {
    applyConfigToSceneAndRenderer(currentConfig);
  },
});

const inspectorManager = new InspectorManager();

function applyConfigToSceneAndRenderer(cfg: AvatarConfig): void {
  viewerCore.applyConfig(cfg);

  // Apply to Avatars
  if (avatarManager.isMultiAvatarScenarioActive) {
    avatarManager.scenarioAvatars.forEach((av) => av.applyConfig(cfg));
  } else {
    avatarManager.avatarInstance?.applyConfig(cfg);
  }

  // Audio Lip-Sync Settings
  if (cfg.lipSync) {
    audioLipSync.rmsThreshold = cfg.lipSync.rmsThreshold;
    audioLipSync.setAudioDelay(cfg.lipSync.audioDelay ?? 0.05);
    audioLipSync.setVoiceGender(cfg.lipSync.voiceGender ?? 'female');
  }

  inspectorManager.syncToggleState(cfg);
}

const scenePresetManager = new ScenePresetManager({
  config: currentConfig,
  onConfigChange: (cfg) => {
    applyConfigToSceneAndRenderer(cfg);
  },
  onInspectorsUpdate: () => {
    inspectorManager.updateAllInspectorsDisplay();
  },
});

const scenarioController = new ScenarioController({
  scene: viewerCore.scene,
  camera: viewerCore.camera,
  controls: viewerCore.controls,
  avatarManager,
  audioLipSync,
  sharedEffectTextManager: viewerCore.sharedEffectTextManager,
  windController,
  getConfig: () => currentConfig,
  onApplyConfig: (cfg) => {
    applyConfigToSceneAndRenderer(cfg);
  },
  onSwitchScenePreset: (presetId) => {
    scenePresetManager.switchScene(presetId, false);
  },
});

// --------------------------------------------------
// 4. Unified UI & Inspectors Setup
// --------------------------------------------------
setupUnifiedPanel({
  currentConfig,
  viewerCore,
  scenePresetManager,
  avatarManager,
  scenarioController,
  inspectorManager,
  audioLipSync,
  avatarChatController,
  colorHistogram,
  onApplyConfig: (cfg) => {
    applyConfigToSceneAndRenderer(cfg);
  },
  onResize: () => {
    viewerCore.onResize();
  },
  onTtsGpuActivityChange: (active) => {
    if (isTtsGpuExclusive === active) return;
    isTtsGpuExclusive = active;
  },
});

// Initial load
avatarManager.loadAvatarModel(avatarManager.currentModelUrl);
scenePresetManager.switchTimeOfDay('morning', false);
audioLipSync.loadAudioUrl(resolveAssetUrl('/voices/001.wav'), '001.wav');

// --------------------------------------------------
// 5. Main Render Loop
// --------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document);

function tick(timestamp?: number): void {
  viewerCore.stats.begin();
  timer.update(timestamp);
  const delta = timer.getDelta();
  const elapsed = timer.getElapsed();

  if (isTtsGpuExclusive) {
    requestAnimationFrame(tick);
    return;
  }

  if (avatarManager.animationPlayer.isPlaying) {
    avatarManager.animationPlayer.update(delta);
  } else if (scenarioController.dialogueCameraController?.isActive) {
    scenarioController.dialogueCameraController.update(delta);
  } else {
    viewerCore.controls.update();
  }

  // Update dynamic background and midground transforms
  const dialogueBg = scenarioController.dialogueCameraController?.isActive
    ? scenarioController.dialogueCameraController.getBackgroundTransform()
    : null;
  viewerCore.updateBackgroundZoom(dialogueBg);
  viewerCore.updateMidgroundTransform(currentConfig, dialogueBg);

  // Update scrolling background if active (with dialogue zoom & pan)
  if (scenarioController.scrollingBackgroundManager?.isVisible) {
    scenarioController.scrollingBackgroundManager.update(delta, dialogueBg);
    viewerCore.midgroundMesh.visible = false;
  }

  // Update Avatars
  const activeSpeakerId = scenarioController.scenarioEngine.currentScene?.speakerCharacterId;
  avatarManager.update(delta, elapsed, currentConfig, audioLipSync, activeSpeakerId);

  // Update Wind & Rain Particles
  viewerCore.windParticles.update(delta, elapsed, currentConfig.wind, windController.currentWindVector);
  viewerCore.rainEffect.setCameraPosition(viewerCore.camera.position);
  viewerCore.rainEffect.update(elapsed);

  // Render Scene & Post-processing
  const vrmMeshes = avatarManager.getVrmMeshes();
  viewerCore.render(delta, elapsed, currentConfig, vrmMeshes);

  viewerCore.stats.end();
  requestAnimationFrame(tick);
}

tick();
