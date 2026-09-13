import {
  DEFAULT_CONFIG,
  AvatarConfig,
  deepAssign,
  copyConfigToClipboard,
  downloadConfigJSON,
} from '../Config';
import { getLanguage, setLanguage, t, onLanguageChange, Language } from '../i18n';
import { resolveAssetUrl } from '../utils/path';
import vrmModels from 'virtual:vrm-models';
import { TimeOfDayId } from '../presets/ScenePresets';
import { getParkConfessionScenario } from '../scenario/parkConfessionScenario';
import { getTwoGirlsConversationScenario } from '../scenario/twoGirlsConversationScenario';
import { getTrioConversationScenario } from '../scenario/trioConversationScenario';
import { getHaremConversationScenario } from '../scenario/haremScenario';
import { getTownWalkScenario } from '../scenario/townWalkScenario';
import { getBehindYouScenario } from '../scenario/behindYouScenario';
import { getNisaScenario } from '../scenario/nisaScenario';
import { getFastMotionScenario } from '../scenario/fastMotionScenario';
import { getDoorPeepYandereScenario } from '../scenario/doorPeepYandereScenario';
import { getPrivateDateScenario } from '../scenario/privateDateScenario';
import { getFiveSecondsConfessionPvScenario } from '../scenario/fiveSecondsConfessionPvScenario';
import { ColorHistogram } from '../histogram/ColorHistogram';
import { AudioLipSync } from '../AudioLipSync';
import { AvatarChatController } from '../ai/AvatarChatController';
import { GeminiVadChatController } from '../ai/GeminiVadChatController';
import { ViewerCore } from '../scene/ViewerCore';
import { ScenePresetManager } from '../scene/ScenePresetManager';
import { AvatarManager, isMotionLoop } from '../avatar/AvatarManager';
import { ScenarioController } from '../scenario/ScenarioController';
import { InspectorManager } from './inspector/InspectorManager';
import { showToast } from './components/Toast';
import { openImportModal } from './components/ImportExportModal';
import { AvatarTransformController } from '../avatar/AvatarTransformController';
import { registerPanelOpenCallback, syncBgButtons } from './helpers';

export interface UnifiedPanelContext {
  currentConfig: AvatarConfig;
  viewerCore: ViewerCore;
  scenePresetManager: ScenePresetManager;
  avatarManager: AvatarManager;
  scenarioController: ScenarioController;
  inspectorManager: InspectorManager;
  audioLipSync: AudioLipSync;
  avatarChatController: AvatarChatController;
  geminiVadChatController?: GeminiVadChatController;
  colorHistogram: ColorHistogram;
  avatarTransformController?: AvatarTransformController;
  onApplyConfig: (cfg: AvatarConfig) => void;
  onResize: () => void;
  onTtsGpuActivityChange: (active: boolean) => void;
}

