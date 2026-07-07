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
  const step = manifest.steps[stepIndex - 1];
  const ops = resolveStepOperations(stepIndex, stepIndex, 0);
  const primary = ops[0];

  if (primary) {
    const [ax, ay, az] = primary.anchor;
    const [nx, , nz] = primary.normal;
    const isDetail = stepIndex <= 5 || /lock|dowel|pin|nail|screw/i.test(primary.operation.label);
    const dist = isDetail ? 0.38 : 0.58;
    const side = stepIndex <= 5 ? 0.14 : 0.2;
    const lift = Math.max(0.1, ay * 0.15 + 0.08);

    return {
      target: [ax, ay, az],
      position: [
        ax + nx * dist + side,
        ay + lift,
        az + nz * dist + (Math.abs(nx) < 0.1 ? 0.22 : 0.12)
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
