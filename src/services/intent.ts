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
  ['nine', 9],
  ['ten', 10],
  ['eleven', 11],
  ['twelve', 12],
  ['thirteen', 13],
  ['fourteen', 14]
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
      partIds: ['cam-screw'],
      viewKey: 'side-screw-detail',
      reply: 'Cette vis 118331 se visse dans les panneaux lateraux avant les serrures a came. Je te montre le bon trou.'
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

  if (includesAny(phrase, ['which one', 'which part', 'which screw', 'which cam', 'cam lock screw', 'screw with the washer'])) {
    const partIds = resolvePartIds(phrase, context);
    return {
      type: 'which_part',
      partQuery: utterance,
      language,
      partIds,
      viewKey: partIds.includes('cam-screw') ? 'side-screw-detail' : step.cameraView,
      reply: partIds.includes('cam-screw')
        ? 'Use 118331, the cam screw. I am spinning it and flashing its chip now.'
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

  const viewIntent = resolveViewIntent(phrase, context, language);
  if (viewIntent) {
    return viewIntent;
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

  if (includesAny(phrase, ['cam screw', 'cam lock screw', 'screw with the washer', '118331', 'vis'])) {
    return ['cam-screw'];
  }

  if (includesAny(phrase, ['washer'])) {
    return ['washer'];
  }

  if (includesAny(phrase, ['back nail', 'panel nail', 'nail', '101201'])) {
    return ['back-nail'];
  }

  if (includesAny(phrase, ['bracket screw', '109041'])) {
    return ['bracket-screw'];
  }

  if (includesAny(phrase, ['screw'])) {
    const screw = step.highlightParts.find((partId) => partId.includes('screw'));
    return [screw ?? 'cam-screw'];
  }

  if (includesAny(phrase, ['wall bracket', 'bracket'])) {
    return ['wall-bracket'];
  }

  if (includesAny(phrase, ['back panel', 'rear panel'])) {
    return ['back-panel'];
  }

  if (includesAny(phrase, ['side panel', 'left panel', 'right panel'])) {
    const sidePanel = step.highlightParts.find((partId) => partId.includes('side-panel'));
    return [sidePanel ?? step.highlightParts[0]];
  }

  if (includesAny(phrase, ['panel'])) {
    const panel = step.highlightParts.find(
      (partId) => partId.includes('panel') && !partId.includes('side-panel')
    );
    return [panel ?? step.highlightParts[0]];
  }

  return step.highlightParts.slice(0, 1);
}

interface ViewRule {
  /** Preferred camera view; falls back through the list until one exists. */
  viewKeys: string[];
  /** Regex patterns (already normalized/lowercased) that trigger this view. */
  patterns: RegExp[];
  viewQuery: string;
  reply: string;
}

/**
 * Ordered camera-view rules. Placed after the part/placement branches so that
 * questions like "where does the back panel go" still win, while pure camera
 * commands ("show me the front", "top view", "3d", "zoom out") move the camera.
 */
const viewRules: ViewRule[] = [
  {
    viewKeys: ['back-panel', 'back-mark', 'back'],
    patterns: [/\bback view\b/, /\bfrom the back\b/, /\bfrom behind\b/, /\bbehind\b/, /\brear\b/, /\bturn (it |the model )?around\b/, /\bspin (it |the model )?around\b/],
    viewQuery: 'back',
    reply: 'Here is the back view, with the rear groove and panel edge visible.'
  },
  {
    viewKeys: ['side', 'first-side-assembly'],
    patterns: [/\bside view\b/, /\bfrom the side\b/, /\bthe side\b/, /\bleft side\b/, /\bright side\b/, /\bfrom the left\b/, /\bfrom the right\b/, /\bprofile\b/],
    viewQuery: 'side',
    reply: 'Swinging around to the side profile of the bookcase.'
  },
  {
    viewKeys: ['top'],
    patterns: [/\btop view\b/, /\bfrom the top\b/, /\bfrom above\b/, /\bfrom overhead\b/, /\boverhead\b/, /\btop down\b/, /\bbirds eye\b/, /\blooking down\b/, /\btop of\b/],
    viewQuery: 'top',
    reply: 'Looking straight down from the top view now.'
  },
  {
    viewKeys: ['iso', 'exploded'],
    patterns: [/\b3 ?d\b/, /\bthree d\b/, /\bisometric\b/, /\biso view\b/, /\bperspective\b/, /\bangled view\b/, /\bcorner view\b/, /\bdiagonal\b/],
    viewQuery: 'iso',
    reply: 'Here is the 3D isometric angle so you can see depth.'
  },
  {
    viewKeys: ['exploded'],
    patterns: [/\bexploded?\b/, /\bblow (it |the model )?apart\b/, /\bapart view\b/, /\bbreak(down| it down| it apart)\b/],
    viewQuery: 'exploded',
    reply: 'Exploding the assembly so each part separates.'
  },
  {
    viewKeys: ['complete'],
    patterns: [/\bzoom(ed)? out\b/, /\boverview\b/, /\bwide view\b/, /\bwhole thing\b/, /\bwhole bookcase\b/, /\bsee (the )?(whole|everything|full)\b/, /\bfull view\b/, /\bstep back\b/, /\bpull back\b/, /\bzoom away\b/],
    viewQuery: 'overview',
    reply: 'Pulling back to the full bookcase overview.'
  },
  {
    viewKeys: ['front'],
    patterns: [/\bfront view\b/, /\bfrom the front\b/, /\bthe front\b/, /\bfront side\b/, /\bhead on\b/, /\bface on\b/, /\bstraight on\b/, /\brecenter\b/, /\bre center\b/, /\breset (the )?view\b/, /\bcenter (it|the model|the view)\b/, /\bdefault view\b/],
    viewQuery: 'front',
    reply: 'Back to the straight-on front view.'
  }
];

/**
 * Resolve a spoken camera command to a manifest camera view. Returns undefined
 * when the phrase is not a view request so the caller can keep matching.
 */
function resolveViewIntent(
  phrase: string,
  context: IntentContext,
  language: 'en' | 'fr'
): ResolvedIntent | undefined {
  const step = getStep(context);

  // "closer / zoom in" keeps the current step framing but signals a tighter shot.
  if (includesAny(phrase, ['closer', 'close up', 'close-up', 'zoom in', 'move in', 'nearer']) && !/\bzoom(ed)? out\b/.test(phrase)) {
    return {
      type: 'show_angle',
      viewQuery: 'closer',
      viewKey: step.cameraView,
      language,
      reply: `Zooming into ${context.manifest.cameraViews[step.cameraView].label}.`
    };
  }

  for (const rule of viewRules) {
    if (!rule.patterns.some((pattern) => pattern.test(phrase))) {
      continue;
    }

    const viewKey = rule.viewKeys.find((key) => key in context.manifest.cameraViews);
    if (!viewKey) {
      continue;
    }

    return {
      type: 'show_angle',
      viewQuery: rule.viewQuery,
      viewKey,
      language,
      reply: rule.reply
    };
  }

  return undefined;
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
    if (new RegExp(`\\bstep\\s+${word}\\b`).test(phrase)) {
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
