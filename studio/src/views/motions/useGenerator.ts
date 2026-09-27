import { useEffect, useState } from 'react';
import { ArdyMotionGenerator, type ArdyStatus } from '@anime-vrm/motion/ardy/generator';

// モデル（約650MB）は一度読み込んだら画面を離れても使い回す
let shared: ArdyMotionGenerator | null = null;
const listeners = new Set<(status: ArdyStatus) => void>();
let lastStatus: ArdyStatus = { state: 'unloaded', detail: '', ready: false };

function generator(): ArdyMotionGenerator {
  shared ??= new ArdyMotionGenerator((status) => {
    lastStatus = status;
    listeners.forEach((listener) => listener(status));
  });
  return shared;
}

export const webGpuAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator && globalThis.isSecureContext;

/** ardy-mini の生成処理と読み込みの状態 */
export function useGenerator() {
  const [status, setStatus] = useState<ArdyStatus>(lastStatus);
  useEffect(() => {
    listeners.add(setStatus);
    return () => {
      listeners.delete(setStatus);
    };
  }, []);

  const load = async () => {
    const g = generator();
    try {
      await g.init();
      setStatus({ ...g.status });
      lastStatus = { ...g.status };
    } catch {
      setStatus({ ...g.status });
    }
  };

  return { status, load, generator: status.ready ? generator() : null };
}
