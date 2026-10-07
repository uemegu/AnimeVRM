import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { CallScenario, ScenarioPackage } from '@anime-vrm/scenario';
import type { ServerConfig } from '../config.ts';
import { kindOf, type ScenarioStore } from '../scenarioStore.ts';
import { ScenarioCategory } from '@anime-vrm/scenario';
import { TtsJobQueue } from '../tts/ttsJobs.ts';
import { defaultCaption, findVoiceLine, loadVoiceProfiles, ttsText, voiceFileName } from '../tts/voiceLines.ts';

const MAX_CANDIDATES = 4;
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.wav'];

/** 拡張子と中身の先頭が合っているか（mp3 は ID3 タグかフレーム同期、ogg は OggS、wav は RIFF/WAVE） */
function isAudio(bytes: Buffer, ext: string): boolean {
  if (bytes.length < 12) return false;
  if (ext === '.mp3') return bytes.subarray(0, 3).toString('latin1') === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (ext === '.ogg') return bytes.subarray(0, 4).toString('latin1') === 'OggS';
  return bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WAVE';
}

/** 登録したボイスのファイル名。生成したもの（v_<lineId>_<hash>.mp3）と区別し、中身のハッシュを付ける */
function uploadedVoiceFileName(lineId: string, bytes: Buffer, ext: string): string {
  return `u_${lineId.replace(/[^A-Za-z0-9_-]/g, '_')}_${createHash('sha1').update(bytes).digest('hex').slice(0, 8)}${ext}`;
}

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

  /**
   * ボイスをシナリオのディレクトリへ置き、セリフの voiceUrl を書き換える（生成の採用・ファイルの登録で共通）。
   * 差し替えた古いボイスは、同じシナリオのどこからも使われていなければ消す
   */
  async function attachVoice(category: string, scenarioId: string, lineId: string, fileName: string, write: (file: string) => Promise<void>) {
    const scenario = await loadVoicedScenario(category, scenarioId);
    const dir = store.dirPath(category, scenarioId);
    if (!scenario || !dir) return { error: 'シナリオがありません' } as const;
    const target = 'steps' in scenario ? scenario.steps[lineId] : scenario.scenes.find((s) => s.id === lineId);
    if (!target) return { error: 'セリフがありません' } as const;
    const previous = target.voiceUrl;
    await write(path.join(dir, fileName));
    target.voiceUrl = fileName;
    await store.write(category, scenarioId, scenario);

    const used = new Set(('steps' in scenario ? Object.values(scenario.steps) : scenario.scenes).map((s) => s.voiceUrl));
    if (previous && previous !== fileName && !previous.startsWith('/') && !used.has(previous)) {
      await fs.rm(path.join(dir, previous), { force: true });
    }
    await config.onScenarioSaved(category as ScenarioCategory);
    return { voiceUrl: fileName } as const;
  }

  /** 候補を採用してシナリオのディレクトリへ置き、voiceUrl を書き換える */
  app.post('/jobs/:jobId/adopt', async (c) => {
    const job = queue.get(c.req.param('jobId'));
    const { index } = (await c.req.json().catch(() => ({}))) as { index?: number };
    const candidate = job && typeof index === 'number' ? queue.candidatePath(job, index) : null;
    if (!job || !candidate) return c.json({ error: '候補がありません' }, 404);
    const { category, scenarioId, lineId, speaker, text } = job.request;
    const result = await attachVoice(category, scenarioId, lineId, voiceFileName(lineId, speaker, text), (file) => fs.copyFile(candidate, file));
    if ('error' in result) return c.json({ error: result.error }, 404);
    return c.json({ ok: true, voiceUrl: result.voiceUrl });
  });

  /**
   * 手元の音声ファイルをセリフのボイスとして登録する（本文がファイルの中身。?ext=.mp3 などで形式を伝える）
   * 例: PUT /api/tts/lines/ending/ending_good/s1/upload?ext=.wav
   */
  app.put('/lines/:category/:id/:lineId/upload', bodyLimit({ maxSize: MAX_UPLOAD_BYTES }), async (c) => {
    const { category, id, lineId } = c.req.param();
    const ext = (c.req.query('ext') ?? '').toLowerCase();
    if (!AUDIO_EXTENSIONS.includes(ext)) return c.json({ error: `形式は ${AUDIO_EXTENSIONS.join(' / ')} のいずれかにしてください` }, 400);
    const bytes = Buffer.from(await c.req.arrayBuffer());
    if (!isAudio(bytes, ext)) return c.json({ error: '音声ファイルとして読めません' }, 400);
    const result = await attachVoice(category, id, lineId, uploadedVoiceFileName(lineId, bytes, ext), (file) => fs.writeFile(file, bytes));
    if ('error' in result) return c.json({ error: result.error }, 404);
    return c.json({ ok: true, voiceUrl: result.voiceUrl });
  });

  return app;
}
