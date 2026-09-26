import type { ScenarioPackage, ScenarioScene, TextContent } from '@anime-vrm/scenario';

/** 日本語の本文（多言語指定なら ja） */
export function textJa(text: TextContent | undefined): string {
  if (!text) return '';
  return typeof text === 'string' ? text : text.ja;
}

export function textEn(text: TextContent | undefined): string {
  return text && typeof text !== 'string' ? (text.en ?? '') : '';
}

/** 英語が空なら素の文字列、あれば多言語の形にする（元の書き方をなるべく保つ） */
export function makeText(ja: string, en: string): TextContent {
  return en ? { ja, en } : ja;
}

/** 使われていないシーン ID（s1, s2, ...） */
export function newSceneId(scenes: ScenarioScene[]): string {
  const used = new Set(scenes.map((s) => s.id));
  for (let n = scenes.length + 1; ; n++) {
    if (!used.has(`s${n}`)) return `s${n}`;
  }
}

/** index の後ろに新しいカットを入れる */
export function insertScene(scenario: ScenarioPackage, index: number, scene?: Partial<ScenarioScene>): { scenario: ScenarioPackage; id: string } {
  const id = newSceneId(scenario.scenes);
  const scenes = [...scenario.scenes];
  scenes.splice(index + 1, 0, { ...scene, id, text: scene?.text ?? '' });
  return { scenario: { ...scenario, scenes }, id };
}

export function duplicateScene(scenario: ScenarioPackage, index: number): { scenario: ScenarioPackage; id: string } {
  const { id: _old, ...rest } = structuredClone(scenario.scenes[index]);
  return insertScene(scenario, index, rest);
}

export function removeScene(scenario: ScenarioPackage, index: number): ScenarioPackage {
  return { ...scenario, scenes: scenario.scenes.filter((_, i) => i !== index) };
}

export function moveScene(scenario: ScenarioPackage, index: number, delta: -1 | 1): ScenarioPackage {
  const target = index + delta;
  if (target < 0 || target >= scenario.scenes.length) return scenario;
  const scenes = [...scenario.scenes];
  [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
  return { ...scenario, scenes };
}

export function replaceScene(scenario: ScenarioPackage, index: number, scene: ScenarioScene): ScenarioPackage {
  return { ...scenario, scenes: scenario.scenes.map((s, i) => (i === index ? scene : s)) };
}

/** このシーンへ飛んでくる箇所（次のシーン指定・選択肢・時間切れ） */
export function referencesTo(scenario: ScenarioPackage, sceneId: string): string[] {
  return scenario.scenes.flatMap((scene) => [
    ...(scene.nextSceneId === sceneId ? [scene.id] : []),
    ...(scene.choices ?? []).filter((c) => c.goto === sceneId).map(() => scene.id),
    ...(scene.choiceTimeout?.goto === sceneId ? [scene.id] : []),
  ]);
}

export type CutWarning = 'choiceWithText' | 'brokenLink' | 'speakerWithoutId' | 'duplicateId';

/** 開発ルールや参照切れなど、保存前に気づきたい問題 */
export function cutWarnings(scenario: ScenarioPackage, index: number): CutWarning[] {
  const scene = scenario.scenes[index];
  const ids = new Set(scenario.scenes.map((s) => s.id));
  const warnings: CutWarning[] = [];
  // 選択肢のあるシーンではセリフを出さない（開発ルール）
  if (scene.choices?.length && textJa(scene.text).trim()) warnings.push('choiceWithText');
  const links = [scene.nextSceneId, scene.choiceTimeout?.goto, ...(scene.choices ?? []).map((c) => c.goto)].filter((l): l is string => !!l);
  if (links.some((l) => !ids.has(l))) warnings.push('brokenLink');
  if (textJa(scene.speaker).trim() && !scene.speakerCharacterId) warnings.push('speakerWithoutId');
  if (scenario.scenes.filter((s) => s.id === scene.id).length > 1) warnings.push('duplicateId');
  return warnings;
}
