import {
  BOARD_THICKNESS,
  BOOKCASE_DEPTH,
  CENTER_Y,
  WORK_MAT,
  Y_FIXED_SHELF,
  Y_FRONT_RAIL,
  Y_TOP_PANEL
} from './billyDimensions';
import type { Vec3 } from './useViewerCommands';

export interface StepPoseOverride {
  offset?: Vec3;
  rotation?: Vec3;
}

const LIE_FLAT: Vec3 = [-Math.PI / 2, 0, 0];

/** World Y for the centre of a panel lying flat on the floor (after -90° X). */
const FLAT_CENTER_Y = BOOKCASE_DEPTH / 2 + BOARD_THICKNESS / 2;

const PANEL_PRIMITIVE_Y: Record<string, number> = {
  'bottom-panel': BOARD_THICKNESS / 2,
  'fixed-shelf': Y_FIXED_SHELF,
  'top-panel': Y_TOP_PANEL,
  'front-rail': Y_FRONT_RAIL,
  'side-panel-left': CENTER_Y,
  'side-panel-right': CENTER_Y
};

/** Step 1 — spread panels on the work mat instead of stacking. */
const STEP1_PANEL_SPREAD: Record<string, Vec3> = {
  'bottom-panel': [-0.34, 0, 0.08],
  'fixed-shelf': [-0.1, 0, 0.08],
  'top-panel': [0.14, 0, 0.08],
  'front-rail': [0.34, 0, 0.14]
};

const FLOOR_PANELS = new Set(Object.keys(STEP1_PANEL_SPREAD));

function layFlatOnFloor(partId: string, xz: Vec3, baseOffset: Vec3): StepPoseOverride {
  const primitiveY = PANEL_PRIMITIVE_Y[partId] ?? 0;
  return {
    rotation: LIE_FLAT,
    offset: [
      baseOffset[0] + xz[0],
      baseOffset[1] + FLAT_CENTER_Y - primitiveY,
      baseOffset[2] + xz[2]
    ]
  };
}

/**
 * Per-step pose overrides layered on top of derivePartPose offsets.
 * Handles floor staging, side-panel lying flat (steps 3–5), and lean-in for screws.
 */
export function resolveStepPoseOverride(partId: string, step: number, baseOffset: Vec3): StepPoseOverride | undefined {
  // Step 1 — panels flat on work mat for dowel prep
  if (step === 1 && FLOOR_PANELS.has(partId)) {
    return layFlatOnFloor(partId, STEP1_PANEL_SPREAD[partId], baseOffset);
  }

  // Step 2 — side panels leaned in for cam-screw access
  if (step === 2) {
    if (partId === 'side-panel-left') {
      return { rotation: [0, 0, 0.14], offset: [baseOffset[0] - 0.08, baseOffset[1] + 0.02, baseOffset[2] + 0.06] };
    }
    if (partId === 'side-panel-right') {
      return { rotation: [0, 0, -0.14], offset: [baseOffset[0] + 0.08, baseOffset[1] + 0.02, baseOffset[2] + 0.06] };
    }
  }

  // Steps 3–5 — first side panel lying on floor, shelves seated
  if (step >= 3 && step <= 5) {
    if (partId === 'side-panel-left') {
      return layFlatOnFloor(partId, [WORK_MAT[0], 0, WORK_MAT[2]], baseOffset);
    }
    if (['bottom-panel', 'fixed-shelf', 'top-panel'].includes(partId)) {
      const spread = STEP1_PANEL_SPREAD[partId] ?? [WORK_MAT[0], 0, WORK_MAT[2]];
      return layFlatOnFloor(partId, [spread[0] + 0.06, 0, spread[2] + 0.04], baseOffset);
    }
    if (partId === 'front-rail' && step >= 5) {
      return { rotation: [0.08, 0, 0], offset: [baseOffset[0], baseOffset[1] + 0.015, baseOffset[2] + 0.06] };
    }
  }

  // Steps 6–7 — cabinet upright; right side lowered on
  if (step === 6 && partId === 'side-panel-right') {
    return { rotation: [0, 0, 0], offset: [baseOffset[0] + 0.06, baseOffset[1] + 0.02, baseOffset[2] + 0.08] };
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
