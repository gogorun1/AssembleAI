import type { ResolvedIntent } from '../types/assembly';
import type { TTSService, TTSProvider } from './tts';

export function createRemoteTTSProvider(): TTSProvider {
  return {
    create: () => {
      const apiKey = getApiKey();
      if (!apiKey) {
        console.warn('[TTS Remote] VITE_OPENAI_API_KEY not set, falling back to no-op');
        return createNoopRemoteTTS();
      }
      return createOpenAITTSService(apiKey);
    }
  };
}

function getApiKey(): string | undefined {
  return import.meta.env.VITE_OPENAI_API_KEY;
}

function createNoopRemoteTTS(): TTSService {
  return {
    speak: async () => {},
    cancel: () => {},
    preload: async () => {}
  };
}

function createOpenAITTSService(apiKey: string): TTSService {
  let currentAudio: HTMLAudioElement | null = null;

  async function synthesize(text: string, language: 'en' | 'fr'): Promise<void> {
    const voice = language === 'fr' ? 'nova' : 'shimmer';

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice,
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI TTS error: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      currentAudio = audio;
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        resolve();
      };
      audio.onerror = (e) => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        reject(e);
      };
      audio.play().catch(reject);
    });
  }

  return {
    async speak(intent: ResolvedIntent) {
      if (!intent.reply) return;
      try {
        await synthesize(intent.reply, intent.language);
      } catch (err) {
        console.error('[TTS Remote] speak failed:', err);
      }
    },
    cancel() {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
      }
    },
    async preload() {
      // No-op: OpenAI TTS is streaming, no preloading needed
    }
  };
}
