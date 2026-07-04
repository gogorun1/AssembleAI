import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { HighlightMode } from '../store/useAppStore';

/**
 * The ONLY interface the rest of the app uses to drive three.js (§5.2).
 * Every method mutates the zustand `viewer` slice; the <Viewer /> subscribes
 * to that slice and performs the actual three.js animation. No component
 * outside the viewer/ folder should ever import three directly.
 */
export interface ViewerAPI {
  goToStep(index: number): void;
  highlight(partIds: string[], mode?: HighlightMode): void;
  clearHighlights(): void;
  setCamera(viewKey: string, animateMs?: number): void;
  explode(level: 0 | 1 | 2): void;
  spinPart(partId: string): void;
}

/** Camera flights default to 800ms — the --t-slow motion token (§6.5). */
export const CAMERA_FLIGHT_MS = 800;

export function useViewerCommands(): ViewerAPI {
  return useMemo<ViewerAPI>(() => {
    const store = useAppStore.getState;

    const setCamera: ViewerAPI['setCamera'] = (viewKey, animateMs = CAMERA_FLIGHT_MS) => {
      store()._setCamera(viewKey, animateMs);
    };

    const highlight: ViewerAPI['highlight'] = (partIds, mode = 'pulse') => {
      store()._setHighlight(partIds, mode);
    };

    return {
      goToStep(index) {
        const s = store();
        s.setStep(index);
        const step = s.manifest.steps.find((st) => st.index === s.currentStepIndex);
        if (step) {
          setCamera(step.cameraView);
          highlight(step.highlightParts, 'pulse');
        }
      },
      highlight,
      clearHighlights() {
        store()._clearHighlights();
      },
      setCamera,
      explode(level) {
        store()._setExplode(level);
      },
      spinPart(partId) {
        store()._spinPart(partId);
      },
    };
  }, []);
}
