import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocationFile, TimeOfDayFile } from '../src/index.ts';

const STUDIO = path.resolve(import.meta.dirname, '../../../assets/studio');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(STUDIO, name), 'utf8'));
const issues = (result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) =>
  result.success ? [] : result.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`);

describe('シーン設定', () => {
  it('time-of-day.json がスキーマに合うこと', () => {
    expect(issues(TimeOfDayFile.safeParse(read('time-of-day.json')))).toEqual([]);
  });

  it('locations.json がスキーマに合い、画像が存在すること', () => {
    const file = read('locations.json');
    expect(issues(LocationFile.safeParse(file))).toEqual([]);
    const urls = Object.values(file.presets as Record<string, { layers: Record<string, { url?: string } | undefined> }>)
      .flatMap((p) => Object.values(p.layers).map((l) => l?.url))
      .filter((u): u is string => Boolean(u));
    expect(urls.filter((u) => !fs.existsSync(path.join(STUDIO, '..', u)))).toEqual([]);
  });

  it('キーと id が違えば拒否する', () => {
    const file = read('locations.json');
    const [key] = Object.keys(file.presets);
    file.presets[key].id = 'other';
    expect(LocationFile.safeParse(file).success).toBe(false);
  });
});
