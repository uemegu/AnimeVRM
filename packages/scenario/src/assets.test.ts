import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectScenarioAssets } from './assets.ts';

const ASSETS = path.resolve(import.meta.dirname, '../../../assets');
const json = (file: string) => JSON.parse(fs.readFileSync(path.join(ASSETS, file), 'utf8'));
const books = {
  locations: json('studio/locations.json').presets,
  bgm: json('studio/bgm.json').bgm,
  motions: json('studio/motions.json').motions,
  characters: json('studio/characters.json').characters,
};

describe('collectScenarioAssets', () => {
  it('デモのシナリオが使う素材をすべて拾い、どれも実在する', () => {
    for (const id of fs.readdirSync(path.join(ASSETS, 'scenarios/demo'))) {
      const file = path.join(ASSETS, 'scenarios/demo', id, 'scenario.json');
      if (!fs.existsSync(file)) continue;
      const base = `/scenarios/demo/${id}/`;
      const assets = collectScenarioAssets(JSON.parse(fs.readFileSync(file, 'utf8')), books, base);
      for (const url of assets.files) expect(fs.existsSync(path.join(ASSETS, url)), `${id}: ${url}`).toBe(true);
    }
  });

  it('ボイス・BGM・場所の絵・モーション・キャラのモデルを拾う', () => {
    const scenario = {
      location: 'classroom',
      bgm: 'main_theme',
      scenes: [{ voiceUrl: 'v1.mp3', seUrl: '/se/a.mp3', avatars: { aoi: { motion: 'Idle' } } }],
    };
    const assets = collectScenarioAssets(scenario, books, '/scenarios/demo/x/');
    expect(assets.files).toEqual(expect.arrayContaining([
      '/scenarios/demo/x/v1.mp3', '/se/a.mp3', '/bgm/thema_music.mp3',
      '/textures/painted-classroom/sky-only.png', '/animations/Idle.fbx', '/models/aoi/aoi-school.vrm',
    ]));
    expect(assets.environments).toEqual(['builtin:painted-classroom']);
    expect(assets.avatars).toEqual([{ id: 'aoi', modelUrl: '/models/aoi/aoi-school.vrm' }]);
  });
});
