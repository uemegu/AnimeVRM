import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { validateScenario } from '../ScenarioValidator';
import { diskScenarioRepository } from './diskScenarioRepository';
import scenarioIndex from '../../../data/scenarioIndex.json';
import { LOCATION_VISUAL_PRESETS } from '../../../data/locationVisualPresets';

const HEROINE_IDS = ['aoi', 'emili', 'shion'];
const PUBLIC_DIR = path.resolve(__dirname, '../../../../public');
const SCENARIOS_DIR = path.join(PUBLIC_DIR, 'scenarios');

/** public/scenarios/<category>/<id>/scenario.json の一覧 */
function listScenarioDirs(): Array<{ category: string; id: string }> {
  return fs.readdirSync(SCENARIOS_DIR).flatMap((category) =>
    fs
      .readdirSync(path.join(SCENARIOS_DIR, category))
      .filter((id) => fs.existsSync(path.join(SCENARIOS_DIR, category, id, 'scenario.json')))
      .map((id) => ({ category, id }))
  );
}

describe('シナリオファイル（public/scenarios）', () => {
  it('目次（scenarioIndex.json）がすべてのシナリオディレクトリを含んでいること', () => {
    const indexed = scenarioIndex.map((entry) => `${entry.category}/${entry.id}`).sort();
    const onDisk = listScenarioDirs().map(({ category, id }) => `${category}/${id}`).sort();
    expect(indexed).toEqual(onDisk);
  });

  const storyEntries = diskScenarioRepository.list().filter((e) => e.category !== 'call' && e.category !== 'mail');
  for (const entry of storyEntries) {
    describe(entry.id, () => {
      it('バリデーションのエラー・警告がないこと', async () => {
        const scenario = await diskScenarioRepository.load(entry.id);
        const result = validateScenario(scenario);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
      });

      it('指定しているモーションと背景が存在すること', async () => {
        const scenario = await diskScenarioRepository.load(entry.id);
        const motions = scenario.scenes.flatMap((scene) =>
          Object.values(scene.avatars ?? {}).map((avatar) => avatar.motion).filter((m): m is string => Boolean(m))
        );
        const missingMotions = motions.filter((m) => !fs.existsSync(path.join(PUBLIC_DIR, 'animations', `${m}.fbx`)));
        expect(missingMotions).toEqual([]);
        const backgrounds = scenario.scenes.map((scene) => scene.background).filter((b): b is string => Boolean(b));
        expect(backgrounds.filter((b) => !LOCATION_VISUAL_PRESETS[b])).toEqual([]);
      });

      it('参照しているボイスファイルが存在すること', async () => {
        const scenario = await diskScenarioRepository.load(entry.id);
        const missing = scenario.scenes
          .map((scene) => scene.voiceUrl)
          .filter((url): url is string => Boolean(url))
          .filter((url) => !fs.existsSync(path.join(PUBLIC_DIR, url)));
        expect(missing).toEqual([]);
      });
    });
  }

  for (const entry of diskScenarioRepository.list('call')) {
    it(`電話 ${entry.id}: 相手が決まっていて、会話の飛び先がすべて存在すること`, async () => {
      const call = await diskScenarioRepository.loadCall(entry.id);
      expect(HEROINE_IDS).toContain(call.characterId);
      const stepIds = new Set(Object.keys(call.steps));
      const targets = [
        call.initialStepId,
        ...Object.values(call.steps).flatMap((step) => [
          ...(step.nextStepId ? [step.nextStepId] : []),
          ...(step.choices ?? []).map((choice) => choice.goto),
        ]),
      ];
      expect(targets.filter((id) => !stepIds.has(id))).toEqual([]);
    });
  }

  for (const entry of diskScenarioRepository.list('mail')) {
    it(`メール ${entry.id}: 相手・プレビューがあり、返信IDが重複していないこと`, async () => {
      const mail = await diskScenarioRepository.loadMail(entry.id);
      expect(HEROINE_IDS).toContain(mail.characterId);
      expect(mail.previewText.ja).toBeTruthy();
      const replyIds = (mail.replyOptions ?? []).map((option) => option.id);
      expect(new Set(replyIds).size).toBe(replyIds.length);
    });
  }
});
