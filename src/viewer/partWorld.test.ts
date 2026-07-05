import { describe, expect, it } from 'vitest';
import { findWorldPoint, installSlotPositions, worldPoint } from './partWorld';

describe('partWorld', () => {
  it('applies step offsets to world points', () => {
    const atStep1 = worldPoint('bottom-panel', [0, 0.027, 0], 1, 0);
    const atStep3 = worldPoint('bottom-panel', [0, 0.027, 0], 3, 0);
    expect(atStep1).not.toEqual(atStep3);
  });

  it('anchors cam screw slots on side panel holes', () => {
    const holes = installSlotPositions('cam-screw', 2, 0);
    expect(holes.length).toBeGreaterThan(0);
    expect(Math.abs(holes[0][0])).toBeGreaterThan(0.3);
  });

  it('anchors dowel slots on panel edge holes', () => {
    const holes = installSlotPositions('wood-dowel', 1, 0);
    expect(holes.some((pos) => pos[1] < 0.2)).toBe(true);
  });

  it('resolves named layout points for operations', () => {
    const hole = findWorldPoint('side-panel-left', 'left-cam-hole-bottom-front', 2, 0);
    expect(hole).toBeTruthy();
    expect(hole![0]).toBeLessThan(0);
  });
});
