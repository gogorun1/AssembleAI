import { describe, expect, it } from 'vitest';
import { operationRingRotationAt, operationRingScaleAt } from './OperationIndicators';
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

describe('operation indicator motion', () => {
  it('keeps the anchor ring calm and non-rotating', () => {
    const samples = [0, 0.25, 0.5, 0.75, 1, 1.25].map(operationRingScaleAt);

    expect(Math.max(...samples)).toBeLessThanOrEqual(1.04);
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.96);
    expect(samples.some((scale) => scale !== 1)).toBe(true);

    expect(operationRingRotationAt(0)).toBe(0);
    expect(operationRingRotationAt(4.2)).toBe(0);
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
