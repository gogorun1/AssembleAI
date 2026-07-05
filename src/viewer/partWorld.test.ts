import { describe, expect, it } from 'vitest';
import { installSlotPositions, isHostAnchored, stepPartIds } from './partWorld';

describe('partWorld', () => {
  it('scopes slot positions to the current step partsNeeded', () => {
    const step1 = stepPartIds(1);
    expect(step1.has('wood-dowel')).toBe(true);
    expect(installSlotPositions('shelf-pin', 1, 0, step1)).toHaveLength(0);
    expect(installSlotPositions('wood-dowel', 1, 0, step1).length).toBeGreaterThan(0);
  });

  it('caps cam screw markers to a readable subset', () => {
    const step2 = stepPartIds(2);
    const slots = installSlotPositions('cam-screw', 2, 0, step2);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.length).toBeLessThanOrEqual(8);
  });

  it('keeps exploded side panels off slot targets until anchored', () => {
    expect(isHostAnchored('side-panel-right', 3, 0)).toBe(false);
    expect(isHostAnchored('side-panel-left', 2, 0)).toBe(true);
  });
});
