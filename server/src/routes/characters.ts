import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { CharacterBook } from '@anime-vrm/scenario';
import { checkStudioDataInWorkspace } from '@anime-vrm/scenario/node';
import type { ServerConfig } from '../config.ts';
import { characterUsage, type ScenarioRecord } from '../characterUsage.ts';
import type { ScenarioStore } from '../scenarioStore.ts';
import { loadCharacterBook } from '../tts/voiceLines.ts';

/**
 * キャラクター管理（assets/studio/characters.json）と、キャラからシナリオ・ボイスへの逆引き
 */
export function characterRoutes(config: ServerConfig, store: ScenarioStore) {
  const app = new Hono();
  const file = () => path.join(config.assetsDir, 'studio', 'characters.json');

  app.get('/', async (c) => c.json(await loadCharacterBook(config.assetsDir)));

  app.put('/', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = CharacterBook.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'キャラクターの形式が正しくありません', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
        400
      );
    }
    // 参照先（モデル・参照音声のファイル）の問題は problems で返す。?strict=1 ならエラーがあるとき保存しない
    const problems = checkStudioDataInWorkspace(config, 'characters', body);
    if (c.req.query('strict') === '1' && problems.some((p) => p.severity === 'error')) {
      return c.json({ error: '参照先に問題があります', issues: problems.filter((p) => p.severity === 'error'), problems }, 400);
    }
    const tmp = `${file()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(body, null, 2) + '\n');
    await fs.rename(tmp, file());
    return c.json({ ok: true, problems });
  });

  app.get('/:id/usage', async (c) => {
    const book = await loadCharacterBook(config.assetsDir);
    const id = c.req.param('id');
    if (!book.characters.some((ch) => ch.id === id)) return c.json({ error: 'キャラクターがいません' }, 404);
    const records: ScenarioRecord[] = [];
    for (const summary of await store.list()) {
      const data = await store.read(summary.category, summary.id);
      if (data) records.push({ category: summary.category, id: summary.id, data: data as ScenarioRecord['data'] });
    }
    return c.json(characterUsage(id, book, records));
  });

  return app;
}
