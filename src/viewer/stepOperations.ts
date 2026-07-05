import type { StepOperation } from '../types/assembly';
import { derivePartPose, partLayouts, type Vec3 } from './useViewerCommands';
import { findWorldPoint, worldPoint, collectLayoutPoints } from './partWorld';

/** Representative operation hotspots per assembly step — anchors tie to partLayouts primitives. */
export const stepOperations: Record<number, StepOperation[]> = {
  1: [
    {
      id: 'dowel-bottom-front-left',
      label: 'Press dowel into edge hole',
      partId: 'bottom-panel',
      primitiveId: 'bottom-dowel-hole-left-front',
      tool: 'hands',
      motion: 'press',
      approach: [0.1, 0.08, 0.12]
    },
    {
      id: 'dowel-fixed-back-right',
      label: 'Press dowel into fixed shelf edge',
      partId: 'fixed-shelf',
      primitiveId: 'fixed-shelf-dowel-hole-right-back',
      tool: 'hands',
      motion: 'press',
      approach: [-0.08, 0.08, -0.1]
    }
  ],
  2: [
    {
      id: 'cam-screw-left-bottom-front',
      label: 'Thread cam screw into side panel',
      partId: 'side-panel-left',
      primitiveId: 'left-cam-hole-bottom-front',
      tool: 'flat-screwdriver',
      motion: 'turn',
      approach: [-0.12, 0.06, 0.14]
    },
    {
      id: 'cam-screw-right-top-back',
      label: 'Thread cam screw into second side',
      partId: 'side-panel-right',
      primitiveId: 'right-cam-hole-top-back',
      tool: 'flat-screwdriver',
      motion: 'turn',
      approach: [0.12, 0.06, -0.12]
    }
  ],
  3: [
    {
      id: 'seat-bottom-on-left',
      label: 'Seat bottom shelf on dowels',
      partId: 'bottom-panel',
      tool: 'hands',
      motion: 'slide',
      approach: [0.2, 0.08, 0.22]
    }
  ],
  4: [
    {
      id: 'cam-lock-bottom-left-front',
      label: 'Insert and turn cam lock',
      partId: 'cam-lock',
      primitiveId: 'cam-lock-bottom-left-front-slot',
      tool: 'phillips',
      motion: 'turn',
      approach: [0.12, 0.08, 0.16]
    }
  ],
  5: [
    {
      id: 'cam-lock-rail-left',
      label: 'Lock front rail cam',
      partId: 'cam-lock',
      primitiveId: 'cam-lock-bottom-left-front-slot',
      tool: 'phillips',
      motion: 'turn',
      approach: [0.1, 0.06, 0.18]
    }
  ],
  6: [
    {
      id: 'lower-right-side',
      label: 'Lower second side panel over dowels',
      partId: 'side-panel-right',
      tool: 'hands',
      motion: 'slide',
      approach: [0.24, 0.12, 0.2]
    }
  ],
  7: [
    {
      id: 'cam-lock-fixed-right-back',
      label: 'Turn remaining cam lock',
      partId: 'cam-lock',
      primitiveId: 'cam-lock-fixed-right-back-slot',
      tool: 'phillips',
      motion: 'turn',
      approach: [-0.12, 0.08, -0.14]
    }
  ],
  8: [
    {
      id: 'mark-back-center',
      label: 'Mark nail guide line',
      partId: 'back-panel',
      primitiveId: 'back-nail-guide-line',
      tool: 'pencil',
      motion: 'mark',
      approach: [0.14, 0.08, -0.16]
    }
  ],
  9: [
    {
      id: 'slide-back-panel',
      label: 'Slide folded back into grooves',
      partId: 'back-panel',
      tool: 'hands',
      motion: 'slide',
      approach: [0, 0.12, -0.28]
    }
  ],
  10: [
    {
      id: 'rule-nail-line',
      label: 'Rule the nail guide line',
      partId: 'back-panel',
      primitiveId: 'back-nail-guide-line',
      tool: 'ruler',
      motion: 'mark',
      approach: [0.16, 0.08, -0.16]
    }
  ],
  11: [
    {
      id: 'nail-center-row',
      label: 'Hammer back panel nail',
      partId: 'back-panel',
      primitiveId: 'back-nail-guide-line',
      tool: 'hammer',
      motion: 'strike',
      approach: [0.1, 0.16, -0.12]
    }
  ],
  12: [
    {
      id: 'bracket-screw-left',
      label: 'Drive bracket screw',
      partId: 'bracket-screw',
      primitiveId: 'bracket-screw-left',
      tool: 'drill',
      motion: 'turn',
      approach: [-0.14, 0.1, -0.2]
    }
  ],
  13: [
    {
      id: 'shelf-pin-left-front',
      label: 'Push shelf support pin',
      partId: 'side-panel-left',
      primitiveId: 'left-shelf-pin-hole-1-1',
      tool: 'hands',
      motion: 'press',
      approach: [-0.1, 0.08, 0.12]
    }
  ],
  14: [
    {
      id: 'place-adjustable-shelf',
      label: 'Lower adjustable shelf onto pins',
      partId: 'adjustable-shelf',
      tool: 'hands',
      motion: 'slide',
      approach: [0.18, 0.1, 0.24]
    }
  ]
};

export interface ResolvedOperation {
  operation: StepOperation;
  anchor: Vec3;
  approach: Vec3;
  visible: boolean;
}

function resolveOperationAnchor(
  operation: StepOperation,
  currentStep: number,
  explodeLevel: 0 | 1 | 2
): Vec3 | undefined {
  if (operation.primitiveId) {
    const exact = findWorldPoint(operation.partId, operation.primitiveId, currentStep, explodeLevel);
    if (exact) return exact;
  }

  const layout = partLayouts[operation.partId];
  if (!layout) return undefined;

  const points = collectLayoutPoints(operation.partId);
  if (points.length === 0) return undefined;

  const center = points.reduce(
    (acc, point) => {
      acc[0] += point.position[0];
      acc[1] += point.position[1];
      acc[2] += point.position[2];
      return acc;
    },
    [0, 0, 0] as Vec3
  );
  const count = points.length;
  return worldPoint(
    operation.partId,
    [center[0] / count, center[1] / count, center[2] / count],
    currentStep,
    explodeLevel
  );
}

export function resolveStepOperations(
  stepIndex: number,
  currentStep: number,
  explodeLevel: 0 | 1 | 2
): ResolvedOperation[] {
  const ops = stepOperations[stepIndex] ?? [];
  return ops.flatMap((operation) => {
    const anchor = resolveOperationAnchor(operation, currentStep, explodeLevel);
    if (!anchor) return [];

    const pose = derivePartPose(operation.partId, currentStep, explodeLevel);
    if (!pose.visible || stepIndex !== currentStep) {
      return [];
    }

    const approachDelta = operation.approach ?? [0.14, 0.08, 0.16];
    const approach: Vec3 = [
      anchor[0] + approachDelta[0],
      anchor[1] + approachDelta[1],
      anchor[2] + approachDelta[2]
    ];
    return [{ operation, anchor, approach, visible: true }];
  });
}
