import type { AssemblyManifest, Part, Step } from '../data/types';
import type { Language } from '../store/useAppStore';

export type IntentType =
  | 'next_step'
  | 'prev_step'
  | 'goto_step'
  | 'which_part'
  | 'where_does_it_go'
  | 'show_angle'
  | 'repeat'
  | 'how_many_left'
  | 'common_mistake'
  | 'help'
  | 'unknown';

export interface Intent {
  type: IntentType;
  partQuery?: string;
  stepNumber?: number;
  viewQuery?: string;
  language: Language;
  reply: string;
  /** Resolved by the parser for the handler: the concrete part + camera view. */
  resolvedPartId?: string;
  resolvedViewKey?: string;
}

export interface IntentContext {
  manifest: AssemblyManifest;
  currentStepIndex: number;
}

// ── language detection ──────────────────────────────────────
const FRENCH_MARKERS =
  /\b(où|va|vis|cette|elle|étape|montre|montrez|précédent|suivant|prochaine|combien|répète|répétez|erreur|aide|derrière|arrière|dessus|côté|rondelle|à quoi|comment)\b/i;

function detectLanguage(text: string): Language {
  return FRENCH_MARKERS.test(text) ? 'fr' : 'en';
}

// ── part resolution (fuzzy token overlap over labels + codes) ──
const STOP = new Set([
  'the', 'a', 'an', 'this', 'that', 'with', 'and', 'of', 'is', 'it', 'one',
  'which', 'where', 'does', 'do', 'go', 'goes', 'part', 'piece', 'show', 'me',
  'la', 'le', 'les', 'un', 'une', 'et', 'ça', 'va', 'où', 'cette', 'ce',
  'quelle', 'est', 'à', 'quoi', 'sert',
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}×\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));
}

// query-token synonyms so "screw"/"washer"/"vis"/"rondelle" hit cam-screw etc.
const SYNONYMS: Record<string, string[]> = {
  vis: ['screw'],
  rondelle: ['washer'],
  panneau: ['panel'],
  étagère: ['shelf'],
  tablette: ['shelf'],
  cheville: ['dowel'],
  clou: ['nail'],
  fond: ['back'],
  base: ['bottom'],
};

function expand(tokens: string[]): string[] {
  const out = [...tokens];
  for (const t of tokens) if (SYNONYMS[t]) out.push(...SYNONYMS[t]);
  return out;
}

