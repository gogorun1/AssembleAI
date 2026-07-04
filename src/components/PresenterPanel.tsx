import { RotateCcw, RefreshCw } from 'lucide-react';
import type { PresenterUtterance } from '../data/presenterUtterances';
import styles from './PresenterPanel.module.css';

interface PresenterPanelProps {
  utterances: PresenterUtterance[];
  onRunUtterance(text: string): void | Promise<void>;
  onFullReset(): void;
  onRehearsalReset(): void;
  disabled?: boolean;
}

export function PresenterPanel({
  utterances,
  onRunUtterance,
  onFullReset,
  onRehearsalReset,
  disabled = false
}: PresenterPanelProps) {
  return (
    <section className={styles.panel} aria-label="Presenter mode">
      <div className={styles.heading}>Presenter Mode</div>
      <div className={styles.buttonGrid} role="group" aria-label="Demo utterance buttons">
        {utterances.map((utt) => (
          <button
            key={utt.id}
            className={styles.utteranceButton}
            type="button"
            disabled={disabled}
            data-testid={`presenter-button-${utt.id}`}
            aria-label={utt.description}
            title={utt.description}
            onClick={() => void onRunUtterance(utt.utterance)}
          >
            {utt.label}
          </button>
        ))}
      </div>
      <div className={styles.resetRow} role="group" aria-label="Reset controls">
        <button
          className={styles.resetButton}
          type="button"
          disabled={disabled}
          data-testid="presenter-button-full-reset"
          aria-label="Reset demo to opening state"
          title="Reset demo to opening state"
          onClick={onFullReset}
        >
          <RotateCcw size={14} aria-hidden />
          Full reset
        </button>
        <button
          className={styles.resetButton}
          type="button"
          disabled={disabled}
          data-testid="presenter-button-rehearsal-reset"
          aria-label="Reset to step 1 for rehearsal"
          title="Reset to step 1 for rehearsal"
          onClick={onRehearsalReset}
        >
          <RefreshCw size={14} aria-hidden />
          Rehearsal reset
        </button>
      </div>
    </section>
  );
}
