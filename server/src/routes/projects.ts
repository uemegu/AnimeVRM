import { Hono } from 'hono';
import { listProjects } from '@anime-vrm/scenario/node';
import type { ServerConfig } from '../config.ts';

/** Studio で扱うプロジェクト（assets/studio/projects.json と、studio-projects.txt・STUDIO_PROJECTS で読み込んだ外部プロジェクト） */
export function projectRoutes(config: ServerConfig) {
  const app = new Hono();
  app.get('/', (c) => c.json(listProjects(config)));
  return app;
}
