import { Hono } from 'hono';
import type { ServerConfig } from './config.ts';
import { assetRoutes } from './routes/assets.ts';
import { characterRoutes } from './routes/characters.ts';
import { motionRoutes } from './routes/motions.ts';
import { projectRoutes } from './routes/projects.ts';
import { scenarioRoutes } from './routes/scenarios.ts';
import { studioDataRoutes } from './routes/studioData.ts';
import { ttsRoutes } from './routes/tts.ts';
import { ScenarioStore } from './scenarioStore.ts';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function isLocalHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.startsWith('[') ? hostHeader.slice(0, hostHeader.indexOf(']') + 1) : hostHeader.split(':')[0];
  return LOCAL_HOSTS.has(host) || host.endsWith('.localhost');
}

function isLocalOrigin(origin: string): boolean {
  try {
    return isLocalHost(new URL(origin).host);
  } catch {
    return false;
  }
}

export function createApp(config: ServerConfig) {
  const app = new Hono();
  const store = new ScenarioStore(config);

  // localhost 以外からの利用を断る（DNS リバインディングや、他のサイトからの書き込みを防ぐ）
  app.use('*', async (c, next) => {
    if (!isLocalHost(c.req.header('host'))) return c.json({ error: 'localhost からのみ利用できます' }, 403);
    const origin = c.req.header('origin');
    if (origin && c.req.method !== 'GET' && !isLocalOrigin(origin)) {
      return c.json({ error: '許可されていない呼び出し元です' }, 403);
    }
    await next();
  });

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: err.message }, 500);
  });

  const api = new Hono();
  api.get('/health', (c) => c.json({ ok: true }));
  api.route('/projects', projectRoutes(config));
  api.route('/scenarios', scenarioRoutes(config, store));
  api.route('/assets', assetRoutes(config));
  api.route('/studio-data', studioDataRoutes(config));
  api.route('/tts', ttsRoutes(config, store));
  api.route('/characters', characterRoutes(config, store));
  api.route('/motions', motionRoutes(config));
  app.route('/api', api);

  return app;
}