function resolvePart(query: string, parts: Part[]): Part | undefined {
  const q = expand(tokenize(query));
  if (q.length === 0) return undefined;
  let best: { part: Part; score: number } | undefined;
  for (const part of parts) {
    const hay = tokenize(`${part.label} ${part.code} ${part.id.replace(/-/g, ' ')}`);
    let score = 0;
    for (const token of q) {
      if (hay.includes(token)) score += 2;
      else if (hay.some((h) => h.includes(token) || token.includes(h))) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { part, score };
  }
  return best?.part;
}

// ── reply helpers ───────────────────────────────────────────
function stepView(step: Step): string {
  return step.cameraView;
}

const t = {
  step: (lang: Language, s: Step) =>
    lang === 'fr'
      ? `Étape ${s.index} : ${s.title}. ${s.action}`
      : `Step ${s.index}: ${s.title}. ${s.action}`,
  whichPart: (lang: Language, p: Part) =>
    lang === 'fr'
      ? `C'est ${p.label.toLowerCase()}, référence ${p.code}.`
      : `That's the ${p.label.toLowerCase()}, code ${p.code}.`,
  whereGoes: (lang: Language, p: Part, s: Step) =>
    lang === 'fr'
      ? `${p.label} se pose à l'étape ${s.index}. ${s.action}`
      : `The ${p.label.toLowerCase()} goes on at step ${s.index}. ${s.action}`,
  angle: (lang: Language, label: string) =>
    lang === 'fr' ? `Voici la vue ${label.toLowerCase()}.` : `Here's the ${label.toLowerCase()} view.`,
  mistake: (lang: Language, s: Step) =>
    s.commonMistake ??
    (lang === 'fr'
      ? "Pas de piège connu pour cette étape."
      : 'No common mistake logged for this step.'),
  howMany: (lang: Language, left: number) =>
    lang === 'fr'
      ? `Il reste ${left} étape${left === 1 ? '' : 's'}.`
      : `${left} step${left === 1 ? '' : 's'} left.`,
  help: (lang: Language) =>
    lang === 'fr'
      ? 'Demandez « suivant », « c\'est quoi cette pièce ? » ou « montre depuis l\'arrière ».'
      : 'Try "what\'s next", "which part is this?", or "show me from the back".',
  clarify: (lang: Language) =>
    lang === 'fr'
      ? "Je n'ai pas compris — quelle pièce ou quelle étape ?"
      : "I didn't catch that — which part or step do you mean?",
  ambiguous: (lang: Language) =>
    lang === 'fr'
      ? 'De quelle pièce parlez-vous exactement ?'
      : 'Which part exactly do you mean?',
};

// ── view resolution for show_angle ──────────────────────────
function resolveView(text: string, manifest: AssemblyManifest): string | undefined {
  const lc = text.toLowerCase();
  if (/(back|behind|arrière|derrière|fond)/.test(lc)) return 'back-panel';
  if (/(top|above|dessus)/.test(lc)) return 'top';
  if (/(front|face|avant|devant)/.test(lc)) return 'front';
  if (/(cam|lock|joint|excentrique)/.test(lc)) return 'cam-lock-detail';
  if (/(shelf|étagère|tablette)/.test(lc)) return 'shelf-detail';
  if (/(exploded|all parts|éclaté|toutes les pièces)/.test(lc)) return 'exploded';
  if (/(overview|whole|ensemble|3\/4)/.test(lc)) return 'overview';
  return manifest.cameraViews.overview ? 'overview' : undefined;
}

/** Rule-based parser — the zero-dependency fallback used when no LLM key. */
export function parseIntentLocal(utterance: string, ctx: IntentContext): Intent {
  const lang = detectLanguage(utterance);
  const lc = utterance.toLowerCase().trim();
  const { manifest, currentStepIndex } = ctx;
  const steps = manifest.steps;
  const current = steps.find((s) => s.index === currentStepIndex) ?? steps[0];
  const base = (partial: Partial<Intent> & { type: IntentType; reply: string }): Intent => ({
    language: lang,
    ...partial,
  });

  // goto step N
  const stepMatch = lc.match(/(?:step|étape)\s*(\d{1,2})/) ?? lc.match(/\b(\d{1,2})\b/);
  if (stepMatch && /(step|étape|go to|aller|va à)/.test(lc)) {
    const n = Math.max(1, Math.min(steps.length, parseInt(stepMatch[1], 10)));
    const target = steps[n - 1];
    return base({ type: 'goto_step', stepNumber: n, reply: t.step(lang, target) });
  }

  // common mistake
  if (/(mistake|mess|messed|wrong|screw.*up|common|people|erreur|gaffe|piège|se tromp)/.test(lc)) {
    return base({ type: 'common_mistake', reply: t.mistake(lang, current), resolvedViewKey: stepView(current) });
  }

  // repeat
  if (/(repeat|again|say that|répète|répétez|encore)/.test(lc)) {
    return base({ type: 'repeat', reply: t.step(lang, current) });
  }

  // how many left
  if (/(how many|left|remaining|combien|reste)/.test(lc)) {
    const left = steps.length - currentStepIndex;
    return base({ type: 'how_many_left', reply: t.howMany(lang, left) });
  }

  // next / prev
  if (/(next|what'?s next|continue|forward|suivant|prochaine|après|ensuite)/.test(lc)) {
    const n = Math.min(steps.length, currentStepIndex + 1);
    return base({ type: 'next_step', stepNumber: n, reply: t.step(lang, steps[n - 1]) });
  }
  if (/(prev|previous|back up|go back|last step|précédent|reviens|retour)/.test(lc) && !/(back panel|arrière|fond|derrière)/.test(lc)) {
    const n = Math.max(1, currentStepIndex - 1);
    return base({ type: 'prev_step', stepNumber: n, reply: t.step(lang, steps[n - 1]) });
  }

  // show angle / view
  if (/(show me from|from the|rotate|turn|spin the view|closer|angle|view|montre|montrez|vue|tourne|regarde)/.test(lc)) {
    const viewKey = resolveView(lc, manifest);
    if (viewKey) {
      const view = manifest.cameraViews[viewKey];
      return base({ type: 'show_angle', viewQuery: lc, resolvedViewKey: viewKey, reply: t.angle(lang, view.label) });
    }
  }

  // where does it go
  if (/(where does|where do|where.*go|va où|où va|où ça|se met|se pose|se monte)/.test(lc)) {
    let part = resolvePart(lc, manifest.parts);
    if (!part && /(this|cette|ce|ça|it)/.test(lc)) part = manifest.parts.find((p) => current.highlightParts.includes(p.id));
    if (!part) return base({ type: 'where_does_it_go', reply: t.ambiguous(lang) });
    // find the step that installs this part
    const installStep =
      steps.find((s) => s.highlightParts.includes(part!.id)) ??
      steps.find((s) => s.partsNeeded.some((pn) => pn.partId === part!.id)) ??
      current;
    return base({
      type: 'where_does_it_go',
      partQuery: lc,
      resolvedPartId: part.id,
      resolvedViewKey: stepView(installStep),
      reply: t.whereGoes(lang, part, installStep),
    });
  }

  // which part
  if (/(which|what is|what'?s|where is|c'?est quoi|quelle est|qu'?est|à quoi sert|identify)/.test(lc)) {
    const part = resolvePart(lc, manifest.parts);
    if (!part) return base({ type: 'which_part', reply: t.ambiguous(lang) });
    return base({
      type: 'which_part',
      partQuery: lc,
      resolvedPartId: part.id,
      resolvedViewKey: 'hardware-detail',
      reply: t.whichPart(lang, part),
    });
  }

  // help
  if (/(help|what can|aide|comment)/.test(lc)) {
    return base({ type: 'help', reply: t.help(lang) });
  }

  return base({ type: 'unknown', reply: t.clarify(lang) });
}

const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
const INTENT_TIMEOUT_MS = 8000;

/**
 * Parse an utterance into a structured Intent. Uses an LLM (structured output)
 * when VITE_OPENAI_API_KEY is present; otherwise the deterministic local parser.
 * Any LLM error or timeout gracefully falls back to the local parser.
 */
export async function parseIntent(utterance: string, ctx: IntentContext): Promise<Intent> {
  if (!OPENAI_KEY) return parseIntentLocal(utterance, ctx);
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), INTENT_TIMEOUT_MS);
    const intent = await callLLM(utterance, ctx, controller.signal);
    window.clearTimeout(timer);
    // resolve part/view from the LLM's free-text query using local logic
    return hydrate(intent, ctx);
  } catch {
    return parseIntentLocal(utterance, ctx);
  }
}

