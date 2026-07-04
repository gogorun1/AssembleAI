import { useAppStore } from '../store/useAppStore';
import styles from './StepCard.module.css';

interface StepCardProps {
  onMistakeClick: () => void;
}

export function StepCard({ onMistakeClick }: StepCardProps) {
  const step = useAppStore((s) => s.currentStep());

  return (
    <article className={styles.card} aria-label={`Step ${step.index}: ${step.title}`}>
      <div className={styles.numeral} aria-hidden>
        {String(step.index).padStart(2, '0')}
      </div>
      <div className={styles.body}>
        <h2 className={styles.title}>{step.title}</h2>
        <p className={styles.action}>{step.action}</p>
        <div className={styles.meta}>
          {step.toolNeeded && <span>{step.toolNeeded}</span>}
          {step.estMinutes && <span>~{step.estMinutes} min</span>}
        </div>
      </div>
      {step.commonMistake && (
        <button className={styles.mistake} onClick={onMistakeClick} type="button">
          <span className={styles.warnIcon} aria-hidden>
            ⚠
          </span>
          <span>{step.commonMistake}</span>
        </button>
      )}
    </article>
  );
}
