/**
 * シナリオの進行から「舞台に何を映すか」を決める純粋関数（app の再生と Studio のプレビューで共有）。
 * ゲーム固有のルール（フェーズごとの時間帯・服装・場所）は呼び出し側が決めて渡す
 */
import { z } from 'zod';
import type { CameraPose, CameraShot, EffectText, ScenarioPackage, ScenarioScene, ScrollingBackgroundConfig, SceneAvatarConfig, SweatMode } from './schema.ts';
import type { TimeOfDayId } from './scene.ts';

/** シナリオ再生中の舞台の状態。シーンで指定された項目だけ上書きし、指定のない項目は前のシーンから引き継ぐ */
export interface StageState {
  background?: string;
  timeOfDay?: TimeOfDayId;
  /** BGM の ID または URL。'silence' で無音 */
  bgm?: string;
  /** 環境音（ループ）の URL。なければ鳴らさない */
  ambience?: string;
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
  /** 視線の先（player / camera / partner / speaker / forward / キャラ ID）。なければ正面のまま */
  lookAtTarget?: string;
  /** 顔の向きを視線の先へどれだけ向けるか（0〜1） */
  headTurn?: number;
  /** 顔・体の演出（指定を変えるまで続く）。省略時は何もしない */
  look?: AvatarLook;
  /** 日なたの明るさ（窓の外の人物など） */
  daylight?: number;
}

/** 顔・体の演出の状態 */
export interface AvatarLook {
  blush: boolean;
  anger: boolean;
  tears: boolean;
  /** 顔に汗のテクスチャを重ねる（今はビューアの試し用で、シナリオからは指定できない） */
  faceSweat?: boolean;
  /** 目が泳ぐ強さ（0 で止まる） */
  eyeWander: number;
  fastMotion: boolean;
  motionSpeed: number;
}

export const DEFAULT_AVATAR_LOOK: AvatarLook = { blush: false, anger: false, tears: false, eyeWander: 0, fastMotion: false, motionSpeed: 1 };

/** 1回だけ出す演出（文字演出・汗）。key はカット内で同じ演出を二重に出さないための識別子 */
export interface AvatarOneShot {
  id: string;
  at: number;
  key: string;
  effectText?: EffectText;
  sweat?: SweatMode;
}

