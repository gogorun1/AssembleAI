import { describe, expect, it } from 'vitest';
import { resolveStepOperations } from './stepOperations';
import { toolKindFromNeeded } from './tools';

describe('stepOperations', () => {
  it('returns a single primary operation for the active step', () => {
    const step2 = resolveStepOperations(2, 2, 0);
    expect(step2).toHaveLength(1);
    expect(step2[0].operation.tool).toBe('flat-screwdriver');
  });

  it('anchors cam screw operations near side panel hardware', () => {
    const [first] = resolveStepOperations(2, 2, 0);
    expect(first.operation.tool).toBe('flat-screwdriver');
    expect(first.operation.partId).toBe('side-panel-left');
    expect(first.anchor[0]).toBeLessThan(0);
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
