import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assetsDirOfCategory,
  checkProjects,
  contentDirs,
  findScenarios,
  listProjects,
  loadExternalProjects,
  validateWorkspace,
  type WorkspacePaths,
} from '../src/node.ts';
import { contentDirsMiddleware, contentDirsPlugin, resolveContentFile } from '../src/vite.ts';

let root: string;
let paths: WorkspacePaths;

const write = (file: string, data: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
};
const scenario = (id: string) => ({ id, title: 'テスト', scenes: [{ id: 's1', text: 'こんにちは' }] });

/** Studio（studio/assets）と、外部プロジェクト（game/。素材は game/content） */
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-workspace-'));
  const repoRoot = path.join(root, 'studio');
  write(path.join(repoRoot, 'assets/studio/projects.json'), { projects: [{ id: 'demo', name: { ja: 'デモ' }, categories: ['demo'] }] });
  write(path.join(repoRoot, 'assets/scenarios/demo/d1/scenario.json'), scenario('d1'));
  write(path.join(root, 'game/studio-project.json'), {
    id: 'game',
    name: { ja: '本編' },
    categories: ['action', 'call'],
    assetsDir: 'content',
    hooks: 'hooks.js',
  });
  write(path.join(root, 'game/content/scenarios/action/a1/scenario.json'), scenario('a1'));
  write(path.join(root, 'game/content/cg/a1.avif'), 'avif');
  write(
    path.join(root, 'game/hooks.js'),
    `export function check({ fix }) {
       return fix ? { problems: [], fixed: ['直しました'] } : { problems: [{ severity: 'error', file: 'index.json', path: '', message: '古い' }] };
     }`
  );
  paths = { repoRoot, assetsDir: path.join(repoRoot, 'assets'), projects: loadExternalProjects(repoRoot, '../game') };
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('外部プロジェクト', () => {
  it('studio-project.json を読み、パスを絶対パスにする', () => {
    expect(paths.projects).toEqual([
      expect.objectContaining({ id: 'game', dir: path.join(root, 'game'), assetsDir: path.join(root, 'game/content'), hooks: path.join(root, 'game/hooks.js') }),
    ]);
  });

  it('設定がなければ例外を投げる', () => {
    expect(() => loadExternalProjects(paths.repoRoot, '../nothing')).toThrow(/プロジェクトの設定がありません/);
  });

  it('種類ごとに置き場が決まる', () => {
    expect(assetsDirOfCategory(paths, 'action')).toBe(path.join(root, 'game/content'));
    expect(assetsDirOfCategory(paths, 'demo')).toBe(paths.assetsDir);
    expect(contentDirs(paths)).toEqual([paths.assetsDir, path.join(root, 'game/content')]);
  });

  it('一覧は Studio のプロジェクトのあとに外部プロジェクト', () => {
    expect(listProjects(paths).map((p) => p.id)).toEqual(['demo', 'game']);
    expect(listProjects(paths)[1]).not.toHaveProperty('assetsDir');
  });

  it('両方の置き場のシナリオを検証する', () => {
    const report = validateWorkspace(paths);
    expect(report.scenarioCount).toBe(2);
    expect(report.problems).toEqual([]);
  });

  it('プロジェクトの置き場でない所にあるシナリオはエラー', () => {
    write(path.join(paths.assetsDir, 'scenarios/action/stray/scenario.json'), scenario('stray'));
    expect(findScenarios(paths).map((s) => s.id)).toEqual(['d1', 'a1']);
    expect(validateWorkspace(paths).problems).toEqual([
      expect.objectContaining({ severity: 'error', file: 'assets/scenarios/action', message: expect.stringContaining('../game/content/scenarios/') }),
    ]);
  });

  it('Studio のプロジェクトと種類が重なればエラー', () => {
    write(path.join(paths.assetsDir, 'studio/projects.json'), { projects: [{ id: 'demo', name: { ja: 'デモ' }, categories: ['demo', 'call'] }] });
    expect(validateWorkspace(paths).problems).toEqual([
      expect.objectContaining({ file: '../game/studio-project.json', path: 'categories.1', message: '種類 call はプロジェクト demo にも入っています' }),
    ]);
  });

  it('hooks の検証を呼び、ファイルをリポジトリ直下からの相対パスにする', async () => {
    expect(await checkProjects(paths, { fix: false })).toEqual({
      problems: [{ severity: 'error', file: '../game/index.json', path: '', message: '古い' }],
      fixed: [],
    });
    expect(await checkProjects(paths, { fix: true })).toEqual({ problems: [], fixed: ['直しました'] });
  });
});

describe('置き場の配信', () => {
  it('URL のパスを置き場のファイルにする。外に出るパスは断る', () => {
    const dirs = [path.join(root, 'game/content')];
    expect(resolveContentFile(dirs, '/cg/a1.avif')).toBe(path.join(root, 'game/content/cg/a1.avif'));
    expect(resolveContentFile(dirs, '/cg/none.avif')).toBeNull();
    expect(resolveContentFile(dirs, '/../studio-project.json')).toBeNull();
    expect(resolveContentFile(dirs, '/%2e%2e/studio-project.json')).toBeNull();
  });

  it('ビルドでは置き場の中身を出力先にコピーする', () => {
    const out = path.join(root, 'dist');
    write(path.join(out, 'index.html'), '<html>');
    contentDirsPlugin([path.join(root, 'game/content')]).writeBundle({ dir: out });
    expect(fs.readFileSync(path.join(out, 'cg/a1.avif'), 'utf8')).toBe('avif');
    expect(fs.existsSync(path.join(out, 'scenarios/action/a1/scenario.json'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'index.html'))).toBe(true);
  });

  it('ファイルを返し、Range にも応える。なければ次へ回す', async () => {
    const server = http.createServer((req, res) =>
      contentDirsMiddleware([path.join(root, 'game/content')])(req, res, () => {
        res.statusCode = 404;
        res.end('next');
      })
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };
    try {
      const full = await fetch(`http://127.0.0.1:${port}/cg/a1.avif`);
      expect([full.status, full.headers.get('content-type'), await full.text()]).toEqual([200, 'image/avif', 'avif']);
      const part = await fetch(`http://127.0.0.1:${port}/cg/a1.avif`, { headers: { range: 'bytes=1-2' } });
      expect([part.status, part.headers.get('content-range'), await part.text()]).toEqual([206, 'bytes 1-2/4', 'vi']);
      expect((await fetch(`http://127.0.0.1:${port}/scenarios/demo/d1/scenario.json`)).status).toBe(404);
    } finally {
      server.close();
    }
  });
});
