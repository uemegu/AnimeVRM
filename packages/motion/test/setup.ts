import fs from 'node:fs';
import path from 'node:path';
import { vi } from 'vitest';

vi.stubEnv('BASE_URL', 'http://assets.test/');

const ASSETS = path.resolve(import.meta.dirname, '../../../assets');
const nativeFetch = globalThis.fetch;

// 素材（http://assets.test/...）は assets/ から読む
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.host !== 'assets.test') return nativeFetch(input, init);
  const file = path.join(ASSETS, decodeURIComponent(url.pathname));
  if (!fs.existsSync(file)) return new Response(null, { status: 404 });
  return new Response(fs.readFileSync(file));
};

// three の FileLoader が読み込みの進み具合に使う（Node にはない）
if (!('ProgressEvent' in globalThis)) {
  class ProgressEventPolyfill extends Event {
    lengthComputable: boolean;
    loaded: number;
    total: number;
    constructor(type: string, init: { lengthComputable?: boolean; loaded?: number; total?: number } = {}) {
      super(type);
      this.lengthComputable = init.lengthComputable ?? false;
      this.loaded = init.loaded ?? 0;
      this.total = init.total ?? 0;
    }
  }
  vi.stubGlobal('ProgressEvent', ProgressEventPolyfill);
}
