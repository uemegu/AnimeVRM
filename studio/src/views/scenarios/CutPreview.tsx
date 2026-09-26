import { useMemo } from 'react';
import {
  type CameraPose,
  resolveCameraShot,
  resolveCast,
  resolveScrollingBackground,
  stageAtScene,
  type ScenarioPackage,
  type TimeOfDayId,
} from '@anime-vrm/scenario';
import type { StagePresets } from '@anime-vrm/engine/stage/StageManager';
import type { StudioData } from '../../data/useStudioData';
import { useI18n } from '../../i18n';
import { StageCanvas } from '../../stage/StageCanvas';
import { textJa } from './scenarioEdit';

export type Outfit = 'default' | 'private' | 'commute';

interface Props {
  scenario: ScenarioPackage;
  /** ボイスの相対パスの基準（/scenarios/<category>/<id>/） */
  baseUrl: string;
  index: number;
  data: StudioData;
  outfit: Outfit;
  /** カット内の時刻（タイムライン） */
  cutTime: number;
  playing: boolean;
  freeCamera: boolean;
  onCameraPose: (pose: CameraPose) => void;
}

/**
 * カットの見え方（app と同じ描画）。先頭からこのカットまでの指定を引き継いだ舞台を映す
 */
export function CutPreview({ scenario, index, data, outfit, cutTime, playing, freeCamera, onCameraPose }: Props) {
  const { t } = useI18n();
  const presets = useMemo<StagePresets>(() => ({ timeOfDay: data.timeOfDay, locations: data.locations }), [data]);
  const scene = scenario.scenes[index];
  const stage = useMemo(() => stageAtScene(scenario, index), [scenario, index]);

  const cast = useMemo(
    () =>
      resolveCast(stage, {
        modelUrlFor: (characterId) => {
          const models = data.characters.characters.find((c) => c.id === characterId)?.models ?? [];
          return (models.find((m) => m.key === outfit) ?? models.find((m) => m.key === 'default'))?.url;
        },
        isLoopingMotion: (motion) => !!data.motions[motion]?.loop,
      }),
    [stage, data, outfit]
  );

  const locationId = stage.background ?? scenario.location ?? 'classroom';
  const timeOfDay = (stage.timeOfDay ?? 'day') as TimeOfDayId;
  const shot = resolveCameraShot(scene ?? null, cast);
  const scrolling = resolveScrollingBackground(stage, data.locations[locationId]?.layers.background.url);
  const speaker = textJa(scene?.speaker) || (scene?.speakerCharacterId ? data.characters.characters.find((c) => c.id === scene.speakerCharacterId)?.name.ja : '');

  return (
    <div className="cut-preview">
      <StageCanvas
        presets={presets}
        timeOfDay={timeOfDay}
        locationId={locationId}
        cast={cast}
        cameraShot={shot}
        focusId={scene?.speakerCharacterId ?? null}
        scrolling={scrolling}
        cut={scene ?? null}
        cutTime={cutTime}
        playing={playing}
        freeCamera={freeCamera}
        onCameraPose={onCameraPose}
      />
      {scene && (textJa(scene.text) || scene.choices?.length) ? (
        <div className="cut-dialogue">
          {speaker && <div className="cut-dialogue-speaker">{speaker}</div>}
          {textJa(scene.text) && <div className="cut-dialogue-text">{textJa(scene.text)}</div>}
          {scene.choices?.length ? (
            <div className="cut-dialogue-choices">
              {scene.choices.map((c, i) => (
                <span key={i}>{textJa(c.text)}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="cut-preview-hud">
        <span>{data.locations[locationId]?.name ?? locationId}</span>
        <span>{data.timeOfDay[timeOfDay]?.name ?? timeOfDay}</span>
        <span>{scene?.cameraPose ? t.scenarios.timeline.pose : t.viewer.shots[shot]}</span>
      </div>
    </div>
  );
}
