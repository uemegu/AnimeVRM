import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ScenarioPackage } from '@anime-vrm/scenario';
import { api, type ScenarioSummary } from '../../api/client';
import { useProjects } from '../../data/useProjects';
import { useI18n } from '../../i18n';
import { ScenarioPlayer } from '../../player/ScenarioPlayer';
import { ScenarioCatalog } from '../../player/ScenarioCatalog';
import { loadPlayerData, type PlayerData } from '../../player/playerData';
import { locationBackdropUrl, useBackdrop } from '../../components/Backdrop';
import { setAmbientSource, StageGlowLayer } from '../../components/Ambient';
import '../../player/player.css';

/**
 * シナリオ再生（Studio）。保存済みのシナリオを、分岐・ボイス・演出つきで通して再生する
 */
export function PlayerView() {
  const { t, language } = useI18n();
  const { projects, current: project, select: selectProject, error: projectsError } = useProjects();
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

  // 再生中のシナリオの舞台を背面に敷く（一覧では最後に使った遠景）
  const scenarioLocation = scenario && category && id ? (scenario.location ?? scenario.scenes.find((s) => s.background)?.background) : undefined;
  useBackdrop(scenarioLocation ? locationBackdropUrl(data?.locations[scenarioLocation]) : undefined);

  // 選んだプロジェクトのシナリオを種類の順に並べる。電話・メールは再生できないので除く
  const entries = useMemo(() => {
    const order = project?.categories ?? [];
    return list
      .filter((s) => s.kind === 'story' && order.includes(s.category))
      .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.id.localeCompare(b.id))
      .map((s) => ({
        key: `${s.category}/${s.id}`,
        title: s.title,
        label: `${t.scenarios.categories[s.category]} ・ ${s.id}`,
        description: s.description,
        // 舞台の場所の遠景をサムネイルにする
        image: s.location ? (data?.locations[s.location]?.thumbnail ?? data?.locations[s.location]?.layers.background.url) : undefined,
      }));
  }, [list, t, data, project]);

  if (error || projectsError) return <div className="view-empty">{t.player.loadFailed}</div>;
  if (category && id) {
    return (
      <div className="player-view">
        <StageGlowLayer />
        {scenario && data ? (
          <ScenarioPlayer scenario={scenario} baseUrl={`/scenarios/${category}/${id}/`} data={data} onExit={() => navigate('/player')} onCanvas={setAmbientSource} />
        ) : null}
      </div>
    );
  }
  return (
    <div className="player-list">
      <div className="player-list-head">
        <h1>{t.player.listTitle}</h1>
        {projects && project && (
          <select className="select" aria-label={t.scenarios.project} value={project.id} onChange={(e) => selectProject(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name[language] ?? p.name.ja}
              </option>
            ))}
          </select>
        )}
      </div>
      <ScenarioCatalog entries={entries} onSelect={(key) => navigate(`/player/${key}`)} />
    </div>
  );
}
