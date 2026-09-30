import { useEffect, useMemo, useRef, useState } from 'react';
import { lastKeyframeAt, stageAtScene, type CameraPose, type ScenarioPackage, type ScenarioScene } from '@anime-vrm/scenario';
import type { StudioData } from '../../data/useStudioData';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { CameraAdjustToggle } from '../../stage/CameraAdjust';
import { CutPreview, type Outfit } from './CutPreview';
import { KeyEditor } from './KeyEditor';
import { Timeline } from './Timeline';
import { addKey, laneKeys, removeKey, updateKey, type KeyRef, type LaneId } from './timelineEdit';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';

interface Props {
  scenario: ScenarioPackage;
  index: number;
  baseUrl: string;
  data: StudioData;
  outfit: Outfit;
  onChangeScene: (scene: ScenarioScene) => void;
}

/**
 * カットのプレビューとタイムライン。ボイスに合わせて再生し、キーの追加・移動・編集、
 * プレビューのカメラを手で動かしてカットやキーに記録できる
 */
export function CutWorkbench({ scenario, index, baseUrl, data, outfit, onChangeScene }: Props) {
  const { t } = useI18n();
  const tl = t.scenarios.timeline;
  const scene = scenario.scenes[index];
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState<number | null>(null);
  const [selected, setSelected] = useState<KeyRef | null>(null);
  const [freeCamera, setFreeCamera] = useState(false);
  const [pose, setPose] = useState<CameraPose | null>(null);
  const [viewResetKey, setViewResetKey] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const voiceUrl = scene.voiceUrl ? (scene.voiceUrl.startsWith('/') ? scene.voiceUrl : `${baseUrl}${scene.voiceUrl}`) : null;
  const duration = Math.max(voiceDuration ?? 0, lastKeyframeAt(scene) + 1, 4);
  const castIds = useMemo(() => Object.keys(stageAtScene(scenario, index).cast), [scenario, index]);

  // カットが変わったら先頭へ戻る
  useEffect(() => {
    setTime(0);
    setPlaying(false);
    setSelected(null);
  }, [scene.id]);

  // ボイスの長さ
  useEffect(() => {
    setVoiceDuration(null);
    audioRef.current?.pause();
    if (!voiceUrl) {
      audioRef.current = null;
      return;
    }
    const audio = new Audio(resolveAssetUrl(voiceUrl));
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => setVoiceDuration(audio.duration);
    audioRef.current = audio;
    return () => audio.pause();
  }, [voiceUrl]);

  // 再生（ボイスがあればその再生位置、なければ時計で進める）
  useEffect(() => {
    if (!playing) {
      audioRef.current?.pause();
      return;
    }
    const audio = audioRef.current;
    const startedAt = performance.now() - time * 1000;
    if (audio) {
      audio.currentTime = Math.min(time, audio.duration || time);
      void audio.play().catch(() => {});
    }
    let frame = 0;
    const tick = () => {
      const now = audio && !audio.paused ? audio.currentTime : (performance.now() - startedAt) / 1000;
      if (now >= duration) {
        setTime(duration);
        setPlaying(false);
        return;
      }
      setTime(now);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const seek = (t: number) => {
    setPlaying(false);
    setTime(t);
  };

  const onAddKey = (lane: LaneId) => {
    const { scene: next, index: keyIndex } = addKey(scene, lane, lane.kind === 'camera' ? { at: time, camera: 'close' } : { at: time });
    onChangeScene(next);
    setSelected({ lane, index: keyIndex });
  };

  const selectedKey = selected ? laneKeys(scene, selected.lane)[selected.index] : undefined;

  return (
    <div className="workbench">
      <div className="scenario-frame">
        <CutPreview
          scenario={scenario}
          baseUrl={baseUrl}
          index={index}
          data={data}
          outfit={outfit}
          cutTime={time}
          playing={playing}
          freeCamera={freeCamera}
          onCameraPose={setPose}
          viewResetKey={viewResetKey}
        />
        <CameraAdjustToggle active={freeCamera} onToggle={setFreeCamera} />
      </div>

      {/* プレビューを動かしたカメラを、カットやキーに記録する */}
      {freeCamera && (
        <div className="workbench-camera">
          <p className="camera-adjust-hint">{t.cameraAdjust.poseHint}</p>
          {pose && (
            <span className="workbench-camera-pose">
              {t.cameraAdjust.position} {pose.position.map((v) => v.toFixed(2)).join(', ')} ／ {t.cameraAdjust.target} {pose.target.map((v) => v.toFixed(2)).join(', ')}
            </span>
          )}
          <div className="workbench-camera-actions">
            <button type="button" className="btn primary" disabled={!pose} onClick={() => pose && onChangeScene({ ...scene, cameraPose: pose })}>
              {tl.useForCut}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!pose}
              onClick={() => {
                if (!pose) return;
                const { scene: next, index: keyIndex } = addKey(scene, { kind: 'camera' }, { at: time, cameraPose: pose, cameraTransitionDuration: 1 });
                onChangeScene(next);
                setSelected({ lane: { kind: 'camera' }, index: keyIndex });
              }}
            >
              {tl.addCameraKey}
            </button>
            <button type="button" className="btn" onClick={() => setViewResetKey((k) => k + 1)}>
              {t.cameraAdjust.backToShot}
            </button>
          </div>
        </div>
      )}

      <div className="workbench-bar">
        <button type="button" className="btn" onClick={() => (playing ? setPlaying(false) : (time >= duration && setTime(0), setPlaying(true)))}>
          <Icon name={playing ? 'stop' : 'play'} size={14} />
          {playing ? tl.pause : tl.play}
        </button>
        <span className="workbench-time">
          {time.toFixed(2)} / {duration.toFixed(2)}s
        </span>
        <span className="workbench-spacer" />
        {scene.cameraPose && (
          <button
            type="button"
            className="btn"
            title={tl.cutCamera}
            onClick={() => {
              const { cameraPose: _removed, ...rest } = scene;
              onChangeScene(rest);
            }}
          >
            {tl.clearCutCamera}
          </button>
        )}
      </div>

      <Timeline
        scene={scene}
        castIds={castIds}
        characters={data.characters}
        duration={duration}
        voiceDuration={voiceDuration}
        time={time}
        selected={selected}
        onSeek={seek}
        onSelect={setSelected}
        onAddKey={onAddKey}
        onMoveKey={(ref, at) => {
          const { scene: next, index: keyIndex } = updateKey(scene, ref, { ...laneKeys(scene, ref.lane)[ref.index], at });
          onChangeScene(next);
          setSelected({ lane: ref.lane, index: keyIndex });
        }}
      />

      <div className="workbench-key">
        {selected && selectedKey ? (
          <KeyEditor
            kind={selected.lane.kind}
            value={selectedKey}
            data={data}
            castIds={castIds}
            currentPose={freeCamera ? pose : null}
            onChange={(value) => {
              const { scene: next, index: keyIndex } = updateKey(scene, selected, value);
              onChangeScene(next);
              setSelected({ lane: selected.lane, index: keyIndex });
            }}
            onDelete={() => {
              onChangeScene(removeKey(scene, selected));
              setSelected(null);
            }}
          />
        ) : (
          <p className="field-hint">{tl.selectKey}</p>
        )}
      </div>
    </div>
  );
}
