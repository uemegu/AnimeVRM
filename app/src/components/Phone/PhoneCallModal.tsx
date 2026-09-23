import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SupportedLanguage, resolveLocalizedText } from '../../types/scenario';
import { CallScenario } from '../../types/communication';
import { Avatar } from '../../services/graphics/avatar/Avatar';
import { CHARACTERS } from '../../data/characters';
import { TIME_OF_DAY_PRESETS } from '../../data/timeOfDayPresets';
import { DialogueBox } from '../Dialogue/DialogueBox';
import { ChoiceBox } from '../Dialogue/ChoiceBox';
import './Phone.css';

export interface PhoneCallModalProps {
  scenario: CallScenario;
  lang: SupportedLanguage;
  onClose: (flagsToUpdate?: Record<string, boolean | number | string>, affinityDelta?: Record<string, number>) => void;
}

export const PhoneCallModal: React.FC<PhoneCallModalProps> = ({
  scenario,
  lang,
  onClose,
}) => {
  const [currentStepId, setCurrentStepId] = useState<string>(scenario.initialStepId);
  const [callDurationSec, setCallDurationSec] = useState<number>(0);

  // 蓄積されたフラグと好感度変更
  const accumulatedFlagsRef = useRef<Record<string, boolean | number | string>>({
    [`night_call_completed_day${scenario.day}_${scenario.characterId}`]: true,
  });
  const accumulatedAffinityRef = useRef<Record<string, number>>({});

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const avatarRef = useRef<Avatar | null>(null);

  const step = scenario.steps[currentStepId];
  const char = CHARACTERS[scenario.characterId];
  const charName = char ? resolveLocalizedText(char.name, lang) : scenario.characterId;
  const heroineColor = char?.themeColor || '#38bdf8';

  // 通話タイマー（秒数カウント）
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDurationSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 3D Canvas / Avatar レンダリングセットアップ（室内明設定）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isDisposed = false;
    let animationFrameId: number;

    const scene = new THREE.Scene();
    // 室内明の背景トーン
    scene.background = new THREE.Color(0x1a263d);

    // カメラ: インカメラ風の近接バストアップ（顔中心）
    const aspect = canvas.clientWidth / (canvas.clientHeight || 1);
    const camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 20);
    camera.position.set(0, 1.34, 0.95);
    camera.lookAt(new THREE.Vector3(0, 1.28, 0));

    // レンダラー
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // 室内明のライティング
    const ambientLight = new THREE.AmbientLight(0xfff5eb, 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.8);
    dirLight.position.set(-1.0, 2.0, 2.2);
    scene.add(dirLight);

    const clock = new THREE.Clock();

    const modelUrl = scenario.modelUrl || char?.defaultModelUrl || '/models/aoi/aoi-school.vrm';

    // アバター読み込み
    const avatar = new Avatar({
      id: scenario.characterId,
      modelUrl,
      scene,
    });
    avatarRef.current = avatar;

    avatar.load(modelUrl, '/animations/Standing Idle.fbx').then(() => {
      if (isDisposed) return;
      if (avatar.vrm) {
        avatar.vrm.scene.position.set(0, 0, 0);
        avatar.vrm.scene.visible = true;
      }
      // 室内明（dayプリセット）のマテリアルとアウトラインを適用
      const preset = TIME_OF_DAY_PRESETS.day;
      avatar.updateMaterialPreset(preset.materials, preset.outline);

      if (step?.expression) {
        avatar.setExpression(step.expression, step.expressionWeight ?? 1.0);
      }
    }).catch((err) => {
      console.warn('Phone call avatar load failed:', err);
    });

    const animate = () => {
      if (isDisposed) return;
      const delta = clock.getDelta();
      avatar.update(delta);
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / (h || 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      avatar.dispose();
      renderer.dispose();
      avatarRef.current = null;
    };
  }, [scenario.characterId, scenario.modelUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // セリフステップ変更時の表情更新
  useEffect(() => {
    if (avatarRef.current && step?.expression) {
      avatarRef.current.setExpression(step.expression, step.expressionWeight ?? 1.0);
    }
  }, [step?.expression, step?.expressionWeight]);

  // 通常会話と同じクリック進行
  const handleDialogueClick = () => {
    if (!step) return;

    // 選択肢表示中はクリック進行不可
    if (step.choices && step.choices.length > 0) {
      return;
    }

    if (step.nextStepId) {
      setCurrentStepId(step.nextStepId);
    } else {
      // 全ステップ完了 -> 通話終了
      onClose(accumulatedFlagsRef.current, accumulatedAffinityRef.current);
    }
  };

  // 通常選択肢と同じ選択ハンドラー
  const handleChoiceSelect = (choiceIndex: number) => {
    if (!step?.choices || !step.choices[choiceIndex]) return;
    const choice = step.choices[choiceIndex];

    if (choice.setFlags) {
      Object.assign(accumulatedFlagsRef.current, choice.setFlags);
    }
    if (choice.addAffinity) {
      for (const [key, val] of Object.entries(choice.addAffinity)) {
        accumulatedAffinityRef.current[key] = (accumulatedAffinityRef.current[key] || 0) + val;
      }
    }
    setCurrentStepId(choice.goto);
  };

  // 選択肢用データ変換
  const formattedChoices = step?.choices?.map((c) => ({
    text: resolveLocalizedText(c.text, lang),
    goto: c.goto,
  }));

  return (
    <div className="phone-modal-overlay">
      {/* スマホ本体フレーム（下から上へスライドイン） */}
      <div
        className="phone-device-frame"
        style={{ '--heroine-color': heroineColor } as React.CSSProperties}
      >
        {/* Dynamic Island / Top Notch */}
        <div className="phone-screen-notch">
          <div className="phone-notch-lens" />
        </div>

        {/* Top Status Bar */}
        <div className="phone-status-bar">
          <span className="phone-status-left">23:42</span>
          <div className="phone-status-right">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98A16.88 16.88 0 0 0 12 4z" />
            </svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" />
            </svg>
          </div>
        </div>

        {/* TV Call Screen Container */}
        <div className="phone-call-container">
          {/* 3D Stage (Avatar closeup) */}
          <div className="phone-call-canvas-area">
            <canvas ref={canvasRef} className="phone-call-canvas" />
          </div>

          {/* CRT / Display Scanline Effects */}
          <div className="phone-call-display-effects" />

          {/* Top Header: Heroine Name & Call Timer */}
          <div className="phone-call-top-header">
            <h3 className="phone-call-target-name">{charName}</h3>
            <span className="phone-call-timer">{formatTime(callDurationSec)}</span>
          </div>

          {/* Call Control Bar (通話中UIの装飾表示・操作不要) */}
          <div className="phone-call-control-bar" style={{ marginTop: 'auto' }}>
            <div className="phone-control-btn" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </div>

            <div className="phone-control-btn btn-hangup" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
              </svg>
            </div>

            <div className="phone-control-btn" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Bottom Home Indicator */}
        <div className="phone-home-indicator" />
      </div>

      {/* 通常会話と同じセリフ表示 (DialogueBox: 選択肢表示中やセリフなし時は非表示) */}
      {step && resolveLocalizedText(step.text, lang) && (!formattedChoices || formattedChoices.length === 0) && (
        <DialogueBox
          speaker={resolveLocalizedText(step.speaker, lang)}
          text={resolveLocalizedText(step.text, lang)}
          onClick={handleDialogueClick}
        />
      )}

      {/* 通常の選択肢と同じ選択肢表示 (ChoiceBox) */}
      {formattedChoices && formattedChoices.length > 0 && (
        <ChoiceBox
          choices={formattedChoices}
          onSelect={handleChoiceSelect}
        />
      )}
    </div>
  );
};
