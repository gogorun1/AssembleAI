import { describe, expect, it } from 'vitest';
import manifest from '../data/manifest';
import { goldenIntentFixtures } from './intent.fixtures';
import { parseIntent } from './intent';

describe('parseIntent golden utterances', () => {
  it.each(goldenIntentFixtures)(
    'resolves "$utterance"',
    async ({
      utterance,
      currentStep,
      expectedType,
      expectedPartIds,
      expectedViewKey,
      expectedStepNumber,
      expectedLanguage
    }) => {
      const intent = await parseIntent(utterance, {
        manifest,
        currentStep
      });

      expect(intent.type).toBe(expectedType);
      expect(intent.language).toBe(expectedLanguage);
      expect(intent.partIds).toEqual(expectedPartIds);
      expect(intent.viewKey).toBe(expectedViewKey);
      expect(intent.stepNumber).toBe(expectedStepNumber);
      expect(countSentences(intent.reply)).toBeLessThanOrEqual(2);
    }
  );
});

function countSentences(reply: string): number {
  return reply.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.length ?? 0;
}
