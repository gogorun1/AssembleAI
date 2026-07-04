import type { STTProvider } from './stt';
import { createUnavailableSTTService } from './stt';

export function createRemoteSTTProvider(): STTProvider {
  return {
    create: () => createUnavailableSTTService()
  };
}
