import type { STTProvider, STTService } from './stt';
import { createUnavailableSTTService } from './stt';

export function createRemoteSTTProvider(): STTProvider {
  return {
    create: (options) => {
      const apiKey = getApiKey();
      if (!apiKey) {
        console.warn('[STT Remote] VITE_OPENAI_API_KEY not set, falling back to unavailable');
        return createUnavailableSTTService();
      }
      return createWhisperSTTService(apiKey, options.language);
    }
  };
}

function getApiKey(): string | undefined {
  return import.meta.env.VITE_OPENAI_API_KEY;
}

function createWhisperSTTService(apiKey: string, language: string): STTService {
  let resultCallback: ((text: string) => void) | null = null;
  let endCallback: (() => void) | null = null;
  let errorCallback: ((message: string) => void) | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let aborted = false;

  async function transcribe(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', language === 'fr-FR' ? 'fr' : 'en');
    formData.append('response_format', 'text');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.status}`);
    }

    return (await response.text()).trim();
  }

  return {
    state: 'available',
    start() {
      aborted = false;
      audioChunks = [];

      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          mediaRecorder = new MediaRecorder(stream);
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
          };
          mediaRecorder.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());
            if (aborted) return;
            try {
              const blob = new Blob(audioChunks, { type: 'audio/webm' });
              const text = await transcribe(blob);
              if (!aborted && text && resultCallback) resultCallback(text);
            } catch (err) {
              if (!aborted && errorCallback) errorCallback(String(err));
            } finally {
              if (!aborted && endCallback) endCallback();
            }
          };
          mediaRecorder.start();
        })
        .catch((err) => {
          if (errorCallback) errorCallback(`Microphone access denied: ${err}`);
          if (endCallback) endCallback();
        });
    },
    stop() {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    },
    abort() {
      aborted = true;
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    },
    onResult(cb) { resultCallback = cb; },
    onEnd(cb) { endCallback = cb; },
    onError(cb) { errorCallback = cb; }
  };
}