function hydrate(intent: Intent, ctx: IntentContext): Intent {
  const { manifest } = ctx;
  if (intent.partQuery && !intent.resolvedPartId) {
    intent.resolvedPartId = resolvePart(intent.partQuery, manifest.parts)?.id;
  }
  if (intent.viewQuery && !intent.resolvedViewKey) {
    intent.resolvedViewKey = resolveView(intent.viewQuery, manifest);
  }
  return intent;
}

async function callLLM(utterance: string, ctx: IntentContext, signal: AbortSignal): Promise<Intent> {
  const partsList = ctx.manifest.parts
    .map((p) => `${p.id} | ${p.code} | ${p.label}`)
    .join('\n');
  const system = `You are the intent parser for a furniture-assembly voice assistant.
Return STRICT JSON matching this TypeScript type and nothing else:
{ "type": IntentType, "partQuery"?: string, "stepNumber"?: number, "viewQuery"?: string, "language": "en"|"fr", "reply": string }
IntentType is one of: next_step, prev_step, goto_step, which_part, where_does_it_go, show_angle, repeat, how_many_left, common_mistake, help, unknown.
Reply in the language of the question, max 2 sentences.
Current step index: ${ctx.currentStepIndex}.
Parts (id | code | label):\n${partsList}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: (import.meta.env.VITE_INTENT_MODEL as string) ?? 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: utterance },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('empty LLM response');
  return JSON.parse(content) as Intent;
}
