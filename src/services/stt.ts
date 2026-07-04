import { createRemoteSTTProvider } from './stt.remote';
import { createWebSpeechSTTProvider } from './stt.webSpeech';

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

export type STTProviderName = 'web-speech' | 'remote';

export interface STTProviderOptions {
  language: 'en-US' | 'fr-FR';
}

export interface STTProvider {
  create(options: STTProviderOptions): STTService;
}

export interface CreateSTTServiceOptions {
  provider?: STTProviderName;
}

export function createSTTService(
  language: 'en-US' | 'fr-FR' = 'en-US',
  options: CreateSTTServiceOptions = {}
): STTService {
  const provider = resolveSTTProvider(options.provider);
  return provider.create({ language });
}

export function createUnavailableSTTService(): STTService {
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

function resolveSTTProvider(providerName = getConfiguredSTTProvider()): STTProvider {
  if (providerName === 'remote') {
    return createRemoteSTTProvider();
  }

  return createWebSpeechSTTProvider();
}

function getConfiguredSTTProvider(): STTProviderName {
  return import.meta.env.VITE_STT_PROVIDER === 'remote' ? 'remote' : 'web-speech';
}