/** 目が泳ぐ指定を強さにする */
export function eyeWanderIntensity(value: boolean | number | undefined): number {
  if (value === undefined || value === false) return 0;
  return value === true ? 1 : value;
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
export function initialStageState(scenario: Pick<ScenarioPackage, 'bgm' | 'timeOfDay' | 'ambience'>): StageState {
  return { bgm: scenario.bgm, ambience: scenario.ambience, timeOfDay: scenario.timeOfDay as TimeOfDayId | undefined, cast: {} };
}

/** シーンの指定を舞台に反映する（キャラは項目ごとに上書き、visible: false で退場） */
export function mergeStageState(prev: StageState, scene: ScenarioScene): StageState {
  const cast: Record<string, SceneAvatarConfig> = scene.clearCast ? {} : { ...prev.cast };
  const motionCues: Record<string, string> = scene.clearCast ? {} : { ...prev.motionCues };
  for (const [id, config] of Object.entries(scene.avatars ?? {})) {
    if (config.visible === false) {
      delete cast[id];
    } else {
      // 文字演出・汗はそのシーンだけ（次のシーンに引き継がない）
      const { effectText: _text, sweat: _sweat, ...rest } = config;
      const { effectText: _prevText, sweat: _prevSweat, ...prev } = cast[id] ?? {};
      cast[id] = { ...prev, ...rest };
      // モーションを指定したシーンを覚えておく（同じ身振りを別のシーンで指定したら再生し直す）
      if (config.motion !== undefined) motionCues[id] = scene.id;
    }
  }
  return {
    background: scene.background ?? prev.background,
    timeOfDay: (scene.timeOfDay as TimeOfDayId | undefined) ?? prev.timeOfDay,
    bgm: scene.bgm ?? scene.bgmUrl ?? prev.bgm,
    ambience: scene.ambience === undefined ? prev.ambience : scene.ambience || undefined,
    cast,
    motionCues,
    scrolling: scene.scrollingBackground === undefined ? prev.scrolling : scene.scrollingBackground || null,
  };
}

/** シナリオの先頭から指定シーンまでを順にたどった舞台（Studio で途中のカットを表示するため） */
export function stageAtScene(scenario: Pick<ScenarioPackage, 'bgm' | 'timeOfDay' | 'ambience' | 'scenes'>, sceneIndex: number): StageState {
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
      lookAtTarget: config.lookAtTarget,
      headTurn: config.headTurn,
      ...(config.daylight !== undefined ? { daylight: config.daylight } : {}),
      look: {
        blush: config.blush ?? false,
        anger: config.anger ?? false,
        tears: config.tears ?? false,
        eyeWander: eyeWanderIntensity(config.eyeWander),
        fastMotion: config.fastMotion ?? false,
        motionSpeed: config.motionSpeed ?? 1,
      },
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

/** カット内のある時刻のキャラの状態（タイムラインのキーフレームで上書きされた項目だけ） */
export interface CutAvatarState {
  expression?: string;
  expressionWeight?: number;
  motion?: string;
  motionLoop?: boolean;
  /** 今のモーションを始めた時刻（頭出しでモーションの途中から再生するため） */
  motionAt?: number;
  lookAtTarget?: string;
  headTurn?: number;
  visible?: boolean;
  blush?: boolean;
  anger?: boolean;
  tears?: boolean;
  eyeWander?: number;
  motionSpeed?: number;
}

/** カット内のある時刻のカメラ（キーフレームで切り替えた構図・直接指定） */
export interface CutCameraState {
  shot?: CameraShot;
  pose?: CameraPose;
  /** 切り替えた時刻と、動かすのにかける秒数 */
  at?: number;
  duration?: number;
}

/** カットに書いた文字演出・汗を出すまでの秒数（カメラが落ち着いてから出す） */
export const CUT_ONE_SHOT_DELAY = 0.5;

/** カット内のある時刻の状態 */
export interface CutState {
  avatars: Record<string, CutAvatarState>;
  camera: CutCameraState;
  focusLines: boolean;
  /** 時刻 t までに出す1回きりの演出（カットの指定は at 0） */
  oneShots: AvatarOneShot[];
}

/**
 * カットの時刻 t（ボイスの再生位置、なければカット開始からの秒数）での、キーフレームを反映した状態。
 * キーフレームのない項目は含めない（カットの指定のまま）
 */
export function cutStateAt(scene: ScenarioScene, t: number): CutState {
  const avatars: Record<string, CutAvatarState> = {};
  const oneShots: AvatarOneShot[] = [];
  for (const [id, config] of Object.entries(scene.avatars ?? {})) {
    const state: CutAvatarState = {};
    if ((config.effectText !== undefined || config.sweat !== undefined) && t >= CUT_ONE_SHOT_DELAY) {
      oneShots.push({ id, at: CUT_ONE_SHOT_DELAY, key: `${id}@cut`, effectText: config.effectText, sweat: config.sweat });
    }
    const keys = (config.transitions ?? []).map((key, index) => ({ key, index })).sort((a, b) => a.key.at - b.key.at);
    for (const { key, index } of keys) {
      if (key.at > t) break;
      if (key.expression !== undefined) {
        state.expression = key.expression;
        state.expressionWeight = key.expressionWeight;
      }
      if (key.motion !== undefined) {
        state.motion = key.motion;
        state.motionLoop = key.motionLoop;
        state.motionAt = key.at;
      }
      if (key.lookAtTarget !== undefined) state.lookAtTarget = key.lookAtTarget;
      if (key.headTurn !== undefined) state.headTurn = key.headTurn;
      if (key.visible !== undefined) state.visible = key.visible;
      if (key.blush !== undefined) state.blush = key.blush;
      if (key.anger !== undefined) state.anger = key.anger;
      if (key.tears !== undefined) state.tears = key.tears;
      if (key.eyeWander !== undefined) state.eyeWander = eyeWanderIntensity(key.eyeWander);
      if (key.motionSpeed !== undefined) state.motionSpeed = key.motionSpeed;
      if (key.effectText !== undefined || key.sweat !== undefined) {
        oneShots.push({ id, at: key.at, key: `${id}@${index}`, effectText: key.effectText, sweat: key.sweat });
      }
    }
    if (Object.keys(state).length) avatars[id] = state;
  }
  const camera: CutCameraState = {};
  let focusLines = scene.focusLines ?? false;
  for (const key of [...(scene.transitions ?? [])].sort((a, b) => a.at - b.at)) {
    if (key.at > t) break;
    if (key.focusLines !== undefined) focusLines = key.focusLines;
    if (key.camera !== undefined || key.cameraPose !== undefined) {
      camera.shot = key.camera;
      camera.pose = key.cameraPose;
      camera.at = key.at;
      camera.duration = key.cameraTransitionDuration;
    }
  }
  return { avatars, camera, focusLines, oneShots };
}

/** カットの最後のキーフレームの時刻（タイムラインの長さの目安） */
export function lastKeyframeAt(scene: ScenarioScene): number {
  const times = [
    ...(scene.transitions ?? []).map((k) => k.at),
    ...Object.values(scene.avatars ?? {}).flatMap((a) => (a.transitions ?? []).map((k) => k.at)),
  ];
  return times.length ? Math.max(...times) : 0;
}

/** ムービーで、ボイスもキーもないカットの長さ（秒） */
export const MOVIE_STILL_CUT_SEC = 3;
/** ムービーで、ボイス・最後のキーが終わってから次のカットまでの既定の間（秒） */
export const MOVIE_CUT_GAP_SEC = 0.6;

/**
 * ムービーでのカットの長さ（秒）。duration があればそれ、なければボイスと最後のキーの遅い方に間を足す。
 * voiceSec はボイスの長さ（ボイスがなければ 0）
 */
export function movieCutDuration(scene: ScenarioScene, voiceSec: number): number {
  if (scene.duration !== undefined) return scene.duration;
  const body = Math.max(voiceSec, lastKeyframeAt(scene));
  if (body === 0) return scene.autoNextSec ?? MOVIE_STILL_CUT_SEC;
  return body + (scene.autoNextSec ?? MOVIE_CUT_GAP_SEC);
}
