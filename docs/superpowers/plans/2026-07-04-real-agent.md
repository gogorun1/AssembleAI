# Real Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the preset-only assistant with a real, schema-validated assembly agent that can understand natural language, speak through provider-backed audio, validate photos, and still recover offline.

**Architecture:** Keep the React/Vite app as the demo client and add a thin serverless agent gateway under `api/`. The browser only receives client-safe endpoint URLs; all LLM, STT, TTS, VLM, logging, and storage secrets stay server-side. Deterministic local intent parsing remains the fallback for the six critical demo utterances.

**Tech Stack:** React 18, Vite, TypeScript, Zustand, R3F, Vercel-style serverless functions or an equivalent Node adapter, JSON Schema/Zod validation, provider SDKs for LLM/STT/TTS/VLM, Vitest, Playwright smoke tests.

---

## Files

- Create: `.env.example`
- Create: `api/_shared/env.ts`
- Create: `api/_shared/http.ts`
- Create: `api/_shared/agentSchema.ts`
- Create: `api/intent.ts`
- Create: `api/stt.ts`
- Create: `api/tts.ts`
- Create: `api/photo-check.ts`
- Create: `src/types/agent.ts`
- Create: `src/services/photoCheck.ts`
- Create: `src/services/audioRecorder.ts`
- Create: `src/services/agentTelemetry.ts`
- Create: `src/services/photoCheck.test.ts`
- Create: `src/services/audioRecorder.test.ts`
- Create: `tests/smoke/agent-demo.spec.ts`
- Modify: `package.json`
- Modify: `src/services/intent.ts`
- Modify: `src/services/stt.ts`
- Modify: `src/services/tts.ts`
- Modify: `src/App.tsx`
- Modify: `src/types/assembly.ts`
- Modify: `src/store/useAppStore.ts`
- Modify: `README.md`
- Modify: `docs/specs/real-demo-roadmap.md`

## Current Missing Functionality

- No server-side agent endpoint exists yet; `VITE_INTENT_ENDPOINT` can point to one, but this repo does not provide it.
- The current endpoint response is only loosely normalized, not schema-validated.
- The intent request omits recent transcript, camera views, and strict allowed ids.
- No API-key boundary exists because all current logic is client-side.
- STT is browser Web Speech only.
- TTS is browser `speechSynthesis` only.
- Photo validation and VLM prompting are absent.
- There is no presenter mode, reset button, local event log, or debug bundle.
- Browser smoke tests and CI are absent.
- The current GLB pipeline exists, but full production asset polish and full step pose coverage remain.

### Task 1: Shared Agent Contracts

**Files:**
- Create: `src/types/agent.ts`
- Create: `api/_shared/agentSchema.ts`
- Modify: `src/types/assembly.ts`
- Test: `src/services/intent.test.ts`

- [ ] **Step 1: Add shared request and response types**

Create `src/types/agent.ts`:

```ts
import type { AssemblyManifest, ResolvedIntent, TranscriptLine } from './assembly';

export interface AgentIntentRequest {
  utterance: string;
  currentStep: number;
  manifest: Pick<AssemblyManifest, 'id' | 'name' | 'parts' | 'steps' | 'cameraViews'>;
  recentTranscript: TranscriptLine[];
}

export interface AgentIntentResponse extends ResolvedIntent {
  confidence: number;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  latencyMs?: number;
  provider?: string;
}

export interface PhotoCheckRequest {
  currentStep: number;
  imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface PhotoCheckResponse {
  looksRight: boolean;
  confidence: number;
  issues: string[];
  reply: string;
  highlightPartIds: string[];
}
```

- [ ] **Step 2: Define the server schema**

Create `api/_shared/agentSchema.ts` with an allow-list schema for `IntentType`, part ids, step ids, and camera keys. The first implementation can use plain TypeScript guards to avoid adding dependencies; add `zod` only if validation logic becomes hard to read.

