import locations from '../../../assets/studio/locations.json';
import type { LocationVisualPreset } from '../types/visual';

/**
 * 場所ごとの背景（遠景・中景・近景）。中身は Studio のシーン設定（assets/studio/locations.json）。
 * JSON の座標の組（[x, z] など）は配列として推論されるので、unknown を経て型を当てる（形の検証は npm run validate）
 */
export const LOCATION_VISUAL_PRESETS = locations.presets as unknown as Record<string, LocationVisualPreset>;
