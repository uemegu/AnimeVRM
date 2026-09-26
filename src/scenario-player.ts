import './style.css';
import * as THREE from 'three';
import { DEFAULT_CONFIG, AvatarConfig, cloneConfig } from './Config';
import { resolveAssetUrl } from './utils/path';
import { AudioLipSync } from './AudioLipSync';
import { WindController } from './wind/WindController';
import { ViewerCore } from './scene/ViewerCore';
import { ScenePresetManager } from './scene/ScenePresetManager';
import { AvatarManager } from './avatar/AvatarManager';
import { ScenarioController } from './scenario/ScenarioController';
import { Live2DTransitionManager } from './live2d/Live2DTransitionManager';
import { getScenarioMeta, SCENARIO_REGISTRY } from './scenario/scenarioRegistry';
import { showToast } from './ui/components/Toast';
import { ShaftModeController } from './effects/shaft/ShaftModeController';
import { ClassroomStage } from './scene/ClassroomStage';

// --------------------------------------------------
// 1. Scenario Identification
// --------------------------------------------------
const urlParams = new URLSearchParams(window.location.search);
const scenarioId =
  document.body.dataset.scenarioId ||
  urlParams.get('id') ||
  'five-seconds-pv';

const meta = getScenarioMeta(scenarioId);

if (!meta) {
  console.error(`[ScenarioPlayer] Scenario not found: ${scenarioId}`);
}

// --------------------------------------------------
// 2. State & Controllers Setup
// --------------------------------------------------
const currentConfig: AvatarConfig = cloneConfig(DEFAULT_CONFIG);
const windController = new WindController();

const audioLipSync = new AudioLipSync({});

const canvas = document.querySelector<HTMLCanvasElement>('#app')!;
const viewerCore = new ViewerCore(canvas, currentConfig);
viewerCore.controls.enabled = false;

const avatarManager = new AvatarManager({
  scene: viewerCore.scene,
  camera: viewerCore.camera,
  hairShadow: viewerCore.hairShadow.uniforms,
  controls: viewerCore.controls,
  sharedEffectTextManager: viewerCore.sharedEffectTextManager,
  windController,
  getConfig: () => currentConfig,
  renderer: viewerCore.renderer,
  onEnterTransparent: () => {
    viewerCore.scene.background = null;
    viewerCore.hideSkyBackground();
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
  },
});

const live2DTransitionManager = new Live2DTransitionManager({
  avatarManager,
  viewerCore,
  audioLipSync,
  config: currentConfig.live2d,
});

const shaftModeController = new ShaftModeController({
  viewerCore,
  avatarManager,
  getConfig: () => currentConfig,
});

function applyConfigToSceneAndRenderer(cfg: AvatarConfig): void {
  viewerCore.applyConfig(cfg);
  if (avatarManager.isMultiAvatarScenarioActive) {
    avatarManager.scenarioAvatars.forEach((av) => av.applyConfig(cfg));
  } else {
    avatarManager.avatarInstance?.applyConfig(cfg);
  }
}

const scenePresetManager = new ScenePresetManager({
  config: currentConfig,
  onConfigChange: (cfg) => {
    applyConfigToSceneAndRenderer(cfg);
  },
  onInspectorsUpdate: () => {},
});

