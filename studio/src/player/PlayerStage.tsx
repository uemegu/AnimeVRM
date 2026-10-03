import { useEffect, useRef } from 'react';
import type { CameraShot, ScenarioScene, SceneEffects, ScrollingBackgroundSettings, StageCastMember, TimeOfDayId } from '@anime-vrm/scenario';
import { StageManager, type StagePresets } from '@anime-vrm/engine/stage/StageManager';
import { StageLoading, useCastLoading } from '../stage/StageLoading';

interface Props {
  presets: StagePresets;
  timeOfDay: TimeOfDayId;
  locationId: string;
  cast: StageCastMember[];
  cameraShot: CameraShot;
  speakerId: string | null;
  scrolling: ScrollingBackgroundSettings | null;
  /** シーンの特殊効果（花火など） */
  effects?: SceneEffects;
  /** 今のカット（カメラの直接指定・タイムライン・画面演出） */
  cut: ScenarioScene | null;
  language: 'ja' | 'en';
  /** カット内の時刻（ボイスの再生位置。なければカット開始からの秒数を使う） */
  getCutTime: () => number | undefined;
  getSpeakerPhoneme: () => string | undefined;
  onCanvas?: (canvas: HTMLCanvasElement | null) => void;
}

/**
 * 再生画面の舞台。カットが変わるたびにタイムラインを渡し、時刻はボイスに合わせて描画側が進める
 */
export function PlayerStage({ presets, timeOfDay, locationId, cast, cameraShot, speakerId, scrolling, effects, cut, language, getCutTime, getSpeakerPhoneme, onCanvas }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<StageManager | null>(null);
  const { loading, run: runSetCast } = useCastLoading(managerRef);
  const timeRef = useRef(getCutTime);
  const phonemeRef = useRef(getSpeakerPhoneme);
  timeRef.current = getCutTime;
  phonemeRef.current = getSpeakerPhoneme;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const manager = new StageManager({
      canvas,
      presets,
      initialTimeOfDay: timeOfDay,
      initialLocationId: locationId,
      language,
      getCutTime: () => timeRef.current(),
      getSpeakerPhoneme: () => phonemeRef.current(),
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
    const manager = managerRef.current;
    if (!manager) return;
    manager.setCameraPose(cut?.cameraPose ?? null);
    manager.setCutTimeline(cut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cut]);

  useEffect(() => {
    managerRef.current?.setSpeaker(speakerId);
    managerRef.current?.setCameraShot(cameraShot, speakerId);
  }, [speakerId, cameraShot]);

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
