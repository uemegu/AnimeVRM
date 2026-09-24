import { useCallback, useEffect, useRef, useState } from 'react';
import { ScenarioPackage } from '../types/scenario';
import { ScenarioEngine, ScenarioResolvedScene } from '../services/scenario/ScenarioEngine';
import { soundManager } from '../services/audio/SoundManager';
import { useLanguage } from '../contexts/LanguageContext';
import { EMPTY_STAGE, StageState, initialStageState, mergeStageState } from '../services/stage/sceneView';

/** シナリオ進行の通知（ゲーム状態への反映は呼び出し側で行う） */
export interface ScenarioProgress {
  scenario: ScenarioPackage;
  flags: Record<string, boolean | number | string>;
  affinities: Record<string, number>;
  /** テキスト送りでシナリオが終わった */
  finished: boolean;
  /** 選択肢を選んだ場合のID（ID未指定の選択肢は goto 先シーンID） */
  choiceId?: string;
}

interface ScenarioPlayerOptions {
  onProgress: (progress: ScenarioProgress) => void;
}

/** ボイスなしのシーンで AUTO 送りするまでの秒数（読書速度: 1.2s + 文字数 * 0.055s を 2.0〜6.0s にクランプ） */
function readingDelaySec(text: string): number {
  return Math.max(2.0, Math.min(6.0, 1.2 + text.length * 0.055));
}

/**
 * シナリオ1本の再生（テキスト送り・選択肢・AUTO送り・シーンごとのボイス/SE）を担う。
 * ルートの ScenarioEngine（handleVoiceEnded / handleTypingComplete / setAutoMode）準拠の AUTO 送り。
 */
