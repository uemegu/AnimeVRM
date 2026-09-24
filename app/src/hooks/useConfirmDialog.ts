import { useCallback, useState } from 'react';
import { ConfirmModalProps } from '../components/Common/ConfirmModal';

type DialogState = Omit<ConfirmModalProps, 'isOpen'> & { isOpen: boolean };

const CLOSED: DialogState = { isOpen: false, message: '', onConfirm: () => {} };

/** 共通の確認ダイアログ（お知らせ／YES・NO）。戻り値の dialogProps を ConfirmModal に渡す */
export function useConfirmDialog() {
  const [dialogProps, setDialogProps] = useState<DialogState>(CLOSED);

  const close = useCallback(() => setDialogProps((prev) => ({ ...prev, isOpen: false })), []);

  /** OK ボタンだけのお知らせ */
  const showNotice = useCallback(
    (message: string, title?: string) => {
      setDialogProps({ isOpen: true, title, message, confirmText: 'OK', cancelText: null, onConfirm: close });
    },
    [close]
  );

  /** YES / NO の確認。YES で onConfirm を実行する */
  const showConfirm = useCallback(
    (options: { message: string; title?: string; confirmText: string; cancelText: string; onConfirm: () => void }) => {
      setDialogProps({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
        onConfirm: () => {
          close();
          options.onConfirm();
        },
        onCancel: close,
      });
    },
    [close]
  );

  return { dialogProps, showNotice, showConfirm };
}
