import React, { useEffect, useRef } from 'react';
import { ScenarioResolvedScene } from '../../services/scenario/ScenarioEngine';
import { StageManager } from '@anime-vrm/engine/stage/StageManager';
import { TIME_OF_DAY_PRESETS } from '../../data/timeOfDayPresets';
import { LOCATION_VISUAL_PRESETS } from '../../data/locationVisualPresets';
import { soundManager } from '../../services/audio/SoundManager';
import { TimeOfDayId } from '../../types/visual';
import { CameraShot } from '../../types/scenario';
import type { SceneEffects } from '@anime-vrm/scenario';
import { StageCastMember } from '../../services/stage/sceneView';
import { ScrollingBackgroundSettings } from '@anime-vrm/engine/stage/ScrollingBackground';
import { useLanguage } from '../../contexts/LanguageContext';

export interface StageViewProps {
  timeOfDay: TimeOfDayId;
  locationId: string;
  /** 登場キャラ（位置・モデル・表情・モーション） */
  cast: StageCastMember[];
  /** 後のシーンで登場するキャラ（表示せずに先に読み込む） */
  prewarm?: { id: string; modelUrl: string; motions?: string[] }[];
  cameraShot: CameraShot;
  /** 話者（カメラの寄り先・口パク対象） */
  speakerId?: string | null;
  /** 流れる背景（歩きながらの会話）。null なら場所の遠景 */
  scrolling?: ScrollingBackgroundSettings | null;
  /** シーンの特殊効果（花火など） */
  effects?: SceneEffects;
  /** 今のカット（カメラの直接指定とカット内のタイムライン） */
  cut?: ScenarioResolvedScene | null;
  className?: string;
  onLoaded?: () => void;
}

export const StageView: React.FC<StageViewProps> = ({
  timeOfDay,
  locationId,
  cast,
  prewarm = [],
  cameraShot,
  speakerId = null,
  scrolling = null,
  effects,
  cut = null,
  className = '',
  onLoaded,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageManagerRef = useRef<StageManager | null>(null);
  const { lang } = useLanguage();

  // 1. StageManager初期化とリサイズ監視
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const manager = new StageManager({
      canvas,
      presets: { timeOfDay: TIME_OF_DAY_PRESETS, locations: LOCATION_VISUAL_PRESETS },
      getSpeakerPhoneme: () => soundManager.getVoicePhoneme(),
      getSpeakerMouthOpen: () => soundManager.getVoiceMouthOpen(),
      // カット内のタイムラインはボイスの再生位置で進める（ボイスがなければカット開始からの秒数）
      getCutTime: () => soundManager.getVoiceTime(),
      initialTimeOfDay: timeOfDay,
      initialLocationId: locationId,
      language: lang,
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

  // 後のシーンで登場するキャラを、表示せずに先に読み込んで描画の準備まで済ませる
  const prewarmKey = JSON.stringify(prewarm);
  useEffect(() => {
    if (prewarm.length > 0) void stageManagerRef.current?.prewarmAvatars(prewarm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prewarmKey]);

  // 特殊効果（シナリオの「あ、花火」から花火を上げるなど。内容が同じなら何もしない）
  const effectsKey = JSON.stringify(effects ?? {});
  useEffect(() => {
    stageManagerRef.current?.setEffects(effects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectsKey]);

  // 流れる背景（設定が同じなら何もしない）
  const scrollingKey = JSON.stringify(scrolling);
  useEffect(() => {
    stageManagerRef.current?.setScrollingBackground(scrolling);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollingKey]);

  // カットが変わったら、カメラの直接指定とカット内のタイムラインを渡す
  useEffect(() => {
    const manager = stageManagerRef.current;
    if (!manager) return;
    manager.setCameraPose(cut?.cameraPose ?? null);
    manager.setCutTimeline(
      cut
        ? { id: cut.id, text: cut.text, avatars: cut.avatars, transitions: cut.transitions, cameraShift: cut.cameraShift, screenTransition: cut.screenTransition, focusLines: cut.focusLines }
        : null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cut?.id]);

  useEffect(() => {
    stageManagerRef.current?.setLanguage(lang);
  }, [lang]);

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
