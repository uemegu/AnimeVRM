/**
 * Pages のビルドに入れる素材を、再生するシナリオから拾う（assets/ を丸ごと入れると数百 MB になるため）
 */
import fs from 'node:fs';
import path from 'node:path';
import { collectScenarioAssets, type ScenarioAssetBooks } from '@anime-vrm/scenario';

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
  'textures/girl_face_redface.avif',
  'textures/girl_face_anger.png',
  'textures/girl_face_sweat.png',
  'animations/Standing Idle.fbx',
  // ボイスの口パク解析（VoiceAnalyser.ts が読む AudioWorklet と WASM）
  'worklets/lipsync-processor.js',
  'wasm/lipsync.wasm',
  // 雨で濡れた服の絵柄（WetCloth.ts が名前を決め打ちで読む）
  'textures/wet',
  // 手に持つ小物の絵柄（heldItem.ts が名前を決め打ちで読む）
  'textures/props',
  // 場所の選択で選べる海の見える公園（簡易3D）。どのシナリオからも参照されないため固定で入れる
  'textures/painted-seaside',
  'textures/painted-classroom/sky-only.png',
  'textures/painted-classroom/thumb-seaside.avif',
];

/** 組み込みの3D背景が読むテクスチャのディレクトリ */
const BUILTIN_ENVIRONMENTS: Record<string, string> = {
  'builtin:painted-classroom': 'textures/painted-classroom',
  'builtin:painted-library': 'textures/painted-library',
  'builtin:painted-aoi-room': 'textures/painted-aoi-room',
  'builtin:painted-gym': 'textures/painted-gym',
  'builtin:painted-gate': 'textures/painted-gate',
  'builtin:painted-ground': 'textures/painted-ground',
  'builtin:painted-seaside': 'textures/painted-seaside',
  'builtin:shopping-street': 'textures/shopping-street',
  'builtin:painted-shrine': 'textures/painted-shrine',
  'builtin:painted-gondola': 'textures/painted-gondola',
};

const readJson = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8'));
const strip = (url: string) => url.replace(/^\//, '');

/**
 * 素材の一覧（assets/ からの相対パス。ディレクトリも含む）。
 * scenarioIds は assets/scenarios/demo/ のシナリオ ID、extra は共有用画像など
 */
export function collectPagesAssets(assetsDir: string, scenarioIds: string[], extra: string[] = []): string[] {
  const found = new Set<string>([...ALWAYS, ...extra.map(strip)]);
  const books: ScenarioAssetBooks = {
    locations: readJson(path.join(assetsDir, 'studio/locations.json')).presets,
    bgm: readJson(path.join(assetsDir, 'studio/bgm.json')).bgm,
    motions: readJson(path.join(assetsDir, 'studio/motions.json')).motions,
    characters: readJson(path.join(assetsDir, 'studio/characters.json')).characters,
  };
  // 再生の先読み（collectScenarioAssets）と同じ一覧をコピーする。組み込みの3D背景はテクスチャのディレクトリごと
  for (const id of scenarioIds) {
    const base = `scenarios/demo/${id}/`;
    found.add(`${base}scenario.json`);
    const assets = collectScenarioAssets(readJson(path.join(assetsDir, base, 'scenario.json')), books, `/${base}`);
    for (const file of assets.files) found.add(strip(file));
    for (const model of assets.environments) {
      found.add(BUILTIN_ENVIRONMENTS[model] ?? strip(model));
      if (model === 'builtin:painted-ground') {
        // 校門の旧セットの舗装・塀・門柱の石・道路・家並みを共用する
        for (const file of ['tile-paving', 'tile-wall', 'tile-stone', 'tile-road', 'far-houses']) found.add(`textures/painted-gate/${file}.avif`);
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
