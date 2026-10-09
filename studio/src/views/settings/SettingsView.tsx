import type { StageQualityLevel } from '@anime-vrm/engine/stage/quality';
import { useI18n } from '../../i18n';
import { useRenderQuality } from '../../stage/renderQuality';
import './settings.css';

const LEVELS: StageQualityLevel[] = ['high', 'low'];

/** Studio の設定（この端末に保存する） */
export function SettingsView() {
  const { t } = useI18n();
  const { level, setLevel } = useRenderQuality();
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
    </div>
  );
}
