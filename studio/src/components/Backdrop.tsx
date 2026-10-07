import { useEffect, useState, useSyncExternalStore } from 'react';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';
import './Backdrop.css';

/**
 * 画面の背面（サイドメニュー以外）に、選んでいる場所の遠景をすりガラス越しのように敷く。
 * 使う画面が useBackdrop を呼んでいる間だけ出る。最後に選んだ遠景はブラウザに覚え、次に開いたときも使う
 */

const STORAGE_KEY = 'studio_backdrop_url';

function storedUrl(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let state = { users: 0, url: storedUrl() };
const listeners = new Set<() => void>();

function update(next: Partial<typeof state>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 場所を表す画像。簡易3Dの場所は遠景が空だけ（sky-only.png）でぼかすと無地になるので、サムネイルを優先する
 */
export function locationBackdropUrl(location?: { thumbnail?: string; layers?: { background?: { url?: string } } } | null): string | undefined {
  return location?.thumbnail ?? location?.layers?.background?.url;
}

/** この画面で背景を敷く。url を渡すとそれに切り替え（覚える）、渡さなければ最後に使った遠景のまま */
export function useBackdrop(url?: string | null) {
  useEffect(() => {
    update({ users: state.users + 1 });
    return () => update({ users: state.users - 1 });
  }, []);
  useEffect(() => {
    if (!url || url === state.url) return;
    update({ url });
    try {
      localStorage.setItem(STORAGE_KEY, url);
    } catch {
      // 覚えられなくても今の画面では使える
    }
  }, [url]);
}

/** 背景を敷いているか（Layout が見た目を切り替えるため） */
export function useBackdropActive(): boolean {
  return useSyncExternalStore(subscribe, () => state.users > 0 && !!state.url);
}

/** 背面の層。遠景を切り替えたら新しい方をふわっと重ねる */
export function BackdropLayer() {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  const active = snapshot.users > 0 && !!snapshot.url;
  const [layers, setLayers] = useState<string[]>(snapshot.url ? [snapshot.url] : []);

  useEffect(() => {
    const url = snapshot.url;
    if (!url) return;
    setLayers((prev) => (prev[prev.length - 1] === url ? prev : [...prev.slice(-1), url]));
  }, [snapshot.url]);

  if (!active) return null;
  return (
    <div className="studio-backdrop" aria-hidden="true">
      {layers.map((url, i) => (
        <div
          key={url}
          className={`studio-backdrop-image${i === layers.length - 1 && layers.length > 1 ? ' entering' : ''}`}
          style={{ backgroundImage: `url("${resolveAssetUrl(url)}")` }}
          onAnimationEnd={() => setLayers((prev) => prev.slice(-1))}
        />
      ))}
      <div className="studio-backdrop-wash" />
      <div className="studio-backdrop-grain" />
    </div>
  );
}
