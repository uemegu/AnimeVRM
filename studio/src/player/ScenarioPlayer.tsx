import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  lastKeyframeAt,
  movieCutDuration,
  resolveCameraShot,
  resolveCameraSubjects,
  resolveCast,
  resolveScrollingBackground,
  ScenarioRunner,
  collectScenarioAssets,
  type ScenarioPackage,
  type ScreenAspect,
  type TextContent,
  type TimeOfDayId,
} from '@anime-vrm/scenario';
import type { StagePresets } from '@anime-vrm/engine/stage/StageManager';
import { Icon } from '../components/Icon';
import { useI18n, type Language } from '../i18n';
import { PlayerAudio } from './PlayerAudio';
import { PlayerStage } from './PlayerStage';
import type { PlayerData } from './playerData';
import './player.css';

const TYPE_SPEED = 40; // 1秒に出す文字数
const AUTO_WAIT_MS = 1200;
/** 素材の先読みを待つ上限（読み込みが止まっても「はじめる」が押せなくならないように） */
const PREWARM_TIMEOUT_MS = 90000;

/** 再生画面の文字（Web フォントは使う文字の分だけ後から読まれるので、シナリオと画面の文言の文字をまとめて先に読む） */
const PLAYER_FONTS = ['400 16px "Kiwi Maru"', '500 16px "Kiwi Maru"'];

/** シナリオに出てくる文字（重複を除く） */
function scenarioCharacters(value: unknown, chars = new Set<string>()): Set<string> {
  if (typeof value === 'string') for (const ch of value) chars.add(ch);
  else if (typeof value === 'object' && value !== null) for (const child of Object.values(value)) scenarioCharacters(child, chars);
  return chars;
}

function localize(text: TextContent | undefined, language: Language): string {
  if (text === undefined) return '';
  if (typeof text === 'string') return text;
  return (language === 'en' ? text.en : undefined) ?? text.ja;
}

interface Props {
  scenario: ScenarioPackage;
  /** ボイスの相対パスの基準（/scenarios/<category>/<id>/） */
  baseUrl: string;
  data: PlayerData;
  /** 一覧へ戻る（なければボタンを出さない） */
  onExit?: () => void;
  /** 舞台の canvas ができた・なくなったときに呼ぶ（Studio のサイドメニューの光に使う） */
  onCanvas?: (canvas: HTMLCanvasElement | null) => void;
}

type Phase = 'title' | 'playing' | 'ended';

/**
 * シナリオの再生（分岐・ボイス・BGM・演出つき）。Studio の再生画面と Pages で使う
 */
