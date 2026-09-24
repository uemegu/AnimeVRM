/**
 * コミュニケーション機能（TV電話・LINE風メール）の型定義
 */

import { LocalizedString, ScenarioAvailability } from './scenario';

export type HeroineId = 'aoi' | 'emili' | 'shion';

/** TV電話の会話選択肢 */
export interface CallChoice {
  id: string;
  text: LocalizedString;
  goto: string;
  setFlags?: Record<string, boolean | number | string>;
  addAffinity?: Record<string, number>;
}

/** TV電話の1ステップ（セリフ・演出・表情） */
export interface CallSceneStep {
  id: string;
  speaker: LocalizedString;
  text: LocalizedString;
  expression?: string;
  expressionWeight?: number;
  motion?: string;
  choices?: CallChoice[];
  nextStepId?: string | null; // nullなら通話終了
  /** ボイス（'/' で始まらなければ通話のディレクトリからの相対パス） */
  voiceUrl?: string;
}

/**
 * 夜の電話・メールの共通項目。
 * 発生条件（availability）を満たすものが優先度順に選ばれ、1人のヒロインからは一晩に1件だけ届く
 */
export interface CommunicationMeta {
  id: string;
  characterId: HeroineId;
  title: LocalizedString;
  /** 発生条件（日付範囲・フラグ・先行シナリオ等）。time slot と場所は使わない */
  availability?: ScenarioAvailability;
  /** 同じヒロインで条件が重なったとき大きいものを優先（同値なら電話→メール、ディレクトリ名順） */
  priority?: number;
}

/** TV電話のシナリオパッケージ */
export interface CallScenario extends CommunicationMeta {
  modelUrl?: string; // 例: 私服モデル
  initialStepId: string;
  steps: Record<string, CallSceneStep>;
}

/** LINE風メールの1通のメッセージ */
export interface MailMessage {
  id: string;
  sender: 'heroine' | 'player';
  text: LocalizedString;
  time: string; // 例: "23:42"
}

/** LINE風メールの返信選択肢 */
export interface MailReplyOption {
  id: string;
  text: LocalizedString;
  reactionText: LocalizedString;
  reactionTime?: string;
  setFlags?: Record<string, boolean | number | string>;
  addAffinity?: Record<string, number>;
}

/** LINE風メールのシナリオ */
export interface MailScenario extends CommunicationMeta {
  /** 通知カードに出す本文プレビュー */
  previewText: LocalizedString;
  /** 通知カードに出す受信時刻 */
  time: string;
  messages: MailMessage[];
  replyOptions?: MailReplyOption[];
}

/** 今夜ヒロインから届く電話・メール（目次の情報のみ。本文は開くときに読み込む） */
export interface NightCommunication {
  kind: 'call' | 'mail';
  id: string;
  characterId: HeroineId;
  /** メール通知カード用 */
  previewText?: LocalizedString;
  time?: string;
  /** 今夜すでに応答・拒否・既読にした */
  done: boolean;
}

/** 電話・メールを終えたときの結果（ゲーム状態への反映は App 側で行う） */
export interface CommunicationResult {
  id: string;
  flags: Record<string, boolean | number | string>;
  affinityDelta: Record<string, number>;
  /** 選んだ選択肢・返信のID（履歴条件 after.choiceId から参照できる）。着信拒否は 'rejected' */
  choiceIds: string[];
}
