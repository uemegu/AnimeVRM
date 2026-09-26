import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameState, ActionLocationId, DayPhase } from './types/game';
import { ScenarioIndexEntry, ScenarioPackage, resolveLocalizedText } from './types/scenario';
import { CommunicationResult } from './types/communication';
import { ScheduleManager } from './services/schedule/ScheduleManager';
import { SaveService } from './services/save/SaveService';
import { scenarioRepository } from './services/scenario/ScenarioRepository';
import { soundManager } from './services/audio/SoundManager';
import { AssetPreloader } from './services/loader/AssetPreloader';
import { ShareService } from './services/share/ShareService';
import {
  resolveCameraShot,
  resolveCast,
  resolveLocationId,
  resolveScrollingBackground,
  resolveTimeOfDay,
} from './services/stage/sceneView';
import { getLocationName } from './data/locations';
import { useLanguage } from './contexts/LanguageContext';
import { useScenarioPlayer, ScenarioProgress } from './hooks/useScenarioPlayer';
import { useDialogueHistory } from './hooks/useDialogueHistory';
import { useConfirmDialog } from './hooks/useConfirmDialog';

import { GameHeader } from './components/Header/GameHeader';
import { ConfirmModal } from './components/Common/ConfirmModal';
import { LicenseModal } from './components/License/LicenseModal';
import { SaveLoadModal } from './components/SaveLoad/SaveLoadModal';
import { HistoryModal } from './components/Dialogue/HistoryModal';
import { InterludeOverlay, InterludeOverlayHandle } from './components/Common/InterludeOverlay';
import { ShareToast } from './components/Common/ShareToast';
import { LoadingScreen } from './components/Loading/LoadingScreen';

import {
  TitlePage,
  ScenarioPage,
  ActionSelectPage,
  NightRoomPage,
  EndingPage,
} from './pages';

const ACTION_PHASES: DayPhase[] = ['morning_action', 'lunch_action', 'afterschool_action', 'holiday_action'];
const GOD_EXPERIMENT_SCENARIO_ID = 'god_prologue_experiment';

/** 夜の電話・メールの結果をゲーム状態に反映（フラグ・好感度を加算し、選択と完了を履歴に残す） */
function applyCommunicationResult(state: GameState, result: CommunicationResult): GameState {
  const affinities = { ...state.affinities };
  for (const [charId, delta] of Object.entries(result.affinityDelta)) {
    affinities[charId] = (affinities[charId] || 0) + delta;
  }
  const scenarioHistory = [
    ...(state.scenarioHistory ?? []),
    ...result.choiceIds.map((choiceId) => ({ scenarioId: result.id, day: state.day, type: 'choice' as const, choiceId })),
    { scenarioId: result.id, day: state.day, type: 'completed' as const },
  ];
  return { ...state, flags: { ...state.flags, ...result.flags }, affinities, scenarioHistory };
}

/** シナリオ進行の結果をゲーム状態に反映（フラグ・好感度・選択/完了履歴） */
function applyScenarioProgress(state: GameState, progress: ScenarioProgress): GameState {
  const scenarioHistory = [...(state.scenarioHistory ?? [])];
  const scenarioId = progress.scenario.id;
  if (progress.choiceId) {
    scenarioHistory.push({ scenarioId, day: state.day, type: 'choice', choiceId: progress.choiceId });
  }
  if (progress.finished) {
    scenarioHistory.push({ scenarioId, day: state.day, type: 'completed' });
  }
  return { ...state, flags: progress.flags, affinities: progress.affinities, scenarioHistory };
}

