import { BookOpen, Clock3, Lightbulb, Wrench } from 'lucide-react';
import type { Step } from '../types/assembly';
import { StepManualDiagram } from './StepManualDiagram';
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
          {step.manualFig ? (
            <span>
              <BookOpen size={14} aria-hidden />
              Manual {step.manualFig}
            </span>
          ) : null}
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
        {step.manualFig ? <StepManualDiagram step={step} /> : null}
      </div>
      {step.commonMistake ? (
        <button className={styles.tip} type="button" onClick={onCommonMistake}>
          <Lightbulb size={16} aria-hidden />
          <span className={styles.tipBody}>
            <span className={styles.tipLabel}>TIP</span>
            <span>{step.commonMistake}</span>
          </span>
        </button>
      ) : null}
    </article>
  );
}