// --------------------------------------------------
// 3. UI Overlay: Top HUD, Start Overlay, Replay Modal
// --------------------------------------------------
const uiRoot = document.createElement('div');
uiRoot.id = 'scenario-player-ui';
uiRoot.innerHTML = `
  <style>
    #scenario-player-ui {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 20000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', 'Noto Sans CJK JP', sans-serif;
      user-select: none;
    }

    /* Top Left HUD */
    .scenario-top-bar {
      position: absolute;
      top: 14px;
      left: 18px;
      display: flex;
      align-items: center;
      pointer-events: none;
      transition: opacity 0.3s ease;
      z-index: 50;
    }
    .scenario-branding {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(10, 10, 18, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      padding: 6px 14px;
      border-radius: 999px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
    }
    .scenario-badge {
      background: linear-gradient(135deg, #f43f5e 0%, #a855f7 100%);
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.05em;
      box-shadow: 0 2px 8px rgba(244, 63, 94, 0.4);
    }
    .scenario-title-text {
      color: #f1f5f9;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-shadow: 0 2px 4px rgba(0,0,0,0.6);
      max-width: 40vw;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Start Overlay */
    .start-overlay {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, rgba(15, 15, 25, 0.6) 0%, rgba(8, 8, 14, 0.92) 100%);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      pointer-events: auto;
      transition: opacity 0.5s ease, visibility 0.5s ease;
      z-index: 20001;
    }
    .start-overlay.hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .start-card {
      background: rgba(24, 24, 38, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      padding: 36px 32px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 40px rgba(244, 63, 94, 0.2);
      animation: cardPop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes cardPop {
      0% { opacity: 0; transform: scale(0.92) translateY(20px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    .start-title {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 12px;
      line-height: 1.35;
      background: linear-gradient(135deg, #ffffff 0%, #fbcfe8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .start-desc {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .start-play-btn {
      background: linear-gradient(135deg, #f43f5e 0%, #e11d48 50%, #9333ea 100%);
      color: #ffffff;
      border: none;
      font-size: 16px;
      font-weight: 800;
      padding: 14px 36px;
      border-radius: 999px;
      cursor: pointer;
      box-shadow: 0 6px 24px rgba(244, 63, 94, 0.45);
      transition: all 0.25s ease;
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .start-play-btn:hover {
      transform: scale(1.04);
      box-shadow: 0 8px 30px rgba(244, 63, 94, 0.65);
    }
    .start-play-btn:active {
      transform: scale(0.98);
    }

    /* Replay Overlay */
    .replay-overlay {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, rgba(12, 12, 22, 0.7) 0%, rgba(5, 5, 10, 0.94) 100%);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      pointer-events: auto;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.6s ease, visibility 0.6s ease;
      z-index: 20002;
    }
    .replay-overlay.visible {
      opacity: 1;
      visibility: visible;
    }
    .replay-card {
      background: rgba(22, 22, 36, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 24px;
      padding: 40px 32px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7), 0 0 50px rgba(244, 63, 94, 0.25);
      animation: cardPop 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .replay-badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 800;
      color: #34d399;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 14px;
      letter-spacing: 0.05em;
    }
    .replay-title {
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 10px;
    }
    .replay-scenario-name {
      font-size: 14px;
      color: #cbd5e1;
      margin-bottom: 28px;
    }
    .replay-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    }
    .replay-btn {
      background: linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #8b5cf6 100%);
      color: #ffffff;
      border: none;
      font-size: 16px;
      font-weight: 800;
      padding: 15px 32px;
      border-radius: 12px;
      cursor: pointer;
      box-shadow: 0 6px 24px rgba(244, 63, 94, 0.4);
      transition: all 0.25s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .replay-btn:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 10px 32px rgba(244, 63, 94, 0.6);
    }
    .replay-btn:active {
      transform: translateY(0) scale(0.98);
    }
    .home-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.18);
      color: #e2e8f0;
      font-size: 14px;
      font-weight: 700;
      padding: 13px 28px;
      border-radius: 12px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .home-btn:hover {
      background: rgba(255, 255, 255, 0.16);
      border-color: rgba(255, 255, 255, 0.35);
      color: #ffffff;
      transform: translateY(-1px);
    }

    /* Scenario Selector Dropdown */
    .other-scenarios-container {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      flex-direction: column;
      gap: 8px;
      text-align: left;
    }
    .other-scenarios-label {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .other-scenarios-select {
      background: #181824;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #f1f5f9;
      font-size: 12px;
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
      width: 100%;
      outline: none;
    }
  </style>

  <!-- Top Bar HUD -->
  <div class="scenario-top-bar">
    <div class="scenario-branding">
      <span class="scenario-badge">AnimeVRM</span>
      <span class="scenario-title-text">${meta?.title ?? 'Scenario'}</span>
    </div>
  </div>

  <!-- Start Overlay (Autoplay protection) -->
  <div id="start-overlay" class="start-overlay">
    <div class="start-card">
      <span class="scenario-badge" style="margin-bottom: 14px; display: inline-block;">AnimeVRM Scenario</span>
      <h1 class="start-title">${meta?.title ?? 'シナリオを再生'}</h1>
      <p class="start-desc">${meta?.description ?? '再生ボタンを押してシナリオをお楽しみください。'}</p>
      <button id="start-btn" class="start-play-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        タップして再生を開始
      </button>
    </div>
  </div>

  <!-- Replay Overlay (Shown onFinished) -->
  <div id="replay-overlay" class="replay-overlay">
    <div class="replay-card">
      <div class="replay-badge">✨ PLAYBACK COMPLETED</div>
      <h2 class="replay-title">シナリオが終了しました</h2>
      <div class="replay-scenario-name">${meta?.title ?? ''}</div>
      <div class="replay-actions">
        <button id="replay-btn" class="replay-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          もう1回再生する
        </button>
        <a href="../index.html" class="home-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          通常ビューワーを開く
        </a>
      </div>

      <div class="other-scenarios-container">
        <label class="other-scenarios-label">他のシナリオを再生する</label>
        <select id="other-scenarios-select" class="other-scenarios-select">
          <option value="" disabled selected>シナリオを選択...</option>
          ${Object.values(SCENARIO_REGISTRY)
            .map(
              (s) =>
                `<option value="${s.id}" ${s.id === scenarioId ? 'selected' : ''}>${s.title}</option>`
            )
            .join('')}
        </select>
      </div>
    </div>
  </div>
`;

