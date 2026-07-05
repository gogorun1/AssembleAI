import { Mic, MoreHorizontal, Volume2 } from 'lucide-react';
import type { VoiceState } from '../types/assembly';
import styles from './VoiceOrb.module.css';

interface VoiceOrbProps {
  state: VoiceState;
  showHint: boolean;
  onPointerDown(): void;
  onPointerUp(): void;
}

export function VoiceOrb({ state, showHint, onPointerDown, onPointerUp }: VoiceOrbProps) {
  const thinking = state === 'transcribing' || state === 'thinking' || state === 'acting';
  return (
    <div className={styles.wrap}>
      <button
        className={`${styles.orb} ${styles[state]}`}
        type="button"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          if (state === 'listening') {
            onPointerUp();
          }
        }}
        aria-label="Hold to talk"
      >
        {thinking ? <MoreHorizontal size={30} aria-hidden /> : state === 'speaking' ? <Volume2 size={26} aria-hidden /> : <Mic size={28} aria-hidden />}
      </button>
      {showHint ? <div className={styles.hint}>hold space</div> : null}
    </div>
  );
}
