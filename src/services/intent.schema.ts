import type { AssemblyManifest, IntentType, ResolvedIntent } from '../types/assembly';

export const intentTypes = [
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
] as const satisfies readonly IntentType[];

export const resolvedIntentJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'language', 'reply'],
  properties: {
    type: { enum: intentTypes },
    partQuery: { type: 'string' },
    stepNumber: { type: 'integer', minimum: 1 },
    viewQuery: { type: 'string' },
    language: { enum: ['en', 'fr'] },
    reply: { type: 'string', minLength: 1 },
    partIds: { type: 'array', items: { type: 'string' } },
    viewKey: { type: 'string' }
  }
} as const;

export interface IntentValidationResult {
  ok: boolean;
  intent?: ResolvedIntent;
  errors: string[];
}

const allowedKeys = new Set([
  'type',
  'partQuery',
  'stepNumber',
  'viewQuery',
  'language',
  'reply',
  'partIds',
  'viewKey'
]);

export function validateResolvedIntent(
  value: unknown,
  manifest: AssemblyManifest
): IntentValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ['intent must be an object'] };
  }

  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`unexpected field: ${key}`);
    }
  }

  if (!intentTypes.includes(value.type as IntentType)) {
    errors.push('type must be a known IntentType');
  }

  if (value.language !== 'en' && value.language !== 'fr') {
    errors.push("language must be 'en' or 'fr'");
  }

  if (typeof value.reply !== 'string' || value.reply.trim().length === 0) {
    errors.push('reply is required');
  } else if (countSentences(value.reply) > 2) {
    errors.push('reply must be at most 2 sentences');
  }

  validateOptionalString(value, 'partQuery', errors);
  validateOptionalString(value, 'viewQuery', errors);

  if (value.stepNumber !== undefined) {
    const stepNumber = value.stepNumber;
    if (typeof stepNumber !== 'number' || !Number.isInteger(stepNumber)) {
      errors.push('stepNumber must be an integer');
    } else if (stepNumber < 1 || stepNumber > manifest.steps.length) {
      errors.push('stepNumber must be in manifest step range');
    }
  }

  if (value.partIds !== undefined) {
    if (!Array.isArray(value.partIds)) {
      errors.push('partIds must be an array');
    } else {
      const manifestPartIds = new Set(manifest.parts.map((part) => part.id));
      for (const partId of value.partIds) {
        if (typeof partId !== 'string') {
          errors.push('partIds must contain only strings');
        } else if (!manifestPartIds.has(partId)) {
          errors.push(`unknown partId: ${partId}`);
        }
      }
    }
  }

  if (value.viewKey !== undefined) {
    if (typeof value.viewKey !== 'string') {
      errors.push('viewKey must be a string');
    } else if (!hasOwn(manifest.cameraViews, value.viewKey)) {
      errors.push(`unknown viewKey: ${value.viewKey}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, intent: value as unknown as ResolvedIntent, errors: [] };
}

function validateOptionalString(
  value: Record<string, unknown>,
  key: string,
  errors: string[]
): void {
  if (value[key] !== undefined && typeof value[key] !== 'string') {
    errors.push(`${key} must be a string`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function countSentences(reply: string): number {
  const trimmed = reply.trim();
  if (trimmed.length === 0) {
    return 0;
  }

  const matches = trimmed.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g);
  return matches?.filter((sentence) => sentence.trim().length > 0).length ?? 1;
}
