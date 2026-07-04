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
      expectedLanguage,
      expectedReplyIncludes
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
      for (const expectedText of expectedReplyIncludes ?? []) {
        expect(intent.reply).toContain(expectedText);
      }
    }
  );

  it('keeps clarification-style unknowns free of viewer action fields', async () => {
    const ambiguousFixtures = goldenIntentFixtures.filter((fixture) =>
      fixture.expectedType === 'unknown' && fixture.expectedReplyIncludes?.length
    );

    expect(ambiguousFixtures.length).toBeGreaterThanOrEqual(5);

    for (const fixture of ambiguousFixtures) {
      const intent = await parseIntent(fixture.utterance, {
        manifest,
        currentStep: fixture.currentStep
      });

      expect(intent.type).toBe('unknown');
      expect(intent.partIds).toBeUndefined();
      expect(intent.viewKey).toBeUndefined();
      expect(intent.stepNumber).toBeUndefined();
    }
  });
});

function countSentences(reply: string): number {
  return reply.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.length ?? 0;
}
