import React, { useEffect } from 'react';
import { soundManager } from '../../services/audio/SoundManager';
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
  // モーダルオープン時に表示SE再生
  useEffect(() => {
    if (isOpen) {
      soundManager.playSe('/se/items_shown.mp3', 0.6);
    }
  }, [isOpen]);

  // ホバー音
  const handleMouseEnter = () => {
    soundManager.playSe('/se/items_hover.mp3', 0.45);
  };

  // 確定クリック
  const handleConfirm = () => {
    soundManager.playSe('/se/items_chose.mp3', 0.65);
    onConfirm();
  };

  // キャンセルクリック
  const handleCancel = () => {
    soundManager.playSe('/se/items_chose.mp3', 0.55);
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
