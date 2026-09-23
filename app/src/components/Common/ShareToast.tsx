import React, { useEffect } from 'react';
import './ShareToast.css';

export interface ShareToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
  actionButton?: {
    label: string;
    onClick: () => void;
  };
}

export const ShareToast: React.FC<ShareToastProps> = ({
  message,
  onClose,
  duration = 5500,
  actionButton,
}) => {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => {
      onClose();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <aside className="share-toast" role="status" aria-live="polite">
      <div className="share-toast-inner">
        <span className="share-toast-icon" aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <span className="share-toast-message">{message}</span>
        {actionButton && (
          <button
            type="button"
            className="share-toast-action"
            onClick={actionButton.onClick}
          >
            {actionButton.label}
          </button>
        )}
        <button
          type="button"
          className="share-toast-close"
          onClick={onClose}
          aria-label="Close notification"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </aside>
  );
};
