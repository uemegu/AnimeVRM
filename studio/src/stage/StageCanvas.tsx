import { useEffect, useRef } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CameraPose, CameraShift, CameraShot, CutinConfig, ScenarioScene, SceneEffects, StillImageConfig, ScrollingBackgroundSettings, ShotRig } from '@anime-vrm/scenario';
import { StageManager, type StagePresets } from '@anime-vrm/engine/stage/StageManager';
import { useRenderQuality } from './renderQuality';
import type { StageCastMember } from '@anime-vrm/engine/stage/types';
import type { TimeOfDayId } from '@anime-vrm/engine/stage/visual';
import { useI18n } from '../i18n';
import { StageLoading, useCastLoading } from './StageLoading';

interface Props {
  presets: StagePresets;
  timeOfDay: TimeOfDayId;
  locationId: string;
  cast: StageCastMember[];
  cameraShot: CameraShot;
  /** 構図からカメラをずらす（カットを渡すときはカットの cameraShift が優先） */
  cameraShift?: CameraShift | null;
  focusId: string | null;
  /** 流れる背景（歩きながらの会話）。null で止める */
  scrolling?: ScrollingBackgroundSettings | null;
  /** シーンの特殊効果（花火など） */
  effects?: SceneEffects;
  /** 画面いっぱいの一枚絵と、端のカットイン */
  cg?: StillImageConfig | null;
  cutin?: CutinConfig | null;
  /** 雨 */
  rain?: boolean;
  /** 今のカット（カメラの直接指定とカット内のタイムライン） */
  cut?: ScenarioScene | null;
  /** カット内の時刻。playing でなければ、その時刻へ頭出しする */
  cutTime?: number;
  playing?: boolean;
  /** カメラを手で動かす（ドラッグで回転・右ドラッグで移動・ホイールで前後） */
  freeCamera?: boolean;
  /** 変わるたびに、手で動かした視点を構図の位置へ戻す */
  viewResetKey?: number;
  /** 手で動かしたカメラの位置が変わったとき */
  onCameraPose?: (pose: CameraPose) => void;
  /**
   * freeCamera のとき、構図（cameraShot）の値を調整する動かし方にする。カメラは構図の向きのまま、
   * ドラッグで上下の角度・右ドラッグで上下の移動・ホイールで距離だけを変える
   */
  shotRigMode?: boolean;
  /** shotRigMode で動かしたときの構図の値（done は操作を終えたとき） */
  onShotRig?: (shot: CameraShot, rig: ShotRig, done: boolean) => void;
  /** 手動操作で構図から外れた（最初に触った）とき */
  onFreeCameraTake?: () => void;
  /** 描画の準備ができたとき（俯瞰表示などから配置を読むため） */
  onManager?: (manager: StageManager | null) => void;
  /** 話者（focusId）の口の形。ボイスを鳴らしている間だけ返す */
  getSpeakerPhoneme?: () => string | undefined;
  /** 音声の音量に合わせた口の開き（0〜1） */
  getSpeakerMouthOpen?: () => number;
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
  cameraShift = null,
  focusId,
  scrolling = null,
  effects,
  cg = null,
  cutin = null,
  rain = false,
  cut = null,
  cutTime = 0,
  playing = false,
  freeCamera = false,
  viewResetKey = 0,
  onCameraPose,
  shotRigMode = false,
  onShotRig,
  onFreeCameraTake,
  onManager,
  getSpeakerPhoneme,
  getSpeakerMouthOpen,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<StageManager | null>(null);
  const { language } = useI18n();
  const { loading, run: runSetCast } = useCastLoading(managerRef);
  const phonemeRef = useRef(getSpeakerPhoneme);
  const mouthOpenRef = useRef(getSpeakerMouthOpen);
  // 描画の品質（設定）。描画が間に合わないと知らされたら、設定側で軽量に下げる
  const renderQuality = useRenderQuality();
  const slowFramesRef = useRef(renderQuality.onSlowFrames);
  slowFramesRef.current = renderQuality.onSlowFrames;
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
      getSpeakerPhoneme: () => phonemeRef.current?.(),
      getSpeakerMouthOpen: () => mouthOpenRef.current?.() ?? 1,
    });
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

  const qualityLevel = renderQuality.level;
  const appliedQuality = useRef(qualityLevel);
  useEffect(() => {
    if (!qualityLevel || qualityLevel === appliedQuality.current) return;
    appliedQuality.current = qualityLevel;
    managerRef.current?.setQuality(qualityLevel);
  }, [qualityLevel]);

  // シーン設定の編集をその場で反映する
  useEffect(() => managerRef.current?.setPresets(presets), [presets]);
  useEffect(() => managerRef.current?.setTimeOfDay(timeOfDay), [timeOfDay]);
  useEffect(() => managerRef.current?.setLocation(locationId), [locationId]);

  const castKey = JSON.stringify(cast);
  useEffect(() => {
    runSetCast(cast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [castKey]);

  useEffect(() => {
    managerRef.current?.setRain(rain);
  }, [rain]);

  const stillsKey = JSON.stringify([cg, cutin]);
  useEffect(() => {
    managerRef.current?.setStills(cg, cutin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stillsKey]);

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
    managerRef.current?.setSpeaker(focusId);
    managerRef.current?.setCameraShot(cameraShot, focusId);
  }, [cameraShot, focusId]);

  useEffect(() => {
    managerRef.current?.setCameraShift(cameraShift);
  }, [cameraShift]);

  // カットの切り替え（カメラの直接指定とタイムライン）。中身が変わったときも当て直す
  const cutKey = JSON.stringify(
    cut ? { avatars: cut.avatars, transitions: cut.transitions, cameraPose: cut.cameraPose, cameraShift: cut.cameraShift, id: cut.id, screenTransition: cut.screenTransition, focusLines: cut.focusLines } : null
  );
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    manager.setCameraPose(cut?.cameraPose ?? null);
    manager.setCutTimeline(cut);
    manager.setCutTime(cutTime, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutKey]);

  // 止めている間の時刻の変更と、再生を始めたときは、その時刻へ頭出しする（モーションも途中から合わせ直す）
  const wasPlayingRef = useRef(playing);
  useEffect(() => {
    const started = playing && !wasPlayingRef.current;
    wasPlayingRef.current = playing;
    managerRef.current?.setCutTime(cutTime, !playing || started);
  }, [cutTime, playing]);

  // 先頭から再生したら、カットの切り替え演出（暗転など）も見せる
  useEffect(() => {
    if (playing && cutTime < 0.05) managerRef.current?.replayScreenTransition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  useEffect(() => {
    managerRef.current?.setLanguage(language);
  }, [language]);

  // カメラを手で動かす。触るまでは構図（読み込み後の位置合わせも含む）に従い、触ったら手動に切り替える
  const controlsRef = useRef<{ release: () => void } | null>(null);
  const onCameraPoseRef = useRef(onCameraPose);
  onCameraPoseRef.current = onCameraPose;
  const onShotRigRef = useRef(onShotRig);
  onShotRigRef.current = onShotRig;
  const onFreeCameraTakeRef = useRef(onFreeCameraTake);
  onFreeCameraTakeRef.current = onFreeCameraTake;
  useEffect(() => {
    const manager = managerRef.current;
    const canvas = canvasRef.current;
    if (!manager || !canvas || !freeCamera) return;
    const camera = manager.viewCamera;
    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(manager.viewTarget);
    // 構図の調整は、離したところで止まるように慣性をつけない
    const damping = !shotRigMode;
    controls.enableDamping = damping;
    if (shotRigMode) {
      // 小さなプレビューでも細かく合わせられるよう、ゆっくり動かし、見上げ・見下ろしすぎないようにする
      controls.rotateSpeed = 0.35;
      controls.zoomSpeed = 0.5;
      controls.minPolarAngle = Math.PI * 0.3;
      controls.maxPolarAngle = Math.PI * 0.62;
    }
    let taken = false;
    let plane: ReturnType<StageManager['getShotRigPlane']> | null = null;
    const take = () => {
      if (shotRigMode) {
        // 構図の向きからだけ見る（左右には回さない）。右ドラッグの移動は画面の上下に効かせる
        plane = manager.getShotRigPlane();
        controls.minAzimuthAngle = plane.azimuth;
        controls.maxAzimuthAngle = plane.azimuth;
        controls.screenSpacePanning = true;
      }
      if (taken) return;
      taken = true;
      controls.target.copy(manager.viewTarget);
      manager.setFreeCamera(true);
      onFreeCameraTakeRef.current?.();
    };
    const round = (v: number) => Math.round(v * 100) / 100;
    const reportRig = (done: boolean) => {
      if (!shotRigMode || !taken) return;
      const { shot, rig } = manager.shotRigFromPose(camera.position, controls.target);
      onShotRigRef.current?.(shot, { distance: round(rig.distance), height: round(rig.height), targetHeight: round(rig.targetHeight) }, done);
    };
    const report = () => {
      // 構図の調整では、注視点を構図の位置から左右・前後にずらさない
      if (plane) {
        const dx = plane.targetX - controls.target.x;
        const dz = plane.targetZ - controls.target.z;
        controls.target.x += dx;
        controls.target.z += dz;
        camera.position.x += dx;
        camera.position.z += dz;
      }
      reportRig(false);
      manager.setFreeCameraTarget(controls.target);
      onCameraPoseRef.current?.({
        position: camera.position.toArray().map((v) => Math.round(v * 1000) / 1000) as [number, number, number],
        target: controls.target.toArray().map((v) => Math.round(v * 1000) / 1000) as [number, number, number],
        fov: camera.fov,
      });
    };
    const end = () => reportRig(true);
    controls.addEventListener('start', take);
    controls.addEventListener('change', report);
    controls.addEventListener('end', end);
    report();
    controlsRef.current = {
      // 構図へ戻す（慣性の残りを消してから、構図の位置へ補間させる）
      release: () => {
        if (!taken) return;
        controls.enableDamping = false;
        controls.update();
        controls.enableDamping = damping;
        taken = false;
        manager.setFreeCamera(false);
      },
    };
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (taken) controls.update();
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      controls.removeEventListener('start', take);
      controls.removeEventListener('change', report);
      controls.removeEventListener('end', end);
      controls.dispose();
      controlsRef.current = null;
      manager.setFreeCamera(false);
    };
  }, [freeCamera, shotRigMode]);

  useEffect(() => {
    if (viewResetKey !== 0) controlsRef.current?.release();
  }, [viewResetKey]);

  // 画面演出（集中線・瞼・暗転）はこの枠の中に重なる。枠の外のセリフ表示などはその上に出る
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', isolation: 'isolate' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', cursor: freeCamera ? 'grab' : undefined, ...(freeCamera ? { touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } : null) }} />
      <StageLoading show={loading} />
    </div>
  );
}
