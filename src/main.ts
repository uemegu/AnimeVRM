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
import { AvatarTransformController } from './avatar/AvatarTransformController';
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
    viewerCore.neargroundMesh.visible = false;
    viewerCore.sunEffect.sunGroup.visible = false;
    viewerCore.sunEffect.flareGroup.visible = false;
    viewerCore.renderer.setClearColor(0x000000, 0);
  },
  onExitTransparent: () => {
    viewerCore.updateBackgroundDisplay(currentConfig);
    viewerCore.updateMidgroundDisplay(currentConfig);
    viewerCore.updateNeargroundDisplay(currentConfig);
    viewerCore.sunEffect.sunGroup.visible =
      (currentConfig.lighting.sunShafts?.enabled || currentConfig.lighting.lensFlare?.enabled) ?? false;
    viewerCore.sunEffect.flareGroup.visible = currentConfig.lighting.lensFlare?.enabled ?? false;
  },
  onAvatarLoaded: () => {
    applyConfigToSceneAndRenderer(currentConfig);
    avatarTransformController?.syncInitialTransform();
  },
});
(window as any).avatarManager = avatarManager;

// 3.5 Avatar Transform Controller (Trackpad / Keyboard manipulation)
// カメラOrbitControlsを無効化し、マウス/トラックパッド操作の対象をアバター自身にバインド
viewerCore.controls.enabled = false;
const avatarTransformController = new AvatarTransformController({
  domElement: canvas,
  avatarManager,
});
(window as any).avatarTransformController = avatarTransformController;

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
  panoramaController: viewerCore.panoramaController,
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
  avatarTransformController,
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
scenePresetManager.switchTimeOfDay('day', false);
audioLipSync.loadAudioUrl(resolveAssetUrl('/voices/001.wav'), '001.wav');

// --------------------------------------------------
// 5. Main Render Loop
// --------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document);

function tick(timestamp?: number): void {
  viewerCore.stats.begin();
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.1);
  const elapsed = timer.getElapsed();

  if (isTtsGpuExclusive) {
    requestAnimationFrame(tick);
    return;
  }

  if (scenarioController.dialogueCameraController?.isActive) {
    avatarTransformController.setEnabled(false);
    scenarioController.dialogueCameraController.update(delta);
  } else if (avatarManager.animationPlayer.isPlaying) {
    avatarTransformController.setEnabled(false);
    avatarManager.animationPlayer.update(delta);
  } else if (viewerCore.panoramaController.isActive) {
    avatarTransformController.setEnabled(false);
    viewerCore.panoramaController.update(delta, elapsed);
  } else {
    avatarTransformController.setEnabled(true);
    // OrbitControls disabled (enabled=false) so user input won't move camera/sun,
    // but update() keeps camera lookAt and framing transitions correctly synchronized.
    viewerCore.controls.update();
  }

  // Update scenario engine dynamic motions (e.g. moveTo position transitions)
  scenarioController.update(delta);

  // Update dynamic background, midground, and nearground transforms
  const dialogueBg = scenarioController.dialogueCameraController?.isActive
    ? scenarioController.dialogueCameraController.getBackgroundTransform()
    : null;
  viewerCore.updateBackgroundZoom(dialogueBg);
  viewerCore.updateMidgroundTransform(currentConfig, dialogueBg);
  viewerCore.updateNeargroundTransform(currentConfig, dialogueBg);

  // Update scrolling background if active (with dialogue zoom & pan)
  if (scenarioController.scrollingBackgroundManager?.isVisible) {
    scenarioController.scrollingBackgroundManager.update(delta, dialogueBg);
    viewerCore.midgroundMesh.visible = false;
    viewerCore.neargroundMesh.visible = false;
  }

  // Update Avatars
  const currentScene = scenarioController.scenarioEngine.currentScene;
  const activeSpeakerId =
    currentScene?.lipSyncCharacterId !== undefined
      ? (currentScene.lipSyncCharacterId ?? 'none')
      : currentScene?.speakerCharacterId;
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

