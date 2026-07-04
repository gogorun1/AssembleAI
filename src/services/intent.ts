import type { AssemblyManifest, ResolvedIntent, Step } from '../types/assembly';

export interface IntentContext {
  manifest: AssemblyManifest;
  currentStep: number;
}

const digitWords = new Map<string, number>([
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9]
]);

export async function parseIntent(
  utterance: string,
  context: IntentContext
): Promise<ResolvedIntent> {
  const endpoint = import.meta.env.VITE_INTENT_ENDPOINT;
  if (endpoint) {
    return parseIntentWithEndpoint(endpoint, utterance, context);
  }

  return parsePresetIntent(utterance, context);
}

async function parseIntentWithEndpoint(
  endpoint: string,
  utterance: string,
  context: IntentContext
): Promise<ResolvedIntent> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        utterance,
        currentStep: context.currentStep,
        parts: context.manifest.parts,
        steps: context.manifest.steps
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Intent endpoint failed: ${response.status}`);
    }

    return normalizeIntent(await response.json(), utterance, context);
  } catch {
    return unknownIntent(utterance);
  } finally {
    window.clearTimeout(timeout);
  }
}

function parsePresetIntent(utterance: string, context: IntentContext): ResolvedIntent {
  const phrase = normalizeText(utterance);
  const language = detectLanguage(utterance);
  const step = getStep(context);

  if (language === 'fr' && includesAny(phrase, ['vis', 'ou', 'où'])) {
    return {
      type: 'where_does_it_go',
      partQuery: 'vis',
      language,
      partIds: ['cam-screw-washer'],
      viewKey: 'screw-detail',
      reply: 'Cette vis va dans les trous pre-perces des panneaux lateraux, rondelle visible. Je te montre le bon point de fixation.'
    };
  }

  if (includesAny(phrase, ['what next', 'what s next', 'whats next', 'next step', 'continue'])) {
    const nextIndex = Math.min(context.currentStep + 1, context.manifest.steps.length);
    return {
      type: 'next_step',
      stepNumber: nextIndex,
      language,
      reply: `Next is step ${nextIndex}: ${context.manifest.steps[nextIndex - 1].title}.`
    };
  }

  if (includesAny(phrase, ['previous', 'back one', 'go back', 'last step'])) {
    const previousIndex = Math.max(context.currentStep - 1, 1);
    return {
      type: 'prev_step',
      stepNumber: previousIndex,
      language,
      reply: `Back to step ${previousIndex}: ${context.manifest.steps[previousIndex - 1].title}.`
    };
  }

  const requestedStep = parseStepNumber(phrase, context.manifest.steps.length);
  if (requestedStep) {
    return {
      type: 'goto_step',
      stepNumber: requestedStep,
      language,
      reply: `Jumping to step ${requestedStep}: ${context.manifest.steps[requestedStep - 1].title}.`
    };
  }

  if (includesAny(phrase, ['from the back', 'back view', 'behind', 'rear'])) {
    return {
      type: 'show_angle',
      viewQuery: 'back',
      viewKey: 'back-panel',
      language,
      reply: 'Here is the back view, with the rear groove and panel edge visible.'
    };
  }

  if (includesAny(phrase, ['closer', 'close up', 'zoom'])) {
    return {
      type: 'show_angle',
      viewQuery: 'closer',
      viewKey: step.cameraView,
      language,
      reply: `Zooming into ${context.manifest.cameraViews[step.cameraView].label}.`
    };
  }

  if (includesAny(phrase, ['mess this step', 'mistake', 'wrong', 'people mess'])) {
    const partIds = resolveMistakePartIds(step);
    return {
      type: 'common_mistake',
      language,
      partIds,
      viewKey: step.cameraView,
      reply: step.commonMistake ?? 'This step is mostly about alignment; check the highlighted parts before tightening.'
    };
  }

  if (includesAny(phrase, ['which one', 'which part', 'which screw', 'screw with the washer'])) {
    const partIds = resolvePartIds(phrase, context);
    return {
      type: 'which_part',
      partQuery: utterance,
      language,
      partIds,
      viewKey: partIds.includes('cam-screw-washer') ? 'screw-detail' : step.cameraView,
      reply: partIds.includes('cam-screw-washer')
        ? 'Use part 117327, the cam screw with the washer. I am spinning it and flashing its chip now.'
        : `I found ${labelParts(partIds, context.manifest)}. I am isolating it for you.`
    };
  }

  if (includesAny(phrase, ['where does', 'where do', 'goes where', 'go where', 'va ou', 'va où'])) {
    const partIds = resolvePartIds(phrase, context);
    return {
      type: 'where_does_it_go',
      partQuery: utterance,
      language,
      partIds,
      viewKey: step.cameraView,
      reply: `It goes in step ${step.index}: ${step.title}. I highlighted the exact part and moved the camera there.`
    };
  }

  if (includesAny(phrase, ['repeat', 'say again'])) {
    return {
      type: 'repeat',
      language,
      viewKey: step.cameraView,
      partIds: step.highlightParts,
      reply: step.action
    };
  }

  if (includesAny(phrase, ['how many left', 'how much left'])) {
    const left = context.manifest.steps.length - context.currentStep;
    return {
      type: 'how_many_left',
      language,
      reply: left === 0 ? 'This is the final step.' : `${left} steps left after this one.`
    };
  }

  if (includesAny(phrase, ['help', 'what can i ask'])) {
    return {
      type: 'help',
      language,
      reply: 'Ask for the next step, a back view, a common mistake, or which part to use.'
    };
  }

  return unknownIntent(utterance);
}

function normalizeIntent(
  value: Partial<ResolvedIntent>,
  utterance: string,
  context: IntentContext
): ResolvedIntent {
  if (!value || !value.type || !value.reply) {
    return unknownIntent(utterance);
  }

  const step = getStep(context);
  return {
    type: value.type,
    language: value.language ?? detectLanguage(utterance),
    reply: String(value.reply).split('. ').slice(0, 2).join('. '),
    partQuery: value.partQuery,
    stepNumber: value.stepNumber,
    viewQuery: value.viewQuery,
    partIds: value.partIds,
    viewKey: value.viewKey ?? step.cameraView
  };
}

function getStep(context: IntentContext): Step {
  return context.manifest.steps[Math.max(0, Math.min(context.currentStep - 1, context.manifest.steps.length - 1))];
}

function resolvePartIds(phrase: string, context: IntentContext): string[] {
  const step = getStep(context);

  if (includesAny(phrase, ['washer', 'cam screw', 'vis'])) {
    return ['cam-screw-washer'];
  }

  if (includesAny(phrase, ['short screw', 'back screw'])) {
    return ['back-screw'];
  }

  if (includesAny(phrase, ['back panel', 'rear panel'])) {
    return ['back-panel'];
  }

  if (includesAny(phrase, ['panel'])) {
    const panel = step.highlightParts.find((partId) => partId.includes('panel'));
    return [panel ?? step.highlightParts[0]];
  }

  return step.highlightParts.slice(0, 1);
}

function resolveMistakePartIds(step: Step): string[] {
  const panelPart = step.highlightParts.find((partId) => partId.includes('panel'));
  return [panelPart ?? step.highlightParts[0]];
}

function parseStepNumber(phrase: string, maxStep: number): number | undefined {
  const digitMatch = phrase.match(/\bstep\s+(\d+)\b/);
  if (digitMatch) {
    return clampStep(Number(digitMatch[1]), maxStep);
  }

  for (const [word, value] of digitWords) {
    if (phrase.includes(`step ${word}`)) {
      return clampStep(value, maxStep);
    }
  }

  return undefined;
}

function clampStep(value: number, maxStep: number): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(1, Math.min(Math.trunc(value), maxStep));
}

function detectLanguage(utterance: string): 'en' | 'fr' {
  const text = utterance.toLocaleLowerCase();
  return /[àâçéèêëîïôûùüÿñæœ]/i.test(text) || includesAny(text, [' cette ', ' elle ', ' ou ', ' où ', ' vis '])
    ? 'fr'
    : 'en';
}

function labelParts(partIds: string[], manifest: AssemblyManifest): string {
  return partIds
    .map((partId) => manifest.parts.find((part) => part.id === partId)?.label ?? partId)
    .join(', ');
}

function unknownIntent(utterance: string): ResolvedIntent {
  return {
    type: 'unknown',
    language: detectLanguage(utterance),
    reply: detectLanguage(utterance) === 'fr'
      ? 'Je peux montrer une etape, une piece, ou une erreur courante. Tu veux voir laquelle ?'
      : 'I can show a step, a part, or a common mistake. Which one should I focus on?'
  };
}

function normalizeText(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[?!.,"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text: string, candidates: string[]): boolean {
  return candidates.some((candidate) => text.includes(candidate));
}
