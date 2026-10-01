/**
 * シナリオと Studio データの参照チェック（スキーマでは分からない、ID やファイルが実在するか）。
 * ファイルの有無は呼び出し側から関数で受け取るので、ブラウザでも Node でも使える。
 * Node でリポジトリ全体を調べるときは `@anime-vrm/scenario/node` の validateWorkspace を使う
 */
import type { z } from 'zod';
import type { CharacterBook } from './characters.ts';
import type { ScenarioLinks } from './links.ts';
import { BUILTIN_ENVIRONMENTS, type LocationFile } from './scene.ts';
import type { CallScenario, MailScenario, ScenarioCategory, ScenarioPackage, ScenarioScene, SceneAvatarConfig } from './schema.ts';
import type { BgmBook, MotionBook } from './stage.ts';

export type ProblemSeverity = 'error' | 'warning';

export interface Problem {
  severity: ProblemSeverity;
  /** リポジトリ直下からの相対パス（例: assets/scenarios/demo/x/scenario.json） */
  file: string;
  /** JSON の中の場所（例: scenes.3.nextSceneId）。ファイル全体なら空文字 */
  path: string;
  message: string;
}

/** ファイルを除いた問題（呼び出し側でファイルを付ける） */
export type Issue = Omit<Problem, 'file'>;

/**
 * 突き合わせに使うマスターデータ。読めなかった項目は undefined にすると、その種類のチェックを飛ばす
 */
export interface Catalog {
  /** キャラ ID（characters.json） */
  characterIds?: ReadonlySet<string>;
  /** 場所 ID（locations.json） */
  locationIds?: ReadonlySet<string>;
  /** 時間帯 ID（time-of-day.json） */
  timeOfDayIds?: ReadonlySet<string>;
  /** BGM の ID（bgm.json） */
  bgmIds?: ReadonlySet<string>;
  /** すべてのシナリオ（先行シナリオの参照先。ID → 中身） */
  scenarios?: ReadonlyMap<string, { category: ScenarioCategory; data: unknown }>;
  /** assets/ 以下のファイルがあるか（引数は先頭の / を除いた assets/ 基準のパス） */
  assetExists?: (assetPath: string) => boolean;
  /** リポジトリ直下からの相対パスのファイルがあるか（参照音声など） */
  repoFileExists?: (repoPath: string) => boolean;
}

/** 視線の先に書けるキーワード（それ以外はキャラ ID） */
const LOOK_AT_KEYWORDS = new Set(['player', 'speaker', 'partner', 'camera', 'forward']);

const ISSUE = (severity: ProblemSeverity, path: (string | number)[], message: string): Issue => ({ severity, path: path.join('.'), message });

/** URL を assets/ 基準のパスにする。'/' で始まらなければシナリオのディレクトリからの相対。外部 URL は null */
export function assetPathOf(url: string, scenarioDir?: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;
  if (url.startsWith('/')) return url.slice(1);
  return scenarioDir ? `${scenarioDir}/${url}` : url;
}

/** 場所 ID ではなく画像などのパスとして書かれているか */
const looksLikePath = (value: string) => value.includes('/') || /\.[a-z0-9]+$/i.test(value);

class Checker {
  readonly issues: Issue[] = [];
  readonly catalog: Catalog;
  /** assets/ 基準のシナリオのディレクトリ（相対パスの基準） */
  readonly scenarioDir?: string;

  constructor(catalog: Catalog, scenarioDir?: string) {
    this.catalog = catalog;
    this.scenarioDir = scenarioDir;
  }

  error(path: (string | number)[], message: string) {
    this.issues.push(ISSUE('error', path, message));
  }

  warn(path: (string | number)[], message: string) {
    this.issues.push(ISSUE('warning', path, message));
  }

  file(path: (string | number)[], url: string | undefined, what: string) {
    if (url === undefined || !this.catalog.assetExists) return;
    const assetPath = assetPathOf(url, this.scenarioDir);
    if (assetPath !== null && !this.catalog.assetExists(assetPath)) this.error(path, `${what}のファイルがありません: ${url}（assets/${assetPath}）`);
  }

  character(path: (string | number)[], id: string | undefined) {
    const ids = this.catalog.characterIds;
    if (id === undefined || !ids || ids.has(id)) return;
    this.error(path, `キャラ "${id}" は characters.json にいません`);
  }

