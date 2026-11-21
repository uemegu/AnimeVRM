import { useI18n } from '../i18n';
import './DataScope.css';

/**
 * 項目を共通にするか（すべてのプロジェクトで使う）。外せばいまのプロジェクト専用。
 * プロジェクトはサイドバーでだけ選ぶ。ここでは項目の性質として共通かどうかだけを決める
 */
export function SharedToggle({ shared, onChange, disabledReason }: { shared: boolean; onChange: (shared: boolean) => void; disabledReason?: string }) {
  const { t } = useI18n();
  return (
    <label className="shared-toggle" title={disabledReason ?? (shared ? t.dataScope.sharedHint : t.dataScope.projectHint)}>
      <input type="checkbox" checked={shared} disabled={!!disabledReason} onChange={(e) => onChange(e.target.checked)} />
      <span>{t.dataScope.makeShared}</span>
    </label>
  );
}

/** 一覧の項目に付ける「共通」の印 */
export function SharedTag() {
  const { t } = useI18n();
  return (
    <span className="scope-tag" title={t.dataScope.sharedHint}>
      {t.dataScope.sharedTag}
    </span>
  );
}
