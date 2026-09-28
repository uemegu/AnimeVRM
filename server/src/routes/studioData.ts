import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { checkStudioDataInWorkspace, STUDIO_DATA_SCHEMAS } from '@anime-vrm/scenario/node';
import type { ServerConfig } from '../config.ts';
import { resolveInside } from '../safePath.ts';

/**
 * Studio が管理する JSON（assets/studio/<name>.json）。シーン設定やキャラクター管理など
 */
export function studioDataRoutes(config: ServerConfig) {
  const app = new Hono();
  const base = () => path.join(config.assetsDir, 'studio');
  const fileOf = (name: string) => (name.endsWith('.json') ? null : resolveInside(base(), `${name}.json`));

  app.get('/', async (c) => {
    const names = await fs.readdir(base()).catch(() => [] as string[]);
    return c.json(names.filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5)).sort());
  });

  app.get('/:name', async (c) => {
    const file = fileOf(c.req.param('name'));
    if (!file) return c.json({ error: '名前が不正です' }, 400);
    const text = await fs.readFile(file, 'utf8').catch(() => null);
    return text === null ? c.json({ error: 'ありません' }, 404) : c.json(JSON.parse(text));
  });

  app.put('/:name', async (c) => {
    const file = fileOf(c.req.param('name'));
    if (!file) return c.json({ error: '名前が不正です' }, 400);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'JSON として読めません' }, 400);
    }
    const name = c.req.param('name');
    // 形式の決まっていない名前は断る（綴り間違いで使われないファイルが増えるのを防ぐ）
    const schema = Object.hasOwn(STUDIO_DATA_SCHEMAS, name) ? STUDIO_DATA_SCHEMAS[name] : undefined;
    if (!schema) return c.json({ error: `保存できるのは ${Object.keys(STUDIO_DATA_SCHEMAS).join(' / ')} だけです` }, 400);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: '形式が正しくありません', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
        400
      );
    }
    // 参照先（ファイルなど）の問題は problems で返す。?strict=1 ならエラーがあるとき保存しない
    const problems = checkStudioDataInWorkspace(config, name, body);
    if (c.req.query('strict') === '1' && problems.some((p) => p.severity === 'error')) {
      return c.json({ error: '参照先に問題があります', issues: problems.filter((p) => p.severity === 'error'), problems }, 400);
    }
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(body, null, 2) + '\n');
    return c.json({ ok: true, problems });
  });

  return app;
}
