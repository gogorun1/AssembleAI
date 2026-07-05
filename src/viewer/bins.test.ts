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

  it('exposes at least one install slot for each binned part', () => {
    for (const bin of partBins) {
      for (const partId of bin.partIds) {
        expect(slotPositions(partId, 1, 0).length, `slots for ${partId}`).toBeGreaterThan(0);
      }
    }
  });
});
