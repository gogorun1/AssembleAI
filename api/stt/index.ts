/**
 * Speech-to-text endpoint. Accepts a short recorded audio clip (multipart form
 * field `audio`) captured from a specific input device in the browser and
 * returns a transcript. This exists because the browser Web Speech API cannot
 * be pointed at a chosen microphone (it always uses the OS default), so routing
 * voice through e.g. Ray-Ban Meta glasses requires capturing the audio
 * ourselves and transcribing it server-side.
 *
 * Server env:
 *   OPENAI_API_KEY   - required
 *   STT_LLM_MODEL    - optional, defaults to gpt-4o-mini-transcribe
 *   STT_LLM_ENDPOINT - optional, defaults to OpenAI transcription endpoint
 */

export interface SttResponse {
  text: string;
}

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_MODEL = 'gpt-4o-mini-transcribe';
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function handleSttRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const apiKey = getEnv('OPENAI_API_KEY');
  if (!apiKey) {
    return jsonResponse({ error: 'OPENAI_API_KEY is not configured on the server.' }, 500);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ error: 'Expected multipart/form-data with an "audio" field.' }, 400);
  }

  const audio = form.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) {
    return jsonResponse({ error: 'Missing "audio" file.' }, 400);
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return jsonResponse({ error: 'Audio clip is too large.' }, 413);
  }

  const language = normalizeLanguage(form.get('language'));

  try {
    const text = await transcribe(audio, language, apiKey);
    return jsonResponse({ text }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription failed';
    return jsonResponse({ error: message }, 502);
  }
}

export const POST = handleSttRequest;
export const config = { runtime: 'edge' };
export default handleSttRequest;

async function transcribe(audio: Blob, language: string | undefined, apiKey: string): Promise<string> {
  const endpoint = getEnv('STT_LLM_ENDPOINT') ?? DEFAULT_ENDPOINT;
  const model = getEnv('STT_LLM_MODEL') ?? DEFAULT_MODEL;

  const upstream = new FormData();
  upstream.append('model', model);
  upstream.append('file', audio, filenameFor(audio));
  if (language) {
    upstream.append('language', language);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upstream
  });

  if (!response.ok) {
    const detail = await safeErrorText(response);
    throw new Error(`Transcription model failed: ${response.status}${detail ? ` ${detail}` : ''}`);
  }

  const payload = (await response.json()) as { text?: unknown };
  return typeof payload.text === 'string' ? payload.text.trim() : '';
}

function filenameFor(audio: Blob): string {
  const type = audio.type || '';
  if (type.includes('webm')) return 'audio.webm';
  if (type.includes('ogg')) return 'audio.ogg';
  if (type.includes('mp4') || type.includes('m4a')) return 'audio.mp4';
  if (type.includes('wav')) return 'audio.wav';
  if (type.includes('mpeg') || type.includes('mp3')) return 'audio.mp3';
  return 'audio.webm';
}

function normalizeLanguage(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const code = value.slice(0, 2).toLowerCase();
  return code === 'en' || code === 'fr' ? code : undefined;
}

async function safeErrorText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 200);
  } catch {
    return '';
  }
}

function jsonResponse(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function getEnv(key: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.[key];
}
