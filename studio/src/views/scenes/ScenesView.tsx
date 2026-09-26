import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  LocationVisualPreset,
  TimeOfDayPreset,
  TIME_OF_DAY_IDS,
  type CameraShot,
  type CharacterBook,
  type TimeOfDayId,
} from '@anime-vrm/scenario';
import type { StageCastMember } from '@anime-vrm/engine/stage/types';
import { api } from '../../api/client';
import { Icon } from '../../components/Icon';
import { SaveBar, saveErrorStatus, type SaveStatus } from '../../components/SaveBar';
import { SchemaForm, defaultValue } from '../../components/SchemaForm';
import { useI18n } from '../../i18n';
import { DirectorView } from '../../stage/DirectorView';
import { StageCanvas } from '../../stage/StageCanvas';
import type { StageManager } from '@anime-vrm/engine/stage/StageManager';
import './scenes.css';

type Tab = 'time-of-day' | 'locations';
interface PresetFile<T> {
  description?: string;
  presets: Record<string, T>;
}
type TimeFile = PresetFile<TimeOfDayPreset>;
type LocationFile = PresetFile<LocationVisualPreset>;

const SHOTS: CameraShot[] = ['wide', 'medium', 'speaker', 'close'];
const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export function ScenesView() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const params = useParams();
  const tab: Tab = params.tab === 'locations' ? 'locations' : 'time-of-day';

  const [saved, setSaved] = useState<{ time: TimeFile; locations: LocationFile } | null>(null);
  const [time, setTime] = useState<TimeFile | null>(null);
  const [locations, setLocations] = useState<LocationFile | null>(null);
  const [book, setBook] = useState<CharacterBook | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [environments, setEnvironments] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState<SaveStatus>(null);
  const [newId, setNewId] = useState<string | null>(null);

  // プレビューの条件（編集対象でない方の軸と、立たせるキャラ）
  const [previewCharacter, setPreviewCharacter] = useState('aoi');
  const [previewLocation, setPreviewLocation] = useState('school_gate');
  const [previewTime, setPreviewTime] = useState<TimeOfDayId>('day');
  const [shot, setShot] = useState<CameraShot>('speaker');
  const [castCount, setCastCount] = useState<1 | 2 | 3>(1);
  const [manager, setManager] = useState<StageManager | null>(null);

  useEffect(() => {
    Promise.all([
      api.studioData<TimeFile>('time-of-day'),
      api.studioData<LocationFile>('locations'),
      api.characters(),
      api.assets('textures'),
      api.assets('environments'),
    ])
      .then(([timeFile, locationFile, characters, textures, environmentList]) => {
        setSaved({ time: timeFile, locations: locationFile });
        setTime(structuredClone(timeFile));
        setLocations(structuredClone(locationFile));
        setBook(characters);
        setImages(textures.map((a) => a.url));
        setEnvironments(environmentList.map((a) => a.url));
      })
      .catch(() => setLoadError(true));
  }, []);

  const presets = useMemo(() => (time && locations ? { timeOfDay: time.presets, locations: locations.presets } : null), [time, locations]);
  const ids = tab === 'time-of-day' ? (TIME_OF_DAY_IDS as readonly string[]) : Object.keys(locations?.presets ?? {});
  const selectedId = params.id && ids.includes(params.id) ? params.id : ids[0];

  const dirty =
    !!saved && (JSON.stringify(saved.time) !== JSON.stringify(time) || JSON.stringify(saved.locations) !== JSON.stringify(locations));

  // プレビューに立たせるキャラ（選んだキャラと、ほかのヒロイン）
  const cast = useMemo<StageCastMember[]>(() => {
    const withModel = (book?.characters ?? []).filter((c) => c.models.some((m) => m.key === 'default'));
    const first = withModel.find((c) => c.id === previewCharacter);
    const others = withModel.filter((c) => c.id !== previewCharacter && c.role === 'heroine');
    const members = [first, ...others].filter((c) => c !== undefined).slice(0, castCount);
    const slots: Array<Array<'left' | 'center' | 'right'>> = [['center'], ['left', 'right'], ['left', 'center', 'right']];
    return members.map((c, i) => ({
      id: c.id,
      modelUrl: c.models.find((m) => m.key === 'default')!.url,
      slot: slots[members.length - 1][i],
      expression: 'neutral',
      expressionWeight: 1,
      motionLoop: true,
    }));
  }, [book, previewCharacter, castCount]);
  const colors = useMemo(() => Object.fromEntries((book?.characters ?? []).map((c) => [c.id, c.themeColor])), [book]);

  if (loadError) return <div className="scenes-message">{t.common.loadFailed}</div>;
  if (!time || !locations || !presets || !saved || !book) return null;

  const save = async () => {
    setStatus({ kind: 'saving' });
    try {
      if (JSON.stringify(saved.time) !== JSON.stringify(time)) await api.saveStudioData('time-of-day', time);
      if (JSON.stringify(saved.locations) !== JSON.stringify(locations)) await api.saveStudioData('locations', locations);
      setSaved({ time: structuredClone(time), locations: structuredClone(locations) });
      setStatus({ kind: 'saved' });
    } catch (err) {
      setStatus(saveErrorStatus(err));
    }
  };

  const revert = () => {
    setTime(structuredClone(saved.time));
    setLocations(structuredClone(saved.locations));
    setStatus(null);
  };

  const idError = !newId ? null : !ID_PATTERN.test(newId) ? t.characters.idInvalid : locations.presets[newId] ? t.characters.idTaken : null;
  const addLocation = () => {
    if (!newId || idError) return;
    const preset = { ...(defaultValue(LocationVisualPreset as never) as LocationVisualPreset), id: newId, name: newId };
    setLocations({ ...locations, presets: { ...locations.presets, [newId]: preset } });
    setNewId(null);
    navigate(`/scenes/locations/${newId}`);
  };

  const editing = tab === 'time-of-day' ? time.presets[selectedId] : locations.presets[selectedId];
  const onChange = (value: Record<string, unknown>) => {
    setStatus(null);
    if (tab === 'time-of-day') setTime({ ...time, presets: { ...time.presets, [selectedId]: value as TimeOfDayPreset } });
    else setLocations({ ...locations, presets: { ...locations.presets, [selectedId]: value as LocationVisualPreset } });
  };

  const stageTime = (tab === 'time-of-day' ? selectedId : previewTime) as TimeOfDayId;
  const stageLocation = tab === 'locations' ? selectedId : previewLocation;

  return (
    <div className="scenes">
      <header className="scenes-header">
        <div className="scenes-tabs" role="tablist">
          {(['time-of-day', 'locations'] as Tab[]).map((key) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={`scenes-tab${tab === key ? ' active' : ''}`} onClick={() => navigate(`/scenes/${key}`)}>
              {key === 'time-of-day' ? t.scenes.tabs.timeOfDay : t.scenes.tabs.locations}
            </button>
          ))}
        </div>
        <SaveBar dirty={dirty} status={status} onRevert={revert} onSave={save} />
      </header>

      <div className="scenes-body">
        <nav className="scenes-list">
          {tab === 'locations' && (
            <div className="scenes-list-new">
              {newId === null ? (
                <button type="button" className="btn" onClick={() => setNewId('')}>
                  <Icon name="plus" size={16} />
                  {t.scenes.newLocation}
                </button>
              ) : (
                <>
                  <div className="scenes-new-row">
                    <input className="input" autoFocus placeholder={t.characters.id} value={newId} onChange={(e) => setNewId(e.target.value.trim())} onKeyDown={(e) => e.key === 'Enter' && addLocation()} />
                    <button type="button" className="btn icon" title={t.common.add} disabled={!newId || !!idError} onClick={addLocation}>
                      <Icon name="plus" size={16} />
                    </button>
                    <button type="button" className="btn icon ghost" title={t.common.remove} onClick={() => setNewId(null)}>
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                  {idError && <p className="scenes-error">{idError}</p>}
                </>
              )}
            </div>
          )}
          {ids.map((id) => {
            const name = tab === 'time-of-day' ? time.presets[id]?.name : locations.presets[id]?.name;
            return (
              <button key={id} type="button" className={`scenes-item${id === selectedId ? ' active' : ''}`} onClick={() => navigate(`/scenes/${tab}/${id}`)}>
                <span className="scenes-item-name">{name}</span>
                <span className="scenes-item-id">{id}</span>
              </button>
            );
          })}
        </nav>

        <section className="scenes-form">
          {editing && (
            <SchemaForm
              key={`${tab}/${selectedId}`}
              schema={(tab === 'time-of-day' ? TimeOfDayPreset : LocationVisualPreset) as never}
              value={editing as unknown as Record<string, unknown>}
              onChange={onChange}
              images={images}
              environments={environments}
              openDepth={tab === 'locations' ? 2 : 0}
            />
          )}
        </section>

        <section className="scenes-preview">
          <div className="scenes-preview-controls">
            <label className="field">
              <span className="field-label">{t.scenes.previewCharacter}</span>
              <select className="select" value={previewCharacter} onChange={(e) => setPreviewCharacter(e.target.value)}>
                {book.characters
                  .filter((c) => c.models.length > 0)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name.ja}
                    </option>
                  ))}
              </select>
            </label>
            {tab === 'time-of-day' ? (
              <label className="field">
                <span className="field-label">{t.scenes.previewLocation}</span>
                <select className="select" value={previewLocation} onChange={(e) => setPreviewLocation(e.target.value)}>
                  {Object.values(locations.presets).map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="field">
                <span className="field-label">{t.scenes.previewTimeOfDay}</span>
                <select className="select" value={previewTime} onChange={(e) => setPreviewTime(e.target.value as TimeOfDayId)}>
                  {TIME_OF_DAY_IDS.map((id) => (
                    <option key={id} value={id}>
                      {time.presets[id]?.name ?? id}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="field">
              <span className="field-label">{t.scenes.castCount}</span>
              <div className="segmented">
                {([1, 2, 3] as const).map((n) => (
                  <button key={n} type="button" className={n === castCount ? 'active' : ''} onClick={() => setCastCount(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field-label">{t.viewer.camera}</span>
              <div className="segmented">
                {SHOTS.map((s) => (
                  <button key={s} type="button" className={s === shot ? 'active' : ''} onClick={() => setShot(s)}>
                    {t.viewer.shots[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="scenes-frame">
            <StageCanvas
              presets={presets}
              timeOfDay={stageTime}
              locationId={stageLocation}
              cast={cast}
              cameraShot={shot}
              focusId={previewCharacter}
              onManager={setManager}
            />
          </div>
          {tab === 'locations' && (
            <div className="scenes-director">
              <span className="scenes-director-label">{t.scenes.director}</span>
              <DirectorView manager={manager} location={locations.presets[selectedId]} colors={colors} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
