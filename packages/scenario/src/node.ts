/**
 * リポジトリ上のシナリオと Studio データをまとめて検証する（Node 専用。`@anime-vrm/scenario/node`）。
 * 検証 CLI（scripts/validate.ts）とサーバーの保存時チェックで使う
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { z } from 'zod';
import { CharacterBook } from './characters.ts';
import { scenarioLinks, type ScenarioLinks } from './links.ts';
import { ProjectBook, ProjectManifest, projectOfCategory, type ScenarioProject } from './projects.ts';
import {
  duplicatedIds,
  emptyProjectData,
  PROJECT_DATA_NAMES,
  PROJECT_DATA_SCHEMAS,
  projectDataEntries,
  projectDataPath,
  type ProjectData,
  type ProjectDataName,
} from './projectData.ts';
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
  /** Studio の外から読み込んだプロジェクト（studio-projects.txt・STUDIO_PROJECTS）。入っている種類のシナリオは、そのプロジェクトの置き場にある */
  projects?: WorkspaceProject[];
}

/** Studio の外にあるプロジェクト。パスは絶対パスにしてある */
export interface WorkspaceProject extends ScenarioProject {
  /** studio-project.json のあるディレクトリ */
  dir: string;
  /** シナリオと素材の置き場（assets/ と同じ並び） */
  assetsDir: string;
  /** 保存後の処理と検証のモジュール */
  hooks?: string;
}

export const PROJECT_MANIFEST = 'studio-project.json';

/** 既定の外部プロジェクトを並べたファイル（リポジトリ直下。1行に1つ、# から後ろは注釈） */
export const PROJECT_LIST_FILE = 'studio-projects.txt';

function defaultProjectSpec(repoRoot: string): string {
  const file = path.join(repoRoot, PROJECT_LIST_FILE);
  if (!fs.existsSync(file)) return '';
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean)
    .join(path.delimiter);
}

/**
 * 外部プロジェクトを読む。spec はプロジェクトのディレクトリを : で区切って並べたもの。
 * 既定は環境変数 STUDIO_PROJECTS、なければ studio-projects.txt。相対パスは repoRoot が基準。設定が読めなければ例外を投げる
 */
export function loadExternalProjects(repoRoot: string, spec = process.env.STUDIO_PROJECTS ?? defaultProjectSpec(repoRoot)): WorkspaceProject[] {
  return spec
    .split(path.delimiter)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const dir = path.resolve(repoRoot, entry);
      const file = path.join(dir, PROJECT_MANIFEST);
      if (!fs.existsSync(file)) throw new Error(`プロジェクトの設定がありません: ${file}`);
      const parsed = ProjectManifest.safeParse(readJson(file));
      if (!parsed.success) {
        throw new Error(`${file} の形式が正しくありません: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' / ')}`);
      }
      const { assetsDir, hooks, ...project } = parsed.data;
      return { ...project, dir, assetsDir: path.resolve(dir, assetsDir), ...(hooks ? { hooks: path.resolve(dir, hooks) } : {}) };
    });
}

/** 種類が入っている外部プロジェクト */
export function externalProjectOfCategory(paths: WorkspacePaths, category: string): WorkspaceProject | undefined {
  return paths.projects?.find((p) => (p.categories as string[]).includes(category));
}

/** 種類のシナリオの置き場（assets/ と同じ並びのディレクトリ）。外部プロジェクトに入っていなければ Studio の assets/ */
export function assetsDirOfCategory(paths: WorkspacePaths, category: string): string {
  return externalProjectOfCategory(paths, category)?.assetsDir ?? paths.assetsDir;
}

/** 素材の置き場すべて。Studio の assets/ が先頭で、同じディレクトリは1回だけ */
export function contentDirs(paths: WorkspacePaths): string[] {
  return [...new Set([paths.assetsDir, ...(paths.projects ?? []).map((p) => p.assetsDir)].map((d) => path.resolve(d)))];
}

/**
 * Studio で扱うプロジェクトの一覧。Studio のプロジェクト（assets/studio/projects.json）のあとに外部プロジェクトを並べる。
 * 同じ ID なら外部プロジェクトを使う
 */
export function listProjects(paths: WorkspacePaths): ScenarioProject[] {
  const file = path.join(paths.assetsDir, 'studio', 'projects.json');
  const builtIn = fs.existsSync(file) ? ProjectBook.parse(readJson(file)).projects : [];
  const external = (paths.projects ?? []).map(({ dir: _dir, assetsDir: _assets, hooks: _hooks, ...project }) => project);
  return [...builtIn.filter((p) => !external.some((e) => e.id === p.id)), ...external];
}

