/**
 * シナリオの進行から「舞台に何を映すか」を決める純粋関数（app の再生と Studio のプレビューで共有）。
 * ゲーム固有のルール（フェーズごとの時間帯・服装・場所）は呼び出し側が決めて渡す
 */
import { z } from 'zod';
import type { CameraShot, ScenarioPackage, ScenarioScene, ScrollingBackgroundConfig, SceneAvatarConfig } from './schema.ts';
import type { TimeOfDayId } from './scene.ts';

/** シナリオ再生中の舞台の状態。シーンで指定された項目だけ上書きし、指定のない項目は前のシーンから引き継ぐ */
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

/** 舞台に出すキャラ1人分（描画に渡す形） */
export interface StageCastMember {
  id: string;
  modelUrl: string;
  /** 立ち位置の座標。省略時は slot から、場所の設定（または既定）の位置を使う */
  position?: [number, number, number];
  slot?: 'left' | 'center' | 'right';
  /** 省略時は横に立つほど少し内側を向く */
  rotationY?: number;
  expression: string;
  expressionWeight: number;
  motion?: string;
  motionLoop: boolean;
  /** モーションを指定したシーン（変わったら同じモーションでも再生し直す） */
  motionCue?: string;
}

/** 流れる背景（描画に渡す形。省略項目は既定値で埋めたもの） */
export interface ScrollingBackgroundSettings {
  textureUrl: string;
  speed: number;
  blur: number;
  direction: 'left' | 'right';
  featherWidth: number;
}

export const EMPTY_STAGE: StageState = { cast: {} };

/** シナリオ開始時の舞台 */
export function initialStageState(scenario: Pick<ScenarioPackage, 'bgm' | 'timeOfDay'>): StageState {
  return { bgm: scenario.bgm, timeOfDay: scenario.timeOfDay as TimeOfDayId | undefined, cast: {} };
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
    timeOfDay: (scene.timeOfDay as TimeOfDayId | undefined) ?? prev.timeOfDay,
    bgm: scene.bgm ?? scene.bgmUrl ?? prev.bgm,
    cast,
    motionCues,
    scrolling: scene.scrollingBackground === undefined ? prev.scrolling : scene.scrollingBackground || null,
  };
}

/** シナリオの先頭から指定シーンまでを順にたどった舞台（Studio で途中のカットを表示するため） */
export function stageAtScene(scenario: Pick<ScenarioPackage, 'bgm' | 'timeOfDay' | 'scenes'>, sceneIndex: number): StageState {
  let stage = initialStageState(scenario);
  for (const scene of scenario.scenes.slice(0, sceneIndex + 1)) stage = mergeStageState(stage, scene);
  return stage;
}

export interface CastOptions {
  /** キャラの服装を決める（シーンで modelUrl が指定されていなければ使う） */
  modelUrlFor: (characterId: string) => string | undefined;
  /** ループ再生するモーションかどうか（motionLoop の指定がないとき） */
  isLoopingMotion: (motion: string) => boolean;
}

/**
 * 画面に出すキャラ（avatars で登場させたキャラだけ。話者でも登場していなければ声だけ）。
 * シーンの modelUrl 指定が優先
 */
export function resolveCast(stage: StageState, options: CastOptions): StageCastMember[] {
  const members: StageCastMember[] = [];
  for (const [key, config] of Object.entries(stage.cast)) {
    const characterId = config.characterId ?? key;
    const modelUrl = config.modelUrl ?? options.modelUrlFor(characterId);
    if (!modelUrl) continue;
    // 立ち位置の名前（left など）は、場所ごとの立ち位置の設定に合わせて描画側で座標にする
    members.push({
      id: key,
      modelUrl,
      ...(Array.isArray(config.position) ? { position: config.position } : { slot: config.position ?? 'center' }),
      rotationY: config.rotationY,
      expression: config.expression ?? 'neutral',
      expressionWeight: config.expressionWeight ?? 1.0,
      motion: config.motion,
      motionLoop: config.motionLoop ?? (config.motion ? options.isLoopingMotion(config.motion) : true),
      motionCue: stage.motionCues?.[key],
    });
  }
  return members;
}

/** 流れる背景の設定（画像を省略したら locationBackgroundUrl を流す）。流さない時は null */
export function resolveScrollingBackground(stage: StageState, locationBackgroundUrl: string | undefined): ScrollingBackgroundSettings | null {
  const config = stage.scrolling;
  if (!config) return null;
  const textureUrl = config.textureUrl ?? locationBackgroundUrl;
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
export function resolveCameraShot(
  scene: Pick<ScenarioScene, 'camera' | 'choices' | 'speakerCharacterId'> | null,
  cast: Pick<StageCastMember, 'id'>[]
): CameraShot {
  if (scene?.camera) return scene.camera;
  if (cast.length <= 1) return 'speaker';
  if (scene?.choices) return 'wide';
  return scene?.speakerCharacterId && cast.some((m) => m.id === scene.speakerCharacterId) ? 'medium' : 'wide';
}

/** モーションの情報（assets/studio/motions.json）。載っていないモーションは既定（1回再生して待機に戻る） */
export const MotionBook = z.strictObject({
  description: z.string().optional(),
  motions: z.record(
    z.string(),
    z.strictObject({
      /** 待機・歩行など、繰り返して自然なもの */
      loop: z.boolean().optional(),
    })
  ),
});
export type MotionBook = z.infer<typeof MotionBook>;

/** BGM（assets/studio/bgm.json）。シナリオの bgm から ID で参照する */
export const BgmBook = z.strictObject({
  description: z.string().optional(),
  bgm: z.record(
    z.string().regex(/^[a-z][a-z0-9_]*$/),
    z.strictObject({
      /** assets/ 基準の URL */
      url: z.string().startsWith('/'),
      /** 既定の音量の倍率（0〜1） */
      volumeScale: z.number().min(0).max(1),
      title: z.strictObject({ ja: z.string(), en: z.string() }),
    })
  ),
});
export type BgmBook = z.infer<typeof BgmBook>;
