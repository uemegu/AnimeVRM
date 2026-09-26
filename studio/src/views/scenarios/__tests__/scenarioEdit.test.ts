import { describe, expect, it } from 'vitest';
import type { ScenarioPackage } from '@anime-vrm/scenario';
import { cutWarnings, duplicateScene, insertScene, makeText, moveScene, referencesTo, removeScene } from '../scenarioEdit';

const base: ScenarioPackage = {
  id: 'x',
  title: 'テスト',
  scenes: [
    { id: 's1', text: 'はじめ' },
    { id: 's2', text: '', choices: [{ text: 'はい', goto: 's3' }] },
    { id: 's3', text: 'おわり' },
  ],
};

describe('カットの編集', () => {
  it('新しいカットは使われていない ID で、指定位置の後ろに入る', () => {
    const { scenario, id } = insertScene(base, 0);
    expect(id).toBe('s4');
    expect(scenario.scenes.map((s) => s.id)).toEqual(['s1', 's4', 's2', 's3']);
  });

  it('複製は中身を写して新しい ID にする', () => {
    const { scenario, id } = duplicateScene(base, 2);
    expect(scenario.scenes[3]).toEqual({ id, text: 'おわり' });
  });

  it('入れ替え・削除', () => {
    expect(moveScene(base, 0, 1).scenes.map((s) => s.id)).toEqual(['s2', 's1', 's3']);
    expect(moveScene(base, 0, -1)).toBe(base);
    expect(removeScene(base, 1).scenes.map((s) => s.id)).toEqual(['s1', 's3']);
  });

  it('参照元を探す', () => {
    expect(referencesTo(base, 's3')).toEqual(['s2']);
  });

  it('英語が空なら素の文字列にする', () => {
    expect(makeText('あ', '')).toBe('あ');
    expect(makeText('あ', 'a')).toEqual({ ja: 'あ', en: 'a' });
  });

  it('選択肢のあるシーンのセリフ・参照切れ・ID のない話者を警告する', () => {
    const scenario: ScenarioPackage = {
      ...base,
      scenes: [
        { id: 's1', speaker: '謎の声', text: '…', choices: [{ text: 'はい', goto: 'nowhere' }] },
      ],
    };
    expect(cutWarnings(scenario, 0)).toEqual(['choiceWithText', 'brokenLink', 'speakerWithoutId']);
    expect(cutWarnings(base, 1)).toEqual([]);
  });
});
