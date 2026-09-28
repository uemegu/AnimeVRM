import path from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { DEFAULT_PORT, REPO_ROOT } from './config.ts';
import { createVoiceTools } from './tts/voiceTools.ts';
import { ensureVrmThumbnails } from './vrmThumbnail.ts';
// app のシナリオ目次（scenarioIndex.json）を、シナリオ保存のたびに作り直す
import { generateScenarioIndex } from '../../app/scripts/generate-scenario-index.js';

const port = Number(process.env.STUDIO_SERVER_PORT ?? DEFAULT_PORT);
const irodoriRoot = process.env.IRODORI_TTS_ROOT ?? '/Users/ueda/git/practice/tts/Irodori-TTS';
const assetsDir = path.join(REPO_ROOT, 'assets');

// 未作成のサムネイルがあれば抽出しておく（既存のものはスキップ）
await ensureVrmThumbnails(assetsDir);

const app = createApp({
  repoRoot: REPO_ROOT,
  assetsDir,
  workDir: path.join(REPO_ROOT, 'scratch', 'studio-tts'),
  onScenarioSaved: () => {
    generateScenarioIndex();
  },
  voiceTools: createVoiceTools({
    python: process.env.IRODORI_TTS_PYTHON ?? path.join(irodoriRoot, '.venv', 'bin', 'python'),
    synthesizeScript: path.join(REPO_ROOT, '.agents', 'skills', 'irodori-tts', 'scripts', 'synthesize.py'),
    effectsScript: path.join(REPO_ROOT, 'server', 'python', 'voice_effects.py'),
    ffmpeg: process.env.FFMPEG ?? 'ffmpeg',
    device: process.env.IRODORI_TTS_DEVICE ?? 'mps',
  }),
});

// localhost だけで待ち受ける（認証がないので外部からは使わせない）
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`Studio server: http://127.0.0.1:${info.port}/api/health`);
});
