import { useAppStore } from '../store/useAppStore';
import styles from './ProgressRail.module.css';

interface ProgressRailProps {
  onSelectStep: (index: number) => void;
}

export function ProgressRail({ onSelectStep }: ProgressRailProps) {
  const steps = useAppStore((s) => s.manifest.steps);
  const current = useAppStore((s) => s.currentStepIndex);

  return (
    <div className={styles.rail}>
      <div className={styles.track} role="list">
        {steps.map((step) => {
          const state =
            step.index === current ? styles.current : step.index < current ? styles.done : '';
          return (
            <button
              key={step.index}
              type="button"
              role="listitem"
              className={`${styles.tick} ${state}`}
              onClick={() => onSelectStep(step.index)}
              aria-label={`Go to step ${step.index}: ${step.title}`}
              aria-current={step.index === current}
            />
          );
        })}
      </div>
      <span className={styles.fraction}>
        {current}/{steps.length}
      </span>
    </div>
  );
}
