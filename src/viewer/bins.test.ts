import { describe, expect, it } from 'vitest';
import manifest from '../data/manifest';
import { binForPart, partBins, slotPositions } from './bins';
import { partLayouts } from './useViewerCommands';

describe('parts bins', () => {
  const partIds = new Set(manifest.parts.map((part) => part.id));

  it('references only real manifest parts that have a layout', () => {
    for (const bin of partBins) {
      expect(bin.partIds.length).toBeGreaterThan(0);
      for (const partId of bin.partIds) {
        expect(partIds.has(partId), `manifest part ${partId}`).toBe(true);
        expect(partLayouts[partId], `layout for ${partId}`).toBeTruthy();
      }
    }
  });

  it('assigns each binned part to exactly one bin', () => {
    const seen = new Map<string, number>();
    for (const bin of partBins) {
      for (const partId of bin.partIds) {
        seen.set(partId, (seen.get(partId) ?? 0) + 1);
      }
    }
    for (const [partId, count] of seen) {
      expect(count, `${partId} bin count`).toBe(1);
      expect(binForPart[partId].partIds).toContain(partId);
    }
  });

  it('exposes install slots for each binned part on a relevant step', () => {
    const cases: Array<[string, number]> = [
      ['cam-screw', 2],
      ['cam-lock', 4],
      ['wood-dowel', 1],
      ['shelf-pin', 13],
      ['back-nail', 11],
      ['wall-bracket', 12]
    ];
    for (const [partId, step] of cases) {
      expect(slotPositions(partId, step, 0).length, `slots for ${partId} step ${step}`).toBeGreaterThan(0);
    }
  });
});
