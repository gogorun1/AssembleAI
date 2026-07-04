import type { Language } from '../store/useAppStore';

/**
 * Speech-to-text behind a small interface so a Whisper endpoint could be
 * swapped in later without touching the UI (§3). Default implementation uses
 * the Web Speech API (Chrome's webkitSpeechRecognition).
 */
export interface STTHandlers {
  onResult: (transcript: string) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}

export interface STTService {
  isSupported(): boolean;
  start(lang: Language, handlers: STTHandlers): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

function getCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

class WebSpeechSTT implements STTService {
  private recognition: SpeechRecognitionLike | null = null;

  isSupported(): boolean {
    return getCtor() !== null;
  }

  start(lang: Language, handlers: STTHandlers): void {
    const Ctor = getCtor();
    if (!Ctor) {
      handlers.onError('Speech recognition is not supported in this browser.');
      return;
    }
    const rec = new Ctor();
    rec.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    let got = false;
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        got = true;
        handlers.onResult(transcript.trim());
      }
    };
    rec.onerror = (event) => {
      if (event.error !== 'aborted') handlers.onError(event.error);
    };
    rec.onend = () => {
      if (!got) handlers.onEnd();
    };

    this.recognition = rec;
    rec.start();
  }

  stop(): void {
    this.recognition?.stop();
    this.recognition = null;
  }
}

export const stt: STTService = new WebSpeechSTT();
