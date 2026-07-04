import type { ResolvedIntent } from '../types/assembly';
import { createRemoteTTSProvider } from './tts.remote';
import { createWebSpeechTTSProvider } from './tts.webSpeech';

export interface TTSService {
  speak(intent: ResolvedIntent): Promise<void>;
  cancel(): void;
  preload(): Promise<void>;
}

export type TTSProviderName = 'web-speech' | 'remote';

export interface TTSProvider {
  create(): TTSService;
}

export interface CreateTTSServiceOptions {
  provider?: TTSProviderName;
}

export function createTTSService(options: CreateTTSServiceOptions = {}): TTSService {
  const provider = resolveTTSProvider(options.provider);
  return provider.create();
}

export function createNoopTTSService(): TTSService {
  return {
    speak: async () => {},
    cancel: () => {},
    preload: async () => {}
  };
}

function resolveTTSProvider(providerName = getConfiguredTTSProvider()): TTSProvider {
  if (providerName === 'remote') {
    return createRemoteTTSProvider();
  }

  return createWebSpeechTTSProvider();
}

function getConfiguredTTSProvider(): TTSProviderName {
  return import.meta.env.VITE_TTS_PROVIDER === 'remote' ? 'remote' : 'web-speech';
}