  location(path: (string | number)[], id: string | undefined) {
    const ids = this.catalog.locationIds;
    if (id === undefined || !ids || ids.has(id)) return;
    this.error(path, `場所 "${id}" は locations.json にありません`);
  }

  timeOfDay(path: (string | number)[], id: string | undefined) {
    const ids = this.catalog.timeOfDayIds;
    if (id === undefined || !ids || ids.has(id)) return;
    this.error(path, `時間帯 "${id}" は time-of-day.json にありません（${[...ids].join(' / ')}）`);
  }

  motion(path: (string | number)[], name: string | undefined) {
    if (name === undefined || !this.catalog.assetExists) return;
    if (!this.catalog.assetExists(`animations/${name}.fbx`)) this.error(path, `モーション "${name}" がありません（assets/animations/${name}.fbx）`);
  }

  /** 場所 ID または画像のパス */
  background(path: (string | number)[], value: string | undefined) {
    if (value === undefined) return;
    if (looksLikePath(value)) this.file(path, value, '背景');
    else this.location(path, value);
  }

  /** BGM の ID・URL・'silence' */
  bgm(path: (string | number)[], value: string | undefined) {
    if (value === undefined || value === 'silence') return;
    if (looksLikePath(value)) return this.file(path, value, 'BGM');
    const ids = this.catalog.bgmIds;
    if (ids && !ids.has(value)) this.error(path, `BGM "${value}" は bgm.json にありません`);
  }

  lookAt(path: (string | number)[], target: string | undefined) {
    if (target === undefined || LOOK_AT_KEYWORDS.has(target)) return;
    const ids = this.catalog.characterIds;
    if (ids && !ids.has(target)) {
      this.error(path, `視線の先 "${target}" はキーワード（${[...LOOK_AT_KEYWORDS].join(' / ')}）でもキャラ ID でもありません`);
    }
  }

  affinity(path: (string | number)[], map: Record<string, number> | undefined) {
    for (const id of Object.keys(map ?? {})) this.character([...path, id], id);
  }

  availability(path: (string | number)[], availability: ScenarioPackage['availability']) {
    if (!availability) return;
    availability.locations?.forEach((id, i) => this.location([...path, 'locations', i], id));
    this.affinity([...path, 'minAffinity'], availability.minAffinity);
    this.affinity([...path, 'maxAffinity'], availability.maxAffinity);
    const scenarios = this.catalog.scenarios;
    if (!scenarios) return;
    for (const group of ['all', 'any'] as const) {
      availability.after?.[group]?.forEach((prerequisite, i) => {
        const at = [...path, 'after', group, i];
        const target = scenarios.get(prerequisite.scenarioId);
        if (!target) return this.error([...at, 'scenarioId'], `先行シナリオ "${prerequisite.scenarioId}" がありません`);
        if (prerequisite.choiceId !== undefined && !choiceIdsOf(target.data).has(prerequisite.choiceId)) {
          this.error([...at, 'choiceId'], `シナリオ "${prerequisite.scenarioId}" に選択肢 "${prerequisite.choiceId}" がありません`);
        }
      });
    }
  }

  avatar(path: (string | number)[], key: string, config: SceneAvatarConfig) {
    this.character([...path, 'characterId'], config.characterId ?? key);
    this.file([...path, 'modelUrl'], config.modelUrl, 'モデル');
    this.motion([...path, 'motion'], config.motion);
    this.lookAt([...path, 'lookAtTarget'], config.lookAtTarget);
    config.transitions?.forEach((t, i) => {
      this.motion([...path, 'transitions', i, 'motion'], t.motion);
      this.lookAt([...path, 'transitions', i, 'lookAtTarget'], t.lookAtTarget);
    });
  }
}

/** 先行シナリオの choiceId から参照できる選択肢の ID（通常は id か goto 先、電話は choices の id、メールは返信の id） */
export function choiceIdsOf(data: unknown): Set<string> {
  const ids = new Set<string>();
  const d = data as Partial<ScenarioPackage & CallScenario & MailScenario>;
  for (const scene of d.scenes ?? []) for (const c of scene.choices ?? []) ids.add(c.id ?? c.goto);
  for (const step of Object.values(d.steps ?? {})) for (const c of step.choices ?? []) ids.add(c.id);
  for (const r of d.replyOptions ?? []) ids.add(r.id);
  return ids;
}

