import { useI18n } from '../i18n';
import { ApiError, READ_ONLY } from '../api/client';
import './SaveBar.css';

export type SaveStatus = { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message?: string } | null;

/** 保存時の例外を、画面に出す状態に変える（スキーマ違反なら場所と理由を添える） */
export function saveErrorStatus(err: unknown): SaveStatus {
  const detail = err instanceof ApiError && err.issues.length > 0 ? err.issues.map((i) => `${i.path}: ${i.message}`).join(' / ') : undefined;
  return { kind: 'error', message: detail };
}

/** 画面右上の「元に戻す」「保存」と、保存状態の表示 */
export function SaveBar({ dirty, status, onRevert, onSave }: { dirty: boolean; status: SaveStatus; onRevert: () => void; onSave: () => void }) {
  const { t } = useI18n();
  const text =
    status?.kind === 'saving'
      ? t.common.saving
      : status?.kind === 'saved'
        ? t.common.saved
        : status?.kind === 'error'
          ? `${t.common.saveFailed}${status.message ? `（${status.message}）` : ''}`
          : dirty
            ? t.common.unsaved
            : '';
  return (
    <div className="save-bar">
      <span className={`save-bar-status ${status?.kind ?? (dirty ? 'dirty' : '')}`} title={text}>
        {text}
      </span>
      <button type="button" className="btn" disabled={!dirty} onClick={onRevert}>
        {t.common.revert}
      </button>
      <button type="button" className="btn primary" disabled={READ_ONLY || !dirty || status?.kind === 'saving'} title={READ_ONLY ? t.common.readOnly : undefined} onClick={onSave}>
        {t.common.save}
      </button>
    </div>
  );
}
