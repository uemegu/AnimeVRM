import { useEffect, useMemo, useState } from 'react';
import type { StudioData } from '../../data/useStudioData';
import { api, READ_ONLY } from '../../api/client';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { format, useI18n } from '../../i18n';
import { MotionPreview } from './MotionPreview';

/** 登録できる名前（サーバーの規則と同じ） */
const MOTION_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9 _-]{0,62}[A-Za-z0-9])?$/;

/** ファイル名から名前の案（拡張子を外し、使えない文字を空白にする） */
const nameFromFile = (fileName: string) =>
  fileName
    .replace(/\.fbx$/i, '')
    .replace(/[^A-Za-z0-9 _-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
    .slice(0, 64);

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** 手元の FBX（再生用の URL と、保存用の中身） */
interface PickedFile {
  url: string;
  fbx: string;
}

/**
 * 登録済みのモーション（assets/animations）。選ぶと再生し、ループの設定（motions.json）を変えられる。
 * 「＋」で手元の FBX を再生して確かめ、名前を付けて登録する
 */
export function MotionLibrary({ data, onChanged }: { data: StudioData; onChanged: () => void }) {
  const { t } = useI18n();
  const tm = t.motions;
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [name, setName] = useState('');
  const [loop, setLoop] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(data.characters.characters[0]?.models[0]?.url ?? '/models/aoi/aoi-school.vrm');
  const avatars = useMemo(
    () => data.characters.characters.flatMap((c) => c.models.map((m) => ({ url: m.url, label: `${c.name.ja}（${m.label.ja}）` }))),
    [data]
  );
  const names = data.animations.filter((n) => !/\.cand\d+$/.test(n) && n.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => () => void (picked && URL.revokeObjectURL(picked.url)), [picked]);

  const saveLoop = async (motion: string, value: boolean) => {
    const motions = { ...data.motions };
    if (value) motions[motion] = { ...motions[motion], loop: true };
    else delete motions[motion];
    try {
      await api.saveStudioData('motions', { motions });
      toast(format(value ? tm.loopOn : tm.loopOff, { name: motion }));
    } catch {
      toast(t.common.saveFailed, 'error');
    }
    onChanged();
  };

  const startRegister = () => {
    setRegistering(true);
    setSelected(null);
    setPicked(null);
    setName('');
    setLoop(false);
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    const buffer = await file.arrayBuffer();
    setPicked({ url: URL.createObjectURL(new Blob([buffer], { type: 'application/octet-stream' })), fbx: toBase64(buffer) });
    setName(nameFromFile(file.name));
  };

  const register = async (overwrite = false): Promise<void> => {
    if (!picked) return;
    const res = await api.saveMotion({ name, fbx: picked.fbx, loop, overwrite });
    if (res.status === 409 && !overwrite) {
      if (window.confirm(tm.overwrite)) return register(true);
      return;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(`${t.common.saveFailed}（${body.error ?? res.status}）`, 'error');
      return;
    }
    toast(format(tm.registered, { name }));
    setRegistering(false);
    setPicked(null);
    setSelected(name);
    onChanged();
  };

  const nameValid = MOTION_NAME.test(name);
  const previewMotion = registering ? (picked?.url ?? null) : selected;

  return (
    <div className="motion-library">
      <aside className="motion-list">
        <p className="field-hint">{tm.libraryHint}</p>
        <div className="motion-list-head">
          <input className="input" placeholder={tm.search} value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="button" className={`btn icon${registering ? ' active' : ''}`} onClick={startRegister} disabled={READ_ONLY} title={READ_ONLY ? t.common.readOnly : tm.register} aria-label={tm.register}>
            <Icon name="plus" />
          </button>
        </div>
        <table className="motion-table">
          <thead>
            <tr>
              <th />
              <th>{tm.loopColumn}</th>
            </tr>
          </thead>
          <tbody>
            {names.map((n) => (
              <tr key={n} className={!registering && selected === n ? 'selected' : ''}>
                <td>
                  <button
                    type="button"
                    className="motion-name"
                    onClick={() => {
                      setRegistering(false);
                      setSelected(n);
                    }}
                  >
                    {n}
                    {n.startsWith('ardy_') && <span className="cut-badge">{tm.generated}</span>}
                  </button>
                </td>
                <td className="motion-loop">
                  <input type="checkbox" checked={!!data.motions[n]?.loop} onChange={(e) => saveLoop(n, e.target.checked)} disabled={READ_ONLY} aria-label={tm.loopColumn} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </aside>
      <section className="motion-stage">
        <label className="field motion-avatar">
          <span className="field-label">{tm.avatar}</span>
          <select className="select" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}>
            {avatars.map((a) => (
              <option key={a.url} value={a.url}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        {registering && (
          <div className="motion-register">
            <p className="field-hint">{tm.registerHint}</p>
            <div className="motion-adopt">
              <label className="field">
                <span className="field-label">{tm.chooseFile}</span>
                <input className="input" type="file" accept=".fbx" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
              <label className="field">
                <span className="field-label">{tm.registerName}</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!picked} />
              </label>
              <label className="inspector-check">
                <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} disabled={!picked} />
                {tm.loopFlag}
              </label>
              <button type="button" className="btn primary" disabled={!picked || !nameValid} onClick={() => register()}>
                {tm.registerSubmit}
              </button>
            </div>
            {picked && name && !nameValid && <p className="field-hint error">{tm.registerNameInvalid}</p>}
          </div>
        )}
        <div className="motion-canvas">
          <MotionPreview data={data} avatarUrl={avatarUrl} motion={previewMotion} cue={previewMotion ?? 'idle'} />
        </div>
      </section>
    </div>
  );
}
