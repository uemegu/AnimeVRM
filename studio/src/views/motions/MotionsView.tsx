import { NavLink, useParams } from 'react-router';
import { useStudioData } from '../../data/useStudioData';
import { useI18n } from '../../i18n';
import { CalibratePanel } from './CalibratePanel';
import { GeneratePanel } from './GeneratePanel';
import { MotionLibrary } from './MotionLibrary';
import './motions.css';

const TABS = ['generate', 'library', 'calibrate'] as const;
type Tab = (typeof TABS)[number];

/**
 * モーション：ardy-mini での生成（候補の比較・採用）、登録済みモーションの一覧、接触点の校正
 */
export function MotionsView() {
  const { t } = useI18n();
  const { tab } = useParams();
  const current: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : 'generate';
  const { data, error, reload } = useStudioData();

  return (
    <div className="motions-view">
      <nav className="motions-tabs" role="tablist">
        {TABS.map((key) => (
          <NavLink key={key} to={`/motions/${key}`} role="tab" aria-selected={current === key} className={`inspector-tab${current === key ? ' active' : ''}`}>
            {t.motions.tabs[key]}
          </NavLink>
        ))}
      </nav>
      <div className="motions-body">
        {error && <p className="inspector-error">{t.player.loadFailed}</p>}
        {data && current === 'generate' && <GeneratePanel data={data} onSaved={reload} />}
        {data && current === 'library' && <MotionLibrary data={data} onChanged={reload} />}
        {data && current === 'calibrate' && <CalibratePanel data={data} />}
      </div>
    </div>
  );
}
