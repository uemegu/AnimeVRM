import type { CallScenario, CharacterBook, MailScenario, ScenarioCategory, ScenarioPackage } from '@anime-vrm/scenario';
import { kindOf, textOf } from './scenarioStore.ts';

export interface CharacterLine {
  lineId: string;
  text: string;
  /** ボイスの URL パス（assets/ 基準。例: /scenarios/ending/ending_good/v_s1_xxx.mp3） */
  voiceUrl?: string;
}

export interface CharacterScenarioUsage {
  category: ScenarioCategory;
  id: string;
  title: string;
  /** 登場する（立ち絵・モデルとして出る、または話す）シーン・ステップの数 */
  appearances: number;
  /** このキャラのセリフ */
  lines: CharacterLine[];
}

export interface ScenarioRecord {
  category: ScenarioCategory;
  id: string;
  data: ScenarioPackage | CallScenario | MailScenario;
}

function voicePath(category: string, id: string, voiceUrl: string | undefined): string | undefined {
  if (!voiceUrl) return undefined;
  return voiceUrl.startsWith('/') ? voiceUrl : `/scenarios/${category}/${id}/${voiceUrl}`;
}

/**
 * キャラクターからの逆引き。どのシナリオに出て、どのセリフ（ボイス）があるか
 */
export function characterUsage(characterId: string, book: CharacterBook, scenarios: ScenarioRecord[]): CharacterScenarioUsage[] {
  const character = book.characters.find((c) => c.id === characterId);
  if (!character) return [];
  const names = new Set([character.name.ja, ...character.speakerNames]);
  const result: CharacterScenarioUsage[] = [];

  for (const { category, id, data } of scenarios) {
    const usage: CharacterScenarioUsage = { category, id, title: textOf(data.title), appearances: 0, lines: [] };
    const kind = kindOf(category);
    if (kind === 'call' || kind === 'mail') {
      const comm = data as CallScenario | MailScenario;
      if (comm.characterId !== characterId) continue;
      if (kind === 'call') {
        for (const [lineId, step] of Object.entries((comm as CallScenario).steps)) {
          usage.appearances++;
          usage.lines.push({ lineId, text: textOf(step.text), voiceUrl: voicePath(category, id, step.voiceUrl) });
        }
      } else {
        for (const message of (comm as MailScenario).messages) {
          usage.appearances++;
          if (message.sender === 'heroine') usage.lines.push({ lineId: message.id, text: textOf(message.text) });
        }
      }
    } else {
      for (const scene of (data as ScenarioPackage).scenes) {
        const onStage = Object.entries(scene.avatars ?? {}).some(([key, avatar]) => (avatar.characterId ?? key) === characterId);
        const speaks = scene.speakerCharacterId
          ? scene.speakerCharacterId === characterId
          : names.has(textOf(scene.speaker));
        if (onStage || speaks) usage.appearances++;
        if (speaks) usage.lines.push({ lineId: scene.id, text: textOf(scene.text), voiceUrl: voicePath(category, id, scene.voiceUrl) });
      }
    }
    if (usage.appearances > 0) result.push(usage);
  }
  return result;
}
