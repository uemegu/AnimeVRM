import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { t } from '../../i18n';
import { WindController, WIND_PRESETS } from '../../wind/WindController';
import { DEFAULT_RAIN_CONFIG } from '../../effects/rain';
import { resolveAssetUrl } from '../../utils/path';
import { showToast } from '../components/Toast';
import { InspectorContext } from './InspectorManager';

export function setupStageInspector(container: HTMLElement, ctx: InspectorContext, guis: GUI[]): void {
  const tr = t();
  const stageGui = new GUI({
    title: tr.render.detailedParamsTitle,
    container,
    autoPlace: false,
  });
  guis.push(stageGui);

  const { currentConfig, toggleState, updateAllInspectorsDisplay } = ctx;

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
      updateAllInspectorsDisplay();
      showToast(`🍃 風プリセット適用: ${WIND_PRESETS[key]?.label || key}`);
    });

  windFolder
    .add(currentConfig.wind, 'enabled')
    .name(tr.gui.windEnabled)
    .onChange((val: boolean) => {
      toggleState.wind = val;
      updateAllInspectorsDisplay();
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
      ctx.viewerCore.rainEffect.updateConfig(currentConfig.rain!);
      updateAllInspectorsDisplay();
    });
  rainFolder
    .add(currentConfig.rain, 'count', 100, 4000, 100)
    .name('雨量・粒子数 (Count)')
    .onChange(() => ctx.viewerCore.rainEffect.updateConfig(currentConfig.rain!));
  rainFolder
    .add(currentConfig.rain, 'speed', 2.0, 30.0, 0.5)
    .name('落下速度 (Speed)')
    .onChange(() => ctx.viewerCore.rainEffect.updateConfig(currentConfig.rain!));
  rainFolder
    .add(currentConfig.rain, 'length', 0.05, 1.0, 0.01)
    .name('雨筋の長さ (Streak Length)')
    .onChange(() => ctx.viewerCore.rainEffect.updateConfig(currentConfig.rain!));
  rainFolder
    .add(currentConfig.rain, 'angle', -30, 30, 1)
    .name('傾き角度 (Slant Angle)')
    .onChange(() => ctx.viewerCore.rainEffect.updateConfig(currentConfig.rain!));
  rainFolder
    .addColor(currentConfig.rain, 'color')
    .name('雨の色 (Rain Color)')
    .onChange(() => ctx.viewerCore.rainEffect.updateConfig(currentConfig.rain!));
  rainFolder
    .add(currentConfig.rain, 'opacity', 0.05, 1.0, 0.05)
    .name('不透明度 (Opacity)')
    .onChange(() => ctx.viewerCore.rainEffect.updateConfig(currentConfig.rain!));
  rainFolder
    .add(currentConfig.rain, 'splashEnabled')
    .name('地面の水しぶき (Splashes)')
    .onChange(() => ctx.viewerCore.rainEffect.updateConfig(currentConfig.rain!));
  rainFolder
    .add(currentConfig.rain, 'splashCount', 20, 500, 10)
    .name('水しぶき数 (Splash Count)')
    .onChange(() => ctx.viewerCore.rainEffect.updateConfig(currentConfig.rain!));
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

  // 4. 360° Panorama Background Folder
  const panoramaFolder = stageGui.addFolder(tr.gui.panoramaFolder);
  const panorama = ctx.viewerCore.panoramaController;
  const avatarManager = ctx.avatarManager;

  const panoramaState = {
    enabled: panorama.isActive,
    testClassroom: async () => {
      showToast('🌐 教室360°パノラマ画像を読み込み中...');
      try {
        await panorama.load({
          imageUrl: resolveAssetUrl('/textures/class_room_3d.png'),
          initialYaw: Math.PI,
          initialPitch: 0,
          initialFov: 60,
        });
        panoramaState.enabled = true;

        // アバターが原点(0,0,0)にいる場合はカメラと重ならず股あたりまで綺麗に映るよう正面(-1.0m)へ自動配置
        const currentPos = avatarManager.getAvatarPosition();
        if (Math.abs(currentPos.x) < 0.01 && Math.abs(currentPos.z) < 0.01) {
          avatarManager.setAvatarPosition(0, 0, -1.0);
          avatarManager.setAvatarRotationY(0);
        }

        updateAllInspectorsDisplay();
        showToast('✓ 教室360°パノラマを表示しました');
      } catch (err) {
        console.error('Failed to load panorama texture', err);
        showToast('❌ パノラマ画像の読み込みに失敗しました');
      }
    },
    resetView: () => {
      panorama.resetView(Math.PI, 0, 60);
      updateAllInspectorsDisplay();
      showToast('🔄 視点を正面にリセットしました');
    },
    playDemo: async () => {
      if (!panorama.isActive) {
        await panoramaState.testClassroom();
      }
      showToast('🎬 カメラ演出デモを再生します');
      panorama.playDemoAnimation().then(() => {
        showToast('✓ カメラ演出デモが完了しました');
      });
    },
    get yawDeg() {
      return THREE.MathUtils.radToDeg(panorama.targetYaw);
    },
    set yawDeg(val: number) {
      panorama.targetYaw = THREE.MathUtils.degToRad(val);
    },
    get pitchDeg() {
      return THREE.MathUtils.radToDeg(panorama.targetPitch);
    },
    set pitchDeg(val: number) {
      panorama.targetPitch = THREE.MathUtils.degToRad(val);
    },
    // Avatar controls
    get avatarVisible() {
      return avatarManager.getAvatarVisible();
    },
    set avatarVisible(val: boolean) {
      avatarManager.setAvatarVisible(val);
    },
    get avatarX() {
      return avatarManager.getAvatarPosition().x;
    },
    set avatarX(val: number) {
      const pos = avatarManager.getAvatarPosition();
      avatarManager.setAvatarPosition(val, pos.y, pos.z);
    },
    get avatarY() {
      return avatarManager.getAvatarPosition().y;
    },
    set avatarY(val: number) {
      const pos = avatarManager.getAvatarPosition();
      avatarManager.setAvatarPosition(pos.x, val, pos.z);
    },
    get avatarZ() {
      return avatarManager.getAvatarPosition().z;
    },
    set avatarZ(val: number) {
      const pos = avatarManager.getAvatarPosition();
      avatarManager.setAvatarPosition(pos.x, pos.y, val);
    },
    get avatarRotDeg() {
      return THREE.MathUtils.radToDeg(avatarManager.getAvatarRotationY());
    },
    set avatarRotDeg(val: number) {
      avatarManager.setAvatarRotationY(THREE.MathUtils.degToRad(val));
    },
    presetFront: () => {
      avatarManager.setAvatarPosition(0, 0, -1.0);
      avatarManager.setAvatarRotationY(0);
      updateAllInspectorsDisplay();
      showToast('👤 股・ウエスト寄りに配置しました (-1.0m)');
    },
    presetClose: () => {
      avatarManager.setAvatarPosition(0, 0, -0.7);
      avatarManager.setAvatarRotationY(0);
      updateAllInspectorsDisplay();
      showToast('👤 胸元アップに配置しました (-0.7m)');
    },
    presetFar: () => {
      avatarManager.setAvatarPosition(0, 0, -1.6);
      avatarManager.setAvatarRotationY(0);
      updateAllInspectorsDisplay();
      showToast('👤 少し引きの位置に配置しました (-1.6m)');
    },
    presetSide: () => {
      avatarManager.setAvatarPosition(0.65, 0, -0.95);
      avatarManager.setAvatarRotationY(-0.3);
      updateAllInspectorsDisplay();
      showToast('👤 アバターを横並びに配置しました');
    },
    presetOrigin: () => {
      avatarManager.setAvatarPosition(0, 0, 0);
      avatarManager.setAvatarRotationY(0);
      updateAllInspectorsDisplay();
      showToast('👤 アバターを原点 (0,0,0) に戻しました');
    },
  };

  panoramaFolder
    .add(panoramaState, 'testClassroom')
    .name(tr.gui.panoramaTestClassroom);

  panoramaFolder
    .add(panoramaState, 'enabled')
    .name(tr.gui.panoramaEnabled)
    .listen()
    .onChange(async (val: boolean) => {
      if (val) {
        if (!panorama.isActive) {
          await panoramaState.testClassroom();
        }
      } else {
        panorama.deactivate();
        ctx.viewerCore.updateBackgroundDisplay(currentConfig);
        ctx.viewerCore.updateMidgroundDisplay(currentConfig);
        showToast('パノラマ表示をOFFにしました');
      }
    });

  panoramaFolder
    .add(panoramaState, 'resetView')
    .name(tr.gui.panoramaReset);

  panoramaFolder
    .add(panoramaState, 'playDemo')
    .name(tr.gui.panoramaDemo);

  // Avatar subfolder in Panorama
  const avatarFolder = panoramaFolder.addFolder(tr.gui.panoramaAvatarFolder);
  avatarFolder.add(panoramaState, 'presetFront').name(tr.gui.panoramaAvatarFront);
  avatarFolder.add(panoramaState, 'presetClose').name(tr.gui.panoramaAvatarClose);
  avatarFolder.add(panoramaState, 'presetFar').name(tr.gui.panoramaAvatarFar);
  avatarFolder.add(panoramaState, 'presetSide').name(tr.gui.panoramaAvatarSide);
  avatarFolder.add(panoramaState, 'presetOrigin').name(tr.gui.panoramaAvatarOrigin);
  avatarFolder.add(panoramaState, 'avatarVisible').name(tr.gui.panoramaAvatarVisible).listen();
  avatarFolder.add(panoramaState, 'avatarX', -5.0, 5.0, 0.05).name(tr.gui.panoramaAvatarX).listen();
  avatarFolder.add(panoramaState, 'avatarY', -2.0, 2.0, 0.05).name(tr.gui.panoramaAvatarY).listen();
  avatarFolder.add(panoramaState, 'avatarZ', -5.0, 5.0, 0.05).name(tr.gui.panoramaAvatarZ).listen();
  avatarFolder.add(panoramaState, 'avatarRotDeg', -180, 180, 1).name(tr.gui.panoramaAvatarRot).listen();
  avatarFolder.open();

  panoramaFolder
    .add(panorama, 'cameraY', 0.2, 2.5, 0.05)
    .name(tr.gui.panoramaCameraY);

  panoramaFolder
    .add(panorama, 'sensitivity', 0.001, 0.01, 0.0005)
    .name(tr.gui.panoramaSensitivity);

  panoramaFolder
    .add(panorama, 'invertDrag')
    .name(tr.gui.panoramaInvertDrag);

  panoramaFolder
    .add(panorama, 'idleMotionEnabled')
    .name(tr.gui.panoramaIdleMotion);

  panoramaFolder
    .add(panorama, 'targetFov', 35, 80, 1)
    .name(tr.gui.panoramaFov)
    .listen();

  panoramaFolder
    .add(panoramaState, 'yawDeg', -180, 180, 1)
    .name(tr.gui.panoramaYaw)
    .listen();

  panoramaFolder
    .add(panoramaState, 'pitchDeg', -80, 80, 1)
    .name(tr.gui.panoramaPitch)
    .listen();

  panoramaFolder.open();

  stageGui.folders.forEach((folder) => {
    if (folder !== panoramaFolder) folder.close();
  });
}

