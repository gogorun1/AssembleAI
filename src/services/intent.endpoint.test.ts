import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildIntentEndpointPrompt, handleIntentRequest } from '../../api/intent';
import manifest from '../data/manifest';
import type { ResolvedIntent } from '../types/assembly';
import { INTENT_ENDPOINT_TIMEOUT_MS, parseIntent } from './intent';

const context = {
  manifest,
  currentStep: 1
};

const endpointIntent: ResolvedIntent = {
  type: 'which_part',
  language: 'en',
  reply: 'Use part 117327.',
  partIds: ['cam-screw-washer'],
  viewKey: 'screw-detail'
};

describe('parseIntent endpoint integration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns a normalized endpoint ResolvedIntent on success', async () => {
    vi.stubEnv('VITE_INTENT_ENDPOINT', 'https://example.com/intent');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      ...endpointIntent,
      reply: 'Use part 117327. I am highlighting it now. Extra sentence.'
    }));
    vi.stubGlobal('fetch', fetchMock);

    const intent = await parseIntent('Which one is the screw with the washer?', context);

    expect(intent).toMatchObject({
      ...endpointIntent,
      reply: 'Use part 117327. I am highlighting it now.'
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/intent',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      utterance: 'Which one is the screw with the washer?',
      currentStep: 1,
      parts: manifest.parts,
      steps: manifest.steps,
      cameraViews: manifest.cameraViews,
      recentTranscript: []
    });
  });

  it('retries one transient 5xx and returns the second successful result', async () => {
    vi.stubEnv('VITE_INTENT_ENDPOINT', 'https://example.com/intent');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('server unavailable', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(endpointIntent));
    vi.stubGlobal('fetch', fetchMock);

    const intent = await parseIntent('Which one is the screw with the washer?', context);

    expect(intent).toEqual(endpointIntent);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the preset parser when the endpoint returns non-2xx', async () => {
    vi.stubEnv('VITE_INTENT_ENDPOINT', 'https://example.com/intent');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad request', { status: 400 })));

    const intent = await parseIntent('Which one is the screw with the washer?', context);

    expect(intent.type).toBe('which_part');
    expect(intent.partIds).toEqual(['cam-screw-washer']);
  });

  it('falls back to the preset parser when endpoint JSON is invalid', async () => {
    vi.stubEnv('VITE_INTENT_ENDPOINT', 'https://example.com/intent');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })));

    const intent = await parseIntent('Show me from the back.', {
      manifest,
      currentStep: 7
    });

    expect(intent.type).toBe('show_angle');
    expect(intent.viewKey).toBe('back-panel');
  });

  it('falls back to the preset parser when endpoint output is schema-invalid', async () => {
    vi.stubEnv('VITE_INTENT_ENDPOINT', 'https://example.com/intent');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      type: 'which_part',
      language: 'en',
      reply: 'Use this one.',
      partIds: ['missing-part']
    })));

    const intent = await parseIntent('Which one is the shelf pin?', {
      manifest,
      currentStep: 8
    });

    expect(intent.type).toBe('which_part');
    expect(intent.partIds).toEqual(['shelf-pin']);
  });

  it('strips viewer action fields from endpoint unknown intents', async () => {
    vi.stubEnv('VITE_INTENT_ENDPOINT', 'https://example.com/intent');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      type: 'unknown',
      language: 'en',
      reply: 'I see a few possible parts. Which one do you mean?',
      partIds: ['cam-screw-washer'],
      viewKey: 'screw-detail',
      stepNumber: 3
    })));

    const intent = await parseIntent('Which screw?', context);

    expect(intent.type).toBe('unknown');
    expect(intent.partIds).toBeUndefined();
    expect(intent.viewKey).toBeUndefined();
    expect(intent.stepNumber).toBeUndefined();
  });

  it('falls back to the preset parser after an 8-second timeout', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_INTENT_ENDPOINT', 'https://example.com/intent');
    let signal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    }));

    const promise = parseIntent('Where does this panel go?', {
      manifest,
      currentStep: 2
    });

    await vi.advanceTimersByTimeAsync(INTENT_ENDPOINT_TIMEOUT_MS - 1);
    expect(signal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const intent = await promise;

    expect(INTENT_ENDPOINT_TIMEOUT_MS).toBe(8000);
    expect(signal?.aborted).toBe(true);
    expect(intent.type).toBe('where_does_it_go');
    expect(intent.partIds).toEqual(['bottom-panel']);
  });

  it('keeps unknown utterances unknown after fallback', async () => {
    vi.stubEnv('VITE_INTENT_ENDPOINT', 'https://example.com/intent');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));

    const intent = await parseIntent('Banana telescope?', context);

    expect(intent.type).toBe('unknown');
    expect(intent.reply).toContain('I can show a step');
  });
});

