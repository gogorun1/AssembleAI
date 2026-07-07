import manifest from '../data/manifest';
import { CENTER_Y } from './billyDimensions';
import { resolveStepOperations } from './stepOperations';
import type { Vec3 } from './useViewerCommands';

export interface StepCameraFrame {
  position: Vec3;
  target: Vec3;
}

/**
 * Compute a step-local camera from the primary operation anchor.
 * Falls back to the authored manifest preset when no operation is visible.
 */
export function resolveStepCamera(stepIndex: number): StepCameraFrame {
  // Step 1 — wide overview of the work mat so panels don't fill the frame.
  if (stepIndex === 1) {
    return {
      target: [0, 0.1, 0.12],
      position: [0.62, 0.78, 1.05]
    };
  }

  const step = manifest.steps[stepIndex - 1];
  const ops = resolveStepOperations(stepIndex, stepIndex, 0);
  const primary = ops[0];

  if (primary) {
    const [ax, ay, az] = primary.anchor;
    const [nx, , nz] = primary.normal;
    const isDetail = stepIndex <= 5 || /lock|dowel|pin|nail|screw/i.test(primary.operation.label);
    const dist = isDetail ? 0.62 : 0.85;
    const side = stepIndex <= 5 ? 0.18 : 0.24;
    const lift = Math.max(0.14, ay * 0.12 + 0.12);

    return {
      target: [ax, ay, az],
      position: [
        ax + nx * dist + side,
        ay + lift,
        az + nz * dist + (Math.abs(nx) < 0.1 ? 0.28 : 0.16)
      ]
    };
  }

  const key = step?.cameraView ?? 'front';
  const preset = manifest.cameraViews[key] ?? manifest.cameraViews.front;
  return {
    position: [...preset.position] as Vec3,
    target: preset.target ? ([...preset.target] as Vec3) : [0, CENTER_Y, 0]
  };
}
