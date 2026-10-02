/**
 * キャラクター管理（assets/studio/characters.json）のスキーマ。
 * シナリオからは id で参照する（speakerCharacterId・avatars のキー・電話やメールの characterId）。
 */
import { z } from 'zod';
import { LocalizedString } from './schema.ts';

/** 見た目のバリエーション（制服・私服など）。key はシナリオや app から参照する名前（default は必須） */
export const CharacterModel = z.strictObject({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: LocalizedString,
  /** assets/ 以下の URL パス（例: /models/aoi/aoi-school.vrm） */
  url: z.string().startsWith('/'),
});
export type CharacterModel = z.infer<typeof CharacterModel>;

/** 2D のデフォルメ画像（漫画の「ヤダヤダー」など）。連番の画像を繰り返して動かし、3D の舞台に立てる */
export const CharacterSprite = z.strictObject({
  /** シナリオの avatars の sprite から参照する名前 */
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: LocalizedString,
  /** assets/ 以下の URL パス（透過 AVIF）。1枚なら止め絵 */
  frames: z.array(z.string().startsWith('/')).min(1),
  /** 1秒に切り替えるコマ数 */
  fps: z.number().positive().max(60).optional(),
  /** once = 1回で止まる、loop = 繰り返す、pingpong = 行って戻る（省略時は pingpong） */
  playback: z.enum(['once', 'loop', 'pingpong']).optional(),
  /** 舞台での高さ（メートル。省略時 0.6） */
  height: z.number().positive().optional(),
});
export type CharacterSprite = z.infer<typeof CharacterSprite>;

/** 音声生成（Irodori-TTS）の設定 */
export const CharacterVoice = z.strictObject({
  /** 参照音声（リポジトリ直下からの相対パス） */
  ref: z.string().min(1),
  /** 声質の説明 */
  caption: z.string(),
  /** キャラ固有のボイス指導。声の説明に足す */
  direction: z.string().optional(),
  /** 生成後の加工（divine_reverb など） */
  postprocess: z.string().optional(),
});
export type CharacterVoice = z.infer<typeof CharacterVoice>;

export const CharacterRole = z.enum(['heroine', 'sub', 'mob', 'player']);
export type CharacterRole = z.infer<typeof CharacterRole>;

export const Character = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: LocalizedString,
  role: CharacterRole,
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  models: z.array(CharacterModel),
  /** 2D のデフォルメ画像 */
  sprites: z.array(CharacterSprite).optional(),
  voice: CharacterVoice.optional(),
  /** キャラ設定（自由記述） */
  profile: z.string(),
});
export type Character = z.infer<typeof Character>;

export const CharacterBook = z
  .strictObject({
    description: z.string().optional(),
    characters: z.array(Character),
    /** 表情ごとに声の説明へ足す演技指示 */
    voiceMoods: z.record(z.string(), z.string()),
    /** 「（」で始まる心の声・小声のセリフに使う演技指示 */
    whisperCaption: z.string(),
    /** 「！」が2つ以上のセリフに足す演技指示 */
    shoutCaption: z.string(),
  })
  .superRefine((book, ctx) => {
    const ids = new Set<string>();
    book.characters.forEach((c, i) => {
      if (ids.has(c.id)) ctx.addIssue({ code: 'custom', path: ['characters', i, 'id'], message: `id が重複しています: ${c.id}` });
      ids.add(c.id);
      if (c.models.length > 0 && !c.models.some((m) => m.key === 'default')) {
        ctx.addIssue({ code: 'custom', path: ['characters', i, 'models'], message: 'key が default のモデルが必要です' });
      }
    });
  });
export type CharacterBook = z.infer<typeof CharacterBook>;
