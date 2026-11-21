import type { CharacterBook } from '@anime-vrm/scenario';
import type { GarmentSpec } from '@anime-vrm/engine/cloth/vrm';
import { mergeCharacterBook } from '@anime-vrm/scenario';
import { api } from '../api/client';
import { fetchProjectData } from '../data/projectData';

/** 共通のキャラと、すべてのプロジェクト専用のキャラ（モデルの URL で探すだけなので、どのプロジェクトのものでもよい） */
async function allCharacters(): Promise<CharacterBook> {
  const shared = await api.characters();
  // 公開版などプロジェクトの一覧がないときは共通のものだけ
  const projects = await api.projects().catch(() => []);
  const own = await Promise.all(projects.map((p) => fetchProjectData(p.id).catch(() => null)));
  return mergeCharacterBook(shared, own.flatMap((d) => d?.characters ?? []));
}

/**
 * 舞台へ渡す、モデルごとの布にする服（キャラ設定の models[].cloth）。StageManager の garments に渡す。
 * キャラ設定は一度だけ読み、保存したら forgetGarments で読み直させる
 */
let book: Promise<CharacterBook> | null = null;

export function garmentsOf(modelUrl: string): Promise<Record<string, GarmentSpec> | undefined> {
  book ??= allCharacters();
  return book.then((b) => {
    for (const character of b.characters) {
      for (const model of character.models) {
        if (model.url === modelUrl || modelUrl.endsWith(model.url)) return model.cloth;
      }
    }
    return undefined;
  }).catch(() => {
    book = null;
    return undefined;
  });
}

/** キャラ設定を保存した後に呼ぶ（次に読み込むモデルから新しい指定になる） */
export function forgetGarments(): void {
  book = null;
}
