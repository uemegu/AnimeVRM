/**
 * ギャルゲーアプリ シナリオデータ・多言語一元化型定義
 */

/** 多言語対応文字列（英語はオプショナル、日本語必須） */
export interface LocalizedString {
  ja: string;
  en?: string;
}

export type TextContent = string | LocalizedString;

/** アプリ対応言語 */
export type SupportedLanguage = 'ja' | 'en';

/** テキスト解決ヘルパー */
export function resolveLocalizedText(text: TextContent | undefined, lang: SupportedLanguage = 'ja'): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.ja;
}

/** キャラクター立ち位置スロット */
export type AvatarSlotPosition = 'left' | 'right' | 'center';

/**
 * シーンの演出（アバター・カメラ・タイムライン・画面演出）の型は共有スキーマ（packages/scenario）の定義を使う
 */
export type {
  AvatarTransition,
  ChoiceCondition,
  CutinConfig,
  StillImageConfig,
  CameraPose,
  CameraShift,
  CameraShot,
  EffectText,
  SceneAvatarConfig,
  SceneTransition,
  ScreenTransition,
  ScrollingBackgroundConfig,
  SweatMode,
} from '@anime-vrm/scenario';
import type {
  ChoiceCondition,
  CutinConfig,
  StillImageConfig,
  CameraPose,
  CameraShift,
  CameraShot,
  SceneAvatarConfig,
  SceneTransition,
  ScreenTransition,
  ScrollingBackgroundConfig,
} from '@anime-vrm/scenario';

/** 選択肢定義 */
export interface ScenarioChoice {
  /** 履歴条件から参照するID（未指定時は goto 先シーンIDを使用） */
  id?: string;
  /** 選択肢文言（多言語対応） */
  text: TextContent;
  /** 分岐先シーンID（goto） */
  goto: string;
  /** 選択時に更新・設定するフラグ群 */
  setFlags?: Record<string, boolean | number | string>;
  /** 選択時に好感度を加算する設定 (キャラID -> 加算値) */
  addAffinity?: Record<string, number>;
  /** 選択肢の出現条件（フラグ・好感度。書いた項目をすべて満たす場合のみ表示） */
  condition?: ChoiceCondition;
}

import { BgmId } from '../data/bgmPresets';

/** シーン（1セリフ / 1演出ステップ）の定義 */
export interface ScenarioScene {
  id: string;
  /** 話者名（地の文の場合は未指定または空文字） */
  speaker?: TextContent;
  /** 話者キャラクターID（アイコンやフォーカス用） */
  speakerCharacterId?: string;
  /** セリフ・地の文本文 */
  text: TextContent;
  /** この条件を満たさないときは、このシーンを飛ばして次へ進む */
  condition?: ChoiceCondition;
  /** 日本語ボイス音声URL（※英語ボイスは作らない方針のため単一URLで管理）。'/' で始まらない場合はシナリオディレクトリからの相対パス */
  voiceUrl?: string;
  /** @deprecated 旧データの読み込み用。開口度は音声解析だけで決まる */
  voiceWhisper?: boolean;
  /** 背景画像URLまたはプリセットキー */
  background?: string;
  /** BGM ID または URL */
  bgm?: BgmId | string;
  /** @deprecated BGM URL (互換性用) */
  bgmUrl?: string;
  /** 効果音 URL */
  seUrl?: string;
  /** 登場キャラクター演出マップ (スロット/キャラID -> 演出設定) */
  avatars?: Record<string, SceneAvatarConfig>;
  /** 次のシーンID（未指定の場合は配列の次シーンへ自動進行） */
  nextSceneId?: string;
  /** true ならこのシーンのあとシナリオを終える */
  end?: true;
  /** 選択肢（※選択肢がある場合は text を空にするのがプロジェクトルール） */
  choices?: ScenarioChoice[];
  /** シーン突入時のフラグ更新 */
  setFlags?: Record<string, boolean | number | string>;
  /** 画面フラッシュ演出 ('white' 等) */
  flashEffect?: 'white' | 'none';
  /** このカットの画面の切り替え演出（暗転・瞼を閉じる・まばたき） */
  screenTransition?: ScreenTransition;
  /** このカットの間、集中線を出す */
  focusLines?: boolean;
  /** AUTOモード時のシーン送り待機秒数（未指定時はボイス長またはテキスト長から自動算出） */
  autoNextSec?: number;
  /** 時間帯指定（'day' | 'evening' | 'night' | 'divine' 等） */
  timeOfDay?: import('./visual').TimeOfDayId;
  /** セリフ中のカメラ・背景遷移タイムライン（at 昇順で指定） */
  transitions?: SceneTransition[];
  /** カメラの構図（省略時は登場人数と話者から自動） */
  camera?: CameraShot;
  /** 構図からカメラを上下左右へずらす（省略で真ん中） */
  cameraShift?: CameraShift;
  /** カメラの直接指定（camera より優先。このカットだけに効く） */
  cameraPose?: CameraPose;
  /** true なら前のシーンの登場キャラを全員下げてから avatars を適用する */
  clearCast?: boolean;
  /**
   * 歩きながらの会話などで、背景を横に流し続ける（以降のシーンに引き継ぐ。false で止めて通常の背景に戻す）
   */
  scrollingBackground?: ScrollingBackgroundConfig | false;
  /** 雨を降らせる。以降のシーンに引き継ぎ、false で止める */
  rain?: boolean;
  /** 画面いっぱいの一枚絵。以降のシーンに引き継ぎ、false で消す */
  cg?: string | StillImageConfig | false;
  /** 舞台の端に載せるカットイン。以降のシーンに引き継ぎ、false で消す */
  cutin?: string | CutinConfig | false;
  /** 条件に合う選択肢がないときの扱い（highest_affinity: 好感度が最も高いキャラの選択肢を1つ出す） */
  choiceFallback?: 'highest_affinity';
  /** 特殊効果（花火など）。true でこのシーンから始め、false で止める。効果ごとに以降のシーンに引き継ぐ */
  effects?: { fireworks?: boolean; crowd?: boolean };
  /** 選択肢の制限時間（秒）と時間切れ時の分岐。省略時は10秒で1番目を自動選択 */
  choiceTimeout?: {
    seconds: number;
    /** 時間切れ時の分岐先（省略時は1番目の選択肢を選ぶ） */
    goto?: string;
    setFlags?: Record<string, boolean | number | string>;
  };
}

