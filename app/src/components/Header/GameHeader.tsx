import React from 'react';
import { DayPhase, getDayOfWeek } from '../../types/game';
import { SupportedLanguage } from '../../types/scenario';
import './GameHeader.css';

interface GameHeaderProps {
  day: number;
  phase: DayPhase;
  locationName?: string;
  isAuto?: boolean;
  onToggleAuto?: () => void;
  lang: SupportedLanguage;
  onToggleLanguage: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onOpenHistory?: () => void;
  onOpenLicense?: () => void;
}

const PHASE_LABELS: Record<
  DayPhase,
  { ja: string; en: string; className: string }
> = {
  morning: {
    ja: '朝（登校）',
    en: 'Morning',
    className: 'phase-morning',
  },
  morning_action: {
    ja: '午前',
    en: 'Morning Action',
    className: 'phase-morning_action',
  },
  lunch_action: {
    ja: '昼休み',
    en: 'Lunch Action',
    className: 'phase-lunch_action',
  },
  afterschool_action: {
    ja: '放課後',
    en: 'Afterschool',
    className: 'phase-afterschool_action',
  },
  night: {
    ja: '夜',
    en: 'Night',
    className: 'phase-night',
  },
};

export const GameHeader: React.FC<GameHeaderProps> = ({
  day,
  phase,
  locationName,
  isAuto = false,
  onToggleAuto,
  lang,
  onToggleLanguage,
  isMuted = false,
  onToggleMute,
  onOpenHistory,
  onOpenLicense,
}) => {
  const dayOfWeek = getDayOfWeek(day);
  const phaseInfo = PHASE_LABELS[phase];

  return (
    <header className="game-header">
      {/* 左側: 日付・時間帯・ロケーション */}
      <div className="header-day-info">
        {/* 日付バッジ (絵文字なし) */}
        <div className="day-badge">
          <span className="day-badge-inner">
            <span className="day-badge-text">Day {day}</span>
            <span className="day-badge-weekday">({dayOfWeek})</span>
          </span>
        </div>

        {/* 時間帯フェーズバッジ (絵文字なし) */}
        <div className={`phase-badge ${phaseInfo.className}`}>
          <span className="phase-badge-inner">
            <span className="phase-badge-text">{phaseInfo[lang]}</span>
          </span>
        </div>

        {/* ロケーションバッジ (時間帯の隣・絵文字なし) */}
        {locationName && (
          <div className="header-location-badge">
            <span className="header-location-inner">
              <span className="header-location-name">{locationName}</span>
            </span>
          </div>
        )}
      </div>

      {/* 右側: 履歴 ＆ AUTO ＆ ミュート ＆ 言語切替 ＆ ライセンス */}
      <div className="header-actions">
        {onOpenHistory && (
          <button
            type="button"
            className="header-action-btn header-history-btn"
            onClick={onOpenHistory}
            aria-label="Open dialogue history"
            title={lang === 'ja' ? '会話履歴 (L)' : 'Dialogue History (L)'}
          >
            <span className="header-action-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </span>
            <span>LOG</span>
          </button>
        )}

        {onToggleAuto && (
          <button
            type="button"
            className={`header-auto-btn ${isAuto ? 'active' : ''}`}
            onClick={onToggleAuto}
            aria-label="Toggle auto mode"
            title={lang === 'ja' ? '自動送り (A)' : 'Auto Advance (A)'}
          >
            <span className="header-auto-icon" aria-hidden="true">
              ▶
            </span>
            <span>AUTO</span>
          </button>
        )}

        {onToggleMute && (
          <button
            type="button"
            className={`header-action-btn header-mute-btn ${isMuted ? 'muted' : ''}`}
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
            title={
              isMuted
                ? lang === 'ja' ? '音声を再生 (M)' : 'Unmute Sound (M)'
                : lang === 'ja' ? '音声を消音 (M)' : 'Mute Sound (M)'
            }
          >
            <span className="header-action-icon" aria-hidden="true">
              {isMuted ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </span>
            <span>{isMuted ? 'MUTED' : 'MUTE'}</span>
          </button>
        )}

        <button
          type="button"
          className="header-lang-btn"
          onClick={onToggleLanguage}
          aria-label="Toggle language"
        >
          <span className="header-lang-icon" aria-hidden="true">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </span>
          <span>{lang.toUpperCase()}</span>
        </button>

        {onOpenLicense && (
          <button
            type="button"
            className="header-license-btn"
            onClick={onOpenLicense}
            aria-label="Licenses & Credits"
            title={lang === 'ja' ? 'ライセンス・素材クレジット' : 'Licenses & Credits'}
          >
            <span className="header-license-icon" aria-hidden="true">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </span>
            <span>INFO</span>
          </button>
        )}
      </div>
    </header>
  );
};
