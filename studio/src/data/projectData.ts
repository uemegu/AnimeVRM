import {
  emptyProjectData,
  mergeCharacterBook,
  PROJECT_DATA_NAMES,
  projectDataEntries,
  projectDataFile,
  projectDataPath,
  type BgmBook,
  type CharacterBook,
  type LocationVisualPreset,
  type ProjectData,
  type ProjectDataName,
} from '@anime-vrm/scenario';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';
import { api } from '../api/client';

/**
 * プロジェクト専用のキャラ・場所・BGM（<置き場>/studio/projects/<ID>/<名前>.json）。
 * 読むときは静的ファイルを読み（サーバーなしの撮影・Pages でも読める）、保存はサーバーに頼む。
 * 共通のもの（assets/studio/*.json）と同じ ID は置けない
 */

async function projectJson(projectId: string, name: ProjectDataName): Promise<unknown> {
  const res = await fetch(resolveAssetUrl(`/${projectDataPath(projectId, name)}`), { cache: 'no-store' });
  // ファイルがなければ空（開発サーバーは置き場にないパスに index.html を返すことがある）
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return undefined;
  return res.json();
}

export async function fetchProjectData(projectId: string | undefined): Promise<ProjectData> {
  const data = emptyProjectData();
  if (!projectId) return data;
  const files = await Promise.all(PROJECT_DATA_NAMES.map((name) => projectJson(projectId, name)));
  PROJECT_DATA_NAMES.forEach((name, i) => {
    if (files[i] !== undefined) (data as unknown as Record<string, unknown>)[name] = projectDataEntries(name, files[i]);
  });
  return data;
}

export function saveProjectData(projectId: string, name: ProjectDataName, data: ProjectData) {
  return api.saveProjectData(projectId, name, projectDataFile(name, data));
}

/** 共通のデータにプロジェクト専用のデータを足す */
export function mergeProjectData<T extends { characters: CharacterBook; locations: Record<string, LocationVisualPreset>; bgm: BgmBook['bgm'] }>(
  shared: T,
  own: ProjectData
): T {
  return {
    ...shared,
    characters: mergeCharacterBook(shared.characters, own.characters),
    locations: { ...shared.locations, ...own.locations },
    bgm: { ...shared.bgm, ...own.bgm },
  };
}

/** 置き場所。shared は共通（assets/studio/）、project はいま選んでいるプロジェクト専用 */
export type DataScope = 'shared' | 'project';

/** 共通の場所と、すべてのプロジェクト専用の場所（場所 ID で探すだけの確認用ページ向け。同じ ID は置けないので混ぜてよい） */
export async function fetchAllLocations(): Promise<Record<string, LocationVisualPreset>> {
  const res = await fetch(resolveAssetUrl('/studio/locations.json'), { cache: 'no-store' });
  if (!res.ok) throw new Error('locations.json を読めません');
  const shared = ((await res.json()) as { presets: Record<string, LocationVisualPreset> }).presets;
  const projects = await api.projects().catch(() => []);
  const own = await Promise.all(projects.map((p) => fetchProjectData(p.id).catch(() => null)));
  return Object.assign({}, shared, ...own.map((d) => d?.locations ?? {}));
}
