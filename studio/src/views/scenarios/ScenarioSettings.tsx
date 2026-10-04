import { useEffect, useState } from 'react';
import { ScenarioAvailability, TIME_OF_DAY_IDS, type ScenarioPackage } from '@anime-vrm/scenario';
import type { StudioData } from '../../data/useStudioData';
import { useI18n } from '../../i18n';
import { makeText, textEn, textJa } from './scenarioEdit';

/** シナリオ全体の設定（タイトル・舞台・開始時の BGM と時間帯・発生条件） */
export function ScenarioSettings({ scenario, data, onChange }: { scenario: ScenarioPackage; data: StudioData; onChange: (s: ScenarioPackage) => void }) {
  const { t } = useI18n();
  const set = <K extends keyof ScenarioPackage>(key: K, value: ScenarioPackage[K] | undefined) => {
    const copy = { ...scenario };
    if (value === undefined || value === '') delete copy[key];
    else copy[key] = value;
    onChange(copy);
  };
  const [availability, setAvailability] = useState(JSON.stringify(scenario.availability ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setAvailability(JSON.stringify(scenario.availability ?? {}, null, 2)), [scenario.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyAvailability = () => {
    try {
      const value = JSON.parse(availability);
      const parsed = ScenarioAvailability.safeParse(value);
      if (!parsed.success) {
        setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' / '));
        return;
      }
      setError(null);
      set('availability', Object.keys(value).length ? value : undefined);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="inspector-form">
      <label className="field">
        <span className="field-label">{t.scenarios.meta.title}</span>
        <input className="input" value={textJa(scenario.title)} onChange={(e) => set('title', makeText(e.target.value, textEn(scenario.title)))} />
      </label>
      <label className="field">
        <span className="field-label">{t.scenarios.meta.titleEn}</span>
        <input className="input" value={textEn(scenario.title)} onChange={(e) => set('title', makeText(textJa(scenario.title), e.target.value))} />
      </label>
      <label className="field">
        <span className="field-label">{t.scenarios.meta.playMode}</span>
        <select className="select" value={scenario.playMode ?? 'game'} onChange={(e) => set('playMode', e.target.value === 'movie' ? 'movie' : undefined)}>
          <option value="game">{t.scenarios.playModes.game}</option>
          <option value="movie">{t.scenarios.playModes.movie}</option>
        </select>
        {scenario.playMode === 'movie' && <span className="field-hint">{t.scenarios.movieHint}</span>}
      </label>
      <label className="field">
        <span className="field-label">{t.scenarios.meta.aspect}</span>
        <select className="select" value={scenario.aspect ?? 'landscape'} onChange={(e) => set('aspect', e.target.value === 'portrait' ? 'portrait' : undefined)}>
          <option value="landscape">{t.scenarios.aspects.landscape}</option>
          <option value="portrait">{t.scenarios.aspects.portrait}</option>
        </select>
      </label>
      <label className="field">
        <span className="field-label">{t.scenarios.meta.location}</span>
        <select className="select" value={scenario.location ?? ''} onChange={(e) => set('location', e.target.value || undefined)}>
          <option value="">—</option>
          {Object.values(data.locations).map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">{t.scenarios.meta.bgm}</span>
        <select className="select" value={scenario.bgm ?? ''} onChange={(e) => set('bgm', e.target.value || undefined)}>
          <option value="">—</option>
          <option value="silence">{t.scenarios.silence}</option>
          {Object.entries(data.bgm).map(([id, bgm]) => (
            <option key={id} value={id}>
              {bgm.title.ja}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">{t.scenarios.meta.timeOfDay}</span>
        <select className="select" value={scenario.timeOfDay ?? ''} onChange={(e) => set('timeOfDay', e.target.value || undefined)}>
          <option value="">—</option>
          {TIME_OF_DAY_IDS.map((id) => (
            <option key={id} value={id}>
              {data.timeOfDay[id]?.name ?? id}
            </option>
          ))}
        </select>
      </label>
      <label className="field narrow">
        <span className="field-label">{t.scenarios.meta.priority}</span>
        <input className="input" type="number" value={scenario.priority ?? ''} onChange={(e) => set('priority', e.target.value === '' ? undefined : Number(e.target.value))} />
      </label>
      <label className="field">
        <span className="field-label">{t.scenarios.meta.availability}</span>
        <textarea className="textarea mono" rows={10} value={availability} onChange={(e) => setAvailability(e.target.value)} onBlur={applyAvailability} spellCheck={false} />
        {error && <span className="inspector-error">{`${t.scenarios.jsonInvalid}: ${error}`}</span>}
      </label>
    </div>
  );
}

/** 電話・メールなど、JSON のまま編集するシナリオ */
export function JsonDocumentEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const { t } = useI18n();
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(JSON.stringify(value, null, 2)), [value]);
  return (
    <div className="json-document">
      <p className="field-hint">{t.scenarios.notStory}</p>
      <textarea
        className="textarea mono"
        value={text}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          try {
            onChange(JSON.parse(text));
            setError(null);
          } catch (err) {
            setError(String(err));
          }
        }}
      />
      {error && <p className="inspector-error">{error}</p>}
    </div>
  );
}
