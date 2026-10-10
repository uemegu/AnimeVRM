import type { LocationVisualPreset } from '@anime-vrm/scenario';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';
import { useI18n } from '../i18n';
import './LocationPicker.css';

/** 場所のサムネ一覧。簡易3D（3D環境あり）を先に、一枚絵を後に、見出し付きで並べる。 */
export function LocationPicker({
  locations,
  selectedId,
  onSelect,
}: {
  locations: Record<string, LocationVisualPreset>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  const all = Object.values(locations);
  const groups = [
    { key: 'painted3d' as const, items: all.filter((loc) => loc.environment?.model) },
    { key: 'illustration' as const, items: all.filter((loc) => !loc.environment?.model) },
  ].filter((group) => group.items.length > 0);
  return (
    <>
      {groups.map((group) => (
        <section key={group.key} className="viewer-location-group">
          <h3 className="viewer-location-group-title">{t.viewer.locationGroups[group.key]}</h3>
          <div className="viewer-location-group-items">
            {group.items.map((loc) => {
              const bgUrl = loc.thumbnail ?? loc.layers?.background?.url;
              return (
                <button
                  key={loc.id}
                  type="button"
                  className={`viewer-location-thumb${loc.id === selectedId ? ' active' : ''}`}
                  title={loc.name}
                  onClick={() => onSelect(loc.id)}
                >
                  {bgUrl ? (
                    <img src={resolveAssetUrl(bgUrl)} alt={loc.name} loading="lazy" />
                  ) : (
                    <div className="viewer-location-thumb-fallback">{loc.name}</div>
                  )}
                  <span className="viewer-location-thumb-name">{loc.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
