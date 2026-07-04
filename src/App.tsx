import { useEffect, useRef, useState } from 'react';
import { Viewer } from './viewer/Viewer';
import { useViewerCommands } from './viewer/useViewerCommands';
import { useAppStore } from './store/useAppStore';
import { useAssistant } from './store/useAssistant';
import { StepCard } from './components/StepCard';
import { PartChip } from './components/PartChip';
import { ProgressRail } from './components/ProgressRail';
import { TranscriptPanel } from './components/TranscriptPanel';
import { VoiceOrb } from './components/VoiceOrb';
import { Toast } from './components/Toast';
import styles from './App.module.css';

export default function App() {
  const [ready, setReady] = useState(false);
  const [toast, setToastState] = useState<string | null>(null);
  const [cmd, setCmd] = useState('');
  const [interacted, setInteracted] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  const viewer = useViewerCommands();
  const currentStep = useAppStore((s) => s.currentStep());
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const explodeLevel = useAppStore((s) => s.viewer.explodeLevel);

  const showToast = (message: string) => {
    setToastState(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastState(null), 4500);
  };

  const assistant = useAssistant({ onToast: showToast });

  // ── splash / preload (fonts; model is procedural) ─────────
  useEffect(() => {
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    const fontsReady = fonts?.ready ?? Promise.resolve();
    const minDelay = new Promise((r) => setTimeout(r, 650));
    Promise.all([fontsReady, minDelay]).then(() => setReady(true));
  }, []);

  // initialise camera + highlight for step 1 once revealed
  useEffect(() => {
    if (ready) viewer.goToStep(useAppStore.getState().currentStepIndex);
  }, [ready, viewer]);

  // ── keyboard: space = PTT, ←/→ prev/next, 1–9 goto (§8) ───
  useEffect(() => {
    const isTyping = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');

    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (e.repeat) return;
        setInteracted(true);
        assistant.startListening();
      } else if (e.key === 'ArrowRight') {
        setInteracted(true);
        assistant.selectStep(useAppStore.getState().currentStepIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        setInteracted(true);
        assistant.selectStep(useAppStore.getState().currentStepIndex - 1);
      } else if (/^[1-9]$/.test(e.key)) {
        setInteracted(true);
        assistant.selectStep(parseInt(e.key, 10));
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        e.preventDefault();
        assistant.stopListening();
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [assistant]);

  const partsNeeded =
    currentStep.partsNeeded.length > 0
      ? currentStep.partsNeeded
      : currentStep.highlightParts.map((partId) => ({ partId, quantity: 1 }));

  const orbHint = interacted ? null : assistant.sttSupported ? 'hold space' : 'type below';

  return (
    <div className={styles.app}>
      <div className={styles.viewport}>
        <div className={styles.canvasHost}>
          <Viewer />
        </div>
      </div>

      <div className={styles.topLeft}>
        <span className={styles.brand}>
          Assemble<em>AI</em>
        </span>
        <div className={styles.langToggle}>
          <button
            type="button"
            className={`${styles.langBtn} ${language === 'en' ? styles.langActive : ''}`}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
          <button
            type="button"
            className={`${styles.langBtn} ${language === 'fr' ? styles.langActive : ''}`}
            onClick={() => setLanguage('fr')}
          >
            FR
          </button>
        </div>
        <button
          type="button"
          className={styles.explodeBtn}
          onClick={() => viewer.explode(explodeLevel === 0 ? 2 : 0)}
        >
          {explodeLevel === 0 ? 'Explode' : 'Assemble'}
        </button>
      </div>

      <aside className={styles.rail}>
        <ProgressRail onSelectStep={assistant.selectStep} />
        <StepCard onMistakeClick={assistant.showMistake} />
        <div className={styles.chips}>
          <span className={styles.chipsHeader}>Parts this step</span>
          {partsNeeded.map((pn) => (
            <PartChip
              key={pn.partId}
              partId={pn.partId}
              quantity={pn.quantity}
              onSelect={assistant.selectPart}
            />
          ))}
        </div>
        <div className={styles.transcriptCard}>
          <TranscriptPanel />
        </div>
      </aside>

      <div className={styles.orbDock}>
        <VoiceOrb
          onPressStart={() => {
            setInteracted(true);
            assistant.startListening();
          }}
          onPressEnd={assistant.stopListening}
          hint={orbHint}
        />
        <form
          className={styles.cmdForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (!cmd.trim()) return;
            setInteracted(true);
            assistant.submitText(cmd);
            setCmd('');
          }}
        >
          <input
            className={styles.cmdInput}
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            placeholder="type a command…"
            aria-label="Type a command"
          />
          <button type="submit" className={styles.cmdSend}>
            ask
          </button>
        </form>
      </div>

      <Toast message={toast} />

      {!ready && (
        <div className={styles.splash}>
          <div className={styles.splashNumeral}>0</div>
          <div className={styles.splashLabel}>calibrating…</div>
        </div>
      )}
    </div>
  );
}
