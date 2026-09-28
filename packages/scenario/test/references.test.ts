import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkScenarioReferences, checkStudioDataReferences, type Catalog, type Issue } from '../src/index.ts';
import { validateWorkspace } from '../src/node.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');

const files = new Set(['animations/Idle.fbx', 'models/aoi/aoi-school.vrm', 'voices/a.mp3', 'scenarios/action/s/v1.mp3', 'textures/far.avif']);
const catalog: Catalog = {
  characterIds: new Set(['aoi', 'emili', 'player']),
  locationIds: new Set(['classroom']),
  timeOfDayIds: new Set(['day']),
  bgmIds: new Set(['love']),
  scenarios: new Map([['prev', { category: 'action', data: { scenes: [{ id: 'x', text: '', choices: [{ text: 'a', goto: 'y' }, { id: 'c2', text: 'b', goto: 'z' }] }] } }]]),
  assetExists: (p) => files.has(p),
  repoFileExists: () => true,
};

const story = (scenes: unknown[], extra: Record<string, unknown> = {}) => ({ id: 's', title: 't', scenes, ...extra });
const errors = (issues: Issue[]) => issues.filter((i) => i.severity === 'error').map((i) => i.path);
const warnings = (issues: Issue[]) => issues.filter((i) => i.severity === 'warning').map((i) => i.path);

describe('シナリオの参照チェック', () => {
  it('参照先がすべてあれば問題なし', () => {
    const data = story(
      [
        {
          id: 'a', text: 'やあ', speaker: 'アオイ', speakerCharacterId: 'aoi', voiceUrl: 'v1.mp3', background: 'classroom', bgm: 'love', timeOfDay: 'day',
          avatars: { aoi: { motion: 'Idle', modelUrl: '/models/aoi/aoi-school.vrm', lookAtTarget: 'emili' } },
        },
        { id: 'b', text: '', choices: [{ text: '行く', goto: 'c' }] },
        { id: 'c', text: 'ok', background: '/textures/far.avif', bgm: 'silence', end: true },
      ],
      { availability: { after: { all: [{ scenarioId: 'prev', choiceId: 'y' }, { scenarioId: 'prev', choiceId: 'c2' }] } } }
    );
    expect(checkScenarioReferences('action', 's', data, catalog)).toEqual([]);
  });

  it('存在しないシーン・キャラ・場所・モーション・ファイルを指すとエラー', () => {
    const data = story([
      {
        id: 'a', text: 'x', speakerCharacterId: 'nobody', voiceUrl: 'missing.mp3', background: 'nowhere', bgm: 'nope', timeOfDay: 'noon', nextSceneId: 'zzz',
        avatars: { ghost: { motion: 'Dance' }, aoi: { lookAtTarget: 'moon', transitions: [{ at: 1, motion: 'Spin' }] } },
      },
      { id: 'a', text: '', choices: [{ text: 'x', goto: 'nope', addAffinity: { stranger: 1 } }] },
    ]);
    expect(errors(checkScenarioReferences('action', 's', data, catalog)).sort()).toEqual(
      [
        'scenes.0.nextSceneId',
        'scenes.0.speakerCharacterId',
        'scenes.0.voiceUrl',
        'scenes.0.background',
        'scenes.0.bgm',
        'scenes.0.timeOfDay',
        'scenes.0.avatars.ghost.characterId',
        'scenes.0.avatars.ghost.motion',
        'scenes.0.avatars.aoi.lookAtTarget',
        'scenes.0.avatars.aoi.transitions.0.motion',
        'scenes.1.id',
        'scenes.1.choices.0.goto',
        'scenes.1.choices.0.addAffinity.stranger',
      ].sort()
    );
  });

  it('存在しない先行シナリオ・選択肢はエラー', () => {
    const data = story([{ id: 'a', text: 'x' }], { availability: { after: { any: [{ scenarioId: 'none' }, { scenarioId: 'prev', choiceId: 'q' }] } } });
    expect(errors(checkScenarioReferences('action', 's', data, catalog))).toEqual(['availability.after.any.0.scenarioId', 'availability.after.any.1.choiceId']);
  });

  it('たどり着けないシーンと、話者 ID のないセリフは警告', () => {
    const data = story([
      { id: 'a', text: 'x', speaker: 'だれか', end: true },
      { id: 'b', text: 'y', speaker: '' },
    ]);
    expect(warnings(checkScenarioReferences('action', 's', data, catalog))).toEqual(['scenes.0.speakerCharacterId', 'scenes.1']);
  });

  it('マスターデータがなければその種類のチェックを飛ばす', () => {
    const data = story([{ id: 'a', text: 'x', speakerCharacterId: 'nobody', avatars: { ghost: { motion: 'Dance' } } }]);
    expect(checkScenarioReferences('action', 's', data, {})).toEqual([]);
  });

  it('電話のステップの行き先とキャラを調べる', () => {
    const call = {
      id: 'c', characterId: 'nobody', title: 't', initialStepId: 'x',
      steps: { s1: { id: 's1', speaker: 'a', text: 'b', nextStepId: 'gone' }, s2: { id: 'other', speaker: 'a', text: 'b', nextStepId: null } },
    };
    expect(errors(checkScenarioReferences('call', 'c', call, catalog))).toEqual(['characterId', 'initialStepId', 'steps.s1.nextStepId', 'steps.s2.id']);
  });
});

