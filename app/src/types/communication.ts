/**
 * コミュニケーション機能（TV電話・LINE風メール）の型定義
 */

import { LocalizedString } from './scenario';

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
}

/** TV電話のシナリオパッケージ */
export interface CallScenario {
  id: string;
  characterId: HeroineId;
  day: number;
  modelUrl?: string; // 例: 私服モデル
  title: LocalizedString;
  initialStepId: string;
  steps: Record<string, CallSceneStep>;
  /** 発生条件（指定フラグが真、または好感度条件など） */
  condition?: {
    requiredFlag?: string;
    minAffinity?: number;
  };
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
export interface MailScenario {
  id: string;
  characterId: HeroineId;
  day: number;
  previewText: LocalizedString;
  time: string;
  messages: MailMessage[];
  replyOptions?: MailReplyOption[];
  condition?: {
    requiredFlag?: string;
    minAffinity?: number;
  };
}

/** ヒロインごとの夜のコミュニケーション状態 */
export interface HeroineCommunicationStatus {
  characterId: HeroineId;
  statusText: LocalizedString; // 添付画像のアオイ「今、話せる？🌙」、エミリ「また話そーね！」等
  hasIncomingCall: boolean;
  incomingCallScenario?: CallScenario;
  unreadMailCount: number;
  activeMailScenario?: MailScenario;
  callCompleted: boolean;
  mailReplied: boolean;
}
