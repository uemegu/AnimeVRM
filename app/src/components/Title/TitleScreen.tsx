import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CHARACTERS } from '../../data/characters';
import { soundManager } from '../../services/audio/SoundManager';
import { useSoundMuted } from '../../hooks/useSoundMuted';
import './TitleScreen.css';
import { useLanguage } from '../../contexts/LanguageContext';

export interface TitleScreenProps {
  hasSaveData: boolean;
  onStartGame: () => void;
  onContinueGame: () => void;
  onStartGodExperiment?: () => void;
  onOpenLicense?: () => void;
}

type HeroineId = 'shion' | 'emili' | 'aoi';

// 左から順に並ぶ3枚。slot は配置、id は写っているキャラ。
const PORTRAITS: { slot: 'left' | 'center' | 'right'; id: HeroineId; src: string }[] = [
  { slot: 'left', id: 'shion', src: '/assets/title/char_shion.avif' },
  { slot: 'center', id: 'emili', src: '/assets/title/char_emili.avif' },
  { slot: 'right', id: 'aoi', src: '/assets/title/char_aoi.avif' },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSaveData,
  onStartGame,
  onContinueGame,
  onStartGodExperiment,
  onOpenLicense,
}) => {
  const { lang, toggleLanguage } = useLanguage();
  const isMuted = useSoundMuted();
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const [focusedHeroine, setFocusedHeroine] = useState<HeroineId | null>(null);

  // マウス位置を -1〜1 の CSS 変数に流し、層ごとに違う量だけ動かす。
  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return;
    const el = containerRef.current;
    if (!el) return;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((clientY - rect.top) / rect.height) * 2 - 1;
      el.style.setProperty('--title-mx', x.toFixed(3));
      el.style.setProperty('--title-my', y.toFixed(3));
    });
  }, []);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  return (
    <div
      ref={containerRef}
      className="title-screen-container"
      data-focus={focusedHeroine ?? undefined}
      onPointerMove={handlePointerMove}
    >
      <div className="title-light-leak" aria-hidden="true" />
      <div className="title-petals" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <span key={index} />)}
      </div>
      {/* 左パネル: タイトルロゴ ＆ メニュー */}
      <section className="title-left-panel">
        <header className="title-logo-area">
          <h1 className="title-logo-main" aria-label={lang === 'ja' ? '5秒で告白' : '5 Seconds to Confess'}>
            <span className="title-logo-number" aria-hidden="true">
              {/* 5秒で一周するカウントダウンの輪 */}
              <svg className="title-logo-timer" viewBox="0 0 100 100">
                <circle className="title-logo-timer-track" cx="50" cy="50" r="46" />
                <circle className="title-logo-timer-arc" cx="50" cy="50" r="46" pathLength="100" />
              </svg>
              5
            </span>
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

          {/* 神社・女神実験シナリオ（開発時のみ） */}
          {import.meta.env.DEV && onStartGodExperiment && (
            <button
              type="button"
              className="title-menu-btn title-menu-dev"
              onClick={onStartGodExperiment}
              data-testid="btn-god-experiment"
            >
              <span className="title-menu-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </span>
              <span className="title-menu-text">
                {lang === 'ja' ? '神社イベント実験' : 'God Experiment'}
              </span>
            </button>
          )}
        </nav>

        <footer className="title-footer">
          <div className="title-quick-actions">
            {/* サウンド ミュート/解除 */}
            <button
              type="button"
              className={`title-icon-btn ${isMuted ? 'muted' : ''}`}
              onClick={soundManager.toggleMuted}
              data-testid="btn-mute"
              aria-pressed={isMuted}
              aria-label={isMuted
                ? lang === 'ja' ? 'サウンド: 消音中' : 'Sound: Muted'
                : lang === 'ja' ? 'サウンド: ON' : 'Sound: ON'}
              title={isMuted
                ? lang === 'ja' ? 'サウンド: 消音中' : 'Sound: Muted'
                : lang === 'ja' ? 'サウンド: ON' : 'Sound: ON'}
            >
              {isMuted ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="m17 9 6 6m0-6-6 6" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>

            {/* 言語切替 */}
            <button
              type="button"
              className="title-icon-btn"
              onClick={toggleLanguage}
              data-testid="btn-language"
              aria-label={lang === 'ja' ? 'Language' : '言語'}
              title={lang === 'ja' ? 'Language' : '言語'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span className="title-icon-btn-label" aria-hidden="true">{lang === 'ja' ? 'EN' : 'JA'}</span>
            </button>
          </div>

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

      {/* 傾きが平行な3枚の写真パネル。乗せたキャラが主役になる。 */}
      <section className="title-right-panel" aria-label={lang === 'ja' ? '3人のヒロイン' : 'The three heroines'}>
        <div className="title-slits-container">
          {PORTRAITS.map(({ slot, id, src }) => (
            <div
              key={id}
              className="title-slit-card"
              data-slot={slot}
              data-character={id}
              style={{ '--heroine-color': CHARACTERS[id].themeColor } as React.CSSProperties}
              onPointerEnter={() => setFocusedHeroine(id)}
              onPointerLeave={() => setFocusedHeroine((current) => (current === id ? null : current))}
            >
              <div className="title-slit-inner">
                <div className="title-slit-motion">
                  <img
                    src={src}
                    alt={CHARACTERS[id].name[lang]}
                    className="title-slit-img"
                    loading="eager"
                  />
                </div>
                <div className="title-slit-shine" />
                <div className="title-slit-name" aria-hidden="true">
                  <span className="title-slit-name-ja">{CHARACTERS[id].name.ja}</span>
                  <span className="title-slit-name-en">{CHARACTERS[id].name.en}</span>
                </div>
              </div>
            </div>
          ))}
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
