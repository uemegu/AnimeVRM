import { useCallback, useState } from 'react';
import { DayPhase } from '../types/game';
import { DialogueLogEntry, DialogueSession, MAX_HISTORY_SESSIONS } from '../types/history';
import { PHASE_NAMES } from '../data/phases';
import { useLanguage } from '../contexts/LanguageContext';

/** 履歴をまとめる単位（1日の1フェーズで再生した1シナリオ） */
export interface HistorySessionKey {
  day: number;
  phase: DayPhase;
  scenarioId?: string;
  locationName: string;
}

type NewLogEntry = Omit<DialogueLogEntry, 'id' | 'timestamp'>;

/** 会話履歴（バックログ）。直近 MAX_HISTORY_SESSIONS セッション分を保持する */
export function useDialogueHistory() {
  const { lang } = useLanguage();
  const [sessions, setSessions] = useState<DialogueSession[]>([]);

  const appendLog = useCallback(
    (key: HistorySessionKey, entry: NewLogEntry, isDuplicate: (last: DialogueLogEntry) => boolean) => {
      const sessionId = key.scenarioId ? `${key.day}_${key.phase}_${key.scenarioId}` : `${key.day}_${key.phase}`;

      setSessions((prev) => {
        let next = prev.map((session) => ({ ...session, logs: [...session.logs] }));
        let session = next.find((s) => s.id === sessionId);
        if (!session) {
          session = {
            id: sessionId,
            day: key.day,
            phase: key.phase,
            title: `Day ${key.day} ${PHASE_NAMES[key.phase][lang]}`,
            locationName: key.locationName,
            logs: [],
          };
          next.push(session);
          if (next.length > MAX_HISTORY_SESSIONS) next = next.slice(-MAX_HISTORY_SESSIONS);
        }

        const last = session.logs[session.logs.length - 1];
        if (!last || !isDuplicate(last)) {
          session.logs.push({
            ...entry,
            id: `${sessionId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toLocaleTimeString(),
          });
        }
        return next;
      });
    },
    [lang]
  );

  /** セリフ・地の文を記録（直前と同じ発言は記録しない） */
  const recordLine = useCallback(
    (key: HistorySessionKey, line: { speaker: string; text: string; voiceUrl?: string }) => {
      appendLog(key, line, (last) => last.text === line.text && last.speaker === line.speaker);
    },
    [appendLog]
  );

  /** 選んだ選択肢を記録 */
  const recordChoice = useCallback(
    (key: HistorySessionKey, choiceText: string) => {
      appendLog(
        key,
        { speaker: lang === 'ja' ? '選択' : 'Choice', text: choiceText, isChoice: true },
        (last) => Boolean(last.isChoice) && last.text === choiceText
      );
    },
    [appendLog, lang]
  );

  return { sessions, recordLine, recordChoice };
}
