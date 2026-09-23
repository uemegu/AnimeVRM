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
  onShare?: () => void;
  isSharing?: boolean;
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
  onShare,
  isSharing = false,
}) => {
  const dayOfWeek = getDayOfWeek(day);
  const phaseInfo = PHASE_LABELS[phase];

  return (
    <header className="game-header" data-phase={phase}>
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
            <span className="header-btn-inner">
              <span className="header-btn-icon header-icon-log" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="15" height="15" x="4.5" y="4.5" rx="2" />
                  <line x1="2" y1="7.5" x2="4.5" y2="7.5" />
                  <line x1="2" y1="12" x2="4.5" y2="12" />
                  <line x1="2" y1="16.5" x2="4.5" y2="16.5" />
                  <line x1="9" y1="4.5" x2="9" y2="19.5" />
                </svg>
              </span>
              <span className="header-btn-label">LOG</span>
            </span>
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
            <span className="header-btn-inner">
              <span className="header-btn-icon header-icon-auto" aria-hidden="true">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6 4.5 19.5 12 6 19.5" />
                </svg>
              </span>
              <span className="header-btn-label">AUTO</span>
            </span>
          </button>
        )}

        {onShare && (
          <button
            type="button"
            className={`header-action-btn header-share-btn ${isSharing ? 'loading' : ''}`}
            onClick={onShare}
            disabled={isSharing}
            aria-label="Share to X"
            title={lang === 'ja' ? 'Xにシェア (S)' : 'Share to X (S)'}
          >
            <span className="header-btn-inner">
              <span className="header-btn-icon header-icon-share" aria-hidden="true">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </span>
              <span className="header-btn-label">SHARE</span>
            </span>
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
            <span className="header-btn-inner">
              <span className="header-btn-icon header-icon-mute" aria-hidden="true">
                {isMuted ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="m17 9 6 6m0-6-6 6" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                )}
              </span>
              <span className="header-btn-label">{isMuted ? 'MUTED' : 'MUTE'}</span>
            </span>
          </button>
        )}

        <button
          type="button"
          className="header-lang-btn"
          onClick={onToggleLanguage}
          aria-label="Toggle language"
        >
          <span className="header-btn-inner">
            <span className="header-btn-icon header-icon-lang" aria-hidden="true">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="8.5" />
                <line x1="3.5" y1="12" x2="20.5" y2="12" />
                <path d="M12 3.5a13 13 0 0 1 3.5 8.5 13 13 0 0 1-3.5 8.5 13 13 0 0 1-3.5-8.5 13 13 0 0 1 3.5-8.5z" />
              </svg>
            </span>
            <span className="header-btn-label">{lang.toUpperCase()}</span>
          </span>
        </button>

        {onOpenLicense && (
          <button
            type="button"
            className="header-license-btn"
            onClick={onOpenLicense}
            aria-label="Licenses & Credits"
            title={lang === 'ja' ? 'ライセンス・素材クレジット' : 'Licenses & Credits'}
          >
            <span className="header-btn-inner">
              <span className="header-btn-icon header-icon-license" aria-hidden="true">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <polyline points="14 3 14 9 20 9" />
                  <line x1="16" y1="14" x2="8" y2="14" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </span>
              <span className="header-btn-label">INFO</span>
            </span>
          </button>
        )}
      </div>
    </header>
  );
};
