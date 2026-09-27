import { NavLink, Outlet } from 'react-router';
import { useI18n, type Language } from '../i18n';
import { Icon, type IconName } from './Icon';
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
  { path: '/motions', icon: 'motions', label: (t) => t.nav.motions, ready: false },
];

export function Layout() {
  const { t, language, setLanguage } = useI18n();
  return (
    <div className="studio">
      <aside className="studio-sidebar">
        <div className="studio-brand">
          <span className="studio-brand-mark" aria-hidden="true" />
          <span>{t.appName}</span>
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
        <Outlet />
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
