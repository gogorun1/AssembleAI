import { useEffect, useMemo, useRef } from 'react';
import type { Part, TranscriptLine } from '../types/assembly';
import styles from './TranscriptPanel.module.css';

interface TranscriptPanelProps {
  transcript: TranscriptLine[];
  parts: Part[];
}

export function TranscriptPanel({ transcript, parts }: TranscriptPanelProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const partsById = useMemo(() => new Map(parts.map((part) => [part.id, part])), [parts]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    if (distanceFromBottom < 120) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [transcript]);

  return (
    <section className={styles.panel} aria-label="Conversation transcript">
      <div className={styles.header}>
        <span>AGENT LOG</span>
        <span>{transcript.length} {transcript.length === 1 ? 'LINE' : 'LINES'}</span>
      </div>
      <div className={styles.scroller} ref={scrollerRef}>
        {transcript.map((line) => {
          const mentioned = line.mentionedPartIds?.map((id) => partsById.get(id)).filter(Boolean) as Part[] | undefined;
          return (
            <article key={line.id} className={`${styles.line} ${styles[line.speaker]}`}>
              <time className={styles.time}>{formatTimestamp(line.timestamp)}</time>
              <div className={styles.text}>
                {line.speaker === 'user' ? <span className={styles.prompt}>&gt;</span> : null}
                <span>{line.text}</span>
                {mentioned?.length ? (
                  <span className={styles.mentions}>
                    {mentioned.map((part) => (
                      <span key={part.id} className={styles.mentionName}>
                        {part.label}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat('en', {
    minute: '2-digit',
    second: '2-digit'
  }).format(timestamp);
}