/** シーンの行き先（選択肢・時間切れ・次のシーン） */
function sceneTargets(scene: ScenarioScene, index: number, scenes: ScenarioScene[]): string[] {
  const targets = [...(scene.choices ?? []).map((c) => c.goto)];
  if (scene.choiceTimeout?.goto) targets.push(scene.choiceTimeout.goto);
  if (!scene.end) {
    if (scene.nextSceneId) targets.push(scene.nextSceneId);
    else if (index + 1 < scenes.length) targets.push(scenes[index + 1].id);
  }
  return targets;
}

function checkStory(c: Checker, data: ScenarioPackage) {
  c.location(['location'], data.location);
  c.timeOfDay(['timeOfDay'], data.timeOfDay);
  c.bgm(['bgm'], data.bgm);
  c.file(['ambience'], data.ambience, '環境音');
  c.availability(['availability'], data.availability);
  data.actionHints?.forEach((hint, i) => {
    c.location(['actionHints', i, 'locationId'], hint.locationId);
    hint.hintCharacterIds?.forEach((id, j) => c.character(['actionHints', i, 'hintCharacterIds', j], id));
  });
  data.characters?.forEach((ch, i) => {
    c.character(['characters', i, 'id'], ch.id);
    c.file(['characters', i, 'modelUrl'], ch.modelUrl, 'モデル');
  });

  const sceneIndex = new Map<string, number>();
  data.scenes.forEach((scene, i) => {
    if (sceneIndex.has(scene.id)) c.error(['scenes', i, 'id'], `シーン ID "${scene.id}" が重複しています（scenes.${sceneIndex.get(scene.id)} と同じ）`);
    else sceneIndex.set(scene.id, i);
  });
  const sceneRef = (path: (string | number)[], id: string | undefined) => {
    if (id !== undefined && !sceneIndex.has(id)) c.error(path, `シーン "${id}" がありません`);
  };

  const movie = data.playMode === 'movie';
  data.scenes.forEach((scene, i) => {
    const at = ['scenes', i];
    if (movie && scene.choices?.length) c.warn([...at, 'choices'], 'ムービーでは選択肢を出しません（時間切れの飛び先、なければ1番目へ進みます）');
    if (!movie && scene.duration !== undefined) c.warn([...at, 'duration'], 'duration はムービー（playMode: movie）でだけ使います');
    sceneRef([...at, 'nextSceneId'], scene.nextSceneId);
    sceneRef([...at, 'choiceTimeout', 'goto'], scene.choiceTimeout?.goto);
    scene.choices?.forEach((choice, j) => {
      sceneRef([...at, 'choices', j, 'goto'], choice.goto);
      c.affinity([...at, 'choices', j, 'addAffinity'], choice.addAffinity);
    });
    if (scene.speakerCharacterId !== undefined) c.character([...at, 'speakerCharacterId'], scene.speakerCharacterId);
    else if ((typeof scene.speaker === 'string' ? scene.speaker : scene.speaker?.ja)?.trim()) c.warn([...at, 'speakerCharacterId'], '話者（speaker）があるのに speakerCharacterId がありません');
    c.file([...at, 'voiceUrl'], scene.voiceUrl, 'ボイス');
    c.background([...at, 'background'], scene.background);
    c.bgm([...at, 'bgm'], scene.bgm);
    c.file([...at, 'bgmUrl'], scene.bgmUrl, 'BGM');
    c.file([...at, 'seUrl'], scene.seUrl, '効果音');
    if (typeof scene.ambience === 'string') c.file([...at, 'ambience'], scene.ambience, '環境音');
    c.timeOfDay([...at, 'timeOfDay'], scene.timeOfDay);
    if (scene.scrollingBackground) c.file([...at, 'scrollingBackground', 'textureUrl'], scene.scrollingBackground.textureUrl, '流れる背景');
    for (const [key, config] of Object.entries(scene.avatars ?? {})) c.avatar([...at, 'avatars', key], key, config);
  });

  // 先頭からたどり着けないシーン
  const reached = new Set<string>();
  const queue = [data.scenes[0].id];
  while (queue.length) {
    const id = queue.pop()!;
    const index = sceneIndex.get(id);
    if (index === undefined || reached.has(id)) continue;
    reached.add(id);
    queue.push(...sceneTargets(data.scenes[index], index, data.scenes));
  }
  data.scenes.forEach((scene, i) => {
    if (!reached.has(scene.id)) c.warn(['scenes', i], `シーン "${scene.id}" には先頭からたどり着けません`);
  });
}

