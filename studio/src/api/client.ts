import type { CharacterBook } from '@anime-vrm/scenario';

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
  const res = await fetch(`/api${path}`, init);
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

export const api = {
  characters: () => request<CharacterBook>('/characters'),
  saveCharacters: (book: CharacterBook) => putJson<{ ok: true }>('/characters', book),
  characterUsage: (id: string) => request<CharacterScenarioUsage[]>(`/characters/${encodeURIComponent(id)}/usage`),
  assets: (kind: AssetKind) => request<AssetEntry[]>(`/assets/${kind}`),
  studioData: <T>(name: string) => request<T>(`/studio-data/${encodeURIComponent(name)}`),
  saveStudioData: (name: string, data: unknown) => putJson<{ ok: true }>(`/studio-data/${encodeURIComponent(name)}`, data),
};
