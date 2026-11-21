import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { BgmBook } from '@anime-vrm/scenario';
import { api, ApiError, READ_ONLY, type AssetEntry } from '../../api/client';
import { Icon } from '../../components/Icon';
import { format, useI18n } from '../../i18n';
import { emptyProjectData } from '@anime-vrm/scenario';
import { useProjects } from '../../data/useProjects';
import { fetchProjectData, saveProjectData, type DataScope } from '../../data/projectData';
import { SharedTag, SharedToggle } from '../../components/DataScope';

type BgmEntry = BgmBook['bgm'][string];

/** assets/bgm/<name>.<ext> の name */
function bgmFileName(url: string): string {
  return url.replace(/^\/bgm\//, '');
}

/** ファイル名から ID の候補を作る（英小文字・数字・_、先頭は英字） */
function idFromFile(url: string, taken: Record<string, unknown>): string {
  let base = bgmFileName(url)
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!/^[a-z]/.test(base)) base = `bgm_${base}`.replace(/_+$/, '');
  let id = base;
  for (let i = 2; Object.hasOwn(taken, id); i++) id = `${base}_${i}`;
  return id;
}

interface Draft {
  /** 既にある ID を直しているときはその ID。新しく登録するときは null */
  editing: string | null;
  id: string;
  url: string;
  ja: string;
  en: string;
  volumeScale: number;
  /** 置き場所（共通か、いまのプロジェクト専用か） */
  scope: DataScope;
}

interface Props {
  /** 見出しの位置に出すもの（BGM・効果音の切り替え） */
  heading: ReactNode;
  playingUrl: string | null;
  muted: boolean;
  onToggle: (url: string, volumeScale: number) => void;
  onVolume: (url: string, volumeScale: number) => void;
  onToggleMute: () => void;
}

/**
 * BGM の一覧（サイドバーで選んだプロジェクトで使えるもの：そのプロジェクト専用のものと、共通の assets/studio/bgm.json）。
 * 試聴と、音声ファイルの登録（bgm/ に置き、ID・曲名・音量を付ける）ができる。
 * 新しく登録するものはいまのプロジェクト専用。素材の置き場を持つプロジェクト（外部プロジェクト）では、ファイルもその置き場に置く
 */
