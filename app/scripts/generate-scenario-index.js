import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..');

export const SCENARIOS_DIR = path.join(APP_ROOT, '..', 'assets', 'scenarios');
const OUTPUT_PATH = path.join(APP_ROOT, 'src', 'data', 'scenarioIndex.json');

/** 目次の並び順（同じ優先度のシナリオはこの順→ディレクトリ名順で選ばれる） */
const CATEGORIES = ['morning', 'action', 'holiday', 'forced', 'ending', 'special', 'call', 'mail'];
/** ゲーム本編に出さない種類（demo は演出の見本。Pages で再生する） */
const SKIPPED_CATEGORIES = ['demo'];

/** 登場人物（cast）を目次に載せる種類（行き先を選んで流れるもの） */
const CAST_CATEGORIES = ['action', 'holiday'];

/** 目次に載せるメタ情報（本文のシーン等は遅延ロード時に読む） */
const META_KEYS = [
  'id',
  'title',
  'location',
  'fallback',
  'consumesTurn',
  'availability',
  'priority',
  'actionHints',
  // 夜の電話・メール
  'characterId',
  'previewText',
  'time',
];

/**
 * assets/scenarios/<category>/<id>/scenario.json を走査し、
 * 発生判定に使うメタ情報だけを集めた src/data/scenarioIndex.json を生成する。
 * 内容が変わらない場合は書き込まない（開発サーバーの無駄な再読み込みを防ぐ）。
 */
export function generateScenarioIndex() {
  const { json, current, count } = buildScenarioIndex();
  if (current !== json) fs.writeFileSync(OUTPUT_PATH, json);
  return { count, changed: current !== json };
}

/** 書き込まずに、作り直した目次と今の目次を返す（検証 CLI で古くなっていないか調べる） */
export function buildScenarioIndex() {
  const entries = [];

  for (const category of fs.readdirSync(SCENARIOS_DIR).sort()) {
    const categoryDir = path.join(SCENARIOS_DIR, category);
    if (!fs.statSync(categoryDir).isDirectory() || SKIPPED_CATEGORIES.includes(category)) continue;
    if (!CATEGORIES.includes(category)) {
      throw new Error(`[scenario-index] Unknown category directory: ${category} (expected one of ${CATEGORIES.join(', ')})`);
    }

    for (const dirName of fs.readdirSync(categoryDir).sort()) {
      const scenarioPath = path.join(categoryDir, dirName, 'scenario.json');
      if (!fs.existsSync(scenarioPath)) continue;

      const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
      if (scenario.id !== dirName) {
        throw new Error(`[scenario-index] ${scenarioPath}: id "${scenario.id}" must match its directory name`);
      }

      const entry = { category, baseUrl: `/scenarios/${category}/${dirName}/` };
      for (const key of META_KEYS) {
        if (scenario[key] !== undefined) entry[key] = scenario[key];
      }
      // 行き先の地図に誰がいるかを出すため、舞台に立つ人・話す人（主人公は除く）
      if (CAST_CATEGORIES.includes(category)) {
        const cast = new Set();
        for (const scene of scenario.scenes ?? []) {
          for (const [id, avatar] of Object.entries(scene.avatars ?? {})) {
            if (avatar.visible !== false) cast.add(avatar.characterId ?? id);
          }
          if (scene.speakerCharacterId) cast.add(scene.speakerCharacterId);
        }
        cast.delete('player');
        if (cast.size > 0) entry.cast = [...cast].sort();
      }
      entries.push(entry);
    }
  }

  entries.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));

  const ids = new Set();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`[scenario-index] Duplicate scenario id: ${entry.id}`);
    ids.add(entry.id);
  }

  const json = JSON.stringify(entries, null, 2) + '\n';
  const current = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf8') : '';
  return { json, current, count: entries.length, outputPath: OUTPUT_PATH };
}

// CLI 実行時
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const result = generateScenarioIndex();
  console.log(`[scenario-index] Generated scenarioIndex.json (${result.count} scenarios)`);
}
