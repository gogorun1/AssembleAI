import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import styles from './PartChip.module.css';

interface PartChipProps {
  partId: string;
  quantity: number;
  onSelect: (partId: string) => void;
}

export function PartChip({ partId, quantity, onSelect }: PartChipProps) {
  const part = useAppStore((s) => s.partById(partId));
  const mentionedPartId = useAppStore((s) => s.mentionedPartId);
  const mentionNonce = useAppStore((s) => s.mentionNonce);
  const [mentioned, setMentioned] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // Enter "mentioned" state (holds 2s) whenever this part is mentioned (§7.2).
  useEffect(() => {
    if (mentionedPartId !== partId) return;
    setMentioned(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMentioned(false), 2000);
    return () => window.clearTimeout(timer.current);
  }, [mentionedPartId, mentionNonce, partId]);

  if (!part) return null;

  return (
    <button
      type="button"
      className={`${styles.chip} ${mentioned ? styles.mentioned : ''}`}
      onClick={() => onSelect(partId)}
      aria-label={`${part.label}, code ${part.code}`}
    >
      <span className={styles.code}>{part.code}</span>
      <span className={styles.label}>{part.label}</span>
      <span className={styles.qty}>×{quantity}</span>
    </button>
  );
}
