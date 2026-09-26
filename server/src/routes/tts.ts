import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import type { CallScenario, ScenarioPackage } from '@anime-vrm/scenario';
import type { ServerConfig } from '../config.ts';
import { kindOf, type ScenarioStore } from '../scenarioStore.ts';
import { ScenarioCategory } from '@anime-vrm/scenario';
import { TtsJobQueue } from '../tts/ttsJobs.ts';
import { defaultCaption, findVoiceLine, loadVoiceProfiles, ttsText, voiceFileName } from '../tts/voiceLines.ts';

const MAX_CANDIDATES = 4;

/**
 * 音声生成。セリフごとに候補を作り（ジョブ）、試聴して1つを採用するとシナリオの voiceUrl に結びつく
 */
export function ttsRoutes(config: ServerConfig, store: ScenarioStore) {
  const app = new Hono();
  const queue = new TtsJobQueue(config.workDir, config.voiceTools, ttsText);

  /** 通常シナリオと電話だけが対象（メールは音声なし） */
  async function loadVoicedScenario(category: string, id: string) {
    const parsed = ScenarioCategory.safeParse(category);
    if (!parsed.success || kindOf(parsed.data) === 'mail') return null;
    return (await store.read(category, id)) as ScenarioPackage | CallScenario | null;
  }

  /** セリフから決まる既定の話者・声の説明（Studio の入力欄の初期値） */
  app.get('/lines/:category/:id/:lineId', async (c) => {
    const { category, id, lineId } = c.req.param();
    const scenario = await loadVoicedScenario(category, id);
    if (!scenario) return c.json({ error: 'シナリオがありません' }, 404);
    const profiles = await loadVoiceProfiles(config.assetsDir);
    const line = findVoiceLine(scenario, lineId, profiles);
    if (!line) return c.json({ error: 'セリフがありません' }, 404);
    return c.json({ ...line, caption: defaultCaption(line, profiles) });
  });

  app.post('/jobs', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      category?: string;
      id?: string;
      lineId?: string;
      speaker?: string;
      caption?: string;
      candidates?: number;
    };
    const { category = '', id = '', lineId = '' } = body;
    const scenario = await loadVoicedScenario(category, id);
    if (!scenario) return c.json({ error: 'シナリオがありません' }, 404);
    const profiles = await loadVoiceProfiles(config.assetsDir);
    const line = findVoiceLine(scenario, lineId, profiles);
    if (!line) return c.json({ error: 'セリフがありません' }, 404);
    if (!line.text.trim()) return c.json({ error: '本文が空のセリフです' }, 400);
    const speaker = body.speaker ?? line.speaker;
    const profile = speaker ? profiles.speakers[speaker] : undefined;
    if (!speaker || !profile) return c.json({ error: '話者が決まりません（speaker を指定してください）' }, 400);
    const refWav = path.resolve(config.repoRoot, profile.ref);
    if (!(await fs.stat(refWav).then(() => true, () => false))) {
      return c.json({ error: `参照音声がありません: ${profile.ref}` }, 400);
    }
    const candidates = Math.min(MAX_CANDIDATES, Math.max(1, Math.floor(body.candidates ?? 1)));
    const job = queue.enqueue({
      category,
      scenarioId: id,
      lineId,
      speaker,
      text: line.text,
      caption: body.caption ?? defaultCaption({ ...line, speaker }, profiles),
      refWav,
      postprocess: profile.postprocess,
      candidates,
    });
    return c.json(job, 202);
  });

  app.get('/jobs/:jobId', (c) => {
    const job = queue.get(c.req.param('jobId'));
    return job ? c.json(job) : c.json({ error: 'ジョブがありません' }, 404);
  });

  app.get('/jobs/:jobId/candidates/:index', async (c) => {
    const job = queue.get(c.req.param('jobId'));
    const file = job && queue.candidatePath(job, Number(c.req.param('index')));
    if (!file) return c.json({ error: '候補がありません' }, 404);
    return c.body(await fs.readFile(file), 200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
  });

  /** 候補を採用してシナリオのディレクトリへ置き、voiceUrl を書き換える */
  app.post('/jobs/:jobId/adopt', async (c) => {
    const job = queue.get(c.req.param('jobId'));
    const { index } = (await c.req.json().catch(() => ({}))) as { index?: number };
    const candidate = job && typeof index === 'number' ? queue.candidatePath(job, index) : null;
    if (!job || !candidate) return c.json({ error: '候補がありません' }, 404);
    const { category, scenarioId, lineId, speaker, text } = job.request;
    const scenario = await loadVoicedScenario(category, scenarioId);
    const dir = store.dirPath(category, scenarioId);
    if (!scenario || !dir) return c.json({ error: 'シナリオがありません' }, 404);

    const target = 'steps' in scenario ? scenario.steps[lineId] : scenario.scenes.find((s) => s.id === lineId);
    if (!target) return c.json({ error: 'セリフがありません' }, 404);
    const fileName = voiceFileName(lineId, speaker, text);
    const previous = target.voiceUrl;
    await fs.copyFile(candidate, path.join(dir, fileName));
    target.voiceUrl = fileName;
    await store.write(category, scenarioId, scenario);

    // 差し替えた古いボイスは、同じシナリオのどこからも使われていなければ消す
    const used = new Set(('steps' in scenario ? Object.values(scenario.steps) : scenario.scenes).map((s) => s.voiceUrl));
    if (previous && previous !== fileName && !previous.startsWith('/') && !used.has(previous)) {
      await fs.rm(path.join(dir, previous), { force: true });
    }
    await config.onScenarioSaved();
    return c.json({ ok: true, voiceUrl: fileName });
  });

  return app;
}
