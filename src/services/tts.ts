import type { ResolvedIntent } from '../types/assembly';

export interface TTSService {
  speak(intent: ResolvedIntent): Promise<void>;
  cancel(): void;
  preload(): Promise<void>;
}

export function createTTSService(): TTSService {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;

  return {
    async preload() {
      if (!synth) {
        return;
      }

      synth.getVoices();
    },
    async speak(intent) {
      if (!synth) {
        return;
      }

      synth.cancel();
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(intent.reply);
        utterance.lang = intent.language === 'fr' ? 'fr-FR' : 'en-US';
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        synth.speak(utterance);
      });
    },
    cancel() {
      synth?.cancel();
    }
  };
}
