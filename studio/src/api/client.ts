import type { CharacterBook, ScenarioCategory, ScenarioLinks } from '@anime-vrm/scenario';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';

/**
 * 本番ビルド（GitHub Pages）は読み取り専用。サーバーは動かないので、GET はビルド時に書き出した
 * api/<パス>.json を読み、保存などは断る（書き出しは studio/pages/bakeApi.ts）
 */
export const READ_ONLY = import.meta.env.PROD;

/** Studio サーバー（server/）の API。開発時は Vite が /api を転送する */

export interface ApiIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly issues: ApiIssue[];
  constructor(status: number, message: string, issues: ApiIssue[] = []) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (READ_ONLY && init?.method && init.method !== 'GET') throw new ApiError(405, 'Pages では保存できません');
  const res = await fetch(READ_ONLY ? resolveAssetUrl(`/api${path}.json`) : `/api${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? res.statusText, body.issues);
  return body as T;
}

function putJson<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
}

export interface AssetEntry {
  url: string;
  size: number;
  updatedAt: string;
  thumbnailUrl?: string;
}

export type AssetKind = 'models' | 'environments' | 'animations' | 'textures' | 'bgm' | 'se' | 'voices';

export interface CharacterLine {
  lineId: string;
  text: string;
  voiceUrl?: string;
}

export interface CharacterScenarioUsage {
  category: string;
  id: string;
  title: string;
  appearances: number;
  lines: CharacterLine[];
}

export interface ScenarioSummary {
  category: ScenarioCategory;
  id: string;
  kind: 'story' | 'call' | 'mail';
  title: string;
  lineCount: number;
  updatedAt: string;
  location?: string;
  description?: string;
  links: ScenarioLinks;
}

export interface TtsLine {
  lineId: string;
  text: string;
  speaker: string | null;
  expression: string;
  caption: string;
}

export interface TtsJob {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  candidates: number[];
  error?: string;
  log: string[];
}

export const api = {
  ttsLine: (category: string, id: string, lineId: string) => request<TtsLine>(`/tts/lines/${category}/${encodeURIComponent(id)}/${encodeURIComponent(lineId)}`),
  ttsStart: (body: { category: string; id: string; lineId: string; candidates: number; caption?: string }) =>
    request<TtsJob>('/tts/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  ttsJob: (jobId: string) => request<TtsJob>(`/tts/jobs/${jobId}`),
  ttsAdopt: (jobId: string, index: number) =>
    request<{ ok: true; voiceUrl: string }>(`/tts/jobs/${jobId}/adopt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ index }) }),
  scenarios: () => request<ScenarioSummary[]>('/scenarios'),
  scenario: (category: string, id: string) => request<unknown>(`/scenarios/${category}/${encodeURIComponent(id)}`),
  saveScenario: (category: string, id: string, data: unknown) => putJson<{ ok: true }>(`/scenarios/${category}/${encodeURIComponent(id)}`, data),
  characters: () => request<CharacterBook>('/characters'),
  saveCharacters: (book: CharacterBook) => putJson<{ ok: true }>('/characters', book),
  characterUsage: (id: string) => request<CharacterScenarioUsage[]>(`/characters/${encodeURIComponent(id)}/usage`),
  assets: (kind: AssetKind) => request<AssetEntry[]>(`/assets/${kind}`),
  saveMotion: (body: { name: string; fbx: string; candidates?: unknown; loop?: boolean; overwrite?: boolean }) =>
    fetch('/api/motions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  saveMotionProfile: (path: string, profile: unknown) => putJson<{ ok: true }>(`/motions/profiles/${path}`, profile),
  studioData: <T>(name: string) => request<T>(`/studio-data/${encodeURIComponent(name)}`),
  saveStudioData: (name: string, data: unknown) => putJson<{ ok: true }>(`/studio-data/${encodeURIComponent(name)}`, data),
};