function checkCall(c: Checker, data: CallScenario) {
  c.character(['characterId'], data.characterId);
  c.file(['modelUrl'], data.modelUrl, 'モデル');
  c.availability(['availability'], data.availability);
  const stepRef = (path: (string | number)[], id: string | null | undefined) => {
    if (id && !Object.hasOwn(data.steps, id)) c.error(path, `ステップ "${id}" がありません`);
  };
  stepRef(['initialStepId'], data.initialStepId);
  for (const [key, step] of Object.entries(data.steps)) {
    const at = ['steps', key];
    if (step.id !== key) c.error([...at, 'id'], `id はキー（${key}）と同じにしてください`);
    stepRef([...at, 'nextStepId'], step.nextStepId);
    step.choices?.forEach((choice, j) => {
      stepRef([...at, 'choices', j, 'goto'], choice.goto);
      c.affinity([...at, 'choices', j, 'addAffinity'], choice.addAffinity);
    });
    c.motion([...at, 'motion'], step.motion);
    c.file([...at, 'voiceUrl'], step.voiceUrl, 'ボイス');
  }
}

function checkMail(c: Checker, data: MailScenario) {
  c.character(['characterId'], data.characterId);
  c.availability(['availability'], data.availability);
  data.replyOptions?.forEach((r, i) => c.affinity(['replyOptions', i, 'addAffinity'], r.addAffinity));
}

/**
 * 1本のシナリオの参照チェック。data はスキーマの検証を通ったものを渡す
 */
export function checkScenarioReferences(category: ScenarioCategory, id: string, data: unknown, catalog: Catalog): Issue[] {
  const c = new Checker(catalog, `scenarios/${category}/${id}`);
  if (category === 'call') checkCall(c, data as CallScenario);
  else if (category === 'mail') checkMail(c, data as MailScenario);
  else checkStory(c, data as ScenarioPackage);
  return c.issues;
}

/**
 * シナリオ全体のフラグのつながり。条件に使っているのに、どのシナリオでも立てていないフラグを警告する
 * （app のゲーム側のコードで立てるフラグもありうるので警告にとどめる）
 */
export function checkFlagLinks(links: { file: string; links: ScenarioLinks }[]): Problem[] {
  const set = new Set(links.flatMap((l) => l.links.sets));
  const problems: Problem[] = [];
  for (const { file, links: l } of links) {
    for (const [kind, flags] of [['requireFlags', l.requires], ['unlessFlags', l.unless], ['condition', l.conditions]] as const) {
      for (const flag of flags) {
        if (!set.has(flag)) problems.push({ severity: 'warning', file, path: kind, message: `フラグ "${flag}" はどのシナリオでも立てていません` });
      }
    }
  }
  return problems;
}

/** Studio データ（assets/studio/<name>.json）の参照チェック。data はスキーマの検証を通ったものを渡す */
export function checkStudioDataReferences(name: string, data: unknown, catalog: Catalog): Issue[] {
  const c = new Checker(catalog);
  if (name === 'characters') {
    (data as CharacterBook).characters.forEach((ch, i) => {
      ch.models.forEach((m, j) => c.file(['characters', i, 'models', j, 'url'], m.url, 'モデル'));
      const ref = ch.voice?.ref;
      if (ref && catalog.repoFileExists && !catalog.repoFileExists(ref)) c.error(['characters', i, 'voice', 'ref'], `参照音声がありません: ${ref}`);
    });
  } else if (name === 'locations') {
    for (const [key, preset] of Object.entries((data as z.infer<typeof LocationFile>).presets)) {
      for (const layer of ['background', 'midground', 'nearground'] as const) {
        c.file(['presets', key, 'layers', layer, 'url'], preset.layers[layer]?.url, '背景画像');
      }
      const model = preset.environment?.model;
      if (model?.startsWith('builtin:')) {
        if (!Object.hasOwn(BUILTIN_ENVIRONMENTS, model)) {
          c.error(['presets', key, 'environment', 'model'], `組み込みの3D背景 "${model}" はありません（${Object.keys(BUILTIN_ENVIRONMENTS).join(' / ')}）`);
        }
      } else {
        c.file(['presets', key, 'environment', 'model'], model, '3D背景');
      }
    }
  } else if (name === 'bgm') {
    for (const [key, bgm] of Object.entries((data as BgmBook).bgm)) c.file(['bgm', key, 'url'], bgm.url, 'BGM');
  } else if (name === 'motions') {
    for (const key of Object.keys((data as MotionBook).motions)) c.motion(['motions', key], key);
  }
  return c.issues;
}
