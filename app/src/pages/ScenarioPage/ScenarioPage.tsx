import React from 'react';
import { resolveLocalizedText } from '../../types/scenario';
import { ScenarioResolvedScene } from '../../services/scenario/ScenarioEngine';
import { TimeOfDayId } from '../../types/visual';
import { CameraShot } from '../../types/scenario';
import type { SceneEffects } from '@anime-vrm/scenario';
import { StageCastMember } from '../../services/stage/sceneView';
import { ScrollingBackgroundSettings } from '@anime-vrm/engine/stage/ScrollingBackground';
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
  cast: StageCastMember[];
  cameraShot: CameraShot;
  scrolling: ScrollingBackgroundSettings | null;
  effects?: SceneEffects;
  onDialogueClick: () => void;
  onChoiceClick: (index: number) => void;
  onChoiceTimeout: () => void;
  onTypingComplete: () => void;
}

export const ScenarioPage: React.FC<ScenarioPageProps> = ({
  currentScene,
  isFinished,
  activeTimeOfDay,
  activeLocationId,
  cast,
  cameraShot,
  scrolling,
  effects,
  onDialogueClick,
  onChoiceClick,
  onChoiceTimeout,
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
          cast={cast}
          cameraShot={cameraShot}
          scrolling={scrolling}
          effects={effects}
          speakerId={currentScene?.speakerCharacterId ?? null}
          cut={currentScene}
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
          timeLimitSec={currentScene.choiceTimeLimitSec}
          onTimeout={onChoiceTimeout}
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
