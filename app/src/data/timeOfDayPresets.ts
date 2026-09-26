import timeOfDay from '../../../assets/studio/time-of-day.json';
import type { TimeOfDayId, TimeOfDayPreset } from '../types/visual';

/** 時間帯ごとの見た目。中身は Studio のシーン設定（assets/studio/time-of-day.json） */
export const TIME_OF_DAY_PRESETS = timeOfDay.presets as unknown as Record<TimeOfDayId, TimeOfDayPreset>;
