#!/usr/bin/env node
/**
 * シナリオと Studio データの検証（サーバーなしで動く）。
 *
 *   npm run validate                          すべて
 *   npm run validate -- demo/test_demo        指定したシナリオ（<種類>/<ID>）やファイルのパスに絞って表示
 *   npm run validate -- --json                機械向けの JSON で出す
 *   npm run validate -- --fix                 app の目次（scenarioIndex.json）が古ければ作り直す
 *
 * エラーがあれば終了コード 1。警告だけなら 0（--strict で警告も 1）
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { validateWorkspace } from '../packages/scenario/src/node.ts';
import type { Problem } from '../packages/scenario/src/references.ts';
import { buildScenarioIndex, generateScenarioIndex } from '../app/scripts/generate-scenario-index.js';

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

const report = validateWorkspace({ repoRoot: REPO_ROOT, assetsDir: path.join(REPO_ROOT, 'assets') });
const problems: Problem[] = [...report.problems];

// app の目次が古いと、ゲーム側でシナリオの追加・変更が反映されない
const indexFile = 'app/src/data/scenarioIndex.json';
try {
  const index = buildScenarioIndex();
  if (index.current !== index.json) {
    if (options.fix) {
      generateScenarioIndex();
      if (!options.json) console.log(`${indexFile} を作り直しました`);
    } else {
      problems.push({ severity: 'error', file: indexFile, path: '', message: 'シナリオの目次が古くなっています（npm run validate -- --fix で作り直す）' });
    }
  }
} catch (err) {
  problems.push({ severity: 'error', file: indexFile, path: '', message: (err as Error).message });
}

/** 絞り込み（<種類>/<ID> はそのシナリオのディレクトリ、それ以外はパスの前方一致） */
const matches = (problem: Problem) =>
  filters.length === 0 ||
  filters.some((f) => {
    const prefix = /^[a-z_]+\/[^/]+$/.test(f) && !f.startsWith('assets/') && !f.startsWith('app/') ? `assets/scenarios/${f}/` : f.replace(/^\.\//, '');
    return problem.file.startsWith(prefix);
  });
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
