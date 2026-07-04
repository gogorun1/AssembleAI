import type { STTProvider, STTService } from './stt';

export function createRemoteSTTProvider(): STTProvider {
  return {
    create: () => createRemoteSTTPlaceholder()
  };
}

function createRemoteSTTPlaceholder(): STTService {
  let endCallback: (() => void) | null = null;
  let errorCallback: ((message: string) => void) | null = null;
  let aborted = false;

  return {
    state: 'unavailable',
    start() {
      aborted = false;
      // Browser code must not call remote STT vendors directly because it would expose credentials.
      // Wire this provider to a server-side endpoint before enabling remote capture.
      errorCallback?.('Remote speech-to-text is not configured.');
      if (!aborted) {
        endCallback?.();
      }
    },
    stop() {},
    abort() {
      aborted = true;
    },
    onResult() {},
    onEnd(cb) { endCallback = cb; },
    onError(cb) { errorCallback = cb; }
  };
}
