import locations from '../../../assets/studio/locations.json';
import type { LocationVisualPreset } from '../types/visual';

/** 場所ごとの背景（遠景・中景・近景）。中身は Studio のシーン設定（assets/studio/locations.json） */
export const LOCATION_VISUAL_PRESETS = locations.presets as Record<string, LocationVisualPreset>;
