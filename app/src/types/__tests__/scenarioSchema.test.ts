import { describe, expectTypeOf, it } from 'vitest';
import type * as Schema from '@anime-vrm/scenario';
import type {
  AvatarTransition,
  ScenarioChoice,
  ScenarioPackage,
  ScenarioScene,
  SceneAvatarConfig,
  SceneTransition,
} from '../scenario';
import type { CallScenario, MailScenario } from '../communication';

// アプリの型と共有スキーマ（packages/scenario）がずれていないこと。
// 型が合わない・アプリにだけ項目がある場合は tsc --noEmit で失敗する。
describe('アプリのシナリオ型と共有スキーマ', () => {
  it('アプリの型で書けるシナリオはスキーマでも正しいこと', () => {
    expectTypeOf<ScenarioPackage>().toExtend<Schema.ScenarioPackage>();
    expectTypeOf<CallScenario>().toExtend<Schema.CallScenario>();
    expectTypeOf<MailScenario>().toExtend<Schema.MailScenario>();
  });

  it('アプリの型の項目がすべてスキーマにあること', () => {
    expectTypeOf<keyof ScenarioPackage>().toExtend<keyof Schema.ScenarioPackage>();
    expectTypeOf<keyof ScenarioScene>().toExtend<keyof Schema.ScenarioScene>();
    expectTypeOf<keyof SceneAvatarConfig>().toExtend<keyof Schema.SceneAvatarConfig>();
    expectTypeOf<keyof AvatarTransition>().toExtend<keyof Schema.AvatarTransition>();
    expectTypeOf<keyof SceneTransition>().toExtend<keyof Schema.SceneTransition>();
    expectTypeOf<keyof ScenarioChoice>().toExtend<keyof Schema.ScenarioChoice>();
    expectTypeOf<keyof CallScenario>().toExtend<keyof Schema.CallScenario>();
    expectTypeOf<keyof MailScenario>().toExtend<keyof Schema.MailScenario>();
  });
});
