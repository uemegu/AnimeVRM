import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Character, CharacterBook, CharacterRole } from '@anime-vrm/scenario';
import { api, ApiError, type AssetEntry } from '../../api/client';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { CharacterEditor } from './CharacterEditor';
import './characters.css';

const ROLE_ORDER: CharacterRole[] = ['heroine', 'sub', 'player', 'mob'];
const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

function newCharacter(id: string): Character {
  return { id, name: { ja: id, en: '' }, role: 'sub', themeColor: '#64748b', models: [], profile: '' };
}

export function CharactersView() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { characterId } = useParams();
  const [saved, setSaved] = useState<CharacterBook | null>(null);
  const [draft, setDraft] = useState<CharacterBook | null>(null);
  const [models, setModels] = useState<AssetEntry[]>([]);
  const [voices, setVoices] = useState<AssetEntry[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState<{ kind: 'saving' | 'saved' | 'error'; message?: string } | null>(null);
  const [newId, setNewId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.characters(), api.assets('models'), api.assets('voices')])
      .then(([book, modelList, voiceList]) => {
        setSaved(book);
        setDraft(structuredClone(book));
        setModels(modelList);
        setVoices(voiceList);
      })
      .catch(() => setLoadError(true));
  }, []);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const selected = draft?.characters.find((c) => c.id === characterId) ?? null;

  useEffect(() => {
    if (draft && !selected && draft.characters.length > 0) navigate(`/characters/${draft.characters[0].id}`, { replace: true });
  }, [draft, selected, navigate]);

  const updateCharacter = useCallback((next: Character) => {
    setDraft((book) => book && { ...book, characters: book.characters.map((c) => (c.id === next.id ? next : c)) });
    setStatus(null);
  }, []);

  const removeCharacter = useCallback(
    (id: string) => {
      setDraft((book) => book && { ...book, characters: book.characters.filter((c) => c.id !== id) });
      navigate('/characters', { replace: true });
    },
    [navigate]
  );

  const save = async () => {
    if (!draft) return;
    setStatus({ kind: 'saving' });
    try {
      await api.saveCharacters(draft);
      setSaved(structuredClone(draft));
      setStatus({ kind: 'saved' });
    } catch (err) {
      const detail = err instanceof ApiError && err.issues.length > 0 ? err.issues.map((i) => `${i.path}: ${i.message}`).join(' / ') : undefined;
      setStatus({ kind: 'error', message: detail });
    }
  };

  const idError = newId === null || newId === '' ? null : !ID_PATTERN.test(newId) ? t.characters.idInvalid : draft?.characters.some((c) => c.id === newId) ? t.characters.idTaken : null;
  const addCharacter = () => {
    if (!draft || !newId || idError) return;
    setDraft({ ...draft, characters: [...draft.characters, newCharacter(newId)] });
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
                {members.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`characters-item${c.id === characterId ? ' active' : ''}`}
                    onClick={() => navigate(`/characters/${c.id}`)}
                  >
                    <span className="characters-swatch" style={{ background: c.themeColor }} />
                    <span className="characters-item-name">{c.name.ja}</span>
                    <span className="characters-item-id">{c.id}</span>
                  </button>
                ))}
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
          <div className="characters-actions">
            <span className={`characters-status ${status?.kind ?? (dirty ? 'dirty' : '')}`}>
              {status?.kind === 'saving'
                ? t.common.saving
                : status?.kind === 'saved'
                  ? t.common.saved
                  : status?.kind === 'error'
                    ? `${t.common.saveFailed}${status.message ? `（${status.message}）` : ''}`
                    : dirty
                      ? t.common.unsaved
                      : ''}
            </span>
            <button type="button" className="btn" disabled={!dirty} onClick={() => saved && setDraft(structuredClone(saved))}>
              {t.common.revert}
            </button>
            <button type="button" className="btn primary" disabled={!dirty || status?.kind === 'saving'} onClick={save}>
              {t.common.save}
            </button>
          </div>
        </header>
        {selected && (
          <CharacterEditor
            key={selected.id}
            character={selected}
            book={draft}
            isNew={!saved?.characters.some((c) => c.id === selected.id)}
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
