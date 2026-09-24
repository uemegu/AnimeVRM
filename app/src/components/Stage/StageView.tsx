import React, { useEffect, useRef } from 'react';
import { StageManager } from '../../services/graphics/StageManager';
import { TimeOfDayId } from '../../types/visual';

export interface StageViewProps {
  timeOfDay: TimeOfDayId;
  locationId: string;
  characterId?: string | null;
  characterModelUrl?: string;
  expression?: string;
  characterPositionX?: number;
  className?: string;
  onLoaded?: () => void;
}

export const StageView: React.FC<StageViewProps> = ({
  timeOfDay,
  locationId,
  characterId,
  characterModelUrl,
  expression,
  characterPositionX = 0,
  className = '',
  onLoaded,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageManagerRef = useRef<StageManager | null>(null);

  // 1. StageManager初期化とリサイズ監視
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const manager = new StageManager({
      canvas,
      initialTimeOfDay: timeOfDay,
      initialLocationId: locationId,
    });
    stageManagerRef.current = manager;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        manager.resize(width, height);
      }
    });

    resizeObserver.observe(canvas.parentElement || canvas);

    // 初回サイズ設定
    const rect = canvas.getBoundingClientRect();
    manager.resize(rect.width, rect.height);

    onLoaded?.();

    return () => {
      resizeObserver.disconnect();
      manager.dispose();
      stageManagerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. 時間帯（ライト・ポストプロセス・フォグ）更新
  useEffect(() => {
    if (stageManagerRef.current) {
      stageManagerRef.current.setTimeOfDay(timeOfDay);
    }
  }, [timeOfDay]);

  // 3. ロケーション（多層背景）更新
  useEffect(() => {
    if (stageManagerRef.current) {
      stageManagerRef.current.setLocation(locationId);
    }
  }, [locationId]);

  // 4. キャラクター切り替え
  useEffect(() => {
    if (stageManagerRef.current) {
      stageManagerRef.current.setActiveCharacter(
        characterId ?? null,
        characterModelUrl,
        characterPositionX
      );
    }
  }, [characterId, characterModelUrl, characterPositionX]);

  // 5. 表情更新
  useEffect(() => {
    if (stageManagerRef.current && characterId && expression) {
      stageManagerRef.current.setExpression(characterId, expression, 1.0);
    }
  }, [characterId, expression]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        zIndex: 0,
      }}
      className={className}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </div>
  );
};
