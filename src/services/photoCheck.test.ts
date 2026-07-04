import { describe, expect, it } from 'vitest';
import { checkAssemblyPhoto, mockPhotoCheck } from './photoCheck';

function makeFile(): File {
  return new File(['fake-bytes'], 'photo.jpg', { type: 'image/jpeg' });
}

describe('photoCheck mock service', () => {
  it('returns a mock result when no endpoint is configured', async () => {
    const result = await checkAssemblyPhoto({ file: makeFile(), currentStep: 1 });

    expect(result.status).toBeDefined();
    expect(typeof result.summary).toBe('string');
    expect(Array.isArray(result.findings)).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('produces a warning referencing the common mistake on an odd step with a mistake', () => {
    // Step 1 has a documented common mistake and is odd -> warning branch.
    const result = mockPhotoCheck({ file: makeFile(), currentStep: 1 });

    expect(result.status).toBe('warning');
    expect(result.findings.some((f) => f.severity === 'warning')).toBe(true);
    expect(result.findings[0].detail.length).toBeGreaterThan(0);
    expect(result.recommendedUtterance).toBeTruthy();
  });

  it('produces a pass result on an even step', () => {
    // Step 2 is even -> pass branch.
    const result = mockPhotoCheck({ file: makeFile(), currentStep: 2 });

    expect(result.status).toBe('pass');
    expect(result.findings[0].severity).toBe('info');
  });

  it('references part ids from the current step in findings', () => {
    const result = mockPhotoCheck({ file: makeFile(), currentStep: 1 });
    const finding = result.findings.find((f) => f.partIds && f.partIds.length > 0);

    expect(finding).toBeDefined();
    expect(finding?.partIds).toContain('wood-dowel');
  });

  it('clamps out-of-range steps without throwing', () => {
    const low = mockPhotoCheck({ file: makeFile(), currentStep: 0 });
    const high = mockPhotoCheck({ file: makeFile(), currentStep: 999 });

    expect(low.status).toBeDefined();
    expect(high.status).toBeDefined();
  });
});
