/**
 * 外部プロジェクトの置き場（studio-project.json の assetsDir）を、Vite の開発サーバーで配信する（Node 専用。`@anime-vrm/scenario/vite`）。
 * publicDir は1か所しか指定できないので、残りの置き場はこのプラグインが同じ URL の並びで重ねて配信する
 */
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

const MIME: Record<string, string> = {
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
};

type Next = (err?: unknown) => void;

/** URL のパスに当たるファイル（どの置き場にもなければ null）。置き場の外を指すパスは断る */
export function resolveContentFile(dirs: string[], urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  for (const dir of dirs) {
    const root = path.resolve(dir);
    const file = path.resolve(root, '.' + path.posix.normalize('/' + decoded));
    if (!file.startsWith(root + path.sep)) continue;
    if (fs.statSync(file, { throwIfNoEntry: false })?.isFile()) return file;
  }
  return null;
}

/** 置き場にあるファイルを返すミドルウェア（なければ次へ）。音声のシークで使う Range にも応える */
export function contentDirsMiddleware(dirs: string[]) {
  return (req: IncomingMessage, res: ServerResponse, next: Next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || !req.url) return next();
    const file = resolveContentFile(dirs, new URL(req.url, 'http://localhost').pathname);
    if (!file) return next();
    const size = fs.statSync(file).size;
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    let start = 0;
    let end = size - 1;
    if (range && (range[1] || range[2])) {
      start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start > end || start >= size) {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${size}`);
        return res.end();
      }
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    res.setHeader('Content-Length', String(end - start + 1));
    if (req.method === 'HEAD' || size === 0) return res.end();
    fs.createReadStream(file, { start, end }).on('error', next).pipe(res);
  };
}

/**
 * Vite のプラグイン。dirs は publicDir 以外の置き場。
 * 開発サーバーでは重ねて配信し、ビルドでは publicDir と同じように出力先へコピーする
 */
export function contentDirsPlugin(dirs: string[]) {
  return {
    name: 'anime-vrm-content-dirs',
    configureServer(server: { middlewares: { use: (fn: ReturnType<typeof contentDirsMiddleware>) => void } }) {
      if (dirs.length) server.middlewares.use(contentDirsMiddleware(dirs));
    },
    writeBundle(options: { dir?: string }) {
      if (!options.dir) return;
      for (const dir of dirs) fs.cpSync(dir, options.dir, { recursive: true });
    },
  };
}
