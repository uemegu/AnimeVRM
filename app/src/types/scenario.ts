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
}

/** 選択肢定義 */
export interface ScenarioChoice {
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

/** シーン（1セリフ / 1演出ステップ）の定義 */
export interface ScenarioScene {
  id: string;
  /** 話者名（地の文の場合は未指定または空文字） */
  speaker?: TextContent;
  /** 話者キャラクターID（アイコンやフォーカス用） */
  speakerCharacterId?: string;
  /** セリフ・地の文本文 */
  text: TextContent;
  /** 日本語ボイス音声URL（※英語ボイスは作らない方針のため単一URLで管理） */
  voiceUrl?: string;
  /** 背景画像URLまたはプリセットキー */
  background?: string;
  /** BGM URL */
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
}

/** シナリオパッケージ（1本のイベントシナリオ） */
export interface ScenarioPackage {
  id: string;
  title: TextContent;
  /** 初期登場キャラクター一覧 */
  characters?: Array<{
    id: string;
    modelUrl: string;
    initialPosition?: AvatarSlotPosition;
  }>;
  /** シーンリスト */
  scenes: ScenarioScene[];
}
