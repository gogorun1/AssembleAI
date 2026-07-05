import manifest from '../data/manifest';
import type { AssemblyManifest, Step } from '../types/assembly';

export type PhotoCheckStatus = 'pass' | 'warning' | 'fail' | 'unknown';

export interface PhotoCheckFinding {
  id: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  detail: string;
  partIds?: string[];
  stepIndex?: number;
}

export interface PhotoCheckResult {
  status: PhotoCheckStatus;
  confidence: number;
  summary: string;
  findings: PhotoCheckFinding[];
  recommendedUtterance?: string;
  /** 1-based step index the model believes the photo shows. */
  detectedStep?: number;
  /** Title of the detected step, derived from the manifest. */
  detectedStepTitle?: string;
}

export interface PhotoCheckInput {
  file: File;
  currentStep: number;
}

/**
 * Facade for the "Did I do this right?" photo validation.
 *
 * When `VITE_PHOTO_CHECK_ENDPOINT` is set, the photo (base64) plus the manifest
 * steps/parts are POSTed as JSON to the backend, which runs a Gemini vision
 * model to detect which assembly step the photo shows and whether it looks
 * correct. Without an endpoint we return a deterministic manifest-aware mock so
 * the demo works fully offline. Both paths share the same `PhotoCheckResult`
 * contract (including `detectedStep`) so the UI never changes.
 */
export async function checkAssemblyPhoto(
  input: PhotoCheckInput
): Promise<PhotoCheckResult> {
  const endpoint = import.meta.env.VITE_PHOTO_CHECK_ENDPOINT;
  if (!endpoint) {
    return mockPhotoCheck(input);
  }

  return checkWithEndpoint(endpoint, input);
}

async function checkWithEndpoint(
  endpoint: string,
  input: PhotoCheckInput
): Promise<PhotoCheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const imageBase64 = await fileToBase64(input.file);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        mimeType: input.file.type || 'image/jpeg',
        currentStep: input.currentStep,
        steps: manifest.steps,
        parts: manifest.parts
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Photo check endpoint failed: ${response.status}`);
    }

    return normalizeResult(await response.json(), input);
  } catch {
    return unknownResult(input);
  } finally {
    clearTimeout(timeout);
  }
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function getStep(currentStep: number, source: AssemblyManifest = manifest): Step {
  const clamped = Math.max(1, Math.min(currentStep, source.steps.length));
  return source.steps[clamped - 1];
}

/**
 * Deterministic offline mock. Alternates between a warning and a pass based on
 * the step index so rehearsals can demonstrate both a "looks off" and a
 * "looks right" outcome without a backend. When the current step has a
 * documented common mistake, that mistake drives the warning copy.
 */
export function mockPhotoCheck(input: PhotoCheckInput): PhotoCheckResult {
  const step = getStep(input.currentStep);
  const highlightPartIds = step.highlightParts;
  const looksRight = step.index % 2 === 0;

  if (looksRight || !step.commonMistake) {
    return {
      status: 'pass',
      confidence: 0.82,
      summary: `This looks like step ${step.index}: ${step.title}, and it matches the expected assembly state.`,
      findings: [
        {
          id: 'mock-pass',
          severity: 'info',
          title: 'Parts look seated correctly',
          detail: `The highlighted parts for "${step.title}" appear aligned and oriented as expected.`,
          partIds: highlightPartIds,
          stepIndex: step.index
        }
      ],
      recommendedUtterance: "What's next?",
      detectedStep: step.index,
      detectedStepTitle: step.title
    };
  }

  return {
    status: 'warning',
    confidence: 0.58,
    summary: `This looks like step ${step.index}: ${step.title}, but double-check before tightening.`,
    findings: [
      {
        id: 'mock-common-mistake',
        severity: 'warning',
        title: 'Possible common mistake',
        detail: step.commonMistake,
        partIds: highlightPartIds,
        stepIndex: step.index
      },
      {
        id: 'mock-confidence',
        severity: 'info',
        title: 'Confidence is moderate',
        detail: 'Lighting or angle makes this hard to confirm. A closer, well-lit photo would help.',
        stepIndex: step.index
      }
    ],
    recommendedUtterance: 'Did people mess this step up before?',
    detectedStep: step.index,
    detectedStepTitle: step.title
  };
}

function normalizeResult(
  value: Partial<PhotoCheckResult>,
  input: PhotoCheckInput
): PhotoCheckResult {
  if (!value || !value.status || !value.summary) {
    return unknownResult(input);
  }

  const status: PhotoCheckStatus = ['pass', 'warning', 'fail', 'unknown'].includes(
    value.status
  )
    ? value.status
    : 'unknown';

  const detectedStep = resolveDetectedStep(value.detectedStep);
  const detectedStepTitle =
    value.detectedStepTitle ??
    (detectedStep !== undefined ? manifest.steps[detectedStep - 1]?.title : undefined);

  return {
    status,
    confidence:
      typeof value.confidence === 'number'
        ? Math.max(0, Math.min(1, value.confidence))
        : 0,
    summary: String(value.summary),
    findings: Array.isArray(value.findings) ? value.findings : [],
    recommendedUtterance: value.recommendedUtterance,
    detectedStep,
    detectedStepTitle
  };
}

function resolveDetectedStep(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(1, Math.min(Math.round(value), manifest.steps.length));
}

function unknownResult(input: PhotoCheckInput): PhotoCheckResult {
  const step = getStep(input.currentStep);
  return {
    status: 'unknown',
    confidence: 0,
    summary: 'I could not confidently check that photo. Try another angle with better lighting.',
    findings: [
      {
        id: 'unknown-retry',
        severity: 'info',
        title: 'Need a clearer photo',
        detail: `Retake the photo of step ${step.index} (${step.title}) straight on, with the highlighted parts in frame.`,
        stepIndex: step.index
      }
    ],
    recommendedUtterance: undefined
  };
}
