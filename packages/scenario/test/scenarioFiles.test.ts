import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ScenarioCategory, schemaForCategory } from '../src';

const SCENARIOS_DIR = path.resolve(import.meta.dirname, '../../../assets/scenarios');

function listScenarioFiles() {
  return fs.readdirSync(SCENARIOS_DIR).flatMap((category) =>
    fs
      .readdirSync(path.join(SCENARIOS_DIR, category))
      .map((id) => ({ category, id, file: path.join(SCENARIOS_DIR, category, id, 'scenario.json') }))
      .filter(({ file }) => fs.existsSync(file))
  );
}

describe('assets/scenarios のすべてのシナリオ', () => {
  const files = listScenarioFiles();

  it('シナリオが見つかること', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const { category, id, file } of files) {
    it(`${category}/${id} がスキーマに合うこと`, () => {
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      const result = schemaForCategory(ScenarioCategory.parse(category)).safeParse(json);
      const issues = result.success
        ? []
        : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
      expect(issues).toEqual([]);
      expect(json.id).toBe(id);
    });
  }
});

describe('スキーマが不正な値を拒否すること', () => {
  const base = { id: 's', title: 'テスト', scenes: [{ id: 's1', text: 'こんにちは' }] };
  const parse = (value: unknown) => schemaForCategory('action').safeParse(value).success;

  it('正しい最小のシナリオは通る', () => {
    expect(parse(base)).toBe(true);
  });
  it('未知の項目（綴り間違いなど）を拒否する', () => {
    expect(parse({ ...base, scenes: [{ ...base.scenes[0], expresion: 'happy' }] })).toBe(false);
  });
  it('表情の強さは 0〜1 に限る', () => {
    expect(parse({ ...base, scenes: [{ ...base.scenes[0], avatars: { aoi: { expressionWeight: 1.5 } } }] })).toBe(false);
  });
  it('シーンが空のシナリオを拒否する', () => {
    expect(parse({ ...base, scenes: [] })).toBe(false);
  });
});
