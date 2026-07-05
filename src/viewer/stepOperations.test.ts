import { describe, expect, it } from 'vitest';
import { resolveStepOperations } from './stepOperations';
import { toolKindFromNeeded } from './tools';

describe('stepOperations', () => {
  it('returns visible operations only for the active step', () => {
    const step2 = resolveStepOperations(2, 2, 0);
    expect(step2.length).toBeGreaterThan(0);
    expect(step2.every((entry) => entry.visible)).toBe(true);

    const hiddenOnStep1 = resolveStepOperations(2, 1, 0);
    expect(hiddenOnStep1.every((entry) => !entry.visible)).toBe(true);
  });

  it('anchors cam screw operations near side panel hardware', () => {
    const [first] = resolveStepOperations(2, 2, 0);
    expect(first.operation.tool).toBe('flat-screwdriver');
    expect(Math.abs(first.anchor[0])).toBeGreaterThan(0.3);
  });
});

describe('toolKindFromNeeded', () => {
  it('maps manifest tool strings to tool ids', () => {
    expect(toolKindFromNeeded('Flat screwdriver')).toBe('flat-screwdriver');
    expect(toolKindFromNeeded('Phillips screwdriver and drill')).toBe('drill');
    expect(toolKindFromNeeded('Pencil and ruler')).toBe('ruler');
    expect(toolKindFromNeeded(undefined)).toBe('hands');
  });
});