/** プロジェクトの置き場（外部プロジェクトはその assetsDir、Studio のプロジェクトは assets/） */
export function assetsDirOfProject(paths: WorkspacePaths, projectId: string): string {
  return paths.projects?.find((p) => p.id === projectId)?.assetsDir ?? paths.assetsDir;
}

/** プロジェクト専用データのファイル（絶対パス） */
export function projectDataFileOf(paths: WorkspacePaths, projectId: string, name: ProjectDataName): string {
  return path.join(assetsDirOfProject(paths, projectId), projectDataPath(projectId, name));
}

/** 種類が入っているプロジェクトの ID（Studio のものと外部のもの。どこにもなければ undefined） */
export function projectIdOfCategory(paths: WorkspacePaths, category: string): string | undefined {
  const projects = listProjects(paths);
  return projects.length ? projectOfCategory({ projects }, category)?.id : undefined;
}

/** プロジェクト専用データを読む。ファイルがなければ空。形式が違うものは problems に入れて空にする */
export function readProjectData(paths: WorkspacePaths, projectId: string, problems: Problem[] = []): ProjectData {
  const data = emptyProjectData();
  for (const name of PROJECT_DATA_NAMES) {
    const abs = projectDataFileOf(paths, projectId, name);
    if (!fs.existsSync(abs)) continue;
    const file = path.relative(paths.repoRoot, abs);
    let json: unknown;
    try {
      json = readJson(abs);
    } catch (err) {
      problems.push({ severity: 'error', file, path: '', message: `JSON として読めません: ${(err as Error).message}` });
      continue;
    }
    const parsed = PROJECT_DATA_SCHEMAS[name].safeParse(json);
    if (!parsed.success) {
      problems.push(...withFile(file, schemaIssues(parsed.error)));
      continue;
    }
    (data as unknown as Record<string, unknown>)[name] = projectDataEntries(name, json);
  }
  return data;
}

/** 共通のデータにプロジェクト専用のデータを足したもの（Studio データの名前 → 中身） */
function withProjectData(studio: Map<string, unknown>, own: ProjectData): Map<string, unknown> {
  const merged = new Map(studio);
  const characters = studio.get('characters') as z.infer<typeof CharacterBook> | undefined;
  if (characters) merged.set('characters', { ...characters, characters: [...characters.characters, ...own.characters] });
  const locations = studio.get('locations') as z.infer<typeof LocationFile> | undefined;
  if (locations) merged.set('locations', { ...locations, presets: { ...locations.presets, ...own.locations } });
  const bgm = studio.get('bgm') as z.infer<typeof BgmBook> | undefined;
  if (bgm) merged.set('bgm', { ...bgm, bgm: { ...bgm.bgm, ...own.bgm } });
  return merged;
}

/** 共通のデータの ID */
function sharedIds(studio: Map<string, unknown>) {
  return {
    characters: ((studio.get('characters') as z.infer<typeof CharacterBook> | undefined)?.characters ?? []).map((c) => c.id),
    locations: Object.keys((studio.get('locations') as z.infer<typeof LocationFile> | undefined)?.presets ?? {}),
    bgm: Object.keys((studio.get('bgm') as z.infer<typeof BgmBook> | undefined)?.bgm ?? {}),
  };
}

/** プロジェクト専用データのうち、共通と同じ ID のもの */
export function projectDataConflicts(paths: WorkspacePaths, projectId: string, own: ProjectData): Problem[] {
  const studio = readStudioData(paths, []);
  const dup = duplicatedIds(sharedIds(studio), own);
  return PROJECT_DATA_NAMES.flatMap((name) =>
    dup[name].map((id) => ({
      severity: 'error' as const,
      file: path.relative(paths.repoRoot, projectDataFileOf(paths, projectId, name)),
      path: id,
      message: `ID "${id}" は共通（assets/studio/${name}.json）にもあります`,
    }))
  );
}

/** 外部プロジェクトの保存後の処理と検証（studio-project.json の hooks に書いたモジュールが export する） */
export interface ProjectHooks {
  /** シナリオを保存したあと（ボイスの採用・登録も含む） */
  afterScenarioSaved?(): void | Promise<void>;
  /** 検証（npm run validate）。fix なら直せるものは直す。problems の file は絶対パス */
  check?(options: { fix: boolean }): ProjectCheckResult | Promise<ProjectCheckResult>;
}

