import type { TTSProvider } from './tts';
import { createNoopTTSService } from './tts';

export function createRemoteTTSProvider(): TTSProvider {
  return {
    create: () => createNoopTTSService()
  };
}
