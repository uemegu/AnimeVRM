/**
 * カットの撮影ページ（studio/shot.html）。scripts/shot.ts が Playwright で開き、window.__shot.render で1カットずつ映す。
 * 見え方はシナリオ編集のプレビュー（CutPreview）と同じ。サーバー（server/）なしで動くよう、マスターデータは静的に読む
 */
import '../styles/global.css';
import '../views/scenarios/scenarios.css';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { BgmBook, CharacterBook, LocationVisualPreset, MotionBook, ScenarioPackage, TimeOfDayPreset } from '@anime-vrm/scenario';
import type { StudioData } from '../data/useStudioData';
import { LanguageProvider } from '../i18n';
import { CutPreview, type Outfit } from '../views/scenarios/CutPreview';
import type { StageManager } from '@anime-vrm/engine/stage/StageManager';

export interface ShotRequest {
  scenario: ScenarioPackage;
  /** ボイスなどの相対パスの基準（/scenarios/<category>/<id>/） */
  baseUrl: string;
  sceneIndex: number;
  /** カット内の時刻（秒）。タイムラインのキーフレームをこの時刻まで反映する */
  time: number;
  outfit: Outfit;
  /** セリフ・選択肢の枠を出すか */
  dialogue: boolean;
  /** 左上の場所・時間帯・構図の表示を出すか */
  hud: boolean;
}

declare global {
  interface Window {
    __shot?: {
      ready: boolean;
      error?: string;
      render: (request: ShotRequest) => Promise<void>;
      /** 登場キャラの頭の画面上の位置（構図のチェック用。-1〜1、上が +1） */
      heads?: () => { id: string; x: number; y: number; behind: boolean }[];
      /** 描画の重さの計測用（scripts/profile-render.ts） */
      manager?: () => StageManager | null;
    };
  }
}

async function staticJson<T>(name: string): Promise<T> {
  const res = await fetch(`/studio/${name}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${name}.json を読めません`);
  return res.json() as Promise<T>;
}

async function loadData(): Promise<StudioData> {
  const [characters, locations, timeOfDay, bgm, motions] = await Promise.all([
    staticJson<CharacterBook>('characters'),
    staticJson<{ presets: Record<string, LocationVisualPreset> }>('locations'),
    staticJson<{ presets: Record<string, TimeOfDayPreset> }>('time-of-day'),
    staticJson<BgmBook>('bgm'),
    staticJson<MotionBook>('motions'),
  ]);
  return { characters, locations: locations.presets, timeOfDay: timeOfDay.presets, bgm: bgm.bgm, motions: motions.motions, animations: [], se: [] };
}

let resolveRendered: (() => void) | null = null;
let stageManager: StageManager | null = null;

function ShotPage({ data }: { data: StudioData }) {
  const [request, setRequest] = useState<ShotRequest | null>(null);

  useEffect(() => {
    window.__shot = {
      ready: true,
      render: (next) =>
        new Promise<void>((resolve) => {
          resolveRendered = resolve;
          setRequest(next);
        }),
      heads: () => stageManager?.headsOnScreen() ?? [],
      manager: () => stageManager,
    };
  }, []);

  // 描画に反映されたら呼び出し元へ返す（モデルや画像の読み込み待ちは scripts/shot.ts 側で行う）
  useEffect(() => {
    if (!request) return;
    resolveRendered?.();
    resolveRendered = null;
  }, [request]);

  if (!request) return null;
  const { scenario, baseUrl, sceneIndex, time, outfit, dialogue, hud } = request;
  // 表示を消すだけにする（セリフや選択肢を消すと構図の自動決定が変わる）
  const hidden = [!dialogue && '.cut-dialogue', !hud && '.cut-preview-hud'].filter(Boolean).join(', ');
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {hidden && <style>{`${hidden} { display: none !important; }`}</style>}
      <CutPreview
        scenario={scenario}
        baseUrl={baseUrl}
        index={sceneIndex}
        data={data}
        outfit={outfit}
        cutTime={time}
        playing={false}
        freeCamera={false}
        onCameraPose={() => {}}
        onManager={(manager) => (stageManager = manager)}
      />
    </div>
  );
}

loadData()
  .then((data) =>
    createRoot(document.getElementById('root')!).render(
      <LanguageProvider>
        <ShotPage data={data} />
      </LanguageProvider>
    )
  )
  .catch((err: Error) => {
    window.__shot = { ready: false, error: err.message, render: () => Promise.reject(err) };
  });