export function setupUnifiedPanel(ctx: UnifiedPanelContext): void {
  const {
    currentConfig,
    viewerCore,
    scenePresetManager,
    avatarManager,
    scenarioController,
    inspectorManager,
    audioLipSync,
    avatarChatController,
    geminiVadChatController,
    colorHistogram,
    onApplyConfig,
    onResize,
    onTtsGpuActivityChange,
  } = ctx;

  let gearBtn = document.getElementById('settings-open-btn') as HTMLButtonElement | null;
  if (!gearBtn) {
    gearBtn = document.createElement('button');
    gearBtn.id = 'settings-open-btn';
    gearBtn.title = t().common.openSettings;
    gearBtn.innerHTML = '⚙️';
    document.body.appendChild(gearBtn);
  }

  let panel = document.getElementById('panel-container') as HTMLDivElement | null;
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'panel-container';
    const appLayout = document.getElementById('app-layout');
    if (appLayout) {
      appLayout.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }
  }

  let currentActiveTab = 'character';
  let isLooping = false;

  let isPanelOpen = true;
  const setPanelOpen = (open: boolean) => {
    isPanelOpen = open;
    if (panel) {
      panel.style.display = isPanelOpen ? 'flex' : 'none';
      panel.classList.toggle('hidden', !isPanelOpen);
    }
    if (gearBtn) {
      gearBtn.style.display = isPanelOpen ? 'none' : 'flex';
    }
    requestAnimationFrame(() => {
      onResize();
    });
  };
  registerPanelOpenCallback(setPanelOpen);

  const captureAndRenderHistogram = () => {
    viewerCore.captureAndRenderHistogram(colorHistogram, currentConfig);
  };

  const rebuildInspector = () => {
    inspectorManager.setupInspector({
      currentConfig,
      toggleState: inspectorManager.toggleState,
      viewerCore,
      avatarManager,
      audioLipSync,
      applyConfigToSceneAndRenderer: onApplyConfig,
      updateAllInspectorsDisplay: () => inspectorManager.updateAllInspectorsDisplay(),
    });
  };

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
        <!-- TAB 1: Character -->
        <div id="tab-pane-character" class="tab-pane ${currentActiveTab === 'character' ? 'active' : ''}">
          <!-- VRM Model Selector -->
          <div class="section-box">
            <label class="section-label">${tr.character.modelSwitch}</label>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="model-buttons">
              ${vrmModels
                .map((m) => {
                  const modelUrl = resolveAssetUrl(m.url);
                  const isActive = avatarManager.currentModelUrl === modelUrl;
                  return `<button data-model="${modelUrl}" class="model-btn ${isActive ? 'active' : ''}">${m.icon} ${m.label}</button>`;
                })
                .join('\n              ')}
              <button id="open-local-vrm-btn" class="model-btn">${tr.character.selectFile}</button>
            </div>
            <div id="loading-status" class="status-box" style="margin-top: 4px;">
              ${avatarManager.avatarInstance?.vrm
                ? `<span style="color: #16a34a; font-weight: 600;">✓ ロード完了</span> (${avatarManager.currentModelUrl.startsWith('blob:') ? 'ローカルVRM' : avatarManager.currentModelUrl.split('/').pop()})`
                : `${tr.common.loadingModel} <span id="progress-text" style="color: #ffffff; font-weight: 600;">0%</span>`}
            </div>
          </div>

          <!-- Motions -->
          <div class="section-box">
            <label class="section-label">${tr.character.motion}</label>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="motion-buttons">
              <button data-motion="${resolveAssetUrl('/animations/Idle.fbx')}" class="motion-btn ${avatarManager.currentMotionUrl === resolveAssetUrl('/animations/Idle.fbx') ? 'active' : ''}">${tr.character.motions.idle}</button>
              <button data-motion="${resolveAssetUrl('/animations/Standing Idle.fbx')}" class="motion-btn ${avatarManager.currentMotionUrl === resolveAssetUrl('/animations/Standing Idle.fbx') ? 'active' : ''}">${tr.character.motions.standingIdle}</button>
              <button data-motion="${resolveAssetUrl('/animations/Female Standing Pose.fbx')}" class="motion-btn ${avatarManager.currentMotionUrl === resolveAssetUrl('/animations/Female Standing Pose.fbx') ? 'active' : ''}">${tr.character.motions.standingPose}</button>
              <button data-motion="${resolveAssetUrl('/animations/Walking.fbx')}" class="motion-btn ${avatarManager.currentMotionUrl === resolveAssetUrl('/animations/Walking.fbx') ? 'active' : ''}">${tr.character.motions.walking}</button>
              <button data-motion="${resolveAssetUrl('/animations/Jogging.fbx')}" class="motion-btn ${avatarManager.currentMotionUrl === resolveAssetUrl('/animations/Jogging.fbx') ? 'active' : ''}">${tr.character.motions.jogging}</button>
              <button data-motion="${resolveAssetUrl('/animations/Standing Greeting.fbx')}" class="motion-btn ${avatarManager.currentMotionUrl === resolveAssetUrl('/animations/Standing Greeting.fbx') ? 'active' : ''}">${tr.character.motions.greeting}</button>
              <button data-motion="${resolveAssetUrl('/animations/Quick Formal Bow.fbx')}" class="motion-btn ${avatarManager.currentMotionUrl === resolveAssetUrl('/animations/Quick Formal Bow.fbx') ? 'active' : ''}">${tr.character.motions.bow}</button>
              <button data-motion="${resolveAssetUrl('/animations/Acknowledging.fbx')}" class="motion-btn ${avatarManager.currentMotionUrl === resolveAssetUrl('/animations/Acknowledging.fbx') ? 'active' : ''}">${tr.character.motions.acknowledging}</button>
              <button data-motion="${resolveAssetUrl('/animations/Dismissing Gesture.fbx')}" class="motion-btn ${avatarManager.currentMotionUrl === resolveAssetUrl('/animations/Dismissing Gesture.fbx') ? 'active' : ''}">${tr.character.motions.dismissing}</button>
              <button data-motion="${resolveAssetUrl('/animations/Salute.fbx')}" class="motion-btn ${avatarManager.currentMotionUrl === resolveAssetUrl('/animations/Salute.fbx') ? 'active' : ''}">${tr.character.motions.salute}</button>
              <button data-motion="${resolveAssetUrl('/animations/Excited.fbx')}" class="motion-btn ${avatarManager.currentMotionUrl === resolveAssetUrl('/animations/Excited.fbx') ? 'active' : ''}">${tr.character.motions.excited}</button>
              <button data-motion="${resolveAssetUrl('/animations/Angry.fbx')}" class="motion-btn ${avatarManager.currentMotionUrl === resolveAssetUrl('/animations/Angry.fbx') ? 'active' : ''}">${tr.character.motions.angry}</button>
              <button data-motion="${resolveAssetUrl('/animations/Punching.fbx')}" class="motion-btn ${avatarManager.currentMotionUrl === resolveAssetUrl('/animations/Punching.fbx') ? 'active' : ''}">${tr.character.motions.punching}</button>
              <button data-motion="none" class="motion-btn ${avatarManager.currentMotionUrl === 'none' ? 'active' : ''}">${tr.character.motions.stop}</button>
              ${avatarManager.customMotions
                .map(
                  (m) =>
                    `<button data-motion="${m.url}" class="motion-btn ${avatarManager.currentMotionUrl === m.url ? 'active' : ''}" style="border-color: #3b82f6;">💃 ${m.name}</button>`
                )
                .join('')}
              <button id="open-local-fbx-btn" class="motion-btn">${tr.character.selectMotionFile}</button>
            </div>
          </div>

          <!-- Expressions -->
          <div class="section-box">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label class="section-label">${tr.character.expression}</label>
              <button id="yandere-toggle-btn" style="font-size: 10.5px; padding: 2.5px 8px; background: #2a1118; border: 1px solid #dc2626; color: #fca5a5; border-radius: 4px; cursor: pointer; font-weight: 700; transition: all 0.2s;">🖤 ヤンデレ闇落ち</button>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;" id="expression-buttons">
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

          <!-- Eye & Head Look-At Control -->
          <div class="section-box" style="background: #202020; border: 1px solid #333333; border-left: 3px solid #3b82f6; padding: 8px; border-radius: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label class="section-label" style="color: #60a5fa; font-weight: 700;">👀 視線 & 顔の向き (LookAt)</label>
              <button id="reset-lookat-btn" style="font-size: 10px; padding: 2px 6px; background: #2a2a2a; border: 1px solid #444444; color: #94a3b8; border-radius: 4px; cursor: pointer;">リセット</button>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">
              <button id="toggle-head-lookat-btn" class="model-btn" style="flex: 1; min-width: 100px; font-size: 10.5px;">👤 顔カメラ: OFF</button>
              <button id="toggle-eye-lookat-btn" class="model-btn active" style="flex: 1; min-width: 100px; font-size: 10.5px;">👁️ 目カメラ: ON</button>
              <button id="toggle-eye-wander-btn" class="model-btn" style="flex: 1; min-width: 100px; font-size: 10.5px; border-color: #f59e0b; color: #fbbf24;">👀 目が泳ぐ: OFF</button>
            </div>
            <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px; font-size: 11px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 70px; color: #94a3b8;">視線 左右:</span>
                <input type="range" id="slider-eye-yaw" min="-0.6" max="0.6" step="0.02" value="0" style="flex: 1;">
                <span id="label-eye-yaw" style="width: 38px; text-align: right; color: #cbd5e1; font-family: monospace;">0.00</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 70px; color: #94a3b8;">視線 上下:</span>
                <input type="range" id="slider-eye-pitch" min="-0.5" max="0.5" step="0.02" value="0" style="flex: 1;">
                <span id="label-eye-pitch" style="width: 38px; text-align: right; color: #cbd5e1; font-family: monospace;">0.00</span>
              </div>
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
              <button id="quick-yandere-effect-btn" class="effect-text-btn" style="border-color: #991b1b; color: #f87171; font-weight: 700;">🖤 ずっと一緒…</button>
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
              <button class="model-btn voice-btn" data-voice="${resolveAssetUrl('/voices/girl4_ref.wav')}">🎙️ 💤 ${lang === 'en' ? 'Downer (Sleepy)' : 'ダウナー (眠いし)'}</button>
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

        <!-- TAB 2: Stage -->
        <div id="tab-pane-stage" class="tab-pane ${currentActiveTab === 'stage' ? 'active' : ''}">
          <!-- Time of Day -->
          <div class="section-box" style="border-left: 3px solid #f59e0b; padding-left: 6px;">
            <label class="section-label" style="color: #fbbf24; font-weight: 700;">${tr.scenes.timeOfDayTitle}</label>
            <p style="font-size: 10px; color: #888888; margin: 2px 0 6px 0;">時間帯によってライティング・マテリアル・ポストプロセスが変化します。</p>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div>
                <span style="font-size: 10.5px; color: #aaaaaa; font-weight: 600; display: block; margin-bottom: 3px;">屋外 (Outdoor)</span>
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px;">
                  <button data-timeofday="morning" class="timeofday-btn ${currentConfig.activeScene?.timeOfDay === 'morning' ? 'active' : ''}" title="${tr.scenes.presetMorningParkTip}">${tr.scenes.morning}</button>
                  <button data-timeofday="day" class="timeofday-btn ${currentConfig.activeScene?.timeOfDay === 'day' ? 'active' : ''}" title="${tr.scenes.presetDayParkTip}">${tr.scenes.day}</button>
                  <button data-timeofday="evening" class="timeofday-btn ${currentConfig.activeScene?.timeOfDay === 'evening' ? 'active' : ''}" title="${tr.scenes.presetEveningParkTip}">${tr.scenes.evening}</button>
                  <button data-timeofday="rainy" class="timeofday-btn ${currentConfig.activeScene?.timeOfDay === 'rainy' ? 'active' : ''}" title="${tr.scenes.presetRainyParkTip}">${tr.scenes.rainy}</button>
                  <button data-timeofday="night" class="timeofday-btn ${currentConfig.activeScene?.timeOfDay === 'night' ? 'active' : ''}" title="${tr.scenes.presetNightParkTip}">${tr.scenes.night}</button>
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

          <!-- Location & Background -->
          <div class="section-box">
            <label class="section-label">${tr.scenes.locationTitle}</label>
            <p style="font-size: 10px; color: #888888; margin: 2px 0 6px 0;">背景（場所）のみを切り替えます。時間帯パラメータは維持されます。</p>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="bg-buttons">
              <button data-location="modern_park" data-bg="${resolveAssetUrl('/textures/modern-park-far.avif')}" data-mid="${resolveAssetUrl('/textures/modern-park-mid.avif')}" class="bg-btn active">${tr.scenes.backgrounds.modernPark}</button>
              <button data-location="park_with_sea" data-bg="${resolveAssetUrl('/textures/park-with-sea-far.avif')}" class="bg-btn">${tr.scenes.backgrounds.parkWithSea}</button>
              <button data-location="school_gate" data-bg="${resolveAssetUrl('/textures/school-gate-far.avif')}" class="bg-btn">${tr.scenes.backgrounds.schoolGate}</button>
              <button data-location="classroom" data-bg="${resolveAssetUrl('/textures/school-corridor-far.avif')}" class="bg-btn">${tr.scenes.backgrounds.classroom}</button>
              <button data-location="school_rooftop" data-bg="${resolveAssetUrl('/textures/school-rooftop-far.avif')}" class="bg-btn">${tr.scenes.backgrounds.schoolRooftop}</button>
              <button data-location="night_festival" data-bg="${resolveAssetUrl('/textures/night-festival-far.avif')}" class="bg-btn">${tr.scenes.backgrounds.nightFestival}</button>
              <button data-location="old_park" data-bg="${resolveAssetUrl('/textures/park-background.avif')}" class="bg-btn">${tr.scenes.backgrounds.oldPark}</button>
              <button data-location="cafe" data-bg="${resolveAssetUrl('/textures/cafe_far.avif')}" data-near="${resolveAssetUrl('/textures/cafe_near.avif')}" class="bg-btn">${tr.scenes.backgrounds.cafe}</button>
              <button data-location="town" data-bg="${resolveAssetUrl('/textures/town_far.avif')}" class="bg-btn">${tr.scenes.backgrounds.town}</button>
              <button data-location="apartment_door" data-bg="${resolveAssetUrl('/textures/apartment_door_far.avif')}" class="bg-btn">${tr.scenes.backgrounds.apartmentDoor}</button>
              <button data-location="myroom" data-bg="${resolveAssetUrl('/textures/myroom_far.avif')}" class="bg-btn">${tr.scenes.backgrounds.myroom}</button>
              <button data-location="none" data-bg="none" class="bg-btn">${tr.scenes.backgrounds.offSingleColor}</button>
            </div>
          </div>

          <!-- Avatar Framing -->
          <div class="section-box">
            <label class="section-label">${tr.scenes.avatarFramingTitle}</label>
            <p style="font-size: 10px; color: #888888; margin: 2px 0 6px 0;">${tr.scenes.avatarFramingDesc}</p>
            <div style="display: flex; gap: 6px;" id="avatar-framing-buttons">
              <button data-framing="full" class="framing-btn" style="flex: 1;">${tr.scenes.avatarFraming.full}</button>
              <button data-framing="bust" class="framing-btn" style="flex: 1;">${tr.scenes.avatarFraming.bust}</button>
              <button data-framing="close" class="framing-btn" style="flex: 1;">${tr.scenes.avatarFraming.close}</button>
            </div>
          </div>

          <!-- Avatar Manipulation Guide -->
          <div class="section-box" style="background: #18181b; border: 1px solid #27272a; border-radius: 6px; padding: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <label class="section-label" style="margin: 0; color: #38bdf8; font-weight: 600;">🎮 アバター操作 (トラックパッド / キーボード)</label>
              <button id="reset-avatar-transform-btn" style="font-size: 10px; padding: 2px 8px; background: #27272a; border: 1px solid #3f3f46; color: #cbd5e1; border-radius: 4px; cursor: pointer;">↺ リセット (R)</button>
            </div>
            <div style="font-size: 10px; color: #94a3b8; line-height: 1.5; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 4px;">
              <div>• <b>ドラッグ</b>: 向き回転</div>
              <div>• <b>Shift+ドラッグ</b>: 平行移動</div>
              <div>• <b>2本指スクロール</b>: 前後移動</div>
              <div>• <b>WASD / 矢印</b>: 移動・回転</div>
            </div>
          </div>

          <!-- Scenarios -->
          <!-- ★ SPECIAL: PV「5秒の告白」 -->
          <div class="section-box" style="background: linear-gradient(135deg, rgba(35, 18, 42, 0.95) 0%, rgba(20, 24, 48, 0.95) 100%); border: 2px solid #ec4899; border-left: 5px solid #ff1493; padding: 10px; border-radius: 8px; box-shadow: 0 4px 16px rgba(236, 72, 153, 0.35);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label class="section-label" style="color: #ff69b4; font-weight: 800; font-size: 13px; margin-bottom: 0;">🎬 【PV】5秒の告白 〜5 Seconds Confession〜</label>
              <span style="font-size: 10px; padding: 2px 7px; background: linear-gradient(135deg, #ff1493, #a855f7); color: #ffffff; border-radius: 999px; font-weight: 800; letter-spacing: 0.05em; box-shadow: 0 2px 6px rgba(255, 20, 147, 0.4);">NEW PV</span>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 8px;">
              <button id="scenario-pv-btn" class="action-btn primary" style="flex: 1; background: linear-gradient(135deg, #ff1493 0%, #ec4899 50%, #8b5cf6 100%); font-weight: 800; box-shadow: 0 4px 14px rgba(255, 20, 147, 0.4); font-size: 13px; padding: 8px 10px; letter-spacing: 0.04em;">▶ PV「5秒の告白」を再生 (65秒)</button>
              <button id="scenario-pv-stop-btn" class="action-btn" style="min-width: 60px; font-weight: 700;">停止</button>
            </div>
            <div style="font-size: 11px; color: #ffd1dc; line-height: 1.45; margin-top: 6px;">
              BGM「thema_music.mp3」完全同期！32秒サビ、56秒フレーズ、1:00クライマックス「大好きだよ！」＆Kawaiiタイトルロゴ演出。
            </div>
          </div>

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

          <div class="section-box" style="background: #202020; border: 1px solid #333333; border-left: 3px solid #8b5cf6; padding: 8px; border-radius: 4px;">
            <label class="section-label" style="color: #a78bfa; font-weight: 700;">${tr.scenario.trioTitle}</label>
            <div style="display: flex; gap: 4px; margin-top: 4px;">
              <button id="scenario-trio-btn" class="action-btn primary" style="flex: 1; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); font-weight: 700; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25); font-size: 12px; padding: 7px;">${tr.scenario.playTrio}</button>
              <button id="scenario-trio-stop-btn" class="action-btn">${tr.scenario.stopScenario}</button>
            </div>
            <div style="font-size: 10.5px; color: #ddd6fe; line-height: 1.4; margin-top: 5px;">
              ${tr.scenario.trioDesc}
            </div>
          </div>

          <div class="section-box" style="background: #202020; border: 1px solid #333333; border-left: 3px solid #ec4899; padding: 8px; border-radius: 4px;">
            <label class="section-label" style="color: #f472b6; font-weight: 700;">${tr.scenario.haremTitle}</label>
            <div style="display: flex; gap: 4px; margin-top: 4px;">
              <button id="scenario-harem-btn" class="action-btn primary" style="flex: 1; background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); font-weight: 700; box-shadow: 0 4px 12px rgba(236, 72, 153, 0.25); font-size: 12px; padding: 7px;">${tr.scenario.playHarem}</button>
              <button id="scenario-harem-stop-btn" class="action-btn">${tr.scenario.stopScenario}</button>
            </div>
            <div style="font-size: 10.5px; color: #fbcfe8; line-height: 1.4; margin-top: 5px;">
              ${tr.scenario.haremDesc}
            </div>
          </div>

          <div class="section-box" style="background: #202020; border: 1px solid #333333; border-left: 3px solid #10b981; padding: 8px; border-radius: 4px;">
            <label class="section-label" style="color: #34d399; font-weight: 700;">${tr.scenario.townWalkTitle}</label>
            <div style="display: flex; gap: 4px; margin-top: 4px;">
              <button id="scenario-townwalk-btn" class="action-btn primary" style="flex: 1; background: linear-gradient(135deg, #059669 0%, #047857 100%); font-weight: 700; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25); font-size: 12px; padding: 7px;">${tr.scenario.playTownWalk}</button>
              <button id="scenario-townwalk-stop-btn" class="action-btn">${tr.scenario.stopScenario}</button>
            </div>
            <div style="font-size: 10.5px; color: #a7f3d0; line-height: 1.4; margin-top: 5px;">
              ${tr.scenario.townWalkDesc}
            </div>
          </div>

          <div class="section-box" style="background: #202020; border: 1px solid #333333; border-left: 3px solid #f97316; padding: 8px; border-radius: 4px;">
            <label class="section-label" style="color: #fb923c; font-weight: 700;">${tr.scenario.behindYouTitle}</label>
            <div style="display: flex; gap: 4px; margin-top: 4px;">
              <button id="scenario-behindyou-btn" class="action-btn primary" style="flex: 1; background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); font-weight: 700; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.25); font-size: 12px; padding: 7px;">${tr.scenario.playBehindYou}</button>
              <button id="scenario-behindyou-stop-btn" class="action-btn">${tr.scenario.stopScenario}</button>
            </div>
            <div style="font-size: 10.5px; color: #fed7aa; line-height: 1.4; margin-top: 5px;">
              ${tr.scenario.behindYouDesc}
            </div>
          </div>

          <div class="section-box" style="background: #202020; border: 1px solid #333333; border-left: 3px solid #14b8a6; padding: 8px; border-radius: 4px;">
            <label class="section-label" style="color: #2dd4bf; font-weight: 700;">${tr.scenario.nisaTitle}</label>
            <div style="display: flex; gap: 4px; margin-top: 4px;">
              <button id="scenario-nisa-btn" class="action-btn primary" style="flex: 1; background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); font-weight: 700; box-shadow: 0 4px 12px rgba(13, 148, 136, 0.25); font-size: 12px; padding: 7px;">${tr.scenario.playNisa}</button>
              <button id="scenario-nisa-stop-btn" class="action-btn">${tr.scenario.stopScenario}</button>
            </div>
            <div style="font-size: 10.5px; color: #99f6e4; line-height: 1.4; margin-top: 5px;">
              ${tr.scenario.nisaDesc}
            </div>
          </div>

          <div class="section-box" style="background: #202020; border: 1px solid #333333; border-left: 3px solid #38bdf8; padding: 8px; border-radius: 4px;">
            <label class="section-label" style="color: #38bdf8; font-weight: 700;">${tr.scenario.fastMotionTitle}</label>
            <div style="display: flex; gap: 4px; margin-top: 4px;">
              <button id="scenario-fastmotion-btn" class="action-btn primary" style="flex: 1; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); font-weight: 700; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25); font-size: 12px; padding: 7px;">${tr.scenario.playFastMotion}</button>
              <button id="scenario-fastmotion-stop-btn" class="action-btn">${tr.scenario.stopScenario}</button>
            </div>
            <div style="font-size: 10.5px; color: #bae6fd; line-height: 1.4; margin-top: 5px;">
              ${tr.scenario.fastMotionDesc}
            </div>
          </div>

          <div class="section-box" style="background: #202020; border: 1px solid #333333; border-left: 3px solid #dc2626; padding: 8px; border-radius: 4px;">
            <label class="section-label" style="color: #f87171; font-weight: 700;">${tr.scenario.doorPeepTitle}</label>
            <div style="display: flex; gap: 4px; margin-top: 4px;">
              <button id="scenario-doorpeep-btn" class="action-btn primary" style="flex: 1; background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%); font-weight: 700; box-shadow: 0 4px 12px rgba(185, 28, 28, 0.25); font-size: 12px; padding: 7px;">${tr.scenario.playDoorPeep}</button>
              <button id="scenario-doorpeep-stop-btn" class="action-btn">${tr.scenario.stopScenario}</button>
            </div>
            <div style="font-size: 10.5px; color: #fecaca; line-height: 1.4; margin-top: 5px;">
              ${tr.scenario.doorPeepDesc}
            </div>
          </div>

          <div class="section-box" style="background: #202020; border: 1px solid #333333; border-left: 3px solid #ec4899; padding: 8px; border-radius: 4px;">
            <label class="section-label" style="color: #f472b6; font-weight: 700;">${tr.scenario.privateDateTitle}</label>
            <div style="display: flex; gap: 4px; margin-top: 4px;">
              <button id="scenario-privatedate-btn" class="action-btn primary" style="flex: 1; background: linear-gradient(135deg, #db2777 0%, #9d174d 100%); font-weight: 700; box-shadow: 0 4px 12px rgba(219, 39, 119, 0.25); font-size: 12px; padding: 7px;">${tr.scenario.playPrivateDate}</button>
              <button id="scenario-privatedate-stop-btn" class="action-btn">${tr.scenario.stopScenario}</button>
            </div>
            <div style="font-size: 10.5px; color: #fbcfe8; line-height: 1.4; margin-top: 5px;">
              ${tr.scenario.privateDateDesc}
            </div>
          </div>

          <!-- Scenario Live Debugger -->
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

          <div id="gui-mount-point-stage" style="margin-top: 6px;"></div>
        </div>

        <!-- TAB 3: Visual -->
        <div id="tab-pane-visual" class="tab-pane ${currentActiveTab === 'visual' ? 'active' : ''}">
          <div id="gui-mount-point-visual"></div>
          <div id="histogram-mount-point" style="margin-top: 8px;"></div>
        </div>

        <!-- TAB 4: AI & System -->
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

          <!-- AI Avatar Voice Chat (Gemini API & VAD) -->
          <div class="aichat-container" style="margin-top: 12px; border-color: #2e435a; background: #161b22;">
            <div class="aichat-status-card" style="background: linear-gradient(135deg, #182230 0%, #121820 100%);">
              <div class="aichat-status-header">
                <span class="aichat-status-title" style="color: #6ab0f8; font-weight: 600;">${tr.geminiVadChat.title}</span>
                <span id="gemini-vad-badge" class="aichat-badge">${tr.geminiVadChat.statusIdle}</span>
              </div>
              <div id="gemini-vad-status-msg" class="aichat-status-detail">${tr.geminiVadChat.description}</div>

              <!-- API Key input (Password, never saved to storage) -->
              <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
                <label style="font-size: 11px; color: #8cb8ff; font-weight: 500;">🔑 ${tr.geminiVadChat.apiKeyLabel}:</label>
                <div style="display: flex; gap: 4px;">
                  <input type="password" id="gemini-api-key-input" class="aichat-input" placeholder="${tr.geminiVadChat.apiKeyPlaceholder}" style="flex: 1; font-size: 11px;" autocomplete="off" />
                  <button id="gemini-toggle-key-visibility" class="action-btn" style="padding: 4px 8px; font-size: 11px;" title="表示切替">👁️</button>
                </div>
                <small style="font-size: 9px; color: #888888; line-height: 1.2;">※ APIキーはブラウザのメモリ内のみに保持され、localStorage等には保存されません。</small>
              </div>

              <!-- TTS Server URL -->
              <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
                <label style="font-size: 11px; color: #aaaaaa;">🔊 ${tr.geminiVadChat.ttsUrlLabel}:</label>
                <input type="text" id="gemini-tts-url-input" class="aichat-input" value="${geminiVadChatController ? geminiVadChatController.getTtsServerUrl() : '/irodori-api/tts'}" style="font-size: 11px;" />
              </div>

              <!-- TTS Ref Path & Steps -->
              <div style="display: flex; gap: 6px; margin-top: 6px;">
                <div style="flex: 2; display: flex; flex-direction: column; gap: 4px;">
                  <label style="font-size: 11px; color: #aaaaaa;">📁 ${tr.geminiVadChat.ttsRefLabel}:</label>
                  <input type="text" id="gemini-tts-ref-input" class="aichat-input" value="${geminiVadChatController ? geminiVadChatController.getTtsRefPath() : '~/git/practice/vrm-view/vrm-genshin-like/voices/001.wav'}" style="font-size: 11px;" />
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                  <label style="font-size: 11px; color: #aaaaaa;">⚡ ${tr.geminiVadChat.ttsStepsLabel}:</label>
                  <select id="gemini-tts-steps-select" style="font-size: 11px; padding: 4px 6px; border-radius: 4px; border: 1px solid #3d3d3d; background: #1e1e1e; color: #ffffff; cursor: pointer;">
                    ${[4, 6, 8, 12, 16]
                      .map(
                        (steps) =>
                          `<option value="${steps}" ${(geminiVadChatController ? geminiVadChatController.getTtsSteps() : 8) === steps ? 'selected' : ''}>${steps}</option>`
                      )
                      .join('')}
                  </select>
                </div>
              </div>

              <!-- Start / Stop Voice Conversation -->
              <div style="display: flex; gap: 6px; margin-top: 8px;">
                <button id="gemini-vad-toggle-btn" class="aichat-init-btn" style="background: #2563eb; flex: 1;">${tr.geminiVadChat.startVoice}</button>
              </div>
            </div>

            <!-- Messages Box -->
            <div id="gemini-vad-messages" class="aichat-messages-box">
              <div id="gemini-vad-empty-hint" class="aichat-empty-hint">${tr.geminiVadChat.emptyHistory}</div>
            </div>

            <!-- Manual Text Input -->
            <div class="aichat-input-row">
              <input type="text" id="gemini-vad-text-input" class="aichat-input" placeholder="${tr.geminiVadChat.textPlaceholder}" />
              <button id="gemini-vad-send-btn" class="aichat-send-btn">${tr.geminiVadChat.send}</button>
            </div>
          </div>

          <!-- Config JSON Management -->
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
    // Mount Color Histogram
    const histMount = document.getElementById('histogram-mount-point');
    if (histMount) {
      colorHistogram.mount(histMount, () => {
        captureAndRenderHistogram();
      });
      if (currentActiveTab === 'visual') {
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

    // Tab Navigation
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

    // Master Data Count Labels
    const updateMasterCountLabels = () => {
      const charEl = document.getElementById('master-count-characters');
      const motEl = document.getElementById('master-count-motions');
      const sndEl = document.getElementById('master-count-sounds');
      const scnEl = document.getElementById('master-count-scenes');
      if (charEl) charEl.textContent = scenarioController.masterManager.getCharacters().length.toString();
      if (motEl) motEl.textContent = scenarioController.masterManager.getMotions().length.toString();
      if (sndEl) sndEl.textContent = scenarioController.masterManager.getSounds().length.toString();
      if (scnEl) scnEl.textContent = scenarioController.masterManager.getScenes().length.toString();
    };
    scenarioController.masterManager.subscribe(updateMasterCountLabels);
    updateMasterCountLabels();

    // AI Avatar Chat Setup
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
        const isReadyOrActive =
          state === 'ready' || state === 'speaking' || state === 'generating' || state === 'synthesizing';
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
        onTtsGpuActivityChange(active);
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

    renderChatState(avatarChatController.getState());

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

    // --------------------------------------------------
    // Gemini VAD & Dynamic Motion Chat Binding
    // --------------------------------------------------
    if (geminiVadChatController) {
      const gBadge = document.getElementById('gemini-vad-badge');
      const gStatusMsg = document.getElementById('gemini-vad-status-msg');
      const gApiKeyInput = document.getElementById('gemini-api-key-input') as HTMLInputElement | null;
      const gToggleKeyBtn = document.getElementById('gemini-toggle-key-visibility') as HTMLButtonElement | null;
      const gTtsUrlInput = document.getElementById('gemini-tts-url-input') as HTMLInputElement | null;
      const gTtsRefInput = document.getElementById('gemini-tts-ref-input') as HTMLInputElement | null;
      const gTtsStepsSelect = document.getElementById('gemini-tts-steps-select') as HTMLSelectElement | null;
      const gToggleBtn = document.getElementById('gemini-vad-toggle-btn') as HTMLButtonElement | null;
      const gMessages = document.getElementById('gemini-vad-messages');
      const gEmptyHint = document.getElementById('gemini-vad-empty-hint');
      const gTextInput = document.getElementById('gemini-vad-text-input') as HTMLInputElement | null;
      const gSendBtn = document.getElementById('gemini-vad-send-btn') as HTMLButtonElement | null;

      const renderVadChatState = (state: string, statusText?: string) => {
        if (!gBadge) return;
        gBadge.className = `aichat-badge ${state}`;

        const curTr = t().geminiVadChat;
        const stateLabels: Record<string, string> = {
          idle: curTr.statusIdle,
          listening: curTr.statusListening,
          speaking_user: curTr.statusSpeakingUser,
          thinking: curTr.statusThinking,
          synthesizing: curTr.statusSynthesizing,
          speaking_avatar: curTr.statusSpeakingAvatar,
          error: curTr.statusError,
        };

        gBadge.textContent = stateLabels[state] || state;
        if (statusText && gStatusMsg) {
          gStatusMsg.textContent = statusText;
        }

        if (gToggleBtn) {
          const isActive = state !== 'idle' && state !== 'error';
          gToggleBtn.textContent = isActive ? curTr.stopVoice : curTr.startVoice;
          gToggleBtn.style.background = isActive ? '#dc2626' : '#2563eb';
        }
      };

      geminiVadChatController.setEvents({
        onStateChange: (state, statusText) => {
          renderVadChatState(state, statusText);
        },
        onMessageAdded: (msg, meta) => {
          if (gEmptyHint) gEmptyHint.style.display = 'none';
          if (gMessages) {
            const msgEl = document.createElement('div');
            msgEl.className = `aichat-msg ${msg.role}`;

            const textEl = document.createElement('div');
            textEl.textContent = msg.content;
            msgEl.appendChild(textEl);

            if (meta && (meta.expression || meta.motionLayers?.length)) {
              const metaEl = document.createElement('div');
              metaEl.className = 'aichat-msg-meta';
              if (meta.expression) {
                const expTag = document.createElement('span');
                expTag.className = 'aichat-tag';
                expTag.textContent = `表情: ${meta.expression}`;
                metaEl.appendChild(expTag);
              }
              if (meta.motionLayers && meta.motionLayers.length > 0) {
                const motionTag = document.createElement('span');
                motionTag.className = 'aichat-tag';
                motionTag.title = meta.motionLayers.join(', ');
                motionTag.textContent = `動作: ${meta.motionLayers.join(' + ')}`;
                metaEl.appendChild(motionTag);
              }
              msgEl.appendChild(metaEl);
            }

            gMessages.appendChild(msgEl);
            gMessages.scrollTop = gMessages.scrollHeight;
          }
        },
        onError: (err) => {
          const msg = typeof err === 'string' ? err : err.message;
          if (gStatusMsg) gStatusMsg.textContent = msg;
          renderVadChatState('error', msg);
        },
      });

      // API Key input - in-memory only, NOT stored in localStorage!
      gApiKeyInput?.addEventListener('input', () => {
        if (gApiKeyInput) {
          geminiVadChatController.setApiKey(gApiKeyInput.value);
        }
      });

      // Visibility toggle for API Key
      gToggleKeyBtn?.addEventListener('click', () => {
        if (gApiKeyInput) {
          gApiKeyInput.type = gApiKeyInput.type === 'password' ? 'text' : 'password';
        }
      });

      // TTS URL
      gTtsUrlInput?.addEventListener('change', () => {
        if (gTtsUrlInput?.value) {
          geminiVadChatController.setTtsServerUrl(gTtsUrlInput.value);
        }
      });

      // TTS Ref Path
      gTtsRefInput?.addEventListener('change', () => {
        if (gTtsRefInput?.value) {
          geminiVadChatController.setTtsRefPath(gTtsRefInput.value);
        }
      });

      // TTS Steps
      gTtsStepsSelect?.addEventListener('change', () => {
        if (gTtsStepsSelect?.value) {
          geminiVadChatController.setTtsSteps(Number(gTtsStepsSelect.value));
        }
      });

      // Start / Stop conversation button
      gToggleBtn?.addEventListener('click', async () => {
        if ((audioLipSync as any).audioContext?.state === 'suspended') {
          await (audioLipSync as any).audioContext.resume();
        }

        const currentState = geminiVadChatController.getState();
        if (currentState === 'idle' || currentState === 'error') {
          if (!geminiVadChatController.hasApiKey()) {
            gApiKeyInput?.focus();
            showToast('Gemini APIキーを入力してください');
            return;
          }
          try {
            await geminiVadChatController.startConversation();
          } catch (err: any) {
            showToast(err?.message || '会話の開始に失敗しました');
          }
        } else {
          await geminiVadChatController.stopConversation();
        }
      });

      // Manual text send
      const handleSendVadText = async () => {
        if (!gTextInput || !gTextInput.value.trim()) return;
        if (!geminiVadChatController.hasApiKey()) {
          gApiKeyInput?.focus();
          showToast('Gemini APIキーを入力してください');
          return;
        }
        const text = gTextInput.value.trim();
        gTextInput.value = '';
        if ((audioLipSync as any).audioContext?.state === 'suspended') {
          await (audioLipSync as any).audioContext.resume();
        }
        try {
          await geminiVadChatController.sendTextMessage(text);
        } catch (err: any) {
          showToast(err?.message || 'メッセージ送信に失敗しました');
        }
      };

      gSendBtn?.addEventListener('click', handleSendVadText);
      gTextInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          handleSendVadText();
        }
      });

      renderVadChatState(geminiVadChatController.getState());
    }

    document.getElementById('master-export-json-btn')?.addEventListener('click', () => {
      scenarioController.masterManager.downloadJSON('masters.json');
      showToast(t().toasts.mastersDownloaded);
    });

    document.getElementById('master-copy-json-btn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(scenarioController.masterManager.exportJSON());
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
        const ok = scenarioController.masterManager.importJSON(text);
        showToast(ok ? t().toasts.mastersImported : t().toasts.mastersImportFailed);
      }
    });

    document.getElementById('master-reset-btn')?.addEventListener('click', () => {
      scenarioController.masterManager.resetToDefault();
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
          if (scenarioController.scenarioPlayer.isPlaying) scenarioController.scenarioPlayer.stop();
          if (avatarManager.animationPlayer.isPlaying) avatarManager.animationPlayer.stop();
          scenarioController.scenarioEngine.play(customScenario);
          showToast(`${t().toasts.scenarioStarted}「${customScenario.title || file.name}」`);
        } catch (err) {
          showToast(t().toasts.scenarioJsonFailed);
        }
      }
    });

    // Modular Inspectors
    rebuildInspector();

    // Quick JSON Actions
    document.getElementById('quick-copy-json')?.addEventListener('click', async () => {
      const ok = await copyConfigToClipboard(currentConfig);
      showToast(ok ? t().toasts.configCopied : t().common.copyFailed);
    });

    document.getElementById('quick-download-json')?.addEventListener('click', () => {
      downloadConfigJSON(currentConfig);
      showToast(t().toasts.configSaved);
    });

    document.getElementById('quick-import-json')?.addEventListener('click', () => {
      openImportModal(currentConfig, (cfg) => {
        onApplyConfig(cfg);
        inspectorManager.updateAllInspectorsDisplay();
        scenePresetManager.syncTimeOfDayButtons();
        syncBgButtons(cfg.environment.showBackgroundImage, cfg.environment.backgroundImageUrl);
      });
    });

    document.getElementById('quick-reset-json')?.addEventListener('click', () => {
      deepAssign(currentConfig, DEFAULT_CONFIG);
      onApplyConfig(currentConfig);
      inspectorManager.updateAllInspectorsDisplay();
      scenePresetManager.syncTimeOfDayButtons();
      syncBgButtons(currentConfig.environment.showBackgroundImage, currentConfig.environment.backgroundImageUrl);
      showToast(t().toasts.configReset);
    });

    // Time of Day Buttons
    const timeOfDayButtons = document.querySelectorAll<HTMLButtonElement>('.timeofday-btn');
    timeOfDayButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const todId = btn.getAttribute('data-timeofday') as TimeOfDayId;
        if (todId) {
          scenePresetManager.switchTimeOfDay(todId);
        }
      });
    });
    scenePresetManager.syncTimeOfDayButtons();

    // Animation Play/Stop
    document.getElementById('anim-play-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      avatarManager.animationPlayer.play();
      showToast(t().toasts.animStarted);
    });

    document.getElementById('anim-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      avatarManager.animationPlayer.stop();
      showToast(t().toasts.animStopped);
    });

    // Scenario Sequence Play/Stop
    document.getElementById('scenario-play-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (scenarioController.scenarioPlayer.isPlaying) {
        scenarioController.scenarioPlayer.stop();
      } else {
        if (scenarioController.scenarioEngine.isPlaying) scenarioController.scenarioEngine.stop();
        if (avatarManager.animationPlayer.isPlaying) avatarManager.animationPlayer.stop();
        scenarioController.scenarioPlayer.play();
      }
    });

    document.getElementById('scenario-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scenarioController.scenarioPlayer.stop();
    });

    // Interactive Confession Scenario Play/Stop
    document.getElementById('scenario-confession-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (scenarioController.scenarioEngine.isPlaying) {
        scenarioController.scenarioEngine.stop();
      } else {
        if (scenarioController.scenarioPlayer.isPlaying) scenarioController.scenarioPlayer.stop();
        if (avatarManager.animationPlayer.isPlaying) avatarManager.animationPlayer.stop();
        scenarioController.scenarioEngine.play(getParkConfessionScenario(getLanguage()));
        showToast(t().toasts.confessionStarted);
      }
    });

    document.getElementById('scenario-confession-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scenarioController.scenarioEngine.stop();
      showToast(t().toasts.scenarioStopped);
    });

    // Interactive 2-Girl Dialogue Scenario Play/Stop
    document.getElementById('scenario-twogirls-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (scenarioController.scenarioEngine.isPlaying) {
        scenarioController.scenarioEngine.stop();
      } else {
        if (scenarioController.scenarioPlayer.isPlaying) scenarioController.scenarioPlayer.stop();
        if (avatarManager.animationPlayer.isPlaying) avatarManager.animationPlayer.stop();
        scenarioController.scenarioEngine.play(getTwoGirlsConversationScenario(getLanguage()));
        showToast(t().toasts.twoGirlsStarted);
      }
    });

    document.getElementById('scenario-twogirls-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scenarioController.scenarioEngine.stop();
      showToast(t().toasts.scenarioStopped);
    });

    // Interactive 3-Person Dialogue Scenario Play/Stop
    document.getElementById('scenario-trio-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (scenarioController.scenarioEngine.isPlaying) {
        scenarioController.scenarioEngine.stop();
      } else {
        if (scenarioController.scenarioPlayer.isPlaying) scenarioController.scenarioPlayer.stop();
        if (avatarManager.animationPlayer.isPlaying) avatarManager.animationPlayer.stop();
        scenarioController.scenarioEngine.play(getTrioConversationScenario(getLanguage()));
        showToast(t().toasts.trioStarted);
      }
    });

    document.getElementById('scenario-trio-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scenarioController.scenarioEngine.stop();
      showToast(t().toasts.scenarioStopped);
    });

    // Interactive 4-Person Dialogue Scenario (Harem / True Love Trial) Play/Stop
    document.getElementById('scenario-harem-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (scenarioController.scenarioEngine.isPlaying) {
        scenarioController.scenarioEngine.stop();
      } else {
        if (scenarioController.scenarioPlayer.isPlaying) scenarioController.scenarioPlayer.stop();
        if (avatarManager.animationPlayer.isPlaying) avatarManager.animationPlayer.stop();
        scenarioController.scenarioEngine.play(getHaremConversationScenario(getLanguage()));
        showToast(t().toasts.haremStarted);
      }
    });

    document.getElementById('scenario-harem-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scenarioController.scenarioEngine.stop();
      showToast(t().toasts.scenarioStopped);
    });

    // Interactive Town Walk Scenario Play/Stop
    document.getElementById('scenario-townwalk-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (scenarioController.scenarioEngine.isPlaying) {
        scenarioController.scenarioEngine.stop();
      } else {
        if (scenarioController.scenarioPlayer.isPlaying) scenarioController.scenarioPlayer.stop();
        if (avatarManager.animationPlayer.isPlaying) avatarManager.animationPlayer.stop();
        const scenario = getTownWalkScenario(getLanguage());
        await scenarioController.playWithInterlude(scenario, {
          title: scenario.title,
          subtitle: 'SCENE TRANSITION',
        });
        showToast(t().toasts.townWalkStarted);
      }
    });

    document.getElementById('scenario-townwalk-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scenarioController.scenarioEngine.stop();
      showToast(t().toasts.scenarioStopped);
    });

    // Interactive Behind You Scenario Play/Stop
    document.getElementById('scenario-behindyou-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (scenarioController.scenarioEngine.isPlaying) {
        scenarioController.scenarioEngine.stop();
      } else {
        if (viewerCore.panoramaController.isActive) {
          viewerCore.panoramaController.deactivate();
        }
        if (scenarioController.scenarioPlayer.isPlaying) scenarioController.scenarioPlayer.stop();
        if (avatarManager.animationPlayer.isPlaying) avatarManager.animationPlayer.stop();
        const scenario = getBehindYouScenario(getLanguage());
        scenarioController.scenarioEngine.play(scenario);
        showToast(t().toasts.behindYouStarted);
      }
    });

    document.getElementById('scenario-behindyou-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scenarioController.scenarioEngine.stop();
      showToast(t().toasts.scenarioStopped);
    });

    // Interactive NISA All-Country ETF Scenario Play/Stop
    document.getElementById('scenario-nisa-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (scenarioController.scenarioEngine.isPlaying) {
        scenarioController.scenarioEngine.stop();
      } else {
        if (viewerCore.panoramaController.isActive) {
          viewerCore.panoramaController.deactivate();
        }
        if (scenarioController.scenarioPlayer.isPlaying) scenarioController.scenarioPlayer.stop();
        if (avatarManager.animationPlayer.isPlaying) avatarManager.animationPlayer.stop();
        const scenario = getNisaScenario(getLanguage());
        scenarioController.scenarioEngine.play(scenario);
        showToast(t().toasts.nisaStarted);
      }
    });

    document.getElementById('scenario-nisa-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scenarioController.scenarioEngine.stop();
      showToast(t().toasts.scenarioStopped);
    });

    // Interactive Fast Motion Scenario Play/Stop
    document.getElementById('scenario-fastmotion-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (scenarioController.scenarioEngine.isPlaying) {
        scenarioController.scenarioEngine.stop();
      } else {
        if (viewerCore.panoramaController.isActive) {
          viewerCore.panoramaController.deactivate();
        }
        if (scenarioController.scenarioPlayer.isPlaying) scenarioController.scenarioPlayer.stop();
        if (avatarManager.animationPlayer.isPlaying) avatarManager.animationPlayer.stop();
        const scenario = getFastMotionScenario(getLanguage());
        scenarioController.scenarioEngine.play(scenario);
        showToast(t().toasts.fastMotionStarted);
      }
    });

    document.getElementById('scenario-fastmotion-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scenarioController.scenarioEngine.stop();
      showToast(t().toasts.scenarioStopped);
    });

    // Interactive Door Peep-hole Yandere Scenario Play/Stop
    document.getElementById('scenario-doorpeep-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (scenarioController.scenarioEngine.isPlaying) {
        scenarioController.scenarioEngine.stop();
      } else {
        if (viewerCore.panoramaController.isActive) {
          viewerCore.panoramaController.deactivate();
        }
        if (scenarioController.scenarioPlayer.isPlaying) scenarioController.scenarioPlayer.stop();
        if (avatarManager.animationPlayer.isPlaying) avatarManager.animationPlayer.stop();
        const scenario = getDoorPeepYandereScenario(getLanguage());
        scenarioController.scenarioEngine.play(scenario);
        showToast(t().toasts.doorPeepStarted);
      }
    });

    document.getElementById('scenario-doorpeep-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scenarioController.scenarioEngine.stop();
      showToast(t().toasts.scenarioStopped);
    });

    // Interactive Holiday Private Date Scenario Play/Stop
    document.getElementById('scenario-privatedate-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (scenarioController.scenarioEngine.isPlaying) {
        scenarioController.scenarioEngine.stop();
      } else {
        if (viewerCore.panoramaController.isActive) {
          viewerCore.panoramaController.deactivate();
        }
        if (scenarioController.scenarioPlayer.isPlaying) scenarioController.scenarioPlayer.stop();
        if (avatarManager.animationPlayer.isPlaying) avatarManager.animationPlayer.stop();
        const scenario = getPrivateDateScenario(getLanguage());
        await scenarioController.playWithInterlude(scenario, {
          title: scenario.title,
          subtitle: 'HOLIDAY PRIVATE DATE',
        });
        showToast(t().toasts.privateDateStarted);
      }
    });

    document.getElementById('scenario-privatedate-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scenarioController.scenarioEngine.stop();
      showToast(t().toasts.scenarioStopped);
    });

    // 5 Seconds Confession PV Scenario Play/Stop
    document.getElementById('scenario-pv-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (scenarioController.scenarioEngine.isPlaying) {
        scenarioController.scenarioEngine.stop();
      } else {
        if (viewerCore.panoramaController.isActive) {
          viewerCore.panoramaController.deactivate();
        }
        if (scenarioController.scenarioPlayer.isPlaying) scenarioController.scenarioPlayer.stop();
        if (avatarManager.animationPlayer.isPlaying) avatarManager.animationPlayer.stop();
        const scenario = getFiveSecondsConfessionPvScenario();
        await scenarioController.playWithInterlude(scenario, {
          title: '5秒の告白',
          subtitle: '5 SECONDS CONFESSION - OFFICIAL PV -',
        });
        showToast('🎬 PV「5秒の告白」を再生します');
      }
    });

    document.getElementById('scenario-pv-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scenarioController.scenarioEngine.stop();
      scenarioController.pvTitleOverlay.hide();
      showToast(t().toasts.scenarioStopped);
    });

    // Background Buttons
    const bgButtons = document.querySelectorAll<HTMLButtonElement>('.bg-btn');
    bgButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (viewerCore.panoramaController.isActive) {
          viewerCore.panoramaController.deactivate();
        }
        const bg = btn.getAttribute('data-bg');
        const mid = btn.getAttribute('data-mid');
        const near = btn.getAttribute('data-near');
        const loc = btn.getAttribute('data-location');
        if (loc) {
          if (!currentConfig.activeScene) {
            currentConfig.activeScene = { location: loc };
          } else {
            currentConfig.activeScene.location = loc;
          }
          currentConfig.activeScene.presetId = scenePresetManager.getScenePresetIdFromState(
            scenePresetManager.getActiveTimeOfDay(),
            loc
          );
        }
        if (bg === 'none') {
          currentConfig.environment.showBackgroundImage = false;
          currentConfig.environment.showMidground = false;
          currentConfig.environment.showNearground = false;
        } else if (bg) {
          currentConfig.environment.showBackgroundImage = true;
          currentConfig.environment.backgroundImageUrl = bg;
          if (mid) {
            currentConfig.environment.showMidground = true;
            currentConfig.environment.midgroundImageUrl = mid;
          } else {
            currentConfig.environment.showMidground = false;
          }
          if (near) {
            currentConfig.environment.showNearground = true;
            currentConfig.environment.neargroundImageUrl = near;
          } else {
            currentConfig.environment.showNearground = false;
          }
        }
        viewerCore.updateBackgroundDisplay(currentConfig);
        viewerCore.updateMidgroundDisplay(currentConfig);
        viewerCore.updateNeargroundDisplay(currentConfig);
        syncBgButtons(currentConfig.environment.showBackgroundImage, currentConfig.environment.backgroundImageUrl);
        inspectorManager.updateAllInspectorsDisplay();
      });
    });

    // Avatar Framing Buttons
    const framingButtons = document.querySelectorAll<HTMLButtonElement>('.framing-btn');
    framingButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const framing = btn.getAttribute('data-framing') as 'full' | 'bust' | 'close';
        if (framing) {
          framingButtons.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          viewerCore.setCameraFraming(framing);
        }
      });
    });

    // Reset Avatar Transform Button
    const resetTransformBtn = document.getElementById('reset-avatar-transform-btn');
    resetTransformBtn?.addEventListener('click', () => {
      ctx.avatarTransformController?.resetTransform();
      showToast('アバターの位置と向きをリセットしました');
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
          avatarManager.loadAvatarModel(modelUrl);
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
          avatarManager.loadAvatarModel(blobUrl);
        }
      };
      input.click();
    });

    // Motion Buttons
    const motionButtons = document.querySelectorAll<HTMLButtonElement>('.motion-btn');
    motionButtons.forEach((btn) => {
      if (btn.id === 'open-local-fbx-btn') return;
      btn.addEventListener('click', async () => {
        motionButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const motionUrl = btn.getAttribute('data-motion');
        const av = avatarManager.avatarInstance;
        if (!av) return;

        if (motionUrl === 'none') {
          avatarManager.currentMotionUrl = 'none';
          av.stopAnimation();
        } else if (motionUrl) {
          avatarManager.currentMotionUrl = motionUrl;
          const isLoop = motionUrl.startsWith('blob:') || isMotionLoop(motionUrl);
          await av.playAnimation(motionUrl, isLoop);
        }
      });
    });

    document.getElementById('open-local-fbx-btn')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.fbx';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const blobUrl = URL.createObjectURL(file);
          const existing = avatarManager.customMotions.find((m) => m.name === file.name);
          if (existing) {
            existing.url = blobUrl;
          } else {
            avatarManager.customMotions.push({ name: file.name, url: blobUrl });
          }
          avatarManager.currentMotionUrl = blobUrl;
          renderUI();
          if (avatarManager.avatarInstance) {
            const action = await avatarManager.avatarInstance.playAnimation(blobUrl, true);
            if (action) {
              showToast(`${t().toasts.motionLoaded}${file.name}`);
            } else {
              showToast(t().toasts.motionLoadFailed);
            }
          }
        }
      };
      input.click();
    });

    // Expression Buttons
    const exprButtons = document.querySelectorAll<HTMLButtonElement>('.expr-btn');
    // Yandere Mode Toggle Button
    const yandereToggleBtn = document.getElementById('yandere-toggle-btn') as HTMLButtonElement | null;
    const updateYandereButtonUI = (isActive: boolean) => {
      if (!yandereToggleBtn) return;
      yandereToggleBtn.style.background = isActive ? '#881337' : '#2a1118';
      yandereToggleBtn.style.borderColor = isActive ? '#f43f5e' : '#dc2626';
      yandereToggleBtn.style.color = isActive ? '#ffffff' : '#fca5a5';
      yandereToggleBtn.textContent = isActive ? '🖤 闇落ち中 (解除)' : '🖤 ヤンデレ闇落ち';
    };

    yandereToggleBtn?.addEventListener('click', () => {
      const isYandere = avatarManager.isYandereMode();
      const nextState = !isYandere;
      avatarManager.setYandereMode(nextState);
      updateYandereButtonUI(nextState);
      if (nextState) {
        exprButtons.forEach((b) => b.classList.remove('active'));
        showToast('🖤 ヤンデレ闇落ち状態を発動しました');
      } else {
        exprButtons.forEach((b) => {
          b.classList.toggle('active', b.getAttribute('data-expr') === 'neutral');
        });
        showToast('✨ 通常状態に戻りました');
      }
    });

    // Quick Yandere Effect Text Button
    document.getElementById('quick-yandere-effect-btn')?.addEventListener('click', () => {
      const av = avatarManager.avatarInstance;
      if (av) {
        avatarManager.setYandereMode(true);
        updateYandereButtonUI(true);
        exprButtons.forEach((b) => b.classList.remove('active'));
        av.showEffectText({
          text: '……ずっと一緒だよ？',
          stylePreset: 'doki',
          anchor: 'head',
          duration: 4.0,
          scale: 1.1,
        });
        showToast('🖤 「……ずっと一緒だよ？」');
      }
    });

    // LookAt & Face direction controls
    const toggleHeadBtn = document.getElementById('toggle-head-lookat-btn') as HTMLButtonElement | null;
    const toggleEyeBtn = document.getElementById('toggle-eye-lookat-btn') as HTMLButtonElement | null;
    const toggleWanderBtn = document.getElementById('toggle-eye-wander-btn') as HTMLButtonElement | null;
    const sliderEyeYaw = document.getElementById('slider-eye-yaw') as HTMLInputElement | null;
    const sliderEyePitch = document.getElementById('slider-eye-pitch') as HTMLInputElement | null;
    const labelEyeYaw = document.getElementById('label-eye-yaw');
    const labelEyePitch = document.getElementById('label-eye-pitch');
    const resetLookAtBtn = document.getElementById('reset-lookat-btn');

    let isHeadLookAt = false;
    let isEyeLookAt = true;
    let isEyeWander = false;

    toggleHeadBtn?.addEventListener('click', () => {
      const av = avatarManager.avatarInstance;
      isHeadLookAt = !isHeadLookAt;
      if (av) {
        av.setHeadLookAtCamera(isHeadLookAt);
      }
      toggleHeadBtn.classList.toggle('active', isHeadLookAt);
      toggleHeadBtn.textContent = isHeadLookAt ? '👤 顔カメラ: ON' : '👤 顔カメラ: OFF';
      showToast(isHeadLookAt ? '👤 顔のカメラ追従をONにしました' : '👤 顔のカメラ追従をOFFにしました');
    });

    toggleEyeBtn?.addEventListener('click', () => {
      const av = avatarManager.avatarInstance;
      isEyeLookAt = !isEyeLookAt;
      if (av) {
        av.setEyeLookAt({ mode: isEyeLookAt ? 'camera' : 'forward' });
        av.setLookAtCamera(isEyeLookAt);
      }
      toggleEyeBtn.classList.toggle('active', isEyeLookAt);
      toggleEyeBtn.textContent = isEyeLookAt ? '👁️ 目カメラ: ON' : '👁️ 目カメラ: OFF';
      showToast(isEyeLookAt ? '👁️ 視線カメラ注視をONにしました' : '👁️ 視線カメラ注視をOFFにしました (正面固定)');
    });

    toggleWanderBtn?.addEventListener('click', () => {
      const av = avatarManager.avatarInstance;
      isEyeWander = !isEyeWander;
      if (av) {
        av.setEyeWander(isEyeWander, 1.0);
      }
      toggleWanderBtn.classList.toggle('active', isEyeWander);
      toggleWanderBtn.textContent = isEyeWander ? '👀 目が泳ぐ: ON' : '👀 目が泳ぐ: OFF';
      showToast(isEyeWander ? '👀 目が泳ぐ演出をONにしました' : '👀 目が泳ぐ演出をOFFにしました');
    });

    sliderEyeYaw?.addEventListener('input', () => {
      const val = parseFloat(sliderEyeYaw.value);
      if (labelEyeYaw) labelEyeYaw.textContent = val.toFixed(2);
      const av = avatarManager.avatarInstance;
      if (av) {
        const pitch = sliderEyePitch ? parseFloat(sliderEyePitch.value) : 0;
        av.setEyeOffset(val, pitch);
      }
    });

    sliderEyePitch?.addEventListener('input', () => {
      const val = parseFloat(sliderEyePitch.value);
      if (labelEyePitch) labelEyePitch.textContent = val.toFixed(2);
      const av = avatarManager.avatarInstance;
      if (av) {
        const yaw = sliderEyeYaw ? parseFloat(sliderEyeYaw.value) : 0;
        av.setEyeOffset(yaw, val);
      }
    });

    resetLookAtBtn?.addEventListener('click', () => {
      const av = avatarManager.avatarInstance;
      isHeadLookAt = false;
      isEyeLookAt = true;
      isEyeWander = false;

      if (toggleHeadBtn) {
        toggleHeadBtn.classList.remove('active');
        toggleHeadBtn.textContent = '👤 顔カメラ: OFF';
      }
      if (toggleEyeBtn) {
        toggleEyeBtn.classList.add('active');
        toggleEyeBtn.textContent = '👁️ 目カメラ: ON';
      }
      if (toggleWanderBtn) {
        toggleWanderBtn.classList.remove('active');
        toggleWanderBtn.textContent = '👀 目が泳ぐ: OFF';
      }
      if (sliderEyeYaw) {
        sliderEyeYaw.value = '0';
        if (labelEyeYaw) labelEyeYaw.textContent = '0.00';
      }
      if (sliderEyePitch) {
        sliderEyePitch.value = '0';
        if (labelEyePitch) labelEyePitch.textContent = '0.00';
      }

      if (av) {
        av.setHeadLookAtCamera(false);
        av.setEyeLookAt({ mode: 'camera', offset: { x: 0, y: 0 }, wander: false });
        av.setLookAtCamera(true);
      }
      showToast('🔄 視線・顔の向きをリセットしました');
    });

    exprButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (avatarManager.isYandereMode()) {
          avatarManager.setYandereMode(false);
          updateYandereButtonUI(false);
        }
        exprButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const expr = btn.getAttribute('data-expr');
        if (expr) {
          avatarManager.currentExprName = expr;
          if (avatarManager.avatarInstance) {
            avatarManager.avatarInstance.setExpression(expr, 1.0);
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

        const av = avatarManager.avatarInstance;
        if (av) {
          if (expr) {
            av.setExpression(expr, 1.0);
            exprButtons.forEach((b) => {
              b.classList.toggle('active', b.getAttribute('data-expr') === expr);
            });
          }
          av.showEffectText({
            text,
            stylePreset: preset,
            anchor: 'head',
          });
          showToast(`💬 「${text}」`);
        }
      });
    });

    // Quick Sweat Mark Button
    document.getElementById('quick-sweat-btn')?.addEventListener('click', () => {
      const av = avatarManager.avatarInstance;
      if (av) {
        av.setExpression('surprised', 1.0);
        exprButtons.forEach((b) => {
          b.classList.toggle('active', b.getAttribute('data-expr') === 'surprised');
        });
        av.showFlySweat({ duration: 3.0 });
        showToast('💦 焦り表情 ＋ 4方向放物線の汗マークを発動しました');
      }
    });

    // Quick Jito Sweat Button
    document.getElementById('quick-jito-btn')?.addEventListener('click', () => {
      const av = avatarManager.avatarInstance;
      if (av) {
        av.setExpression('relaxed', 1.0);
        exprButtons.forEach((b) => {
          b.classList.toggle('active', b.getAttribute('data-expr') === 'relaxed');
        });
        av.showJitoSweat({ side: 'right', duration: 3.0 });
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
      const av = avatarManager.avatarInstance;
      if (av) {
        av.showEffectText({
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
      avatarManager.avatarInstance?.effectTextManager?.clear();
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

  gearBtn.addEventListener('click', () => {
    setPanelOpen(true);
  });

  renderUI();
  setPanelOpen(true);

  onLanguageChange(() => {
    renderUI();
    rebuildInspector();
  });
}
