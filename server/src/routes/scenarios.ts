import { Hono } from 'hono';
import type { ServerConfig } from '../config.ts';
import { ScenarioStore, ScenarioValidationError } from '../scenarioStore.ts';

export function scenarioRoutes(config: ServerConfig, store: ScenarioStore) {
  const app = new Hono();

  app.get('/', async (c) => c.json(await store.list()));

  app.get('/:category/:id', async (c) => {
    const { category, id } = c.req.param();
    if (!store.filePath(category, id)) return c.json({ error: 'カテゴリまたは ID が不正です' }, 400);
    const data = await store.read(category, id);
    return data === null ? c.json({ error: 'シナリオがありません' }, 404) : c.json(data);
  });

  /** 保存（なければ作る）。スキーマに合わなければ 400 と問題の一覧を返す */
  app.put('/:category/:id', async (c) => {
    const { category, id } = c.req.param();
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'JSON として読めません' }, 400);
    }
    try {
      await store.write(category, id, body);
    } catch (err) {
      if (err instanceof ScenarioValidationError) return c.json({ error: err.message, issues: err.issues }, 400);
      throw err;
    }
    await config.onScenarioSaved();
    return c.json({ ok: true });
  });

  return app;
}
