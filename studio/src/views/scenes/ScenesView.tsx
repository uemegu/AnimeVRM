import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  LocationVisualPreset,
  TimeOfDayPreset,
  TIME_OF_DAY_IDS,
  DEFAULT_SHOT_RIGS,
  type CameraShot,
  type ShotRig,
  type CharacterBook,
  type TimeOfDayId,
} from '@anime-vrm/scenario';
import type { StageCastMember } from '@anime-vrm/engine/stage/types';
import { api } from '../../api/client';
import { Icon } from '../../components/Icon';
import { SaveBar, saveErrorStatus, type SaveStatus } from '../../components/SaveBar';
import { SchemaForm, defaultValue } from '../../components/SchemaForm';
import { format, useI18n } from '../../i18n';
import { DirectorView } from '../../stage/DirectorView';
import { StageCanvas } from '../../stage/StageCanvas';
import { CameraAdjust } from '../../stage/CameraAdjust';
import type { StageManager } from '@anime-vrm/engine/stage/StageManager';
import { useBackdrop } from '../../components/Backdrop';
import './scenes.css';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';

type Tab = 'time-of-day' | 'locations';
interface PresetFile<T> {
  description?: string;
  presets: Record<string, T>;
}
type TimeFile = PresetFile<TimeOfDayPreset>;
type LocationFile = PresetFile<LocationVisualPreset>;

const SHOTS: CameraShot[] = ['wide', 'medium', 'speaker', 'close', 'side'];
const ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
/** 構図の値をフォームの範囲に収める（scene.ts の shotRig と同じ範囲） */
const clampRig = (rig: ShotRig): ShotRig => ({
  distance: clamp(rig.distance, 0.6, 6),
  height: clamp(rig.height, -1.2, 1),
  targetHeight: clamp(rig.targetHeight, -1.2, 1),
});

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
  // プレビュー上で構図を調整する（場所タブのみ）
  const [adjusting, setAdjusting] = useState(false);
  const [liveRig, setLiveRig] = useState<ShotRig | null>(null);
  const [viewResetKey, setViewResetKey] = useState(0);
  useEffect(() => {
    setLiveRig(null);
    setViewResetKey((k) => k + 1);
  }, [tab, params.id]);

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
  // 画面の背面には、プレビュー中の場所の遠景を敷く
  useBackdrop(locations?.presets[tab === 'locations' ? selectedId : previewLocation]?.layers.background.url);
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

  // 構図・場所・人数を変えたら、調整中のカメラをその構図の位置へ戻す
  const resetView = () => {
    setLiveRig(null);
    setViewResetKey((k) => k + 1);
  };
  const editingLocation = tab === 'locations' ? locations.presets[selectedId] : undefined;
  const storedRig: ShotRig = { ...DEFAULT_SHOT_RIGS[shot], ...editingLocation?.stage?.camera?.[shot] };
  const shownRig = liveRig ?? storedRig;
  const writeRig = (target: CameraShot, rig: ShotRig | undefined) => {
    if (!editingLocation) return;
    const { [target]: _old, ...otherShots } = editingLocation.stage?.camera ?? {};
    const camera = rig ? { ...otherShots, [target]: clampRig(rig) } : otherShots;
    onChange({ ...editingLocation, stage: { ...editingLocation.stage, camera } } as unknown as Record<string, unknown>);
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
            const isLocation = tab === 'locations';
            const name = isLocation ? locations.presets[id]?.name : time.presets[id]?.name;
            const loc = isLocation ? locations.presets[id] : undefined;
            const bgUrl = loc?.thumbnail ?? loc?.layers?.background?.url;
            return (
              <button
                key={id}
                type="button"
                className={`scenes-item${id === selectedId ? ' active' : ''}${isLocation ? ' has-thumb' : ''}`}
                onClick={() => navigate(`/scenes/${tab}/${id}`)}
              >
                <div className="scenes-item-text">
                  <span className="scenes-item-name">{name}</span>
                  <span className="scenes-item-id">{id}</span>
                </div>
                {isLocation && (
                  <div className="scenes-item-thumb">
                    {bgUrl ? (
                      <img src={resolveAssetUrl(bgUrl)} alt="" loading="lazy" />
                    ) : (
                      <div className="scenes-item-thumb-fallback" />
                    )}
                    <div className="scenes-item-thumb-fade" />
                  </div>
                )}
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
              <div className="field wide">
                <span className="field-label">{t.scenes.previewTimeOfDay}</span>
                <div className="segmented six">
                  {TIME_OF_DAY_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={id === previewTime ? 'active' : ''}
                      onClick={() => setPreviewTime(id as TimeOfDayId)}
                    >
                      {time.presets[id]?.name ?? id}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="field">
              <span className="field-label">{t.scenes.castCount}</span>
              <div className="segmented">
                {([1, 2, 3] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={n === castCount ? 'active' : ''}
                    onClick={() => {
                      setCastCount(n);
                      resetView();
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="field wide">
              <span className="field-label">{t.viewer.camera}</span>
              <div className="segmented">
                {SHOTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={s === shot ? 'active' : ''}
                    onClick={() => {
                      setShot(s);
                      resetView();
                    }}
                  >
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
              freeCamera={tab === 'locations' && adjusting}
              shotRigMode
              viewResetKey={viewResetKey}
              onShotRig={(target, rig, done) => {
                if (target !== shot) return;
                setLiveRig(done ? null : rig);
                if (!done) return;
                writeRig(target, rig);
                // フォームの範囲で切った値と見た目がずれないよう、保存した構図の位置へ合わせ直す
                setViewResetKey((k) => k + 1);
              }}
            />
            {tab === 'locations' && (
              <CameraAdjust
                active={adjusting}
                onToggle={(active) => {
                  setAdjusting(active);
                  setLiveRig(null);
                }}
                hint={format(t.cameraAdjust.rigHint, { shot: t.viewer.shots[shot] })}
                readout={[
                  [t.cameraAdjust.distance, shownRig.distance.toFixed(2)],
                  [t.cameraAdjust.height, shownRig.height.toFixed(2)],
                  [t.cameraAdjust.targetHeight, shownRig.targetHeight.toFixed(2)],
                ]}
              >
                <button
                  type="button"
                  className="btn"
                  disabled={!editingLocation?.stage?.camera?.[shot]}
                  onClick={() => {
                    writeRig(shot, undefined);
                    resetView();
                  }}
                >
                  {t.cameraAdjust.resetRig}
                </button>
              </CameraAdjust>
            )}
          </div>
          {tab === 'locations' && (
            <div className="scenes-director">
              <span className="scenes-director-label">{t.scenes.director}</span>
              <DirectorView manager={manager} location={locations.presets[selectedId]} colors={colors} />
            </div>
          )}
          {tab === 'time-of-day' && (
            <div className="scenes-locations-panel">
              <div className="scenes-locations-grid">
                {Object.values(locations.presets).map((loc) => {
                  const bgUrl = loc.thumbnail ?? loc.layers?.background?.url;
                  const isActive = loc.id === previewLocation;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      className={`viewer-location-thumb${isActive ? ' active' : ''}`}
                      title={loc.name}
                      onClick={() => setPreviewLocation(loc.id)}
                    >
                      {bgUrl ? (
                        <img src={resolveAssetUrl(bgUrl)} alt={loc.name} loading="lazy" />
                      ) : (
                        <div className="viewer-location-thumb-fallback">{loc.name}</div>
                      )}
                      <span className="viewer-location-thumb-name">{loc.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
