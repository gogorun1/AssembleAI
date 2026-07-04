import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewerAPI } from '../types/assembly';
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

  it('emits a fresh camera move request when setting the active view', () => {
    const viewer: ViewerAPI = {
      goToStep: vi.fn(),
      highlight: vi.fn(),
      clearHighlights: vi.fn(),
      setCamera: vi.fn(),
      explode: vi.fn(),
      spinPart: vi.fn()
    };
    useAppStore.getState().setViewer(viewer);
    const initialRequestId = useAppStore.getState().cameraMove.requestId;

    useAppStore.getState().setActiveView('back-panel');

    expect(useAppStore.getState().activeViewKey).toBe('back-panel');
    expect(useAppStore.getState().cameraMove).toEqual({
      viewKey: 'back-panel',
      requestId: initialRequestId + 1,
      animateMs: 800
    });
    expect(viewer.setCamera).toHaveBeenCalledWith('back-panel', 800);
  });
});
