import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CharacterBook } from '../src/index.ts';

const ASSETS = path.resolve(import.meta.dirname, '../../../assets');
const book = JSON.parse(fs.readFileSync(path.join(ASSETS, 'studio/characters.json'), 'utf8'));

describe('assets/studio/characters.json', () => {
  it('スキーマに合うこと', () => {
    const result = CharacterBook.safeParse(book);
    expect(result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([]);
  });

  it('モデルと参照音声のファイルが存在すること', () => {
    const repo = path.resolve(ASSETS, '..');
    const missing: string[] = [];
    for (const c of CharacterBook.parse(book).characters) {
      for (const m of c.models) if (!fs.existsSync(path.join(ASSETS, m.url))) missing.push(m.url);
      if (c.voice && !fs.existsSync(path.join(repo, c.voice.ref))) missing.push(c.voice.ref);
    }
    expect(missing).toEqual([]);
  });

  it('ヒロインのテーマカラーは開発ルールどおり（アオイ黄・エミリ赤・シオン青）', () => {
    const color = (id: string) => book.characters.find((c: { id: string }) => c.id === id).themeColor;
    expect([color('aoi'), color('emili'), color('shion')]).toEqual(['#eab308', '#ef4444', '#3b82f6']);
  });

  it('シナリオで使われているキャラ ID・話者名がすべて登録されていること', () => {
    const ids = new Set<string>(book.characters.map((c: { id: string }) => c.id));
    const names = new Set<string>(book.characters.flatMap((c: { speakerNames: string[]; name: { ja: string } }) => [...c.speakerNames, c.name.ja]));
    const unknownIds = new Set<string>();
    const unknownNames = new Set<string>();
    const dir = path.join(ASSETS, 'scenarios');
    for (const category of fs.readdirSync(dir)) {
      for (const id of fs.readdirSync(path.join(dir, category))) {
        const file = path.join(dir, category, id, 'scenario.json');
        if (!fs.existsSync(file)) continue;
        const s = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (s.characterId && !ids.has(s.characterId)) unknownIds.add(s.characterId);
        for (const scene of s.scenes ?? []) {
          if (scene.speakerCharacterId && !ids.has(scene.speakerCharacterId)) unknownIds.add(scene.speakerCharacterId);
          for (const [key, avatar] of Object.entries(scene.avatars ?? {})) {
            const cid = (avatar as { characterId?: string }).characterId ?? key;
            if (!ids.has(cid)) unknownIds.add(cid);
          }
          const speaker = typeof scene.speaker === 'string' ? scene.speaker : scene.speaker?.ja;
          if (speaker && !scene.speakerCharacterId && !names.has(speaker)) unknownNames.add(speaker);
        }
      }
    }
    expect([...unknownIds]).toEqual([]);
    expect([...unknownNames]).toEqual([]);
  });
});
