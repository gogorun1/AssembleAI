import type { ResolvedIntent } from '../types/assembly';
import type { TTSService, TTSProvider } from './tts';

export function createRemoteTTSProvider(): TTSProvider {
  return {
    create: () => createNoopRemoteTTS()
  };
}

function createNoopRemoteTTS(): TTSService {
  let activeController: AbortController | null = null;
  let generation = 0;

  function cancelActiveRequest() {
    generation += 1;
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  }

  return {
    async speak(intent: ResolvedIntent) {
      cancelActiveRequest();
      if (!intent.reply) return;

      const controller = new AbortController();
      const requestGeneration = generation;
      activeController = controller;

      // Browser code must not call remote TTS vendors directly because it would expose credentials.
      // Wire this placeholder to a server-side synthesis endpoint before enabling remote audio.
      await Promise.resolve();

      if (controller.signal.aborted || requestGeneration !== generation) {
        return;
      }

      activeController = null;
    },
    cancel() {
      cancelActiveRequest();
    },
    async preload() {
      // No-op until a server-side remote TTS endpoint exists.
    }
  };
}