export function BgmLibrary({ heading, playingUrl, muted, onToggle, onVolume, onToggleMute }: Props) {
  const { t, language } = useI18n();
  const tv = t.viewer;
  const { current: project } = useProjects();
  const [book, setBook] = useState<BgmBook | null>(null);
  /** いまのプロジェクト専用の BGM */
  const [own, setOwn] = useState<BgmBook['bgm']>({});
  const [files, setFiles] = useState<AssetEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(null);
    Promise.all([api.studioData<BgmBook>('bgm'), api.assets('bgm', project?.id), fetchProjectData(project?.id)]).then(
      ([bgm, list, projectData]) => {
        setBook(bgm);
        setOwn(projectData.bgm);
        setFiles(list);
      },
      () => setMessage(t.common.loadFailed)
    );
  }, [t, project?.id]);

  const scopeOf = (id: string): DataScope => (Object.hasOwn(own, id) ? 'project' : 'shared');
  const allEntries = [...Object.entries(book?.bgm ?? {}), ...Object.entries(own)];
  const taken = { ...book?.bgm, ...own };
  const entries = allEntries;
  /** プロジェクトの置き場にあるファイル（共通の BGM には使えない） */
  const inProjectDir = (url: string) => files.some((f) => f.url === url && f.project);
  const registeredUrls = new Set(allEntries.map(([, e]) => e.url));
  const unregistered = files.filter((f) => !registeredUrls.has(f.url));
  const q = filter.toLowerCase();
  const matches = (...texts: string[]) => texts.some((s) => s.toLowerCase().includes(q));
  const shownEntries = entries.filter(([id, e]) => matches(id, e.title.ja, e.title.en, e.url));
  const shownFiles = unregistered.filter((f) => matches(f.url));

  const startRegister = (url: string) => {
    if (!book) return;
    setMessage(null);
    // いまのプロジェクト専用に登録する（プロジェクトがない公開版では共通）
    const scope: DataScope = project ? 'project' : 'shared';
    setDraft({ editing: null, id: idFromFile(url, taken), url, ja: '', en: '', volumeScale: 1, scope });
  };
  const startEdit = (id: string, entry: BgmEntry) => {
    setMessage(null);
    setDraft({ editing: id, id, url: entry.url, ja: entry.title.ja, en: entry.title.en, volumeScale: entry.volumeScale, scope: scopeOf(id) });
  };

  const upload = async (file: File) => {
    setMessage(null);
    setUploading(true);
    // 素材の置き場を自分で持つプロジェクト（外部プロジェクト）なら、ファイルもその置き場に置く
    const target = project?.ownAssets ? project.id : undefined;
    try {
      let result;
      try {
        result = await api.uploadAsset('bgm', file.name, file, false, target);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 409) || !window.confirm(format(tv.voiceOverwrite, { name: file.name }))) throw err;
        result = await api.uploadAsset('bgm', file.name, file, true, target);
      }
      setFiles(await api.assets('bgm', project?.id));
      setFilter('');
      // 既に登録済みのファイルを上書きしたときは、ファイルを差し替えただけ
      if (registeredUrls.has(result.url)) setMessage(format(tv.voiceUploaded, { name: file.name }));
      else startRegister(result.url);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) return;
      setMessage(`${tv.voiceUploadFailed}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const idError =
    draft && !/^[a-z][a-z0-9_]*$/.test(draft.id)
      ? tv.bgmIdInvalid
      : draft && draft.editing === null && Object.hasOwn(taken, draft.id)
        ? tv.bgmIdTaken
        : null;
  const canSave = !!draft && !idError && draft.ja.trim() !== '' && draft.en.trim() !== '' && !saving;

  const save = async () => {
    if (!book || !draft || !canSave) return;
    const entry: BgmEntry = { url: draft.url, volumeScale: draft.volumeScale, title: { ja: draft.ja.trim(), en: draft.en.trim() } };
    // 置き場所を変えたときは、元の置き場から外して新しい置き場へ入れる
    const { [draft.id]: _shared, ...sharedRest } = book.bgm;
    const { [draft.id]: _own, ...ownRest } = own;
    const nextShared: BgmBook = { ...book, bgm: draft.scope === 'shared' ? { ...book.bgm, [draft.id]: entry } : sharedRest };
    const nextOwn = draft.scope === 'project' ? { ...own, [draft.id]: entry } : ownRest;
    setSaving(true);
    try {
      if (JSON.stringify(nextShared) !== JSON.stringify(book)) await api.saveStudioData('bgm', nextShared);
      if (project && JSON.stringify(nextOwn) !== JSON.stringify(own)) await saveProjectData(project.id, 'bgm', { ...emptyProjectData(), bgm: nextOwn });
      setBook(nextShared);
      setOwn(nextOwn);
      setMessage(format(tv.bgmSaved, { id: draft.id }));
      setDraft(null);
    } catch (err) {
      const detail = err instanceof ApiError && err.issues.length > 0 ? err.issues.map((i) => i.message).join(' / ') : err instanceof Error ? err.message : String(err);
      setMessage(`${t.common.saveFailed}: ${detail}`);
    } finally {
      setSaving(false);
    }
  };

  const playButton = (url: string, scale: number, label: string, sub?: string) => {
    const playing = playingUrl === url;
    return (
      <button type="button" className={playing ? 'active' : ''} onClick={() => onToggle(url, scale)}>
        <span className="viewer-voice-icon">
          <Icon name={playing ? 'stop' : 'play'} size={12} />
        </span>
        <span className="viewer-bgm-text">
          <span className="viewer-voice-name">{label}</span>
          {sub && <span className="viewer-bgm-sub">{sub}</span>}
        </span>
      </button>
    );
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
              <button type="button" className="viewer-mini-btn wide" disabled={uploading || !book || !!draft} title={tv.bgmUploadHint} onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={14} />
                {uploading ? tv.voiceUploading : tv.voiceUpload}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 登録・編集中はフォームだけを出す（サイドバーが狭いため） */}
      {!draft && <input className="input" placeholder={tv.searchBgm} value={filter} onChange={(e) => setFilter(e.target.value)} />}
      {message && <p className="viewer-note">{message}</p>}
      {!draft && (
        <ul className="viewer-motion-list viewer-voice-list viewer-bgm-list">
          {shownEntries.map(([id, entry]) => (
            <li key={id}>
              {playButton(entry.url, entry.volumeScale, entry.title[language], id)}
              {project && scopeOf(id) === 'shared' && <SharedTag />}
              {!READ_ONLY && (
                <button type="button" className="viewer-bgm-action" onClick={() => startEdit(id, entry)}>
                  {tv.bgmEdit}
                </button>
              )}
            </li>
          ))}
          {shownEntries.length === 0 && <li className="viewer-empty">{tv.noBgm}</li>}
          {shownFiles.length > 0 && <li className="viewer-bgm-heading">{tv.bgmUnregistered}</li>}
          {shownFiles.map((f) => (
            <li key={f.url}>
              {playButton(f.url, 1, bgmFileName(f.url))}
              {!READ_ONLY && (
                <button type="button" className="viewer-bgm-action" onClick={() => startRegister(f.url)}>
                  {tv.voiceUpload}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <div className="viewer-bgm-form">
          <div className="viewer-bgm-form-title">
            {draft.editing ? tv.bgmEditTitle : tv.bgmRegisterTitle}
            <span className="viewer-bgm-sub">{bgmFileName(draft.url)}</span>
          </div>
          <div className="viewer-bgm-preview">
            {playButton(draft.url, draft.volumeScale, playingUrl === draft.url ? t.common.stop : t.common.play)}
          </div>
          <label className="field">
            <span className="field-label">ID</span>
            <input className="input" value={draft.id} readOnly={draft.editing !== null} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
            <span className="field-hint">{idError ?? tv.bgmIdHint}</span>
          </label>
          {project && (
            <SharedToggle
              shared={draft.scope === 'shared'}
              onChange={(shared) => setDraft({ ...draft, scope: shared ? 'shared' : 'project' })}
              disabledReason={draft.scope === 'project' && inProjectDir(draft.url) ? t.dataScope.fileInProject : undefined}
            />
          )}
          <label className="field">
            <span className="field-label">{tv.bgmTitleJa}</span>
            <input className="input" value={draft.ja} onChange={(e) => setDraft({ ...draft, ja: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">{tv.bgmTitleEn}</span>
            <input className="input" value={draft.en} onChange={(e) => setDraft({ ...draft, en: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">
              {tv.bgmVolume} <span className="viewer-bgm-sub">{draft.volumeScale.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={draft.volumeScale}
              onChange={(e) => {
                const volumeScale = Number(e.target.value);
                setDraft({ ...draft, volumeScale });
                onVolume(draft.url, volumeScale);
              }}
            />
            <span className="field-hint">{tv.bgmVolumeHint}</span>
          </label>
          <div className="viewer-bgm-form-actions">
            <button type="button" className="btn" onClick={() => setDraft(null)}>
              {t.common.cancel}
            </button>
            <button type="button" className="btn primary" disabled={!canSave} onClick={() => void save()}>
              {saving ? t.common.saving : t.common.save}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
