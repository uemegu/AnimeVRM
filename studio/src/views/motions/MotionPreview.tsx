import { useMemo, useState } from 'react';
import type { StagePresets } from '@anime-vrm/engine/stage/StageManager';
import type { StudioData } from '../../data/useStudioData';
import { useI18n } from '../../i18n';
import { StageCanvas } from '../../stage/StageCanvas';

const LOCATION_KEY = 'studio_motion_preview_location';

function storedLocation(): string {
  try {
    return localStorage.getItem(LOCATION_KEY) ?? 'school_gate';
  } catch {
    return 'school_gate';
  }
}

interface Props {
  data: StudioData;
  avatarUrl: string;
  /** モーション名または URL（生成した直後の FBX）。null なら待機 */
  motion: string | null;
  /** 同じモーションでも変わったら最初から再生する */
  cue: string;
}

/**
 * アバターにモーションを繰り返し再生させる（全身が入る構図）。背景は右上で選べる（選んだものはブラウザに覚える）。
 * ドラッグで回転・右ドラッグで移動・ホイールで前後に視点を動かせる
 */
export function MotionPreview({ data, avatarUrl, motion, cue }: Props) {
  const { t } = useI18n();
  const [stored, setStored] = useState(storedLocation);
  const locationId = data.locations[stored] ? stored : (Object.keys(data.locations)[0] ?? 'classroom');
  const [viewResetKey, setViewResetKey] = useState(0);
  const changeLocation = (id: string) => {
    setStored(id);
    try {
      localStorage.setItem(LOCATION_KEY, id);
    } catch {
      // 覚えられなくても選んだ背景は使える
    }
  };
  const presets = useMemo<StagePresets>(() => ({ timeOfDay: data.timeOfDay, locations: data.locations }), [data]);
  const cast = useMemo(
    () => [
      {
        id: 'preview',
        modelUrl: avatarUrl,
        slot: 'center' as const,
        rotationY: 0,
        expression: 'neutral',
        expressionWeight: 1,
        ...(motion ? { motion } : {}),
        motionLoop: true,
        motionCue: cue,
      },
    ],
    [avatarUrl, motion, cue]
  );
  return (
    <>
      <StageCanvas presets={presets} timeOfDay="day" locationId={locationId} cast={cast} cameraShot="wide" focusId="preview" freeCamera viewResetKey={viewResetKey} />
      <div className="motion-view-tools">
        <span className="motion-view-hint">{t.motions.viewHint}</span>
        <button type="button" className="btn" onClick={() => setViewResetKey((k) => k + 1)}>
          {t.motions.resetView}
        </button>
      </div>
      <select className="select motion-location" value={locationId} onChange={(e) => changeLocation(e.target.value)} aria-label={t.motions.background}>
        {Object.values(data.locations).map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
        ))}
      </select>
    </>
  );
}
