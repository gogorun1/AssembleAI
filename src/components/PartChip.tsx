import { Check, LocateFixed } from 'lucide-react';
import type { Part } from '../types/assembly';
import styles from './PartChip.module.css';

interface PartChipProps {
  part: Part;
  quantity: number;
  mentioned: boolean;
  active: boolean;
  done?: boolean;
  onClick(): void;
}

export function PartChip({ part, quantity, mentioned, active, done, onClick }: PartChipProps) {
  return (
    <button
      className={[
        styles.chip,
        mentioned ? styles.mentioned : '',
        active ? styles.active : '',
        done ? styles.done : ''
      ].join(' ')}
      type="button"
      onClick={onClick}
    >
      <span className={styles.code}>{part.code}</span>
      <span className={styles.label}>{part.label}</span>
      <span className={styles.qty}>x{quantity}</span>
      {done ? <Check size={14} aria-hidden /> : <LocateFixed size={14} aria-hidden />}
    </button>
  );
}
