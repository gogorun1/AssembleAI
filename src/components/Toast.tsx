import { X } from 'lucide-react';
import styles from './Toast.module.css';

interface ToastProps {
  toast?: {
    id: string;
    message: string;
  };
  onDismiss(): void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  if (!toast) {
    return null;
  }

  return (
    <aside className={styles.toast} role="status">
      <span>{toast.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss toast">
        <X size={14} aria-hidden />
      </button>
    </aside>
  );
}
