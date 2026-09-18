import React, { useEffect, useCallback } from 'react';
import './ConfirmModal.css';

export interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string | null;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'YES',
  cancelText = 'NO',
  onConfirm,
  onCancel,
}) => {
  // 効果音再生ヘルパー（選択肢画面と共通）
  const playSE = useCallback((url: string, volume = 0.5) => {
    try {
      const audio = new Audio(url);
      audio.volume = volume;
      audio.play().catch(() => {});
    } catch {
      // Audio play catch
    }
  }, []);

  // モーダルオープン時に表示SE再生
  useEffect(() => {
    if (isOpen) {
      playSE('/se/items_shown.mp3', 0.6);
    }
  }, [isOpen, playSE]);

  // ホバー音
  const handleMouseEnter = () => {
    playSE('/se/items_hover.mp3', 0.45);
  };

  // 確定クリック
  const handleConfirm = () => {
    playSE('/se/items_chose.mp3', 0.65);
    onConfirm();
  };

  // キャンセルクリック
  const handleCancel = () => {
    playSE('/se/items_chose.mp3', 0.55);
    onCancel?.();
  };

  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay" onClick={cancelText ? handleCancel : handleConfirm}>
      <div
        className="confirm-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="confirm-modal-inner">
          {title && <h3 className="confirm-modal-title">{title}</h3>}
          <p className="confirm-modal-message">{message}</p>
          <div className="confirm-modal-actions">
            {cancelText && (
              <button
                type="button"
                className="confirm-modal-btn cancel"
                onMouseEnter={handleMouseEnter}
                onClick={handleCancel}
              >
                {cancelText}
              </button>
            )}
            <button
              type="button"
              className="confirm-modal-btn confirm"
              onMouseEnter={handleMouseEnter}
              onClick={handleConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
