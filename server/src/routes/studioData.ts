import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import type { z } from 'zod';
import { BgmBook, CharacterBook, LocationFile, MotionBook, TimeOfDayFile } from '@anime-vrm/scenario';
import type { ServerConfig } from '../config.ts';
import { resolveInside } from '../safePath.ts';

/** 形式が決まっているファイルは保存前に検証する */
const SCHEMAS: Record<string, z.ZodType> = {
  'time-of-day': TimeOfDayFile,
  locations: LocationFile,
  characters: CharacterBook,
  motions: MotionBook,
  bgm: BgmBook,
};

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
    const schema = SCHEMAS[c.req.param('name')];
    const parsed = schema?.safeParse(body);
    if (parsed && !parsed.success) {
      return c.json(
        { error: '形式が正しくありません', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
        400
      );
    }
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(body, null, 2) + '\n');
    return c.json({ ok: true });
  });

  return app;
}
