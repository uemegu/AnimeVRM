import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProjectBook, ScenarioCategory, scenarioLinks } from '../src/index.ts';

const ASSETS = path.resolve(import.meta.dirname, '../../../assets');
const book = JSON.parse(fs.readFileSync(path.join(ASSETS, 'studio/projects.json'), 'utf8'));

describe('assets/studio/projects.json', () => {
  it('スキーマに合うこと', () => {
    const result = ProjectBook.safeParse(book);
    expect(result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([]);
  });

  it('シナリオの種類がすべてどれかのプロジェクトに入っていること', () => {
    const covered = new Set(ProjectBook.parse(book).projects.flatMap((p) => p.categories));
    expect(ScenarioCategory.options.filter((c) => !covered.has(c))).toEqual([]);
  });

  it('同じ種類を2つのプロジェクトに入れると検証で落ちること', () => {
    const result = ProjectBook.safeParse({
      projects: [
        { id: 'a', name: { ja: 'A' }, categories: ['demo'] },
        { id: 'b', name: { ja: 'B' }, categories: ['demo'] },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('scenarioLinks', () => {
  it('シーン・選択肢・発生条件からフラグと先行シナリオを集める', () => {
    const links = scenarioLinks({
      id: 'x',
      availability: { requireFlags: ['a'], unlessFlags: ['seen_x'], after: { all: [{ scenarioId: 'y' }], any: [{ scenarioId: 'z', choiceId: 'c' }] } },
      scenes: [
        { id: 's1', setFlags: { seen_x: true, cleared: false } },
        { id: 's2', choices: [{ text: 'ok', goto: 's1', setFlags: { b: 1 }, condition: { flag: 'c', value: true } }], choiceTimeout: { seconds: 5, goto: 's1', setFlags: { d: 'yes' } } },
      ],
    });
    expect(links).toEqual({ sets: ['b', 'd', 'seen_x'], requires: ['a'], unless: ['seen_x'], conditions: ['c'], after: ['y', 'z'] });
  });

  it('電話のステップの setFlags も拾う', () => {
    expect(scenarioLinks({ id: 'call', steps: { s: { id: 's', options: [{ setFlags: { called: true } }] } } }).sets).toEqual(['called']);
  });
});
