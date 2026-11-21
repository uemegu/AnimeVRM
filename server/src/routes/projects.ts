import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { emptyProjectData, isProjectDataEmpty, PROJECT_DATA_NAMES, PROJECT_DATA_SCHEMAS, projectDataEntries, type ProjectDataName } from '@anime-vrm/scenario';
import { checkProjectDataInWorkspace, listProjects, projectDataFileOf } from '@anime-vrm/scenario/node';
import type { ServerConfig } from '../config.ts';

/** Studio で扱うプロジェクト（assets/studio/projects.json と、studio-projects.txt・STUDIO_PROJECTS で読み込んだ外部プロジェクト） */
export function projectRoutes(config: ServerConfig) {
  const app = new Hono();
  // ownAssets: 素材の置き場を自分で持つ（外部プロジェクト）。Studio のプロジェクトは assets/ を共通と分け合う
  app.get('/', (c) => c.json(listProjects(config).map((p) => (config.projects?.some((e) => e.id === p.id) ? { ...p, ownAssets: true } : p))));

  /**
   * プロジェクト専用のキャラ・場所・BGM（<置き場>/studio/projects/<ID>/<名前>.json）を保存する。
   * 読むときは静的ファイルとして配信されるものを読む
   */
  app.put('/:id/data/:name', async (c) => {
    const { id, name } = c.req.param();
    if (!listProjects(config).some((p) => p.id === id)) return c.json({ error: 'プロジェクトがありません' }, 404);
    if (!(PROJECT_DATA_NAMES as readonly string[]).includes(name)) return c.json({ error: `保存できるのは ${PROJECT_DATA_NAMES.join(' / ')} だけです` }, 400);
    const body = await c.req.json().catch(() => undefined);
    const parsed = PROJECT_DATA_SCHEMAS[name as ProjectDataName].safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: '形式が正しくありません', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
        400
      );
    }
    const problems = checkProjectDataInWorkspace(config, id, name as ProjectDataName, body);
    if (c.req.query('strict') === '1' && problems.some((p) => p.severity === 'error')) {
      return c.json({ error: '参照先に問題があります', issues: problems.filter((p) => p.severity === 'error'), problems }, 400);
    }
    const file = projectDataFileOf(config, id, name as ProjectDataName);
    // 空になったらファイルを消す（専用のものがないプロジェクトにファイルを残さない）
    if (isProjectDataEmpty(name as ProjectDataName, { ...emptyProjectData(), [name]: projectDataEntries(name as ProjectDataName, body) })) {
      await fs.rm(file, { force: true });
      await fs.rmdir(path.dirname(file)).catch(() => {});
      return c.json({ ok: true, problems });
    }
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(body, null, 2) + '\n');
    await fs.rename(tmp, file);
    return c.json({ ok: true, problems });
  });

  return app;
}
