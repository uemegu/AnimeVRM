import { useCallback, useEffect, useRef, useState } from 'react';
import type { StageManager } from '@anime-vrm/engine/stage/StageManager';
import type { StageCastMember } from '@anime-vrm/engine/stage/types';
import { useI18n } from '../i18n';
import './stageLoading.css';

/** 表示直後のちらつきを避けるため、これより短い読み込みでは出さない（ミリ秒） */
const SHOW_DELAY_MS = 150;

/**
 * 舞台のアバター読み込み中かどうか。setCast を呼ぶときは run を通す
 * （新しい呼び出しが来たら古いものの完了は無視する）
 */
export function useCastLoading(managerRef: { current: StageManager | null }) {
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const run = useCallback(
    (cast: StageCastMember[]) => {
      const manager = managerRef.current;
      if (!manager) return;
      const id = ++seq.current;
      window.clearTimeout(timer.current);
      if (cast.length > 0) timer.current = window.setTimeout(() => id === seq.current && setLoading(true), SHOW_DELAY_MS);
      const done = () => {
        if (id !== seq.current) return;
        window.clearTimeout(timer.current);
        setLoading(false);
      };
      manager.setCast(cast).then(done, done);
    },
    [managerRef]
  );
  return { loading, run };
}

/** 舞台の上に重ねるローディング表示（親は position が static 以外であること） */
export function StageLoading({ show }: { show: boolean }) {
  const { t } = useI18n();
  return (
    <div className={`stage-loading${show ? ' is-on' : ''}`} role="status" aria-live="polite" aria-hidden={!show}>
      <div className="stage-loading-card">
        <span className="stage-loading-spinner" />
        <span>{t.common.loading}</span>
      </div>
    </div>
  );
}
