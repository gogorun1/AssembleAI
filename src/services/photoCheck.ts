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
}

export interface PhotoCheckInput {
  file: File;
  currentStep: number;
}

/**
 * Facade for the "Did I do this right?" photo validation.
 *
 * When `VITE_PHOTO_CHECK_ENDPOINT` is set the file and current step are POSTed
 * to a real VLM endpoint (Person B track). Without an endpoint we return a
 * deterministic manifest-aware mock so the demo works fully offline. The mock
 * and the real endpoint share the same `PhotoCheckResult` contract so the UI
 * never needs to change when the backend lands.
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
  const timeout = window.setTimeout(() => controller.abort(), 12_000);

  try {
    const body = new FormData();
    body.append('photo', input.file);
    body.append('currentStep', String(input.currentStep));

    const response = await fetch(endpoint, {
      method: 'POST',
      body,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Photo check endpoint failed: ${response.status}`);
    }

    return normalizeResult(await response.json(), input);
  } catch {
    return unknownResult(input);
  } finally {
    window.clearTimeout(timeout);
  }
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
      summary: `Step ${step.index} looks right. ${step.title} matches the expected assembly state.`,
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
      recommendedUtterance: "What's next?"
    };
  }

  return {
    status: 'warning',
    confidence: 0.58,
    summary: `Step ${step.index} looks mostly right, but double-check before tightening.`,
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
    recommendedUtterance: 'Did people mess this step up before?'
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

  return {
    status,
    confidence:
      typeof value.confidence === 'number'
        ? Math.max(0, Math.min(1, value.confidence))
        : 0,
    summary: String(value.summary),
    findings: Array.isArray(value.findings) ? value.findings : [],
    recommendedUtterance: value.recommendedUtterance
  };
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
