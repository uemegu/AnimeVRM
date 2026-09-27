import { useMemo, useState } from 'react';
import type { StudioData } from '../../data/useStudioData';
import { api } from '../../api/client';
import { useI18n } from '../../i18n';
import { MotionPreview } from './MotionPreview';

/**
 * 登録済みのモーション（assets/animations）。選ぶと再生し、ループの設定（motions.json）を変えられる
 */
export function MotionLibrary({ data, onChanged }: { data: StudioData; onChanged: () => void }) {
  const { t } = useI18n();
  const tm = t.motions;
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(data.characters.characters[0]?.models[0]?.url ?? '/models/aoi/aoi-school.vrm');
  const avatars = useMemo(
    () => data.characters.characters.flatMap((c) => c.models.map((m) => ({ url: m.url, label: `${c.name.ja}（${m.label.ja}）` }))),
    [data]
  );
  const names = data.animations.filter((name) => !/\.cand\d+$/.test(name) && name.toLowerCase().includes(query.toLowerCase()));

  const setLoop = async (name: string, loop: boolean) => {
    const motions = { ...data.motions };
    if (loop) motions[name] = { ...motions[name], loop: true };
    else delete motions[name];
    await api.saveStudioData('motions', { motions });
    onChanged();
  };

  return (
    <div className="motion-library">
      <aside className="motion-list">
        <p className="field-hint">{tm.libraryHint}</p>
        <input className="input" placeholder={tm.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <table className="motion-table">
          <thead>
            <tr>
              <th />
              <th>{tm.loopColumn}</th>
            </tr>
          </thead>
          <tbody>
            {names.map((name) => (
              <tr key={name} className={selected === name ? 'selected' : ''}>
                <td>
                  <button type="button" className="motion-name" onClick={() => setSelected(name)}>
                    {name}
                    {name.startsWith('ardy_') && <span className="cut-badge">{tm.generated}</span>}
                  </button>
                </td>
                <td className="motion-loop">
                  <input type="checkbox" checked={!!data.motions[name]?.loop} onChange={(e) => setLoop(name, e.target.checked)} aria-label={tm.loopColumn} />
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
        <div className="motion-canvas">
          <MotionPreview data={data} avatarUrl={avatarUrl} motion={selected} cue={selected ?? 'idle'} />
        </div>
      </section>
    </div>
  );
}
