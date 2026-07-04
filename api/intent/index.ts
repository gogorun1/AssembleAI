import type { AssemblyManifest, CameraView, Part, ResolvedIntent, Step, TranscriptLine } from '../../src/types/assembly';
import { validateResolvedIntent } from '../../src/services/intent.schema';

export interface IntentEndpointRequest {
  utterance: string;
  currentStep: number;
  parts: Part[];
  steps: Step[];
  cameraViews: Record<string, CameraView>;
  recentTranscript?: TranscriptLine[];
  locale?: 'en' | 'fr';
}

export const INTENT_ENDPOINT_PROMPT_TEMPLATE = `You are AssembleAI's intent parser.
Return only one JSON object that matches the ResolvedIntent schema.
Allowed intent types: next_step, prev_step, goto_step, which_part, where_does_it_go, show_angle, repeat, how_many_left, common_mistake, help, unknown.
Allowed languages: en, fr.
Keep reply to at most two short, direct sentences tied to the visual action.
Only use partIds from the manifest parts list.
Only use viewKey values from the camera view keys list.
If several parts could match, return type "unknown" with a clarification reply listing candidate labels or codes.
For type "unknown", do not include partIds, stepNumber, or viewKey.`;

const FALLBACK_INTENT: ResolvedIntent = {
  type: 'unknown',
  language: 'en',
  reply: 'I can show a step, a part, or a common mistake. Which one should I focus on?'
};

export function buildIntentEndpointPrompt(request: IntentEndpointRequest): string {
  const currentStep = request.steps.find((step) => step.index === request.currentStep);
  const transcript = request.recentTranscript
    ?.slice(-6)
    .map((line) => `${line.speaker}: ${line.text}`)
    .join('\n') || 'No recent transcript.';

  return [
    INTENT_ENDPOINT_PROMPT_TEMPLATE,
    '',
    `Locale hint: ${request.locale ?? 'unknown'}`,
    `Current step: ${currentStep ? JSON.stringify(currentStep) : request.currentStep}`,
    `Camera view keys: ${Object.keys(request.cameraViews).join(', ')}`,
    `Manifest parts: ${JSON.stringify(request.parts)}`,
    `Manifest steps: ${JSON.stringify(request.steps)}`,
    `Recent transcript:\n${transcript}`,
    `User utterance: ${request.utterance}`,
    '',
    'JSON response:'
  ].join('\n');
}

export async function handleIntentRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let payload: IntentEndpointRequest;
  try {
    payload = await request.json() as IntentEndpointRequest;
  } catch {
    return jsonResponse(FALLBACK_INTENT, 200);
  }

  if (!isIntentEndpointRequest(payload)) {
    return jsonResponse(FALLBACK_INTENT, 200);
  }

  const manifest = toManifest(payload);
  try {
    const modelIntent = await callStructuredIntentModel(payload);
    return jsonResponse(normalizeEndpointIntent(modelIntent, payload, manifest), 200);
  } catch {
    return jsonResponse(FALLBACK_INTENT, 200);
  }
}

export const POST = handleIntentRequest;
export const config = { runtime: 'edge' };
export default handleIntentRequest;

async function callStructuredIntentModel(request: IntentEndpointRequest): Promise<unknown> {
  const endpoint = getEnv('INTENT_LLM_ENDPOINT') ?? 'https://api.openai.com/v1/responses';
  const apiKey = getEnv('OPENAI_API_KEY');
  const body = {
    model: getEnv('INTENT_LLM_MODEL') ?? 'gpt-4.1-mini',
    input: buildIntentEndpointPrompt(request),
    text: {
      format: {
        type: 'json_schema',
        name: 'resolved_intent',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'language', 'reply'],
          properties: {
            type: {
              enum: ['next_step', 'prev_step', 'goto_step', 'which_part', 'where_does_it_go', 'show_angle', 'repeat', 'how_many_left', 'common_mistake', 'help', 'unknown']
            },
            partQuery: { type: 'string' },
            stepNumber: { type: 'integer', minimum: 1 },
            viewQuery: { type: 'string' },
            language: { enum: ['en', 'fr'] },
            reply: { type: 'string', minLength: 1 },
            partIds: { type: 'array', items: { type: 'string' } },
            viewKey: { type: 'string' }
          }
        }
      }
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Intent model failed: ${response.status}`);
  }

  return extractModelJson(await response.json());
}

function normalizeEndpointIntent(
  value: unknown,
  request: IntentEndpointRequest,
  manifest: AssemblyManifest
): ResolvedIntent {
  const record = isRecord(value) ? value : {};
  const currentStep = request.steps.find((step) => step.index === request.currentStep) ?? request.steps[0];
  const type = record.type;
  const isUnknown = type === 'unknown';
  const candidate = {
    type,
    language: record.language ?? request.locale ?? detectLanguage(request.utterance),
    reply: trimToTwoSentences(String(record.reply ?? '')),
    partQuery: isUnknown ? undefined : record.partQuery,
    stepNumber: isUnknown ? undefined : record.stepNumber,
    viewQuery: isUnknown ? undefined : record.viewQuery,
    partIds: isUnknown ? undefined : record.partIds,
    viewKey: isUnknown ? undefined : record.viewKey ?? currentStep?.cameraView
  };
  const validation = validateResolvedIntent(candidate, manifest);

  if (!validation.ok || !validation.intent) {
    throw new Error(`Invalid model intent: ${validation.errors.join(', ')}`);
  }

  return validation.intent;
}

function extractModelJson(value: unknown): unknown {
  if (isRecord(value) && isRecord(value.output_parsed)) {
    return value.output_parsed;
  }

  if (isRecord(value) && typeof value.output_text === 'string') {
    return JSON.parse(value.output_text);
  }

  if (isRecord(value) && Array.isArray(value.output)) {
    const text = value.output
      .flatMap((item) => isRecord(item) && Array.isArray(item.content) ? item.content : [])
      .find((content) => isRecord(content) && typeof content.text === 'string');

    if (isRecord(text) && typeof text.text === 'string') {
      return JSON.parse(text.text);
    }
  }

  return value;
}

function isIntentEndpointRequest(value: unknown): value is IntentEndpointRequest {
  return isRecord(value) &&
    typeof value.utterance === 'string' &&
    typeof value.currentStep === 'number' &&
    Array.isArray(value.parts) &&
    Array.isArray(value.steps) &&
    isRecord(value.cameraViews);
}

function toManifest(request: IntentEndpointRequest): AssemblyManifest {
  return {
    id: 'intent-endpoint-request',
    name: 'Intent endpoint request',
    parts: request.parts,
    steps: request.steps,
    cameraViews: request.cameraViews
  };
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

function detectLanguage(utterance: string): 'en' | 'fr' {
  const text = ` ${utterance.toLocaleLowerCase()} `;
  const folded = foldText(text);
  if (/[àâçéèêëîïôûùüÿæœ]/i.test(text)) {
    return 'fr';
  }

  const markers = folded.match(/\b(cette|ce|cet|elle|ou|vis|va|piece|etape|erreur|montre)\b/g) ?? [];
  const hasFrenchPhrase =
    /\b(?:ou\s+va|va\s+ou|elle\s+va|cette\s+vis|cette\s+piece|montre\s+(?:la|le|les|moi)|(?:la|le|les)\s+(?:vis|piece))\b/.test(folded);

  return hasFrenchPhrase || markers.length >= 2 ? 'fr' : 'en';
}

function trimToTwoSentences(reply: string): string {
  return reply
    .trim()
    .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)
    ?.slice(0, 2)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim() ?? '';
}

function foldText(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
