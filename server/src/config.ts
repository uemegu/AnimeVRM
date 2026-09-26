import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { VoiceTools } from './tts/voiceTools.ts';

export interface ServerConfig {
  /** リポジトリ直下。音声の参照ファイルなど、リポジトリ相対のパスの基準 */
  repoRoot: string;
  /** 共有アセット（assets/） */
  assetsDir: string;
  /** 音声生成ジョブの作業場所（候補の音声を置く） */
  workDir: string;
  /** シナリオを保存したあとの処理（app の目次 scenarioIndex.json の作り直しなど） */
  onScenarioSaved: () => void | Promise<void>;
  /** 音声合成・後処理・mp3 変換（テストでは差し替える） */
  voiceTools: VoiceTools;
}

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const DEFAULT_PORT = 5190;
