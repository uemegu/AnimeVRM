import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.ts';
import { REPO_ROOT } from '../src/config.ts';
import type { VoiceTools } from '../src/tts/voiceTools.ts';
import { voiceFileName } from '../src/tts/voiceLines.ts';

const REAL_ASSETS = path.join(REPO_ROOT, 'assets');

let root: string;
let assetsDir: string;
let onScenarioSaved: ReturnType<typeof vi.fn<() => void>>;
let app: ReturnType<typeof createApp>;

/** 合成せず、出力先に中身の決まったファイルを書くだけの偽物 */
const fakeVoiceTools: VoiceTools = {
  async synthesize(batchJsonPath) {
    const items = JSON.parse(await fs.readFile(batchJsonPath, 'utf8')) as Array<{ id: string; output: string }>;
    for (const item of items) await fs.writeFile(item.output, `wav:${item.id}`);
  },
  async postprocess(effect, src, dst) {
    await fs.writeFile(dst, `${effect}:${await fs.readFile(src, 'utf8')}`);
  },
  async toMp3(src, dst) {
    await fs.writeFile(dst, `mp3:${await fs.readFile(src, 'utf8')}`);
  },
};

// テストでは応答の JSON を any として扱う
async function json(res: Response | Promise<Response>): Promise<any> {
  return (await res).json();
}

function request(url: string, init: RequestInit = {}) {
  return app.request(url, { ...init, headers: { host: 'localhost:5190', ...init.headers } });
}

