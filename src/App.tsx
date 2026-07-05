import { Box, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PartChip } from './components/PartChip';
import { ProgressRail } from './components/ProgressRail';
import { StepCard } from './components/StepCard';
import { Toast } from './components/Toast';
import { TranscriptPanel } from './components/TranscriptPanel';
import { VoiceOrb } from './components/VoiceOrb';
import { PartsBinsPanel } from './components/PartsBinsPanel';
import { CommandPanel, type CommandLanguage } from './components/CommandPanel';
import { PresenterPanel } from './components/PresenterPanel';
import { PhotoCheckPanel } from './components/PhotoCheckPanel';
import { DebugOverlay } from './components/DebugOverlay';
import { presenterUtterances } from './data/presenterUtterances';
import type { PhotoCheckResult } from './services/photoCheck';
import { parseIntent } from './services/intent';
import { createSTTService, type STTService } from './services/stt';
import { createTTSService } from './services/tts';
import { useAppStore } from './store/useAppStore';
import type { Part, ResolvedIntent } from './types/assembly';
import { Viewer } from './viewer/Viewer';

const PART_VIEW_KEYS: Record<string, string> = {
  'side-panel-left': 'first-side-assembly',
  'side-panel-right': 'second-side-panel',
  'bottom-panel': 'first-side-assembly',
  'top-panel': 'first-side-assembly',
  'fixed-shelf': 'first-side-assembly',
  'front-rail': 'front-rail',
  'adjustable-shelf': 'complete',
  'back-panel': 'back-panel',
  'cam-screw': 'side-screw-detail',
  'cam-lock': 'cam-lock-detail',
  'wood-dowel': 'dowel-prep',
  'back-nail': 'back-nails',
  'shelf-pin': 'shelf-pin-detail',
  'wall-bracket': 'wall-anchor',
  'bracket-screw': 'wall-anchor',
  washer: 'wall-anchor'
};

