import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { StageQualityLevel } from '@anime-vrm/engine/stage/quality';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';

const STORAGE_KEY = 'studio_render_quality';
const CLOTH_KEY = 'studio_cloth';
const CLOTH_SLEEP_KEY = 'studio_cloth_sleep';

/** 保存した ON/OFF。なければ fallback */
function storedFlag(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === 'true' || stored === 'false') return stored === 'true';
  } catch {
    // 保存できない環境では既定のまま
  }
  return fallback;
}
function storeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // 保存できなくても、開いている間は切り替わる
  }
}

function initialLevel(): StageQualityLevel {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'high' || stored === 'low') return stored;
  } catch {
    // 保存できない環境では高品質から始める
  }
  return 'high';
}

interface RenderQuality {
  /** 舞台の描画の品質。Provider の外（撮影ページ）では undefined で、描画側の既定に任せる */
  level: StageQualityLevel | undefined;
  setLevel: (level: StageQualityLevel) => void;
  /** 舞台の描画が間に合わないと知らせてきたとき（StageManager の onSlowFrames） */
  onSlowFrames: () => void;
  /** スカート・上着を布として動かす（engine の skirtCloth。既定は切） */
  cloth: boolean;
  setCloth: (on: boolean) => void;
  /** 布が止まったら眠らせて計算を休む（engine の clothSleep。既定は入） */
  clothSleep: boolean;
  setClothSleep: (on: boolean) => void;
}

const RenderQualityContext = createContext<RenderQuality>({ level: undefined, setLevel: () => {}, onSlowFrames: () => {}, cloth: false, setCloth: () => {}, clothSleep: true, setClothSleep: () => {} });

/**
 * 舞台の描画の品質（設定画面で選ぶ。保存する）。
 * 描画が間に合わないと知らされたら軽量に下げ、Toast で知らせる。高品質に戻しても、間に合わなければまた下げる
 */
export function RenderQualityProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { t } = useI18n();
  const [level, setLevelState] = useState(initialLevel);
  // 舞台が複数あっても1回だけ下げて知らせるよう、最新の値を同期で持つ
  const levelRef = useRef(level);
  const setLevel = useCallback((next: StageQualityLevel) => {
    levelRef.current = next;
    setLevelState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 保存できなくても、開いている間は切り替わる
    }
  }, []);
  const onSlowFrames = useCallback(() => {
    if (levelRef.current === 'low') return;
    setLevel('low');
    toast(t.settings.qualityLowered, 'info');
  }, [setLevel, toast, t]);
  const [cloth, setClothState] = useState(() => storedFlag(CLOTH_KEY, false));
  const [clothSleep, setClothSleepState] = useState(() => storedFlag(CLOTH_SLEEP_KEY, true));
  const setCloth = useCallback((on: boolean) => { setClothState(on); storeFlag(CLOTH_KEY, on); }, []);
  const setClothSleep = useCallback((on: boolean) => { setClothSleepState(on); storeFlag(CLOTH_SLEEP_KEY, on); }, []);
  const value = useMemo(
    () => ({ level, setLevel, onSlowFrames, cloth, setCloth, clothSleep, setClothSleep }),
    [level, setLevel, onSlowFrames, cloth, setCloth, clothSleep, setClothSleep],
  );
  return <RenderQualityContext.Provider value={value}>{children}</RenderQualityContext.Provider>;
}

export const useRenderQuality = () => useContext(RenderQualityContext);