export function ScenarioPlayer({ scenario, baseUrl, data, onExit, onCanvas }: Props) {
  const { t, language, setLanguage } = useI18n();
  const tp = t.player;
  const runnerRef = useRef<ScenarioRunner>(new ScenarioRunner(scenario));
  const audioRef = useRef<PlayerAudio | null>(null);
  audioRef.current ??= new PlayerAudio();
  const [phase, setPhase] = useState<Phase>('title');
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState(0);
  const [voiceDone, setVoiceDone] = useState(true);
  const [auto, setAuto] = useState(false);
  const [muted, setMuted] = useState(audioRef.current.muted);
  const [flash, setFlash] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  /** 画面の向き（シナリオの指定から始め、ヘッダーで切り替えられる） */
  const [aspect, setAspect] = useState<ScreenAspect>(scenario.aspect ?? 'landscape');
  /** 先読みを済ませたキャラの一覧（今のシナリオの一覧と同じになるまで「はじめる」を押せない） */
  const [prewarmedKey, setPrewarmedKey] = useState<string | null>(null);
  /** 今のカットに入った時刻（ムービーの尺の計算に使う） */
  const cutStartRef = useRef(0);

  const runner = runnerRef.current;
  const audio = audioRef.current;
  const scene = runner.scene;
  const stage = runner.stage;
  const text = localize(scene.text, language);
  const speakerName = localize(scene.speaker, language);
  const speakerColor = data.characters.characters.find((c) => c.id === scene.speakerCharacterId)?.themeColor;
  const choices = runner.choices;
  const textDone = typed >= text.length;
  // ムービー：メッセージウィンドウを出さず、カットが自動で進む
  const movie = scenario.playMode === 'movie';

  useEffect(() => () => audio.dispose(), [audio]);

  // シナリオが変わったら最初から
  useEffect(() => {
    runnerRef.current = new ScenarioRunner(scenario);
    audio.stopVoice();
    setPhase('title');
    setStep((s) => s + 1);
    setAspect(scenario.aspect ?? 'landscape');
  }, [scenario, audio]);

  // このシナリオが使う素材を、はじめる前にすべて読み込む（キャラは描画の準備まで）
  const prewarm = useMemo(
    () => collectScenarioAssets(scenario, { locations: data.locations, bgm: data.bgm, motions: data.motions, characters: data.characters.characters }, baseUrl),
    [scenario, data, baseUrl]
  );
  const prewarmKey = JSON.stringify(prewarm);
  const fontText = useMemo(() => [...scenarioCharacters([scenario, tp])].join(''), [scenario, tp]);
  const [fontsLoaded, setFontsLoaded] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    // 見えない所に一度描いて読ませる（Safari は fonts.load だけでは読まない文字がある）
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
    for (const font of PLAYER_FONTS) {
      const line = document.createElement('span');
      line.style.font = font;
      line.textContent = fontText;
      probe.appendChild(line);
    }
    document.body.appendChild(probe);
    void Promise.all(PLAYER_FONTS.map((font) => document.fonts?.load(font, fontText)))
      .then(() => document.fonts?.ready)
      .catch(() => undefined)
      .finally(() => {
        probe.remove();
        if (!cancelled) setFontsLoaded(fontText);
      });
    return () => {
      cancelled = true;
      probe.remove();
    };
  }, [fontText]);
  const prewarmed = prewarmedKey === prewarmKey && fontsLoaded === fontText;
  useEffect(() => {
    const timer = window.setTimeout(() => setPrewarmedKey(prewarmKey), PREWARM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [prewarmKey]);

  const presets = useMemo<StagePresets>(() => ({ timeOfDay: data.timeOfDay, locations: data.locations, motions: data.motions }), [data]);
  const cast = useMemo(
    () =>
      resolveCast(stage, {
        modelUrlFor: (id) => data.characters.characters.find((c) => c.id === id)?.models[0]?.url,
        isLoopingMotion: (motion) => !!data.motions[motion]?.loop,
        spriteFor: (characterId, key) => data.characters.characters.find((c) => c.id === characterId)?.sprites?.find((s) => s.key === key),
        tearDropsFor: (characterId) => data.characters.characters.find((c) => c.id === characterId)?.tearDrops ?? true,
      }),
    [stage, data]
  );
  // 「はじめる」を押すまでは1カット目のモーションを始めない
  const stageCast = useMemo(
    () => (phase === 'title' ? cast.map(({ motion: _motion, motionCue: _cue, ...rest }) => rest) : cast),
    [cast, phase]
  );
  const locationId = stage.background ?? scenario.location ?? 'classroom';
  const timeOfDay = (stage.timeOfDay ?? 'day') as TimeOfDayId;
  const shot = resolveCameraShot(scene, cast, stage);
  const { focusId, overId } = resolveCameraSubjects(scene);
  const scrolling = resolveScrollingBackground(stage, data.locations[locationId]?.layers.background.url);

  // カットが変わったときだけ作り直す（文字送りの再描画のたびに舞台がカットを始め直さないように）
  const cut = useMemo(
    () => (phase === 'playing' ? { ...scene, screenTransition: stage.screenTransition } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, step, scene, stage.screenTransition]
  );

  /** '/' で始まらないファイルはシナリオのディレクトリから */
  const resolveSceneUrl = (url: string) => (url.startsWith('/') ? url : `${baseUrl}${url}`);

  // シーンに入ったとき：音と文字送りを始める
  useEffect(() => {
    if (phase !== 'playing') return;
    const bgm = stage.bgm && stage.bgm !== 'silence' ? (data.bgm[stage.bgm] ?? { url: stage.bgm, volumeScale: 1 }) : null;
    audio.playBgm(bgm?.url ?? null, { volume: (bgm?.volumeScale ?? 1) * (stage.bgmVolume ?? 1), pan: stage.bgmPan });
    audio.playAmbience(stage.ambience ?? null);
    if (scene.seUrl) audio.playSe(resolveSceneUrl(scene.seUrl), { volume: scene.seVolume, pan: scene.sePan });
    const voice = scene.voiceUrl ? resolveSceneUrl(scene.voiceUrl) : null;
    setVoiceDone(!voice);
    audio.playVoice(voice, () => setVoiceDone(true), { volume: scene.voiceVolume, pan: scene.voicePan });
    setTyped(0);
    cutStartRef.current = performance.now();
    if (scene.flashEffect === 'white') setFlash((f) => f + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step]);

  // 文字送り
  useEffect(() => {
    if (phase !== 'playing' || textDone) return;
    const timer = window.setTimeout(() => setTyped((n) => n + 1), 1000 / TYPE_SPEED);
    return () => window.clearTimeout(timer);
  }, [phase, typed, textDone]);

  const advance = useCallback(() => {
    if (phase === 'title') {
      if (!prewarmed) return;
      setPhase('playing');
      return;
    }
    if (phase !== 'playing') return;
    if (!textDone) {
      setTyped(text.length);
      return;
    }
    if (runner.choices.length > 0) return;
    if (runner.next()) {
      audio.stopVoice();
      setPhase('ended');
      return;
    }
    setStep((s) => s + 1);
  }, [phase, prewarmed, textDone, text.length, runner, audio]);

  const choose = (index: number) => {
    if (runner.choose(index)) {
      audio.stopVoice();
      setPhase('ended');
      return;
    }
    setStep((s) => s + 1);
  };

  // ムービー：ボイスが終わったら、カットの尺の残りを待って進める（選択肢は時間切れと同じ扱い）
  useEffect(() => {
    if (!movie || phase !== 'playing') return;
    if (scene.duration === undefined && !voiceDone) return;
    const elapsed = (performance.now() - cutStartRef.current) / 1000;
    const voiceSec = scene.voiceUrl ? elapsed : 0;
    const wait = Math.max(0, movieCutDuration(scene, voiceSec) - elapsed);
    const timer = window.setTimeout(() => {
      const done = runner.choices.length > 0 ? runner.timeout() : runner.next();
      if (done) {
        audio.stopVoice();
        setPhase('ended');
        return;
      }
      setStep((s) => s + 1);
    }, wait * 1000);
    return () => window.clearTimeout(timer);
  }, [movie, phase, step, voiceDone, scene, runner, audio]);

  // オート：文字とボイスが終わり、キーとカメラの動きも終わったら少し待って進める
  useEffect(() => {
    if (movie) return;
    if (!auto || phase !== 'playing' || !textDone || !voiceDone || choices.length > 0) return;
    const elapsed = (performance.now() - cutStartRef.current) / 1000;
    const remaining = Math.max(0, lastKeyframeAt(scene) - elapsed);
    const wait = remaining * 1000 + (scene.autoNextSec !== undefined ? scene.autoNextSec * 1000 : AUTO_WAIT_MS);
    const timer = window.setTimeout(advance, wait);
    return () => window.clearTimeout(timer);
  }, [movie, auto, phase, textDone, voiceDone, choices.length, scene, advance]);

  // 選択肢の制限時間（指定があるときだけ）
  useEffect(() => {
    const seconds = scene.choiceTimeout?.seconds;
    if (movie || phase !== 'playing' || !seconds || choices.length === 0) {
      setRemaining(null);
      return;
    }
    const startedAt = performance.now();
    setRemaining(seconds);
    const timer = window.setInterval(() => {
      const left = seconds - (performance.now() - startedAt) / 1000;
      if (left > 0) {
        setRemaining(left);
        return;
      }
      window.clearInterval(timer);
      if (runner.timeout()) setPhase('ended');
      else setStep((s) => s + 1);
    }, 100);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step]);

  // キーボード（スペース・Enter で送る）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      // ムービーは再生中に送らない（はじめる・もう一度はボタンで押す）
      if (movie && phase !== 'title') return;
      if ((e.target as HTMLElement | null)?.closest('button, input, textarea, select')) return;
      e.preventDefault();
      advance();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, movie, phase]);

  const restart = () => {
    runnerRef.current = new ScenarioRunner(scenario);
    setPhase('playing');
    setStep((s) => s + 1);
  };

  const toggleMute = () => {
    audio.setMuted(!muted);
    setMuted(!muted);
  };

  return (
    <div className={`player${movie ? ' movie' : ''}${movie && phase === 'playing' ? ' movie-playing' : ''}${aspect === 'portrait' ? ' portrait' : ''}`}>
      <PlayerStage
        presets={presets}
        timeOfDay={timeOfDay}
        locationId={locationId}
        cast={stageCast}
        cameraShot={shot}
        speakerId={scene.speakerCharacterId ?? null}
        focusId={focusId}
        overId={overId}
        scrolling={scrolling}
        effects={stage.effects}
        cg={stage.cg && { ...stage.cg, url: resolveSceneUrl(stage.cg.url) }}
        cutin={stage.cutin && { ...stage.cutin, url: resolveSceneUrl(stage.cutin.url) }}
        rain={stage.rain}
        cut={cut}
        language={language}
        getCutTime={() => audio.getVoiceTime()}
        getSpeakerPhoneme={() => audio.getPhoneme()}
        getSpeakerMouthOpen={() => audio.getMouthOpen()}
        onCanvas={onCanvas}
        prewarm={prewarm}
        onPrewarmed={setPrewarmedKey}
      />
      {flash > 0 && <div key={flash} className="player-flash" />}

      <header className="player-header">
        {onExit && (
          <button type="button" className="player-button" title={tp.back} onClick={onExit}>
            <Icon name="back" size={14} />
            <span className="player-button-label">{tp.back}</span>
          </button>
        )}
        <span className="player-title">{localize(scenario.title, language)}</span>
        <span className="player-spacer" />
        {!movie && (
          <button type="button" className={`player-button${auto ? ' active' : ''}`} aria-pressed={auto} title={tp.auto} onClick={() => setAuto(!auto)}>
            <Icon name="play" size={14} />
            <span className="player-button-label">{tp.auto}</span>
          </button>
        )}
        <button type="button" className="player-button" title={aspect === 'portrait' ? tp.landscape : tp.portrait} onClick={() => setAspect(aspect === 'portrait' ? 'landscape' : 'portrait')}>
          <Icon name={aspect === 'portrait' ? 'landscape' : 'portrait'} size={14} />
          <span className="player-button-label">{aspect === 'portrait' ? tp.landscape : tp.portrait}</span>
        </button>
        <button type="button" className={`player-button${muted ? ' active' : ''}`} aria-pressed={muted} title={muted ? tp.muted : tp.sound} onClick={toggleMute}>
          <Icon name={muted ? 'soundOff' : 'soundOn'} size={14} />
          <span className="player-button-label">{muted ? tp.muted : tp.sound}</span>
        </button>
        <button type="button" className="player-button" onClick={() => setLanguage(language === 'ja' ? 'en' : 'ja')}>
          {language === 'ja' ? 'EN' : 'JA'}
        </button>
      </header>

      {phase === 'title' && (
        <button type="button" className="player-cover" onClick={advance} aria-busy={!prewarmed}>
          <span className="player-cover-title">{localize(scenario.title, language)}</span>
          {scenario.description && <span className="player-cover-desc">{localize(scenario.description, language)}</span>}
          <span className={`player-cover-start${prewarmed ? '' : ' preparing'}`}>
            {prewarmed && <Icon name="play" size={16} />}
            {prewarmed ? tp.start : tp.preparing}
          </span>
        </button>
      )}

      {!movie && phase === 'playing' && choices.length > 0 && (
        <div className="player-choices">
          {remaining !== null && <div className="player-timer" style={{ width: `${(remaining / (scene.choiceTimeout?.seconds ?? 1)) * 100}%` }} />}
          {choices.map((choice, i) => (
            <button key={i} type="button" className="player-choice" onClick={() => choose(i)}>
              {localize(choice.text, language)}
            </button>
          ))}
        </div>
      )}

      {!movie && phase === 'playing' && text && (
        <div
          className="player-message"
          style={speakerColor ? ({ '--speaker-color': speakerColor } as CSSProperties) : undefined}
          onClick={advance}
          role="button"
          tabIndex={-1}
        >
          <div className="player-message-inner">
            {speakerName && <div className="player-speaker">{speakerName}</div>}
            <p className="player-text">{text.slice(0, typed)}</p>
            {textDone && choices.length === 0 && <span className="player-next" aria-hidden="true" />}
          </div>
        </div>
      )}
      {!movie && phase === 'playing' && choices.length === 0 && <div className="player-click" onClick={advance} />}

      {phase === 'ended' && (
        <div className="player-cover ended">
          <span className="player-cover-title">{tp.end}</span>
          <span className="player-end-actions">
            <button type="button" className="player-button large" onClick={restart}>
              {tp.replay}
            </button>
            {onExit && (
              <button type="button" className="player-button large" onClick={onExit}>
                {tp.backToList}
              </button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
