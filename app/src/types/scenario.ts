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

/** シーン内のアバター演出指定（前のシーンの指定を引き継ぎ、書いた項目だけ上書きする） */
export interface SceneAvatarConfig {
  /** 省略時はキー名をキャラIDとして使う */
  characterId?: string;
  /** public/animations/<motion>.fbx */
  motion?: string;
  /** モーションをループするか（省略時は data/motions.ts の設定。false なら1回再生して待機モーションに戻る） */
  motionLoop?: boolean;
  /** モデルを差し替える（省略時はキャラの既定モデル。休日は私服） */
  modelUrl?: string;
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
  /** カメラの構図（省略時は登場人数と話者から自動） */
  camera?: CameraShot;
  /** true なら前のシーンの登場キャラを全員下げてから avatars を適用する */
  clearCast?: boolean;
  /**
   * 歩きながらの会話などで、背景を横に流し続ける（以降のシーンに引き継ぐ。false で止めて通常の背景に戻す）
   */
  scrollingBackground?: ScrollingBackgroundConfig | false;
  /** 選択肢の制限時間（秒）と時間切れ時の分岐。省略時は10秒で1番目を自動選択 */
  choiceTimeout?: {
    seconds: number;
    /** 時間切れ時の分岐先（省略時は1番目の選択肢を選ぶ） */
    goto?: string;
    setFlags?: Record<string, boolean | number | string>;
  };
}

/** 流れる背景の指定（省略した項目は既定値） */
export interface ScrollingBackgroundConfig {
  /** 流す画像（省略時はその時の場所の遠景） */
  textureUrl?: string;
  /** 流れる速さ（既定 0.65。0 で止まる） */
  speed?: number;
  /** ぼかし 0.0〜1.0（既定 1.0。キャラに視線を集める） */
  blur?: number;
  /** 流れる向き（既定 left） */
  direction?: 'left' | 'right';
  /** つなぎ目をぼかす幅（既定 0.2） */
  featherWidth?: number;
}

/**
 * カメラの構図。極端な接写は禁止（開発ルール）なので close でもバストアップまで
 * - wide: 登場キャラ全員が入る引き
 * - medium: 話者を中心に隣の人物も入る会話ショット
 * - speaker: 話者のウェストアップ（1人の場面の既定）
 * - close: 話者のバストアップ（感情の強調）
 */
export type CameraShot = 'wide' | 'medium' | 'speaker' | 'close';

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
