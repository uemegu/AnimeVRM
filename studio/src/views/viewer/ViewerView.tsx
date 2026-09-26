import { useEffect, useMemo, useState } from 'react';
import type { CameraShot, CharacterBook } from '@anime-vrm/scenario';
import type { StageCastMember } from '@anime-vrm/engine/stage/types';
import type { TimeOfDayId } from '@anime-vrm/engine/stage/visual';
import { api, type AssetEntry } from '../../api/client';
import { useI18n } from '../../i18n';
import { StageCanvas } from '../../stage/StageCanvas';
import { useStagePresets } from '../../stage/useStagePresets';
import './viewer.css';

const TIMES: TimeOfDayId[] = ['morning', 'day', 'evening', 'night', 'divine'];
const SHOTS: CameraShot[] = ['wide', 'medium', 'speaker', 'close'];
const EXPRESSIONS = ['neutral', 'happy', 'relaxed', 'sad', 'angry', 'surprised'] as const;
const IDLE = 'Standing Idle';

/** assets/animations/<name>.fbx の name */
function motionName(url: string): string {
  return url.replace(/^\/animations\//, '').replace(/\.fbx$/i, '');
}

export function ViewerView() {
  const { t } = useI18n();
  const { presets, error } = useStagePresets();
  const [book, setBook] = useState<CharacterBook | null>(null);
  const [motions, setMotions] = useState<AssetEntry[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [characterId, setCharacterId] = useState('aoi');
  const [modelKey, setModelKey] = useState('default');
  const [locationId, setLocationId] = useState('school_gate');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDayId>('day');
  const [shot, setShot] = useState<CameraShot>('speaker');
  const [expression, setExpression] = useState<string>('neutral');
  const [motion, setMotion] = useState(IDLE);
  const [motionLoop, setMotionLoop] = useState(true);
  const [motionCue, setMotionCue] = useState(0);
  const [motionFilter, setMotionFilter] = useState('');

  useEffect(() => {
    Promise.all([api.characters(), api.assets('animations')])
      .then(([characters, animationList]) => {
        setBook(characters);
        setMotions(animationList);
      })
      .catch(() => setLoadError(true));
  }, []);

  const characters = book?.characters.filter((c) => c.models.length > 0) ?? [];
  const character = characters.find((c) => c.id === characterId);
  const model = character?.models.find((m) => m.key === modelKey) ?? character?.models[0];

  const cast = useMemo<StageCastMember[]>(
    () =>
      model
        ? [
            {
              id: characterId,
              modelUrl: model.url,
              position: [0, 0, 0],
              rotationY: 0,
              expression,
              expressionWeight: 1.0,
              motion,
              motionLoop,
              motionCue: String(motionCue),
            },
          ]
        : [],
    [characterId, model, expression, motion, motionLoop, motionCue]
  );

  const filteredMotions = motions.filter((m) => motionName(m.url).toLowerCase().includes(motionFilter.toLowerCase()));

  if (error || loadError) return <div className="viewer-message">{t.common.loadFailed}</div>;
  if (!presets || !book) return null;

  const playMotion = (name: string) => {
    setMotion(name);
    setMotionCue((n) => n + 1);
  };

  return (
    <div className="viewer">
      <aside className="viewer-panel">
        <header className="viewer-panel-header">
          <h1>{t.nav.viewer}</h1>
        </header>
        <div className="viewer-panel-body">
          <section className="viewer-section">
            <h2>{t.viewer.character}</h2>
            <div className="viewer-character-grid">
              {characters.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`viewer-character${c.id === characterId ? ' active' : ''}`}
                  onClick={() => {
                    setCharacterId(c.id);
                    setModelKey('default');
                  }}
                >
                  <span className="viewer-swatch" style={{ background: c.themeColor }} />
                  {c.name.ja}
                </button>
              ))}
            </div>
            {character && character.models.length > 1 && (
              <div className="segmented">
                {character.models.map((m) => (
                  <button key={m.key} type="button" className={m.key === model?.key ? 'active' : ''} onClick={() => setModelKey(m.key)}>
                    {m.label.ja}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="viewer-section">
            <h2>{t.viewer.scene}</h2>
            <label className="field">
              <span className="field-label">{t.viewer.location}</span>
              <select className="select" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                {Object.values(presets.locations).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <span className="field-label">{t.viewer.timeOfDay}</span>
              <div className="segmented five">
                {TIMES.map((time) => (
                  <button key={time} type="button" className={time === timeOfDay ? 'active' : ''} onClick={() => setTimeOfDay(time)}>
                    {presets.timeOfDay[time]?.name ?? time}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="viewer-section">
            <h2>{t.viewer.camera}</h2>
            <div className="segmented four">
              {SHOTS.map((s) => (
                <button key={s} type="button" className={s === shot ? 'active' : ''} onClick={() => setShot(s)}>
                  {t.viewer.shots[s]}
                </button>
              ))}
            </div>
          </section>

          <section className="viewer-section">
            <h2>{t.viewer.expression}</h2>
            <div className="viewer-chip-grid">
              {EXPRESSIONS.map((e) => (
                <button key={e} type="button" className={`viewer-chip${e === expression ? ' active' : ''}`} onClick={() => setExpression(e)}>
                  {t.viewer.expressions[e]}
                </button>
              ))}
            </div>
          </section>

          <section className="viewer-section grow">
            <div className="viewer-section-title">
              <h2>{t.viewer.motion}</h2>
              <label className="viewer-toggle">
                <input type="checkbox" checked={motionLoop} onChange={(e) => setMotionLoop(e.target.checked)} />
                {t.viewer.loop}
              </label>
            </div>
            <input className="input" placeholder={t.viewer.searchMotion} value={motionFilter} onChange={(e) => setMotionFilter(e.target.value)} />
            <ul className="viewer-motion-list">
              {filteredMotions.map((m) => {
                const name = motionName(m.url);
                return (
                  <li key={m.url}>
                    <button type="button" className={name === motion ? 'active' : ''} onClick={() => playMotion(name)}>
                      {name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </aside>

      <section className="viewer-stage">
        <div className="viewer-frame">
          <StageCanvas presets={presets} timeOfDay={timeOfDay} locationId={locationId} cast={cast} cameraShot={shot} focusId={characterId} />
        </div>
        <p className="viewer-caption">
          {character?.name.ja} ・ {model?.label.ja} ／ {presets.locations[locationId]?.name} ・ {presets.timeOfDay[timeOfDay]?.name} ／ {motion}
        </p>
      </section>
    </div>
  );
}
