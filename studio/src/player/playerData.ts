import type { BgmBook, CharacterBook, LocationVisualPreset, MotionBook, TimeOfDayPreset } from '@anime-vrm/scenario';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';
import { fetchProjectData, mergeProjectData } from '../data/projectData';

/** 再生に使うマスターデータ（assets/studio/*.json。サーバーなしで読める） */
export interface PlayerData {
  characters: CharacterBook;
  locations: Record<string, LocationVisualPreset>;
  timeOfDay: Record<string, TimeOfDayPreset>;
  bgm: BgmBook['bgm'];
  motions: MotionBook['motions'];
}

async function studioJson<T>(name: string): Promise<T> {
  const res = await fetch(resolveAssetUrl(`/studio/${name}.json`), { cache: 'no-store' });
  if (!res.ok) throw new Error(`${name}.json を読めません`);
  return res.json() as Promise<T>;
}

/** projectId のプロジェクト専用のキャラ・場所・BGM も含める */
export async function loadPlayerData(projectId?: string): Promise<PlayerData> {
  const [characters, locations, timeOfDay, bgm, motions, own] = await Promise.all([
    studioJson<CharacterBook>('characters'),
    studioJson<{ presets: Record<string, LocationVisualPreset> }>('locations'),
    studioJson<{ presets: Record<string, TimeOfDayPreset> }>('time-of-day'),
    studioJson<BgmBook>('bgm'),
    studioJson<MotionBook>('motions'),
    fetchProjectData(projectId),
  ]);
  return mergeProjectData({ characters, locations: locations.presets, timeOfDay: timeOfDay.presets, bgm: bgm.bgm, motions: motions.motions }, own);
}
