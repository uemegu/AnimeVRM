/**
 * シナリオを分岐どおりに進める（Studio の再生と Pages の再生で使う。ゲームの進行は app 側にある）
 */
import type { ScenarioChoice, ScenarioPackage, ScenarioScene } from './schema.ts';
import { initialStageState, mergeStageState, type StageState } from './stage.ts';
import { availableChoices, matchesChoiceCondition } from './conditions.ts';

type FlagValue = boolean | number | string;

export class ScenarioRunner {
  readonly scenario: ScenarioPackage;
  private index = 0;
  private flags: Record<string, FlagValue> = {};
  private stageState: StageState;
  private done = false;

  constructor(scenario: ScenarioPackage) {
    this.scenario = scenario;
    this.stageState = initialStageState(scenario);
    this.enter(0);
  }

  get scene(): ScenarioScene {
    return this.scenario.scenes[this.index];
  }

  /** 先頭からたどった舞台（背景・登場キャラなど） */
  get stage(): StageState {
    return this.stageState;
  }

  get finished(): boolean {
    return this.done;
  }

  getFlags(): Record<string, FlagValue> {
    return { ...this.flags };
  }

  /** 今のシーンで選べる選択肢（条件に合うものだけ。好感度は持たないので、好感度の条件は満たしたものとして出す） */
  get choices(): ScenarioChoice[] {
    return availableChoices(this.scene.choices, { flags: this.flags }, this.scene.choiceFallback);
  }

  /** 次のシーンへ（選択肢を待っているときは進まない）。終わったら true */
  next(): boolean {
    if (this.done || this.choices.length > 0) return this.done;
    const scene = this.scene;
    if (scene.end) return this.finish();
    if (scene.nextSceneId) return this.goTo(scene.nextSceneId);
    if (this.index + 1 >= this.scenario.scenes.length) return this.finish();
    this.enter(this.index + 1);
    return false;
  }

  /** 選択肢を選ぶ（choices の番号） */
  choose(choiceIndex: number): boolean {
    const choice = this.choices[choiceIndex];
    if (!choice || this.done) return this.done;
    Object.assign(this.flags, choice.setFlags);
    return this.goTo(choice.goto);
  }

  /** 選択肢の時間切れ（指定がなければ1番目を選ぶ） */
  timeout(): boolean {
    const timeout = this.scene.choiceTimeout;
    if (timeout?.goto) {
      Object.assign(this.flags, timeout.setFlags);
      return this.goTo(timeout.goto);
    }
    return this.choose(0);
  }

  private goTo(sceneId: string): boolean {
    const target = this.scenario.scenes.findIndex((s) => s.id === sceneId);
    if (target === -1) return this.finish();
    this.enter(target);
    return false;
  }

  private enter(index: number): void {
    // 条件を満たさないシーンは飛ばす（好感度は持たないので、フラグの条件だけで決まる）
    for (let guard = 0; guard < this.scenario.scenes.length; guard++) {
      const scene = this.scenario.scenes[index];
      if (!scene?.condition || matchesChoiceCondition(scene.condition, { flags: this.flags })) break;
      const next = scene.end ? -1 : scene.nextSceneId ? this.scenario.scenes.findIndex((s) => s.id === scene.nextSceneId) : index + 1;
      if (next < 0 || next >= this.scenario.scenes.length) {
        this.finish();
        return;
      }
      index = next;
    }
    this.index = index;
    const scene = this.scenario.scenes[index];
    Object.assign(this.flags, scene.setFlags);
    this.stageState = mergeStageState(this.stageState, scene);
  }

  private finish(): boolean {
    this.done = true;
    return true;
  }
}
