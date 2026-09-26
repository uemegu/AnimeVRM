import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ScenarioCategory, schemaForCategory, type ScenarioPackage, type ScenarioScene } from '@anime-vrm/scenario';
import { api, type ScenarioSummary } from '../../api/client';
import { Icon } from '../../components/Icon';
import { SaveBar, saveErrorStatus, type SaveStatus } from '../../components/SaveBar';
import { useStudioData } from '../../data/useStudioData';
import { format, useI18n } from '../../i18n';
import { CutInspector } from './CutInspector';
import { CutList } from './CutList';
import type { Outfit } from './CutPreview';
import { CutWorkbench } from './CutWorkbench';
import { FlowChart } from './FlowChart';
import { JsonDocumentEditor, ScenarioSettings } from './ScenarioSettings';
import { duplicateScene, insertScene, moveScene, referencesTo, removeScene, replaceScene, textJa } from './scenarioEdit';
import './scenarios.css';

const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export function ScenariosView() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { category, id, cut } = useParams();
  const { data, error: dataError } = useStudioData();
  const [list, setList] = useState<ScenarioSummary[] | null>(null);
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState<unknown>(null);
  const [draft, setDraft] = useState<unknown>(null);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState<SaveStatus>(null);
  const [mode, setMode] = useState<'cut' | 'settings'>('cut');
  const [outfit, setOutfit] = useState<Outfit>('default');
  const [center, setCenter] = useState<'preview' | 'flow'>('preview');
  // シナリオを開いたら一覧はたたんで、プレビューを広く取る
  const [listOpen, setListOpen] = useState(!id);
  const [creating, setCreating] = useState<{ category: ScenarioCategory; id: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const refreshList = () => api.scenarios().then(setList).catch(() => setLoadError(true));
  useEffect(() => {
    void refreshList();
  }, []);

  // シナリオを開く（新規作成中のものはサーバーにまだない）
  useEffect(() => {
    setStatus(null);
    if (!category || !id) {
      setSaved(null);
      setDraft(null);
      return;
    }
    if (list && !list.some((s) => s.category === category && s.id === id) && draft && (draft as { id?: string }).id === id) return;
    api
      .scenario(category, id)
      .then((scenario) => {
        setSaved(scenario);
        setDraft(structuredClone(scenario));
      })
      .catch(() => {
        setSaved(null);
        setDraft(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, id]);

  const isStory = !!category && category !== 'call' && category !== 'mail';
  const story = isStory ? (draft as ScenarioPackage | null) : null;
  const cutIndex = story ? Math.max(0, Math.min(story.scenes.length - 1, story.scenes.findIndex((s) => s.id === cut))) : 0;
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list ?? []).filter((s) => !q || s.id.toLowerCase().includes(q) || s.title.toLowerCase().includes(q));
  }, [list, search]);

  if (dataError || loadError) return <div className="scenarios-message">{t.common.loadFailed}</div>;
  if (!data || !list) return null;

  const updateStory = (next: ScenarioPackage) => {
    setDraft(next);
    setStatus(null);
  };
  const selectCut = (index: number) => {
    setMode('cut');
    if (story) navigate(`/scenarios/${category}/${id}/${story.scenes[index].id}`, { replace: true });
  };

  const save = async () => {
    if (!category || !id) return;
    setStatus({ kind: 'saving' });
    try {
      await api.saveScenario(category, id, draft);
      setSaved(structuredClone(draft));
      setStatus({ kind: 'saved' });
      void refreshList();
    } catch (err) {
      setStatus(saveErrorStatus(err));
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2) + '\n'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    try {
      const value = JSON.parse(await file.text());
      const parsed = schemaForCategory(category as ScenarioCategory).safeParse({ ...value, id });
      if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' / '));
      setDraft({ ...value, id });
      setStatus(null);
    } catch (err) {
      setStatus({ kind: 'error', message: `${t.scenarios.importFailed}: ${String(err)}` });
    }
  };

  const createScenario = () => {
    if (!creating || !ID_PATTERN.test(creating.id) || list.some((s) => s.id === creating.id)) return;
    const blank =
      creating.category === 'call'
        ? { id: creating.id, characterId: 'aoi', title: creating.id, initialStepId: 'step_1', steps: { step_1: { id: 'step_1', speaker: 'アオイ', text: '' } } }
        : creating.category === 'mail'
          ? { id: creating.id, characterId: 'aoi', title: creating.id, previewText: '', time: '22:00', messages: [] }
          : { id: creating.id, title: creating.id, scenes: [{ id: 's1', text: '' }] };
    setSaved(null);
    setDraft(blank);
    setCreating(null);
    navigate(`/scenarios/${creating.category}/${creating.id}`);
  };

  const onDelete = () => {
    if (!story) return;
    const refs = referencesTo(story, story.scenes[cutIndex].id);
    if (refs.length && !window.confirm(format(t.scenarios.confirmDelete, { from: refs.join(', ') }))) return;
    const next = removeScene(story, cutIndex);
    updateStory(next);
    selectCutOf(next, Math.max(0, cutIndex - 1));
  };
  const selectCutOf = (scenario: ScenarioPackage, index: number) => navigate(`/scenarios/${category}/${id}/${scenario.scenes[index].id}`, { replace: true });

  const categories = ScenarioCategory.options;

  return (
    <div className={`scenarios${listOpen ? '' : ' list-collapsed'}`}>
      <aside className="scenario-list">
        <header className="scenario-list-header">
          <input className="input" placeholder={t.scenarios.search} value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="button" className="btn icon" title={t.scenarios.newScenario} onClick={() => setCreating(creating ? null : { category: 'action', id: '' })}>
            <Icon name={creating ? 'close' : 'plus'} size={16} />
          </button>
        </header>
        {creating && (
          <div className="scenario-create">
            <select className="select" value={creating.category} onChange={(e) => setCreating({ ...creating, category: e.target.value as ScenarioCategory })}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {t.scenarios.categories[c]}
                </option>
              ))}
            </select>
            <input className="input" placeholder="id" value={creating.id} onChange={(e) => setCreating({ ...creating, id: e.target.value.trim() })} onKeyDown={(e) => e.key === 'Enter' && createScenario()} />
            <button type="button" className="btn primary" disabled={!ID_PATTERN.test(creating.id) || list.some((s) => s.id === creating.id)} onClick={createScenario}>
              {t.common.add}
            </button>
            <p className="field-hint">{t.scenarios.createHint}</p>
          </div>
        )}
        <div className="scenario-groups">
          {categories.map((c) => {
            const items = filtered.filter((s) => s.category === c);
            if (!items.length) return null;
            return (
              <div key={c} className="scenario-group">
                <h2>{t.scenarios.categories[c]}</h2>
                {items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`scenario-item${s.category === category && s.id === id ? ' active' : ''}`}
                    onClick={() => {
                      navigate(`/scenarios/${s.category}/${s.id}`);
                      setListOpen(false);
                    }}
                  >
                    <span className="scenario-item-title">{s.title}</span>
                    <span className="scenario-item-meta">
                      {s.id} ・ {format(t.scenarios.lines, { count: s.lineCount })}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </aside>

      {draft ? (
        <section className="scenario-editor">
          <header className="scenario-editor-header">
            <button type="button" className="btn icon" title={t.scenarios.list} onClick={() => setListOpen(!listOpen)}>
              <Icon name="scenarios" size={16} />
            </button>
            <div className="scenario-editor-title">
              <h1>{textJa((draft as { title?: ScenarioPackage['title'] }).title) || id}</h1>
              <span className="muted">
                {category && t.scenarios.categories[category as ScenarioCategory]} ・ {id}
              </span>
            </div>
            <div className="scenario-editor-actions">
              {story && (
                <button type="button" className={`btn${mode === 'settings' ? ' primary' : ''}`} onClick={() => setMode(mode === 'settings' ? 'cut' : 'settings')}>
                  {t.scenarios.settings}
                </button>
              )}
              <button type="button" className="btn" onClick={() => importRef.current?.click()}>
                <Icon name="upload" size={16} />
                {t.scenarios.import}
              </button>
              <button type="button" className="btn" onClick={exportJson}>
                <Icon name="download" size={16} />
                {t.scenarios.export}
              </button>
              <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0]).finally(() => (e.target.value = ''))} />
              <SaveBar dirty={dirty} status={status} onRevert={() => setDraft(structuredClone(saved))} onSave={save} />
            </div>
          </header>

          {story ? (
            <div className="scenario-editor-body">
              <CutList
                scenario={story}
                characters={data.characters}
                selectedIndex={cutIndex}
                onSelect={selectCut}
                onAdd={() => {
                  const { scenario: next, id: newId } = insertScene(story, cutIndex);
                  updateStory(next);
                  navigate(`/scenarios/${category}/${id}/${newId}`, { replace: true });
                }}
                onDuplicate={() => {
                  const { scenario: next, id: newId } = duplicateScene(story, cutIndex);
                  updateStory(next);
                  navigate(`/scenarios/${category}/${id}/${newId}`, { replace: true });
                }}
                onMove={(delta) => updateStory(moveScene(story, cutIndex, delta))}
                onDelete={onDelete}
              />
              <div className="scenario-center">
                <div className="scenario-preview-bar">
                  <div className="segmented center-tabs">
                    {(['preview', 'flow'] as const).map((c) => (
                      <button key={c} type="button" className={c === center ? 'active' : ''} onClick={() => setCenter(c)}>
                        {t.scenarios.centerTabs[c]}
                      </button>
                    ))}
                  </div>
                  {center === 'preview' && (
                    <>
                      <span className="field-label">{t.scenarios.previewOutfit}</span>
                      <div className="segmented">
                        {(['default', 'private', 'commute'] as Outfit[]).map((o) => (
                          <button key={o} type="button" className={o === outfit ? 'active' : ''} onClick={() => setOutfit(o)}>
                            {t.scenarios.outfits[o]}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {center === 'preview' && (
                  <CutWorkbench
                    scenario={story}
                    index={cutIndex}
                    baseUrl={`/scenarios/${category}/${id}/`}
                    data={data}
                    outfit={outfit}
                    onChangeScene={(scene) => updateStory(replaceScene(story, cutIndex, scene))}
                  />
                )}
                {center === 'flow' && (
                  <div className="scenario-flow">
                    <FlowChart scenario={story} characters={data.characters} selectedId={story.scenes[cutIndex].id} onSelect={(sceneId) => selectCut(story.scenes.findIndex((s) => s.id === sceneId))} />
                  </div>
                )}
              </div>
              <aside className="scenario-inspector">
                {mode === 'settings' ? (
                  <div className="inspector-body">
                    <ScenarioSettings scenario={story} data={data} onChange={updateStory} />
                  </div>
                ) : (
                  <CutInspector
                    scenario={story}
                    index={cutIndex}
                    data={data}
                    voice={{
                      category: category!,
                      scenarioId: id!,
                      baseUrl: `/scenarios/${category}/${id}/`,
                      dirty,
                      // 採用するとサーバーがシナリオの voiceUrl を書き換えるので読み直す
                      onReload: () =>
                        api.scenario(category!, id!).then((fresh) => {
                          setSaved(fresh);
                          setDraft(structuredClone(fresh));
                        }),
                    }}
                    onChange={(scene: ScenarioScene) => updateStory(replaceScene(story, cutIndex, scene))}
                  />
                )}
              </aside>
            </div>
          ) : (
            <JsonDocumentEditor
              value={draft}
              onChange={(value) => {
                setDraft(value);
                setStatus(null);
              }}
            />
          )}
        </section>
      ) : (
        <div className="scenarios-message">{t.scenarios.title}</div>
      )}
    </div>
  );
}
