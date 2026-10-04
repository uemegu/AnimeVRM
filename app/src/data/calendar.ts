/**
 * ゲーム内の暦（天気など、日付で決まること）
 */

/** 雨の日（Day 1 = 月曜）。シナリオの availability.weather の判定と、雨のシーンの目安に使う */
export const RAINY_DAYS: readonly number[] = [9, 16];

export type Weather = 'clear' | 'rain';

export function weatherOf(day: number): Weather {
  return RAINY_DAYS.includes(day) ? 'rain' : 'clear';
}
