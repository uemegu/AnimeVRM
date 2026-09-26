import { useEffect, useState } from 'react';
import type { Character, CharacterBook, CharacterModel, CharacterRole, CharacterVoice } from '@anime-vrm/scenario';
import { api, type AssetEntry, type CharacterScenarioUsage } from '../../api/client';
import { Icon } from '../../components/Icon';
import { format, useI18n } from '../../i18n';
import { useAudioPreview } from './useAudioPreview';

type Tab = 'basic' | 'voice' | 'usage';
const ROLES: CharacterRole[] = ['heroine', 'sub', 'mob', 'player'];
const POSTPROCESS = ['none', 'divine_reverb'] as const;

interface Props {
  character: Character;
  book: CharacterBook;
  isNew: boolean;
  models: AssetEntry[];
  voices: AssetEntry[];
  onChange: (character: Character) => void;
  onRemove: (id: string) => void;
}

export function CharacterEditor({ character, book, isNew, models, voices, onChange, onRemove }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('basic');
  const [usage, setUsage] = useState<CharacterScenarioUsage[] | null>(isNew ? [] : null);
  const audio = useAudioPreview();

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    api
      .characterUsage(character.id)
      .then((result) => !cancelled && setUsage(result))
      .catch(() => !cancelled && setUsage([]));
    return () => {
      cancelled = true;
    };
  }, [character.id, isNew]);

  const set = <K extends keyof Character>(key: K, value: Character[K]) => onChange({ ...character, [key]: value });

  return (
    <div className="character-editor">
      <div className="character-tabs" role="tablist">
        {(['basic', 'voice', 'usage'] as Tab[]).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`character-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            {t.characters.tabs[key]}
          </button>
        ))}
      </div>

      <div className="character-body">
        {tab === 'basic' && (
          <BasicTab character={character} models={models} set={set} onRemove={usage?.length === 0 ? () => onRemove(character.id) : undefined} />
        )}
        {tab === 'voice' && <VoiceTab character={character} book={book} voices={voices} set={set} audio={audio} />}
        {tab === 'usage' && <UsageTab usage={usage} audio={audio} />}
      </div>
    </div>
  );
}

type Setter = <K extends keyof Character>(key: K, value: Character[K]) => void;

function BasicTab({ character, models, set, onRemove }: { character: Character; models: AssetEntry[]; set: Setter; onRemove?: () => void }) {
  const { t } = useI18n();
  const updateModel = (index: number, patch: Partial<CharacterModel>) =>
    set('models', character.models.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  return (
    <div className="character-form">
      <div className="form-row three">
        <label className="field">
          <span className="field-label">{t.characters.id}</span>
          <input className="input" value={character.id} readOnly />
          <span className="field-hint">{t.characters.idHint}</span>
        </label>
        <label className="field">
          <span className="field-label">{t.characters.nameJa}</span>
          <input className="input" value={character.name.ja} onChange={(e) => set('name', { ...character.name, ja: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">{t.characters.nameEn}</span>
          <input className="input" value={character.name.en ?? ''} onChange={(e) => set('name', { ...character.name, en: e.target.value })} />
        </label>
      </div>

      <div className="form-row three">
        <label className="field">
          <span className="field-label">{t.characters.role}</span>
          <select className="select" value={character.role} onChange={(e) => set('role', e.target.value as CharacterRole)}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {t.characters.roles[role]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t.characters.themeColor}</span>
          <div className="color-field">
            <input type="color" value={character.themeColor} onChange={(e) => set('themeColor', e.target.value)} />
            <input className="input" value={character.themeColor} onChange={(e) => set('themeColor', e.target.value)} />
          </div>
        </label>
      </div>

      <section className="form-section">
        <div className="form-section-header">
          <h3>{t.characters.models}</h3>
          <button
            type="button"
            className="btn"
            onClick={() =>
              set('models', [
                ...character.models,
                { key: character.models.length === 0 ? 'default' : '', label: { ja: '' }, url: models[0]?.url ?? '/models/' },
              ])
            }
          >
            <Icon name="plus" size={16} />
            {t.characters.addModel}
          </button>
        </div>
        <p className="field-hint">{t.characters.modelsHint}</p>
        {character.models.length > 0 && (
          <div className="model-table">
            <div className="model-row head">
              <span>{t.characters.modelKey}</span>
              <span>{t.characters.modelLabel}</span>
              <span>{t.characters.modelUrl}</span>
              <span />
            </div>
            {character.models.map((model, index) => (
              <div key={index} className="model-row">
                <input className="input" value={model.key} onChange={(e) => updateModel(index, { key: e.target.value })} />
                <input className="input" value={model.label.ja} onChange={(e) => updateModel(index, { label: { ...model.label, ja: e.target.value } })} />
                <select className="select" value={model.url} onChange={(e) => updateModel(index, { url: e.target.value })}>
                  {!models.some((m) => m.url === model.url) && <option value={model.url}>{model.url}</option>}
                  {models.map((m) => (
                    <option key={m.url} value={m.url}>
                      {m.url.replace(/^\/models\//, '')}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn icon ghost" title={t.common.remove} onClick={() => set('models', character.models.filter((_, i) => i !== index))}>
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <label className="field">
        <span className="field-label">{t.characters.profile}</span>
        <textarea className="textarea" rows={5} value={character.profile} onChange={(e) => set('profile', e.target.value)} />
      </label>

      {onRemove && (
        <div className="form-footer">
          <button type="button" className="btn danger" onClick={onRemove}>
            {t.common.remove}
          </button>
        </div>
      )}
    </div>
  );
}

function VoiceTab({
  character,
  book,
  voices,
  set,
  audio,
}: {
  character: Character;
  book: CharacterBook;
  voices: AssetEntry[];
  set: Setter;
  audio: ReturnType<typeof useAudioPreview>;
}) {
  const { t } = useI18n();
  const voice = character.voice;
  if (!voice) {
    return (
      <div className="character-empty">
        <p className="muted">{t.characters.voiceNone}</p>
        <button
          type="button"
          className="btn primary"
          onClick={() => set('voice', { ref: voices[0] ? `assets${voices[0].url}` : '', caption: '', direction: '' })}
        >
          {t.characters.addVoice}
        </button>
      </div>
    );
  }
  const update = (patch: Partial<CharacterVoice>) => set('voice', { ...voice, ...patch });
  // 参照音声はリポジトリ直下からの相対パス（assets/voices/...）。試聴は assets/ を公開しているパスで行う
  const refUrl = voice.ref.startsWith('assets/') ? voice.ref.slice('assets'.length) : null;
  const preview = voice.caption + (voice.direction ?? '') + (book.voiceMoods.neutral ?? '');

  return (
    <div className="character-form">
      <div className="field">
        <span className="field-label">{t.characters.voiceRef}</span>
        <div className="inline-controls">
          <select className="select" value={voice.ref} onChange={(e) => update({ ref: e.target.value })}>
            {!voices.some((v) => `assets${v.url}` === voice.ref) && <option value={voice.ref}>{voice.ref}</option>}
            {voices.map((v) => (
              <option key={v.url} value={`assets${v.url}`}>
                {v.url.replace(/^\/voices\//, '')}
              </option>
            ))}
          </select>
          <button type="button" className="btn" disabled={!refUrl} onClick={() => refUrl && audio.toggle(refUrl)}>
            <Icon name={audio.playingUrl === refUrl ? 'stop' : 'play'} size={14} />
            {audio.playingUrl === refUrl ? t.common.stop : t.common.play}
          </button>
        </div>
        <span className="field-hint">{t.characters.voiceRefHint}</span>
      </div>

      <label className="field">
        <span className="field-label">{t.characters.voiceCaption}</span>
        <textarea className="textarea" rows={2} value={voice.caption} onChange={(e) => update({ caption: e.target.value })} />
        <span className="field-hint">{t.characters.voiceCaptionHint}</span>
      </label>

      <label className="field">
        <span className="field-label">{t.characters.voiceDirection}</span>
        <textarea className="textarea" rows={3} value={voice.direction ?? ''} onChange={(e) => update({ direction: e.target.value })} />
        <span className="field-hint">{t.characters.voiceDirectionHint}</span>
      </label>

      <label className="field narrow">
        <span className="field-label">{t.characters.voicePostprocess}</span>
        <select className="select" value={voice.postprocess ?? 'none'} onChange={(e) => update({ postprocess: e.target.value === 'none' ? undefined : e.target.value })}>
          {POSTPROCESS.map((p) => (
            <option key={p} value={p}>
              {t.characters.voicePostprocessOptions[p]}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span className="field-label">{t.characters.voicePreview}</span>
        <p className="caption-preview">{preview}</p>
      </div>

      <div className="form-footer">
        <button type="button" className="btn" onClick={() => set('voice', undefined)}>
          {t.characters.removeVoice}
        </button>
      </div>
    </div>
  );
}

function UsageTab({ usage, audio }: { usage: CharacterScenarioUsage[] | null; audio: ReturnType<typeof useAudioPreview> }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  if (usage === null) return null;
  if (usage.length === 0) return <p className="muted">{t.characters.usageEmpty}</p>;
  const lines = usage.reduce((n, u) => n + u.lines.length, 0);
  const voiced = usage.reduce((n, u) => n + u.lines.filter((l) => l.voiceUrl).length, 0);

  return (
    <div className="usage">
      <p className="muted">{format(t.characters.usageSummary, { scenarios: usage.length, lines, voiced })}</p>
      <div className="usage-list">
        {usage.map((u) => {
          const key = `${u.category}/${u.id}`;
          const expanded = open === key;
          return (
            <div key={key} className={`usage-item${expanded ? ' open' : ''}`}>
              <button type="button" className="usage-head" onClick={() => setOpen(expanded ? null : key)}>
                <span className="usage-chevron">
                  <Icon name="chevron" size={14} />
                </span>
                <span className="usage-title">{u.title}</span>
                <span className="usage-path">{key}</span>
                <span className="usage-count">{format(t.characters.appearances, { count: u.appearances })}</span>
                <span className="usage-count">{format(t.characters.lines, { count: u.lines.length })}</span>
              </button>
              {expanded && (
                <ol className="usage-lines">
                  {u.lines.map((line) => (
                    <li key={line.lineId}>
                      <span className="usage-line-id">{line.lineId}</span>
                      <span className="usage-line-text">{line.text}</span>
                      {line.voiceUrl ? (
                        <button type="button" className="btn icon ghost" title={t.common.play} onClick={() => audio.toggle(line.voiceUrl!)}>
                          <Icon name={audio.playingUrl === line.voiceUrl ? 'stop' : 'play'} size={14} />
                        </button>
                      ) : (
                        <span className="usage-novoice">{t.characters.noVoice}</span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
