import React, { useEffect, useRef } from 'react';
import { DialogueSession } from '../../types/history';
import './HistoryModal.css';
import { useLanguage } from '../../contexts/LanguageContext';

export interface HistoryModalProps {
  isOpen: boolean;
  sessions: DialogueSession[];
  onPlayVoice?: (voiceUrl: string) => void;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  sessions,
  onPlayVoice,
  onClose,
}) => {
  const { lang } = useLanguage();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 開いた時に一番下（最新発話）へ自動スクロール
  useEffect(() => {
    if (!isOpen) return;

    // DOM描画完了後に最下部へスクロール
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, sessions]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="history-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
      onClick={onClose}
    >
      <div
        className="history-modal-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <header className="history-modal-header">
          <div className="history-title-area">
            <div className="history-icon-badge" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <h2 id="history-modal-title" className="history-title-main">
              {lang === 'ja' ? '直近３セッションの会話履歴' : 'Recent 3 Sessions Dialogue History'}
            </h2>
          </div>

          <button
            type="button"
            className="history-close-btn"
            onClick={onClose}
            aria-label={lang === 'ja' ? '閉じる' : 'Close'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* セッション・ログ一覧 */}
        <div className="history-body-container" ref={scrollContainerRef}>
          {sessions.length === 0 ? (
            <div className="history-empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="history-empty-text">
                {lang === 'ja' ? '会話履歴はありません' : 'No dialogue history yet'}
              </span>
            </div>
          ) : (
            sessions.map((session) => (
              <section key={session.id} className="history-session-block">
                <header className="history-session-header">
                  <span className="history-session-title-tag">
                    {session.title}
                  </span>
                  {session.locationName && (
                    <span className="history-session-location-tag">
                      {session.locationName}
                    </span>
                  )}
                </header>

                <div className="history-logs-list">
                  {session.logs.map((entry) => (
                    <div
                      key={entry.id}
                      className={`history-log-row ${entry.isChoice ? 'history-log-row-choice' : ''}`}
                    >
                      <div className="history-log-speaker-row">
                        {entry.isChoice ? (
                          <span className="history-choice-badge">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {lang === 'ja' ? '選択' : 'Choice'}
                          </span>
                        ) : (
                          entry.speaker && (
                            <span className="history-speaker-badge">
                              {entry.speaker}
                            </span>
                          )
                        )}
                        {entry.voiceUrl && onPlayVoice && !entry.isChoice && (
                          <button
                            type="button"
                            className="history-voice-play-btn"
                            onClick={() => onPlayVoice(entry.voiceUrl!)}
                            title={lang === 'ja' ? '音声を再聴取' : 'Replay voice'}
                            aria-label="Replay voice"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <p className={`history-log-text ${entry.isChoice ? 'history-choice-text' : ''}`}>
                        {entry.text}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        {/* フッター */}
        <footer className="history-modal-footer">
          <span>
            {lang === 'ja'
              ? '※直近3セッション分の会話履歴を記録しています。'
              : 'Records dialogue from the last 3 sessions.'}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            [L] or [Esc] to close
          </span>
        </footer>
      </div>
    </div>
  );
};
