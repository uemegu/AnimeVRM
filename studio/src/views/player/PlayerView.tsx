import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ScenarioPackage, type ScenarioCategory } from '@anime-vrm/scenario';
import { api, type ScenarioSummary } from '../../api/client';
import { useI18n } from '../../i18n';
import { ScenarioPlayer } from '../../player/ScenarioPlayer';
import { ScenarioCatalog } from '../../player/ScenarioCatalog';
import { loadPlayerData, type PlayerData } from '../../player/playerData';
import '../../player/player.css';

/** 演出の見本を先に、電話・メールは除く */
const ORDER: ScenarioCategory[] = ['demo', 'morning', 'action', 'holiday', 'forced', 'special', 'ending'];

/**
 * シナリオ再生（Studio）。保存済みのシナリオを、分岐・ボイス・演出つきで通して再生する
 */
export function PlayerView() {
  const { t } = useI18n();
  const { category, id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PlayerData | null>(null);
  const [list, setList] = useState<ScenarioSummary[]>([]);
  const [scenario, setScenario] = useState<ScenarioPackage | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadPlayerData().then(setData, () => setError(true));
    api.scenarios().then(setList, () => setError(true));
  }, []);

  useEffect(() => {
    setScenario(null);
    if (!category || !id) return;
    api
      .scenario(category, id)
      .then((json) => setScenario(ScenarioPackage.parse(json)))
      .catch(() => setError(true));
  }, [category, id]);

  const entries = useMemo(
    () =>
      list
        .filter((s) => ORDER.includes(s.category))
        .sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || a.id.localeCompare(b.id))
        .map((s) => ({
          key: `${s.category}/${s.id}`,
          title: s.title,
          label: `${t.scenarios.categories[s.category]} ・ ${s.id}`,
          description: s.description,
          // 舞台の場所の遠景をサムネイルにする
          image: s.location ? data?.locations[s.location]?.layers.background.url : undefined,
        })),
    [list, t, data]
  );

  if (error) return <div className="view-empty">{t.player.loadFailed}</div>;
  if (category && id) {
    return (
      <div className="player-view">
        {scenario && data ? (
          <ScenarioPlayer scenario={scenario} baseUrl={`/scenarios/${category}/${id}/`} data={data} onExit={() => navigate('/player')} />
        ) : null}
      </div>
    );
  }
  return (
    <div className="player-list">
      <h1>{t.player.listTitle}</h1>
      <ScenarioCatalog entries={entries} onSelect={(key) => navigate(`/player/${key}`)} />
    </div>
  );
}
