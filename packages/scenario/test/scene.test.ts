import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocationFile, TimeOfDayFile, resolveBloomConfig, DeepGlowConfig, LocationEnvironment, PostProcessingConfig } from '../src/index.ts';

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


describe('夜の光と祭りの設定', () => {
  it('場所の一部指定はnightの光のプロファイルを引き継ぎ、場所を離れると戻る', () => {
    const night = TimeOfDayFile.parse(read('time-of-day.json')).presets.night.postProcessing.bloom;
    const original = structuredClone(night);
    const local = resolveBloomConfig(night, { strength: 0.5 });
    expect(local.strength).toBe(0.5);
    expect(local.threshold).toBe(night.threshold);
    expect(local.deepGlow).toEqual(night.deepGlow);
    expect(resolveBloomConfig(night)).toEqual(original);
    expect(night).toEqual(original);
    const morning = TimeOfDayFile.parse(read('time-of-day.json')).presets.morning.postProcessing.bloom;
    expect(resolveBloomConfig(morning).deepGlow).toBeUndefined();
  });

  it('場所でDeep Glowを無効にでき、旧形式の場所設定も使える', () => {
    const night = TimeOfDayFile.parse(read('time-of-day.json')).presets.night.postProcessing.bloom;
    expect(resolveBloomConfig(night, { deepGlow: { ...night.deepGlow!, enabled: false } }).deepGlow?.enabled).toBe(false);
    expect(resolveBloomConfig(night, { strength: 0.38, radius: 0.55, threshold: 0.78 }).strength).toBe(0.38);
  });

  it('負の発光やゼロ秒の煙を拒否する', () => {
    expect(DeepGlowConfig.safeParse({ enabled: true, core: -1, halo: 0.6, haze: 0.2 }).success).toBe(false);
    const festival = read('locations.json').presets.painted_festival.environment;
    festival.festival.smokeLifetime = 0;
    expect(LocationEnvironment.safeParse(festival).success).toBe(false);
  });
});


it('人物グローは旧設定では省略でき、不正な半径・強度を拒否する', () => {
  const config = read('time-of-day.json').presets.night.postProcessing;
  expect(PostProcessingConfig.safeParse(config).success).toBe(true);
  const legacy = structuredClone(config);
  delete legacy.characterGlow;
  expect(PostProcessingConfig.safeParse(legacy).success).toBe(true);
  for (const patch of [{ radius: 0 }, { strength: -1 }, { threshold: -0.1 }]) {
    expect(PostProcessingConfig.safeParse({ ...config, characterGlow: { ...config.characterGlow, ...patch } }).success).toBe(false);
  }
});
