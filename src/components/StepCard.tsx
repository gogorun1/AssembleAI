import { AlertTriangle, Clock3, Wrench } from 'lucide-react';
import type { Step } from '../types/assembly';
import styles from './StepCard.module.css';

interface StepCardProps {
  step: Step;
  onCommonMistake(): void;
}

export function StepCard({ step, onCommonMistake }: StepCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.numeral} aria-hidden>
        {step.index}
      </div>
      <div className={styles.body}>
        <div className={styles.eyebrow}>CURRENT STEP</div>
        <h1 className={styles.title}>{step.title}</h1>
        <p className={styles.action}>{step.action}</p>
        <div className={styles.meta}>
          {step.toolNeeded ? (
            <span>
              <Wrench size={14} aria-hidden />
              {step.toolNeeded}
            </span>
          ) : null}
          {step.estMinutes ? (
            <span>
              <Clock3 size={14} aria-hidden />
              {step.estMinutes} MIN
            </span>
          ) : null}
        </div>
      </div>
      {step.commonMistake ? (
        <button className={styles.mistake} type="button" onClick={onCommonMistake}>
          <AlertTriangle size={16} aria-hidden />
          <span>{step.commonMistake}</span>
        </button>
      ) : null}
    </article>
  );
}
