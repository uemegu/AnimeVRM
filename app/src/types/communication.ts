/**
 * コミュニケーション機能（TV電話・LINE風メール）の型定義
 */

import type { ChoiceCondition, Expression } from '@anime-vrm/scenario';
import { LocalizedString, ScenarioAvailability, TextContent } from './scenario';

export type HeroineId = 'aoi' | 'emili' | 'shion';

/** TV電話の会話選択肢 */
export interface CallChoice {
  id: string;
  text: LocalizedString;
  goto: string;
  setFlags?: Record<string, boolean | number | string>;
  addAffinity?: Record<string, number>;
  /** 条件を満たすときだけ表示する（★の選択肢など） */
  condition?: ChoiceCondition;
}

/** TV電話の1ステップ（セリフ・演出・表情） */
export interface CallSceneStep {
  id: string;
  speaker: LocalizedString;
  text: LocalizedString;
  expression?: Expression;
  expressionWeight?: number;
  motion?: string;
  choices?: CallChoice[];
  nextStepId?: string | null; // nullなら通話終了
  /** ボイス（'/' で始まらなければ通話のディレクトリからの相対パス） */
  voiceUrl?: string;
  /** @deprecated 旧データの読み込み用。開口度は音声解析だけで決まる */
  voiceWhisper?: boolean;
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
  /** 音声のみの通話（相手の姿を映さない） */
  audioOnly?: boolean;
  initialStepId: string;
  steps: Record<string, CallSceneStep>;
}

/** メールの吹き出しの中身（本文・スタンプ・写真のどれか1つ以上） */
export interface MailContent {
  text?: TextContent;
  /** スタンプの画像 URL */
  stamp?: string;
  /** 写真の画像 URL */
  image?: string;
  /** 届いてからこの秒数で「送信を取り消しました」に変わる */
  retractAfterSec?: number;
}

/** LINE風メールの1通のメッセージ */
export interface MailMessage extends MailContent {
  id: string;
  sender: 'heroine' | 'player';
  time: string; // 例: "23:42"
}

/** 返信のあとに相手から届くメッセージ */
export interface MailReaction extends MailContent {
  time?: string;
}

/** LINE風メールの返信選択肢 */
export interface MailReplyOption {
  id: string;
  text: TextContent;
  /** 返信への反応（1通） */
  reactionText?: TextContent;
  reactionTime?: string;
  /** 返信への反応（順に届く。スタンプ・写真も送れる） */
  reactions?: MailReaction[];
  setFlags?: Record<string, boolean | number | string>;
  addAffinity?: Record<string, number>;
  /** 条件を満たすときだけ表示する */
  condition?: ChoiceCondition;
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
