import { Box, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PartChip } from './components/PartChip';
import { ProgressRail } from './components/ProgressRail';
import { StepCard } from './components/StepCard';
import { Toast } from './components/Toast';
import { TranscriptPanel } from './components/TranscriptPanel';
import { VoiceOrb } from './components/VoiceOrb';
import { inferIntentLocale, parseIntent } from './services/intent';
import { applyResolvedIntentAction } from './services/intentActions';
import { createSTTService } from './services/stt';
import { createTTSService } from './services/tts';
import { createVoiceController, type VoiceController } from './services/voiceController';
import { useAppStore } from './store/useAppStore';
import type { Part, ResolvedIntent } from './types/assembly';
import { Viewer } from './viewer/Viewer';

export default function App() {
  const manifest = useAppStore((state) => state.manifest);
  const currentStep = useAppStore((state) => state.currentStep);
  const voiceState = useAppStore((state) => state.voiceState);
  const transcript = useAppStore((state) => state.transcript);
  const mentionedPartIds = useAppStore((state) => state.mentionedPartIds);
  const highlightedPartIds = useAppStore((state) => state.highlightedPartIds);
  const explodeLevel = useAppStore((state) => state.explodeLevel);
  const toast = useAppStore((state) => state.toast);
  const firstVoiceInteraction = useAppStore((state) => state.firstVoiceInteraction);
  const store = useAppStore();
  const ttsRef = useRef(createTTSService());
  const voiceControllerRef = useRef<VoiceController>();
  const [ready, setReady] = useState(false);

  const step = manifest.steps[currentStep - 1];
  const partsById = useMemo(
    () => new Map(manifest.parts.map((part) => [part.id, part])),
    [manifest.parts]
  );
  const currentPartIds = useMemo(
    () => new Set(step.partsNeeded.map((part) => part.partId)),
    [step.partsNeeded]
  );

  const executeIntent = useCallback(async (intent: ResolvedIntent) => {
    const liveStore = useAppStore.getState();
    applyResolvedIntentAction(liveStore, intent);
    liveStore.setVoiceState('speaking');
    try {
      await ttsRef.current.speak(intent);
    } catch {
      liveStore.showToast('Voice reply failed - the visual action is still applied.');
    }
    if (useAppStore.getState().voiceState === 'speaking') {
      useAppStore.getState().setVoiceState('idle');
    }
  }, []);

  const runUtterance = useCallback(
    async (text: string) => {
      const liveStore = useAppStore.getState();
      liveStore.addTranscript({ speaker: 'user', text });
      liveStore.setVoiceState('thinking');

      try {
        const intent = await parseIntent(text, {
          manifest: liveStore.manifest,
          currentStep: liveStore.currentStep,
          recentTranscript: liveStore.transcript.slice(-6),
          locale: inferIntentLocale(text)
        });

        await executeIntent(intent);
      } catch {
        liveStore.showToast('I could not understand that - click steps and parts instead.');
        liveStore.addTranscript({
          speaker: 'agent',
          text: 'I could not understand that. Try a step, part, camera angle, or common mistake.',
          language: 'en'
        });
        liveStore.setVoiceState('idle');
      }
    },
    [executeIntent]
  );

  const triggerPartIntent = useCallback(
    async (part: Part) => {
      const liveStore = useAppStore.getState();
      const activeStep = liveStore.manifest.steps[liveStore.currentStep - 1];
      liveStore.addTranscript({
        speaker: 'user',
        text: `Show me ${part.label}.`
      });
      await executeIntent({
        type: 'which_part',
        language: 'en',
        partQuery: part.label,
        partIds: [part.id],
        viewKey: part.id === 'cam-screw-washer' ? 'screw-detail' : activeStep.cameraView,
        reply: `Use ${part.code}, ${part.label}. I am flashing it in the model and the parts rail.`
      });
    },
    [executeIntent]
  );

  const triggerMistakeIntent = useCallback(async () => {
    await runUtterance('Did people mess this step up before?');
  }, [runUtterance]);

  const beginPushToTalk = useCallback(() => {
    voiceControllerRef.current?.beginPushToTalk();
  }, []);

  const endPushToTalk = useCallback(() => {
    voiceControllerRef.current?.endPushToTalk();
  }, []);

  useEffect(() => {
    const stt = createSTTService();
    voiceControllerRef.current = createVoiceController({
      stt,
      tts: ttsRef.current,
      getVoiceState: () => useAppStore.getState().voiceState,
      setVoiceState: (state) => useAppStore.getState().setVoiceState(state),
      markVoiceInteraction: () => useAppStore.getState().markVoiceInteraction(),
      showRecoverableMessage: (message) => useAppStore.getState().showToast(message),
      runUtterance
    });
    return () => {
      voiceControllerRef.current?.dispose();
      voiceControllerRef.current = undefined;
    };
  }, [runUtterance]);

  useEffect(() => {
    let cancelled = false;
    void ttsRef.current.preload().finally(() => {
      window.setTimeout(() => {
        if (!cancelled) {
          setReady(true);
        }
      }, 450);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        beginPushToTalk();
      }
      if (event.key === 'ArrowRight') {
        store.nextStep();
      }
      if (event.key === 'ArrowLeft') {
        store.previousStep();
      }
      if (/^[1-9]$/.test(event.key)) {
        store.goToStep(Number(event.key));
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        endPushToTalk();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [beginPushToTalk, endPushToTalk, store]);

  return (
    <>
      <div className="appShell">
        <main className="viewerStage" aria-label="3D assembly viewport">
          <Viewer />
          <div className="bottomControls">
            <button className="iconButton" type="button" onClick={store.previousStep} aria-label="Previous step" title="Previous step">
              <ChevronLeft size={20} aria-hidden />
            </button>
            <VoiceOrb
              state={voiceState}
              showHint={!firstVoiceInteraction}
              onPointerDown={beginPushToTalk}
              onPointerUp={endPushToTalk}
            />
            <button className="iconButton" type="button" onClick={store.nextStep} aria-label="Next step" title="Next step">
              <ChevronRight size={20} aria-hidden />
            </button>
            <button
              className="iconButton"
              type="button"
              onClick={() => store.setExplodeLevel(((explodeLevel + 1) % 3) as 0 | 1 | 2)}
              aria-label="Cycle exploded view"
              title="Cycle exploded view"
            >
              <Box size={19} aria-hidden />
            </button>
            <button className="iconButton" type="button" onClick={() => store.goToStep(1)} aria-label="Reset to first step" title="Reset to first step">
              <RotateCcw size={18} aria-hidden />
            </button>
          </div>
        </main>

        <aside className="rightRail" aria-label="Assembly agent panel">
          <ProgressRail
            steps={manifest.steps}
            currentStep={currentStep}
            onSelectStep={store.goToStep}
          />
          <StepCard step={step} onCommonMistake={triggerMistakeIntent} />
          <section className="partRail" aria-label="Parts needed">
            <div className="partRailHeader">
              <span>PARTS IN HAND</span>
              <span>{step.partsNeeded.length} GROUPS</span>
            </div>
            <div className="partRailList">
              {step.partsNeeded.map((needed) => {
                const part = partsById.get(needed.partId);
                if (!part) {
                  return null;
                }
                return (
                  <PartChip
                    key={part.id}
                    part={part}
                    quantity={needed.quantity}
                    mentioned={mentionedPartIds.includes(part.id)}
                    done={currentStep > step.index && !currentPartIds.has(part.id)}
                    active={highlightedPartIds.includes(part.id)}
                    onClick={() => void triggerPartIntent(part)}
                  />
                );
              })}
            </div>
          </section>
          <TranscriptPanel transcript={transcript} parts={manifest.parts} />
        </aside>
      </div>
      <Toast toast={toast} onDismiss={store.clearToast} />
      <div className={`splash ${ready ? 'splashHidden' : ''}`} aria-hidden={ready}>
        <div className="splashInner">
          <div className="splashNumeral">0</div>
          <div className="splashText">calibrating...</div>
        </div>
      </div>
    </>
  );
}
