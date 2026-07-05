import type { Part, Step } from '../../src/types/assembly';

export type PhotoCheckStatus = 'pass' | 'warning' | 'fail' | 'unknown';

export interface PhotoCheckFinding {
  id: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  detail: string;
  partIds?: string[];
  stepIndex?: number;
}

export interface PhotoCheckEndpointResult {
  status: PhotoCheckStatus;
  confidence: number;
  summary: string;
  findings: PhotoCheckFinding[];
  recommendedUtterance?: string;
  detectedStep?: number;
  detectedStepTitle?: string;
}

export interface PhotoCheckEndpointRequest {
  imageBase64: string;
  mimeType: string;
  currentStep: number;
  steps: Step[];
  parts: Part[];
}

const DEFAULT_VISION_MODEL = 'gemini-2.0-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const PHOTO_CHECK_PROMPT_TEMPLATE = `You are AssembleAI's assembly photo inspector for an IKEA BILLY bookcase build.
You receive one photo of a partially assembled bookcase plus the ordered list of assembly steps.
Your job:
1. Decide which assembly step the photo most likely shows (detectedStep = the 1-based step index that best matches what is visible).
2. Judge whether the visible state looks correct for that step.
3. Point out any likely mistakes, referencing the part ids provided.

Return ONLY a single JSON object, no markdown fences, matching exactly this shape:
{
  "detectedStep": <integer step index the photo matches>,
  "status": "pass" | "warning" | "fail" | "unknown",
  "confidence": <number between 0 and 1>,
  "summary": "<at most two short sentences that also state which step the user appears to be on>",
  "findings": [
    { "severity": "info" | "warning" | "error", "title": "<short title>", "detail": "<one sentence>", "partIds": ["<part id from the parts list>"] }
  ],
  "recommendedUtterance": "<optional short follow-up question the user could ask>"
}

Rules:
- detectedStep must be one of the provided step indices.
- Only use partIds that exist in the parts list.
- If the photo is too unclear to judge, use status "unknown" and a low confidence.
- Keep summary friendly and concrete. Always mention the detected step number in the summary.`;

export async function handlePhotoCheckRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let payload: PhotoCheckEndpointRequest;
  try {
    payload = (await request.json()) as PhotoCheckEndpointRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!isPhotoCheckRequest(payload)) {
    return jsonResponse({ error: 'Missing image or manifest data' }, 400);
  }

  const apiKey = getEnv('GEMINI_API_KEY') ?? getEnv('GOOGLE_API_KEY');
  if (!apiKey) {
    return jsonResponse({ error: 'Vision model not configured' }, 502);
  }

  try {
    const raw = await callGeminiVision(payload, apiKey);
    return jsonResponse(normalizeResult(raw, payload), 200);
  } catch (error) {
    return jsonResponse({ error: 'Vision model unavailable', detail: describeError(error) }, 502);
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause;
    const causeText =
      cause instanceof Error
        ? `${cause.message}${(cause as { code?: string }).code ? ` (${(cause as { code?: string }).code})` : ''}`
        : cause
          ? String(cause)
          : '';
    return causeText ? `${error.message}: ${causeText}` : error.message;
  }
  return String(error);
}

export const POST = handlePhotoCheckRequest;
export const config = { runtime: 'edge' };
export default handlePhotoCheckRequest;

class GeminiHttpError extends Error {
  constructor(readonly status: number, readonly body: string) {
    super(`Gemini failed: ${status} ${body.slice(0, 400)}`);
    this.name = 'GeminiHttpError';
  }
}

// Cache the model that actually works for this key so we only list models once.
let resolvedModel: string | undefined;

async function callGeminiVision(
  request: PhotoCheckEndpointRequest,
  apiKey: string
): Promise<unknown> {
  const configured = getEnv('GEMINI_VISION_MODEL') ?? DEFAULT_VISION_MODEL;
  const model = resolvedModel ?? configured;

  try {
    return await generateVision(model, request, apiKey);
  } catch (error) {
    // A 404 usually means the model name is not available for this key/API
    // version. Ask the API which models exist and retry with a supported one.
    if (error instanceof GeminiHttpError && error.status === 404) {
      const fallback = await pickAvailableVisionModel(apiKey);
      if (fallback && fallback !== model) {
        resolvedModel = fallback;
        return generateVision(fallback, request, apiKey);
      }
    }
    throw error;
  }
}

async function generateVision(
  model: string,
  request: PhotoCheckEndpointRequest,
  apiKey: string
): Promise<unknown> {
  const endpoint = `${GEMINI_BASE}/${model}:generateContent`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildPhotoCheckPrompt(request) },
          {
            inline_data: {
              mime_type: request.mimeType || 'image/jpeg',
              data: request.imageBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new GeminiHttpError(response.status, text);
  }

  return extractGeminiJson(await response.json());
}

async function pickAvailableVisionModel(apiKey: string): Promise<string | undefined> {
  const response = await fetch(`${GEMINI_BASE}?pageSize=100`, {
    headers: { 'x-goog-api-key': apiKey }
  });
  if (!response.ok) {
    return undefined;
  }

  const data = (await response.json()) as {
    models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
  };
  const usable = (data.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
    .map((model) => (model.name ?? '').replace(/^models\//, ''))
    .filter((name) => name.startsWith('gemini'));

  // Prefer a fast flash model, then any gemini model that can generateContent.
  const preferred =
    usable.find((name) => /flash/.test(name) && !/thinking|exp|preview/.test(name)) ??
    usable.find((name) => /flash/.test(name)) ??
    usable[0];

  return preferred;
}

export function buildPhotoCheckPrompt(request: PhotoCheckEndpointRequest): string {
  const steps = request.steps
    .map(
      (step) =>
        `#${step.index} ${step.title} :: ${step.action}` +
        (step.commonMistake ? ` (common mistake: ${step.commonMistake})` : '') +
        (step.highlightParts?.length ? ` [key parts: ${step.highlightParts.join(', ')}]` : '')
    )
    .join('\n');

  const parts = request.parts
    .map((part) => `${part.id} = ${part.label} (code ${part.code}, qty ${part.quantity})`)
    .join('\n');

  return [
    PHOTO_CHECK_PROMPT_TEMPLATE,
    '',
    `The user currently thinks they are on step: ${request.currentStep}`,
    '',
    'Assembly steps:',
    steps,
    '',
    'Parts list:',
    parts,
    '',
    'Analyze the attached photo now and return the JSON object.'
  ].join('\n');
}

