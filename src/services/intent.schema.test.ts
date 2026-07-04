import { describe, expect, it } from 'vitest';
import manifest from '../data/manifest';
import type { ResolvedIntent } from '../types/assembly';
import { goldenIntentFixtures } from './intent.fixtures';
import { parsePresetIntent } from './intent';
import { validateResolvedIntent } from './intent.schema';

const validIntent: ResolvedIntent = {
  type: 'which_part',
  language: 'en',
  reply: 'Use part 117327, the cam screw with the washer.',
  partIds: ['cam-screw-washer'],
  viewKey: 'screw-detail'
};

describe('validateResolvedIntent', () => {
  it('accepts a valid resolved intent', () => {
    const result = validateResolvedIntent(validIntent, manifest);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts all preset outputs used by the golden fixtures', () => {
    for (const fixture of goldenIntentFixtures) {
      const intent = parsePresetIntent(fixture.utterance, {
        manifest,
        currentStep: fixture.currentStep
      });

      expect(validateResolvedIntent(intent, manifest).errors).toEqual([]);
    }
  });

  it('rejects an invalid intent type', () => {
    const result = validateResolvedIntent({ ...validIntent, type: 'clarify' }, manifest);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('type must be a known IntentType');
  });

  it('rejects an invalid language', () => {
    const result = validateResolvedIntent({ ...validIntent, language: 'es' }, manifest);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("language must be 'en' or 'fr'");
  });

  it('rejects unknown part ids', () => {
    const result = validateResolvedIntent({ ...validIntent, partIds: ['missing-part'] }, manifest);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('unknown partId: missing-part');
  });

  it('rejects unknown camera views', () => {
    const result = validateResolvedIntent({ ...validIntent, viewKey: 'sideways' }, manifest);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('unknown viewKey: sideways');
  });

  it('rejects out-of-range step numbers', () => {
    const result = validateResolvedIntent({ ...validIntent, type: 'goto_step', stepNumber: 99 }, manifest);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('stepNumber must be in manifest step range');
  });

  it('requires a reply', () => {
    const { reply: _reply, ...missingReply } = validIntent;
    const result = validateResolvedIntent(missingReply, manifest);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('reply is required');
  });

  it('rejects replies longer than two sentences', () => {
    const result = validateResolvedIntent(
      { ...validIntent, reply: 'First. Second. Third.' },
      manifest
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('reply must be at most 2 sentences');
  });

  it('rejects unexpected fields', () => {
    const result = validateResolvedIntent({ ...validIntent, extra: true }, manifest);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('unexpected field: extra');
  });
});
