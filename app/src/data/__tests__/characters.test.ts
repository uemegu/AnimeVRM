import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CharacterBook } from '@anime-vrm/scenario';
import { CHARACTERS } from '../characters';

// Studio のキャラクター管理（assets/studio/characters.json）と、アプリのキャラ定義がずれていないこと。
// app を characters.json から読む形に載せ替えるまでの間の確認。
const book = CharacterBook.parse(
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../assets/studio/characters.json'), 'utf8'))
);

describe('キャラクター定義（characters.ts と characters.json）', () => {
  for (const master of Object.values(CHARACTERS)) {
    it(`${master.id} の名前・テーマカラー・モデルが同じこと`, () => {
      const character = book.characters.find((c) => c.id === master.id);
      expect(character).toBeDefined();
      const model = (key: string) => character!.models.find((m) => m.key === key)?.url;
      expect({
        name: master.name,
        themeColor: master.themeColor,
        default: master.defaultModelUrl,
        private: master.privateModelUrl,
        commute: master.commuteModelUrl,
      }).toEqual({
        name: character!.name,
        themeColor: character!.themeColor,
        default: model('default'),
        private: model('private'),
        commute: model('commute'),
      });
    });
  }
});
