import React from 'react';
import { SupportedLanguage } from '../../types/scenario';
import './TitleScreen.css';

export interface TitleScreenProps {
  hasSaveData: boolean;
  lang: SupportedLanguage;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onStartGame: () => void;
  onContinueGame: () => void;
  onToggleLanguage: () => void;
  onOpenLicense?: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSaveData,
  lang,
  isMuted = false,
  onToggleMute,
  onStartGame,
  onContinueGame,
  onToggleLanguage,
  onOpenLicense,
}) => {
  return (
    <div className="title-screen-container" lang={lang}>
      <div className="title-petals" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <span key={index} />)}
      </div>
      {/* 左パネル: タイトルロゴ ＆ メニュー */}
      <section className="title-left-panel">
        <header className="title-logo-area">
          <h1 className="title-logo-main" aria-label={lang === 'ja' ? '5秒で告白' : '5 Seconds to Confess'}>
            <span className="title-logo-number" aria-hidden="true">5</span>
            <span className="title-logo-words" aria-hidden="true">
              {lang === 'ja' ? <>秒<span className="title-logo-particle">で</span>告白</> : <>Seconds<span className="title-logo-english-line">to Confess</span></>}
            </span>
          </h1>
          <p className="title-logo-sub">
            {lang === 'ja' ? (
              <>
                Confession in<br />5 Seconds
              </>
            ) : (
              'ゴビョウ デ コクハク'
            )}
          </p>
        </header>

        <nav className="title-menu-list" aria-label={lang === 'ja' ? 'タイトルメニュー' : 'Title menu'}>
          {/* はじめから */}
          <button
            type="button"
            className="title-menu-btn title-menu-start"
            onClick={onStartGame}
            data-testid="btn-start"
          >
            <span className="title-menu-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 3.5 21 12 6 20.5Z" />
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

          {/* サウンド ミュート/解除 */}
          {onToggleMute && (
            <button
              type="button"
              className={`title-menu-btn ${isMuted ? 'muted' : ''}`}
              onClick={onToggleMute}
              data-testid="btn-mute"
              aria-pressed={isMuted}
            >
              <span className="title-menu-icon" aria-hidden="true">
                {isMuted ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="m17 9 6 6m0-6-6 6" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                )}
              </span>
              <span className="title-menu-text">
                {isMuted
                  ? lang === 'ja' ? 'サウンド: 消音中' : 'Sound: Muted'
                  : lang === 'ja' ? 'サウンド: ON' : 'Sound: ON'}
              </span>
            </button>
          )}

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
          {onOpenLicense && (
            <div className="title-sub-menu">
              <button
                type="button"
                className="title-sub-menu-btn"
                onClick={onOpenLicense}
                data-testid="btn-license"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>{lang === 'ja' ? 'ライセンス・素材クレジット' : 'Licenses & Credits'}</span>
              </button>
            </div>
          )}
          <span className="title-copyright">&copy; AnimeVRM Project</span>
        </footer>
      </section>

      {/* 既存の画像を、傾きが平行な3枚の写真パネルに切り抜く。 */}
      <section className="title-right-panel" aria-label={lang === 'ja' ? '3人のヒロイン' : 'The three heroines'}>
        <div className="title-slits-container">
          {/* アオイ (Aoi) */}
          <div className="title-slit-card" data-character="aoi">
            <div className="title-slit-inner">
              <div className="title-slit-motion">
                <img
                  src="/assets/title/char_shion.avif"
                  alt={lang === 'ja' ? 'シオン' : 'Shion'}
                  className="title-slit-img"
                  loading="eager"
                />
              </div>
              <div className="title-slit-shine" />
            </div>
          </div>

          {/* エミリ (Emili) */}
          <div className="title-slit-card" data-character="emili">
            <div className="title-slit-inner">
              <div className="title-slit-motion">
                <img
                  src="/assets/title/char_emili.avif"
                  alt={lang === 'ja' ? 'エミリ' : 'Emili'}
                  className="title-slit-img"
                  loading="eager"
                />
              </div>
              <div className="title-slit-shine" />
            </div>
          </div>

          {/* シオン (Shion) */}
          <div className="title-slit-card" data-character="shion">
            <div className="title-slit-inner">
              <div className="title-slit-motion">
                <img
                  src="/assets/title/char_aoi.avif"
                  alt={lang === 'ja' ? 'アオイ' : 'Aoi'}
                  className="title-slit-img"
                  loading="eager"
                />
              </div>
              <div className="title-slit-shine" />
            </div>
          </div>
        </div>
      </section>

      <div className="title-handwritten" aria-hidden="true">
        <span>5 Seconds</span>
        <span>to a New Story</span>
      </div>

      <aside className="title-editorial-copy">
        <p className="title-tagline">
          {lang === 'ja' ? (
            <><span>いつもの景色が</span><span>少しだけ、特別になる。</span></>
          ) : (
            <><span>The familiar everyday.</span><span>A little more extraordinary.</span></>
          )}
        </p>
        <p className="title-closing-copy" lang="en">
          Same<br />everyday.<br />A different<br />tomorrow.
        </p>
      </aside>
    </div>
  );
};
