/**
 * シナリオのプロジェクト（assets/studio/projects.json）。
 * app 本編・演出の見本など、シナリオをまとめて扱う単位。シナリオの種類（ディレクトリ）で振り分ける。
 */
import { z } from 'zod';
import { LocalizedString, ScenarioCategory } from './schema.ts';

export const ScenarioProject = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: LocalizedString,
  description: z.string().optional(),
  /** このプロジェクトに入るシナリオの種類。並びは一覧の並び */
  categories: z.array(ScenarioCategory).min(1),
});
export type ScenarioProject = z.infer<typeof ScenarioProject>;

export const ProjectBook = z
  .strictObject({
    description: z.string().optional(),
    projects: z.array(ScenarioProject).min(1),
  })
  .superRefine((book, ctx) => {
    const ids = new Set<string>();
    const owner = new Map<string, string>();
    book.projects.forEach((p, i) => {
      if (ids.has(p.id)) ctx.addIssue({ code: 'custom', path: ['projects', i, 'id'], message: `id が重複しています: ${p.id}` });
      ids.add(p.id);
      p.categories.forEach((c, j) => {
        const other = owner.get(c);
        if (other) ctx.addIssue({ code: 'custom', path: ['projects', i, 'categories', j], message: `種類 ${c} は ${other} にも入っています` });
        owner.set(c, p.id);
      });
    });
  });
export type ProjectBook = z.infer<typeof ProjectBook>;

/**
 * Studio の外にあるプロジェクトの設定（プロジェクトのディレクトリ直下の studio-project.json）。
 * シナリオと素材を自分の置き場に持ち、Studio はリポジトリ直下の studio-projects.txt（または環境変数 STUDIO_PROJECTS）で読み込む
 */
export const ProjectManifest = ScenarioProject.extend({
  /** シナリオ（scenarios/<種類>/<ID>/）と素材の置き場。assets/ と同じ並びで、配信する URL も同じ。studio-project.json からの相対パス */
  assetsDir: z.string().min(1).default('assets'),
  /** 保存後の処理と検証を書いたモジュール（studio-project.json からの相対パス） */
  hooks: z.string().min(1).optional(),
});
export type ProjectManifest = z.infer<typeof ProjectManifest>;

/** 種類が入っているプロジェクト。どこにも入っていなければ undefined */
export function projectOfCategory(book: ProjectBook, category: string): ScenarioProject | undefined {
  return book.projects.find((p) => (p.categories as string[]).includes(category));
}
