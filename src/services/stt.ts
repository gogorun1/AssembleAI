export type STTState = 'available' | 'unavailable';

export interface STTService {
  state: STTState;
  start(): void;
  stop(): void;
  abort(): void;
  onResult(callback: (text: string) => void): void;
  onEnd(callback: () => void): void;
  onError(callback: (message: string) => void): void;
}

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

export function createSTTService(language: 'en-US' | 'fr-FR' = 'en-US'): STTService {
  if (typeof window === 'undefined') {
    return createUnavailableService();
  }

  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Recognition) {
    return createUnavailableService();
  }

  const recognition = new Recognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = language;

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

function createUnavailableService(): STTService {
  return {
    state: 'unavailable',
    start: () => {},
    stop: () => {},
    abort: () => {},
    onResult: () => {},
    onEnd: () => {},
    onError: () => {}
  };
}

export interface RecordedSTTOptions {
  /** Endpoint that accepts multipart `audio` + `language` and returns `{ text }`. */
  endpoint: string;
  language: 'en-US' | 'fr-FR';
  /** Specific input device to capture (e.g. Ray-Ban Meta glasses). */
  deviceId?: string;
}

function supportsRecording(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

function pickMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4'
  ];
  return candidates.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

/**
 * Speech-to-text that records from a chosen microphone and transcribes it via a
 * backend endpoint. Unlike the Web Speech API this can target a specific device,
 * which is required to route voice through external hardware such as Ray-Ban Meta
 * glasses (the browser recognizer only ever uses the OS default input).
 */
export function createRecordedSTTService(options: RecordedSTTOptions): STTService {
  if (!supportsRecording()) {
    return createUnavailableService();
  }

  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let stopRequested = false;
  let aborted = false;

  let resultHandler = (_text: string) => {};
  let endHandler = () => {};
  let errorHandler = (_message: string) => {};

  const releaseStream = () => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    recorder = null;
    chunks = [];
  };

  const beginRecording = async () => {
    stopRequested = false;
    aborted = false;
    chunks = [];

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: options.deviceId ? { deviceId: { exact: options.deviceId } } : true
      });
    } catch {
      errorHandler('Could not open the selected microphone.');
      endHandler();
      return;
    }

    let localRecorder: MediaRecorder;
    try {
      const mimeType = pickMimeType();
      localRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      releaseStream();
      errorHandler('Recording is not supported in this browser.');
      endHandler();
      return;
    }
    recorder = localRecorder;

    localRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    localRecorder.onstop = async () => {
      const type = localRecorder.mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type });
      releaseStream();

      if (aborted) {
        return;
      }
      if (blob.size === 0) {
        endHandler();
        return;
      }

      try {
        const text = await transcribeClip(blob, options);
        if (text) {
          resultHandler(text);
        }
      } catch {
        errorHandler('Transcription failed - check the STT server and try again.');
      } finally {
        endHandler();
      }
    };

    localRecorder.start();
    // The caller's start()/stop() are synchronous, so a quick tap can request a
    // stop before getUserMedia resolves; honor it as soon as recording begins.
    if (stopRequested || aborted) {
      localRecorder.stop();
    }
  };

  return {
    state: 'available',
    start: () => {
      void beginRecording();
    },
    stop: () => {
      stopRequested = true;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
    },
    abort: () => {
      aborted = true;
      stopRequested = true;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        releaseStream();
      }
    },
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

async function transcribeClip(blob: Blob, options: RecordedSTTOptions): Promise<string> {
  const form = new FormData();
  form.append('audio', blob, 'clip.webm');
  form.append('language', options.language.slice(0, 2));

  const response = await fetch(options.endpoint, { method: 'POST', body: form });
  if (!response.ok) {
    throw new Error(`STT endpoint failed: ${response.status}`);
  }

  const payload = (await response.json()) as { text?: unknown };
  return typeof payload.text === 'string' ? payload.text.trim() : '';
}
