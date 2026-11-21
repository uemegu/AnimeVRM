/**
 * プロジェクトごとのキャラ・場所・BGM。
 * 共通のもの（assets/studio/characters.json・locations.json・bgm.json）はどのプロジェクトからも使え、
 * プロジェクト専用のものはそのプロジェクトの置き場の studio/projects/<プロジェクト ID>/<名前>.json に置く。
 * プロジェクトのシナリオは、共通のものとそのプロジェクト専用のものを合わせて使う（同じ ID は置けない）
 */
import { z } from 'zod';
import { Character, type CharacterBook } from './characters.ts';
import { LocationFile, type LocationVisualPreset } from './scene.ts';
import { BgmBook } from './stage.ts';

/** プロジェクトごとに分けられるデータ */
export const PROJECT_DATA_NAMES = ['characters', 'locations', 'bgm'] as const;
export type ProjectDataName = (typeof PROJECT_DATA_NAMES)[number];

/** プロジェクト専用のキャラ。演技指示（voiceMoods など）は共通のものを使う */
export const ProjectCharacterBook = z
  .strictObject({
    description: z.string().optional(),
    characters: z.array(Character),
  })
  .superRefine((book, ctx) => {
    const ids = new Set<string>();
    book.characters.forEach((c, i) => {
      if (ids.has(c.id)) ctx.addIssue({ code: 'custom', path: ['characters', i, 'id'], message: `id が重複しています: ${c.id}` });
      ids.add(c.id);
      if (c.models.length > 0 && !c.models.some((m) => m.key === 'default')) {
        ctx.addIssue({ code: 'custom', path: ['characters', i, 'models'], message: 'key が default のモデルが必要です' });
      }
    });
  });
export type ProjectCharacterBook = z.infer<typeof ProjectCharacterBook>;

export const PROJECT_DATA_SCHEMAS: Record<ProjectDataName, z.ZodType> = {
  characters: ProjectCharacterBook,
  locations: LocationFile,
  bgm: BgmBook,
};

/** プロジェクト専用のデータ一式 */
export interface ProjectData {
  characters: Character[];
  locations: Record<string, LocationVisualPreset>;
  bgm: BgmBook['bgm'];
}

export function emptyProjectData(): ProjectData {
  return { characters: [], locations: {}, bgm: {} };
}

/** 置き場からの相対パス（URL も同じ並び。先頭に / を付ければ配信される URL） */
export function projectDataPath(projectId: string, name: ProjectDataName): string {
  return `studio/projects/${projectId}/${name}.json`;
}

/** ファイルの中身（{ characters } / { presets } / { bgm }）から取り出す */
export function projectDataEntries(name: ProjectDataName, file: unknown): unknown {
  const f = (file ?? {}) as { characters?: unknown; presets?: unknown; bgm?: unknown };
  return name === 'characters' ? (f.characters ?? []) : name === 'locations' ? (f.presets ?? {}) : (f.bgm ?? {});
}

/** 保存するファイルの中身 */
export function projectDataFile(name: ProjectDataName, data: ProjectData): unknown {
  return name === 'characters' ? { characters: data.characters } : name === 'locations' ? { presets: data.locations } : { bgm: data.bgm };
}

/** 中身が空か（空なら保存しなくてよい） */
export function isProjectDataEmpty(name: ProjectDataName, data: ProjectData): boolean {
  return name === 'characters' ? data.characters.length === 0 : Object.keys(name === 'locations' ? data.locations : data.bgm).length === 0;
}

/** 共通のキャラにプロジェクト専用のキャラを足す（共通のものが先） */
export function mergeCharacterBook(shared: CharacterBook, own: Character[]): CharacterBook {
  return { ...shared, characters: [...shared.characters, ...own] };
}

/** 共通と同じ ID のもの（置けない） */
export function duplicatedIds(shared: { characters: string[]; locations: string[]; bgm: string[] }, own: ProjectData): Record<ProjectDataName, string[]> {
  return {
    characters: own.characters.map((c) => c.id).filter((id) => shared.characters.includes(id)),
    locations: Object.keys(own.locations).filter((id) => shared.locations.includes(id)),
    bgm: Object.keys(own.bgm).filter((id) => shared.bgm.includes(id)),
  };
}
