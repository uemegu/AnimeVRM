/**
 * リポジトリ上のシナリオと Studio データをまとめて検証する（Node 専用。`@anime-vrm/scenario/node`）。
 * 検証 CLI（scripts/validate.ts）とサーバーの保存時チェックで使う
 */
import fs from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import { CharacterBook } from './characters.ts';
import { scenarioLinks, type ScenarioLinks } from './links.ts';
import { ProjectBook } from './projects.ts';
import { checkFlagLinks, checkScenarioReferences, checkStudioDataReferences, type Catalog, type Issue, type Problem } from './references.ts';
import { LocationFile, TimeOfDayFile } from './scene.ts';
import { ScenarioCategory, schemaForCategory } from './schema.ts';
import { BgmBook, MotionBook } from './stage.ts';

/** 形式が決まっている Studio データ（assets/studio/<name>.json） */
export const STUDIO_DATA_SCHEMAS: Record<string, z.ZodType> = {
  'time-of-day': TimeOfDayFile,
  locations: LocationFile,
  characters: CharacterBook,
  motions: MotionBook,
  bgm: BgmBook,
  projects: ProjectBook,
};

export interface WorkspacePaths {
  /** リポジトリ直下 */
  repoRoot: string;
  /** assets/ */
  assetsDir: string;
}

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, 'utf8'));

const schemaIssues = (error: z.ZodError): Issue[] =>
  error.issues.map((issue) => ({ severity: 'error', path: issue.path.join('.'), message: issue.message }));

const withFile = (file: string, issues: Issue[]): Problem[] => issues.map((issue) => ({ ...issue, file }));

/** ファイルの有無を問い合わせる関数（同じパスは1回だけ調べる） */
function existsCache(base: string) {
  const cache = new Map<string, boolean>();
  return (rel: string) => {
    let exists = cache.get(rel);
    if (exists === undefined) {
      exists = fs.existsSync(path.join(base, rel));
      cache.set(rel, exists);
    }
    return exists;
  };
}

export interface ScenarioEntry {
  category: ScenarioCategory;
  id: string;
  /** リポジトリ直下からの相対パス */
  file: string;
  data: unknown;
}

/** assets/scenarios/<category>/<id>/scenario.json をすべて読む（JSON として読めないものは problems に入れる） */
function readScenarios(paths: WorkspacePaths, problems: Problem[]): ScenarioEntry[] {
  const dir = path.join(paths.assetsDir, 'scenarios');
  const entries: ScenarioEntry[] = [];
  if (!fs.existsSync(dir)) return entries;
  for (const category of fs.readdirSync(dir).sort()) {
    if (!fs.statSync(path.join(dir, category)).isDirectory()) continue;
    const rel = path.relative(paths.repoRoot, path.join(dir, category));
    if (!ScenarioCategory.safeParse(category).success) {
      problems.push({ severity: 'error', file: rel, path: '', message: `シナリオの種類 "${category}" は使えません（${ScenarioCategory.options.join(' / ')}）` });
      continue;
    }
    for (const id of fs.readdirSync(path.join(dir, category)).sort()) {
      const abs = path.join(dir, category, id, 'scenario.json');
      if (!fs.existsSync(abs)) continue;
      const file = path.relative(paths.repoRoot, abs);
      try {
        entries.push({ category: category as ScenarioCategory, id, file, data: readJson(abs) });
      } catch (err) {
        problems.push({ severity: 'error', file, path: '', message: `JSON として読めません: ${(err as Error).message}` });
      }
    }
  }
  return entries;
}

/** Studio データを読んでスキーマで検証する。通ったものだけ返す */
function readStudioData(paths: WorkspacePaths, problems: Problem[]): Map<string, unknown> {
  const dir = path.join(paths.assetsDir, 'studio');
  const result = new Map<string, unknown>();
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5)) : [];
  for (const name of names.sort()) {
    const file = path.relative(paths.repoRoot, path.join(dir, `${name}.json`));
    const schema = STUDIO_DATA_SCHEMAS[name];
    if (!schema) {
      problems.push({ severity: 'warning', file, path: '', message: `形式の決まっていない Studio データです（${Object.keys(STUDIO_DATA_SCHEMAS).join(' / ')}）` });
      continue;
    }
    let data: unknown;
    try {
      data = readJson(path.join(dir, `${name}.json`));
    } catch (err) {
      problems.push({ severity: 'error', file, path: '', message: `JSON として読めません: ${(err as Error).message}` });
      continue;
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) problems.push(...withFile(file, schemaIssues(parsed.error)));
    else result.set(name, data);
  }
  return result;
}

