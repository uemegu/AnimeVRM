import { useEffect, useState } from 'react';
import type { BgmBook, CharacterBook, LocationVisualPreset, MotionBook, TimeOfDayPreset } from '@anime-vrm/scenario';
import { api } from '../api/client';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';

/** シナリオ編集などで使うマスターデータ一式（assets/studio/*.json とアセット一覧） */
export interface StudioData {
  characters: CharacterBook;
  locations: Record<string, LocationVisualPreset>;
  timeOfDay: Record<string, TimeOfDayPreset>;
  bgm: BgmBook['bgm'];
  motions: MotionBook['motions'];
  /** assets/animations のモーション名（拡張子なし） */
  animations: string[];
  /** assets/se の効果音の URL */
  se: string[];
}

async function staticJson<T>(name: string): Promise<T> {
  const res = await fetch(resolveAssetUrl(`/studio/${name}.json`), { cache: 'no-store' });
  if (!res.ok) throw new Error(`${name}.json を読めません`);
  return res.json() as Promise<T>;
}

export function useStudioData(): { data: StudioData | null; error: boolean; reload: () => void } {
  const [data, setData] = useState<StudioData | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    Promise.all([
      api.characters(),
      staticJson<{ presets: Record<string, LocationVisualPreset> }>('locations'),
      staticJson<{ presets: Record<string, TimeOfDayPreset> }>('time-of-day'),
      staticJson<BgmBook>('bgm'),
      staticJson<MotionBook>('motions'),
      api.assets('animations'),
      api.assets('se'),
    ])
      .then(([characters, locations, timeOfDay, bgm, motions, animations, se]) =>
        setData({
          characters,
          locations: locations.presets,
          timeOfDay: timeOfDay.presets,
          bgm: bgm.bgm,
          motions: motions.motions,
          animations: animations.map((a) => a.url.replace(/^\/animations\//, '').replace(/\.fbx$/i, '')),
          se: se.map((a) => a.url),
        })
      )
      .catch(() => setError(true));
  }, [version]);
  return { data, error, reload: () => setVersion((v) => v + 1) };
}
