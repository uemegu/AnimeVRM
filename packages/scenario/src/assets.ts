/**
 * シナリオ1本が使う素材を集める（再生を始める前にまとめて読み込むため）。
 * 項目ごとに拾うのではなく、シナリオの JSON を丸ごとたどり、ファイルのパスと
 * Studio データの ID（BGM・場所・モーション・キャラ）に当たるものをすべて拾う
 */

/** 素材の参照先（assets/studio/*.json の中身） */
export interface ScenarioAssetBooks {
  locations: Record<string, unknown>;
  bgm: Record<string, { url: string }>;
  motions: Record<string, unknown>;
  characters: { id: string; models: { url: string }[]; sprites?: unknown }[];
}

export interface ScenarioAssets {
  /** 読み込むファイル（'/' から始まるパス。VRM・FBX を含む） */
  files: string[];
  /** モーション名（/animations/<名前>.fbx） */
  motions: string[];
  /** 3D背景（場所の environment.model） */
  environments: string[];
  /** 3Dキャラ（キャストのキーごとに最初に出るモデル） */
  avatars: { id: string; modelUrl: string }[];
}

const FILE = /\.(mp3|wav|ogg|m4a|aac|png|jpe?g|webp|avif|gif|svg|fbx|vrm|glb|gltf|mp4|webm)$/i;
const ABSOLUTE = /^(\/|https?:|blob:|data:)/;

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null;

/** baseUrl はシナリオのディレクトリ（/scenarios/<種類>/<ID>/）。'/' で始まらないファイルはここから */
export function collectScenarioAssets(scenario: unknown, books: ScenarioAssetBooks, baseUrl: string): ScenarioAssets {
  const files = new Set<string>();
  const motions = new Set<string>();
  const environments = new Set<string>();
  const avatars = new Map<string, string>();
  const seen = new Set<unknown>();
  const characters = new Map(books.characters.map((c) => [c.id, c]));
  const characterModel = (id: string) => characters.get(id)?.models[0]?.url;

  const visitString = (value: string, base: string) => {
    if (FILE.test(value)) files.add(ABSOLUTE.test(value) ? value : `${base}${value}`);
    if (Object.hasOwn(books.bgm, value)) files.add(books.bgm[value].url);
    if (Object.hasOwn(books.motions, value)) motions.add(value);
    if (Object.hasOwn(books.locations, value)) {
      const location = books.locations[value];
      const model = isObject(location) && isObject(location.environment) ? location.environment.model : undefined;
      if (typeof model === 'string') environments.add(model);
      visit(location, '/');
    }
    const character = characters.get(value);
    if (character) {
      const model = characterModel(value);
      if (model) files.add(model);
      visit(character.sprites, '/');
    }
  };

  // キャストは前のカットのモデルを引き継ぐ（指定がなければキャラの1番目の服装。どちらになるかは問わず両方読む）
  const cast = new Map<string, string>();
  const visitAvatars = (record: Json) => {
    for (const [id, avatar] of Object.entries(record)) {
      if (!isObject(avatar) || avatar.sprite || avatar.visible === false) continue;
      const own = typeof avatar.modelUrl === 'string' ? avatar.modelUrl : undefined;
      const fallback = characterModel(typeof avatar.characterId === 'string' ? avatar.characterId : id);
      for (const url of [own, own ? undefined : cast.get(id), own ? undefined : fallback]) if (url) files.add(url);
      const modelUrl = own ?? cast.get(id) ?? fallback;
      if (!modelUrl) continue;
      cast.set(id, modelUrl);
      if (!avatars.has(id)) avatars.set(id, modelUrl);
    }
  };

  const visit = (value: unknown, base: string) => {
    if (typeof value === 'string') return visitString(value, base);
    if (!isObject(value) || seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (!Array.isArray(value)) visitString(key, base);
      if (key === 'avatars' && isObject(child) && !Array.isArray(child)) visitAvatars(child);
      // モーションは motions.json に無い名前でも /animations/<名前>.fbx を読む
      if (key === 'motion' && typeof child === 'string' && !FILE.test(child) && !ABSOLUTE.test(child)) motions.add(child);
      visit(child, base);
    }
  };
  visit(scenario, baseUrl);

  for (const motion of motions) files.add(`/animations/${motion}.fbx`);
  return {
    files: [...files],
    motions: [...motions],
    environments: [...environments],
    avatars: [...avatars].map(([id, modelUrl]) => ({ id, modelUrl })),
  };
}