function extractGeminiJson(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const candidates = value.candidates;
  if (Array.isArray(candidates) && candidates.length > 0) {
    const first = candidates[0];
    const content = isRecord(first) ? first.content : undefined;
    const parts = isRecord(content) ? content.parts : undefined;
    if (Array.isArray(parts)) {
      const text = parts
        .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
        .join('')
        .trim();
      if (text) {
        return JSON.parse(stripCodeFences(text));
      }
    }
  }

  return value;
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function normalizeResult(
  value: unknown,
  request: PhotoCheckEndpointRequest
): PhotoCheckEndpointResult {
  const record = isRecord(value) ? value : {};
  const partIds = new Set(request.parts.map((part) => part.id));
  const maxStep = request.steps.length;

  const detectedStep = clampStep(record.detectedStep, maxStep);
  const detectedStepTitle =
    detectedStep !== undefined
      ? request.steps.find((step) => step.index === detectedStep)?.title
      : undefined;

  const status = normalizeStatus(record.status);
  const findings = normalizeFindings(record.findings, partIds);

  const summary =
    typeof record.summary === 'string' && record.summary.trim()
      ? record.summary.trim()
      : detectedStep !== undefined
        ? `This photo looks like step ${detectedStep}${detectedStepTitle ? `: ${detectedStepTitle}` : ''}.`
        : 'I could not confidently read this photo.';

  return {
    status,
    confidence: clampConfidence(record.confidence),
    summary,
    findings,
    recommendedUtterance:
      typeof record.recommendedUtterance === 'string' ? record.recommendedUtterance : undefined,
    detectedStep,
    detectedStepTitle
  };
}

function normalizeStatus(value: unknown): PhotoCheckStatus {
  return value === 'pass' || value === 'warning' || value === 'fail' || value === 'unknown'
    ? value
    : 'unknown';
}

function normalizeFindings(value: unknown, partIds: Set<string>): PhotoCheckFinding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 6).map((item, index) => {
    const record = isRecord(item) ? item : {};
    const severity =
      record.severity === 'warning' || record.severity === 'error' ? record.severity : 'info';
    const rawParts = Array.isArray(record.partIds)
      ? record.partIds.filter((id): id is string => typeof id === 'string' && partIds.has(id))
      : undefined;

    return {
      id: typeof record.id === 'string' ? record.id : `finding-${index}`,
      severity,
      title: typeof record.title === 'string' ? record.title : 'Observation',
      detail: typeof record.detail === 'string' ? record.detail : '',
      partIds: rawParts && rawParts.length > 0 ? rawParts : undefined,
      stepIndex: typeof record.stepIndex === 'number' ? record.stepIndex : undefined
    };
  });
}

function clampConfidence(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0;
}

function clampStep(value: unknown, maxStep: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > maxStep) {
    return Math.max(1, Math.min(rounded, maxStep));
  }
  return rounded;
}

function isPhotoCheckRequest(value: unknown): value is PhotoCheckEndpointRequest {
  return (
    isRecord(value) &&
    typeof value.imageBase64 === 'string' &&
    value.imageBase64.length > 0 &&
    typeof value.currentStep === 'number' &&
    Array.isArray(value.steps) &&
    Array.isArray(value.parts)
  );
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