export function useScenarioPlayer({ onProgress }: ScenarioPlayerOptions) {
  const { lang } = useLanguage();
  const [scenario, setScenario] = useState<ScenarioPackage | null>(null);
  const [engine, setEngine] = useState<ScenarioEngine | null>(null);
  const [, setRevision] = useState(0);
  const [isAuto, setIsAuto] = useState(false);
  // 背景・時間帯・BGM・登場キャラ（シーンをまたいで引き継ぐ）
  const [stage, setStage] = useState<StageState>(EMPTY_STAGE);

  // エンジンは可変オブジェクトなので、進めたら再描画を要求する
  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  const currentScene: ScenarioResolvedScene | null = engine ? engine.getCurrentScene() : null;
  const isFinished = engine ? engine.isFinished() : true;
  const isWaitingChoice = engine ? engine.isWaitingForChoice() : false;

  // タイマーやボイス終了通知など非同期に呼ばれる処理が常に最新の状態を読むための参照
  const latest = useRef({ scenario, engine, currentScene, isFinished, isWaitingChoice, isAuto, onProgress });
  latest.current = { scenario, engine, currentScene, isFinished, isWaitingChoice, isAuto, onProgress };

  const autoTimerRef = useRef<number | null>(null);
  const isTypingCompletedRef = useRef(false);

  const clearAutoTimer = useCallback(() => {
    if (autoTimerRef.current !== null) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  const start = useCallback(
    (next: ScenarioPackage, flags: ScenarioProgress['flags'], affinities: ScenarioProgress['affinities']) => {
      const nextEngine = new ScenarioEngine(next, flags, affinities, lang);
      const firstScene = nextEngine.getRawScene();
      const initial = initialStageState(next);
      setScenario(next);
      setEngine(nextEngine);
      setStage(firstScene ? mergeStageState(initial, firstScene) : initial);
    },
    [lang]
  );

  const stop = useCallback(() => {
    clearAutoTimer();
    setScenario(null);
    setEngine(null);
    setStage(EMPTY_STAGE);
  }, [clearAutoTimer]);

  /** エンジンを進めた後、新しいシーンの指定を舞台に反映して再描画する */
  const applySceneChange = useCallback(
    (engine: ScenarioEngine) => {
      const scene = engine.getRawScene();
      if (scene) setStage((prev) => mergeStageState(prev, scene));
      refresh();
    },
    [refresh]
  );

  /** テキスト送り */
  const advance = useCallback(() => {
    const { engine, scenario, isWaitingChoice, isFinished, onProgress } = latest.current;
    if (!engine || !scenario || isWaitingChoice || isFinished) return;

    const finished = engine.next();
    applySceneChange(engine);
    onProgress({ scenario, flags: engine.getFlags(), affinities: engine.getAffinities(), finished });
  }, [applySceneChange]);

  /** 選択肢の選択 */
  const choose = useCallback(
    (index: number) => {
      const { engine, scenario, onProgress } = latest.current;
      // 選択肢待ちでなければ無視（タイムアウトとクリックが重なった場合など）
      if (!engine || !scenario || !engine.isWaitingForChoice()) return;

      engine.choose(index);
      applySceneChange(engine);
      onProgress({
        scenario,
        flags: engine.getFlags(),
        affinities: engine.getAffinities(),
        finished: false,
        choiceId: engine.getLastSelectedChoiceId() ?? undefined,
      });
    },
    [applySceneChange]
  );

  /** 選択肢の時間切れ（シーンの choiceTimeout に従う） */
  const timeoutChoice = useCallback(() => {
    const { engine, scenario, onProgress } = latest.current;
    if (!engine || !scenario || !engine.isWaitingForChoice()) return;

    const choiceId = engine.timeout();
    applySceneChange(engine);
    onProgress({
      scenario,
      flags: engine.getFlags(),
      affinities: engine.getAffinities(),
      finished: false,
      choiceId: choiceId ?? undefined,
    });
  }, [applySceneChange]);

  const scheduleAdvance = useCallback(
    (delaySec: number) => {
      autoTimerRef.current = window.setTimeout(advance, delaySec * 1000);
    },
    [advance]
  );

  /** ボイス再生終了: AUTO 中なら余韻（既定 0.6 秒）を置いて送る */
  const handleVoiceEnded = useCallback(() => {
    clearAutoTimer();
    const { isAuto, isWaitingChoice, isFinished, currentScene } = latest.current;
    if (isAuto && !isWaitingChoice && !isFinished) {
      scheduleAdvance(currentScene?.autoNextSec ?? 0.6);
    }
  }, [clearAutoTimer, scheduleAdvance]);

  /** タイピング演出の完了: ボイス再生中はボイス終了に任せ、それ以外は読書速度ぶん待って送る */
  const handleTypingComplete = useCallback(() => {
    isTypingCompletedRef.current = true;
    clearAutoTimer();
    const { isAuto, isWaitingChoice, isFinished, currentScene } = latest.current;
    if (!isAuto || isWaitingChoice || isFinished) return;

    const hasVoice = Boolean(currentScene?.voiceUrl);
    if (hasVoice && soundManager.isVoicePlaying()) return;

    scheduleAdvance(currentScene?.autoNextSec ?? (hasVoice ? 0.8 : readingDelaySec(currentScene?.text ?? '')));
  }, [clearAutoTimer, scheduleAdvance]);

  /** AUTO 切り替え: ONにした時点で文字表示済み・ボイス再生なしなら、すぐ送りを予約する */
  const toggleAuto = useCallback(() => {
    clearAutoTimer();
    const { isAuto, isWaitingChoice, isFinished, currentScene } = latest.current;
    const nextAuto = !isAuto;
    latest.current.isAuto = nextAuto;
    setIsAuto(nextAuto);

    if (!nextAuto || isWaitingChoice || isFinished || !currentScene) return;
    const isVoicePlaying = Boolean(currentScene.voiceUrl && soundManager.isVoicePlaying());
    if (!isVoicePlaying && isTypingCompletedRef.current) {
      scheduleAdvance(currentScene.autoNextSec ?? 0.8);
    }
  }, [clearAutoTimer, scheduleAdvance]);

  useEffect(() => {
    soundManager.setVoiceEndedHandler(handleVoiceEnded);
  }, [handleVoiceEnded]);

  // 言語切り替えを再生中のシナリオに反映
  useEffect(() => {
    if (engine && engine.getLanguage() !== lang) {
      engine.setLanguage(lang);
      refresh();
    }
  }, [engine, lang, refresh]);

  // シーン切り替え: AUTO 待ちをリセットし、シーンのボイス・SE を鳴らす
  useEffect(() => {
    isTypingCompletedRef.current = false;
    clearAutoTimer();

    const scene = latest.current.currentScene;
    if (!scene) {
      soundManager.stopVoice();
      return;
    }
    if (scene.seUrl) soundManager.playSe(scene.seUrl);
    if (scene.voiceUrl) {
      soundManager.playVoice(scene.voiceUrl, scene.text);
    } else {
      soundManager.stopVoice();
    }
  }, [scenario?.id, currentScene?.id, currentScene?.voiceUrl, currentScene?.seUrl, clearAutoTimer]);

  useEffect(() => clearAutoTimer, [clearAutoTimer]);

  return {
    scenario,
    currentScene,
    stage,
    isFinished,
    isWaitingChoice,
    isAuto,
    start,
    stop,
    advance,
    choose,
    timeoutChoice,
    toggleAuto,
    handleTypingComplete,
  };
}
