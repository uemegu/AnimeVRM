/**
 * 進行状態から「何を映すか」（時間帯・場所・登場キャラ・カメラ構図・BGM）を決める。
 * 舞台の状態の引き継ぎ・キャラの配置・構図の決め方は Studio と共有（packages/scenario/src/stage.ts）。
 * ここにはゲーム固有のルール（フェーズごとの時間帯・服装・場所）を置く
 */
import {
  resolveCast as resolveSharedCast,
  resolveScrollingBackground as resolveSharedScrolling,
  type ScrollingBackgroundSettings,
  type StageCastMember,
  type StageState,
} from '@anime-vrm/scenario';
import { DayPhase } from '../../types/game';
import { ScenarioMeta, ScenarioPackage } from '../../types/scenario';
import { TimeOfDayId } from '../../types/visual';
import { CHARACTERS, CharacterMaster } from '../../data/characters';
import { LOOPING_MOTIONS } from '../../data/motions';
import { LOCATION_VISUAL_PRESETS } from '../../data/locationVisualPresets';

export {
  EMPTY_STAGE,
  initialStageState,
  mergeStageState,
  resolveCameraShot,
  type StageCastMember,
  type StageState,
} from '@anime-vrm/scenario';

const PHASE_TIME_OF_DAY: Record<DayPhase, TimeOfDayId> = {
  morning: 'morning',
  morning_action: 'day',
  lunch_action: 'day',
  holiday_action: 'day',
  afterschool_action: 'evening',
  night: 'night',
};

/** 時間帯（舞台の指定を優先し、なければフェーズから） */
export function resolveTimeOfDay(phase: DayPhase, stage: StageState): TimeOfDayId {
  return stage.timeOfDay ?? PHASE_TIME_OF_DAY[phase];
}

/**
 * 背景となる場所。優先順: 舞台の背景指定 → 夜は自室 → 朝は正門前
 * → シナリオの舞台指定（強制イベント等） → 選んだ行動場所 → 教室
 */
export function resolveLocationId(options: {
  phase: DayPhase;
  stage: StageState;
  scenario: ScenarioMeta | null;
  selectedLocationId: string | null;
}): string {
  const { phase, stage, scenario, selectedLocationId } = options;
  if (stage.background) return stage.background;
  if (phase === 'night') return 'myroom';
  if (phase === 'morning') return 'school_gate';
  return scenario?.location ?? selectedLocationId ?? 'classroom';
}

/** フェーズに合った服装のモデル（休日は私服、朝の登校中は通学カバン付き） */
export function outfitModelUrl(character: CharacterMaster | undefined, phase: DayPhase): string | undefined {
  if (phase === 'holiday_action') return character?.privateModelUrl ?? character?.defaultModelUrl;
  if (phase === 'morning') return character?.commuteModelUrl ?? character?.defaultModelUrl;
  return character?.defaultModelUrl;
}

/** シナリオ全体に登場する 3D キャラ（モデルと使うモーション）。表示前の先読み用 */
export function scenarioPrewarmAvatars(
  scenario: ScenarioPackage | null | undefined,
  phase: DayPhase
): { id: string; modelUrl: string; motions: string[] }[] {
  const byId = new Map<string, { id: string; modelUrl: string; motions: Set<string> }>();
  for (const scene of scenario?.scenes ?? []) {
    for (const [id, avatar] of Object.entries(scene.avatars ?? {})) {
      if ((avatar as { sprite?: unknown }).sprite) continue;
      const modelUrl = avatar.modelUrl ?? outfitModelUrl(CHARACTERS[avatar.characterId ?? id], phase);
      if (!modelUrl) continue;
      const entry = byId.get(id);
      // 同じキャラが別モデルに替わる場合は、最初に出る方だけ先読みする
      if (entry && entry.modelUrl !== modelUrl) continue;
      const item = entry ?? { id, modelUrl, motions: new Set<string>() };
      if (avatar.motion) item.motions.add(avatar.motion);
      byId.set(id, item);
    }
  }
  return [...byId.values()].map((item) => ({ ...item, motions: [...item.motions] }));
}

/**
 * 画面に出すキャラ（avatars で登場させたキャラだけ。話者でも登場していなければ声だけ）。
 * 服装はフェーズで決まる（outfitModelUrl）。シーンの modelUrl 指定が優先
 */
export function resolveCast(stage: StageState, phase: DayPhase): StageCastMember[] {
  return resolveSharedCast(stage, {
    modelUrlFor: (characterId) => outfitModelUrl(CHARACTERS[characterId], phase),
    isLoopingMotion: (motion) => LOOPING_MOTIONS.has(motion),
  });
}

/** 流れる背景の設定（画像を省略したらその場所の遠景を流す）。流さない時は null */
export function resolveScrollingBackground(stage: StageState, locationId: string): ScrollingBackgroundSettings | null {
  return resolveSharedScrolling(stage, LOCATION_VISUAL_PRESETS[locationId]?.layers.background?.url);
}