describe('Studio データの参照チェック', () => {
  it('モーション一覧のファイルと、場所の画像・組み込み3D背景', () => {
    expect(errors(checkStudioDataReferences('motions', { motions: { Idle: {}, Gone: { loop: true } } }, catalog))).toEqual(['motions.Gone']);
    const locations = {
      presets: {
        a: { id: 'a', name: 'A', layers: { background: { url: '/textures/none.avif' } }, environment: { model: 'builtin:castle', position: { x: 0, y: 0, z: 0 } } },
      },
    };
    expect(errors(checkStudioDataReferences('locations', locations, catalog))).toEqual(['presets.a.layers.background.url', 'presets.a.environment.model']);
  });
});

describe('リポジトリ全体の検証', () => {
  it('assets/ のシナリオと Studio データにエラーがないこと', () => {
    const report = validateWorkspace({ repoRoot: REPO_ROOT, assetsDir: path.join(REPO_ROOT, 'assets') });
    expect(report.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });

  describe('壊したコピー', () => {
    let root: string;
    beforeEach(() => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'scenario-validate-'));
      const write = (rel: string, data: unknown) => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), typeof data === 'string' ? data : JSON.stringify(data));
      };
      write('assets/studio/motions.json', { motions: {} });
      write('assets/studio/unknown.json', {});
      write('assets/scenarios/action/a/scenario.json', { id: 'a', title: 't', scenes: [{ id: 's', text: 'x', setFlags: { met: true } }] });
      write('assets/scenarios/action/b/scenario.json', { id: 'wrong', title: 't', scenes: [{ id: 's', text: 'x' }] });
      write('assets/scenarios/demo/a/scenario.json', { id: 'a', title: 't', availability: { requireFlags: ['met', 'never'] }, scenes: [{ id: 's', text: 'x' }] });
      write('assets/scenarios/mail/m/scenario.json', '{ broken');
      write('assets/scenarios/action/c/scenario.json', { id: 'c', title: 't', scenes: [{ id: 's', text: 'x', typo: 1 }] });
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('スキーマ・ID・重複・JSON・フラグの問題を拾う', () => {
      const { problems } = validateWorkspace({ repoRoot: root, assetsDir: path.join(root, 'assets') });
      const summary = problems.map((p) => `${p.severity} ${p.file} ${p.path}`).sort();
      expect(summary).toEqual(
        [
          'error assets/scenarios/action/b/scenario.json id',
          'error assets/scenarios/action/c/scenario.json scenes.0',
          'error assets/scenarios/demo/a/scenario.json id',
          'error assets/scenarios/mail/m/scenario.json ',
          'warning assets/scenarios/demo/a/scenario.json requireFlags',
          'warning assets/studio/unknown.json ',
        ].sort()
      );
    });
  });
});