export interface ProjectCheckResult {
  problems: Problem[];
  /** 直したもの（表示用の説明） */
  fixed?: string[];
}

export async function loadProjectHooks(project: WorkspaceProject): Promise<ProjectHooks> {
  return project.hooks ? ((await import(pathToFileURL(project.hooks).href)) as ProjectHooks) : {};
}

/** 種類が入っている外部プロジェクトの、保存後の処理を呼ぶ */
export async function runAfterScenarioSaved(paths: WorkspacePaths, category: string): Promise<void> {
  const project = externalProjectOfCategory(paths, category);
  if (project) await (await loadProjectHooks(project)).afterScenarioSaved?.();
}

/** 外部プロジェクトそれぞれの検証。file はリポジトリ直下からの相対パスにする */
export async function checkProjects(paths: WorkspacePaths, options: { fix: boolean }): Promise<ProjectCheckResult> {
  const result: Required<ProjectCheckResult> = { problems: [], fixed: [] };
  for (const project of paths.projects ?? []) {
    const hooks = await loadProjectHooks(project);
    if (!hooks.check) continue;
    try {
      const { problems, fixed = [] } = await hooks.check(options);
      result.problems.push(...problems.map((p) => ({ ...p, file: path.relative(paths.repoRoot, path.resolve(project.dir, p.file)) })));
      result.fixed.push(...fixed);
    } catch (err) {
      result.problems.push({ severity: 'error', file: path.relative(paths.repoRoot, project.hooks!), path: '', message: (err as Error).message });
    }
  }
  return result;
}

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, 'utf8'));

const schemaIssues = (error: z.ZodError): Issue[] =>
  error.issues.map((issue) => ({ severity: 'error', path: issue.path.join('.'), message: issue.message }));

const withFile = (file: string, issues: Issue[]): Problem[] => issues.map((issue) => ({ ...issue, file }));