```ts
import type { AgentIntentResponse, PhotoCheckResponse } from '../../src/types/agent';
import type { AssemblyManifest, IntentType } from '../../src/types/assembly';

const intentTypes: IntentType[] = [
  'next_step',
  'prev_step',
  'goto_step',
  'which_part',
  'where_does_it_go',
  'show_angle',
  'repeat',
  'how_many_left',
  'common_mistake',
  'help',
  'unknown'
];

export function coerceIntentResponse(value: unknown, manifest: AssemblyManifest): AgentIntentResponse {
  const input = typeof value === 'object' && value !== null ? value as Partial<AgentIntentResponse> : {};
  const partIds = new Set(manifest.parts.map((part) => part.id));
  const cameraKeys = new Set(Object.keys(manifest.cameraViews));
  const type = intentTypes.includes(input.type as IntentType) ? input.type as IntentType : 'unknown';
  return {
    type,
    language: input.language === 'fr' ? 'fr' : 'en',
    reply: typeof input.reply === 'string' && input.reply.trim() ? input.reply.trim() : 'I need one more detail before I move the model.',
    confidence: typeof input.confidence === 'number' ? Math.max(0, Math.min(1, input.confidence)) : 0,
    partIds: Array.isArray(input.partIds) ? input.partIds.filter((id) => partIds.has(id)) : undefined,
    stepNumber: typeof input.stepNumber === 'number' ? Math.max(1, Math.min(manifest.steps.length, Math.trunc(input.stepNumber))) : undefined,
    viewKey: typeof input.viewKey === 'string' && cameraKeys.has(input.viewKey) ? input.viewKey : undefined,
    needsClarification: input.needsClarification === true,
    clarificationQuestion: typeof input.clarificationQuestion === 'string' ? input.clarificationQuestion : undefined,
    provider: typeof input.provider === 'string' ? input.provider : undefined,
    latencyMs: typeof input.latencyMs === 'number' ? input.latencyMs : undefined
  };
}

export function coercePhotoCheckResponse(value: unknown, manifest: AssemblyManifest): PhotoCheckResponse {
  const input = typeof value === 'object' && value !== null ? value as Partial<PhotoCheckResponse> : {};
  const partIds = new Set(manifest.parts.map((part) => part.id));
  return {
    looksRight: input.looksRight === true,
    confidence: typeof input.confidence === 'number' ? Math.max(0, Math.min(1, input.confidence)) : 0,
    issues: Array.isArray(input.issues) ? input.issues.filter((issue): issue is string => typeof issue === 'string') : [],
    reply: typeof input.reply === 'string' && input.reply.trim() ? input.reply.trim() : 'I cannot verify this photo confidently. Please take one more photo from the front.',
    highlightPartIds: Array.isArray(input.highlightPartIds) ? input.highlightPartIds.filter((id) => partIds.has(id)) : []
  };
}
```

- [ ] **Step 3: Run typecheck and tests**

Run:

```bash
npm test
npm run build
```

Expected: all existing tests pass and TypeScript accepts the shared imports.

### Task 2: Serverless Intent Endpoint

**Files:**
- Create: `api/_shared/env.ts`
- Create: `api/_shared/http.ts`
- Create: `api/intent.ts`
- Modify: `src/services/intent.ts`
- Test: `src/services/intent.test.ts`

- [ ] **Step 1: Add server env access**

Create `api/_shared/env.ts`:

```ts
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}
```

- [ ] **Step 2: Add common HTTP helpers**

Create `api/_shared/http.ts`:

```ts
export function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export async function readJson<T>(request: Request): Promise<T> {
  return await request.json() as T;
}
```

- [ ] **Step 3: Implement `/api/intent`**

Create `api/intent.ts` as the agent boundary. The first provider should call one structured-output LLM with a strict JSON instruction and pass `manifest.parts`, `manifest.steps`, `manifest.cameraViews`, `currentStep`, and `recentTranscript`.

