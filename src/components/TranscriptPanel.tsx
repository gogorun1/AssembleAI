import { useEffect, useMemo, useRef } from 'react';
import type { AssemblyManifest, Part, TranscriptLine } from '../types/assembly';
import styles from './TranscriptPanel.module.css';

interface TranscriptPanelProps {
  transcript: TranscriptLine[];
  parts: Part[];
  steps: AssemblyManifest['steps'];
}

export function TranscriptPanel({ transcript, parts, steps }: TranscriptPanelProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const partsById = useMemo(() => new Map(parts.map((part) => [part.id, part])), [parts]);
  const stepsByIndex = useMemo(
    () => new Map(steps.map((step) => [step.index, step])),
    [steps]
  );

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
          const previewStep = line.previewStep ? stepsByIndex.get(line.previewStep) : undefined;
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
              {line.speaker === 'agent' && (line.previewVideoUrl || previewStep) ? (
                <div className={styles.previewBlock}>
                  {previewStep ? (
                    <div className={styles.previewLabel}>
                      STEP PREVIEW · {previewStep.title}
                    </div>
                  ) : (
                    <div className={styles.previewLabel}>STEP PREVIEW</div>
                  )}
                  {line.previewVideoUrl ? (
                    <video
                      className={styles.previewVideo}
                      src={line.previewVideoUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      controls
                      aria-label={previewStep ? `3D preview for ${previewStep.title}` : '3D step preview'}
                    />
                  ) : (
                    <div className={styles.previewPending}>Recording 3D preview…</div>
                  )}
                </div>
              ) : null}
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