/** マスターデータからカタログを作る（読めなかったものは undefined のまま＝その種類のチェックを飛ばす） */
function buildCatalog(paths: WorkspacePaths, studio: Map<string, unknown>, scenarios: ScenarioEntry[]): Catalog {
  const characters = studio.get('characters') as z.infer<typeof CharacterBook> | undefined;
  const locations = studio.get('locations') as z.infer<typeof LocationFile> | undefined;
  const timesOfDay = studio.get('time-of-day') as z.infer<typeof TimeOfDayFile> | undefined;
  const bgm = studio.get('bgm') as z.infer<typeof BgmBook> | undefined;
  const motions = studio.get('motions') as z.infer<typeof MotionBook> | undefined;
  const motionsWith = (flag: 'seated' | 'locomotion') =>
    motions && new Set(Object.entries(motions.motions).filter(([, m]) => m[flag]).map(([name]) => name));
  return {
    seatPositions:
      locations && new Map(Object.entries(locations.presets).map(([id, loc]) => [id, Object.values(loc.seats ?? {}).map((seat) => seat.position)])),
    seatedMotions: motionsWith('seated'),
    locomotionMotions: motionsWith('locomotion'),
    characterIds: characters && new Set(characters.characters.map((c) => c.id)),
    spriteKeys: characters && new Map(characters.characters.map((c) => [c.id, new Set((c.sprites ?? []).map((s) => s.key))])),
    locationIds: locations && new Set(Object.keys(locations.presets)),
    timeOfDayIds: timesOfDay && new Set(Object.keys(timesOfDay.presets)),
    bgmIds: bgm && new Set(Object.keys(bgm.bgm)),
    scenarios: new Map(scenarios.map((s) => [s.id, { category: s.category, data: s.data }])),
    assetExists: existsCache(paths.assetsDir),
    repoFileExists: existsCache(paths.repoRoot),
  };
}

/** 保存しようとしているシナリオ1本を、リポジトリのマスターデータと突き合わせる（スキーマの検証は済んでいること） */
export function checkScenarioInWorkspace(paths: WorkspacePaths, category: ScenarioCategory, id: string, data: unknown): Issue[] {
  const ignored: Problem[] = [];
  const studio = readStudioData(paths, ignored);
  const scenarios = readScenarios(paths, ignored).filter((s) => !(s.category === category && s.id === id));
  scenarios.push({ category, id, file: '', data });
  return checkScenarioReferences(category, id, data, buildCatalog(paths, studio, scenarios));
}

/** 保存しようとしている Studio データを突き合わせる（スキーマの検証は済んでいること） */
export function checkStudioDataInWorkspace(paths: WorkspacePaths, name: string, data: unknown): Issue[] {
  return checkStudioDataReferences(name, data, buildCatalog(paths, new Map(), []));
}

export interface WorkspaceReport {
  problems: Problem[];
  scenarioCount: number;
  studioDataCount: number;
}

/**
 * リポジトリ全体の検証。スキーマ・ID とディレクトリ名・参照先・シナリオ ID の重複・フラグのつながり
 */
export function validateWorkspace(paths: WorkspacePaths): WorkspaceReport {
  const problems: Problem[] = [];
  const studio = readStudioData(paths, problems);
  const scenarios = readScenarios(paths, problems);
  const catalog = buildCatalog(paths, studio, scenarios);

  for (const [name, data] of studio) {
    problems.push(...withFile(path.relative(paths.repoRoot, path.join(paths.assetsDir, 'studio', `${name}.json`)), checkStudioDataReferences(name, data, catalog)));
  }

  const seen = new Map<string, string>();
  const links: { file: string; links: ScenarioLinks }[] = [];
  for (const s of scenarios) {
    const parsed = schemaForCategory(s.category).safeParse(s.data);
    if (!parsed.success) {
      problems.push(...withFile(s.file, schemaIssues(parsed.error)));
      continue;
    }
    if ((s.data as { id: string }).id !== s.id) {
      problems.push({ severity: 'error', file: s.file, path: 'id', message: `id はディレクトリ名（${s.id}）と同じにしてください` });
    }
    const other = seen.get(s.id);
    if (other) problems.push({ severity: 'error', file: s.file, path: 'id', message: `シナリオ ID "${s.id}" が ${other} と重複しています` });
    seen.set(s.id, s.file);
    problems.push(...withFile(s.file, checkScenarioReferences(s.category, s.id, s.data, catalog)));
    links.push({ file: s.file, links: scenarioLinks(s.data) });
  }
  problems.push(...checkFlagLinks(links));

  return { problems, scenarioCount: scenarios.length, studioDataCount: studio.size };
}
