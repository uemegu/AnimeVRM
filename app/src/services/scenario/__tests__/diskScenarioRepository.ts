import fs from 'node:fs';
import path from 'node:path';
import { ScenarioRepository } from '../ScenarioRepository';

const PUBLIC_DIR = path.resolve(__dirname, '../../../../public');

/** テスト用: fetch の代わりに public/ 配下のファイルを直接読むリポジトリ */
export const diskScenarioRepository = new ScenarioRepository(undefined, async (url) =>
  JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, url), 'utf8'))
);

export function loadScenario(id: string) {
  return diskScenarioRepository.load(id);
}
