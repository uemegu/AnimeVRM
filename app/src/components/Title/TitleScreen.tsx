import React from 'react';
import { SupportedLanguage } from '../../types/scenario';
import './TitleScreen.css';

export interface TitleScreenProps {
  hasSaveData: boolean;
  lang: SupportedLanguage;
  onStartGame: () => void;
  onContinueGame: () => void;
  onToggleLanguage: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSaveData,
  lang,
  onStartGame,
  onContinueGame,
  onToggleLanguage,
}) => {
  return (
    <div className="title-screen-container">
      {/* 左パネル: タイトルロゴ ＆ メニュー */}
      <section className="title-left-panel">
        <header className="title-logo-area">
          <h1 className="title-logo-main">
            {lang === 'ja' ? '5秒で告白' : '5 Seconds to Confess'}
          </h1>
          <p className="title-logo-sub">
            {lang === 'ja' ? 'Confession in 5 Seconds' : 'ゴビョウ デ コクハク'}
          </p>
        </header>

        <nav className="title-menu-list">
          {/* はじめから */}
          <button
            type="button"
            className="title-menu-btn"
            onClick={onStartGame}
            data-testid="btn-start"
          >
            <span className="title-menu-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            </span>
            <span className="title-menu-text">
              {lang === 'ja' ? 'はじめから' : 'New Game'}
            </span>
          </button>

          {/* つづきから */}
          <button
            type="button"
            className="title-menu-btn"
            onClick={onContinueGame}
            disabled={!hasSaveData}
            data-testid="btn-continue"
          >
            <span className="title-menu-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
            </span>
            <span className="title-menu-text">
              {lang === 'ja' ? 'つづきから' : 'Continue'}
            </span>
          </button>

          {/* 言語切替 */}
          <button
            type="button"
            className="title-menu-btn"
            onClick={onToggleLanguage}
            data-testid="btn-language"
          >
            <span className="title-menu-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </span>
            <span className="title-menu-text">
              {lang === 'ja' ? 'Language' : '言語'}
            </span>
          </button>
        </nav>

        <footer className="title-footer">
          <span>&copy; AnimeVRM Project</span>
        </footer>
      </section>

      {/* 右パネル: 3キャラの斜めスリット表示（文字なし・画像のみ） */}
      <section className="title-right-panel" aria-label="Character visual preview">
        <div className="title-slits-container">
          {/* 葵 (Aoi) */}
          <div className="title-slit-card" data-character="aoi">
            <div className="title-slit-inner">
              <img
                src="/assets/title/char_aoi.avif"
                alt=""
                className="title-slit-img"
                loading="eager"
              />
              <div className="title-slit-shine" />
            </div>
          </div>

          {/* エミリ (Emili) */}
          <div className="title-slit-card" data-character="emili">
            <div className="title-slit-inner">
              <img
                src="/assets/title/char_emili.avif"
                alt=""
                className="title-slit-img"
                loading="eager"
              />
              <div className="title-slit-shine" />
            </div>
          </div>

          {/* 紫苑 (Shion) */}
          <div className="title-slit-card" data-character="shion">
            <div className="title-slit-inner">
              <img
                src="/assets/title/char_shion.avif"
                alt=""
                className="title-slit-img"
                loading="eager"
              />
              <div className="title-slit-shine" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
