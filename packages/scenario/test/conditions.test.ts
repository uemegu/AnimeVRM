import { describe, expect, it } from 'vitest';
import { availableChoices, describeChoiceCondition, matchesChoiceCondition, MailScenario, ScenarioScene } from '../src/index.ts';
import { mergeStageState, EMPTY_STAGE } from '../src/stage.ts';

describe('選択肢の出現条件', () => {
  it('フラグ・好感度の条件をすべて満たすときだけ出る', () => {
    const condition = { requireFlags: ['route_aoi'], unlessFlags: ['seen'], minAffinity: { aoi: 14 } };
    expect(matchesChoiceCondition(condition, { flags: { route_aoi: true }, affinities: { aoi: 14 } })).toBe(true);
    expect(matchesChoiceCondition(condition, { flags: { route_aoi: true }, affinities: { aoi: 13 } })).toBe(false);
    expect(matchesChoiceCondition(condition, { flags: { route_aoi: true, seen: true }, affinities: { aoi: 20 } })).toBe(false);
    expect(matchesChoiceCondition({ flag: 'mode', value: 'a' }, { flags: { mode: 'a' } })).toBe(true);
  });

  it('好感度を持たない再生（Studio のプレビュー）では、好感度の条件は満たしたものとして出す', () => {
    expect(matchesChoiceCondition({ minAffinity: { aoi: 99 } }, { flags: {} })).toBe(true);
  });

  it('条件に合う選択肢がなければ、好感度が最も高いキャラの選択肢1つだけを出す（highest_affinity）', () => {
    const choices: { id: string; condition: { minAffinity: Record<string, number> } }[] = [
      { id: 'aoi', condition: { minAffinity: { aoi: 8 } } },
      { id: 'emili', condition: { minAffinity: { emili: 8 } } },
      { id: 'shion', condition: { minAffinity: { shion: 8 } } },
    ];
    const ids = (affinities: Record<string, number>, fallback?: 'highest_affinity') =>
      availableChoices(choices, { flags: {}, affinities }, fallback).map((c) => c.id);
    expect(ids({ aoi: 2, emili: 6, shion: 4 }, 'highest_affinity')).toEqual(['emili']);
    expect(ids({ aoi: 2, emili: 6, shion: 4 })).toEqual([]);
    expect(ids({ aoi: 9, emili: 6, shion: 8 }, 'highest_affinity')).toEqual(['aoi', 'shion']);
    // 同点は先に書いたもの
    expect(ids({}, 'highest_affinity')).toEqual(['aoi']);
  });

  it('条件を短い文にできる', () => {
    expect(describeChoiceCondition({ requireFlags: ['a'], unlessFlags: ['b'], minAffinity: { aoi: 14 } })).toBe('a !b aoi≥14');
  });
});

describe('一枚絵・カットイン・雨', () => {
  const scene = (extra: Partial<ScenarioScene>): ScenarioScene => ({ id: 's', text: '', ...extra });

  it('指定すると以降のシーンに引き継ぎ、false で消える', () => {
    let stage = mergeStageState(EMPTY_STAGE, scene({ cg: '/cg/a.avif', cutin: { url: '/cutins/b.avif', side: 'left' }, rain: true }));
    expect(stage.cg).toEqual({ url: '/cg/a.avif' });
    expect(stage.cutin).toEqual({ url: '/cutins/b.avif', side: 'left' });
    stage = mergeStageState(stage, scene({}));
    expect(stage.cg?.url).toBe('/cg/a.avif');
    expect(stage.rain).toBe(true);
    stage = mergeStageState(stage, scene({ cg: false, rain: false }));
    expect(stage.cg).toBeNull();
    expect(stage.cutin?.url).toBe('/cutins/b.avif');
    expect(stage.rain).toBe(false);
  });
});

describe('メールのスタンプ・写真', () => {
  const base = { id: 'm', characterId: 'aoi', title: 't', previewText: 'p', time: '22:00' };

  it('本文・スタンプ・写真のどれかがあればよく、反応は複数送れる', () => {
    const ok = MailScenario.safeParse({
      ...base,
      messages: [{ id: 'm1', sender: 'heroine', image: '/mail/x.avif', retractAfterSec: 2, time: '22:00' }],
      replyOptions: [{ id: 'r1', text: 'はい', reactions: [{ text: 'うん' }, { stamp: '/stamps/aoi/rabbit_bow.avif' }] }],
    });
    expect(ok.success).toBe(true);
  });

  it('中身のないメッセージは拒否し、反応のない返信（既読のまま）は受け付ける', () => {
    expect(MailScenario.safeParse({ ...base, messages: [{ id: 'm1', sender: 'heroine', time: '22:00' }] }).success).toBe(false);
    expect(MailScenario.safeParse({ ...base, messages: [], replyOptions: [{ id: 'r1', text: 'はい' }] }).success).toBe(true);
  });
});
