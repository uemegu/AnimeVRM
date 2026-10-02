import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, READ_ONLY, type AssetEntry } from '../../api/client';
import { Icon } from '../../components/Icon';
import { format, useI18n } from '../../i18n';

/** assets/se/<name>.<ext> の name.ext */
function seFileName(url: string): string {
  return url.replace(/^\/se\//, '');
}

interface Props {
  /** 見出しの位置に出すもの（BGM・効果音の切り替え） */
  heading: ReactNode;
  playingUrl: string | null;
  muted: boolean;
  onToggle: (url: string) => void;
  onToggleMute: () => void;
}

/**
 * 効果音の一覧（assets/se）。試聴と、手元の音声ファイルの登録ができる。シナリオではカットの seUrl にパスを書く
 */
export function SeLibrary({ heading, playingUrl, muted, onToggle, onToggleMute }: Props) {
  const { t } = useI18n();
  const tv = t.viewer;
  const [files, setFiles] = useState<AssetEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    api.assets('se').then(setFiles, () => setMessage(t.common.loadFailed));
  }, [t]);

  // 登録した効果音が見えるところまで送る
  const [reveal, setReveal] = useState<string | null>(null);
  useEffect(() => {
    if (!reveal) return;
    listRef.current?.querySelector(`[data-url="${CSS.escape(reveal)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [reveal, files]);

  const shown = files.filter((f) => seFileName(f.url).toLowerCase().includes(filter.toLowerCase()));

  const upload = async (file: File) => {
    setMessage(null);
    setUploading(true);
    try {
      let result;
      try {
        result = await api.uploadAsset('se', file.name, file);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 409) || !window.confirm(format(tv.voiceOverwrite, { name: file.name }))) throw err;
        result = await api.uploadAsset('se', file.name, file, true);
      }
      setFiles(await api.assets('se'));
      setMessage(format(tv.voiceUploaded, { name: file.name }));
      setFilter('');
      setReveal(result.url);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) return;
      setMessage(`${tv.voiceUploadFailed}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="viewer-section grow">
      <div className="viewer-section-title">
        {heading}
        <div className="viewer-section-actions">
          <button type="button" className={`viewer-mini-btn${muted ? ' active' : ''}`} aria-pressed={muted} title={muted ? t.player.muted : t.player.sound} onClick={onToggleMute}>
            <Icon name={muted ? 'soundOff' : 'soundOn'} size={14} />
          </button>
          {!READ_ONLY && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".mp3,.ogg,.wav,audio/mpeg,audio/ogg,audio/wav"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void upload(file);
                }}
              />
              <button type="button" className="viewer-mini-btn wide" disabled={uploading} title={tv.seUploadHint} onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={14} />
                {uploading ? tv.voiceUploading : tv.voiceUpload}
              </button>
            </>
          )}
        </div>
      </div>
      <input className="input" placeholder={tv.searchSe} value={filter} onChange={(e) => setFilter(e.target.value)} />
      {message && <p className="viewer-note">{message}</p>}
      <ul className="viewer-motion-list viewer-voice-list" ref={listRef}>
        {shown.map((f) => {
          const playing = playingUrl === f.url;
          return (
            <li key={f.url} data-url={f.url}>
              <button type="button" className={playing ? 'active' : ''} onClick={() => onToggle(f.url)}>
                <span className="viewer-voice-icon">
                  <Icon name={playing ? 'stop' : 'play'} size={12} />
                </span>
                <span className="viewer-voice-name">{seFileName(f.url)}</span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="viewer-empty">{tv.noSe}</li>}
      </ul>
    </section>
  );
}
