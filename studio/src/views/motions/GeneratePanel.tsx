import { useEffect, useMemo, useState } from 'react';
import { validateMotionQualityPlan } from '@anime-vrm/motion/quality/validate';
import type { AvatarContactProfile, Contact, MotionQualityPlan, Style } from '@anime-vrm/motion/quality/types';
import type { GenerateResult } from '@anime-vrm/motion/ardy/generator';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';
import { api } from '../../api/client';
import { Icon } from '../../components/Icon';
import type { StudioData } from '../../data/useStudioData';
import { format, useI18n } from '../../i18n';
import { MotionPreview } from './MotionPreview';
import { useGenerator, webGpuAvailable } from './useGenerator';

const FINGER_SHAPES = ['none', 'index', 'peace', 'thumb', 'fist', 'open', 'three'] as const;
type FingerShape = (typeof FINGER_SHAPES)[number];

/** アバターの URL → 校正結果のパス（assets/motion-profiles/ から） */
export const profilePathFor = (avatarUrl: string) => avatarUrl.replace(/^\/models\//, '').replace(/\.vrm$/i, '.json');

/** 候補1つ分（再生用の URL と、保存用の FBX） */
interface Candidate {
  rank: number;
  seed: string;
  cfgWeight: number;
  lowActivity: boolean;
  score: GenerateResult['candidates'][number]['score'];
  fbx: string;
  url: string;
}

function toBlobUrl(base64: string): string {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
}

/** 指示文から保存名の案（ardy_ + 動詞など） */
function suggestName(prompt: string): string {
  const words = prompt
    .toLowerCase()
    .replace(/^a person\s+/, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !['their', 'the', 'a', 'and', 'with', 'his', 'her', 'to'].includes(w))
    .slice(0, 3);
  return `ardy_${words.join('_') || 'motion'}`.slice(0, 48);
}

const newContact = (duration: number): Contact => ({
  kind: 'face', side: 'right', target: 'cheek', targetSide: 'right',
  start: +(duration * 0.2).toFixed(2), holdStart: +(duration * 0.35).toFixed(2), holdEnd: +(duration * 0.75).toFixed(2), end: +(duration * 0.9).toFixed(2),
});

/**
 * ardy-mini で候補を作り、並べて再生して1つを保存する
 */
export function GeneratePanel({ data, onSaved }: { data: StudioData; onSaved: () => void }) {
  const { t } = useI18n();
  const tm = t.motions;
  const { status, load, generator } = useGenerator();
  const avatars = useMemo(
    () => data.characters.characters.flatMap((c) => c.models.map((m) => ({ url: m.url, label: `${c.name.ja}（${m.label.ja}）` }))),
    [data]
  );
  const [avatarUrl, setAvatarUrl] = useState(avatars[0]?.url ?? '/models/aoi/aoi-school.vrm');
  const [prompt, setPrompt] = useState('');
  const [actingNote, setActingNote] = useState('');
  const [duration, setDuration] = useState(4);
  const [count, setCount] = useState(4);
  const [cfg, setCfg] = useState('3.5');
  const [lockLegs, setLockLegs] = useState(true);
  const [amplitude, setAmplitude] = useState(1);
  const [loop, setLoop] = useState(false);
  const [fitHands, setFitHands] = useState(true);
  const [fingers, setFingers] = useState<Record<'right' | 'left', FingerShape>>({ right: 'none', left: 'none' });
  const [profile, setProfile] = useState<AvatarContactProfile | null>(null);
  const [useContact, setUseContact] = useState(false);
  const [style, setStyle] = useState<Style>('neutral');
  const [styleStrength, setStyleStrength] = useState(0.5);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [quality, setQuality] = useState<GenerateResult['qualityReport']>();
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [name, setName] = useState('');
  const [loopFlag, setLoopFlag] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 校正済みのアバターなら接触の補正を使える
  useEffect(() => {
    setProfile(null);
    fetch(resolveAssetUrl(`/motion-profiles/${profilePathFor(avatarUrl)}`), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setProfile(json?.calibrated ? (json as AvatarContactProfile) : null))
      .catch(() => setProfile(null));
  }, [avatarUrl]);

  // 候補の URL は作り直したら捨てる
  useEffect(() => () => candidates.forEach((c) => URL.revokeObjectURL(c.url)), [candidates]);

  const generate = async () => {
    if (!generator) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const cfgWeights = cfg.split(',').map((v) => Number(v.trim())).filter((v) => Number.isFinite(v));
      let qualityOptions;
      if (useContact && profile && contacts.length) {
        const plan: MotionQualityPlan = validateMotionQualityPlan({ version: 1, duration, style, styleStrength, timingSource: 'authored', contacts });
        qualityOptions = { plan, avatarUrl, profile };
      }
      const selection = Object.fromEntries(Object.entries(fingers).filter(([, shape]) => shape !== 'none'));
      const result = await generator.generate({
        prompt: prompt.trim(),
        ...(actingNote.trim() ? { actingNote: actingNote.trim() } : {}),
        duration,
        format: 'fbx',
        candidates: count,
        cfgWeights: cfgWeights.length ? cfgWeights : undefined,
        keep: count * Math.max(1, cfgWeights.length),
        avatarUrl,
        fitHands,
        loop,
        style: { lockLegs, amplitude },
        ...(Object.keys(selection).length ? { fingers: selection } : {}),
        ...(qualityOptions ? { quality: qualityOptions } : {}),
      });
      const files = new Map<number, string>([[1, result.data as string], ...result.alternates.map((a) => [a.rank, a.data as string] as const)]);
      const next = result.candidates
        .filter((c) => files.get(c.rank))
        .map((c) => ({ ...c, fbx: files.get(c.rank)!, url: toBlobUrl(files.get(c.rank)!) }));
      setCandidates(next);
      setQuality(result.qualityReport);
      setSelected(next[0] ?? null);
      setName(suggestName(prompt));
      setLoopFlag(loop);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const save = async (overwrite = false) => {
    if (!selected) return;
    setMessage(null);
    const summary = {
      prompt: prompt.trim(),
      ...(actingNote.trim() ? { actingNote: actingNote.trim() } : {}),
      duration,
      avatar: avatarUrl,
      options: { lockLegs, amplitude, loop, fitHands, fingers, ...(useContact && contacts.length ? { contacts, style, styleStrength } : {}) },
      adoptedRank: selected.rank,
      note: 'Lower score is better. Scores detect defects only.',
      candidates: candidates.map(({ rank, seed, cfgWeight, lowActivity, score }) => ({ rank, seed, cfgWeight, lowActivity, score })),
    };
    const res = await api.saveMotion({ name, fbx: selected.fbx, candidates: summary, loop: loopFlag, overwrite });
    if (res.status === 409 && !overwrite) {
      if (window.confirm(tm.overwrite)) await save(true);
      return;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? String(res.status));
      return;
    }
    setMessage(format(tm.saved, { name }));
    onSaved();
  };

  const canGenerate = !!generator && !busy && prompt.trim().length > 0;
  const statusText = status.error ?? status.detail;

  return (
    <div className="motion-generate">
      <aside className="motion-form">
        <label className="field">
          <span className="field-label">{tm.avatar}</span>
          <select className="select" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}>
            {avatars.map((a) => (
              <option key={a.url} value={a.url}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{tm.prompt}</span>
          <textarea className="textarea" rows={3} value={prompt} placeholder={tm.promptHint} onChange={(e) => setPrompt(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">{tm.actingNote}</span>
          <input className="input" value={actingNote} placeholder={tm.actingNoteHint} onChange={(e) => setActingNote(e.target.value)} />
        </label>
        <div className="motion-row">
          <label className="field">
            <span className="field-label">{tm.duration}</span>
            <input className="input" type="number" min={2} max={8} step={0.5} value={duration} onChange={(e) => setDuration(Math.min(8, Math.max(2, Number(e.target.value))))} />
          </label>
          <label className="field">
            <span className="field-label">{tm.candidates}</span>
            <input className="input" type="number" min={1} max={8} value={count} onChange={(e) => setCount(Math.min(8, Math.max(1, Number(e.target.value))))} />
          </label>
          <label className="field">
            <span className="field-label">{tm.cfg}</span>
            <input className="input" value={cfg} onChange={(e) => setCfg(e.target.value)} />
          </label>
        </div>
        <label className="inspector-check">
          <input type="checkbox" checked={lockLegs} onChange={(e) => setLockLegs(e.target.checked)} />
          {tm.lockLegs}
        </label>
        <label className="inspector-check">
          <input type="checkbox" checked={fitHands} onChange={(e) => setFitHands(e.target.checked)} />
          {tm.fitHands}
        </label>
        <label className="inspector-check">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          {tm.loop}
        </label>
        <label className="field">
          <span className="field-label">{`${tm.amplitude}（${amplitude.toFixed(2)}）`}</span>
          <input className="schema-range" type="range" min={0.3} max={1.5} step={0.05} value={amplitude} onChange={(e) => setAmplitude(Number(e.target.value))} />
        </label>
        <div className="motion-row">
          {(['right', 'left'] as const).map((side) => (
            <label key={side} className="field">
              <span className="field-label">{`${tm.fingers}（${tm.fingerSides[side]}）`}</span>
              <select className="select" value={fingers[side]} onChange={(e) => setFingers({ ...fingers, [side]: e.target.value as FingerShape })}>
                {FINGER_SHAPES.map((shape) => (
                  <option key={shape} value={shape}>
                    {tm.fingerShapes[shape]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <section className="motion-contact">
          <label className="inspector-check">
            <input type="checkbox" disabled={!profile} checked={useContact && !!profile} onChange={(e) => setUseContact(e.target.checked)} />
            {tm.contact}
          </label>
          {!profile && <p className="field-hint">{tm.contactNeedsProfile}</p>}
          {useContact && profile && (
            <ContactEditor
              contacts={contacts}
              duration={duration}
              style={style}
              styleStrength={styleStrength}
              onChange={(next) => {
                setContacts(next.contacts);
                setStyle(next.style);
                setStyleStrength(next.styleStrength);
              }}
            />
          )}
        </section>

        {!webGpuAvailable ? (
          <p className="inspector-error">{tm.noWebGpu}</p>
        ) : !status.ready ? (
          <div className="motion-load">
            <button type="button" className="btn primary" disabled={status.state === 'loading'} onClick={load}>
              {tm.loadModel}
            </button>
            <p className="field-hint">{tm.loadModelHint}</p>
          </div>
        ) : (
          <button type="button" className="btn primary" disabled={!canGenerate} onClick={generate}>
            <Icon name="play" size={14} />
            {busy ? tm.generating : tm.generate}
          </button>
        )}
        {statusText && <p className="field-hint">{statusText}</p>}
        {error && <p className="inspector-error">{error}</p>}
      </aside>

      <section className="motion-stage">
        <div className="motion-canvas">
          <MotionPreview data={data} avatarUrl={avatarUrl} motion={selected?.url ?? null} cue={selected?.url ?? 'idle'} />
        </div>
        <div className="motion-results">
          {candidates.length === 0 ? (
            <p className="field-hint">{tm.noResults}</p>
          ) : (
            <>
              <p className="field-hint">{tm.results}</p>
              {quality && (
                <p className="field-hint">
                  {format(tm.quality, { status: quality.status })} — {tm.qualityOnlyFirst}
                </p>
              )}
              <ul className="motion-candidates">
                {candidates.map((c) => (
                  <li key={c.rank} className={selected?.rank === c.rank ? 'selected' : ''}>
                    <button type="button" className="motion-candidate" onClick={() => setSelected(c)}>
                      <strong>{format(tm.rank, { rank: c.rank })}</strong>
                      <span className="inspector-mono">{c.score.total.toFixed(2)}</span>
                      {c.lowActivity && <span className="cut-badge">{tm.lowActivity}</span>}
                      <span className="motion-metrics">
                        {format(tm.metrics, {
                          slide: c.score.metrics.footSlide.toFixed(3),
                          penetration: c.score.metrics.handPenetration.toFixed(2),
                          wrist: c.score.metrics.wristStrain.toFixed(2),
                          activity: c.score.metrics.activity.toFixed(2),
                        })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {selected && (
                <div className="motion-adopt">
                  <label className="field">
                    <span className="field-label">{tm.motionName}</span>
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                  </label>
                  <label className="inspector-check">
                    <input type="checkbox" checked={loopFlag} onChange={(e) => setLoopFlag(e.target.checked)} />
                    {tm.loopFlag}
                  </label>
                  <button type="button" className="btn primary" disabled={!/^[a-z][a-z0-9_]{1,47}$/.test(name)} onClick={() => save()}>
                    {tm.adopt}
                  </button>
                  {message && <span className="field-hint">{message}</span>}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

interface ContactEditorValue {
  contacts: Contact[];
  style: Style;
  styleStrength: number;
}

/** 接触の補正の指定（いつ、どちらの手を、どこに当てるか） */
function ContactEditor({ contacts, duration, style, styleStrength, onChange }: ContactEditorValue & { duration: number; onChange: (value: ContactEditorValue) => void }) {
  const { t } = useI18n();
  const tm = t.motions;
  const set = (next: Partial<ContactEditorValue>) => onChange({ contacts, style, styleStrength, ...next });
  const setContact = (index: number, contact: Contact | null) =>
    set({ contacts: contact ? contacts.map((c, i) => (i === index ? contact : c)) : contacts.filter((_, i) => i !== index) });
  return (
    <div className="contact-editor">
      <div className="motion-row">
        <label className="field">
          <span className="field-label">{tm.contactStyle}</span>
          <select className="select" value={style} onChange={(e) => set({ style: e.target.value as Style })}>
            {(['neutral', 'soft-compact'] as const).map((s) => (
              <option key={s} value={s}>
                {tm.contactStyles[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{`${tm.contactStrength}（${styleStrength.toFixed(2)}）`}</span>
          <input className="schema-range" type="range" min={0} max={1} step={0.05} value={styleStrength} onChange={(e) => set({ styleStrength: Number(e.target.value) })} />
        </label>
      </div>
      {contacts.map((contact, index) => (
        <div key={index} className="contact-row">
          <div className="motion-row">
            <select
              className="select"
              value={contact.kind}
              onChange={(e) => {
                const { start, holdStart, holdEnd, end } = contact;
                setContact(index, e.target.value === 'palmsTogether' ? { kind: 'palmsTogether', start, holdStart, holdEnd, end } : { ...newContact(duration), start, holdStart, holdEnd, end });
              }}
            >
              {(['face', 'palmsTogether'] as const).map((k) => (
                <option key={k} value={k}>
                  {tm.contactKinds[k]}
                </option>
              ))}
            </select>
            {contact.kind === 'face' && (
              <>
                <select className="select" value={contact.side} onChange={(e) => setContact(index, { ...contact, side: e.target.value as 'left' | 'right' })} aria-label={tm.hand}>
                  {(['right', 'left'] as const).map((s) => (
                    <option key={s} value={s}>{`${tm.hand}: ${tm.sides[s]}`}</option>
                  ))}
                </select>
                <select
                  className="select"
                  value={contact.target}
                  aria-label={tm.faceTarget}
                  onChange={(e) => {
                    const target = e.target.value as 'cheek' | 'mouth' | 'chin';
                    const { start, holdStart, holdEnd, end, side } = contact;
                    setContact(index, target === 'cheek' ? { kind: 'face', side, target, targetSide: side, start, holdStart, holdEnd, end } : { kind: 'face', side, target, start, holdStart, holdEnd, end });
                  }}
                >
                  {(['cheek', 'mouth', 'chin'] as const).map((target) => (
                    <option key={target} value={target}>
                      {tm.faceTargets[target]}
                    </option>
                  ))}
                </select>
                {contact.target === 'cheek' && (
                  <select className="select" value={contact.targetSide} aria-label={tm.cheekSide} onChange={(e) => setContact(index, { ...contact, targetSide: e.target.value as 'left' | 'right' })}>
                    {(['right', 'left'] as const).map((s) => (
                      <option key={s} value={s}>{`${tm.cheekSide}: ${tm.sides[s]}`}</option>
                    ))}
                  </select>
                )}
              </>
            )}
            <button type="button" className="btn icon" title={t.scenarios.timeline.deleteKey} onClick={() => setContact(index, null)}>
              <Icon name="trash" size={14} />
            </button>
          </div>
          <div className="field">
            <span className="field-label">{tm.times}</span>
            <div className="motion-row">
              {(['start', 'holdStart', 'holdEnd', 'end'] as const).map((key) => (
                <input key={key} className="input" type="number" min={0} max={duration} step={0.05} value={contact[key]} onChange={(e) => setContact(index, { ...contact, [key]: Number(e.target.value) })} />
              ))}
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => set({ contacts: [...contacts, newContact(duration)] })}>
        <Icon name="plus" size={14} />
        {tm.addContact}
      </button>
    </div>
  );
}
