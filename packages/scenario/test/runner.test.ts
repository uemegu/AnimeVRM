import { describe, expect, it } from 'vitest';
import { ScenarioRunner, type ScenarioPackage } from '../src/index.ts';

const scenario: ScenarioPackage = {
  id: 't',
  title: 't',
  bgm: 'main_bgm',
  scenes: [
    { id: 'a', text: 'a', background: 'park', avatars: { aoi: { position: 'left' } } },
    { id: 'q', text: '', choices: [{ text: 'x', goto: 'x', setFlags: { picked: 'x' } }, { text: 'y', goto: 'y' }] },
    { id: 'x', text: 'x', avatars: { aoi: { blush: true } }, end: true },
    { id: 'y', text: 'y', nextSceneId: 'last' },
    { id: 'skipped', text: '' },
    { id: 'last', text: 'last' },
  ],
};

describe('ScenarioRunner', () => {
  it('分岐をたどり、舞台を引き継ぐ', () => {
    const runner = new ScenarioRunner(scenario);
    expect(runner.scene.id).toBe('a');
    expect(runner.next()).toBe(false);
    expect(runner.choices).toHaveLength(2);
    expect(runner.next()).toBe(false);
    expect(runner.scene.id).toBe('q');
    runner.choose(0);
    expect(runner.scene.id).toBe('x');
    expect(runner.getFlags()).toEqual({ picked: 'x' });
    expect(runner.stage.background).toBe('park');
    expect(runner.stage.cast.aoi).toEqual({ position: 'left', blush: true });
    expect(runner.next()).toBe(true);
    expect(runner.finished).toBe(true);
  });

  it('nextSceneId で飛び、最後のシーンで終わる', () => {
    const runner = new ScenarioRunner(scenario);
    runner.next();
    runner.choose(1);
    runner.next();
    expect(runner.scene.id).toBe('last');
    expect(runner.next()).toBe(true);
  });
});
