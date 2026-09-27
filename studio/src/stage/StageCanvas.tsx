import { useEffect, useRef } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CameraPose, CameraShot, ScenarioScene, ScrollingBackgroundSettings } from '@anime-vrm/scenario';
import { StageManager, type StagePresets } from '@anime-vrm/engine/stage/StageManager';
import type { StageCastMember } from '@anime-vrm/engine/stage/types';
import type { TimeOfDayId } from '@anime-vrm/engine/stage/visual';
import { useI18n } from '../i18n';

interface Props {
  presets: StagePresets;
  timeOfDay: TimeOfDayId;
  locationId: string;
  cast: StageCastMember[];
  cameraShot: CameraShot;
  focusId: string | null;
  /** 流れる背景（歩きながらの会話）。null で止める */
  scrolling?: ScrollingBackgroundSettings | null;
  /** 今のカット（カメラの直接指定とカット内のタイムライン） */
  cut?: ScenarioScene | null;
  /** カット内の時刻。playing でなければ、その時刻へ頭出しする */
  cutTime?: number;
  playing?: boolean;
  /** カメラを手で動かす（ドラッグで回転・右ドラッグで移動・ホイールで前後） */
  freeCamera?: boolean;
  /** 手で動かしたカメラの位置が変わったとき */
  onCameraPose?: (pose: CameraPose) => void;
  /** 描画の準備ができたとき（俯瞰表示などから配置を読むため） */
  onManager?: (manager: StageManager | null) => void;
}

/**
 * app と同じ描画（StageManager）で舞台を表示する。親要素いっぱいに広がる
 */
export function StageCanvas({
  presets,
  timeOfDay,
  locationId,
  cast,
  cameraShot,
  focusId,
  scrolling = null,
  cut = null,
  cutTime = 0,
  playing = false,
  freeCamera = false,
  onCameraPose,
  onManager,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<StageManager | null>(null);
  const { language } = useI18n();

  useEffect(() => {
    const canvas = canvasRef.current!;
    const manager = new StageManager({ canvas, presets, initialTimeOfDay: timeOfDay, initialLocationId: locationId, language });
    managerRef.current = manager;
    onManager?.(manager);
    const observer = new ResizeObserver(([entry]) => manager.resize(entry.contentRect.width, entry.contentRect.height));
    observer.observe(canvas.parentElement ?? canvas);
    return () => {
      observer.disconnect();
      manager.dispose();
      managerRef.current = null;
      onManager?.(null);
    };
    // 作り直すと VRM を読み直すので、最初の1回だけ作る。以降の変更は下の effect で当てる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // シーン設定の編集をその場で反映する
  useEffect(() => managerRef.current?.setPresets(presets), [presets]);
  useEffect(() => managerRef.current?.setTimeOfDay(timeOfDay), [timeOfDay]);
  useEffect(() => managerRef.current?.setLocation(locationId), [locationId]);

  const castKey = JSON.stringify(cast);
  useEffect(() => {
    void managerRef.current?.setCast(cast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [castKey]);

  const scrollingKey = JSON.stringify(scrolling);
  useEffect(() => {
    managerRef.current?.setScrollingBackground(scrolling);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollingKey]);

  useEffect(() => {
    managerRef.current?.setSpeaker(focusId);
    managerRef.current?.setCameraShot(cameraShot, focusId);
  }, [cameraShot, focusId]);

  // カットの切り替え（カメラの直接指定とタイムライン）。中身が変わったときも当て直す
  const cutKey = JSON.stringify(
    cut ? { avatars: cut.avatars, transitions: cut.transitions, cameraPose: cut.cameraPose, id: cut.id, screenTransition: cut.screenTransition, focusLines: cut.focusLines } : null
  );
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    manager.setCameraPose(cut?.cameraPose ?? null);
    manager.setCutTimeline(cut);
    manager.setCutTime(cutTime, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutKey]);

  useEffect(() => {
    managerRef.current?.setCutTime(cutTime, !playing);
  }, [cutTime, playing]);

  // 先頭から再生したら、カットの切り替え演出（暗転など）も見せる
  useEffect(() => {
    if (playing && cutTime < 0.05) managerRef.current?.replayScreenTransition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  useEffect(() => {
    managerRef.current?.setLanguage(language);
  }, [language]);

  // カメラを手で動かす
  const onCameraPoseRef = useRef(onCameraPose);
  onCameraPoseRef.current = onCameraPose;
  useEffect(() => {
    const manager = managerRef.current;
    const canvas = canvasRef.current;
    if (!manager || !canvas || !freeCamera) return;
    const camera = manager.viewCamera;
    manager.setFreeCamera(true);
    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(manager.viewTarget);
    controls.enableDamping = true;
    controls.update();
    const report = () => {
      manager.setFreeCameraTarget(controls.target);
      onCameraPoseRef.current?.({
        position: camera.position.toArray().map((v) => Math.round(v * 1000) / 1000) as [number, number, number],
        target: controls.target.toArray().map((v) => Math.round(v * 1000) / 1000) as [number, number, number],
        fov: camera.fov,
      });
    };
    controls.addEventListener('change', report);
    report();
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      controls.update();
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      controls.removeEventListener('change', report);
      controls.dispose();
      manager.setFreeCamera(false);
    };
  }, [freeCamera]);

  // 画面演出（集中線・瞼・暗転）はこの枠の中に重なる。枠の外のセリフ表示などはその上に出る
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', isolation: 'isolate' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', cursor: freeCamera ? 'grab' : undefined }} />
    </div>
  );
}
