import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';
import { Icon } from '../components/Icon';

export interface CatalogEntry {
  key: string;
  title: string;
  /** 種類など、タイトルの上に小さく出す文字 */
  label?: string;
  description?: string;
  /** サムネイル（場所の遠景など） */
  image?: string;
}

/** 再生するシナリオの一覧（カード） */
export function ScenarioCatalog({ entries, onSelect }: { entries: CatalogEntry[]; onSelect: (key: string) => void }) {
  return (
    <ul className="catalog">
      {entries.map((entry) => (
        <li key={entry.key}>
          <button type="button" className="catalog-card" onClick={() => onSelect(entry.key)}>
            <span className="catalog-thumb" style={entry.image ? { backgroundImage: `url("${resolveAssetUrl(entry.image)}")` } : undefined}>
              <span className="catalog-play">
                <Icon name="play" size={18} />
              </span>
            </span>
            <span className="catalog-body">
              {entry.label && <span className="catalog-label">{entry.label}</span>}
              <span className="catalog-title">{entry.title}</span>
              {entry.description && <span className="catalog-desc">{entry.description}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
