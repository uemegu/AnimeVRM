import { useEffect, useState } from 'react';
import {
  ScenarioScene as SceneSchema,
  stageAtScene,
  TIME_OF_DAY_IDS,
  type CameraShot,
  type ScenarioChoice,
  type ScenarioPackage,
  type ScenarioScene,
  type SceneAvatarConfig,
  type ScreenTransition,
} from '@anime-vrm/scenario';
import type { StudioData } from '../../data/useStudioData';
import { Icon } from '../../components/Icon';
import { format, useI18n } from '../../i18n';
import { cutWarnings, makeText, textEn, textJa } from './scenarioEdit';
import { VoicePanel } from './VoicePanel';
import { EffectFields } from './EffectFields';

type Tab = 'line' | 'stage' | 'cast' | 'flow' | 'json';
const SHOTS: CameraShot[] = ['wide', 'medium', 'speaker', 'close'];
const SLOTS = ['left', 'center', 'right'] as const;
const EXPRESSIONS = ['neutral', 'happy', 'relaxed', 'sad', 'angry', 'surprised'] as const;
const LOOK_AT = ['player', 'camera', 'partner', 'speaker', 'forward'] as const;
/** 次のカットの選択肢で「ここで終わる」を表す値 */
const END = '__end__';
const SCREEN_TRANSITIONS: ScreenTransition[] = ['fade_black', 'eyelid_close', 'eyelid_blink'];

/** 音声生成に必要な、シナリオの場所と保存状態 */
export interface VoiceContext {
  category: string;
  scenarioId: string;
  baseUrl: string;
  dirty: boolean;
  onReload: () => void;
}

interface Props {
  scenario: ScenarioPackage;
  index: number;
  data: StudioData;
  voice: VoiceContext;
  onChange: (scene: ScenarioScene) => void;
}

/** 値が undefined なら項目ごと消す（JSON に余計な項目を残さない） */
function withField<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | undefined): T {
  const copy = { ...obj };
  if (value === undefined || value === '') delete copy[key];
  else copy[key] = value;
  return copy;
}

