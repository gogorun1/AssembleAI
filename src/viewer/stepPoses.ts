import {
  BOARD_THICKNESS,
  CENTER_Y,
  FLOOR_DROP_Y,
  WORK_MAT
} from './billyDimensions';
import type { Vec3 } from './useViewerCommands';

export interface StepPoseOverride {
  offset?: Vec3;
  rotation?: Vec3;
}

const LIE_FLAT: Vec3 = [-Math.PI / 2, 0, 0];

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

const FLOOR_PANELS = new Set(['bottom-panel', 'top-panel', 'fixed-shelf', 'front-rail']);

/**
 * Per-step pose overrides layered on top of derivePartPose offsets.
 * Handles floor staging, side-panel lying flat (steps 3–5), and lean-in for screws.
 */
export function resolveStepPoseOverride(partId: string, step: number, baseOffset: Vec3): StepPoseOverride | undefined {
  // Step 1 — panels flat on work mat for dowel prep
  if (step === 1 && FLOOR_PANELS.has(partId)) {
    return {
      rotation: LIE_FLAT,
      offset: add(baseOffset, [WORK_MAT[0], FLOOR_DROP_Y + 0.015, WORK_MAT[2]])
    };
  }

  // Step 2 — side panels leaned in for cam-screw access
  if (step === 2) {
    if (partId === 'side-panel-left') {
      return { rotation: [0, 0, 0.14], offset: add(baseOffset, [-0.08, 0, 0.06]) };
    }
    if (partId === 'side-panel-right') {
      return { rotation: [0, 0, -0.14], offset: add(baseOffset, [0.08, 0, 0.06]) };
    }
  }

  // Steps 3–5 — first side panel lying on floor, shelves seated
  if (step >= 3 && step <= 5) {
    if (partId === 'side-panel-left') {
      return {
        rotation: LIE_FLAT,
        offset: add(baseOffset, [WORK_MAT[0], FLOOR_DROP_Y, WORK_MAT[2]])
      };
    }
    if (['bottom-panel', 'fixed-shelf', 'top-panel'].includes(partId)) {
      return {
        rotation: [0, 0, 0],
        offset: add(baseOffset, [WORK_MAT[0] + 0.05, 0.035, WORK_MAT[2] + 0.04])
      };
    }
    if (partId === 'front-rail' && step >= 5) {
      return { rotation: [0.08, 0, 0], offset: add(baseOffset, [0, 0.015, 0.06]) };
    }
  }

  // Steps 6–7 — cabinet upright; right side lowered on
  if (step === 6 && partId === 'side-panel-right') {
    return { rotation: [0, 0, 0], offset: add(baseOffset, [0.06, 0.02, 0.08]) };
  }

  return undefined;
}

/** Hardware spawns this far along the approach axis before sliding into the hole. */
export function hardwareApproachDelta(partId: string): Vec3 {
  switch (partId) {
    case 'wood-dowel':
      return [0.06, 0, 0.04];
    case 'cam-screw':
      return [0.08, 0, 0.05];
    case 'cam-lock':
      return [0, 0, 0.06];
    case 'shelf-pin':
      return [0.05, 0, 0.03];
    case 'back-nail':
      return [0, 0, 0.05];
    default:
      return [0.05, 0.04, 0.05];
  }
}

/** Floor position for hardware waiting to be installed (replaces floating staging). */
export function hardwareStagingOffset(partId: string): Vec3 {
  const mat: Vec3 = [WORK_MAT[0] + 0.12, BOARD_THICKNESS / 2 + 0.01, WORK_MAT[2] + 0.08];
  if (partId === 'cam-screw' || partId === 'cam-lock') {
    return [mat[0] + 0.04, mat[1], mat[2]];
  }
  if (partId === 'wood-dowel') {
    return [mat[0] - 0.06, mat[1], mat[2]];
  }
  return mat;
}
