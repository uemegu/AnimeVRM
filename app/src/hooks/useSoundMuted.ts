import { useSyncExternalStore } from 'react';
import { soundManager } from '../services/audio/SoundManager';

/** ミュート状態（MUTEボタン表示用）。切り替えは soundManager.toggleMuted() */
export function useSoundMuted(): boolean {
  return useSyncExternalStore(soundManager.subscribeMuted, soundManager.getIsMuted);
}
