import { ClipboardCopy, Trash2, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import styles from './DebugOverlay.module.css';

interface DebugOverlayProps {
  enabled: boolean;
  onClose(): void;
}

export function DebugOverlay({ enabled, onClose }: DebugOverlayProps) {
  const currentStep = useAppStore((state) => state.currentStep);
  const voiceState = useAppStore((state) => state.voiceState);
  const activeViewKey = useAppStore((state) => state.activeViewKey);
  const explodeLevel = useAppStore((state) => state.explodeLevel);
  const selectedPartId = useAppStore((state) => state.selectedPartId);
  const highlightedPartIds = useAppStore((state) => state.highlightedPartIds);
  const mentionedPartIds = useAppStore((state) => state.mentionedPartIds);
  const eventLog = useAppStore((state) => state.eventLog);
  const clearEventLog = useAppStore((state) => state.clearEventLog);

  const [copied, setCopied] = useState(false);

  const copyBundle = useCallback(async () => {
    const state = useAppStore.getState();
    const bundle = {
      app: 'AssembleAI',
      generatedAt: new Date().toISOString(),
      currentStep: state.currentStep,
      activeViewKey: state.activeViewKey,
      voiceState: state.voiceState,
      explodeLevel: state.explodeLevel,
      selectedPartId: state.selectedPartId,
      highlightedPartIds: state.highlightedPartIds,
      mentionedPartIds: state.mentionedPartIds,
      eventLog: state.eventLog
    };
    const json = JSON.stringify(bundle, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      state.showToast('Clipboard blocked - copy from console instead.');
      // eslint-disable-next-line no-console
      console.log(json);
    }
  }, []);

  if (!enabled) {
    return null;
  }

  const rows: Array<[string, string]> = [
    ['step', `${currentStep}`],
    ['voice', voiceState],
    ['view', activeViewKey],
    ['explode', `${explodeLevel}`],
    ['selected', selectedPartId ?? '—'],
    ['highlighted', highlightedPartIds.join(', ') || '—'],
    ['mentioned', mentionedPartIds.join(', ') || '—'],
    ['events', `${eventLog.length}`]
  ];

  const recentEvents = [...eventLog].slice(-20).reverse();

  return (
    <aside className={styles.overlay} aria-label="Debug overlay" data-testid="debug-overlay">
      <div className={styles.header}>
        <span className={styles.title}>Debug</span>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Close debug overlay"
          title="Close (D)"
          onClick={onClose}
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      <dl className={styles.stateGrid}>
        {rows.map(([key, value]) => (
          <div key={key} className={styles.stateRow}>
            <dt className={styles.stateKey}>{key}</dt>
            <dd className={styles.stateValue}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.logHeader}>
        <span>Event log</span>
        <div className={styles.logActions}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Copy debug bundle"
            title="Copy debug bundle"
            onClick={() => void copyBundle()}
          >
            <ClipboardCopy size={13} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Clear event log"
            title="Clear event log"
            onClick={clearEventLog}
          >
            <Trash2 size={13} aria-hidden />
          </button>
        </div>
      </div>

      {copied ? <div className={styles.copied}>Copied debug bundle</div> : null}

      <ol className={styles.log}>
        {recentEvents.length === 0 ? (
          <li className={styles.logEmpty}>No events yet.</li>
        ) : (
          recentEvents.map((event) => (
            <li key={event.id} className={styles.logItem}>
              <span className={styles.logType} data-type={event.type}>
                {event.type}
              </span>
              <span className={styles.logLabel}>{event.label}</span>
            </li>
          ))
        )}
      </ol>
    </aside>
  );
}
