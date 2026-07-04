import { describe, expect, it } from 'vitest';
import manifest from './manifest';

describe('billy assembly manifest', () => {
  it('contains the demo-sized BILLY bookcase walkthrough', () => {
    expect(manifest.id).toBe('billy-bookcase');
    expect(manifest.steps).toHaveLength(9);
    expect(manifest.steps.filter((step) => step.commonMistake).length).toBeGreaterThanOrEqual(4);
  });

  it('uses valid part and camera references for every step', () => {
    const partIds = new Set(manifest.parts.map((part) => part.id));
    const viewKeys = new Set(Object.keys(manifest.cameraViews));

    for (const step of manifest.steps) {
      expect(viewKeys.has(step.cameraView), `${step.title} camera`).toBe(true);
      for (const part of step.partsNeeded) {
        expect(partIds.has(part.partId), `${step.title} part ${part.partId}`).toBe(true);
      }
      for (const partId of step.highlightParts) {
        expect(partIds.has(partId), `${step.title} highlight ${partId}`).toBe(true);
      }
    }
  });

  it('keeps manual-style part codes visible in the data', () => {
    expect(manifest.parts.every((part) => part.code.length >= 3)).toBe(true);
    expect(manifest.parts.map((part) => part.code)).toContain('117327');
    expect(manifest.parts.map((part) => part.code)).toContain('M3.5x16');
  });
});
