import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { MotionBook } from '@anime-vrm/scenario';
import type { ServerConfig } from '../config.ts';
import { resolveInside } from '../safePath.ts';

/** 生成したモーションの名前（assets/animations/<name>.fbx） */
const MOTION_NAME = /^[a-z][a-z0-9_]{1,47}$/;
const MAX_FBX_BYTES = 20 * 1024 * 1024;

function isFbx(bytes: Buffer): boolean {
  const head = bytes.subarray(0, 4096).toString('latin1');
  return head.startsWith('Kaydara FBX Binary') || head.includes('FBXHeaderExtension');
}

/** 校正結果（assets/motion-profiles/<アバターのパス>.json）の最低限の形 */
function isContactProfile(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Record<string, unknown>;
  return (
    profile.version === 1 &&
    typeof profile.avatarSha256 === 'string' &&
    /^[0-9a-f]{64}$/i.test(profile.avatarSha256) &&
    typeof profile.calibrated === 'boolean' &&
    typeof profile.anchors === 'object' &&
    typeof profile.hands === 'object'
  );
}

/**
 * モーション画面の保存。Studio で生成して採用したモーションと、接触点の校正結果
 */
export function motionRoutes(config: ServerConfig) {
  const app = new Hono();
  const animations = () => path.join(config.assetsDir, 'animations');

  // 採用したモーションを保存する（同じ名前があれば overwrite のときだけ上書き）
  app.post('/', async (c) => {
    let body: { name?: unknown; fbx?: unknown; candidates?: unknown; loop?: unknown; overwrite?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'JSON として読めません' }, 400);
    }
    const name = typeof body.name === 'string' ? body.name : '';
    if (!MOTION_NAME.test(name)) return c.json({ error: '名前は英小文字で始め、英小文字・数字・_ で2〜48文字にしてください' }, 400);
    if (typeof body.fbx !== 'string') return c.json({ error: 'FBX がありません' }, 400);
    const bytes = Buffer.from(body.fbx, 'base64');
    if (bytes.length === 0 || bytes.length > MAX_FBX_BYTES || !isFbx(bytes)) return c.json({ error: 'FBX として読めません' }, 400);
    const file = resolveInside(animations(), `${name}.fbx`)!;
    const exists = await fs.stat(file).then(() => true, () => false);
    if (exists && body.overwrite !== true) return c.json({ error: '同じ名前のモーションがあります', exists: true }, 409);

    await fs.writeFile(file, bytes);
    if (body.candidates !== undefined) {
      await fs.writeFile(resolveInside(animations(), `${name}.candidates.json`)!, JSON.stringify(body.candidates, null, 2) + '\n');
    }
    // ループするモーションは motions.json に載せる（シナリオで指定がなければ繰り返す）
    if (typeof body.loop === 'boolean') {
      const bookFile = path.join(config.assetsDir, 'studio', 'motions.json');
      const book = MotionBook.parse(JSON.parse(await fs.readFile(bookFile, 'utf8')));
      if (body.loop) book.motions[name] = { ...book.motions[name], loop: true };
      else delete book.motions[name];
      await fs.writeFile(bookFile, JSON.stringify(book, null, 2) + '\n');
    }
    return c.json({ ok: true, url: `/animations/${name}.fbx` });
  });

  // 接触点の校正結果を保存する（読むときは /motion-profiles/... を静的に読む）
  app.put('/profiles/*', async (c) => {
    const rel = c.req.path.replace(/^.*\/profiles\//, '');
    if (!rel.endsWith('.json')) return c.json({ error: '.json で指定してください' }, 400);
    const file = resolveInside(path.join(config.assetsDir, 'motion-profiles'), rel);
    if (!file) return c.json({ error: 'パスが不正です' }, 400);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'JSON として読めません' }, 400);
    }
    if (!isContactProfile(body)) return c.json({ error: '校正結果の形式が正しくありません' }, 400);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(body, null, 2) + '\n');
    return c.json({ ok: true });
  });

  return app;
}
