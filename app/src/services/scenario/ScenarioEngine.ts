/**
 * Headless シナリオエンジン
 * 画面・DOM・Three.jsに一切依存しない純粋ステートマシン
 */

import {
  ScenarioPackage,
  ScenarioScene,
  ScenarioChoice,
  SupportedLanguage,
  resolveLocalizedText,
  SceneAvatarConfig,
} from '../../types/scenario';

/** 画面描画用に言語解決済みのシーン情報 */
export interface ScenarioResolvedScene {
  id: string;
  speaker: string;
  speakerCharacterId?: string;
  text: string;
  voiceUrl?: string;
  background?: string;
  bgmUrl?: string;
  seUrl?: string;
  avatars?: Record<string, SceneAvatarConfig>;
  choices?: Array<{
    text: string;
    goto: string;
    index: number;
  }>;
}

export class ScenarioEngine {
  private package: ScenarioPackage;
  private sceneIndex: number = 0;
  private flags: Record<string, boolean | number | string> = {};
  private affinities: Record<string, number> = {};
  private language: SupportedLanguage = 'ja';
  private finished: boolean = false;

  constructor(
    scenarioPackage: ScenarioPackage,
    initialFlags: Record<string, boolean | number | string> = {},
    initialAffinities: Record<string, number> = {},
    language: SupportedLanguage = 'ja'
  ) {
    this.package = scenarioPackage;
    this.flags = { ...initialFlags };
    this.affinities = { ...initialAffinities };
    this.language = language;
    this.applyCurrentSceneEffects();
  }

  /** 言語切り替え */
  public setLanguage(language: SupportedLanguage): void {
    this.language = language;
  }

  public getLanguage(): SupportedLanguage {
    return this.language;
  }

  /** 現在のシーンオブジェクトを取得 */
  public getRawScene(): ScenarioScene | null {
    if (this.finished || this.sceneIndex >= this.package.scenes.length) {
      return null;
    }
    return this.package.scenes[this.sceneIndex];
  }

  /** 画面描画用に解決済みのシーン情報を取得 */
  public getCurrentScene(): ScenarioResolvedScene | null {
    const raw = this.getRawScene();
    if (!raw) return null;

    const availableChoices = this.getAvailableChoices();
    const resolvedChoices = availableChoices.map((c, i) => ({
      text: resolveLocalizedText(c.text, this.language),
      goto: c.goto,
      index: i,
    }));

    return {
      id: raw.id,
      speaker: resolveLocalizedText(raw.speaker, this.language),
      speakerCharacterId: raw.speakerCharacterId,
      text: resolveLocalizedText(raw.text, this.language),
      voiceUrl: raw.voiceUrl,
      background: raw.background,
      bgmUrl: raw.bgmUrl,
      seUrl: raw.seUrl,
      avatars: raw.avatars,
      choices: resolvedChoices.length > 0 ? resolvedChoices : undefined,
    };
  }

  /** 現在選択肢待ち状態かどうか */
  public isWaitingForChoice(): boolean {
    const raw = this.getRawScene();
    if (!raw || !raw.choices || raw.choices.length === 0) {
      return false;
    }
    return this.getAvailableChoices().length > 0;
  }

  /** 現在のフラグ状態に応じた有効な選択肢を取得 */
  public getAvailableChoices(): ScenarioChoice[] {
    const raw = this.getRawScene();
    if (!raw || !raw.choices) return [];

    return raw.choices.filter((choice) => {
      if (!choice.condition) return true;
      const actual = this.flags[choice.condition.flag];
      return actual === choice.condition.value;
    });
  }

  /**
   * テキスト送り（次シーンへの進行）
   * @returns 完了した場合は true
   */
  public next(): boolean {
    if (this.finished) return true;

    // 選択肢待ちの場合は next() 進行不可
    if (this.isWaitingForChoice()) {
      return false;
    }

    const current = this.getRawScene();
    if (!current) {
      this.finished = true;
      return true;
    }

    // 明示的な nextSceneId がある場合はそのIDのシーンへジャンプ
    if (current.nextSceneId) {
      const targetIndex = this.package.scenes.findIndex((s) => s.id === current.nextSceneId);
      if (targetIndex !== -1) {
        this.sceneIndex = targetIndex;
        this.applyCurrentSceneEffects();
        return false;
      }
    }

    // 通常の次インデックスへ
    this.sceneIndex++;
    if (this.sceneIndex >= this.package.scenes.length) {
      this.finished = true;
      return true;
    }

    this.applyCurrentSceneEffects();
    return false;
  }

  /**
   * 選択肢の選択
   * @param choiceIndex getAvailableChoices() のインデックス
   */
  public choose(choiceIndex: number): boolean {
    if (this.finished) return false;

    const available = this.getAvailableChoices();
    if (choiceIndex < 0 || choiceIndex >= available.length) {
      throw new Error(`Invalid choice index: ${choiceIndex}`);
    }

    const selected = available[choiceIndex];

    // フラグ更新
    if (selected.setFlags) {
      Object.assign(this.flags, selected.setFlags);
    }

    // 好感度加算
    if (selected.addAffinity) {
      for (const [charId, add] of Object.entries(selected.addAffinity)) {
        this.affinities[charId] = (this.affinities[charId] || 0) + add;
      }
    }

    // goto で指定されたシーンへジャンプ
    const targetIndex = this.package.scenes.findIndex((s) => s.id === selected.goto);
    if (targetIndex === -1) {
      throw new Error(`Choice goto target scene not found: ${selected.goto}`);
    }

    this.sceneIndex = targetIndex;
    this.applyCurrentSceneEffects();
    return true;
  }

  /** シーン突入時のフラグ更新などの副作用を適用 */
  private applyCurrentSceneEffects(): void {
    const scene = this.getRawScene();
    if (!scene) return;

    if (scene.setFlags) {
      Object.assign(this.flags, scene.setFlags);
    }
  }

  public isFinished(): boolean {
    return this.finished;
  }

  public getFlags(): Record<string, boolean | number | string> {
    return { ...this.flags };
  }

  public getAffinities(): Record<string, number> {
    return { ...this.affinities };
  }

  public getSceneIndex(): number {
    return this.sceneIndex;
  }
}