document.body.appendChild(uiRoot);

const startOverlay = document.getElementById('start-overlay')!;
const replayOverlay = document.getElementById('replay-overlay')!;
const startBtn = document.getElementById('start-btn')!;
const replayBtn = document.getElementById('replay-btn')!;
const otherSelect = document.getElementById('other-scenarios-select') as HTMLSelectElement;

otherSelect?.addEventListener('change', (e) => {
  const targetId = (e.target as HTMLSelectElement).value;
  if (targetId && targetId !== scenarioId) {
    window.location.href = `${targetId}.html`;
  }
});

let isStartingPlayback = false;

// --------------------------------------------------
// 4. Scenario Controller Setup
// --------------------------------------------------
const classroomStage = new ClassroomStage({
  scene: viewerCore.scene,
  dirLight: viewerCore.dirLight,
  getConfig: () => currentConfig,
  onApplyConfig: (cfg) => {
    applyConfigToSceneAndRenderer(cfg);
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
  shaftModeController,
  classroomStage,
  getConfig: () => currentConfig,
  onApplyConfig: (cfg) => {
    applyConfigToSceneAndRenderer(cfg);
  },
  onSwitchScenePreset: (presetId) => {
    scenePresetManager.switchScene(presetId, false);
  },
  onFinished: () => {
    if (isStartingPlayback) return;
    // Show Replay Overlay when finished!
    replayOverlay.classList.add('visible');
  },
});

// --------------------------------------------------
// 5. Playback Execution Logic
// --------------------------------------------------
async function startScenarioPlayback() {
  if (isStartingPlayback) return;
  isStartingPlayback = true;

  replayOverlay.classList.remove('visible');
  startOverlay.classList.add('hidden');

  try {
    if (!meta) {
      showToast('❌ シナリオ情報が見つかりません');
      return;
    }

  // Audio Context Resume & Worklet Init
  audioLipSync.initAudioContext();
  if (audioLipSync.audioContext?.state === 'suspended') {
    try {
      await audioLipSync.audioContext.resume();
    } catch (e) {
      console.warn('Failed to resume AudioContext', e);
    }
  }

  // Stop any ongoing playback
  if (scenarioController.scenarioEngine.isPlaying) {
    scenarioController.scenarioEngine.stop();
  }
  if (scenarioController.scenarioPlayer.isPlaying) {
    scenarioController.scenarioPlayer.stop();
  }
  if (viewerCore.panoramaController.isActive) {
    viewerCore.panoramaController.deactivate();
  }

    const scenarioPackage = meta.getScenario('ja');

    if (meta.playOptions?.withInterlude) {
      await scenarioController.playWithInterlude(scenarioPackage, {
        title: meta.playOptions.interludeTitle || scenarioPackage.title,
        subtitle: meta.playOptions.interludeSubtitle || 'SPECIAL PRESENTATION',
      });
    } else {
      await scenarioController.scenarioEngine.play(scenarioPackage);
    }
  } finally {
    isStartingPlayback = false;
  }
}

startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startScenarioPlayback();
});

replayBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  console.log('[ScenarioPlayer] replayBtn clicked');
  startScenarioPlayback();
});

// Initial Model & Scene Setup
const initialPkg = meta?.getScenario('ja');
if (!initialPkg?.characters || initialPkg.characters.length <= 1) {
  avatarManager.loadAvatarModel(avatarManager.currentModelUrl);
}
scenePresetManager.switchTimeOfDay('day', false);

// --------------------------------------------------
// 6. Main Render Loop
// --------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document);

function tick(timestamp?: number): void {
  viewerCore.stats.begin();
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.1);
  const elapsed = timer.getElapsed();

  if (scenarioController.dialogueCameraController?.isActive) {
    scenarioController.dialogueCameraController.update(delta);
  } else if (avatarManager.animationPlayer.isPlaying) {
    avatarManager.animationPlayer.update(delta);
  } else if (viewerCore.panoramaController.isActive) {
    viewerCore.panoramaController.update(delta, elapsed);
  }

  // Update scenario engine
  scenarioController.update(delta);
  shaftModeController.update();

  // Update dynamic background, midground, and nearground transforms
  const dialogueBg = scenarioController.dialogueCameraController?.isActive
    ? scenarioController.dialogueCameraController.getBackgroundTransform()
    : null;
  viewerCore.updateBackgroundZoom(dialogueBg);
  viewerCore.updateMidgroundTransform(currentConfig, dialogueBg);
  viewerCore.updateNeargroundTransform(currentConfig, dialogueBg);

  // Update scrolling background
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

  // Render Scene
  const vrmMeshes = avatarManager.getVrmMeshes();
  viewerCore.render(delta, elapsed, currentConfig, vrmMeshes);

  // Live2D Close-up Cut-in
  const isScenarioPlaying =
    scenarioController.scenarioEngine.isPlaying || scenarioController.scenarioPlayer.isPlaying;
  if (isScenarioPlaying) {
    if (currentScene?.live2d !== undefined) {
      const live2dOpt = currentScene.live2d;
      const isExplicit = typeof live2dOpt === 'boolean' ? live2dOpt : (live2dOpt.enabled ?? true);
      live2DTransitionManager.setSceneOverride(isExplicit);
    } else {
      // In scenario playback, scenes without explicit live2d are kept in VRM mode
      live2DTransitionManager.setSceneOverride(false);
    }
  } else {
    // Outside scenario playback, no scene override
    live2DTransitionManager.setSceneOverride(null);
  }
  live2DTransitionManager.update(delta);

  viewerCore.stats.end();
  requestAnimationFrame(tick);
}

tick();

// Window Resize listener
window.addEventListener('resize', () => {
  viewerCore.onResize();
});

// Auto-play attempt on user interaction
window.addEventListener(
  'pointerdown',
  () => {
    if (audioLipSync.audioContext?.state === 'suspended') {
      audioLipSync.audioContext.resume().catch(() => {});
    }
  },
  { once: true }
);

(window as any).avatarManager = avatarManager;
(window as any).viewerCore = viewerCore;
(window as any).scenarioController = scenarioController;
(window as any).live2DTransitionManager = live2DTransitionManager;
(window as any).audioLipSync = audioLipSync;
