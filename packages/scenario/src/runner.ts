/**
 * シナリオを分岐どおりに進める（Studio の再生と Pages の再生で使う。ゲームの進行は app 側にある）
 */
import type { ScenarioChoice, ScenarioPackage, ScenarioScene } from './schema.ts';
import { initialStageState, mergeStageState, type StageState } from './stage.ts';

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

  /** 今のシーンで選べる選択肢（条件に合うものだけ） */
  get choices(): ScenarioChoice[] {
    return (this.scene.choices ?? []).filter((c) => !c.condition || this.flags[c.condition.flag] === c.condition.value);
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