// ====================================================
// Debug Utility: Position & Framing Inspection
// ====================================================
function debugPositions() {
  const avatar = avatarManager.avatarInstance;
  const vrm = avatar?.vrm;

  const avatarWorldPos = vrm?.scene ? vrm.scene.getWorldPosition(new THREE.Vector3()) : (avatar?.initialPosition ?? null);
  const headPos = vrm?.humanoid?.getNormalizedBoneNode('head')?.getWorldPosition(new THREE.Vector3()) ?? null;
  const chestPos = (vrm?.humanoid?.getNormalizedBoneNode('upperChest') || vrm?.humanoid?.getNormalizedBoneNode('chest'))?.getWorldPosition(new THREE.Vector3()) ?? null;
  const hipsPos = vrm?.humanoid?.getNormalizedBoneNode('hips')?.getWorldPosition(new THREE.Vector3()) ?? null;

  const neargroundMesh = viewerCore.neargroundMesh;
  const midgroundMesh = viewerCore.midgroundMesh;
  const cam = viewerCore.camera;
  const controls = viewerCore.controls;

  const camPos = cam.position.clone();
  const targetPos = controls.target.clone();
  const camDist = camPos.distanceTo(targetPos);

  const debugData = {
    avatar: {
      position: avatarWorldPos ? { x: +avatarWorldPos.x.toFixed(4), y: +avatarWorldPos.y.toFixed(4), z: +avatarWorldPos.z.toFixed(4) } : null,
      rotationYDeg: avatar ? +(THREE.MathUtils.radToDeg(avatar.initialRotationY)).toFixed(2) : null,
      bones: {
        head: headPos ? { x: +headPos.x.toFixed(4), y: +headPos.y.toFixed(4), z: +headPos.z.toFixed(4) } : null,
        chest: chestPos ? { x: +chestPos.x.toFixed(4), y: +chestPos.y.toFixed(4), z: +chestPos.z.toFixed(4) } : null,
        hips: hipsPos ? { x: +hipsPos.x.toFixed(4), y: +hipsPos.y.toFixed(4), z: +hipsPos.z.toFixed(4) } : null,
      }
    },
    nearground: {
      visible: neargroundMesh.visible,
      worldPosition: { x: +neargroundMesh.position.x.toFixed(4), y: +neargroundMesh.position.y.toFixed(4), z: +neargroundMesh.position.z.toFixed(4) },
      worldScale: { x: +neargroundMesh.scale.x.toFixed(4), y: +neargroundMesh.scale.y.toFixed(4), z: +neargroundMesh.scale.z.toFixed(4) },
      config: {
        showNearground: currentConfig.environment.showNearground,
        neargroundPosition: currentConfig.environment.neargroundPosition,
        neargroundScale: currentConfig.environment.neargroundScale,
        neargroundOpacity: currentConfig.environment.neargroundOpacity,
        neargroundImageUrl: currentConfig.environment.neargroundImageUrl,
      }
    },
    midground: {
      visible: midgroundMesh.visible,
      worldPosition: { x: +midgroundMesh.position.x.toFixed(4), y: +midgroundMesh.position.y.toFixed(4), z: +midgroundMesh.position.z.toFixed(4) },
      config: {
        showMidground: currentConfig.environment.showMidground,
        midgroundPosition: currentConfig.environment.midgroundPosition,
        midgroundScale: currentConfig.environment.midgroundScale,
        midgroundOpacity: currentConfig.environment.midgroundOpacity,
      }
    },
    camera: {
      position: { x: +camPos.x.toFixed(4), y: +camPos.y.toFixed(4), z: +camPos.z.toFixed(4) },
      target: { x: +targetPos.x.toFixed(4), y: +targetPos.y.toFixed(4), z: +targetPos.z.toFixed(4) },
      distance: +camDist.toFixed(4),
      fov: cam.fov,
    }
  };

  console.group('%c🎯 [Debug Positions & Framing]', 'color: #38bdf8; font-weight: bold; font-size: 13px;');
  console.log('%c👤 アバター位置 (Avatar):', 'color: #a78bfa; font-weight: bold;', debugData.avatar);
  console.log('%c☕ 前景位置 (Nearground):', 'color: #f59e0b; font-weight: bold;', debugData.nearground);
  console.log('%c🌳 中景位置 (Midground):', 'color: #10b981; font-weight: bold;', debugData.midground);
  console.log('%c📷 カメラ (Camera):', 'color: #ec4899; font-weight: bold;', debugData.camera);
  console.log('%c📋 コピペ用JSON (Copyable JSON):', 'color: #94a3b8; font-weight: bold;', JSON.stringify(debugData, null, 2));
  console.groupEnd();

  // Try copying to clipboard
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(JSON.stringify(debugData, null, 2))
      .then(() => console.log('%c✓ クリップボードに位置情報をコピーしました！', 'color: #22c55e; font-weight: bold;'))
      .catch(() => {});
  }

  return debugData;
}

(window as any).debugPositions = debugPositions;
(window as any).debugPose = debugPositions;
(window as any).getPositions = debugPositions;
(window as any).scenarioController = scenarioController;
(window as any).avatarManager = avatarManager;
(window as any).viewerCore = viewerCore;
(window as any).scenePresetManager = scenePresetManager;

console.info(
  '%c💡 [Debug] コンソールで debugPositions() または debugPose() を実行すると、アバター・前景・カメラの現在位置を出力＆コピーできます。',
  'color: #38bdf8; font-size: 11px; padding: 2px 4px;'
);
