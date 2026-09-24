import React from 'react';
import { resolveLocalizedText } from '../../types/scenario';
import { ScenarioResolvedScene } from '../../services/scenario/ScenarioEngine';
import { TimeOfDayId } from '../../types/visual';
import { StageView } from '../../components/Stage/StageView';
import { DialogueBox } from '../../components/Dialogue/DialogueBox';
import { ChoiceBox } from '../../components/Dialogue/ChoiceBox';
import { WhiteFlashOverlay } from '../../components/Common/WhiteFlashOverlay';
import { useLanguage } from '../../contexts/LanguageContext';

export interface ScenarioPageProps {
  currentScene: ScenarioResolvedScene | null;
  isFinished: boolean;
  isWaitingChoice: boolean;
  activeTimeOfDay: TimeOfDayId;
  activeLocationId: string;
  activeCharId: string | null;
  activeModelUrl?: string;
  activeExpression: string;
  onDialogueClick: () => void;
  onChoiceClick: (index: number) => void;
  onTypingComplete: () => void;
}

export const ScenarioPage: React.FC<ScenarioPageProps> = ({
  currentScene,
  isFinished,
  activeTimeOfDay,
  activeLocationId,
  activeCharId,
  activeModelUrl,
  activeExpression,
  onDialogueClick,
  onChoiceClick,
  onTypingComplete,
}) => {
  const { lang } = useLanguage();
  return (
    <>
      {/* メインステージ（3D/背景描画領域） */}
      <main className="stage-area">
        <StageView
          timeOfDay={activeTimeOfDay}
          locationId={activeLocationId}
          characterId={activeCharId}
          characterModelUrl={activeModelUrl}
          expression={activeExpression}
        />
      </main>

      {/* ホワイトフラッシュ演出 */}
      {currentScene?.flashEffect === 'white' && (
        <WhiteFlashOverlay triggerKey={currentScene.id} />
      )}

      {/* 選択肢ボタン群 */}
      {currentScene?.choices && (
        <ChoiceBox
          choices={currentScene.choices.map((c) => ({
            text: resolveLocalizedText(c.text, lang),
            goto: c.goto,
          }))}
          onSelect={onChoiceClick}
        />
      )}

      {/* 会話ウィンドウ */}
      {currentScene && !currentScene.choices && !isFinished && (
        <DialogueBox
          speaker={currentScene.speaker}
          text={currentScene.text}
          onTypingComplete={onTypingComplete}
          onClick={onDialogueClick}
        />
      )}
    </>
  );
};
