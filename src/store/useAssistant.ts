import { useCallback, useMemo } from 'react';
import { useAppStore } from './useAppStore';
import { useViewerCommands } from '../viewer/useViewerCommands';
import { parseIntent } from '../services/intent';
import type { Intent } from '../services/intent';
import { stt } from '../services/stt';
import { tts } from '../services/tts';

export interface AssistantOptions {
  onToast: (message: string) => void;
}

export interface Assistant {
  sttSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  submitText: (text: string) => void;
  selectPart: (partId: string) => void;
  selectStep: (index: number) => void;
  showMistake: () => void;
}

const NO_SPEECH_MS = 5000;

export function useAssistant({ onToast }: AssistantOptions): Assistant {
  const viewer = useViewerCommands();
  const sttSupported = useMemo(() => stt.isSupported(), []);

  /** Execute the resolved viewer actions, then speak the reply (3D before voice). */
  const act = useCallback(
    async (intent: Intent) => {
      const s = useAppStore.getState();
      s.setVoiceState('acting');
      s.setLanguage(intent.language);
      const mentioned: string[] = [];

      const mention = (partId?: string) => {
        if (!partId) return;
        s.mention(partId);
        if (!mentioned.includes(partId)) mentioned.push(partId);
      };

      const current = s.currentStep();

      switch (intent.type) {
        case 'next_step':
        case 'prev_step':
        case 'goto_step':
          viewer.goToStep(intent.stepNumber ?? s.currentStepIndex);
          break;
        case 'which_part':
          if (intent.resolvedPartId) {
            viewer.setCamera(intent.resolvedViewKey ?? 'hardware-detail');
            viewer.spinPart(intent.resolvedPartId);
            viewer.highlight([intent.resolvedPartId], 'solid');
            mention(intent.resolvedPartId);
          }
          break;
        case 'where_does_it_go':
          if (intent.resolvedPartId) {
            viewer.setCamera(intent.resolvedViewKey ?? current.cameraView);
            viewer.highlight([intent.resolvedPartId], 'pulse');
            mention(intent.resolvedPartId);
          }
          break;
        case 'show_angle':
          viewer.setCamera(intent.resolvedViewKey ?? 'overview');
          break;
        case 'common_mistake':
          viewer.setCamera(intent.resolvedViewKey ?? current.cameraView);
          viewer.highlight(current.highlightParts, 'pulse');
          mention(current.highlightParts[0]);
          break;
        case 'repeat':
          viewer.setCamera(current.cameraView);
          viewer.highlight(current.highlightParts, 'pulse');
          break;
        case 'how_many_left':
        case 'help':
        case 'unknown':
        default:
          break;
      }

      s.addTranscriptLine({ role: 'agent', text: intent.reply, mentionedParts: mentioned });

      s.setVoiceState('speaking');
      await tts.speak(intent.reply, intent.language);
      // Only return to idle if we weren't interrupted (barge-in) or restarted.
      if (useAppStore.getState().voiceState === 'speaking') s.setVoiceState('idle');
    },
    [viewer],
  );

  /** Full utterance pipeline: transcript → THINKING → parse → act. */
  const ask = useCallback(
    async (utterance: string) => {
      const s = useAppStore.getState();
      const clean = utterance.trim();
      if (!clean) {
        s.setVoiceState('idle');
        return;
      }
      s.addTranscriptLine({ role: 'user', text: clean, mentionedParts: [] });
      s.setVoiceState('thinking');
      const intent = await parseIntent(clean, {
        manifest: s.manifest,
        currentStepIndex: s.currentStepIndex,
      });
      await act(intent);
    },
    [act],
  );

  const bargeIn = useCallback(() => {
    const s = useAppStore.getState();
    if (s.voiceState === 'speaking') {
      tts.cancel(); // cancel within one frame (§9.5)
      s.setVoiceState('idle');
    }
  }, []);

  const startListening = useCallback(() => {
    const s = useAppStore.getState();
    bargeIn();
    if (['listening', 'transcribing', 'thinking'].includes(s.voiceState)) return;

    if (!sttSupported) {
      onToast('Voice needs Chrome — click steps or type a command instead.');
      return;
    }

    s.setVoiceState('listening');
    let ended = false;
    const timeout = window.setTimeout(() => {
      if (useAppStore.getState().voiceState === 'listening') {
        stt.stop();
        useAppStore.getState().setVoiceState('idle');
      }
    }, NO_SPEECH_MS);

    stt.start(s.language, {
      onResult: (transcript) => {
        if (ended) return;
        ended = true;
        window.clearTimeout(timeout);
        useAppStore.getState().setVoiceState('transcribing');
        void ask(transcript);
      },
      onEnd: () => {
        if (ended) return;
        ended = true;
        window.clearTimeout(timeout);
        if (useAppStore.getState().voiceState === 'listening') {
          useAppStore.getState().setVoiceState('idle');
        }
      },
      onError: (message) => {
        if (ended) return;
        ended = true;
        window.clearTimeout(timeout);
        onToast(`Voice error: ${message}. Click steps or type instead.`);
        useAppStore.getState().setVoiceState('idle');
      },
    });
  }, [ask, bargeIn, onToast, sttSupported]);

  const stopListening = useCallback(() => {
    const s = useAppStore.getState();
    if (s.voiceState === 'listening') stt.stop();
  }, []);

  const submitText = useCallback(
    (text: string) => {
      bargeIn();
      void ask(text);
    },
    [ask, bargeIn],
  );

  // ── click paths (every voice action has a click path, §8) ──
  const selectStep = useCallback(
    (index: number) => {
      viewer.goToStep(index);
    },
    [viewer],
  );

  const selectPart = useCallback(
    (partId: string) => {
      const s = useAppStore.getState();
      const part = s.partById(partId);
      if (!part) return;
      void ask(s.language === 'fr' ? `C'est quoi ${part.label} ?` : `Which part is the ${part.label}?`);
    },
    [ask],
  );

  const showMistake = useCallback(() => {
    const s = useAppStore.getState();
    void ask(s.language === 'fr' ? 'Quelle est l\'erreur courante ?' : 'Did people mess this step up before?');
  }, [ask]);

  return { sttSupported, startListening, stopListening, submitText, selectPart, selectStep, showMistake };
}
