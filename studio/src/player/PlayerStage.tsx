import { useEffect, useRef } from 'react';
import type { ScenarioAssets, CameraShot, CutinConfig, ScenarioScene, SceneEffects, StillImageConfig, ScrollingBackgroundSettings, StageCastMember, TimeOfDayId } from '@anime-vrm/scenario';
import { cutTimeline } from '@anime-vrm/scenario';
import { StageManager, type StagePresets } from '@anime-vrm/engine/stage/StageManager';
import { useRenderQuality } from '../stage/renderQuality';
import { StageLoading, useCastLoading } from '../stage/StageLoading';

interface Props {
  presets: StagePresets;
  timeOfDay: TimeOfDayId;
  locationId: string;
  cast: StageCastMember[];
  cameraShot: CameraShot;
  speakerId: string | null;
  /** 寄る相手（省略で話者）と、肩越し（ots）の手前の人 */
  focusId?: string | null;
  overId?: string | null;
  scrolling: ScrollingBackgroundSettings | null;
  /** シーンの特殊効果（花火など） */
  effects?: SceneEffects;
  /** 画面いっぱいの一枚絵と、端のカットイン */
  cg?: StillImageConfig | null;
  cutin?: CutinConfig | null;
  /** 雨 */
  rain?: boolean;
  /** 今のカット（カメラの直接指定・タイムライン・画面演出） */
  cut: ScenarioScene | null;
  language: 'ja' | 'en';
  /** カット内の時刻（ボイスの再生位置。なければカット開始からの秒数を使う） */
  getCutTime: () => number | undefined;
  getSpeakerPhoneme: () => string | undefined;
  getSpeakerMouthOpen: () => number;
  onCanvas?: (canvas: HTMLCanvasElement | null) => void;
  /** シナリオが使う素材。はじめる前にまとめて読み込み、キャラは描画の準備まで済ませる（途中で読み込み待ちにならないように） */
  prewarm?: ScenarioAssets | null;
  /** prewarm を済ませた（済ませた一覧の JSON を渡す） */
  onPrewarmed?: (prewarmKey: string) => void;
}

/**
 * 再生画面の舞台。カットが変わるたびにタイムラインを渡し、時刻はボイスに合わせて描画側が進める
 */
export function PlayerStage({ presets, timeOfDay, locationId, cast, cameraShot, speakerId, focusId = speakerId, overId = null, scrolling, effects, cg = null, cutin = null, rain = false, cut, language, getCutTime, getSpeakerPhoneme, getSpeakerMouthOpen, onCanvas, prewarm = null, onPrewarmed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<StageManager | null>(null);
  const { loading, run: runSetCast } = useCastLoading(managerRef);
  const timeRef = useRef(getCutTime);
  const phonemeRef = useRef(getSpeakerPhoneme);
  const mouthOpenRef = useRef(getSpeakerMouthOpen);
  // 描画の品質（設定）。描画が間に合わないと知らされたら、設定側で軽量に下げる
  const renderQuality = useRenderQuality();
  const slowFramesRef = useRef(renderQuality.onSlowFrames);
  slowFramesRef.current = renderQuality.onSlowFrames;
  timeRef.current = getCutTime;
  phonemeRef.current = getSpeakerPhoneme;
  mouthOpenRef.current = getSpeakerMouthOpen;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const manager = new StageManager({
      canvas,
      presets,
      initialTimeOfDay: timeOfDay,
      initialLocationId: locationId,
      language,
      quality: renderQuality.level,
      onSlowFrames: renderQuality.level ? () => slowFramesRef.current() : undefined,
      getCutTime: () => timeRef.current(),
      getSpeakerPhoneme: () => phonemeRef.current(),
      getSpeakerMouthOpen: () => mouthOpenRef.current(),
    });
    managerRef.current = manager;
    const observer = new ResizeObserver(([entry]) => manager.resize(entry.contentRect.width, entry.contentRect.height));
    observer.observe(canvas.parentElement ?? canvas);
    onCanvas?.(canvas);
    return () => {
      onCanvas?.(null);
      observer.disconnect();
      manager.dispose();
      managerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const qualityLevel = renderQuality.level;
  const appliedQuality = useRef(qualityLevel);
  useEffect(() => {
    if (!qualityLevel || qualityLevel === appliedQuality.current) return;
    appliedQuality.current = qualityLevel;
    managerRef.current?.setQuality(qualityLevel);
  }, [qualityLevel]);

  useEffect(() => {
    managerRef.current?.setTimeOfDay(timeOfDay);
  }, [timeOfDay]);

  useEffect(() => {
    managerRef.current?.setLocation(locationId);
  }, [locationId]);

  const castKey = JSON.stringify(cast);
  useEffect(() => {
    runSetCast(cast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [castKey]);

  const prewarmKey = JSON.stringify(prewarm);
  const onPrewarmedRef = useRef(onPrewarmed);
  onPrewarmedRef.current = onPrewarmed;
  useEffect(() => {
    const manager = managerRef.current;
    let cancelled = false;
    const done = () => {
      if (!cancelled) onPrewarmedRef.current?.(prewarmKey);
    };
    if (!manager || !prewarm) done();
    else void manager.preloadScenario(prewarm).finally(done);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prewarmKey]);

  const effectsKey = JSON.stringify(effects ?? {});
  useEffect(() => {
    managerRef.current?.setEffects(effects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectsKey]);

  const scrollingKey = JSON.stringify(scrolling);
  useEffect(() => {
    managerRef.current?.setScrollingBackground(scrolling);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollingKey]);

  useEffect(() => {
    managerRef.current?.setRain(rain);
  }, [rain]);

  const stillsKey = JSON.stringify([cg, cutin]);
  useEffect(() => {
    managerRef.current?.setStills(cg, cutin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stillsKey]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    manager.setCameraPose(cut?.cameraPose ?? null);
    manager.setCutTimeline(cut && cutTimeline(cut));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cut]);

  useEffect(() => {
    managerRef.current?.setSpeaker(speakerId);
    managerRef.current?.setCameraShot(cameraShot, focusId, overId);
  }, [speakerId, cameraShot, focusId, overId]);

  useEffect(() => {
    managerRef.current?.setLanguage(language);
  }, [language]);

  // 画面演出（集中線・瞼・暗転）はこの枠の中に重なり、枠の外のメッセージウィンドウはその上に出る
  return (
    <div className="player-stage">
      <canvas ref={canvasRef} />
      <StageLoading show={loading} />
    </div>
  );
}
