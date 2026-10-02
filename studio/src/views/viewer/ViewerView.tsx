import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_AVATAR_LOOK, EffectTextPreset, SweatMode, type CameraShift, type CameraShot, type CharacterBook } from '@anime-vrm/scenario';
import type { StageCastMember } from '@anime-vrm/engine/stage/types';
import type { TimeOfDayId } from '@anime-vrm/engine/stage/visual';
import { WHISPER_MOUTH_SCALE, type StageManager } from '@anime-vrm/engine/stage/StageManager';
import { api, type AssetEntry } from '../../api/client';
import { useI18n } from '../../i18n';
import { StageCanvas } from '../../stage/StageCanvas';
import { useStagePresets } from '../../stage/useStagePresets';
import { PlayerAudio } from '../../player/PlayerAudio';
import { VoiceLibrary } from './VoiceLibrary';
import { BgmLibrary } from './BgmLibrary';
import { SeLibrary } from './SeLibrary';
import { useBackdrop } from '../../components/Backdrop';
import { ShiftPicker } from '../../components/ShiftPicker';
import './viewer.css';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';

const TIMES: TimeOfDayId[] = ['morning', 'day', 'evening', 'night', 'indoor_dark', 'divine'];
const SHOTS: CameraShot[] = ['wide', 'medium', 'speaker', 'close', 'side'];
const EXPRESSIONS = ['neutral', 'happy', 'relaxed', 'sad', 'angry', 'surprised', 'nima'] as const;
const FACE_EFFECTS = ['blush', 'anger', 'tears', 'faceSweat'] as const;
type FaceEffect = (typeof FACE_EFFECTS)[number];
const TABS = ['expression', 'motion', 'voice', 'sound'] as const;
const SOUND_KINDS = ['bgm', 'se'] as const;
type Tab = (typeof TABS)[number];
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
  const [models, setModels] = useState<AssetEntry[]>([]);
  const [voices, setVoices] = useState<AssetEntry[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [characterId, setCharacterId] = useState('aoi');
  const [modelKey, setModelKey] = useState('default');
  const [locationId, setLocationId] = useState('school_gate');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDayId>('day');
  const [shot, setShot] = useState<CameraShot>('speaker');
  const [shift, setShift] = useState<CameraShift | null>(null);
  const [expression, setExpression] = useState<string>('neutral');
  const [faceEffects, setFaceEffects] = useState<Record<FaceEffect, boolean>>({ blush: false, anger: false, tears: false, faceSweat: false });
  const [motion, setMotion] = useState(IDLE);
  const [motionLoop, setMotionLoop] = useState(true);
  const [motionCue, setMotionCue] = useState(0);
  const [motionFilter, setMotionFilter] = useState('');
  const [tab, setTab] = useState<Tab>('expression');

  // 汗・文字演出は1回きりなので、押したときに直接出す
  const managerRef = useRef<StageManager | null>(null);
  const onManager = useCallback((manager: StageManager | null) => {
    managerRef.current = manager;
  }, []);

  useEffect(() => {
    Promise.all([api.characters(), api.assets('animations'), api.assets('models'), api.assets('voices')])
      .then(([characters, animationList, modelList, voiceList]) => {
        setBook(characters);
        setMotions(animationList);
        setModels(modelList);
        setVoices(voiceList);
      })
      .catch(() => setLoadError(true));
  }, []);

  // ボイスの試聴（再生中は表示中のキャラが口を動かす）
  const audioRef = useRef<PlayerAudio | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const audio = new PlayerAudio();
    audioRef.current = audio;
    setMuted(audio.muted);
    return () => {
      audio.dispose();
      audioRef.current = null;
    };
  }, []);
  const toggleVoice = (url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingVoice === url) {
      audio.stopVoice();
      setPlayingVoice(null);
      return;
    }
    setPlayingVoice(url);
    audio.playVoice(url, () => setPlayingVoice((current) => (current === url ? null : current)));
  };
  // サウンド（BGM・効果音）の試聴。ボイスと重ねて鳴らせる
  const [soundKind, setSoundKind] = useState<(typeof SOUND_KINDS)[number]>('bgm');
  const [playingBgm, setPlayingBgm] = useState<string | null>(null);
  const toggleBgm = (url: string, volumeScale: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = playingBgm === url ? null : url;
    audio.playBgm(next, { volume: volumeScale });
    setPlayingBgm(next);
  };
  const changeBgmVolume = (url: string, volumeScale: number) => {
    if (playingBgm === url) audioRef.current?.setBgmMix({ volume: volumeScale });
  };
  const seRef = useRef<HTMLAudioElement | null>(null);
  const [playingSe, setPlayingSe] = useState<string | null>(null);
  const toggleSe = (url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    seRef.current?.pause();
    seRef.current = null;
    if (playingSe === url) {
      setPlayingSe(null);
      return;
    }
    const element = audio.playSe(url);
    element.addEventListener('ended', () => setPlayingSe((current) => (current === url ? null : current)));
    seRef.current = element;
    setPlayingSe(url);
  };
  const soundSwitch = (
    <div className="segmented viewer-sound-switch" role="tablist">
      {SOUND_KINDS.map((kind) => (
        <button key={kind} type="button" role="tab" aria-selected={soundKind === kind} className={soundKind === kind ? 'active' : ''} onClick={() => setSoundKind(kind)}>
          {t.viewer.soundKinds[kind]}
        </button>
      ))}
    </div>
  );
  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.setMuted(!audio.muted);
    setMuted(audio.muted);
  };
  const getPhoneme = useCallback(() => audioRef.current?.getPhoneme(), []);

  // 囁き声として試聴するか（口を小さく開く）。試聴用なので保存しない。シナリオではセリフの voiceWhisper で指定する
  const [whisper, setWhisper] = useState(false);
  const mouthScale = playingVoice && whisper ? WHISPER_MOUTH_SCALE : 1;

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
              slot: 'center',
              expression,
              expressionWeight: 1.0,
              motion,
              motionLoop,
              motionCue: String(motionCue),
              look: { ...DEFAULT_AVATAR_LOOK, ...faceEffects },
            },
          ]
        : [],
    [characterId, model, expression, motion, motionLoop, motionCue, faceEffects]
  );

  useBackdrop(presets?.locations[locationId]?.layers?.background?.url);

  const filteredMotions = motions.filter((m) => motionName(m.url).toLowerCase().includes(motionFilter.toLowerCase()));

  if (error || loadError) return <div className="viewer-message">{t.common.loadFailed}</div>;
  if (!presets || !book) return null;

  const playMotion = (name: string) => {
    setMotion(name);
    setMotionCue((n) => n + 1);
  };

  const currentBgUrl = presets.locations[locationId]?.layers?.background?.url;

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
              {characters.map((c) => {
                const defaultModel = c.models.find((m) => m.key === 'default') ?? c.models[0];
                const thumbUrl = models.find((entry) => entry.url === defaultModel?.url)?.thumbnailUrl;
                const isActive = c.id === characterId;

                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`viewer-character-thumb${isActive ? ' active' : ''}`}
                    title={c.name.ja}
                    onClick={() => {
                      setCharacterId(c.id);
                      setModelKey('default');
                    }}
                  >
                    {thumbUrl ? (
                      <img src={resolveAssetUrl(thumbUrl)} alt={c.name.ja} loading="lazy" />
                    ) : (
                      <div className="viewer-character-thumb-fallback">{c.name.ja}</div>
                    )}
                    <span className="viewer-character-thumb-theme" style={{ background: c.themeColor }} />
                    <span className="viewer-character-thumb-name">{c.name.ja}</span>
                  </button>
                );
              })}
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

          <div className="viewer-tabs" role="tablist">
            {TABS.map((key) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={`viewer-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
                {t.viewer.tabs[key]}
              </button>
            ))}
          </div>

          {tab === 'expression' && (
            <>
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

              <section className="viewer-section">
                <h2>{t.viewer.faceEffects}</h2>
                <div className="viewer-chip-grid">
                  {FACE_EFFECTS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`viewer-chip${faceEffects[key] ? ' active' : ''}`}
                      aria-pressed={faceEffects[key]}
                      onClick={() => setFaceEffects((current) => ({ ...current, [key]: !current[key] }))}
                    >
                      {key === 'faceSweat' ? t.viewer.faceSweat : t.scenarios.effects[key]}
                    </button>
                  ))}
                </div>
              </section>

              <section className="viewer-section">
                <h2>{t.viewer.sweat}</h2>
                <div className="viewer-chip-grid">
                  {SweatMode.options.map((mode) => (
                    <button key={mode} type="button" className="viewer-chip" onClick={() => managerRef.current?.showOneShot(characterId, { sweat: mode })}>
                      {t.scenarios.effects.sweatModes[mode]}
                    </button>
                  ))}
                </div>
              </section>

              <section className="viewer-section">
                <h2>{t.viewer.effectText}</h2>
                <div className="viewer-chip-grid">
                  {EffectTextPreset.options.map((preset) => (
                    <button key={preset} type="button" className="viewer-chip" onClick={() => managerRef.current?.showOneShot(characterId, { effectText: preset })}>
                      {t.scenarios.effects.presets[preset]}
                    </button>
                  ))}
                  <button type="button" className="viewer-chip" onClick={() => managerRef.current?.clearEffectText(characterId)}>
                    {t.viewer.effectTextOff}
                  </button>
                </div>
              </section>
            </>
          )}

          {tab === 'motion' && (
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
          )}

          {tab === 'voice' && (
            <VoiceLibrary
              voices={voices}
              playingUrl={playingVoice}
              whisper={whisper}
              onToggleWhisper={() => setWhisper((current) => !current)}
              muted={muted}
              onToggle={toggleVoice}
              onToggleMute={toggleMute}
              onUploaded={() => api.assets('voices').then(setVoices, () => {})}
            />
          )}

          {tab === 'sound' && soundKind === 'bgm' && (
            <BgmLibrary heading={soundSwitch} playingUrl={playingBgm} muted={muted} onToggle={toggleBgm} onVolume={changeBgmVolume} onToggleMute={toggleMute} />
          )}
          {tab === 'sound' && soundKind === 'se' && <SeLibrary heading={soundSwitch} playingUrl={playingSe} muted={muted} onToggle={toggleSe} onToggleMute={toggleMute} />}
        </div>
      </aside>

      <section
        className="viewer-stage"
        style={currentBgUrl ? ({ '--stage-bg-url': `url("${resolveAssetUrl(currentBgUrl)}")` } as React.CSSProperties) : undefined}
      >
        <div className="viewer-stage-top">
          <div className="segmented five">
            {TIMES.map((time) => (
              <button key={time} type="button" className={time === timeOfDay ? 'active' : ''} onClick={() => setTimeOfDay(time)}>
                {presets.timeOfDay[time]?.name ?? time}
              </button>
            ))}
          </div>
          <div className="segmented five">
            {SHOTS.map((s) => (
              <button key={s} type="button" className={s === shot ? 'active' : ''} onClick={() => setShot(s)}>
                {t.viewer.shots[s]}
              </button>
            ))}
          </div>
          <ShiftPicker value={shift} onChange={setShift} />
          <select className="select viewer-location-select" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {Object.values(presets.locations).map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="viewer-frame">
          <StageCanvas presets={presets} timeOfDay={timeOfDay} locationId={locationId} cast={cast} cameraShot={shot} cameraShift={shift} focusId={characterId} getSpeakerPhoneme={getPhoneme} mouthScale={mouthScale} onManager={onManager} />
        </div>

        <p className="viewer-caption">
          {character?.name.ja} ・ {model?.label.ja} ／ {presets.locations[locationId]?.name} ・ {presets.timeOfDay[timeOfDay]?.name} ／ {motion}
        </p>

        <div className="viewer-stage-bottom">
          <div className="viewer-location-grid">
            {Object.values(presets.locations).map((loc) => {
              const bgUrl = loc.thumbnail ?? loc.layers?.background?.url;
              const isActive = loc.id === locationId;
              return (
                <button
                  key={loc.id}
                  type="button"
                  className={`viewer-location-thumb${isActive ? ' active' : ''}`}
                  title={loc.name}
                  onClick={() => setLocationId(loc.id)}
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
      </section>
    </div>
  );
}
