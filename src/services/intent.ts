import type { AssemblyManifest, Part, ResolvedIntent, Step } from '../types/assembly';
import { validateResolvedIntent } from './intent.schema';

export interface IntentContext {
  manifest: AssemblyManifest;
  currentStep: number;
}

const digitWords = new Map<string, number>([
  ['one', 1],
  ['first', 1],
  ['un', 1],
  ['une', 1],
  ['premier', 1],
  ['premiere', 1],
  ['two', 2],
  ['second', 2],
  ['deux', 2],
  ['deuxieme', 2],
  ['three', 3],
  ['third', 3],
  ['trois', 3],
  ['troisieme', 3],
  ['four', 4],
  ['fourth', 4],
  ['quatre', 4],
  ['quatrieme', 4],
  ['five', 5],
  ['fifth', 5],
  ['cinq', 5],
  ['cinquieme', 5],
  ['six', 6],
  ['sixth', 6],
  ['seven', 7],
  ['seventh', 7],
  ['sept', 7],
  ['septieme', 7],
  ['eight', 8],
  ['eighth', 8],
  ['huit', 8],
  ['huitieme', 8],
  ['nine', 9],
  ['ninth', 9],
  ['neuf', 9],
  ['neuvieme', 9]
]);

const partAliases: Record<string, string[]> = {
  'cam-screw-washer': ['washer screw', 'screw with washer', 'cam screw', 'cam bolt', '117327', 'vis', 'vis avec rondelle'],
  'cam-lock': ['cam lock', 'locking cam', 'round cam', '119030'],
  'wood-dowel': ['wood dowel', 'dowel', 'wood peg', 'peg', 'tourillon', '100674'],
  'shelf-pin': ['shelf pin', 'shelf peg', 'support pin', 'pin for the shelf', '101339'],
  'back-screw': ['back screw', 'short screw', 'rear screw', 'm3 5x16', 'm3.5x16'],
  'safety-strap': ['safety strap', 'wall safety strap', 'wall strap', 'anchor strap', 'wall anchor', '110789'],
  'back-panel': ['back panel', 'rear panel', '101538'],
  'bottom-panel': ['bottom panel', 'base panel', 'bottom board', 'base board', '101534'],
  'top-panel': ['top panel', 'top board', '101535'],
  'side-panel-left': ['left side panel', 'left panel', '101532'],
  'side-panel-right': ['right side panel', 'right panel', '101533'],
  'fixed-shelf': ['fixed shelf', 'center shelf', 'middle shelf', '101536'],
  'adjustable-shelf': ['adjustable shelf', 'loose shelf', 'moveable shelf', '101537']
};

const cameraAliases: Record<string, string[]> = {
  'back-panel': ['from the back', 'back view', 'rear view', 'behind', 'from behind', 'back side', 'derriere', 'arriere'],
  front: ['front view', 'from the front'],
  'base-detail': ['base detail', 'bottom detail', 'base camera'],
  'screw-detail': ['screw detail', 'washer screw detail', 'cam screw detail'],
  'cam-lock-detail': ['cam lock detail', 'cam close up', 'cam closeup'],
  'shelf-detail': ['shelf detail', 'shelf alignment'],
  'top-detail': ['top detail', 'from above', 'top view', 'overhead'],
  'square-check': ['square check', 'diagonal check'],
  'shelf-pin-detail': ['shelf pin detail', 'pin detail'],
  'wall-anchor': ['wall anchor', 'anchor view', 'strap view'],
  exploded: ['exploded view', 'overview', 'apart']
};

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
        steps: context.manifest.steps,
        cameraViews: context.manifest.cameraViews
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

