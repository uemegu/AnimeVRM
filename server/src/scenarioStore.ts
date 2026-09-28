import fs from 'node:fs/promises';
import path from 'node:path';
import { ScenarioCategory, scenarioLinks, schemaForCategory, type ScenarioLinks, type TextContent } from '@anime-vrm/scenario';
import { isSafeSegment } from './safePath.ts';

export type ScenarioKind = 'story' | 'call' | 'mail';

export interface ScenarioSummary {
  category: ScenarioCategory;
  id: string;
  kind: ScenarioKind;
  title: string;
  /** シーン（電話はステップ、メールはメッセージ）の数 */
  lineCount: number;
  updatedAt: string;
  /** 舞台の場所（一覧のサムネイルに使う） */
  location?: string;
  description?: string;
  /** フラグと先行シナリオによる、ほかのシナリオとのつながり（プロジェクトのチャートに使う） */
  links: ScenarioLinks;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export class ScenarioValidationError extends Error {
  readonly issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super('シナリオの形式が正しくありません');
    this.issues = issues;
  }
}

export function kindOf(category: ScenarioCategory): ScenarioKind {
  return category === 'call' ? 'call' : category === 'mail' ? 'mail' : 'story';
}

export function textOf(text: TextContent | undefined): string {
  if (!text) return '';
  return typeof text === 'string' ? text : text.ja;
}

/** assets/scenarios/<category>/<id>/scenario.json の読み書き */
export class ScenarioStore {
  readonly scenariosDir: string;

  constructor(assetsDir: string) {
    this.scenariosDir = path.join(assetsDir, 'scenarios');
  }

  /** 不正なカテゴリ・ID なら null */
  filePath(category: string, id: string): string | null {
    if (!ScenarioCategory.safeParse(category).success || !isSafeSegment(id)) return null;
    return path.join(this.scenariosDir, category, id, 'scenario.json');
  }

  dirPath(category: string, id: string): string | null {
    const file = this.filePath(category, id);
    return file && path.dirname(file);
  }

  async list(): Promise<ScenarioSummary[]> {
    const result: ScenarioSummary[] = [];
    for (const category of ScenarioCategory.options) {
      const categoryDir = path.join(this.scenariosDir, category);
      const ids = await fs.readdir(categoryDir).catch(() => [] as string[]);
      for (const id of ids.sort()) {
        const file = path.join(categoryDir, id, 'scenario.json');
        const stat = await fs.stat(file).catch(() => null);
        if (!stat) continue;
        const data = JSON.parse(await fs.readFile(file, 'utf8'));
        const kind = kindOf(category);
        const lineCount =
          kind === 'call' ? Object.keys(data.steps ?? {}).length : kind === 'mail' ? (data.messages ?? []).length : (data.scenes ?? []).length;
        result.push({
          category, id, kind, title: textOf(data.title), lineCount, updatedAt: stat.mtime.toISOString(),
          ...(typeof data.location === 'string' ? { location: data.location } : {}),
          ...(data.description !== undefined ? { description: textOf(data.description) } : {}),
          links: scenarioLinks(data),
        });
      }
    }
    return result;
  }

  async read(category: string, id: string): Promise<unknown | null> {
    const file = this.filePath(category, id);
    if (!file) return null;
    const text = await fs.readFile(file, 'utf8').catch(() => null);
    return text === null ? null : JSON.parse(text);
  }

  /** スキーマで検証する。ID はパスと一致していること。問題があれば ScenarioValidationError を投げる */
  validate(category: string, id: string, data: unknown): void {
    if (!this.filePath(category, id)) throw new ScenarioValidationError([{ path: '', message: 'カテゴリまたは ID が不正です' }]);
    const parsed = schemaForCategory(category as ScenarioCategory).safeParse(data);
    if (!parsed.success) {
      throw new ScenarioValidationError(
        parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
      );
    }
    if ((data as { id?: unknown }).id !== id) {
      throw new ScenarioValidationError([{ path: 'id', message: `id はディレクトリ名（${id}）と同じにしてください` }]);
    }
  }

  /** スキーマで検証してから書く */
  async write(category: string, id: string, data: unknown): Promise<void> {
    this.validate(category, id, data);
    const file = this.filePath(category, id)!;
    await fs.mkdir(path.dirname(file), { recursive: true });
    // 受け取った JSON をそのまま書く（スキーマの既定値などで中身を変えない）
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n');
    await fs.rename(tmp, file);
  }
}
