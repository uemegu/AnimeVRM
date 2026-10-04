import { useEffect, useRef, useSyncExternalStore } from 'react';
import './Ambient.css';

/**
 * 再生中の舞台の色を、サイドメニューの裏に光としてにじませる（YouTube のアンビエントライト風）。
 * 舞台の左端を小さく読み取り、サイドメニュー側へ鏡写しに広げて強くぼかす
 */

let source: HTMLCanvasElement | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 光の元にする canvas を登録する（null で外す） */
export function setAmbientSource(canvas: HTMLCanvasElement | null) {
  if (source === canvas) return;
  source = canvas;
  listeners.forEach((l) => l());
}

export function useAmbientActive(): boolean {
  return useSyncExternalStore(subscribe, () => source !== null);
}

/** 読み取る幅（舞台の左から何割か）と、読み取る大きさ */
const SAMPLE_RATIO = 0.3;
const SAMPLE_W = 16;
const SAMPLE_H = 24;
const FRAME_MS = 1000 / 15;

/** サイドメニューの裏に敷く光の層 */
export function AmbientLayer() {
  const canvas = useSyncExternalStore(subscribe, () => source);
  const outRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const out = outRef.current;
    const ctx = out?.getContext('2d');
    if (!canvas || !out || !ctx) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS || canvas.width === 0 || canvas.height === 0) return;
      last = now;
      const sw = canvas.width * SAMPLE_RATIO;
      // 舞台の左端がサイドメニューの右端につながるよう、左右を反転して描く
      ctx.setTransform(-1, 0, 0, 1, SAMPLE_W, 0);
      try {
        ctx.drawImage(canvas, 0, 0, sw, canvas.height, 0, 0, SAMPLE_W, SAMPLE_H);
      } catch {
        // 読み取れない瞬間（作り直し中など）は前の光のまま
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [canvas]);

  if (!canvas) return null;
  return (
    <div className="studio-ambient" aria-hidden="true">
      <canvas ref={outRef} width={SAMPLE_W} height={SAMPLE_H} />
    </div>
  );
}

/** 舞台全体を読み取る大きさ（縦型の舞台に合わせて縦長） */
const GLOW_W = 18;
const GLOW_H = 32;

/**
 * 再生画面の枠の外に、舞台全体の色をすりガラス越しのようににじませる（縦型で左右に空く余白を埋める）。
 * 見せるかどうかは CSS で決める（縦型のプレイヤーがあるときだけ）
 */
export function StageGlowLayer() {
  const canvas = useSyncExternalStore(subscribe, () => source);
  const outRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const out = outRef.current;
    const ctx = out?.getContext('2d');
    if (!canvas || !out || !ctx) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS || canvas.width === 0 || canvas.height === 0) return;
      last = now;
      try {
        ctx.drawImage(canvas, 0, 0, GLOW_W, GLOW_H);
      } catch {
        // 読み取れない瞬間（作り直し中など）は前の光のまま
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [canvas]);

  if (!canvas) return null;
  return (
    <div className="stage-glow" aria-hidden="true">
      <canvas ref={outRef} width={GLOW_W} height={GLOW_H} />
      <div className="studio-backdrop-wash" />
      <div className="studio-backdrop-grain" />
    </div>
  );
}
