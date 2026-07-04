import type { STTProvider, STTProviderOptions, STTService } from './stt';
import { createUnavailableSTTService } from './stt';

type SpeechRecognitionCtor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
}

interface SpeechRecognitionEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function createWebSpeechSTTProvider(): STTProvider {
  return {
    create: createWebSpeechSTTService
  };
}

export function createWebSpeechSTTService(options: STTProviderOptions): STTService {
  if (typeof window === 'undefined') {
    return createUnavailableSTTService();
  }

  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Recognition) {
    return createUnavailableSTTService();
  }

  const recognition = new Recognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = options.language;

  let resultHandler = (_text: string) => {};
  let endHandler = () => {};
  let errorHandler = (_message: string) => {};

  recognition.onresult = (event) => {
    const lastResult = event.results[event.results.length - 1];
    const transcript = lastResult?.[0]?.transcript?.trim();
    if (transcript) {
      resultHandler(transcript);
    }
  };
  recognition.onend = () => endHandler();
  recognition.onerror = (event) => errorHandler(event.error);

  return {
    state: 'available',
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
    onResult: (callback) => {
      resultHandler = callback;
    },
    onEnd: (callback) => {
      endHandler = callback;
    },
    onError: (callback) => {
      errorHandler = callback;
    }
  };
}
