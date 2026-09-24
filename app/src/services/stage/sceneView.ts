/**
 * 進行状態から「何を映すか」（時間帯・場所・登場キャラ・カメラ構図・BGM）を決める純粋関数群
 */
import { DayPhase } from '../../types/game';
import {
  CameraShot,
  SceneAvatarConfig,
  ScenarioMeta,
  ScenarioPackage,
  ScenarioScene,
  ScrollingBackgroundConfig,
} from '../../types/scenario';
import { TimeOfDayId } from '../../types/visual';
import { CHARACTERS, CharacterMaster } from '../../data/characters';
import { LOOPING_MOTIONS } from '../../data/motions';
import { LOCATION_VISUAL_PRESETS } from '../../data/locationVisualPresets';
import type { ScrollingBackgroundSettings } from '../graphics/scene/ScrollingBackground';
import { ScenarioResolvedScene } from '../scenario/ScenarioEngine';

/**
 * シナリオ再生中の舞台の状態。シーンで指定された項目だけ上書きし、指定のない項目は前のシーンから引き継ぐ
 */
export interface StageState {
  background?: string;
  timeOfDay?: TimeOfDayId;
  /** BGM の ID または URL。'silence' で無音 */
  bgm?: string;
  /** 登場中のキャラ（キー: キャラID） */
  cast: Record<string, SceneAvatarConfig>;
  /** キャラごとに、モーションを最後に指定したシーンID */
  motionCues?: Record<string, string>;
  /** 流れる背景（歩きながらの会話） */
  scrolling?: ScrollingBackgroundConfig | null;
}

/** 画面に出すキャラ1人分（位置・モデル解決済み） */
export interface StageCastMember {
  id: string;
  modelUrl: string;
  position: [number, number, number];
  rotationY: number;
  expression: string;
  expressionWeight: number;
  motion?: string;
  motionLoop: boolean;
  /** モーションを指定したシーン（変わったら同じモーションでも再生し直す） */
  motionCue?: string;
}

const SLOT_X: Record<string, number> = { left: -0.45, center: 0, right: 0.45 };

const PHASE_TIME_OF_DAY: Record<DayPhase, TimeOfDayId> = {
  morning: 'morning',
  morning_action: 'day',
  lunch_action: 'day',
  holiday_action: 'day',
  afterschool_action: 'evening',
  night: 'night',
};

export const EMPTY_STAGE: StageState = { cast: {} };

/** シナリオ開始時の舞台 */
export function initialStageState(scenario: Pick<ScenarioPackage, 'bgm' | 'timeOfDay'>): StageState {
  return { bgm: scenario.bgm, timeOfDay: scenario.timeOfDay, cast: {} };
}

/** シーンの指定を舞台に反映する（キャラは項目ごとに上書き、visible: false で退場） */
export function mergeStageState(prev: StageState, scene: ScenarioScene): StageState {
  const cast: Record<string, SceneAvatarConfig> = scene.clearCast ? {} : { ...prev.cast };
  const motionCues: Record<string, string> = scene.clearCast ? {} : { ...prev.motionCues };
  for (const [id, config] of Object.entries(scene.avatars ?? {})) {
    if (config.visible === false) {
      delete cast[id];
    } else {
      cast[id] = { ...cast[id], ...config };
      // モーションを指定したシーンを覚えておく（同じ身振りを別のシーンで指定したら再生し直す）
      if (config.motion !== undefined) motionCues[id] = scene.id;
    }
  }
  return {
    background: scene.background ?? prev.background,
    timeOfDay: scene.timeOfDay ?? prev.timeOfDay,
    bgm: scene.bgm ?? scene.bgmUrl ?? prev.bgm,
    cast,
    motionCues,
    scrolling: scene.scrollingBackground === undefined ? prev.scrolling : scene.scrollingBackground || null,
  };
}

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

/**
 * 画面に出すキャラ。舞台に誰もいなければ話者を中央に出す（旧形式のシナリオ互換）。
 * 服装はフェーズで決まる（outfitModelUrl）。シーンの modelUrl 指定が優先
 */
export function resolveCast(
  stage: StageState,
  scene: ScenarioResolvedScene | null,
  phase: DayPhase
): StageCastMember[] {
  const entries = Object.entries(stage.cast);
  if (entries.length === 0 && scene?.speakerCharacterId && CHARACTERS[scene.speakerCharacterId]) {
    entries.push([scene.speakerCharacterId, { position: 'center' }]);
  }

  const members: StageCastMember[] = [];
  for (const [key, config] of entries) {
    const characterId = config.characterId ?? key;
    const character = CHARACTERS[characterId];
    const modelUrl = config.modelUrl ?? outfitModelUrl(character, phase);
    if (!modelUrl) continue;

    const position: [number, number, number] = Array.isArray(config.position)
      ? config.position
      : [SLOT_X[config.position ?? 'center'] ?? 0, 0, 0];
    members.push({
      id: key,
      modelUrl,
      position,
      // 横に立つ人物は少し内側を向く
      rotationY: config.rotationY ?? -position[0] * 0.5,
      expression: config.expression ?? 'neutral',
      expressionWeight: config.expressionWeight ?? 1.0,
      motion: config.motion,
      motionLoop: config.motionLoop ?? (config.motion ? LOOPING_MOTIONS.has(config.motion) : true),
      motionCue: stage.motionCues?.[key],
    });
  }
  return members;
}

/** 流れる背景の設定（画像を省略したらその場所の遠景を流す）。流さない時は null */
export function resolveScrollingBackground(stage: StageState, locationId: string): ScrollingBackgroundSettings | null {
  const config = stage.scrolling;
  if (!config) return null;
  const textureUrl = config.textureUrl ?? LOCATION_VISUAL_PRESETS[locationId]?.layers.background?.url;
  if (!textureUrl) return null;
  return {
    textureUrl,
    speed: config.speed ?? 0.65,
    blur: config.blur ?? 1.0,
    direction: config.direction ?? 'left',
    featherWidth: config.featherWidth ?? 0.2,
  };
}

/** カメラ構図（指定がなければ、1人なら話者、選択肢や話者不在は全体、複数人の会話は話者中心） */
export function resolveCameraShot(scene: ScenarioResolvedScene | null, cast: StageCastMember[]): CameraShot {
  if (scene?.camera) return scene.camera;
  if (cast.length <= 1) return 'speaker';
  if (scene?.choices) return 'wide';
  return scene?.speakerCharacterId && cast.some((m) => m.id === scene.speakerCharacterId) ? 'medium' : 'wide';
}
