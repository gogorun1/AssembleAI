import type { Step } from '../types/assembly';
import styles from './ProgressRail.module.css';

interface ProgressRailProps {
  steps: Step[];
  currentStep: number;
  onSelectStep(index: number): void;
}

export function ProgressRail({ steps, currentStep, onSelectStep }: ProgressRailProps) {
  return (
    <section className={styles.rail} aria-label="Assembly progress">
      <div className={styles.track}>
        {steps.map((step) => (
          <button
            key={step.index}
            className={[
              styles.tick,
              step.index < currentStep ? styles.done : '',
              step.index === currentStep ? styles.current : ''
            ].join(' ')}
            type="button"
            onClick={() => onSelectStep(step.index)}
            aria-label={`Go to step ${step.index}: ${step.title}`}
          />
        ))}
      </div>
      <div className={styles.fraction}>
        {currentStep}/{steps.length}
      </div>
    </section>
  );
}
