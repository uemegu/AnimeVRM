/**
 * 会話履歴（直近3セッション）用型定義
 */

import { DayPhase } from './game';

export interface DialogueLogEntry {
  id: string;
  speaker: string;
  text: string;
  voiceUrl?: string;
  timestamp?: string;
  isChoice?: boolean;
}

export interface DialogueSession {
  id: string;
  day: number;
  phase: DayPhase;
  title: string;
  locationName?: string;
  logs: DialogueLogEntry[];
}

export const MAX_HISTORY_SESSIONS = 3;
