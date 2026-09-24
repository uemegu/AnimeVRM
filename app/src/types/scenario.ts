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

/** セリフ途中のアバター演出遷移キーフレーム（表情・モーション・視線等） */
export interface AvatarTransition {
  /** 発火タイミング（秒）- ボイス再生位置 or シーン経過時間 */
  at: number;
  expression?: string;
  expressionWeight?: number;
  motion?: string;
  motionLoop?: boolean;
  motionSpeed?: number;
  lookAtCamera?: boolean;
  headLookAtCamera?: boolean;
  eyeLookAtCamera?: boolean;
  lookAtTarget?: 'player' | 'speaker' | 'partner' | 'camera' | 'forward' | string;
  eyeWander?: boolean | number;
  eyeOffset?: [number, number];
  headOffset?: [number, number];
  faceTexture?: string;
  tears?: boolean;
  visible?: boolean;
}

/** セリフ途中のシーン全体遷移キーフレーム（カメラ・背景等） */
export interface SceneTransition {
  /** 発火タイミング（秒）- ボイス再生位置 or シーン経過時間 */
  at: number;
  cameraZoom?: string;
  cameraDistance?: number;
  cameraTransitionDuration?: number;
  cameraTransitionEasing?: string;
  cameraTarget?: AvatarSlotPosition | [number, number, number] | string;
  background?: string;
}

/** シーン内のアバター演出指定 */
export interface SceneAvatarConfig {
  characterId: string;
  motion?: string;
  expression?: string;
  expressionWeight?: number; // 原則 1.0 または 0.0
  position?: AvatarSlotPosition | [number, number, number];
  rotationY?: number;
  lookAtTarget?: 'player' | 'camera' | 'partner' | string;
  visible?: boolean;
  /** セリフ中の表情・モーション・視線遷移タイムライン（at 昇順で指定） */
  transitions?: AvatarTransition[];
}

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
  /** 選択肢の出現条件（指定フラグが一致する場合のみ表示） */
  condition?: {
    flag: string;
    value: boolean | number | string;
  };
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
  /** 日本語ボイス音声URL（※英語ボイスは作らない方針のため単一URLで管理）。'/' で始まらない場合はシナリオディレクトリからの相対パス */
  voiceUrl?: string;
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
  /** 選択肢（※選択肢がある場合は text を空にするのがプロジェクトルール） */
  choices?: ScenarioChoice[];
  /** シーン突入時のフラグ更新 */
  setFlags?: Record<string, boolean | number | string>;
  /** 画面フラッシュ演出 ('white' 等) */
  flashEffect?: 'white' | 'none';
  /** AUTOモード時のシーン送り待機秒数（未指定時はボイス長またはテキスト長から自動算出） */
  autoNextSec?: number;
  /** 時間帯指定（'day' | 'evening' | 'night' | 'divine' 等） */
  timeOfDay?: import('./visual').TimeOfDayId;
  /** セリフ中のカメラ・背景遷移タイムライン（at 昇順で指定） */
  transitions?: SceneTransition[];
}

import { ActionLocationId, DayPhase } from './game';

/** シナリオの発生時間帯。複数指定した場合は OR 条件 */
export type ScenarioTimeSlot = 'morning' | 'afternoon' | 'afterschool' | 'holiday';

/** 先行シナリオ、またはそこで選択された選択肢の条件 */
export interface ScenarioPrerequisite {
  scenarioId: string;
  /** 指定時はその選択肢を選んでいること、未指定時はシナリオ完了を要求 */
  choiceId?: string;
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
  /** 発生場所。複数指定した場合は OR 条件 */
  locations?: ActionLocationId[];
  /** 指定フラグがすべて立っていれば発生する */
  requireFlags?: string[];
  /** 指定フラグのいずれかが立っていれば発生しない（出会いイベントの重複防止等） */
  unlessFlags?: string[];
}

/** 行動ターン等における場所ヒント情報 */
export interface ActionLocationHint {
  locationId: ActionLocationId;
  hintCharacterIds?: string[];
  hintText?: LocalizedString;
  /** 対象フェーズ（未指定の場合は該当ロケーションの全行動フェーズで有効） */
  phases?: DayPhase[];
}

/** シナリオの種類（public/scenarios/<category>/ のディレクトリ名）。call / mail は夜の電話・メール */
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
  /** 初期登場キャラクター一覧 */
  characters?: Array<{
    id: string;
    modelUrl: string;
    initialPosition?: AvatarSlotPosition;
  }>;
  /** シーンリスト */
  scenes: ScenarioScene[];
}
