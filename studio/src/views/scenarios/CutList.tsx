import type { CharacterBook, ScenarioPackage } from '@anime-vrm/scenario';
import { Icon } from '../../components/Icon';
import { format, useI18n } from '../../i18n';
import { cutWarnings, textJa } from './scenarioEdit';

interface Props {
  scenario: ScenarioPackage;
  characters: CharacterBook;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
}

/** カットの一覧（話者の色・本文の先頭・選択肢やボイスの有無） */
export function CutList({ scenario, characters, selectedIndex, onSelect, onAdd, onDuplicate, onMove, onDelete }: Props) {
  const { t } = useI18n();
  const colorOf = (id?: string) => characters.characters.find((c) => c.id === id)?.themeColor ?? '#cbd5e1';

  return (
    <section className="cut-list">
      <header className="cut-list-header">
        <h2>{t.scenarios.cuts}</h2>
        <div className="cut-list-tools">
          <button type="button" className="btn icon" title={t.scenarios.moveUp} disabled={selectedIndex <= 0} onClick={() => onMove(-1)}>
            <span className="rotate-up">
              <Icon name="chevron" size={16} />
            </span>
          </button>
          <button type="button" className="btn icon" title={t.scenarios.moveDown} disabled={selectedIndex >= scenario.scenes.length - 1} onClick={() => onMove(1)}>
            <span className="rotate-down">
              <Icon name="chevron" size={16} />
            </span>
          </button>
          <button type="button" className="btn icon" title={t.scenarios.duplicate} onClick={onDuplicate}>
            <Icon name="copy" size={16} />
          </button>
          <button type="button" className="btn icon" title={t.scenarios.deleteCut} disabled={scenario.scenes.length <= 1} onClick={onDelete}>
            <Icon name="trash" size={16} />
          </button>
          <button type="button" className="btn icon primary" title={t.scenarios.addCut} onClick={onAdd}>
            <Icon name="plus" size={16} />
          </button>
        </div>
      </header>
      <ol className="cut-items">
        {scenario.scenes.map((scene, index) => {
          const speaker = textJa(scene.speaker);
          const warn = cutWarnings(scenario, index).length > 0;
          return (
            <li key={`${scene.id}-${index}`}>
              <button type="button" className={`cut-item${index === selectedIndex ? ' active' : ''}`} onClick={() => onSelect(index)}>
                <span className="cut-bar" style={{ background: scene.speakerCharacterId ? colorOf(scene.speakerCharacterId) : 'transparent' }} />
                <span className="cut-main">
                  <span className="cut-meta">
                    <span className="cut-id">{scene.id}</span>
                    <span className="cut-speaker">{speaker || t.scenarios.narration}</span>
                    {scene.choices?.length ? <span className="cut-badge">{format(t.scenarios.choices, { count: scene.choices.length })}</span> : null}
                    {scene.voiceUrl && <span className="cut-badge voice">{t.scenarios.voice}</span>}
                    {warn && <span className="cut-badge warn">!</span>}
                  </span>
                  <span className="cut-text">{textJa(scene.text) || '—'}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
