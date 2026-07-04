import { useAppStore } from '../store/useAppStore';
import styles from './VoiceOrb.module.css';

interface VoiceOrbProps {
  onPressStart: () => void;
  onPressEnd: () => void;
  hint: string | null;
}

function MicGlyph() {
  return (
    <svg className={styles.glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}

export function VoiceOrb({ onPressStart, onPressEnd, hint }: VoiceOrbProps) {
  const voiceState = useAppStore((s) => s.voiceState);

  const stateClass =
    voiceState === 'listening'
      ? styles.listening
      : voiceState === 'transcribing' || voiceState === 'thinking' || voiceState === 'acting'
        ? styles.busy
        : voiceState === 'speaking'
          ? styles.speaking
          : '';

  const busy = voiceState === 'transcribing' || voiceState === 'thinking' || voiceState === 'acting';

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.orb} ${stateClass}`}
        aria-label="Hold to talk"
        aria-pressed={voiceState === 'listening'}
        onPointerDown={(e) => {
          e.preventDefault();
          onPressStart();
        }}
        onPointerUp={onPressEnd}
        onPointerLeave={() => {
          if (voiceState === 'listening') onPressEnd();
        }}
      >
        {busy ? (
          <span className={styles.dots} aria-hidden>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        ) : (
          <MicGlyph />
        )}
      </button>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
