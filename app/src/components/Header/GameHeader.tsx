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
    ja: '午前（行動）',
    en: 'Morning Action',
    className: 'phase-morning_action',
  },
  lunch_action: {
    ja: '昼休み（行動）',
    en: 'Lunch Action',
    className: 'phase-lunch_action',
  },
  afterschool_action: {
    ja: '放課後（行動）',
    en: 'Afterschool',
    className: 'phase-afterschool_action',
  },
  night: {
    ja: '夜（自室）',
    en: 'Night (My Room)',
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

      {/* 右側: AUTOボタン ＆ 言語切替 */}
      <div className="header-actions">
        {onToggleAuto && (
          <button
            type="button"
            className={`header-auto-btn ${isAuto ? 'active' : ''}`}
            onClick={onToggleAuto}
            aria-label="Toggle auto mode"
          >
            <span className="header-auto-icon" aria-hidden="true">
              ▶
            </span>
            <span>AUTO</span>
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
      </div>
    </header>
  );
};
