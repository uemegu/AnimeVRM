/**
 * シナリオ静的検証バリデータ
 * シナリオファイル内のID重複、壊れたリンク、ルール違反を画面なしで検出
 */

import { ScenarioPackage } from '../../types/scenario';

export interface ValidationIssue {
  type: 'error' | 'warning';
  sceneId?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export function validateScenario(scenario: ScenarioPackage): ValidationResult {
  const issues: ValidationIssue[] = [];
  const sceneIds = new Set<string>();

  // 1. シーンIDの一意性チェック
  for (const scene of scenario.scenes) {
    if (sceneIds.has(scene.id)) {
      issues.push({
        type: 'error',
        sceneId: scene.id,
        message: `重複するシーンIDが検出されました: "${scene.id}"`,
      });
    }
    sceneIds.add(scene.id);
  }

  // 2. 参照リンク先（nextSceneId / choices.goto）の整合性チェック
  for (const scene of scenario.scenes) {
    if (scene.nextSceneId && !sceneIds.has(scene.nextSceneId)) {
      issues.push({
        type: 'error',
        sceneId: scene.id,
        message: `nextSceneId で指定されたシーンが見つかりません: "${scene.nextSceneId}"`,
      });
    }

    if (scene.choices && scene.choices.length > 0) {
      // 選択肢があるシーンのセリフ空文字ルールチェック (GEMINI.md シナリオ設計規則)
      const rawText = typeof scene.text === 'string' ? scene.text : scene.text?.ja;
      if (rawText && rawText.trim().length > 0) {
        issues.push({
          type: 'warning',
          sceneId: scene.id,
          message: `選択肢を持つシーンでは本文(text)を空にすることが推奨されます: "${rawText}"`,
        });
      }

      for (const choice of scene.choices) {
        if (!sceneIds.has(choice.goto)) {
          issues.push({
            type: 'error',
            sceneId: scene.id,
            message: `選択肢の遷移先(goto)シーンが見つかりません: "${choice.goto}"`,
          });
        }
      }
    }
  }

  const errors = issues.filter((i) => i.type === 'error');
  const warnings = issues.filter((i) => i.type === 'warning');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
