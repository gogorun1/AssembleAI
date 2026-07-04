import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedIntent, ViewerAPI } from '../types/assembly';
import { useAppStore } from '../store/useAppStore';
import { applyResolvedIntentAction } from './intentActions';

function createViewer(): ViewerAPI {
  return {
    goToStep: vi.fn(),
    highlight: vi.fn(),
    clearHighlights: vi.fn(),
    setCamera: vi.fn(),
    explode: vi.fn(),
    spinPart: vi.fn()
  };
}

function intent(overrides: Partial<ResolvedIntent>): ResolvedIntent {
  return {
    type: 'help',
    language: 'en',
    reply: 'Done.',
    ...overrides
  };
}

describe('applyResolvedIntentAction', () => {
  let viewer: ViewerAPI;

  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.getState().resetDemoState();
    viewer = createViewer();
    useAppStore.getState().setViewer(viewer);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps which_part to highlight, Orange Sync, select, camera, and spinPart', () => {
    applyResolvedIntentAction(useAppStore.getState(), intent({
      type: 'which_part',
      partIds: ['cam-screw-washer'],
      viewKey: 'screw-detail'
    }));

    expect(useAppStore.getState().highlightedPartIds).toEqual(['cam-screw-washer']);
    expect(useAppStore.getState().mentionedPartIds).toContain('cam-screw-washer');
    expect(useAppStore.getState().selectedPartId).toBe('cam-screw-washer');
    expect(viewer.setCamera).toHaveBeenCalledWith('screw-detail', 800);
    expect(viewer.highlight).toHaveBeenCalledWith(['cam-screw-washer'], 'solid');
    expect(viewer.highlight).toHaveBeenCalledWith(['cam-screw-washer'], 'pulse');
    expect(viewer.spinPart).toHaveBeenCalledWith('cam-screw-washer');
  });

  it('maps where_does_it_go to part highlighting and resolved camera', () => {
    applyResolvedIntentAction(useAppStore.getState(), intent({
      type: 'where_does_it_go',
      partIds: ['bottom-panel'],
      viewKey: 'base-detail'
    }));

    expect(useAppStore.getState().selectedPartId).toBe('bottom-panel');
    expect(viewer.setCamera).toHaveBeenCalledWith('base-detail', 800);
    expect(viewer.highlight).toHaveBeenCalledWith(['bottom-panel'], 'solid');
    expect(viewer.spinPart).not.toHaveBeenCalled();
  });

  it('maps show_angle to setCamera only', () => {
    applyResolvedIntentAction(useAppStore.getState(), intent({
      type: 'show_angle',
      viewKey: 'back-panel'
    }));

    expect(useAppStore.getState().activeViewKey).toBe('back-panel');
    expect(viewer.setCamera).toHaveBeenCalledWith('back-panel', 800);
    expect(viewer.highlight).not.toHaveBeenCalled();
  });

  it.each([
    ['next_step', 4],
    ['prev_step', 2],
    ['goto_step', 7]
  ] as const)('maps %s to active step updates', (type, stepNumber) => {
    applyResolvedIntentAction(useAppStore.getState(), intent({ type, stepNumber }));

    expect(useAppStore.getState().currentStep).toBe(stepNumber);
    expect(viewer.goToStep).toHaveBeenCalledWith(stepNumber);
  });

  it('maps common_mistake to highlighted parts and Orange Sync mentionPart', () => {
    applyResolvedIntentAction(useAppStore.getState(), intent({
      type: 'common_mistake',
      partIds: ['back-panel'],
      viewKey: 'back-panel',
      reply: 'Keep the back panel square.'
    }));

    expect(useAppStore.getState().highlightedPartIds).toEqual(['back-panel']);
    expect(useAppStore.getState().mentionedPartIds).toContain('back-panel');
    expect(useAppStore.getState().selectedPartId).toBe('back-panel');
    expect(viewer.setCamera).toHaveBeenCalledWith('back-panel', 800);
    expect(viewer.highlight).toHaveBeenCalledWith(['back-panel'], 'solid');
    expect(viewer.highlight).toHaveBeenCalledWith(['back-panel'], 'pulse');
  });
});
