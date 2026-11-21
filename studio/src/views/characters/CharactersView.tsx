import { useCallback, useEffect, useMemo, useState } from 'react';
import { forgetGarments } from '../../stage/garments';
import { useNavigate, useParams } from 'react-router';
import type { Character, CharacterBook, CharacterRole } from '@anime-vrm/scenario';
import { api, type AssetEntry } from '../../api/client';
import { SaveBar, saveErrorStatus, type SaveStatus } from '../../components/SaveBar';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { CharacterEditor } from './CharacterEditor';
import { useProjects } from '../../data/useProjects';
import { fetchProjectData, saveProjectData, type DataScope } from '../../data/projectData';
import { SharedTag, SharedToggle } from '../../components/DataScope';
import { emptyProjectData } from '@anime-vrm/scenario';
import './characters.css';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';

const ROLE_ORDER: CharacterRole[] = ['heroine', 'sub', 'player', 'mob'];
const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

function newCharacter(id: string): Character {
  return { id, name: { ja: id, en: '' }, role: 'sub', themeColor: '#64748b', models: [], profile: '' };
}

/** 共通（assets/studio/characters.json）とプロジェクト専用を合わせたもの。own はプロジェクト専用のキャラ ID */
interface Saved {
  book: CharacterBook;
  own: string[];
}

/** 共通のものとプロジェクト専用のものに分ける */
function split(book: CharacterBook, own: Set<string>) {
  return {
    shared: { ...book, characters: book.characters.filter((c) => !own.has(c.id)) },
    project: book.characters.filter((c) => own.has(c.id)),
  };
}

