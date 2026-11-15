import type { StageQualityLevel } from '@anime-vrm/engine/stage/quality';
import { useI18n } from '../../i18n';
import { useRenderQuality } from '../../stage/renderQuality';
import './settings.css';

const LEVELS: StageQualityLevel[] = ['high', 'low'];

/** Studio の設定（この端末に保存する） */
export function SettingsView() {
  const { t } = useI18n();
  const { level, setLevel, cloth, setCloth, clothSleep, setClothSleep } = useRenderQuality();
  return (
    <div className="settings">
      <h1>{t.settings.title}</h1>
      <section className="settings-section">
        <h2>{t.settings.quality}</h2>
        <p className="field-hint">{t.settings.qualityHint}</p>
        <div className="settings-options" role="radiogroup" aria-label={t.settings.quality}>
          {LEVELS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={level === option}
              className={`settings-option${level === option ? ' active' : ''}`}
              onClick={() => setLevel(option)}
            >
              <span className="settings-option-title">{t.settings.levels[option]}</span>
              <span className="settings-option-body">{t.settings.levelHints[option]}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <h2>{t.settings.cloth}</h2>
        <p className="field-hint">{t.settings.clothHint}</p>
        <Choice
          label={t.settings.cloth}
          value={cloth}
          onChange={setCloth}
          titles={t.settings.clothOptions}
          hints={t.settings.clothHints}
        />
      </section>
      {cloth && (
        <section className="settings-section">
          <h2>{t.settings.clothSleep}</h2>
          <p className="field-hint">{t.settings.clothSleepHint}</p>
          <Choice
            label={t.settings.clothSleep}
            value={clothSleep}
            onChange={setClothSleep}
            titles={t.settings.clothSleepOptions}
            hints={t.settings.clothSleepHints}
          />
        </section>
      )}
    </div>
  );
}

/** 入・切の 2 択（描画の品質と同じ見た目） */
function Choice({ label, value, onChange, titles, hints }: {
  label: string;
  value: boolean;
  onChange: (on: boolean) => void;
  titles: { on: string; off: string };
  hints: { on: string; off: string };
}) {
  return (
    <div className="settings-options" role="radiogroup" aria-label={label}>
      {([true, false] as const).map((on) => {
        const key = on ? 'on' : 'off';
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === on}
            className={`settings-option${value === on ? ' active' : ''}`}
            onClick={() => onChange(on)}
          >
            <span className="settings-option-title">{titles[key]}</span>
            <span className="settings-option-body">{hints[key]}</span>
          </button>
        );
      })}
    </div>
  );
}
