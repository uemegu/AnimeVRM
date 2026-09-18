import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, ActionLocationId } from './types/game';
import { SupportedLanguage, ScenarioPackage, resolveLocalizedText } from './types/scenario';
import { ScenarioEngine, ScenarioResolvedScene } from './services/scenario/ScenarioEngine';
import { ScheduleManager } from './services/schedule/ScheduleManager';
import { SaveService } from './services/save/SaveService';

import { GameHeader } from './components/Header/GameHeader';
import { DialogueBox } from './components/Dialogue/DialogueBox';
import { ChoiceBox } from './components/Dialogue/ChoiceBox';
import { ActionSelectModal } from './components/ActionSelect/ActionSelectModal';
import { NightRoomView } from './components/Room/NightRoomView';
import { EndingView } from './components/Ending/EndingView';
import { StageView } from './components/Stage/StageView';
import { TimeOfDayId } from './types/visual';
import { CHARACTERS } from './data/characters';
import { AudioLipSync } from './services/audio/AudioLipSync';
import { SoundManager } from './services/audio/SoundManager';

export const App: React.FC = () => {
  const [lang, setLang] = useState<SupportedLanguage>('ja');
  const saveService = useMemo(() => new SaveService(), []);
  const soundManager = useMemo(() => new SoundManager(), []);
  const audioLipSync = useMemo(() => new AudioLipSync(), []);

  // ゲーム全体の状態
  const [gameState, setGameState] = useState<GameState>(() => {
    return ScheduleManager.createInitialState();
  });

  // 現在再生中のシナリオパッケージ
  const [activeScenario, setActiveScenario] = useState<ScenarioPackage | null>(() => {
    const initial = ScheduleManager.createInitialState();
    return ScheduleManager.getMorningScenario(initial);
  });

  // シナリオエンジン
  const [engine, setEngine] = useState<ScenarioEngine | null>(null);
  const [, setTick] = useState(0);

  // 行動場所選択モーダル表示フラグ
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<ActionLocationId | null>(null);

  // 28日目完走エンディングフラグ
  const [isGameEnded, setIsGameEnded] = useState(false);

  // activeScenario が変わったときに engine を再初期化
  useEffect(() => {
    if (activeScenario) {
      const newEngine = new ScenarioEngine(
        activeScenario,
        gameState.flags,
        gameState.affinities,
        lang
      );
      setEngine(newEngine);
    } else {
      setEngine(null);
    }
  }, [activeScenario]);

  // 現在のシーン・状態
  const currentScene: ScenarioResolvedScene | null = engine ? engine.getCurrentScene() : null;
  const isFinished = engine ? engine.isFinished() : true;
  const isWaitingChoice = engine ? engine.isWaitingForChoice() : false;

  // 0. シーン進行に応じたオーディオ連動（BGM / SE / ボイス・リップシンク）
  useEffect(() => {
    if (!currentScene) {
      audioLipSync.stop();
      return;
    }

    // BGM再生
    if (currentScene.bgmUrl) {
      soundManager.playBgm(currentScene.bgmUrl);
    }

    // SE再生
    if (currentScene.seUrl) {
      soundManager.playSe(currentScene.seUrl);
    }

    // ボイス＆リップシンク再生
    if (currentScene.voiceUrl) {
      audioLipSync.loadAudioUrl(currentScene.voiceUrl, currentScene.text);
      audioLipSync.play().catch(() => {});
    } else {
      audioLipSync.stop();
    }
  }, [currentScene?.id, currentScene?.voiceUrl, currentScene?.bgmUrl, currentScene?.seUrl]);

  // コンポーネント破棄時のオーディオリソース解放
  useEffect(() => {
    return () => {
      soundManager.dispose();
      audioLipSync.dispose();
    };
  }, [soundManager, audioLipSync]);

  // 1. 時間帯 (TimeOfDay) の決定（ライト・ポストプロセス用）
  const activeTimeOfDay: TimeOfDayId = useMemo(() => {
    switch (gameState.phase) {
      case 'morning':
        return 'morning';
      case 'morning_action':
      case 'lunch_action':
        return 'day';
      case 'afterschool_action':
        return 'evening';
      case 'night':
        return 'night';
      default:
        return 'day';
    }
  }, [gameState.phase]);

  // 2. ロケーション (Location) の決定（多層背景用）- 時間帯と完全分離
  const activeLocationId: string = useMemo(() => {
    if (gameState.phase === 'night') return 'myroom';
    if (gameState.phase === 'morning') return 'school_gate';
    if (selectedLocationId) return selectedLocationId;
    if (activeScenario?.id.includes('classroom')) return 'classroom';
    if (activeScenario?.id.includes('courtyard')) return 'courtyard';
    if (activeScenario?.id.includes('rooftop')) return 'rooftop';
    if (activeScenario?.id.includes('library')) return 'library';
    if (activeScenario?.id.includes('sports')) return 'sports_ground';
    if (activeScenario?.id.includes('cafeteria')) return 'cafeteria';
    if (activeScenario?.id.includes('meet_shion')) return 'library';
    if (activeScenario?.id.includes('meet_emili')) return 'courtyard';
    return 'classroom';
  }, [gameState.phase, selectedLocationId, activeScenario]);

  // 3. 表示キャラクター・モデル・表情の決定
  const { activeCharId, activeModelUrl, activeExpression } = useMemo(() => {
    let charId: string | null = null;
    let expression = 'neutral';

    if (currentScene?.avatars) {
      for (const [id, av] of Object.entries(currentScene.avatars)) {
        if (av.visible !== false) {
          charId = id;
          if (av.expression) expression = av.expression;
          break;
        }
      }
    }

    if (!charId && currentScene?.speakerCharacterId) {
      charId = currentScene.speakerCharacterId;
    }

    const modelUrl = charId && CHARACTERS[charId] ? CHARACTERS[charId].defaultModelUrl : undefined;

    return {
      activeCharId: charId,
      activeModelUrl: modelUrl,
      activeExpression: expression,
    };
  }, [currentScene]);

  // 言語切り替え
  const handleToggleLanguage = useCallback(() => {
    const nextLang: SupportedLanguage = lang === 'ja' ? 'en' : 'ja';
    setLang(nextLang);
    if (engine) {
      engine.setLanguage(nextLang);
      setTick((t) => t + 1);
    }
  }, [lang, engine]);

  // シナリオ開始ヘルパー
  const startScenario = useCallback((scenario: ScenarioPackage, nextGameState: GameState) => {
    setActiveScenario(scenario);
    setGameState({
      ...nextGameState,
      currentScenarioId: scenario.id,
    });
  }, []);

  // 行動ターン開始時の処理（強制イベント判定または場所選択表示）
  const proceedToActionPhase = useCallback(
    (targetPhase: GameState['phase'], state: GameState) => {
      const updatedState: GameState = {
        ...state,
        phase: targetPhase,
        currentScenarioId: null,
      };

      // 強制割り込みイベントがあるかチェック
      const forcedScenario = ScheduleManager.checkForcedInterruption(updatedState);
      if (forcedScenario) {
        startScenario(forcedScenario, updatedState);
      } else {
        setActiveScenario(null);
        setGameState(updatedState);
        setIsSelectingLocation(true);
      }
    },
    [startScenario]
  );

  // テキスト送りクリック
  const handleDialogueClick = useCallback(() => {
    if (!engine || isWaitingChoice || isFinished) return;

    const finished = engine.next();
    const updatedFlags = engine.getFlags();
    const updatedAffinities = engine.getAffinities();

    const updatedState: GameState = {
      ...gameState,
      flags: updatedFlags,
      affinities: updatedAffinities,
    };
    setGameState(updatedState);
    setTick((t) => t + 1);

    if (finished) {
      // シナリオ終了後の分岐制御
      if (gameState.phase === 'morning') {
        // 朝イベント終了 -> 午前行動へ
        proceedToActionPhase('morning_action', updatedState);
      } else if (
        gameState.phase === 'morning_action' ||
        gameState.phase === 'lunch_action' ||
        gameState.phase === 'afterschool_action'
      ) {
        // もし強制イベントだった場合、完了後に本来の場所選択を表示
        if (
          activeScenario?.id === 'forced_meet_shion' ||
          activeScenario?.id === 'forced_meet_emili'
        ) {
          setActiveScenario(null);
          setIsSelectingLocation(true);
        } else {
          // 通常の行動シナリオ終了 -> 次のフェーズへ
          const nextPhase = ScheduleManager.getNextPhase(gameState.phase);
          if (nextPhase === 'night') {
            setActiveScenario(null);
            setGameState({
              ...updatedState,
              phase: 'night',
              currentScenarioId: null,
            });
          } else {
            proceedToActionPhase(nextPhase, updatedState);
          }
        }
      }
    }
  }, [engine, isWaitingChoice, isFinished, gameState, activeScenario, proceedToActionPhase]);

  // 選択肢の選択
  const handleChoiceClick = useCallback(
    (index: number) => {
      if (!engine) return;
      engine.choose(index);
      setGameState((prev) => ({
        ...prev,
        flags: engine.getFlags(),
        affinities: engine.getAffinities(),
      }));
      setTick((t) => t + 1);
    },
    [engine]
  );

  // 場所を選択したとき
  const handleSelectLocation = useCallback(
    (locationId: ActionLocationId) => {
      setSelectedLocationId(locationId);
      setIsSelectingLocation(false);
      const scenario = ScheduleManager.getScenarioForLocation(locationId, gameState);
      startScenario(scenario, gameState);
    },
    [gameState, startScenario]
  );

  // 自室コマンド: セーブ
  const handleSave = useCallback(() => {
    const success = saveService.saveGame(gameState);
    if (success) {
      alert(lang === 'ja' ? 'セーブしました！' : 'Game Saved successfully!');
    } else {
      alert(lang === 'ja' ? 'セーブに失敗しました。' : 'Failed to save game.');
    }
  }, [saveService, gameState, lang]);

  // 自室コマンド: ロード
  const handleLoad = useCallback(() => {
    const loaded = saveService.loadGame();
    if (!loaded) {
      alert(lang === 'ja' ? 'セーブデータが見つかりません。' : 'No save data found.');
      return;
    }
    setGameState(loaded.gameState);
    setIsGameEnded(false);
    setIsSelectingLocation(false);

    if (loaded.gameState.phase === 'night') {
      setActiveScenario(null);
    } else if (loaded.gameState.phase === 'morning') {
      const morningScenario = ScheduleManager.getMorningScenario(loaded.gameState);
      startScenario(morningScenario, loaded.gameState);
    } else {
      setIsSelectingLocation(true);
      setActiveScenario(null);
    }
    alert(lang === 'ja' ? 'ロードしました！' : 'Game Loaded successfully!');
  }, [saveService, lang, startScenario]);

  // 自室コマンド: 1日をやり直す
  const handleRollbackDay = useCallback(() => {
    const rolledBack = ScheduleManager.rollbackToday(gameState);
    const morningScenario = ScheduleManager.getMorningScenario(rolledBack);
    startScenario(morningScenario, rolledBack);
    setIsSelectingLocation(false);
    alert(
      lang === 'ja'
        ? `第${rolledBack.day}日の朝に戻りました。`
        : `Restarted from Day ${rolledBack.day} Morning.`
    );
  }, [gameState, lang, startScenario]);

  // 自室コマンド: 就寝
  const handleSleep = useCallback(() => {
    const { nextState, isEnding } = ScheduleManager.advanceToNextDay(gameState);
    if (isEnding) {
      // 28日終了 -> エンディング
      const endingScenario = ScheduleManager.getEndingScenario(gameState);
      startScenario(endingScenario, gameState);
      setIsGameEnded(true);
      return;
    }

    // 翌日の朝へ
    saveService.saveDayStartBackup(nextState.dayStartSnapshot!);
    const morningScenario = ScheduleManager.getMorningScenario(nextState);
    startScenario(morningScenario, nextState);
  }, [gameState, saveService, startScenario]);

  // ゲーム最初からリスタート
  const handleRestartGame = useCallback(() => {
    const initial = ScheduleManager.createInitialState();
    setIsGameEnded(false);
    setIsSelectingLocation(false);
    const morningScenario = ScheduleManager.getMorningScenario(initial);
    startScenario(morningScenario, initial);
  }, [startScenario]);

  // 場所候補一覧
  const locationOptions = useMemo(() => {
    return ScheduleManager.getActionLocationOptions(gameState);
  }, [gameState]);

  return (
    <div className="game-container">
      {/* 上部ヘッダー */}
      <GameHeader
        day={gameState.day}
        phase={gameState.phase}
        lang={lang}
        onToggleLanguage={handleToggleLanguage}
      />

      {/* メインステージ（3D/背景描画領域） */}
      <main className="stage-area">
        {/* Three.js / VRM / 多層背景ステージ */}
        <StageView
          timeOfDay={activeTimeOfDay}
          locationId={activeLocationId}
          characterId={activeCharId}
          characterModelUrl={activeModelUrl}
          expression={activeExpression}
          audioLipSync={audioLipSync}
        />

        {/* 夜の自室コマンドUI（夜フェーズでオーバーレイ表示） */}
        {gameState.phase === 'night' && !isGameEnded && (
          <NightRoomView
            day={gameState.day}
            affinities={gameState.affinities}
            lang={lang}
            onSave={handleSave}
            onLoad={handleLoad}
            onRollbackDay={handleRollbackDay}
            onSleep={handleSleep}
          />
        )}
      </main>

      {/* 行動場所選択モーダル */}
      {isSelectingLocation && (
        <ActionSelectModal
          options={locationOptions}
          lang={lang}
          onSelectLocation={handleSelectLocation}
        />
      )}

      {/* 選択肢ボタン群 */}
      {currentScene?.choices && (
        <ChoiceBox
          choices={currentScene.choices.map((c) => ({
            text: resolveLocalizedText(c.text, lang),
            goto: c.goto,
          }))}
          onSelect={handleChoiceClick}
        />
      )}

      {/* 会話ウィンドウ */}
      {currentScene &&
        !currentScene.choices &&
        !isFinished &&
        !isSelectingLocation && (
          <DialogueBox
            speaker={currentScene.speaker}
            text={currentScene.text}
            onClick={handleDialogueClick}
          />
        )}

      {/* 28日完走エンディング画面（エンディングシナリオ終了時など） */}
      {isGameEnded && isFinished && (
        <EndingView
          affinities={gameState.affinities}
          lang={lang}
          onRestart={handleRestartGame}
        />
      )}
    </div>
  );
};

export default App;
