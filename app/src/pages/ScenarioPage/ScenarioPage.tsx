import React from 'react';
import { SupportedLanguage, resolveLocalizedText } from '../../types/scenario';
import { ScenarioResolvedScene } from '../../services/scenario/ScenarioEngine';
import { TimeOfDayId } from '../../types/visual';
import { AudioLipSync } from '../../services/audio/AudioLipSync';
import { StageView } from '../../components/Stage/StageView';
import { DialogueBox } from '../../components/Dialogue/DialogueBox';
import { ChoiceBox } from '../../components/Dialogue/ChoiceBox';

export interface ScenarioPageProps {
  currentScene: ScenarioResolvedScene | null;
  isFinished: boolean;
  isWaitingChoice: boolean;
  lang: SupportedLanguage;
  activeTimeOfDay: TimeOfDayId;
  activeLocationId: string;
  activeCharId: string | null;
  activeModelUrl?: string;
  activeExpression: string;
  audioLipSync: AudioLipSync;
  onDialogueClick: () => void;
  onChoiceClick: (index: number) => void;
  onTypingComplete: () => void;
}

export const ScenarioPage: React.FC<ScenarioPageProps> = ({
  currentScene,
  isFinished,
  lang,
  activeTimeOfDay,
  activeLocationId,
  activeCharId,
  activeModelUrl,
  activeExpression,
  audioLipSync,
  onDialogueClick,
  onChoiceClick,
  onTypingComplete,
}) => {
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
          audioLipSync={audioLipSync}
        />
      </main>

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
