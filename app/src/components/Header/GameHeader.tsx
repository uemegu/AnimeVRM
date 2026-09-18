import React from 'react';
import { DayPhase, getDayOfWeek } from '../../types/game';
import { SupportedLanguage } from '../../types/scenario';

interface GameHeaderProps {
  day: number;
  phase: DayPhase;
  lang: SupportedLanguage;
  onToggleLanguage: () => void;
}

const PHASE_LABELS: Record<DayPhase, { ja: string; en: string }> = {
  morning: { ja: '朝（登校）', en: 'Morning' },
  morning_action: { ja: '午前（行動）', en: 'Morning Action' },
  lunch_action: { ja: '昼休み（行動）', en: 'Lunch Action' },
  afterschool_action: { ja: '放課後（行動）', en: 'Afterschool' },
  night: { ja: '夜（自室）', en: 'Night (My Room)' },
};

export const GameHeader: React.FC<GameHeaderProps> = ({
  day,
  phase,
  lang,
  onToggleLanguage,
}) => {
  const dayOfWeek = getDayOfWeek(day);

  return (
    <header className="game-header">
      <div className="header-day-info">
        <span className="day-badge">
          Day {day} ({dayOfWeek})
        </span>
        <span className="phase-badge">{PHASE_LABELS[phase][lang]}</span>
      </div>
      <div>
        <button
          onClick={onToggleLanguage}
          style={{
            background: '#334155',
            color: '#fff',
            border: '1px solid #64748b',
            padding: '5px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}
        >
          🌐 {lang.toUpperCase()}
        </button>
      </div>
    </header>
  );
};
