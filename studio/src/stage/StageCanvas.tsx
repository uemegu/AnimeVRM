import { useEffect, useRef } from 'react';
import type { CameraShot } from '@anime-vrm/scenario';
import { StageManager, type StagePresets } from '@anime-vrm/engine/stage/StageManager';
import type { StageCastMember } from '@anime-vrm/engine/stage/types';
import type { TimeOfDayId } from '@anime-vrm/engine/stage/visual';

interface Props {
  presets: StagePresets;
  timeOfDay: TimeOfDayId;
  locationId: string;
  cast: StageCastMember[];
  cameraShot: CameraShot;
  focusId: string | null;
}

/**
 * app と同じ描画（StageManager）で舞台を表示する。親要素いっぱいに広がる
 */
export function StageCanvas({ presets, timeOfDay, locationId, cast, cameraShot, focusId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<StageManager | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const manager = new StageManager({ canvas, presets, initialTimeOfDay: timeOfDay, initialLocationId: locationId });
    managerRef.current = manager;
    const observer = new ResizeObserver(([entry]) => manager.resize(entry.contentRect.width, entry.contentRect.height));
    observer.observe(canvas.parentElement ?? canvas);
    return () => {
      observer.disconnect();
      manager.dispose();
      managerRef.current = null;
    };
    // プリセットが変わったら作り直す（シーン設定の編集を反映する）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets]);

  useEffect(() => managerRef.current?.setTimeOfDay(timeOfDay), [timeOfDay, presets]);
  useEffect(() => managerRef.current?.setLocation(locationId), [locationId, presets]);

  const castKey = JSON.stringify(cast);
  useEffect(() => {
    void managerRef.current?.setCast(cast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [castKey, presets]);

  useEffect(() => {
    managerRef.current?.setSpeaker(focusId);
    managerRef.current?.setCameraShot(cameraShot, focusId);
  }, [cameraShot, focusId, presets]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />;
}
