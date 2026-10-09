import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { StageQualityLevel } from '@anime-vrm/engine/stage/quality';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';

const STORAGE_KEY = 'studio_render_quality';

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
}

const RenderQualityContext = createContext<RenderQuality>({ level: undefined, setLevel: () => {}, onSlowFrames: () => {} });

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
  const value = useMemo(() => ({ level, setLevel, onSlowFrames }), [level, setLevel, onSlowFrames]);
  return <RenderQualityContext.Provider value={value}>{children}</RenderQualityContext.Provider>;
}

export const useRenderQuality = () => useContext(RenderQualityContext);