The handler must return `AgentIntentResponse` and must never expose `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, `ASSEMBLYAI_API_KEY`, or `ELEVENLABS_API_KEY` to the client.

- [ ] **Step 4: Send richer client context**

Modify `src/services/intent.ts` so endpoint calls send:

```ts
{
  utterance,
  currentStep: context.currentStep,
  manifest: {
    id: context.manifest.id,
    name: context.manifest.name,
    parts: context.manifest.parts,
    steps: context.manifest.steps,
    cameraViews: context.manifest.cameraViews
  },
  recentTranscript: useAppStore.getState().transcript.slice(-6)
}
```

- [ ] **Step 5: Preserve deterministic fallback**

Keep `parsePresetIntent` intact. If `/api/intent` returns non-2xx, times out, or fails validation, return preset parsing when it recognizes the utterance; otherwise return `unknown`.

### Task 3: Real Voice Input

**Files:**
- Create: `src/services/audioRecorder.ts`
- Modify: `src/services/stt.ts`
- Create: `api/stt.ts`
- Test: `src/services/audioRecorder.test.ts`

- [ ] **Step 1: Add browser audio recorder**

Create `src/services/audioRecorder.ts` with a `recordUntilStop()` helper built on `navigator.mediaDevices.getUserMedia` and `MediaRecorder`. It should return `{ blob, mimeType, durationMs }` and stop all tracks in `finally`.

- [ ] **Step 2: Keep Web Speech default**

Modify `createSTTService()` so `VITE_STT_PROVIDER=webspeech` uses the current implementation. Add `VITE_STT_PROVIDER=recorded` to record audio and POST it to `/api/stt`.

- [ ] **Step 3: Add `/api/stt`**

Create `api/stt.ts` that accepts an audio blob, selects `STT_PROVIDER`, and returns:

```ts
{ "text": "Which one is the screw with the washer?", "language": "en", "durationMs": 930 }
```

Supported first-pass providers: browser Web Speech on client, one hosted STT provider on server, and a clear error response when no provider key is configured.

### Task 4: Real Speech Output

**Files:**
- Modify: `src/services/tts.ts`
- Create: `api/tts.ts`

- [ ] **Step 1: Add provider selection**

Keep `speechSynthesis` as the default. Add `VITE_TTS_PROVIDER=hosted` to POST `{ text, language }` to `/api/tts`.

- [ ] **Step 2: Add server TTS**

Create `api/tts.ts` that returns an audio payload:

```ts
{
  "mimeType": "audio/mpeg",
  "audioBase64": "base64_encoded_audio"
}
```

- [ ] **Step 3: Preserve barge-in**

When the user starts speaking during `speaking`, call `tts.cancel()`, stop the current `HTMLAudioElement`, and then start STT. Add a unit test around cancel behavior if the service is split into a pure playback helper.

### Task 5: Photo Validation Agent

**Files:**
- Create: `src/services/photoCheck.ts`
- Create: `api/photo-check.ts`
- Modify: `src/App.tsx`
- Modify: `src/store/useAppStore.ts`
- Test: `src/services/photoCheck.test.ts`

- [ ] **Step 1: Add the client service**

Create `src/services/photoCheck.ts` that accepts `{ file, currentStep }`, converts the image to base64, POSTs to `VITE_PHOTO_CHECK_ENDPOINT`, and returns `PhotoCheckResponse`.

- [ ] **Step 2: Add the VLM endpoint**

Create `api/photo-check.ts`. The prompt must include the current step title/action, parts needed, common mistake, and expected highlighted part ids. The response must be coerced through `coercePhotoCheckResponse`.

- [ ] **Step 3: Add UI shell**

Add a compact upload control in the right rail. On response, append an agent transcript line, highlight `highlightPartIds`, and show low-confidence requests as a neutral retry message.

### Task 6: Presenter Recovery and Debugging

**Files:**
- Modify: `src/App.tsx`
- Create: `src/services/agentTelemetry.ts`
- Create: `tests/smoke/agent-demo.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Add presenter mode**

Add `?presenter=1` mode with buttons for the six demo utterances, reset, copy debug bundle, and network-off mode.

- [ ] **Step 2: Add local event log**

Create `src/services/agentTelemetry.ts` with:

```ts
export interface AgentEvent {
  id: string;
  name: 'stt' | 'intent' | 'action' | 'tts' | 'photo_check' | 'error';
  timestamp: number;
  detail: Record<string, unknown>;
}
```

Store only local demo telemetry in memory and `localStorage`; do not upload logs by default.

- [ ] **Step 3: Add smoke tests**

Add a Playwright smoke test for app load, step navigation, part click, presenter utterance button, and WebGL fallback route. Add scripts:

```json
{
  "test:browser": "playwright test tests/smoke"
}
```

### Task 7: Deployment and Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/specs/real-demo-roadmap.md`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Add CI**

Run in CI:

```bash
npm ci
npm test
npm run build
```

- [ ] **Step 2: Add deployment notes**

Document two modes:

- Local/offline: no API keys, deterministic preset parser, Web Speech, browser TTS.
- Real agent: serverless API configured with `OPENAI_API_KEY`, one STT provider key, one TTS provider key, and optional VLM/photo-check key.

- [ ] **Step 3: Final acceptance run**

Before calling the real agent complete, run:

```bash
npm test
npm run build
npm run test:browser
```

Expected acceptance:

- Six demo utterances resolve through remote intent and fallback locally when the endpoint is unavailable.
- Part ids and camera keys are schema-validated.
- Hosted STT/TTS can be disabled without breaking the demo.
- Photo check returns a bounded answer and highlights only manifest part ids.
- Presenter can recover from a failed network call in one click.