export const App: React.FC = () => {
  const { lang } = useLanguage();
  const saveService = useMemo(() => new SaveService(), []);
  const history = useDialogueHistory();
  const { dialogProps, showNotice, showConfirm } = useConfirmDialog();

  // URLクエリパラメータによるテスト・開発用初期フェーズ指定
  const initialPhaseParam = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('phase');
    } catch {
      return null;
    }
  }, []);

  const initialScenarioParam = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('scenario');
    } catch {
      return null;
    }
  }, []);

  // 初回アセット事前読み込み画面フラグ
  const [isInitialLoading, setIsInitialLoading] = useState(() => !initialPhaseParam && !initialScenarioParam);
  // タイトル画面表示フラグ
  const [isTitleScreen, setIsTitleScreen] = useState(() => !initialPhaseParam && !initialScenarioParam);
  // セーブデータ存在フラグ
  const [hasSaveData, setHasSaveData] = useState(() => saveService.hasSaveData());
  // ライセンス・クレジットモーダル表示フラグ
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  // セーブ/ロード 複数スロットモーダル状態
  const [saveLoadModalState, setSaveLoadModalState] = useState<{ isOpen: boolean; mode: 'save' | 'load' }>({
    isOpen: false,
    mode: 'save',
  });
  // 会話履歴（バックログ）モーダル表示フラグ
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // ゲーム全体の状態
  const [gameState, setGameState] = useState<GameState>(() => {
    const initial = ScheduleManager.createInitialState();
    if (initialPhaseParam === 'night') {
      initial.phase = 'night';
      initial.currentScenarioId = null;
    }
    if (initialPhaseParam === 'holiday') {
      // 動作確認用: 最初の土曜日の休日行動から開始
      initial.day = 6;
      initial.phase = 'holiday_action';
      initial.currentScenarioId = null;
    }
    if (initialScenarioParam) {
      initial.day = 21;
      initial.phase = 'afterschool_action';
      initial.flags = {
        ...initial.flags,
        aoi_t10_promise: true,
        confessed: true,
        confession_sincere: true,
      };
      initial.affinities = {
        ...initial.affinities,
        aoi: 30,
      };
      initial.currentScenarioId = initialScenarioParam;
    }
    return initial;
  });
  // 非同期の進行処理（幕間の後など）から最新の状態を読むための参照
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // 行動場所選択モーダル表示フラグ
  const [isSelectingLocation, setIsSelectingLocation] = useState(() => initialPhaseParam === 'holiday');
  const [selectedLocationId, setSelectedLocationId] = useState<ActionLocationId | null>(null);
  // エンディング画面の表示フラグと、到達したエンディングのタイトル
  const [isGameEnded, setIsGameEnded] = useState(false);
  const [endingTitle, setEndingTitle] = useState<string | null>(null);

  // シェア中フラグおよびトーストメッセージ
  const [isSharing, setIsSharing] = useState(false);
  const [shareToastMessage, setShareToastMessage] = useState('');
  const [shareToastAction, setShareToastAction] = useState<{ label: string; onClick: () => void } | undefined>(
    undefined
  );

  // 幕間スライストランジション ref
  const interludeRef = useRef<InterludeOverlayHandle>(null);

  /** シナリオ等の読み込みに失敗したときのお知らせ */
  const handleDataLoadError = useCallback(
    (error: unknown) => {
      console.error('Failed to load data:', error);
      showNotice(
        lang === 'ja' ? 'データの読み込みに失敗しました。' : 'Failed to load data.',
        lang === 'ja' ? 'エラー' : 'Error'
      );
    },
    [lang, showNotice]
  );

  /** 幕間演出で画面を覆っている間に run を実行する。失敗したらお知らせを出す */
  const playInterlude = useCallback(
    (run: () => Promise<void> | void, options?: { title?: string; subtitle?: string }) => {
      const guarded = async () => {
        try {
          await run();
        } catch (err) {
          handleDataLoadError(err);
        }
      };
      if (interludeRef.current) {
        interludeRef.current.playTransition({ ...options, onCovered: guarded });
      } else {
        guarded();
      }
    },
    [handleDataLoadError]
  );

  // シナリオ進行の反映と、シナリオ終了後のフェーズ遷移（handleScenarioFinished は後で定義するため参照経由）
  const handleScenarioFinishedRef = useRef<(scenario: ScenarioPackage, state: GameState) => Promise<void>>(null);
  const handleScenarioProgress = useCallback(
    (progress: ScenarioProgress) => {
      const updated = applyScenarioProgress(gameStateRef.current, progress);
      gameStateRef.current = updated;
      setGameState(updated);
      if (progress.finished) {
        playInterlude(() => handleScenarioFinishedRef.current?.(progress.scenario, updated));
      }
    },
    [playInterlude]
  );

  const player = useScenarioPlayer({ onProgress: handleScenarioProgress });
  const { currentScene, isFinished, isWaitingChoice } = player;

  // 何を映すか（時間帯・場所・キャラ）
  const { stage } = player;
  const activeTimeOfDay = resolveTimeOfDay(gameState.phase, stage);
  const activeLocationId = resolveLocationId({
    phase: gameState.phase,
    stage,
    scenario: player.scenario,
    selectedLocationId,
  });
  const activeLocationName = getLocationName(activeLocationId, lang);
  const cast = useMemo(() => resolveCast(stage, currentScene, gameState.phase), [stage, currentScene, gameState.phase]);
  const cameraShot = resolveCameraShot(currentScene, cast);
  const scrolling = useMemo(() => resolveScrollingBackground(stage, activeLocationId), [stage, activeLocationId]);

  // タイトル画面・進行フェーズ・シーンに応じたBGM（シーン個別指定があればそれを優先）
  useEffect(() => {
    if (isInitialLoading) return;
    if (isTitleScreen) {
      soundManager.playBgm('main_theme');
      return;
    }
    const phaseBgm = gameState.phase === 'night' && !isGameEnded ? 'night_room' : 'main_bgm';
    const bgm = stage.bgm ?? phaseBgm;
    if (bgm === 'silence') {
      soundManager.stopBgm();
    } else {
      soundManager.playBgm(bgm);
    }
  }, [isInitialLoading, isTitleScreen, gameState.phase, isGameEnded, currentScene?.id, stage.bgm]);

  // 会話履歴（直近3セッション）の自動記録
  const historyKey = {
    day: gameState.day,
    phase: gameState.phase,
    scenarioId: player.scenario?.id,
    locationName: activeLocationName,
  };
  const { recordLine, recordChoice } = history;
  useEffect(() => {
    if (!player.scenario || !currentScene || isTitleScreen || isInitialLoading) return;
    if (!currentScene.text || currentScene.text.trim() === '') return;
    recordLine(historyKey, { speaker: currentScene.speaker, text: currentScene.text, voiceUrl: currentScene.voiceUrl });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    player.scenario?.id,
    currentScene?.id,
    currentScene?.text,
    currentScene?.speaker,
    currentScene?.voiceUrl,
    gameState.day,
    gameState.phase,
    activeLocationName,
    isTitleScreen,
    isInitialLoading,
    recordLine,
  ]);

  // 初回ロード開始時のオーディオアンロック処理
  const handleStartPreload = useCallback(() => {
    soundManager.unlockAudio();
  }, []);

  // 初回ロード完了時
  const handlePreloadComplete = useCallback(() => {
    setIsInitialLoading(false);
  }, []);

  /** シナリオ本文を読み込み、舞台の背景・ボイスを事前読み込みする */
  const loadScenario = useCallback(async (entry: ScenarioIndexEntry, locationId?: string) => {
    const scenario = await scenarioRepository.load(entry.id);
    const phase = entry.category === 'holiday' ? 'holiday_action' : entry.category === 'morning' ? 'morning' : undefined;
    await AssetPreloader.preloadSceneAssets(locationId ?? entry.location, scenario, { phase });
    return scenario;
  }, []);

  const { start: startPlayer, stop: stopPlayer, choose, toggleAuto } = player;

  /** シナリオ再生を開始し、ゲーム状態に現在のシナリオを記録する */
  const startScenario = useCallback(
    (scenario: ScenarioPackage, state: GameState) => {
      startPlayer(scenario, state.flags, state.affinities);
      setGameState({ ...state, currentScenarioId: scenario.id });
    },
    [startPlayer]
  );

  // URLクエリパラメータ指定による直接シナリオ再生（テスト・検証用）
  useEffect(() => {
    if (!initialScenarioParam) return;
    const entry = scenarioRepository.get(initialScenarioParam);
    if (!entry) {
      console.error(`Scenario not found: ${initialScenarioParam}`);
      return;
    }
    loadScenario(entry).then((scenario) => {
      startScenario(scenario, gameStateRef.current);
    }).catch((err) => {
      console.error('Failed to load initial scenario:', err);
    });
  }, [initialScenarioParam, loadScenario, startScenario]);

  // 行動ターン開始（強制割り込みイベントがあればそれを再生、なければ場所選択へ）
  const proceedToActionPhase = useCallback(
    async (targetPhase: DayPhase, state: GameState) => {
      const updatedState: GameState = { ...state, phase: targetPhase, currentScenarioId: null };
      const forced = ScheduleManager.checkForcedInterruption(updatedState);
      if (forced) {
        startScenario(await loadScenario(forced), updatedState);
      } else {
        stopPlayer();
        setGameState(updatedState);
        setIsSelectingLocation(true);
      }
    },
    [loadScenario, startScenario, stopPlayer]
  );

  // 1日の開始（平日は朝の登校イベント、休日は昼の行き先選択から）
  const beginDay = useCallback(
    async (state: GameState) => {
      setIsSelectingLocation(false);
      if (state.phase === 'holiday_action') {
        await proceedToActionPhase('holiday_action', state);
        return;
      }
      startScenario(await loadScenario(ScheduleManager.getMorningScenario(state)), state);
    },
    [proceedToActionPhase, loadScenario, startScenario]
  );

  // シナリオ終了後: 朝 → 午前行動、行動シナリオ → 次のフェーズ（強制イベント後は同じフェーズの場所選択へ）
  const handleScenarioFinished = useCallback(
    async (scenario: ScenarioPackage, state: GameState) => {
      // エンディングを見終えたらエンディング画面へ
      if (scenarioRepository.get(scenario.id)?.category === 'ending') {
        stopPlayer();
        setEndingTitle(resolveLocalizedText(scenario.title, lang));
        setIsGameEnded(true);
        return;
      }
      // 決着のシナリオでエンディングの条件がそろったら、そのエンディングを再生する
      const ending = ScheduleManager.getEndingScenario(state);
      if (ending) {
        startScenario(await loadScenario(ending), state);
        return;
      }

      if (state.phase === 'morning') {
        await proceedToActionPhase('morning_action', state);
        return;
      }
      if (!ACTION_PHASES.includes(state.phase)) return;

      const entry = scenarioRepository.get(scenario.id);
      if (entry?.category === 'forced' && !entry.consumesTurn) {
        stopPlayer();
        setIsSelectingLocation(true);
        return;
      }

      const nextPhase = ScheduleManager.getNextPhase(state.phase);
      if (nextPhase === 'night') {
        await AssetPreloader.preloadSceneAssets('myroom');
        stopPlayer();
        setGameState({ ...state, phase: 'night', currentScenarioId: null });
      } else {
        await proceedToActionPhase(nextPhase, state);
      }
    },
    [proceedToActionPhase, stopPlayer, startScenario, loadScenario, lang]
  );
  handleScenarioFinishedRef.current = handleScenarioFinished;

  // 選択肢の選択（履歴に記録してから進める）
  const handleChoiceClick = useCallback(
    (index: number) => {
      const chosen = currentScene?.choices?.[index];
      if (chosen) recordChoice(historyKey, chosen.text);
      choose(index);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentScene, recordChoice, choose, gameState.day, gameState.phase, activeLocationName]
  );

  // 場所を選択したとき
  const handleSelectLocation = useCallback(
    (locationId: ActionLocationId) => {
      playInterlude(async () => {
        const state = gameStateRef.current;
        const scenario = await loadScenario(ScheduleManager.getScenarioForLocation(locationId, state), locationId);
        setSelectedLocationId(locationId);
        setIsSelectingLocation(false);
        startScenario(scenario, state);
      });
    },
    [playInterlude, loadScenario, startScenario]
  );

  // Xシェア実行ハンドラ
  const handleShare = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const dialogueInfo =
        currentScene && currentScene.text && !currentScene.choices
          ? { speaker: currentScene.speaker, text: currentScene.text }
          : undefined;

      const result = await ShareService.shareToX({
        day: gameState.day,
        phase: gameState.phase,
        locationName: isSelectingLocation ? undefined : activeLocationName,
        lang,
        dialogue: dialogueInfo,
      });

      if (result.message) {
        setShareToastMessage(result.message);
      }

      if (result.tweetUrl) {
        setShareToastAction({
          label: lang === 'ja' ? '今すぐ開く' : 'Open now',
          onClick: () => {
            window.open(result.tweetUrl, '_blank', 'noopener,noreferrer');
          },
        });
      } else {
        setShareToastAction(undefined);
      }
    } catch {
      setShareToastMessage(lang === 'ja' ? 'シェア処理に失敗しました' : 'Failed to share');
      setShareToastAction(undefined);
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, gameState.day, gameState.phase, isSelectingLocation, activeLocationName, lang, currentScene]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'a' || e.key === 'A') {
        if (!isWaitingChoice && !isSelectingLocation && !isTitleScreen) {
          toggleAuto();
        }
      } else if (e.key === 'm' || e.key === 'M') {
        soundManager.toggleMuted();
      } else if (e.key === 'l' || e.key === 'L' || e.key === 'h' || e.key === 'H') {
        if (!isTitleScreen) {
          setIsHistoryModalOpen((prev) => !prev);
        }
      } else if (e.key === 's' || e.key === 'S') {
        if (!isTitleScreen) {
          handleShare();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWaitingChoice, isSelectingLocation, isTitleScreen, toggleAuto, handleShare]);

  // スロット選択モーダルでのスロット決定
  const handleSelectSlot = useCallback(
    (slotId: number) => {
      const ja = lang === 'ja';
      if (saveLoadModalState.mode === 'save') {
        showConfirm({
          title: ja ? `スロット ${slotId} にセーブ` : `Save to Slot ${slotId}`,
          message: ja
            ? `スロット ${slotId} に現在の進行状況をセーブしますか？\n（※既存のデータがある場合は上書きされます）`
            : `Save current progress to Slot ${slotId}?\n(Existing data in this slot will be overwritten)`,
          confirmText: ja ? 'はい' : 'YES',
          cancelText: ja ? 'いいえ' : 'NO',
          onConfirm: () => {
            if (saveService.saveGame(gameState, slotId)) {
              setHasSaveData(true);
              setSaveLoadModalState((prev) => ({ ...prev, isOpen: false }));
              showNotice(
                ja ? `スロット ${slotId} にセーブしました。` : `Saved successfully to Slot ${slotId}.`,
                ja ? 'セーブ完了' : 'Save Completed'
              );
            } else {
              showNotice(ja ? 'セーブに失敗しました。' : 'Failed to save game.', ja ? 'エラー' : 'Error');
            }
          },
        });
        return;
      }

      const slotData = saveService.loadGame(slotId);
      if (!slotData) {
        showNotice(
          ja ? '指定されたスロットにセーブデータがありません。' : 'No save data found in this slot.',
          ja ? 'お知らせ' : 'Notice'
        );
        return;
      }

      showConfirm({
        title: ja ? `スロット ${slotId} をロード` : `Load Slot ${slotId}`,
        message: ja
          ? `スロット ${slotId}（Day ${slotData.gameState.day}）をロードしますか？\n（※現在の進行状況は破棄されます）`
          : `Load Slot ${slotId} (Day ${slotData.gameState.day})?\n(Current progress will be lost)`,
        confirmText: ja ? 'はい' : 'YES',
        cancelText: ja ? 'いいえ' : 'NO',
        onConfirm: () => {
          setSaveLoadModalState((prev) => ({ ...prev, isOpen: false }));
          playInterlude(async () => {
            const state = slotData.gameState;
            // 朝は登校イベントから、夜は自室から、行動フェーズは場所選択から再開する
            const morningScenario =
              state.phase === 'morning' ? await loadScenario(ScheduleManager.getMorningScenario(state)) : null;
            if (state.phase === 'night') await AssetPreloader.preloadSceneAssets('myroom');

            setGameState(state);
            setIsGameEnded(false);
            setIsTitleScreen(false);
            setIsSelectingLocation(state.phase !== 'night' && state.phase !== 'morning');
            if (morningScenario) {
              startScenario(morningScenario, state);
            } else {
              stopPlayer();
            }

            showNotice(
              ja ? `スロット ${slotId} をロードしました。` : `Slot ${slotId} Loaded successfully.`,
              ja ? 'ロード完了' : 'Load Completed'
            );
          });
        },
      });
    },
    [saveLoadModalState.mode, gameState, lang, saveService, showConfirm, showNotice, playInterlude, loadScenario, startScenario, stopPlayer]
  );

  // 自室コマンド: 1日やり直し
  const handleRollbackDay = useCallback(() => {
    const ja = lang === 'ja';
    showConfirm({
      title: ja ? 'やり直し' : 'Restart Day',
      message: ja
        ? 'この1日の始めに戻ってやり直しますか？\n（本日の進行内容はリセットされます）'
        : "Restart from this morning?\n(Today's progress will be reset)",
      confirmText: ja ? 'はい' : 'YES',
      cancelText: ja ? 'いいえ' : 'NO',
      onConfirm: () => {
        playInterlude(async () => {
          const rolledBack = ScheduleManager.rollbackToday(gameStateRef.current);
          const isHolidayStart = rolledBack.phase === 'holiday_action';
          await beginDay(rolledBack);
          showNotice(
            ja
              ? `第${rolledBack.day}日の${isHolidayStart ? '昼' : '朝'}に戻りました。`
              : `Restarted from Day ${rolledBack.day} ${isHolidayStart ? 'Noon' : 'Morning'}.`,
            ja ? '1日のやり直し' : 'Day Restarted'
          );
        });
      },
    });
  }, [lang, beginDay, playInterlude, showConfirm, showNotice]);

  // 自室コマンド: 就寝（翌日へ。平日は朝、休日は昼から）
  const handleSleep = useCallback(() => {
    playInterlude(async () => {
      const { nextState, isEnding } = ScheduleManager.advanceToNextDay(gameStateRef.current);
      if (isEnding) {
        setEndingTitle(null);
        setIsGameEnded(true);
        stopPlayer();
        return;
      }
      saveService.saveDayStartBackup(nextState.dayStartSnapshot!);
      await beginDay(nextState);
    });
  }, [playInterlude, saveService, beginDay, stopPlayer]);

  // タイトル画面: はじめから
  const handleStartGame = useCallback(() => {
    playInterlude(async () => {
      const initial = ScheduleManager.createInitialState();
      saveService.saveDayStartBackup(initial.dayStartSnapshot!);
      await beginDay(initial);
      setIsGameEnded(false);
      setIsTitleScreen(false);
    });
  }, [playInterlude, saveService, beginDay]);

  // タイトル画面: 神社・女神実験シナリオ開始
  const handleStartGodExperiment = useCallback(() => {
    playInterlude(
      async () => {
        const entry = scenarioRepository.get(GOD_EXPERIMENT_SCENARIO_ID);
        if (!entry) throw new Error(`Scenario not found: ${GOD_EXPERIMENT_SCENARIO_ID}`);
        const scenario = await loadScenario(entry);
        setIsGameEnded(false);
        setIsSelectingLocation(false);
        setIsTitleScreen(false);
        startScenario(scenario, ScheduleManager.createInitialState());
      },
      { title: lang === 'ja' ? '女神の宣告' : 'Goddess Confession', subtitle: 'GODDESS EXPERIMENT' }
    );
  }, [lang, playInterlude, loadScenario, startScenario]);

  // タイトル画面へ戻る
  const handleReturnToTitle = useCallback(() => {
    setIsTitleScreen(true);
    setIsGameEnded(false);
    stopPlayer();
    setIsSelectingLocation(false);
    setHasSaveData(saveService.hasSaveData());
  }, [saveService, stopPlayer]);

  const openSaveLoad = useCallback((mode: 'save' | 'load') => setSaveLoadModalState({ isOpen: true, mode }), []);

  // 今夜届く電話・メール
  const nightCommunications = useMemo(
    () => (gameState.phase === 'night' ? ScheduleManager.getNightCommunications(gameState) : []),
    [gameState]
  );

  // 場所候補一覧（ScheduleManager経由でシナリオデータから取得）
  const locationOptions = useMemo(() => ScheduleManager.getActionLocationOptions(gameState), [gameState]);

  // スロット一覧の構築
  const saveSlots = useMemo(() => {
    return saveService.getAllSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveService, saveLoadModalState.isOpen, hasSaveData]);

  return (
    <div className="game-container">
      {isInitialLoading ? (
        <LoadingScreen onStartLoading={handleStartPreload} onComplete={handlePreloadComplete} />
      ) : isTitleScreen ? (
        <TitlePage
          hasSaveData={hasSaveData}
          onStartGame={handleStartGame}
          onContinueGame={() => openSaveLoad('load')}
          onStartGodExperiment={handleStartGodExperiment}
          onOpenLicense={() => setIsLicenseModalOpen(true)}
        />
      ) : isGameEnded ? (
        <EndingPage affinities={gameState.affinities} endingTitle={endingTitle} onRestart={handleReturnToTitle} />
      ) : (
        <>
          {/* 上部ヘッダー */}
          <GameHeader
            day={gameState.day}
            phase={gameState.phase}
            locationName={isSelectingLocation ? undefined : activeLocationName}
            isAuto={player.isAuto}
            onToggleAuto={toggleAuto}
            onOpenHistory={() => setIsHistoryModalOpen(true)}
            onShare={handleShare}
            isSharing={isSharing}
          />

          {/* 各ページ表示切り替え */}
          {gameState.phase === 'night' ? (
            <NightRoomPage
              day={gameState.day}
              affinities={gameState.affinities}
              communications={nightCommunications}
              onSave={() => openSaveLoad('save')}
              onLoad={() => openSaveLoad('load')}
              onRollbackDay={handleRollbackDay}
              onSleep={handleSleep}
              onCommunicationFinished={(result) => setGameState((prev) => applyCommunicationResult(prev, result))}
              onLoadError={handleDataLoadError}
            />
          ) : isSelectingLocation ? (
            <ActionSelectPage
              options={locationOptions}
              onSelectLocation={handleSelectLocation}
              phase={gameState.phase}
              affinities={gameState.affinities}
            />
          ) : (
            <ScenarioPage
              currentScene={currentScene}
              isFinished={isFinished}
              isWaitingChoice={isWaitingChoice}
              activeTimeOfDay={activeTimeOfDay}
              activeLocationId={activeLocationId}
              cast={cast}
              cameraShot={cameraShot}
              scrolling={scrolling}
              onDialogueClick={player.advance}
              onChoiceClick={handleChoiceClick}
              onChoiceTimeout={player.timeoutChoice}
              onTypingComplete={player.handleTypingComplete}
            />
          )}
        </>
      )}

      {/* 確認ダイアログ */}
      <ConfirmModal {...dialogProps} />

      {/* セーブ/ロードモーダル */}
      <SaveLoadModal
        isOpen={saveLoadModalState.isOpen}
        mode={saveLoadModalState.mode}
        slots={saveSlots}
        onSelectSlot={handleSelectSlot}
        onClose={() => setSaveLoadModalState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* 会話履歴（バックログ）モーダル */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        sessions={history.sessions}
        onPlayVoice={(voiceUrl) => soundManager.playVoice(voiceUrl)}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      {/* ライセンス・クレジットモーダル */}
      <LicenseModal isOpen={isLicenseModalOpen} onClose={() => setIsLicenseModalOpen(false)} />

      {/* 最前面 幕間スライストランジション */}
      <InterludeOverlay ref={interludeRef} />

      {/* シェア完了・フォールバック案内トースト */}
      <ShareToast
        message={shareToastMessage}
        actionButton={shareToastAction}
        onClose={() => {
          setShareToastMessage('');
          setShareToastAction(undefined);
        }}
      />
    </div>
  );
};

export default App;
