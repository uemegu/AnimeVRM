import '../src/styles/global.css';
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ScenarioPackage } from '@anime-vrm/scenario';
import { LanguageProvider, useI18n } from '../src/i18n';
import { ScenarioPlayer } from '../src/player/ScenarioPlayer';
import { ScenarioCatalog } from '../src/player/ScenarioCatalog';
import { loadPlayerData, type PlayerData } from '../src/player/playerData';
import { PAGES_ENTRIES } from './catalog';
import './pages.css';

// シナリオはビルドに含める（小さいので一覧の表示に使う）
const files = import.meta.glob<unknown>('../../assets/scenarios/demo/*/scenario.json', { eager: true, import: 'default' });
const SCENARIOS = new Map(
  Object.values(files).map((json) => {
    const scenario = ScenarioPackage.parse(json);
    return [scenario.id, scenario] as const;
  })
);

const text = (value: ScenarioPackage['title'] | undefined, language: 'ja' | 'en') =>
  value === undefined ? '' : typeof value === 'string' ? value : ((language === 'en' ? value.en : undefined) ?? value.ja);

/** URL の #/<id> で再生するシナリオを選ぶ */
function useHashId(): [string | null, (id: string | null) => void] {
  const read = () => decodeURIComponent(location.hash.replace(/^#\/?/, '')) || null;
  const [id, setId] = useState(read);
  useEffect(() => {
    const onHash = () => setId(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return [id, (next) => (location.hash = next ? `/${next}` : '')];
}

function PagesApp() {
  const { t, language, setLanguage } = useI18n();
  const [id, setId] = useHashId();
  const [data, setData] = useState<PlayerData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadPlayerData().then(setData, () => setError(true));
  }, []);

  const entries = useMemo(
    () =>
      PAGES_ENTRIES.flatMap((entry) => {
        const scenario = SCENARIOS.get(entry.id);
        if (!scenario) return [];
        const location = scenario.location ? data?.locations[scenario.location] : undefined;
        return [{ key: entry.id, title: text(scenario.title, language), description: text(scenario.description, language), image: entry.ogp ?? location?.layers.background.url }];
      }),
    [data, language]
  );

  const scenario = id ? SCENARIOS.get(id) : undefined;
  useEffect(() => {
    document.title = scenario ? `${text(scenario.title, language)} | AnimeVRM` : 'AnimeVRM';
  }, [scenario, language]);

  if (error) return <p className="pages-error">{t.player.loadFailed}</p>;
  if (scenario) {
    return data ? <ScenarioPlayer scenario={scenario} baseUrl={`/scenarios/demo/${scenario.id}/`} data={data} onExit={() => setId(null)} /> : null;
  }
  return (
    <div className="pages">
      <header className="pages-header">
        <h1>AnimeVRM</h1>
        <div className="pages-lang" role="group" aria-label="Language">
          {(['ja', 'en'] as const).map((lang) => (
            <button key={lang} type="button" className={`pages-lang-btn${language === lang ? ' active' : ''}`} onClick={() => setLanguage(lang)}>
              {lang === 'ja' ? '日本語' : 'English'}
            </button>
          ))}
        </div>
      </header>
      <p className="pages-lead">{t.player.listLead}</p>
      <ScenarioCatalog entries={entries} onSelect={(key) => setId(key)} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <PagesApp />
    </LanguageProvider>
  </StrictMode>
);