export function CutInspector({ scenario, index, data, voice, onChange }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('line');
  const scene = scenario.scenes[index];
  const warnings = cutWarnings(scenario, index);
  const set = <K extends keyof ScenarioScene>(key: K, value: ScenarioScene[K] | undefined) => onChange(withField(scene, key, value));

  return (
    <div className="cut-inspector">
      <div className="inspector-tabs" role="tablist">
        {(['line', 'stage', 'cast', 'flow', 'json'] as Tab[]).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`inspector-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            {t.scenarios.tabs[key]}
          </button>
        ))}
      </div>
      <div className="inspector-body">
        {warnings.length > 0 && (
          <ul className="inspector-warnings">
            {warnings.map((w) => (
              <li key={w}>{t.scenarios.warnings[w]}</li>
            ))}
          </ul>
        )}
        {tab === 'line' && <LineTab scene={scene} data={data} voice={voice} set={set} onChange={onChange} />}
        {tab === 'stage' && <StageTab scenario={scenario} index={index} data={data} set={set} />}
        {tab === 'cast' && <CastTab scenario={scenario} index={index} data={data} set={set} />}
        {tab === 'flow' && <FlowTab scenario={scenario} index={index} set={set} onChange={onChange} />}
        {tab === 'json' && <JsonTab scene={scene} onChange={onChange} />}
      </div>
    </div>
  );
}

type Setter = <K extends keyof ScenarioScene>(key: K, value: ScenarioScene[K] | undefined) => void;

function LineTab({ scene, data, voice, set, onChange }: { scene: ScenarioScene; data: StudioData; voice: VoiceContext; set: Setter; onChange: (s: ScenarioScene) => void }) {
  const { t } = useI18n();
  const character = data.characters.characters.find((c) => c.id === scene.speakerCharacterId);
  return (
    <div className="inspector-form">
      <label className="field">
        <span className="field-label">{t.scenarios.speaker}</span>
        <select
          className="select"
          value={scene.speakerCharacterId ?? ''}
          onChange={(e) => {
            const next = data.characters.characters.find((c) => c.id === e.target.value);
            let updated = withField(scene, 'speakerCharacterId', next?.id);
            updated = withField(updated, 'speaker', next ? next.name.ja : undefined);
            onChange(updated);
          }}
        >
          <option value="">{t.scenarios.narration}</option>
          {data.characters.characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name.ja}（{c.id}）
            </option>
          ))}
        </select>
      </label>
      {scene.speakerCharacterId && (
        <label className="field">
          <span className="field-label">{t.scenarios.speakerName}</span>
          <input
            className="input"
            value={textJa(scene.speaker)}
            placeholder={character?.name.ja}
            onChange={(e) => set('speaker', e.target.value || character?.name.ja)}
          />
          <span className="field-hint">{t.scenarios.speakerNameHint}</span>
        </label>
      )}
      <label className="field">
        <span className="field-label">{t.scenarios.textJa}</span>
        <textarea className="textarea" rows={4} value={textJa(scene.text)} onChange={(e) => onChange({ ...scene, text: makeText(e.target.value, textEn(scene.text)) })} />
      </label>
      <label className="field">
        <span className="field-label">{t.scenarios.textEn}</span>
        <textarea className="textarea" rows={2} value={textEn(scene.text)} onChange={(e) => onChange({ ...scene, text: makeText(textJa(scene.text), e.target.value) })} />
      </label>
      <div className="field">
        <span className="field-label">{t.scenarios.voice}</span>
        <VoicePanel
          category={voice.category}
          scenarioId={voice.scenarioId}
          lineId={scene.id}
          voiceUrl={scene.voiceUrl}
          baseUrl={voice.baseUrl}
          dirty={voice.dirty}
          onAdopted={voice.onReload}
        />
      </div>
    </div>
  );
}

function StageTab({ scenario, index, data, set }: { scenario: ScenarioPackage; index: number; data: StudioData; set: Setter }) {
  const { t } = useI18n();
  const scene = scenario.scenes[index];
  const before = index > 0 ? stageAtScene(scenario, index - 1) : undefined;
  const inherited = (value: string | undefined) => format(t.scenarios.inherited, { value: value ?? '—' });
  return (
    <div className="inspector-form">
      <label className="field">
        <span className="field-label">{t.scenarios.background}</span>
        <select className="select" value={scene.background ?? ''} onChange={(e) => set('background', e.target.value || undefined)}>
          <option value="">{inherited(data.locations[before?.background ?? scenario.location ?? '']?.name ?? before?.background)}</option>
          {Object.values(data.locations).map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">{t.scenarios.timeOfDay}</span>
        <select className="select" value={scene.timeOfDay ?? ''} onChange={(e) => set('timeOfDay', e.target.value || undefined)}>
          <option value="">{inherited(data.timeOfDay[before?.timeOfDay ?? scenario.timeOfDay ?? '']?.name)}</option>
          {TIME_OF_DAY_IDS.map((id) => (
            <option key={id} value={id}>
              {data.timeOfDay[id]?.name ?? id}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">{t.scenarios.bgm}</span>
        <select className="select" value={scene.bgm ?? ''} onChange={(e) => set('bgm', e.target.value || undefined)}>
          <option value="">{inherited(data.bgm[before?.bgm ?? scenario.bgm ?? '']?.title.ja ?? before?.bgm ?? scenario.bgm)}</option>
          <option value="silence">{t.scenarios.silence}</option>
          {Object.entries(data.bgm).map(([id, bgm]) => (
            <option key={id} value={id}>
              {bgm.title.ja}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">{t.scenarios.camera}</span>
        <select className="select" value={scene.camera ?? ''} onChange={(e) => set('camera', (e.target.value || undefined) as CameraShot | undefined)}>
          <option value="">{t.scenarios.auto}</option>
          {SHOTS.map((s) => (
            <option key={s} value={s}>
              {t.viewer.shots[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="inspector-check">
        <input type="checkbox" checked={!!scene.clearCast} onChange={(e) => set('clearCast', e.target.checked || undefined)} />
        {t.scenarios.clearCast}
      </label>
      <label className="field">
        <span className="field-label">{t.scenarios.screenTransition}</span>
        <select className="select" value={scene.screenTransition ?? ''} onChange={(e) => set('screenTransition', (e.target.value || undefined) as ScreenTransition | undefined)}>
          <option value="">{t.scenarios.screenTransitions.none}</option>
          {SCREEN_TRANSITIONS.map((kind) => (
            <option key={kind} value={kind}>
              {t.scenarios.screenTransitions[kind]}
            </option>
          ))}
        </select>
      </label>
      <label className="inspector-check">
        <input type="checkbox" checked={!!scene.focusLines} onChange={(e) => set('focusLines', e.target.checked || undefined)} />
        {t.scenarios.focusLines}
      </label>
      <label className="inspector-check">
        <input type="checkbox" checked={scene.flashEffect === 'white'} onChange={(e) => set('flashEffect', e.target.checked ? 'white' : undefined)} />
        {t.scenarios.flash}
      </label>
      <label className="field narrow">
        <span className="field-label">{t.scenarios.autoNextSec}</span>
        <input
          className="input"
          type="number"
          min={0}
          step={0.5}
          value={scene.autoNextSec ?? ''}
          onChange={(e) => set('autoNextSec', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </label>
    </div>
  );
}

function CastTab({ scenario, index, data, set }: { scenario: ScenarioPackage; index: number; data: StudioData; set: Setter }) {
  const { t } = useI18n();
  const scene = scenario.scenes[index];
  const before = scene.clearCast || index === 0 ? { cast: {} as Record<string, SceneAvatarConfig> } : stageAtScene(scenario, index - 1);
  const avatars = scene.avatars ?? {};
  const ids = [...new Set([...Object.keys(before.cast), ...Object.keys(avatars)])];
  const addable = data.characters.characters.filter((c) => c.models.length > 0 && !ids.includes(c.id));

  const setAvatar = (id: string, config: SceneAvatarConfig | undefined) => {
    const next = { ...avatars };
    if (config === undefined || Object.keys(config).length === 0) delete next[id];
    else next[id] = config;
    set('avatars', Object.keys(next).length ? next : undefined);
  };

  return (
    <div className="inspector-form">
      {ids.map((id) => {
        const own = avatars[id] ?? {};
        const prev = before.cast[id] ?? {};
        const effective = { ...prev, ...own };
        const character = data.characters.characters.find((c) => c.id === (effective.characterId ?? id));
        const update = <K extends keyof SceneAvatarConfig>(key: K, value: SceneAvatarConfig[K] | undefined) => setAvatar(id, withField(own, key, value));
        const inherit = (value: unknown) => format(t.scenarios.inherited, { value: value === undefined ? '—' : String(value) });
        const exited = own.visible === false;
        const position = effective.position;
        return (
          <section key={id} className={`cast-card${exited ? ' exited' : ''}`}>
            <header>
              <span className="cast-swatch" style={{ background: character?.themeColor ?? '#94a3b8' }} />
              <strong>{character?.name.ja ?? id}</strong>
              {exited && <span className="cut-badge">{t.scenarios.exited}</span>}
              <span className="cast-actions">
                <button type="button" className="schema-small-btn" onClick={() => setAvatar(id, exited ? withField(own, 'visible', undefined) : { visible: false })}>
                  {exited ? t.scenarios.remove : t.scenarios.exit}
                </button>
                {avatars[id] && !exited && (
                  <button type="button" className="schema-small-btn subtle" onClick={() => setAvatar(id, undefined)}>
                    {t.scenarios.remove}
                  </button>
                )}
              </span>
            </header>
            {!exited && (
              <div className="cast-grid">
                <label className="field">
                  <span className="field-label">{t.scenarios.position}</span>
                  <select
                    className="select"
                    value={own.position === undefined ? '' : Array.isArray(own.position) ? 'custom' : own.position}
                    onChange={(e) => {
                      const v = e.target.value;
                      update('position', v === '' ? undefined : v === 'custom' ? (Array.isArray(position) ? position : [0, 0, 0]) : (v as (typeof SLOTS)[number]));
                    }}
                  >
                    <option value="">{inherit(Array.isArray(prev.position) ? prev.position.join(', ') : prev.position && t.scenarios.slots[prev.position])}</option>
                    {SLOTS.map((s) => (
                      <option key={s} value={s}>
                        {t.scenarios.slots[s]}
                      </option>
                    ))}
                    <option value="custom">{t.scenarios.custom}</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">{t.scenarios.expression}</span>
                  <select className="select" value={own.expression ?? ''} onChange={(e) => update('expression', e.target.value || undefined)}>
                    <option value="">{inherit(prev.expression && t.viewer.expressions[prev.expression as (typeof EXPRESSIONS)[number]])}</option>
                    {EXPRESSIONS.map((ex) => (
                      <option key={ex} value={ex}>
                        {t.viewer.expressions[ex]}
                      </option>
                    ))}
                  </select>
                </label>
                {Array.isArray(own.position) && (
                  <div className="field cast-span">
                    <span className="field-label">{t.scenarios.custom}</span>
                    <div className="schema-tuple">
                      {own.position.map((v, i) => (
                        <label key={i}>
                          <span>{'XYZ'[i]}</span>
                          <input
                            className="input schema-number"
                            type="number"
                            step={0.05}
                            value={v}
                            onChange={(e) => update('position', (own.position as number[]).map((o, j) => (j === i ? Number(e.target.value) : o)) as [number, number, number])}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <label className="field cast-span">
                  <span className="field-label">{t.scenarios.motion}</span>
                  <div className="cast-motion">
                    <select className="select" value={own.motion ?? ''} onChange={(e) => update('motion', e.target.value || undefined)}>
                      <option value="">{inherit(prev.motion)}</option>
                      {data.animations.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <label className="inspector-check compact">
                      <input
                        type="checkbox"
                        checked={own.motionLoop ?? (effective.motion ? !!data.motions[effective.motion]?.loop : true)}
                        onChange={(e) => update('motionLoop', e.target.checked)}
                      />
                      {t.scenarios.loop}
                    </label>
                  </div>
                </label>
                <label className="field">
                  <span className="field-label">{t.scenarios.lookAt}</span>
                  <select className="select" value={own.lookAtTarget ?? ''} onChange={(e) => update('lookAtTarget', e.target.value || undefined)}>
                    <option value="">{inherit(prev.lookAtTarget)}</option>
                    {LOOK_AT.map((l) => (
                      <option key={l} value={l}>
                        {t.scenarios.lookAtTargets[l]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">{t.scenarios.outfit}</span>
                  <select className="select" value={own.modelUrl ?? ''} onChange={(e) => update('modelUrl', e.target.value || undefined)}>
                    <option value="">{inherit(character?.models.find((m) => m.url === prev.modelUrl)?.label.ja ?? prev.modelUrl)}</option>
                    {character?.models.map((m) => (
                      <option key={m.key} value={m.url}>
                        {m.label.ja}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="cast-span cast-subhead">{t.scenarios.effects.title}</div>
                <EffectFields
                  value={own}
                  withFastMotion
                  unsetLabel={(key) => {
                    const value = prev[key];
                    if (typeof value === 'boolean' && key !== 'eyeWander') return inherit(value ? t.scenarios.effects.on : t.scenarios.effects.off);
                    return inherit(value === undefined ? undefined : String(value));
                  }}
                  onChange={(key, value) => update(key, value)}
                />
              </div>
            )}
          </section>
        );
      })}
      {addable.length > 0 && (
        <label className="field">
          <span className="field-label">{t.scenarios.addCharacter}</span>
          <select className="select" value="" onChange={(e) => e.target.value && setAvatar(e.target.value, { position: 'center', expression: 'neutral' })}>
            <option value="" />
            {addable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name.ja}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

/** フラグ（キー=値 の行）と JSON の相互変換 */
function flagsToText(flags: Record<string, boolean | number | string> | undefined): string {
  return Object.entries(flags ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}
function textToFlags(text: string): Record<string, boolean | number | string> | undefined {
  const entries = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, ...rest] = line.split('=');
      const raw = rest.join('=').trim();
      const value = raw === 'true' ? true : raw === 'false' ? false : raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
      return [key.trim(), value] as const;
    })
    .filter(([key]) => key);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function FlowTab({ scenario, index, set, onChange }: { scenario: ScenarioPackage; index: number; set: Setter; onChange: (s: ScenarioScene) => void }) {
  const { t } = useI18n();
  const scene = scenario.scenes[index];
  const ids = scenario.scenes.map((s) => s.id);
  const nextRow = scenario.scenes[index + 1]?.id;
  const choices = scene.choices ?? [];
  const [flagsText, setFlagsText] = useState(flagsToText(scene.setFlags));
  useEffect(() => setFlagsText(flagsToText(scene.setFlags)), [scene.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setChoice = (i: number, choice: ScenarioChoice | undefined) => {
    const next = choice ? choices.map((c, j) => (j === i ? choice : c)) : choices.filter((_, j) => j !== i);
    set('choices', next.length ? next : undefined);
  };

  return (
    <div className="inspector-form">
      <label className="field">
        <span className="field-label">{t.scenarios.next}</span>
        <select
          className="select"
          value={scene.end ? END : (scene.nextSceneId ?? '')}
          onChange={(e) => {
            const { nextSceneId: _next, end: _end, ...rest } = scene;
            const v = e.target.value;
            onChange(v === END ? { ...rest, end: true } : v ? { ...rest, nextSceneId: v } : rest);
          }}
        >
          <option value="">{nextRow ? format(t.scenarios.nextAuto, { id: nextRow }) : t.scenarios.nextEnd}</option>
          {nextRow && <option value={END}>{t.scenarios.endHere}</option>}
          {ids.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>

      <section className="form-section">
        <div className="form-section-header">
          <h3>{format(t.scenarios.choices, { count: choices.length })}</h3>
          <button type="button" className="btn" onClick={() => set('choices', [...choices, { text: '', goto: nextRow ?? ids[0] }])}>
            <Icon name="plus" size={16} />
            {t.scenarios.addChoice}
          </button>
        </div>
        {choices.map((choice, i) => (
          <div key={i} className="choice-row">
            <input className="input" placeholder={t.scenarios.choiceText} value={textJa(choice.text)} onChange={(e) => setChoice(i, { ...choice, text: makeText(e.target.value, textEn(choice.text)) })} />
            <select className="select" value={choice.goto} onChange={(e) => setChoice(i, { ...choice, goto: e.target.value })}>
              {!ids.includes(choice.goto) && <option value={choice.goto}>{choice.goto}</option>}
              {ids.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <button type="button" className="btn icon ghost" title={t.common.remove} onClick={() => setChoice(i, undefined)}>
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
        {choices.length > 0 && (
          <label className="field narrow">
            <span className="field-label">{t.scenarios.choiceTimeout}</span>
            <input
              className="input"
              type="number"
              min={1}
              value={scene.choiceTimeout?.seconds ?? ''}
              onChange={(e) => set('choiceTimeout', e.target.value === '' ? undefined : { ...scene.choiceTimeout, seconds: Number(e.target.value) })}
            />
          </label>
        )}
      </section>

      <label className="field">
        <span className="field-label">{t.scenarios.setFlags}</span>
        <textarea className="textarea mono" rows={3} value={flagsText} onChange={(e) => setFlagsText(e.target.value)} onBlur={() => set('setFlags', textToFlags(flagsText))} />
        <span className="field-hint">{t.scenarios.flagsHint}</span>
      </label>
    </div>
  );
}

function JsonTab({ scene, onChange }: { scene: ScenarioScene; onChange: (s: ScenarioScene) => void }) {
  const { t } = useI18n();
  const [text, setText] = useState(JSON.stringify(scene, null, 2));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setText(JSON.stringify(scene, null, 2));
    setError(null);
  }, [scene]);
  const apply = () => {
    try {
      const parsed = SceneSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' / '));
        return;
      }
      onChange(JSON.parse(text));
    } catch (err) {
      setError(String(err));
    }
  };
  return (
    <div className="inspector-form">
      <p className="field-hint">{t.scenarios.jsonHint}</p>
      <textarea className="textarea mono" rows={20} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      {error && <p className="inspector-error">{`${t.scenarios.jsonInvalid}: ${error}`}</p>}
      <div>
        <button type="button" className="btn primary" onClick={apply}>
          {t.scenarios.apply}
        </button>
      </div>
    </div>
  );
}
