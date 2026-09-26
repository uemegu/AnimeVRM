import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CallScenario, ScenarioPackage } from '@anime-vrm/scenario';
import { textOf } from '../scenarioStore.ts';

/** assets/studio/voice-profiles.json */
export interface VoiceProfiles {
  speakers: Record<string, { ref: string; caption: string; postprocess?: string }>;
  moods: Record<string, string>;
  whisperCaption: string;
  shoutCaption: string;
  /** 画面にいない人物の名前 → 話者 ID */
  speakerNames: Record<string, string>;
}

export async function loadVoiceProfiles(assetsDir: string): Promise<VoiceProfiles> {
  return JSON.parse(await fs.readFile(path.join(assetsDir, 'studio', 'voice-profiles.json'), 'utf8'));
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

/** 声の説明（話者の声質 + 表情に応じた演技 + 囁き・叫び） */
export function defaultCaption(line: VoiceLine, profiles: VoiceProfiles): string {
  const base = line.speaker ? (profiles.speakers[line.speaker]?.caption ?? '') : '';
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
