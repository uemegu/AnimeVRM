/**
 * 進行状態から「何を映すか」（時間帯・場所・表示キャラ）を決める純粋関数群
 */
import { DayPhase } from '../../types/game';
import { ScenarioMeta } from '../../types/scenario';
import { TimeOfDayId } from '../../types/visual';
import { CHARACTERS } from '../../data/characters';
import { ScenarioResolvedScene } from '../scenario/ScenarioEngine';

const PHASE_TIME_OF_DAY: Record<DayPhase, TimeOfDayId> = {
  morning: 'morning',
  morning_action: 'day',
  lunch_action: 'day',
  holiday_action: 'day',
  afterschool_action: 'evening',
  night: 'night',
};

/** 時間帯（シーン指定があれば優先、なければフェーズから） */
export function resolveTimeOfDay(phase: DayPhase, scene: ScenarioResolvedScene | null): TimeOfDayId {
  return scene?.timeOfDay ?? PHASE_TIME_OF_DAY[phase];
}

/**
 * 背景となる場所。優先順: シーンの背景指定 → 夜は自室 → 朝は正門前
 * → シナリオの舞台指定（強制イベント等） → 選んだ行動場所 → 教室
 */
export function resolveLocationId(options: {
  phase: DayPhase;
  scene: ScenarioResolvedScene | null;
  scenario: ScenarioMeta | null;
  selectedLocationId: string | null;
}): string {
  const { phase, scene, scenario, selectedLocationId } = options;
  if (scene?.background) return scene.background;
  if (phase === 'night') return 'myroom';
  if (phase === 'morning') return 'school_gate';
  return scenario?.location ?? selectedLocationId ?? 'classroom';
}

/** 表示するキャラクター（最初に見えているアバター、なければ話者）とモデル・表情 */
export function resolveActiveCharacter(
  scene: ScenarioResolvedScene | null,
  phase: DayPhase
): { charId: string | null; modelUrl?: string; expression: string } {
  let charId: string | null = null;
  let expression = 'neutral';

  for (const [id, avatar] of Object.entries(scene?.avatars ?? {})) {
    if (avatar.visible !== false) {
      charId = id;
      if (avatar.expression) expression = avatar.expression;
      break;
    }
  }
  if (!charId && scene?.speakerCharacterId) {
    charId = scene.speakerCharacterId;
  }

  // 休日はヒロインが私服で登場する
  const character = charId ? CHARACTERS[charId] : undefined;
  const modelUrl =
    phase === 'holiday_action'
      ? character?.privateModelUrl ?? character?.defaultModelUrl
      : character?.defaultModelUrl;

  return { charId, modelUrl, expression };
}
