/**
 * Pages のビルドに入れる素材を、再生するシナリオから拾う（assets/ を丸ごと入れると数百 MB になるため）
 */
import fs from 'node:fs';
import path from 'node:path';

interface Json {
  [key: string]: any;
}

/** 描画が名前を決め打ちで読むもの（感情演出の顔の重ね絵・待機モーション） */
const ALWAYS = [
  'studio/characters.json',
  'studio/locations.json',
  'studio/time-of-day.json',
  'studio/bgm.json',
  'studio/motions.json',
  'studio/projects.json',
  'textures/girl_face_blush.png',
  'textures/girl_face_anger.png',
  'textures/girl_face_sweat.png',
  'animations/Standing Idle.fbx',
  // 場所の選択で選べる海の見える公園（簡易3D）。どのシナリオからも参照されないため固定で入れる
  'textures/painted-seaside',
  'textures/painted-classroom/sky-only.png',
  'textures/painted-classroom/thumb-seaside.avif',
];

/** 組み込みの3D背景が読むテクスチャのディレクトリ */
const BUILTIN_ENVIRONMENTS: Record<string, string> = {
  'builtin:painted-classroom': 'textures/painted-classroom',
  'builtin:painted-library': 'textures/painted-library',
  'builtin:painted-gate': 'textures/painted-gate',
  'builtin:painted-ground': 'textures/painted-ground',
  'builtin:painted-seaside': 'textures/painted-seaside',
};

const readJson = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8'));
const strip = (url: string) => url.replace(/^\//, '');

/**
 * 素材の一覧（assets/ からの相対パス。ディレクトリも含む）。
 * scenarioIds は assets/scenarios/demo/ のシナリオ ID、extra は共有用画像など
 */
export function collectPagesAssets(assetsDir: string, scenarioIds: string[], extra: string[] = []): string[] {
  const found = new Set<string>([...ALWAYS, ...extra.map(strip)]);
  const characters = readJson(path.join(assetsDir, 'studio/characters.json')).characters as Json[];
  const locations = readJson(path.join(assetsDir, 'studio/locations.json')).presets as Record<string, Json>;
  const bgmBook = readJson(path.join(assetsDir, 'studio/bgm.json')).bgm as Record<string, Json>;

  const addUrl = (url: string | undefined | false, base = '') => {
    if (!url) return;
    found.add(url.startsWith('/') ? strip(url) : `${base}${url}`);
  };
  const addBgm = (bgm: string | undefined) => {
    if (!bgm || bgm === 'silence') return;
    addUrl(bgmBook[bgm]?.url ?? bgm);
  };
  const addLocation = (id: string | undefined) => {
    const location = id ? locations[id] : undefined;
    if (!location) return;
    for (const layer of Object.values(location.layers ?? {}) as Json[]) addUrl(layer?.url);
    const model = location.environment?.model as string | undefined;
    if (model) found.add(BUILTIN_ENVIRONMENTS[model] ?? strip(model));
    if (model === 'builtin:painted-ground') {
      found.add('textures/painted-gate/tile-paving.avif');
    }
  };
  const addMotion = (motion: string | undefined) => {
    if (motion) found.add(`animations/${motion}.fbx`);
  };

  for (const id of scenarioIds) {
    const base = `scenarios/demo/${id}/`;
    found.add(`${base}scenario.json`);
    const scenario = readJson(path.join(assetsDir, base, 'scenario.json'));
    addBgm(scenario.bgm);
    addUrl(scenario.ambience);
    addLocation(scenario.location);
    // 登場中のキャラのモデル（シーンの指定を引き継ぐ。指定がなければ characters.json の1番目の服装）
    let cast: Record<string, string | undefined> = {};
    for (const scene of scenario.scenes as Json[]) {
      addBgm(scene.bgm);
      addUrl(scene.ambience);
      addUrl(scene.seUrl);
      addUrl(scene.voiceUrl, base);
      addLocation(scene.background);
      if (scene.scrollingBackground) addUrl(scene.scrollingBackground.textureUrl);
      if (scene.clearCast) cast = {};
      for (const [key, avatar] of Object.entries((scene.avatars ?? {}) as Record<string, Json>)) {
        if (avatar.visible === false) {
          delete cast[key];
          continue;
        }
        cast[key] = avatar.modelUrl ?? cast[key];
        const characterId = avatar.characterId ?? key;
        addUrl(cast[key] ?? characters.find((c) => c.id === characterId)?.models[0]?.url);
        addMotion(avatar.motion);
        for (const k of avatar.transitions ?? []) addMotion(k.motion);
      }
    }
  }

  // VRM のサムネイル（キャラクター・ビューアの一覧で使う）
  for (const file of [...found]) {
    if (!file.startsWith('models/') || !file.endsWith('.vrm')) continue;
    const stem = file.slice('models/'.length, -'.vrm'.length);
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
      if (fs.existsSync(path.join(assetsDir, 'thumbnails', `${stem}${ext}`))) found.add(`thumbnails/${stem}${ext}`);
    }
  }

  const missing = [...found].filter((p) => !fs.existsSync(path.join(assetsDir, p)));
  if (missing.length) throw new Error(`Pages の素材が見つかりません:\n${missing.join('\n')}`);
  return [...found].sort();
}
