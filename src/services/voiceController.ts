import type { VoiceState } from '../types/assembly';
import type { STTService } from './stt';
import type { TTSService } from './tts';

export const NO_SPEECH_TIMEOUT_MS = 5000;
export const STT_UNAVAILABLE_MESSAGE = 'Voice needs Chrome - click steps and parts instead.';
export const STT_ERROR_MESSAGE = 'Voice capture stopped - click steps and parts instead.';

interface TimerAPI {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout> | undefined): void;
}

export interface VoiceControllerDeps {
  stt?: STTService;
  tts: TTSService;
  getVoiceState(): VoiceState;
  setVoiceState(state: VoiceState): void;
  markVoiceInteraction(): void;
  showRecoverableMessage(message: string): void;
  runUtterance(text: string): void | Promise<void>;
  timer?: TimerAPI;
}

export interface VoiceController {
  beginPushToTalk(): void;
  endPushToTalk(): void;
  dispose(): void;
}

export function createVoiceController({
  stt,
  tts,
  getVoiceState,
  setVoiceState,
  markVoiceInteraction,
  showRecoverableMessage,
  runUtterance,
  timer = globalTimer
}: VoiceControllerDeps): VoiceController {
  let noSpeechTimer: ReturnType<typeof setTimeout> | undefined;

  const clearNoSpeechTimer = () => {
    timer.clearTimeout(noSpeechTimer);
    noSpeechTimer = undefined;
  };

  stt?.onResult((text) => {
    clearNoSpeechTimer();
    void runUtterance(text);
  });

  stt?.onEnd(() => {
    const state = getVoiceState();
    if (state === 'listening' || state === 'transcribing') {
      setVoiceState('idle');
    }
  });

  stt?.onError(() => {
    clearNoSpeechTimer();
    showRecoverableMessage(STT_ERROR_MESSAGE);
    setVoiceState('idle');
  });

  return {
    beginPushToTalk() {
      markVoiceInteraction();

      if (getVoiceState() === 'speaking') {
        tts.cancel();
        setVoiceState('idle');
      }

      if (!stt || stt.state === 'unavailable') {
        showRecoverableMessage(STT_UNAVAILABLE_MESSAGE);
        return;
      }

      setVoiceState('listening');
      stt.start();
      noSpeechTimer = timer.setTimeout(() => {
        if (getVoiceState() === 'listening') {
          stt.abort();
          setVoiceState('idle');
        }
      }, NO_SPEECH_TIMEOUT_MS);
    },
    endPushToTalk() {
      if (!stt || getVoiceState() !== 'listening') {
        return;
      }

      clearNoSpeechTimer();
      setVoiceState('transcribing');
      stt.stop();
    },
    dispose() {
      clearNoSpeechTimer();
      tts.cancel();
      stt?.abort();
    }
  };
}

const globalTimer: TimerAPI = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (timer) => clearTimeout(timer)
};
