import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './useAppStore';

describe('useAppStore Orange Sync event', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.getState().resetDemoState();
  });

  it('marks the part as mentioned and clears it after the flash window', () => {
    useAppStore.getState().mentionPart('cam-screw-washer');

    expect(useAppStore.getState().mentionedPartIds).toContain('cam-screw-washer');

    vi.advanceTimersByTime(1999);
    expect(useAppStore.getState().mentionedPartIds).toContain('cam-screw-washer');

    vi.advanceTimersByTime(1);
    expect(useAppStore.getState().mentionedPartIds).not.toContain('cam-screw-washer');
  });
});