function cameraViewForPart(
  partId: string,
  cameraViews: Record<string, unknown>
): string | undefined {
  const key = PART_VIEW_KEYS[partId];
  return key && key in cameraViews ? key : undefined;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

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
  // Select actions individually (stable references) instead of subscribing to
  // the whole store, which previously re-rendered App on every state change.
  const previousStep = useAppStore((state) => state.previousStep);
  const nextStep = useAppStore((state) => state.nextStep);
  const goToStep = useAppStore((state) => state.goToStep);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const setExplodeLevel = useAppStore((state) => state.setExplodeLevel);
  const clearHighlights = useAppStore((state) => state.clearHighlights);
  const clearToast = useAppStore((state) => state.clearToast);
  const resetDemoState = useAppStore((state) => state.resetDemoState);
  const logEvent = useAppStore((state) => state.logEvent);
  const showToast = useAppStore((state) => state.showToast);
  const ttsRef = useRef(createTTSService());
  const sttRef = useRef<STTService>();
  const noSpeechTimer = useRef<ReturnType<typeof setTimeout>>();
  const [ready, setReady] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [commandLanguage, setCommandLanguage] = useState<CommandLanguage>('en');

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
    const partIds = intent.partIds ?? [];

    liveStore.logEvent({ type: 'intent', label: intent.type, payload: { type: intent.type, partIds, stepNumber: intent.stepNumber } });
    liveStore.setVoiceState('acting');

    if (intent.viewKey) {
      liveStore.setActiveView(intent.viewKey, { focus: true });
    }

    if (partIds.length > 0) {
      liveStore.setHighlightedParts(partIds);
      for (const partId of partIds) {
        liveStore.mentionPart(partId);
      }
    }

    switch (intent.type) {
      case 'next_step':
      case 'prev_step':
      case 'goto_step':
        liveStore.goToStep(intent.stepNumber ?? liveStore.currentStep);
        break;
      case 'which_part':
        if (partIds[0]) {
          liveStore.selectPart(partIds[0]);
        }
        break;
      case 'where_does_it_go':
      case 'common_mistake':
      case 'repeat':
        if (partIds[0]) {
          liveStore.selectPart(partIds[0]);
        }
        break;
      case 'show_angle':
      case 'how_many_left':
      case 'help':
      case 'unknown':
        break;
    }

    liveStore.addTranscript({
      speaker: 'agent',
      text: intent.reply,
      mentionedPartIds: partIds,
      language: intent.language
    });

    liveStore.setVoiceState('speaking');
    await ttsRef.current.speak(intent);
    if (useAppStore.getState().voiceState === 'speaking') {
      useAppStore.getState().setVoiceState('idle');
    }
  }, []);

  const runUtterance = useCallback(
    async (text: string) => {
      const liveStore = useAppStore.getState();
      liveStore.logEvent({ type: 'utterance', label: text.slice(0, 80), payload: { text: text.slice(0, 200) } });
      liveStore.addTranscript({ speaker: 'user', text });
      liveStore.setVoiceState('thinking');

      const intent = await parseIntent(text, {
        manifest: liveStore.manifest,
        currentStep: liveStore.currentStep
      });

      await executeIntent(intent);
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
      // Frame the camera on the requested part so the highlight/spin is actually
      // visible, falling back to the current step view when there's no mapping.
      const viewKey = cameraViewForPart(part.id, liveStore.manifest.cameraViews)
        ?? activeStep.cameraView;
      await executeIntent({
        type: 'which_part',
        language: 'en',
        partQuery: part.label,
        partIds: [part.id],
        viewKey,
        reply: `Use ${part.code}, ${part.label}. I am flashing it in the model and the parts rail.`
      });
    },
    [executeIntent]
  );

  const triggerMistakeIntent = useCallback(async () => {
    await runUtterance('Did people mess this step up before?');
  }, [runUtterance]);

  const fullReset = useCallback(() => {
    ttsRef.current.cancel();
    sttRef.current?.abort();
    clearTimeout(noSpeechTimer.current);
    resetDemoState();
    logEvent({ type: 'reset', label: 'Full reset' });
    showToast('Demo reset to opening state.');
  }, [resetDemoState, logEvent, showToast]);

  const rehearsalReset = useCallback(() => {
    ttsRef.current.cancel();
    sttRef.current?.abort();
    clearTimeout(noSpeechTimer.current);
    goToStep(1);
    clearHighlights();
    setExplodeLevel(0);
    logEvent({ type: 'reset', label: 'Rehearsal reset' });
    showToast('Rehearsal reset complete.');
  }, [goToStep, clearHighlights, setExplodeLevel, logEvent, showToast]);

  const mentionParts = useCallback((partIds: string[]) => {
    const liveStore = useAppStore.getState();
    liveStore.setHighlightedParts(partIds);
    for (const partId of partIds) {
      liveStore.mentionPart(partId);
    }
  }, []);

  const onPhotoCheckResult = useCallback((result: PhotoCheckResult) => {
    useAppStore.getState().logEvent({
      type: 'photo_check',
      label: `${result.status} (${Math.round(result.confidence * 100)}%)`,
      payload: {
        status: result.status,
        confidence: result.confidence,
        findings: result.findings.length
      }
    });
  }, []);

  const beginPushToTalk = useCallback(() => {
    const liveStore = useAppStore.getState();
    liveStore.markVoiceInteraction();

    if (liveStore.voiceState === 'speaking') {
      ttsRef.current.cancel();
      liveStore.setVoiceState('idle');
    }

    const stt = sttRef.current;
    if (!stt || stt.state === 'unavailable') {
      liveStore.showToast('Voice needs Chrome - click steps and parts instead.');
      return;
    }

    liveStore.setVoiceState('listening');
    stt.start();
    noSpeechTimer.current = setTimeout(() => {
      if (useAppStore.getState().voiceState === 'listening') {
        stt.abort();
        useAppStore.getState().setVoiceState('idle');
      }
    }, 5000);
  }, []);

  const endPushToTalk = useCallback(() => {
    const stt = sttRef.current;
    if (!stt || useAppStore.getState().voiceState !== 'listening') {
      return;
    }

    clearTimeout(noSpeechTimer.current);
    useAppStore.getState().setVoiceState('transcribing');
    stt.stop();
  }, []);

  useEffect(() => {
    sttRef.current?.abort();
    const stt = createSTTService(commandLanguage === 'fr' ? 'fr-FR' : 'en-US');
    sttRef.current = stt;
    stt.onResult((text) => {
      clearTimeout(noSpeechTimer.current);
      void runUtterance(text);
    });
    stt.onEnd(() => {
      const state = useAppStore.getState().voiceState;
      if (state === 'listening' || state === 'transcribing') {
        useAppStore.getState().setVoiceState('idle');
      }
    });
    stt.onError(() => {
      useAppStore.getState().showToast('Voice capture stopped - click steps and parts instead.');
      useAppStore.getState().setVoiceState('idle');
    });
    return () => {
      if (sttRef.current === stt) {
        stt.abort();
        sttRef.current = undefined;
      }
    };
  }, [runUtterance, commandLanguage]);

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
      clearTimeout(noSpeechTimer.current);
      ttsRef.current.cancel();
      sttRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      if (event.repeat) {
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        beginPushToTalk();
      }
      if (event.key === 'ArrowRight') {
        nextStep();
      }
      if (event.key === 'ArrowLeft') {
        previousStep();
      }
      if (/^[1-9]$/.test(event.key)) {
        goToStep(Number(event.key));
      }
      if (event.key === 'd' || event.key === 'D') {
        setDebugOpen((open) => !open);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
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
  }, [beginPushToTalk, endPushToTalk, nextStep, previousStep, goToStep]);

  return (
    <>
      <div className="appShell">
        <main className="viewerStage" aria-label="3D assembly viewport">
          <Viewer />
          <PartsBinsPanel />
          <div className="viewControls" role="group" aria-label="Camera views">
            <span className="viewControlsLabel">VIEW</span>
            <button className="viewButton" type="button" onClick={() => setActiveView('front', { focus: false })} title="Recenter (front view)">
              Front
            </button>
            <button className="viewButton" type="button" onClick={() => setActiveView('side', { focus: false })} title="Side view">
              Side
            </button>
            <button className="viewButton" type="button" onClick={() => setActiveView('top', { focus: false })} title="Top view">
              Top
            </button>
            <button className="viewButton" type="button" onClick={() => setActiveView('iso', { focus: false })} title="Isometric (3D) view">
              3D
            </button>
          </div>
          <div className="bottomControls">
            <button
              className="iconButton"
              type="button"
              onClick={() => setExplodeLevel(((explodeLevel + 1) % 3) as 0 | 1 | 2)}
              aria-label={explodeLevel === 0 ? 'Explode view' : 'Collapse view'}
              title={explodeLevel === 0 ? 'Explode view' : `Exploded ${explodeLevel}/2 — click to cycle`}
            >
              <Box size={19} aria-hidden />
            </button>
            <button className="iconButton" type="button" onClick={() => goToStep(1)} aria-label="Reset to first step" title="Reset to first step">
              <RotateCcw size={18} aria-hidden />
            </button>
          </div>
        </main>

        <aside className="rightRail" aria-label="Assembly agent panel">
          <div className="stepNav">
            <button className="stepNavButton" type="button" onClick={previousStep} aria-label="Previous step" title="Previous step">
              <ChevronLeft size={18} aria-hidden />
            </button>
            <div className="stepNavRail">
              <ProgressRail
                steps={manifest.steps}
                currentStep={currentStep}
                onSelectStep={goToStep}
              />
            </div>
            <button className="stepNavButton" type="button" onClick={nextStep} aria-label="Next step" title="Next step">
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
          <StepCard step={step} onCommonMistake={triggerMistakeIntent} />
          <section className="voiceRail" aria-label="Voice input">
            <div className="voiceRailHeader">
              <span>VOICE INPUT</span>
              <span>HOLD TO TALK</span>
            </div>
            <div className="voiceRailBody">
              <VoiceOrb
                state={voiceState}
                showHint={!firstVoiceInteraction}
                onPointerDown={beginPushToTalk}
                onPointerUp={endPushToTalk}
              />
            </div>
          </section>
          <PresenterPanel
            utterances={presenterUtterances}
            onRunUtterance={runUtterance}
            onFullReset={fullReset}
            onRehearsalReset={rehearsalReset}
            disabled={voiceState !== 'idle'}
          />
          <CommandPanel
            language={commandLanguage}
            onLanguageChange={setCommandLanguage}
            onSubmit={runUtterance}
            disabled={voiceState !== 'idle'}
          />
          <PhotoCheckPanel
            currentStep={currentStep}
            onMentionParts={mentionParts}
            onRunUtterance={runUtterance}
            onGoToStep={goToStep}
            onResult={onPhotoCheckResult}
            disabled={voiceState !== 'idle'}
          />
          <section className="partRail" aria-label="Parts needed">
            <div className="partRailHeader">
              <span>PARTS IN HAND</span>
              <span>{step.partsNeeded.length} {step.partsNeeded.length === 1 ? 'GROUP' : 'GROUPS'}</span>
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
          <TranscriptPanel transcript={transcript} parts={manifest.parts} steps={manifest.steps} />
        </aside>
      </div>
      <Toast toast={toast} onDismiss={clearToast} />
      <DebugOverlay enabled={debugOpen} onClose={() => setDebugOpen(false)} />
      <div className={`splash ${ready ? 'splashHidden' : ''}`} aria-hidden={ready}>
        <div className="splashInner">
          <div className="splashNumeral">0</div>
          <div className="splashText">calibrating...</div>
        </div>
      </div>
    </>
  );
}