import { ActionLocationId, DayPhase } from './game';

/** シナリオの発生時間帯。複数指定した場合は OR 条件 */
export type ScenarioTimeSlot = 'morning' | 'afternoon' | 'afterschool' | 'holiday' | 'evening';

/** 先行シナリオ、またはそこで選択された選択肢の条件 */
export interface ScenarioPrerequisite {
  scenarioId: string;
  /** 指定時はその選択肢を選んでいること、未指定時はシナリオ完了を要求 */
  choiceId?: string;
  /** その日のうちに満たしたこと */
  sameDay?: boolean;
}

/** all 内は AND、any 内は OR。両方指定した場合はグループ同士も AND */
export interface ScenarioPrerequisites {
  all?: ScenarioPrerequisite[];
  any?: ScenarioPrerequisite[];
}

/** シナリオのスケジュール・解放条件 */
export interface ScenarioAvailability {
  /** 先行シナリオ条件。未指定なら履歴による制限なし */
  after?: ScenarioPrerequisites;
  /** 発生時間帯。指定値のいずれかに一致すれば有効 */
  timeSlots?: ScenarioTimeSlot[];
  /** 発生日の両端を含む範囲。未指定なら上下限なし */
  dayRange?: { from?: number; to?: number };
  /** この日のどれかで発生 */
  days?: number[];
  /** 天気（雨の日は data/calendar.ts） */
  weather?: Array<'clear' | 'rain'>;
  /** 発生場所。複数指定した場合は OR 条件 */
  locations?: ActionLocationId[];
  /** 指定フラグがすべて立っていれば発生する */
  requireFlags?: string[];
  /** 指定フラグのいずれかが立っていれば発生しない（出会いイベントの重複防止等） */
  unlessFlags?: string[];
  /** 好感度の下限（キャラID → 値。すべて満たすこと） */
  minAffinity?: Record<string, number>;
  /** 好感度の上限（キャラID → 値。値より小さいこと） */
  maxAffinity?: Record<string, number>;
}

/** 行動ターン等における場所ヒント情報 */
export interface ActionLocationHint {
  locationId: ActionLocationId;
  hintCharacterIds?: string[];
  hintText?: LocalizedString;
  /** 対象フェーズ（未指定の場合は該当ロケーションの全行動フェーズで有効） */
  phases?: DayPhase[];
}

/** シナリオの種類（assets/scenarios/<category>/ のディレクトリ名）。call / mail は夜の電話・メール */
export type ScenarioCategory =
  | 'morning'
  | 'action'
  | 'holiday'
  | 'forced'
  | 'ending'
  | 'special'
  | 'call'
  | 'mail';

/**
 * シナリオのメタ情報（発生判定・場所ヒントに使う部分）。
 * 起動時に scenarioIndex.json から同期的に参照でき、本文（シーン）は再生時に遅延ロードする。
 */
export interface ScenarioMeta {
  id: string;
  title: TextContent;
  /** 舞台となる場所。場所選択を経ずに始まるシナリオ（強制イベント等）の背景に使う */
  location?: string;
  /** 条件に合うシナリオが他にないときだけ選ばれる汎用シナリオ */
  fallback?: boolean;
  /** 強制イベントがその時間帯の行動を使い切る（終わったら場所選択に戻らず次の時間帯へ） */
  consumesTurn?: boolean;
  /** 未指定項目は制限なし。従来の actionHints があればその場所・フェーズ制約は別途適用 */
  availability?: ScenarioAvailability;
  /** 条件が重なる候補内で大きいものを優先（同値なら定義順） */
  priority?: number;
  /** 行動ターン等における場所ヒント情報（1つまたは複数） */
  actionHints?: ActionLocationHint[];
}

/** scenarioIndex.json の1件（メタ情報＋所在） */
export interface ScenarioIndexEntry extends ScenarioMeta {
  category: ScenarioCategory;
  /** 電話・メールの相手 */
  characterId?: import('./communication').HeroineId;
  /** メール通知カード用のプレビューと受信時刻 */
  previewText?: LocalizedString;
  time?: string;
  /** シナリオディレクトリのURL（末尾スラッシュ付き）。相対指定のボイス等はここを基準に解決する */
  baseUrl: string;
}

/** シナリオパッケージ（1本のイベントシナリオ。scenario.json の中身） */
export interface ScenarioPackage extends ScenarioMeta {
  /** 開始時の BGM（ID または URL。'silence' で無音）。シーンの bgm 指定で切り替わり、以降のシーンに引き継がれる */
  bgm?: string;
  /** 開始時の時間帯（省略時はフェーズから） */
  timeOfDay?: import('./visual').TimeOfDayId;
  /** 初期登場キャラクター一覧 */
  characters?: Array<{
    id: string;
    modelUrl: string;
    initialPosition?: AvatarSlotPosition;
  }>;
  /** シーンリスト */
  scenes: ScenarioScene[];
}
