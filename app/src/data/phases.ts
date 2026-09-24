import { DayPhase } from '../types/game';

/** 時間帯（フェーズ）の表示名 */
export const PHASE_NAMES: Record<DayPhase, { ja: string; en: string }> = {
  morning: { ja: '朝（登校）', en: 'Morning' },
  morning_action: { ja: '午前', en: 'Morning Action' },
  lunch_action: { ja: '昼休み', en: 'Lunch Action' },
  afterschool_action: { ja: '放課後', en: 'Afterschool' },
  holiday_action: { ja: '休日', en: 'Holiday' },
  night: { ja: '夜', en: 'Night' },
};
