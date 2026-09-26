import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CharacterBook, type CallScenario, type CharacterVoice, type ScenarioPackage } from '@anime-vrm/scenario';
import { textOf } from '../scenarioStore.ts';

/** 音声生成に必要な、キャラクター管理（assets/studio/characters.json）の中身 */
export interface VoiceProfiles {
  /** 音声設定のあるキャラ ID → 設定 */
  speakers: Record<string, CharacterVoice>;
  moods: Record<string, string>;
  whisperCaption: string;
  shoutCaption: string;
  /** ID を付けずに書かれた話者名 → キャラ ID */
  speakerNames: Record<string, string>;
}

export async function loadCharacterBook(assetsDir: string): Promise<CharacterBook> {
  return CharacterBook.parse(JSON.parse(await fs.readFile(path.join(assetsDir, 'studio', 'characters.json'), 'utf8')));
}

export function voiceProfilesOf(book: CharacterBook): VoiceProfiles {
  return {
    speakers: Object.fromEntries(book.characters.filter((c) => c.voice).map((c) => [c.id, c.voice!])),
    moods: book.voiceMoods,
    whisperCaption: book.whisperCaption,
    shoutCaption: book.shoutCaption,
    speakerNames: Object.fromEntries(book.characters.flatMap((c) => c.speakerNames.map((n) => [n, c.id]))),
  };
}

export async function loadVoiceProfiles(assetsDir: string): Promise<VoiceProfiles> {
  return voiceProfilesOf(await loadCharacterBook(assetsDir));
}

/** 1セリフ分の音声生成の材料 */
export interface VoiceLine {
  lineId: string;
  text: string;
  speaker: string | null;
  expression: string;
}

/**
 * シナリオから指定セリフの本文・話者・表情を取り出す（app/scripts/scenario-voices.py と同じ決め方）。
 * 通常シナリオは scenes[].id、電話は steps のキー。
 */
export function findVoiceLine(
  scenario: ScenarioPackage | CallScenario,
  lineId: string,
  profiles: VoiceProfiles
): VoiceLine | null {
  if ('steps' in scenario) {
    const step = scenario.steps[lineId];
    if (!step) return null;
    return { lineId, text: textOf(step.text), speaker: scenario.characterId, expression: step.expression ?? 'neutral' };
  }
  // 表情は、そのシーンまでに話者へ指定された最後のもの
  const expressions: Record<string, string> = {};
  for (const scene of scenario.scenes) {
    for (const [who, avatar] of Object.entries(scene.avatars ?? {})) {
      if (avatar.expression) expressions[who] = avatar.expression;
    }
    if (scene.id !== lineId) continue;
    const sid = scene.speakerCharacterId;
    const speaker = sid && profiles.speakers[sid] ? sid : (profiles.speakerNames[textOf(scene.speaker)] ?? null);
    return { lineId, text: textOf(scene.text), speaker, expression: expressions[sid ?? ''] ?? 'neutral' };
  }
  return null;
}

/** 声の説明（話者の声質 + キャラ固有のボイス指導 + 表情に応じた演技 + 囁き・叫び） */
export function defaultCaption(line: VoiceLine, profiles: VoiceProfiles): string {
  const voice = line.speaker ? profiles.speakers[line.speaker] : undefined;
  const base = (voice?.caption ?? '') + (voice?.direction ?? '');
  if (line.text.startsWith('（')) return base + profiles.whisperCaption;
  let caption = base + (profiles.moods[line.expression] ?? profiles.moods.neutral ?? '');
  if ((line.text.match(/！/g) ?? []).length >= 2) caption += profiles.shoutCaption;
  return caption;
}

/** 合成に渡す本文（伏せ字の「◯」はピー音ネタとして「ピー」と読ませる） */
export function ttsText(text: string): string {
  return text.replaceAll('◯', 'ピー');
}

/** ボイスのファイル名。本文が変わったセリフだけ作り直しになるよう、話者と本文のハッシュを付ける */
export function voiceFileName(lineId: string, speaker: string, text: string): string {
  const digest = createHash('sha1').update(`${speaker}|${text}`).digest('hex').slice(0, 8);
  return `v_${lineId}_${digest}.mp3`;
}
