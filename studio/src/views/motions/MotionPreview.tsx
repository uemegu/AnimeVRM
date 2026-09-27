import { useMemo } from 'react';
import type { StagePresets } from '@anime-vrm/engine/stage/StageManager';
import type { StudioData } from '../../data/useStudioData';
import { StageCanvas } from '../../stage/StageCanvas';

interface Props {
  data: StudioData;
  avatarUrl: string;
  /** モーション名または URL（生成した直後の FBX）。null なら待機 */
  motion: string | null;
  /** 同じモーションでも変わったら最初から再生する */
  cue: string;
}

/** アバターにモーションを繰り返し再生させる（全身が入る構図） */
export function MotionPreview({ data, avatarUrl, motion, cue }: Props) {
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
  return <StageCanvas presets={presets} timeOfDay="day" locationId="classroom" cast={cast} cameraShot="wide" focusId="preview" />;
}
