import { useEffect, useState } from 'react';
import type { StagePresets } from '@anime-vrm/engine/stage/StageManager';
import type { LocationVisualPreset, TimeOfDayPreset } from '@anime-vrm/engine/stage/visual';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';
import { useProjects } from '../data/useProjects';
import { fetchProjectData } from '../data/projectData';

interface PresetFile<T> {
  presets: Record<string, T>;
}

async function load<T>(name: string): Promise<Record<string, T>> {
  const res = await fetch(resolveAssetUrl(`/studio/${name}.json`), { cache: 'no-store' });
  if (!res.ok) throw new Error(`${name}.json を読めません`);
  return ((await res.json()) as PresetFile<T>).presets;
}

/** シーン設定（assets/studio/time-of-day.json・locations.json）。場所はいまのプロジェクト専用のものも含める */
export function useStagePresets(): { presets: StagePresets | null; error: boolean } {
  const [presets, setPresets] = useState<StagePresets | null>(null);
  const [error, setError] = useState(false);
  const { current: project } = useProjects();
  useEffect(() => {
    Promise.all([load<TimeOfDayPreset>('time-of-day'), load<LocationVisualPreset>('locations'), fetchProjectData(project?.id)])
      .then(([timeOfDay, locations, own]) => setPresets({ timeOfDay, locations: { ...locations, ...own.locations } }))
      .catch(() => setError(true));
  }, [project?.id]);
  return { presets, error };
}
