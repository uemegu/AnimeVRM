import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';

/** 試聴用。同時に鳴るのは1つだけ */
export function useAudioPreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingUrl(null);
  }, []);

  const toggle = useCallback(
    (url: string) => {
      if (playingUrl === url) {
        stop();
        return;
      }
      audioRef.current?.pause();
      const audio = new Audio(resolveAssetUrl(url));
      audio.onended = () => setPlayingUrl((current) => (current === url ? null : current));
      audioRef.current = audio;
      setPlayingUrl(url);
      void audio.play().catch(() => setPlayingUrl(null));
    },
    [playingUrl, stop]
  );

  useEffect(() => stop, [stop]);

  return { playingUrl, toggle, stop };
}
