import React, { useEffect, useRef } from 'react';
import { StageManager } from '../../services/graphics/StageManager';
import { TimeOfDayId } from '../../types/visual';
import { CameraShot } from '../../types/scenario';
import { StageCastMember } from '../../services/stage/sceneView';
import { ScrollingBackgroundSettings } from '../../services/graphics/scene/ScrollingBackground';

export interface StageViewProps {
  timeOfDay: TimeOfDayId;
  locationId: string;
  /** 登場キャラ（位置・モデル・表情・モーション） */
  cast: StageCastMember[];
  cameraShot: CameraShot;
  /** 話者（カメラの寄り先・口パク対象） */
  speakerId?: string | null;
  /** 流れる背景（歩きながらの会話）。null なら場所の遠景 */
  scrolling?: ScrollingBackgroundSettings | null;
  className?: string;
  onLoaded?: () => void;
}

export const StageView: React.FC<StageViewProps> = ({
  timeOfDay,
  locationId,
  cast,
  cameraShot,
  speakerId = null,
  scrolling = null,
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

  // 4. 登場キャラの配置（内容が同じなら何もしない）
  const castKey = JSON.stringify(cast);
  useEffect(() => {
    stageManagerRef.current?.setCast(cast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [castKey]);

  // 流れる背景（設定が同じなら何もしない）
  const scrollingKey = JSON.stringify(scrolling);
  useEffect(() => {
    stageManagerRef.current?.setScrollingBackground(scrolling);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollingKey]);

  // 5. 話者とカメラ構図
  useEffect(() => {
    stageManagerRef.current?.setSpeaker(speakerId);
    stageManagerRef.current?.setCameraShot(cameraShot, speakerId);
  }, [speakerId, cameraShot]);

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
