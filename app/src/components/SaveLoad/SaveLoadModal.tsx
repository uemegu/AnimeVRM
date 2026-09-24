import React from 'react';
import { SaveSlotInfo } from '../../types/save';
import { SupportedLanguage } from '../../types/scenario';
import { getDayOfWeek } from '../../types/game';
import './SaveLoadModal.css';

export interface SaveLoadModalProps {
  isOpen: boolean;
  mode: 'save' | 'load';
  slots: SaveSlotInfo[];
  lang: SupportedLanguage;
  onSelectSlot: (slotId: number) => void;
  onClose: () => void;
}

const PHASE_NAMES: Record<string, { ja: string; en: string }> = {
  morning: { ja: '朝（登校）', en: 'Morning' },
  morning_action: { ja: '午前', en: 'Morning Action' },
  lunch_action: { ja: '昼休み', en: 'Lunch Action' },
  afterschool_action: { ja: '放課後', en: 'Afterschool' },
  holiday_action: { ja: '休日', en: 'Holiday' },
  night: { ja: '夜', en: 'Night' },
};

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
  isOpen,
  mode,
  slots,
  lang,
  onSelectSlot,
  onClose,
}) => {
  if (!isOpen) return null;

  const isSave = mode === 'save';

  const formatSavedAt = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      return `${y}/${m}/${d} ${hh}:${mm}`;
    } catch {
      return '';
    }
  };

  return (
    <div
      className="save-load-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-load-modal-title"
      onClick={onClose}
    >
      <div
        className="save-load-modal-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <header className="save-load-header">
          <div className="save-load-title-area">
            <h2 id="save-load-modal-title" className="save-load-title-main">
              {isSave
                ? lang === 'ja' ? 'セーブ' : 'Save'
                : lang === 'ja' ? 'ロード' : 'Load'}
            </h2>
          </div>

          <button
            type="button"
            className="save-load-close-btn"
            onClick={onClose}
            aria-label={lang === 'ja' ? '閉じる' : 'Close'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* スロットカード一覧 */}
        <div className="save-load-slots-container">
          {slots.map((slot) => {
            const hasData = Boolean(slot.data && slot.data.gameState);
            const isDisabled = !isSave && !hasData;

            const day = slot.data?.gameState.day ?? 1;
            const weekday = getDayOfWeek(day);
            const phaseKey = slot.data?.gameState.phase ?? 'morning';
            const phaseLabel = PHASE_NAMES[phaseKey] ? PHASE_NAMES[phaseKey][lang] : phaseKey;
            const savedAt = formatSavedAt(slot.data?.savedAt);
            const affinities = slot.data?.gameState.affinities;

            return (
              <button
                key={slot.slotId}
                type="button"
                className={`save-slot-card ${isDisabled ? 'disabled' : ''}`}
                disabled={isDisabled}
                onClick={() => onSelectSlot(slot.slotId)}
                data-testid={`slot-${slot.slotId}`}
              >
                {/* スロット番号 */}
                <div className="slot-index-badge">
                  <span className="slot-number-label">SLOT</span>
                  <span className="slot-number-val">{slot.slotId}</span>
                </div>

                {/* スロットコンテンツ */}
                <div className="slot-content">
                  {hasData ? (
                    <div className="slot-data-row">
                      <div className="slot-meta-group">
                        <span className="slot-day-tag">
                          Day {day} ({weekday})
                        </span>
                        <span className="slot-phase-tag">{phaseLabel}</span>
                      </div>

                      {affinities && (
                        <div className="slot-affinity-row">
                          <span
                            className="affinity-badge badge-aoi"
                            title={lang === 'ja' ? `アオイ: Lv.${affinities.aoi ?? 0}` : `Aoi: Lv.${affinities.aoi ?? 0}`}
                          >
                            Lv.{affinities.aoi ?? 0}
                          </span>
                          <span
                            className="affinity-badge badge-emili"
                            title={lang === 'ja' ? `エミリ: Lv.${affinities.emili ?? 0}` : `Emili: Lv.${affinities.emili ?? 0}`}
                          >
                            Lv.{affinities.emili ?? 0}
                          </span>
                          <span
                            className="affinity-badge badge-shion"
                            title={lang === 'ja' ? `シオン: Lv.${affinities.shion ?? 0}` : `Shion: Lv.${affinities.shion ?? 0}`}
                          >
                            Lv.{affinities.shion ?? 0}
                          </span>
                        </div>
                      )}

                      {savedAt && (
                        <span className="slot-date-label">{savedAt}</span>
                      )}
                    </div>
                  ) : (
                    <div className="slot-empty-row">
                      <span className="empty-title">
                        {lang === 'ja' ? '空きスロット (NO DATA)' : 'Empty Slot (NO DATA)'}
                      </span>
                      <span className="empty-desc">
                        {isSave
                          ? lang === 'ja'
                            ? 'クリックしてこのスロットに新しく記録します'
                            : 'Click to save progress to this slot'
                          : lang === 'ja'
                            ? '保存された記録はありません'
                            : 'No save data available'}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* フッター */}
        <footer className="save-load-footer">
          <p className="save-load-notice">
            {isSave
              ? lang === 'ja'
                ? '※選択したスロットのデータは新しい記録で上書きされます。'
                : 'Selected slot will be overwritten with current progress.'
              : lang === 'ja'
                ? '※ロードすると現在の進行状況は破棄されます。'
                : 'Current progress will be replaced upon loading.'}
          </p>
        </footer>
      </div>
    </div>
  );
};