function putJson(url: string, body: unknown) {
  return request(url, { method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
}

async function copyScenario(category: string, id: string) {
  await fs.cp(path.join(REAL_ASSETS, 'scenarios', category, id), path.join(assetsDir, 'scenarios', category, id), { recursive: true });
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-server-'));
  assetsDir = path.join(root, 'assets');
  await copyScenario('ending', 'ending_good');
  await copyScenario('call', 'aoi_call_d14');
  await fs.mkdir(path.join(assetsDir, 'studio'), { recursive: true });
  await fs.copyFile(path.join(REAL_ASSETS, 'studio', 'voice-profiles.json'), path.join(assetsDir, 'studio', 'voice-profiles.json'));
  // 参照音声はパスが存在すればよい
  await fs.mkdir(path.join(root, 'assets', 'voices'), { recursive: true });
  await fs.writeFile(path.join(root, 'assets', 'voices', '001.mp3'), 'ref');
  onScenarioSaved = vi.fn<() => void>();
  app = createApp({ repoRoot: root, assetsDir, workDir: path.join(root, 'work'), onScenarioSaved, voiceTools: fakeVoiceTools });
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('アクセス制限', () => {
  it('localhost 以外の Host を拒否する', async () => {
    const res = await app.request('/api/health', { headers: { host: 'evil.example.com' } });
    expect(res.status).toBe(403);
  });

  it('他のサイトからの書き込みを拒否する', async () => {
    const res = await request('/api/studio-data/x', { method: 'PUT', body: '{}', headers: { origin: 'https://evil.example.com' } });
    expect(res.status).toBe(403);
  });

  it('localhost からは使える', async () => {
    expect((await request('/api/health')).status).toBe(200);
  });
});

describe('シナリオ', () => {
  it('一覧を返す', async () => {
    const list = await json(request('/api/scenarios'));
    expect(list.map((s: { category: string; id: string }) => `${s.category}/${s.id}`)).toEqual(['ending/ending_good', 'call/aoi_call_d14']);
    expect(list[0]).toMatchObject({ kind: 'story', title: 'GOOD END: 穏やかな幼馴染の約束' });
  });

  it('読み込み・存在しない・不正な ID', async () => {
    expect((await request('/api/scenarios/ending/ending_good')).status).toBe(200);
    expect((await request('/api/scenarios/ending/nothing')).status).toBe(404);
    expect((await request('/api/scenarios/unknown/ending_good')).status).toBe(400);
    expect((await request('/api/scenarios/ending/..%2F..%2Fstudio')).status).toBe(400);
  });

  it('保存するとファイルが変わり、保存後の処理が呼ばれる', async () => {
    const data = await json(request('/api/scenarios/ending/ending_good'));
    data.scenes[0].text = '書き換えたセリフ';
    const res = await putJson('/api/scenarios/ending/ending_good', data);
    expect(res.status).toBe(200);
    const saved = JSON.parse(await fs.readFile(path.join(assetsDir, 'scenarios/ending/ending_good/scenario.json'), 'utf8'));
    expect(saved.scenes[0].text).toBe('書き換えたセリフ');
    expect(onScenarioSaved).toHaveBeenCalledTimes(1);
  });

  it('新しいシナリオを作れる', async () => {
    const res = await putJson('/api/scenarios/action/new_one', { id: 'new_one', title: '新規', scenes: [{ id: 's1', text: 'はじめ' }] });
    expect(res.status).toBe(200);
    expect((await request('/api/scenarios/action/new_one')).status).toBe(200);
  });

  it('スキーマに合わなければ保存せず、問題の場所を返す', async () => {
    const file = path.join(assetsDir, 'scenarios/ending/ending_good/scenario.json');
    const before = await fs.readFile(file, 'utf8');
    const data = JSON.parse(before);
    data.scenes[0].expresion = 'happy';
    const res = await putJson('/api/scenarios/ending/ending_good', data);
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.issues[0].path).toBe('scenes.0');
    expect(await fs.readFile(file, 'utf8')).toBe(before);
    expect(onScenarioSaved).not.toHaveBeenCalled();
  });

  it('id がディレクトリ名と違えば保存しない', async () => {
    const data = await json(request('/api/scenarios/ending/ending_good'));
    const res = await putJson('/api/scenarios/ending/ending_good', { ...data, id: 'other' });
    expect(res.status).toBe(400);
  });
});

describe('アセット', () => {
  it('アップロード・重複・上書き・一覧', async () => {
    const url = '/api/assets/animations/ardy/wave.fbx';
    expect((await request(url, { method: 'PUT', body: 'fbx1' })).status).toBe(201);
    expect((await request(url, { method: 'PUT', body: 'fbx2' })).status).toBe(409);
    expect((await request(url + '?overwrite=1', { method: 'PUT', body: 'fbx2' })).status).toBe(200);
    expect(await fs.readFile(path.join(assetsDir, 'animations/ardy/wave.fbx'), 'utf8')).toBe('fbx2');
    const list = await json(request('/api/assets/animations'));
    expect(list.map((a: { url: string }) => a.url)).toEqual(['/animations/ardy/wave.fbx']);
  });

  it('外へ出るパス・違う拡張子・未知の種類を拒否する', async () => {
    expect((await request('/api/assets/animations/..%2F..%2Fx.fbx', { method: 'PUT', body: 'x' })).status).toBe(400);
    // ../ は URL の正規化で先に解決され、API の外（404）になる
    expect((await request('/api/assets/animations/sub/../../x.fbx', { method: 'PUT', body: 'x' })).status).toBe(404);
    expect((await request('/api/assets/animations/x.exe', { method: 'PUT', body: 'x' })).status).toBe(400);
    expect((await request('/api/assets/secrets/x.fbx', { method: 'PUT', body: 'x' })).status).toBe(404);
    // どれも assets の外にも中にもファイルを作っていない
    expect(await fs.readdir(root)).toEqual(['assets']);
    await expect(fs.stat(path.join(assetsDir, 'animations'))).rejects.toThrow();
  });
});

describe('Studio 用 JSON', () => {
  it('保存して読める。不正な名前は拒否する', async () => {
    expect((await putJson('/api/studio-data/scenes', { a: 1 })).status).toBe(200);
    expect(await json(request('/api/studio-data/scenes'))).toEqual({ a: 1 });
    expect(await json(request('/api/studio-data'))).toEqual(['scenes', 'voice-profiles']);
    expect((await putJson('/api/studio-data/..%2Fx', {})).status).toBe(400);
  });
});

describe('音声生成', () => {
  it('ファイル名のハッシュが既存のボイスと同じ規則であること', () => {
    // assets/scenarios/ending/ending_good の s1（scenario-voices.py で作ったもの）
    expect(voiceFileName('s1', 'aoi', '……ふふ。びっくりした。でも、嬉しい。')).toBe('v_s1_1bf07a6e.mp3');
  });

  it('セリフから話者と声の説明を決める', async () => {
    const line = await json(request('/api/tts/lines/ending/ending_good/s1'));
    expect(line).toMatchObject({ speaker: 'aoi', expression: 'happy' });
    expect(line.caption).toContain('幼馴染');
  });

  it('候補を作って1つを採用すると、ファイルが置かれ voiceUrl が変わる', async () => {
    const dir = path.join(assetsDir, 'scenarios/ending/ending_good');
    const scenarioFile = path.join(dir, 'scenario.json');
    const scenario = JSON.parse(await fs.readFile(scenarioFile, 'utf8'));
    scenario.scenes[0].text = '新しいセリフ！';
    await fs.writeFile(scenarioFile, JSON.stringify(scenario, null, 2));
    const oldVoice = scenario.scenes[0].voiceUrl as string;

    const created = await request('/api/tts/jobs', {
      method: 'POST',
      body: JSON.stringify({ category: 'ending', id: 'ending_good', lineId: 's1', candidates: 2 }),
    });
    expect(created.status).toBe(202);
    const { id: jobId } = await json(created);

    let job;
    for (let i = 0; i < 50; i++) {
      job = await json(request(`/api/tts/jobs/${jobId}`));
      if (job.status === 'done' || job.status === 'error') break;
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(job.status).toBe('done');
    expect(job.candidates).toEqual([0, 1]);
    expect(await (await request(`/api/tts/jobs/${jobId}/candidates/1`)).text()).toBe('mp3:wav:cand_1');

    const adopted = await request(`/api/tts/jobs/${jobId}/adopt`, { method: 'POST', body: JSON.stringify({ index: 1 }) });
    expect(adopted.status).toBe(200);
    const { voiceUrl } = await json(adopted);
    expect(voiceUrl).toBe(voiceFileName('s1', 'aoi', '新しいセリフ！'));
    expect(await fs.readFile(path.join(dir, voiceUrl), 'utf8')).toBe('mp3:wav:cand_1');
    expect(JSON.parse(await fs.readFile(scenarioFile, 'utf8')).scenes[0].voiceUrl).toBe(voiceUrl);
    // 使われなくなった古いボイスは消える
    await expect(fs.stat(path.join(dir, oldVoice))).rejects.toThrow();
    expect(onScenarioSaved).toHaveBeenCalled();
  });

  it('話者が決まらないセリフは断る', async () => {
    const res = await request('/api/tts/jobs', {
      method: 'POST',
      body: JSON.stringify({ category: 'ending', id: 'ending_good', lineId: 'nothing' }),
    });
    expect(res.status).toBe(404);
  });
});