/** ファイルの有無を問い合わせる関数（同じパスは1回だけ調べる。置き場が複数あればどれかにあればよい） */
function existsCache(...bases: string[]) {
  const cache = new Map<string, boolean>();
  return (rel: string) => {
    let exists = cache.get(rel);
    if (exists === undefined) {
      exists = bases.some((base) => fs.existsSync(path.join(base, rel)));
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

/** シナリオのディレクトリ（<置き場>/scenarios/<種類>/<ID>/） */
export interface ScenarioDir {
  category: ScenarioCategory;
  id: string;
  /** scenario.json の絶対パス */
  file: string;
}

/**
 * 置き場すべての scenarios/<種類>/<ID>/scenario.json を探す。
 * 使えない種類や、その種類のプロジェクトの置き場でない所にあるものは problems に入れて飛ばす
 */
export function findScenarios(paths: WorkspacePaths, problems: Problem[] = []): ScenarioDir[] {
  const result: ScenarioDir[] = [];
  for (const base of contentDirs(paths)) {
    const dir = path.join(base, 'scenarios');
    if (!fs.existsSync(dir)) continue;
    for (const category of fs.readdirSync(dir).sort()) {
      if (!fs.statSync(path.join(dir, category)).isDirectory()) continue;
      const rel = path.relative(paths.repoRoot, path.join(dir, category));
      if (!ScenarioCategory.safeParse(category).success) {
        problems.push({ severity: 'error', file: rel, path: '', message: `シナリオの種類 "${category}" は使えません（${ScenarioCategory.options.join(' / ')}）` });
        continue;
      }
      const owner = path.resolve(assetsDirOfCategory(paths, category));
      if (owner !== base) {
        problems.push({ severity: 'error', file: rel, path: '', message: `種類 ${category} のシナリオは ${path.relative(paths.repoRoot, owner) || '.'}/scenarios/ に置いてください` });
        continue;
      }
      for (const id of fs.readdirSync(path.join(dir, category)).sort()) {
        const file = path.join(dir, category, id, 'scenario.json');
        if (fs.existsSync(file)) result.push({ category: category as ScenarioCategory, id, file });
      }
    }
  }
  return result;
}

/** シナリオをすべて読む（JSON として読めないものは problems に入れる） */
function readScenarios(paths: WorkspacePaths, problems: Problem[]): ScenarioEntry[] {
  const entries: ScenarioEntry[] = [];
  for (const { category, id, file: abs } of findScenarios(paths, problems)) {
    const file = path.relative(paths.repoRoot, abs);
    try {
      entries.push({ category, id, file, data: readJson(abs) });
    } catch (err) {
      problems.push({ severity: 'error', file, path: '', message: `JSON として読めません: ${(err as Error).message}` });
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
    assetExists: existsCache(...contentDirs(paths)),
    repoFileExists: existsCache(paths.repoRoot),
  };
}

/** 保存しようとしているシナリオ1本を、リポジトリのマスターデータと突き合わせる（スキーマの検証は済んでいること） */
export function checkScenarioInWorkspace(paths: WorkspacePaths, category: ScenarioCategory, id: string, data: unknown): Issue[] {
  const ignored: Problem[] = [];
  const projectId = projectIdOfCategory(paths, category);
  const shared = readStudioData(paths, ignored);
  const studio = projectId ? withProjectData(shared, readProjectData(paths, projectId, ignored)) : shared;
  const scenarios = readScenarios(paths, ignored).filter((s) => !(s.category === category && s.id === id));
  scenarios.push({ category, id, file: '', data });
  return checkScenarioReferences(category, id, data, buildCatalog(paths, studio, scenarios));
}

/** 保存しようとしている Studio データを突き合わせる（スキーマの検証は済んでいること） */
export function checkStudioDataInWorkspace(paths: WorkspacePaths, name: string, data: unknown): Issue[] {
  return checkStudioDataReferences(name, data, buildCatalog(paths, new Map(), []));
}

/**
 * 保存しようとしているプロジェクト専用データを突き合わせる（スキーマの検証は済んでいること）。
 * 参照先のファイルと、共通との ID の重なり。path は ID の重なりなら ID
 */
export function checkProjectDataInWorkspace(paths: WorkspacePaths, projectId: string, name: ProjectDataName, file: unknown): Issue[] {
  const own = { ...emptyProjectData(), [name]: projectDataEntries(name, file) } as ProjectData;
  const asStudio = name === 'characters' ? { characters: own.characters } : file;
  return [
    ...checkStudioDataReferences(name, asStudio, buildCatalog(paths, new Map(), [])),
    ...projectDataConflicts(paths, projectId, own).map(({ file: _file, ...issue }) => issue),
  ];
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

  // プロジェクト専用のキャラ・場所・BGM。シナリオはそのプロジェクトのものと共通のものを合わせて突き合わせる
  const projectCatalogs = new Map<string, Catalog>();
  let projectDataCount = 0;
  for (const project of listProjects(paths)) {
    const own = readProjectData(paths, project.id, problems);
    for (const name of PROJECT_DATA_NAMES) {
      const abs = projectDataFileOf(paths, project.id, name);
      if (!fs.existsSync(abs)) continue;
      projectDataCount++;
      const asStudio = name === 'characters' ? { characters: own.characters } : name === 'locations' ? { presets: own.locations } : { bgm: own.bgm };
      problems.push(...withFile(path.relative(paths.repoRoot, abs), checkStudioDataReferences(name, asStudio, catalog)));
    }
    problems.push(...projectDataConflicts(paths, project.id, own));
    projectCatalogs.set(project.id, buildCatalog(paths, withProjectData(studio, own), scenarios));
  }
  const catalogOf = (category: string) => {
    const projectId = projectIdOfCategory(paths, category);
    return (projectId && projectCatalogs.get(projectId)) || catalog;
  };

  // 外部プロジェクトどうし・Studio のプロジェクトと、種類が重ならないこと
  const owners = new Map<string, string>();
  const builtIn = (studio.get('projects') as ProjectBook | undefined)?.projects ?? [];
  for (const project of builtIn) {
    if (paths.projects?.some((p) => p.id === project.id)) continue;
    for (const category of project.categories) owners.set(category, project.id);
  }
  for (const project of paths.projects ?? []) {
    const file = path.relative(paths.repoRoot, path.join(project.dir, PROJECT_MANIFEST));
    project.categories.forEach((category, i) => {
      const other = owners.get(category);
      if (other) problems.push({ severity: 'error', file, path: `categories.${i}`, message: `種類 ${category} はプロジェクト ${other} にも入っています` });
      owners.set(category, project.id);
    });
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
    problems.push(...withFile(s.file, checkScenarioReferences(s.category, s.id, s.data, catalogOf(s.category))));
    links.push({ file: s.file, links: scenarioLinks(s.data) });
  }
  problems.push(...checkFlagLinks(links));

  return { problems, scenarioCount: scenarios.length, studioDataCount: studio.size + projectDataCount };
}