export function parsePresetIntent(utterance: string, context: IntentContext): ResolvedIntent {
  const phrase = normalizeText(utterance);
  const language = detectLanguage(utterance);
  const step = getStep(context);

  if (isNextStepRequest(phrase)) {
    const nextIndex = Math.min(context.currentStep + 1, context.manifest.steps.length);
    return {
      type: 'next_step',
      stepNumber: nextIndex,
      language,
      reply: `Next is step ${nextIndex}: ${context.manifest.steps[nextIndex - 1].title}.`
    };
  }

  if (isPreviousStepRequest(phrase)) {
    const previousIndex = Math.max(context.currentStep - 1, 1);
    return {
      type: 'prev_step',
      stepNumber: previousIndex,
      language,
      reply: `Back to step ${previousIndex}: ${context.manifest.steps[previousIndex - 1].title}.`
    };
  }

  const requestedStep = parseStepNumber(phrase, context.manifest.steps.length);
  if (requestedStep && isGotoStepRequest(phrase)) {
    return {
      type: 'goto_step',
      stepNumber: requestedStep,
      language,
      reply: `Jumping to step ${requestedStep}: ${context.manifest.steps[requestedStep - 1].title}.`
    };
  }

  const cameraView = resolveCameraView(phrase, context);
  if (cameraView && isCameraRequest(phrase)) {
    return {
      type: 'show_angle',
      viewQuery: utterance,
      viewKey: cameraView,
      language,
      reply: `Showing ${context.manifest.cameraViews[cameraView].label}.`
    };
  }

  if (isCloseUpRequest(phrase)) {
    const focusedView = resolveCameraView(phrase, context) ?? resolveViewForParts(resolvePartIds(phrase, context).partIds, step);
    return {
      type: 'show_angle',
      viewQuery: 'closer',
      viewKey: focusedView,
      language,
      reply: `Zooming into ${context.manifest.cameraViews[focusedView].label}.`
    };
  }

  if (isCommonMistakeRequest(phrase)) {
    const partIds = resolveMistakePartIds(step);
    return {
      type: 'common_mistake',
      language,
      partIds,
      viewKey: step.cameraView,
      reply: step.commonMistake ?? 'This step is mostly about alignment; check the highlighted parts before tightening.'
    };
  }

  if (isPlacementRequest(phrase)) {
    const resolved = resolvePartIds(phrase, context);
    if (resolved.ambiguous) {
      return unknownIntent(
        utterance,
        `I see a few possible parts: ${labelParts(resolved.candidates, context.manifest)}. Which one do you mean?`
      );
    }

    const partIds = resolved.partIds;
    return {
      type: 'where_does_it_go',
      partQuery: utterance,
      language,
      partIds,
      viewKey: resolveViewForParts(partIds, step),
      reply: language === 'fr'
        ? `Cette piece va a l'etape ${step.index}: ${step.title}. Je surligne l'emplacement.`
        : `It goes in step ${step.index}: ${step.title}. I highlighted the exact part and moved the camera there.`
    };
  }

  const partResolution = resolvePartIds(phrase, context);
  if (isWhichPartRequest(phrase) || (partResolution.partIds.length > 0 && isPartDisplayRequest(phrase))) {
    if (partResolution.ambiguous) {
      return unknownIntent(
        utterance,
        `I see a few possible parts: ${labelParts(partResolution.candidates, context.manifest)}. Which one do you mean?`
      );
    }

    const partIds = partResolution.partIds;
    return {
      type: 'which_part',
      partQuery: utterance,
      language,
      partIds,
      viewKey: resolveViewForParts(partIds, step),
      reply: partIds.includes('cam-screw-washer')
        ? 'Use part 117327, the cam screw with the washer. I am spinning it and flashing its chip now.'
        : `I found ${labelParts(partIds, context.manifest)}. I am isolating it for you.`
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
  const step = getStep(context);
  const candidate = {
    type: value.type,
    language: value.language ?? detectLanguage(utterance),
    reply: trimToTwoSentences(String(value.reply ?? '')),
    partQuery: value.partQuery,
    stepNumber: value.stepNumber,
    viewQuery: value.viewQuery,
    partIds: value.partIds,
    viewKey: value.viewKey ?? step.cameraView
  };

  const validation = validateResolvedIntent(candidate, context.manifest);
  return validation.ok && validation.intent ? validation.intent : unknownIntent(utterance);
}

function getStep(context: IntentContext): Step {
  return context.manifest.steps[Math.max(0, Math.min(context.currentStep - 1, context.manifest.steps.length - 1))];
}

interface PartResolution {
  partIds: string[];
  ambiguous: boolean;
  candidates: string[];
}

export function resolvePartIds(phrase: string, context: IntentContext): PartResolution {
  const step = getStep(context);
  const matches = context.manifest.parts
    .map((part) => ({ part, score: scorePartMatch(phrase, part) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matches.length > 0) {
    const topScore = matches[0].score;
    const topMatches = matches.filter((match) => match.score === topScore);
    return {
      partIds: topMatches.map((match) => match.part.id),
      ambiguous: topMatches.length > 1,
      candidates: topMatches.map((match) => match.part.id)
    };
  }

  if (hasWholeWord(phrase, 'panel') || includesAny(phrase, ['board', 'panneau'])) {
    const highlightedPanels = step.highlightParts.filter((partId) => partId.includes('panel'));
    const panelsInStep = highlightedPanels.length > 0
      ? highlightedPanels
      : unique(step.partsNeeded.map((part) => part.partId)).filter((partId) => partId.includes('panel'));

    return {
      partIds: panelsInStep.length === 1 ? panelsInStep : [],
      ambiguous: panelsInStep.length !== 1,
      candidates: panelsInStep.length > 0
        ? panelsInStep
        : context.manifest.parts.filter((part) => part.id.includes('panel')).map((part) => part.id)
    };
  }

  if (hasWholeWord(phrase, 'screw') || hasWholeWord(phrase, 'vis')) {
    const highlightedScrews = step.highlightParts.filter((partId) => partId.includes('screw'));
    const screwsInStep = highlightedScrews.length > 0
      ? highlightedScrews
      : unique(step.partsNeeded.map((part) => part.partId)).filter((partId) => partId.includes('screw'));

    return {
      partIds: screwsInStep.length === 1 ? screwsInStep : [],
      ambiguous: screwsInStep.length !== 1,
      candidates: screwsInStep.length > 0 ? screwsInStep : ['cam-screw-washer', 'back-screw']
    };
  }

  return { partIds: [], ambiguous: false, candidates: [] };
}

function resolveMistakePartIds(step: Step): string[] {
  const panelPart = step.highlightParts.find((partId) => partId.includes('panel'));
  return [panelPart ?? step.highlightParts[0]];
}

export function parseStepNumber(phrase: string, maxStep: number): number | undefined {
  const folded = foldText(phrase);
  const digitMatch = folded.match(/\b(?:step|etape|stage)\s+(?:number\s+)?(\d+)\b/);
  if (digitMatch?.[1]) {
    return clampStep(Number(digitMatch[1]), maxStep);
  }

  const looseDigitMatch = folded.match(/\b(?:go to|jump to|open|show me|take me to)\s+(?:the\s+)?(?:step\s+)?(\d+)(?:\s+step)?\b/);
  if (looseDigitMatch?.[1]) {
    return clampStep(Number(looseDigitMatch[1]), maxStep);
  }

  for (const [word, value] of digitWords) {
    const escaped = escapeRegExp(word);
    if (
      new RegExp(`\\b(?:step|etape|stage)\\s+(?:number\\s+)?${escaped}\\b`).test(folded) ||
      new RegExp(`\\b(?:go to|jump to|open|show me|take me to)\\s+(?:the\\s+)?(?:step\\s+)?${escaped}(?:\\s+step)?\\b`).test(folded)
    ) {
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
  const text = ` ${utterance.toLocaleLowerCase()} `;
  const folded = foldText(text);
  return /[àâçéèêëîïôûùüÿæœ]/i.test(text) ||
    /\b(cette|ce|cet|elle|ou|où|vis|va|piece|pièce|etape|étape|erreur|montre)\b/.test(folded)
    ? 'fr'
    : 'en';
}

function labelParts(partIds: string[], manifest: AssemblyManifest): string {
  return partIds
    .map((partId) => manifest.parts.find((part) => part.id === partId)?.label ?? partId)
    .join(', ');
}

function unknownIntent(utterance: string, reply?: string): ResolvedIntent {
  const language = detectLanguage(utterance);
  return {
    type: 'unknown',
    language,
    reply: reply ?? (language === 'fr'
      ? 'Je peux montrer une etape, une piece, ou une erreur courante. Tu veux voir laquelle ?'
      : 'I can show a step, a part, or a common mistake. Which one should I focus on?')
  };
}

function normalizeText(text: string): string {
  return foldText(text)
    .replace(/[?!.,"'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text: string, candidates: string[]): boolean {
  return candidates.some((candidate) => text.includes(normalizeText(candidate)));
}

function resolveCameraView(phrase: string, context: IntentContext): string | undefined {
  for (const [viewKey, aliases] of Object.entries(cameraAliases)) {
    if (hasOwn(context.manifest.cameraViews, viewKey) && includesAny(phrase, aliases)) {
      return viewKey;
    }
  }

  return undefined;
}

function resolveViewForParts(partIds: string[], step: Step): string {
  if (partIds.includes('cam-screw-washer')) {
    return 'screw-detail';
  }

  if (partIds.includes('cam-lock')) {
    return 'cam-lock-detail';
  }

  if (partIds.includes('shelf-pin')) {
    return 'shelf-pin-detail';
  }

  if (partIds.includes('safety-strap')) {
    return 'wall-anchor';
  }

  if (partIds.includes('back-panel') || partIds.includes('back-screw')) {
    return 'back-panel';
  }

  return step.cameraView;
}

function scorePartMatch(phrase: string, part: Part): number {
  let score = 0;
  const foldedCode = normalizeText(part.code);
  const foldedId = normalizeText(part.id);
  const foldedLabel = normalizeText(part.label);

  if (includesPhrase(phrase, foldedCode)) {
    score += 10;
  }

  if (includesPhrase(phrase, foldedId)) {
    score += 8;
  }

  if (includesPhrase(phrase, foldedLabel)) {
    score += 8;
  }

  for (const alias of partAliases[part.id] ?? []) {
    if (includesPhrase(phrase, normalizeText(alias))) {
      score += alias.length > 5 ? 7 : 4;
    }
  }

  return score;
}

function isNextStepRequest(phrase: string): boolean {
  return includesAny(phrase, [
    'what next',
    'what s next',
    'whats next',
    'next step',
    'continue',
    'move on',
    'advance',
    'after this'
  ]);
}

function isPreviousStepRequest(phrase: string): boolean {
  return includesAny(phrase, ['previous', 'back one', 'go back', 'last step', 'previous step']);
}

function isGotoStepRequest(phrase: string): boolean {
  return includesAny(phrase, ['step', 'etape', 'go to', 'jump to', 'take me to', 'open step', 'show me step']);
}

function isCameraRequest(phrase: string): boolean {
  return includesAny(phrase, ['view', 'angle', 'camera', 'show me from', 'from the', 'from behind', 'behind', 'rear', 'back']);
}

function isCloseUpRequest(phrase: string): boolean {
  return includesAny(phrase, ['closer', 'close up', 'closeup', 'zoom', 'detail']);
}

function isCommonMistakeRequest(phrase: string): boolean {
  return includesAny(phrase, [
    'mess this step',
    'mistake',
    'wrong',
    'people mess',
    'avoid',
    'gotcha',
    'problem',
    'erreur',
    'trompent'
  ]);
}

function isPlacementRequest(phrase: string): boolean {
  return includesAny(phrase, [
    'where does',
    'where do',
    'where should',
    'goes where',
    'go where',
    'where do i put',
    'where do i place',
    'where does this',
    'where does the',
    'where does it attach',
    'where does the',
    'attach',
    'fit',
    'install',
    'va ou',
    'va',
    'mettre'
  ]);
}

function isWhichPartRequest(phrase: string): boolean {
  return includesAny(phrase, [
    'which one',
    'which part',
    'which screw',
    'what is this',
    'is this the',
    'identify',
    'find the',
    'show me the'
  ]);
}

function isPartDisplayRequest(phrase: string): boolean {
  return includesAny(phrase, ['show me', 'find', 'highlight', 'which', 'identify', 'is this']);
}

function includesPhrase(text: string, phrase: string): boolean {
  if (!phrase) {
    return false;
  }

  return text.includes(phrase);
}

function hasWholeWord(text: string, word: string): boolean {
  return new RegExp(`\\b${escapeRegExp(word)}\\b`).test(text);
}

function trimToTwoSentences(reply: string): string {
  return reply
    .trim()
    .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)
    ?.slice(0, 2)
    .join(' ')
    .trim() ?? '';
}

function foldText(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
