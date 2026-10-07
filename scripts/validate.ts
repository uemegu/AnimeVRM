#!/usr/bin/env node
/**
 * シナリオと Studio データの検証（サーバーなしで動く）。
 *
 *   npm run validate                          すべて
 *   npm run validate -- demo/test_demo        指定したシナリオ（<種類>/<ID>）やファイルのパスに絞って表示
 *   npm run validate -- --json                機械向けの JSON で出す
 *   npm run validate -- --fix                 外部プロジェクトの検証で直せるもの（app の目次 scenarioIndex.json など）を直す
 *
 * 外部プロジェクト（studio-projects.txt・STUDIO_PROJECTS）のシナリオと、そのプロジェクトの検証（studio-project.json の hooks）も含む
 *
 * エラーがあれば終了コード 1。警告だけなら 0（--strict で警告も 1）
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { assetsDirOfCategory, checkProjects, loadExternalProjects, validateWorkspace } from '../packages/scenario/src/node.ts';
import type { Problem } from '../packages/scenario/src/references.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { values: options, positionals: filters } = parseArgs({
  allowPositionals: true,
  options: {
    json: { type: 'boolean', default: false },
    fix: { type: 'boolean', default: false },
    strict: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (options.help) {
  console.log('使い方: npm run validate -- [<種類>/<ID> | <パス> ...] [--json] [--fix] [--strict]');
  process.exit(0);
}

const paths = { repoRoot: REPO_ROOT, assetsDir: path.join(REPO_ROOT, 'assets'), projects: loadExternalProjects(REPO_ROOT) };
const report = validateWorkspace(paths);
const projectCheck = await checkProjects(paths, { fix: options.fix });
const problems: Problem[] = [...report.problems, ...projectCheck.problems];
if (!options.json) for (const message of projectCheck.fixed ?? []) console.log(message);

/** <種類>/<ID> の指定なら、そのシナリオのディレクトリ（リポジトリ直下からの相対パス） */
function scenarioPrefix(filter: string): string | null {
  const m = /^([a-z_]+)\/([^/]+)$/.exec(filter);
  if (!m || filter.startsWith('assets/') || filter.startsWith('app/')) return null;
  return path.relative(REPO_ROOT, path.join(assetsDirOfCategory(paths, m[1]), 'scenarios', m[1], m[2])) + '/';
}

/** 絞り込み（<種類>/<ID> はそのシナリオのディレクトリ、それ以外はパスの前方一致） */
const matches = (problem: Problem) =>
  filters.length === 0 ||
  filters.some((f) => problem.file.startsWith(scenarioPrefix(f) ?? f.replace(/^\.\//, '')));
const shown = problems.filter(matches);
const errors = shown.filter((p) => p.severity === 'error').length;
const warnings = shown.length - errors;

if (options.json) {
  console.log(JSON.stringify({ ok: errors === 0, errors, warnings, problems: shown }, null, 2));
} else {
  for (const p of shown) {
    const label = p.severity === 'error' ? 'error  ' : 'warning';
    console.log(`${label} ${p.file}${p.path ? `  ${p.path}` : ''}\n        ${p.message}`);
  }
  console.log(
    `\nシナリオ ${report.scenarioCount} 本・Studio データ ${report.studioDataCount} 件を検証: エラー ${errors} 件、警告 ${warnings} 件`
  );
}

process.exit(errors > 0 || (options.strict && warnings > 0) ? 1 : 0);