export function CharactersView() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { characterId } = useParams();
  // サイドバーで選んだプロジェクトで使えるキャラ（そのプロジェクト専用のものと共通のもの）
  const { current: project } = useProjects();
  const [saved, setSaved] = useState<Saved | null>(null);
  const [draft, setDraft] = useState<CharacterBook | null>(null);
  const [own, setOwn] = useState<Set<string>>(new Set());
  const [models, setModels] = useState<AssetEntry[]>([]);
  const [voices, setVoices] = useState<AssetEntry[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState<SaveStatus>(null);
  const [newId, setNewId] = useState<string | null>(null);

  // プロジェクトを切り替えたら読み直す（共通のものと、そのプロジェクト専用のもの）
  useEffect(() => {
    if (!project) return;
    setSaved(null);
    setDraft(null);
    Promise.all([api.characters(), fetchProjectData(project.id), api.assets('models', project.id), api.assets('voices')])
      .then(([shared, projectData, modelList, voiceList]) => {
        const book = { ...shared, characters: [...shared.characters, ...projectData.characters] };
        const ownIds = projectData.characters.map((c) => c.id);
        setSaved({ book, own: ownIds });
        setDraft(structuredClone(book));
        setOwn(new Set(ownIds));
        setModels(modelList);
        setVoices(voiceList);
        setStatus(null);
      })
      .catch(() => setLoadError(true));
  }, [project?.id]);

  const scopeOf = (id: string): DataScope => (own.has(id) ? 'project' : 'shared');
  const dirty = useMemo(
    () => !!saved && (JSON.stringify(saved.book) !== JSON.stringify(draft) || JSON.stringify([...saved.own].sort()) !== JSON.stringify([...own].sort())),
    [saved, draft, own]
  );
  const selected = draft?.characters.find((c) => c.id === characterId) ?? null;

  useEffect(() => {
    if (draft && !selected && draft.characters.length > 0) navigate(`/characters/${draft.characters[0].id}`, { replace: true });
  }, [draft, selected, navigate]);

  const setScope = (id: string, scope: DataScope) => {
    const next = new Set(own);
    if (scope === 'project') next.add(id);
    else next.delete(id);
    setOwn(next);
    setStatus(null);
  };

  const updateCharacter = useCallback((next: Character) => {
    setDraft((book) => book && { ...book, characters: book.characters.map((c) => (c.id === next.id ? next : c)) });
    setStatus(null);
  }, []);

  const removeCharacter = useCallback(
    (id: string) => {
      setDraft((book) => book && { ...book, characters: book.characters.filter((c) => c.id !== id) });
      setOwn((ids) => new Set([...ids].filter((x) => x !== id)));
      navigate('/characters', { replace: true });
    },
    [navigate]
  );

  // 共通のものは assets/studio/characters.json、プロジェクト専用のものはプロジェクトの置き場へ。変わった方だけ書く
  const save = async () => {
    if (!draft || !saved || !project) return;
    setStatus({ kind: 'saving' });
    try {
      const before = split(saved.book, new Set(saved.own));
      const after = split(draft, own);
      if (JSON.stringify(before.shared) !== JSON.stringify(after.shared)) await api.saveCharacters(after.shared);
      if (JSON.stringify(before.project) !== JSON.stringify(after.project)) {
        await saveProjectData(project.id, 'characters', { ...emptyProjectData(), characters: after.project });
      }
      forgetGarments();
      setSaved({ book: structuredClone(draft), own: [...own] });
      setStatus({ kind: 'saved' });
    } catch (err) {
      setStatus(saveErrorStatus(err));
    }
  };

  const idError = newId === null || newId === '' ? null : !ID_PATTERN.test(newId) ? t.characters.idInvalid : draft?.characters.some((c) => c.id === newId) ? t.characters.idTaken : null;
  const addCharacter = () => {
    if (!draft || !newId || idError) return;
    setDraft({ ...draft, characters: [...draft.characters, newCharacter(newId)] });
    // 新しいキャラはいまのプロジェクト専用。共通にするときは編集欄のチェックで
    setOwn(new Set([...own, newId]));
    setNewId(null);
    navigate(`/characters/${newId}`);
  };

  if (loadError) return <div className="characters-message">{t.common.loadFailed}</div>;
  if (!draft) return null;

  return (
    <div className="characters">
      <section className="characters-list">
        <header className="characters-list-header">
          <h1>{t.characters.title}</h1>
          <button type="button" className="btn icon" title={t.characters.newCharacter} onClick={() => setNewId(newId === null ? '' : null)}>
            <Icon name={newId === null ? 'plus' : 'close'} />
          </button>
        </header>
        {newId !== null && (
          <div className="characters-new">
            <input
              className="input"
              autoFocus
              placeholder={t.characters.id}
              value={newId}
              onChange={(e) => setNewId(e.target.value.trim())}
              onKeyDown={(e) => e.key === 'Enter' && addCharacter()}
            />
            <button type="button" className="btn primary" disabled={!newId || !!idError} onClick={addCharacter}>
              {t.common.add}
            </button>
            {idError && <p className="characters-error">{idError}</p>}
          </div>
        )}
        <div className="characters-groups">
          {ROLE_ORDER.map((role) => {
            const members = draft.characters.filter((c) => c.role === role);
            if (members.length === 0) return null;
            return (
              <div key={role} className="characters-group">
                <h2>{t.characters.roles[role]}</h2>
                {members.map((c) => {
                  const defaultModel = c.models.find((m) => m.key === 'default') ?? c.models[0];
                  const thumbUrl = models.find((m) => m.url === defaultModel?.url)?.thumbnailUrl;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`characters-item${c.id === characterId ? ' active' : ''}`}
                      onClick={() => navigate(`/characters/${c.id}`)}
                    >
                      {thumbUrl ? (
                        <span className="characters-item-thumb">
                          <img src={resolveAssetUrl(thumbUrl)} alt={c.name.ja} loading="lazy" />
                          <span className="characters-swatch mini" style={{ background: c.themeColor }} />
                        </span>
                      ) : (
                        <span className="characters-swatch" style={{ background: c.themeColor }} />
                      )}
                      <span className="characters-item-name">{c.name.ja}</span>
                      <span className="characters-item-id">{c.id}</span>
                      {scopeOf(c.id) === 'shared' && <SharedTag />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      <section className="characters-detail">
        <header className="characters-detail-header">
          {selected && (
            <div className="characters-detail-title">
              <span className="characters-swatch large" style={{ background: selected.themeColor }} />
              <div>
                <h1>{selected.name.ja}</h1>
                <span className="muted">{selected.name.en || selected.id}</span>
              </div>
            </div>
          )}
          <div className="characters-detail-actions">
            {selected && <SharedToggle shared={scopeOf(selected.id) === 'shared'} onChange={(shared) => setScope(selected.id, shared ? 'shared' : 'project')} />}
            <SaveBar
              dirty={dirty}
              status={status}
              onRevert={() => {
                if (!saved) return;
                setDraft(structuredClone(saved.book));
                setOwn(new Set(saved.own));
              }}
              onSave={save}
            />
          </div>
        </header>
        {selected && (
          <CharacterEditor
            key={selected.id}
            character={selected}
            book={draft}
            isNew={!saved?.book.characters.some((c) => c.id === selected.id)}
            models={models}
            voices={voices}
            onChange={updateCharacter}
            onRemove={removeCharacter}
          />
        )}
      </section>
    </div>
  );
}
