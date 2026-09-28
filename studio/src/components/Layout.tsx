import { NavLink, Outlet } from 'react-router';
import { useI18n, type Language } from '../i18n';
import { Icon, type IconName } from './Icon';
import { ToastProvider } from './Toast';
import './Layout.css';

interface NavItem {
  path: string;
  icon: IconName;
  label: (t: ReturnType<typeof useI18n>['t']) => string;
  ready: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/viewer', icon: 'viewer', label: (t) => t.nav.viewer, ready: true },
  { path: '/scenes', icon: 'scenes', label: (t) => t.nav.scenes, ready: true },
  { path: '/scenarios', icon: 'scenarios', label: (t) => t.nav.scenarios, ready: true },
  { path: '/player', icon: 'player', label: (t) => t.nav.player, ready: true },
  { path: '/characters', icon: 'characters', label: (t) => t.nav.characters, ready: true },
  { path: '/motions', icon: 'motions', label: (t) => t.nav.motions, ready: true },
];

export function Layout() {
  const { t, language, setLanguage } = useI18n();
  return (
    <div className="studio">
      <aside className="studio-sidebar">
        <div className="studio-brand">
          <div className="studio-brand-logo" aria-hidden="true">
            <svg viewBox="0 0 36 36" fill="none" className="studio-brand-svg">
              <defs>
                <linearGradient id="studio-brand-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="45%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
                <filter id="studio-brand-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#2563eb" floodOpacity="0.25" />
                </filter>
              </defs>
              <path
                d="M 8.5 27 L 17.2 6.8 C 17.6 5.8 18.4 5.8 18.8 6.8 L 27.2 24.8 C 27.8 26.2 26.8 27.6 25 27.6 C 23.8 27.6 22.8 26.6 22 25 L 19 19.5 L 13.5 19.5"
                stroke="url(#studio-brand-gradient)"
                strokeWidth="4.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#studio-brand-glow)"
              />
            </svg>
          </div>
          <div className="studio-brand-text">
            <span className="studio-brand-title">AnimeVRM</span>
            <span className="studio-brand-sub">Studio</span>
          </div>
        </div>
        <nav className="studio-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => `studio-nav-item${isActive ? ' active' : ''}`}>
              <Icon name={item.icon} />
              <span className="studio-nav-label">{item.label(t)}</span>
              {!item.ready && <span className="studio-nav-badge">{t.nav.comingSoon}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="studio-sidebar-footer">
          <div className="studio-lang" role="group" aria-label="Language">
            {(['ja', 'en'] as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                className={`studio-lang-btn${language === lang ? ' active' : ''}`}
                onClick={() => setLanguage(lang)}
              >
                {lang === 'ja' ? '日本語' : 'English'}
              </button>
            ))}
          </div>
        </div>
      </aside>
      <main className="studio-main">
        <ToastProvider>
          <Outlet />
        </ToastProvider>
      </main>
    </div>
  );
}

export function ComingSoon() {
  const { t } = useI18n();
  return (
    <div className="studio-coming-soon">
      <h1>{t.comingSoon.title}</h1>
      <p className="muted">{t.comingSoon.body}</p>
    </div>
  );
}