describe('intent endpoint handler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a prompt with manifest parts, steps, current step, and camera keys', () => {
    const prompt = buildIntentEndpointPrompt(endpointPayload('Show me from the back.'));

    expect(prompt).toContain('Manifest parts:');
    expect(prompt).toContain('Manifest steps:');
    expect(prompt).toContain('"index":1');
    expect(prompt).toContain('Camera view keys:');
    expect(prompt).toContain('back-panel');
  });

  it('returns a normalized ResolvedIntent from the structured model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      output_text: JSON.stringify({
        ...endpointIntent,
        reply: 'Use part 117327. I am highlighting it now. Extra sentence.'
      })
    })));

    const response = await handleIntentRequest(endpointRequest('Which one is the screw with the washer?'));
    const intent = await response.json() as ResolvedIntent;

    expect(response.status).toBe(200);
    expect(intent).toMatchObject({
      ...endpointIntent,
      reply: 'Use part 117327. I am highlighting it now.'
    });
  });

  it('removes action fields from structured-model unknown intents', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      output_text: JSON.stringify({
        type: 'unknown',
        language: 'en',
        reply: 'I see a few possible parts. Which one do you mean?',
        partIds: ['cam-screw-washer'],
        viewKey: 'screw-detail',
        stepNumber: 2
      })
    })));

    const response = await handleIntentRequest(endpointRequest('Which screw?'));
    const intent = await response.json() as ResolvedIntent;

    expect(response.status).toBe(200);
    expect(intent.type).toBe('unknown');
    expect(intent.partIds).toBeUndefined();
    expect(intent.viewKey).toBeUndefined();
    expect(intent.stepNumber).toBeUndefined();
  });

  it('falls back gracefully when the structured model returns non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })));

    const response = await handleIntentRequest(endpointRequest('Which one is the screw with the washer?'));
    const intent = await response.json() as ResolvedIntent;

    expect(response.status).toBe(200);
    expect(intent.type).toBe('unknown');
  });

  it('falls back gracefully when the structured model returns invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ output_text: 'not-json' })));

    const response = await handleIntentRequest(endpointRequest('Which one is the screw with the washer?'));
    const intent = await response.json() as ResolvedIntent;

    expect(response.status).toBe(200);
    expect(intent.type).toBe('unknown');
  });

  it('falls back gracefully when the structured model response fails schema validation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      output_text: JSON.stringify({
        type: 'which_part',
        language: 'en',
        reply: 'Use this one.',
        partIds: ['missing-part']
      })
    })));

    const response = await handleIntentRequest(endpointRequest('Which one is the screw with the washer?'));
    const intent = await response.json() as ResolvedIntent;

    expect(response.status).toBe(200);
    expect(intent.type).toBe('unknown');
  });
});

function endpointRequest(utterance: string): Request {
  return new Request('https://example.com/api/intent', {
    method: 'POST',
    body: JSON.stringify(endpointPayload(utterance))
  });
}

function endpointPayload(utterance: string) {
  return {
    utterance,
    currentStep: 1,
    parts: manifest.parts,
    steps: manifest.steps,
    cameraViews: manifest.cameraViews,
    recentTranscript: [],
    locale: 'en' as const
  };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
