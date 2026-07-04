import type { ResolvedIntent } from '../types/assembly';
import type { TTSProvider, TTSService } from './tts';
import { createNoopTTSService } from './tts';

export function createWebSpeechTTSProvider(): TTSProvider {
  return {
    create: createWebSpeechTTSService
  };
}

export function createWebSpeechTTSService(): TTSService {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;

  if (!synth) {
    return createNoopTTSService();
  }

  return {
    async preload() {
      synth.getVoices();
    },
    async speak(intent: ResolvedIntent) {
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
      synth.cancel();
    }
  };
}
