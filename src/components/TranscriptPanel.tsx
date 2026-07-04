import { Fragment, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { TranscriptLine } from '../store/useAppStore';
import styles from './TranscriptPanel.module.css';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Wrap any mentioned part labels found in the text with the orange underline. */
function renderText(line: TranscriptLine, labels: string[]) {
  if (line.role !== 'agent' || labels.length === 0) return line.text;
  const pattern = labels
    .filter(Boolean)
    .map(escapeRegExp)
    .sort((a, b) => b.length - a.length)
    .join('|');
  if (!pattern) return line.text;
  const segments = line.text.split(new RegExp(`(${pattern})`, 'gi'));
  const lowered = new Set(labels.map((l) => l.toLowerCase()));
  return segments.map((seg, i) =>
    lowered.has(seg.toLowerCase()) ? (
      <span key={i} className={styles.partName}>
        {seg}
      </span>
    ) : (
      <Fragment key={i}>{seg}</Fragment>
    ),
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function TranscriptPanel() {
  const transcript = useAppStore((s) => s.transcript);
  const parts = useAppStore((s) => s.manifest.parts);
  const listRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  useEffect(() => {
    if (pinned.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <section className={styles.panel} aria-label="Conversation transcript">
      <div className={styles.header}>Transcript</div>
      <div className={styles.list} ref={listRef} onScroll={onScroll}>
        {transcript.length === 0 && (
          <p className={styles.empty}>Hold space and ask a question to begin.</p>
        )}
        {transcript.map((line) => {
          const labels = line.mentionedParts
            .map((id) => parts.find((p) => p.id === id)?.label)
            .filter((l): l is string => !!l);
          return (
            <div key={line.id} className={`${styles.line} ${line.role === 'user' ? styles.user : ''}`}>
              <div className={styles.text}>
                {line.role === 'user' && <span className={styles.prefix}>&gt;</span>}
                {renderText(line, labels)}
              </div>
              <span className={styles.time}>{formatTime(line.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
