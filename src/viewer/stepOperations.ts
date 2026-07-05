import type { StepOperation } from '../types/assembly';
import { derivePartPose, partLayouts, type Vec3 } from './useViewerCommands';

/** Representative operation hotspots per assembly step — anchors tie to partLayouts primitives. */
export const stepOperations: Record<number, StepOperation[]> = {
  1: [
    {
      id: 'dowel-bottom-front-left',
      label: 'Press dowel into edge hole',
      partId: 'wood-dowel',
      primitiveId: 'dowel-bottom-left-front',
      tool: 'hands',
      motion: 'press',
      approach: [0.12, 0.06, 0.14]
    },
    {
      id: 'dowel-fixed-back-right',
      label: 'Press dowel into fixed shelf edge',
      partId: 'wood-dowel',
      primitiveId: 'dowel-fixed-right-back',
      tool: 'hands',
      motion: 'press',
      approach: [-0.1, 0.06, -0.12]
    }
  ],
  2: [
    {
      id: 'cam-screw-left-bottom-front',
      label: 'Thread cam screw into side panel',
      partId: 'cam-screw',
      primitiveId: 'cam-screw-left-bottom-front',
      tool: 'flat-screwdriver',
      motion: 'turn',
      approach: [-0.14, 0, 0.18]
    },
    {
      id: 'cam-screw-right-top-back',
      label: 'Thread cam screw into second side',
      partId: 'cam-screw',
      primitiveId: 'cam-screw-right-top-back',
      tool: 'flat-screwdriver',
      motion: 'turn',
      approach: [0.14, 0, -0.16]
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
      primitiveId: 'cam-lock-bottom-left-front',
      tool: 'phillips',
      motion: 'turn',
      approach: [0.16, 0.08, 0.2]
    }
  ],
  5: [
    {
      id: 'cam-lock-rail-left',
      label: 'Lock front rail cam',
      partId: 'cam-lock',
      primitiveId: 'cam-lock-bottom-left-front',
      tool: 'phillips',
      motion: 'turn',
      approach: [0.14, 0.06, 0.22]
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
      primitiveId: 'cam-lock-fixed-right-back',
      tool: 'phillips',
      motion: 'turn',
      approach: [-0.16, 0.08, -0.18]
    }
  ],
  8: [
    {
      id: 'mark-back-center',
      label: 'Mark nail guide line',
      partId: 'back-panel',
      tool: 'pencil',
      motion: 'mark',
      approach: [0.18, 0.1, -0.22]
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
      tool: 'ruler',
      motion: 'mark',
      approach: [0.22, 0.08, -0.2]
    }
  ],
  11: [
    {
      id: 'nail-center-row',
      label: 'Hammer back panel nail',
      partId: 'back-nail',
      primitiveId: 'back-nail-center-3',
      tool: 'hammer',
      motion: 'strike',
      approach: [0.12, 0.18, -0.14]
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
      partId: 'shelf-pin',
      primitiveId: 'pin-bottom-left-front',
      tool: 'hands',
      motion: 'press',
      approach: [-0.12, 0.08, 0.16]
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

function partCenter(partId: string): Vec3 {
  const layout = partLayouts[partId];
  if (!layout || layout.primitives.length === 0) {
    return [0, 0, 0];
  }
  const sum = layout.primitives.reduce(
    (acc, primitive) => {
      acc[0] += primitive.position[0];
      acc[1] += primitive.position[1];
      acc[2] += primitive.position[2];
      return acc;
    },
    [0, 0, 0] as Vec3
  );
  const count = layout.primitives.length;
  return [sum[0] / count, sum[1] / count, sum[2] / count];
}

function primitivePosition(partId: string, primitiveId?: string): Vec3 {
  const layout = partLayouts[partId];
  if (!layout) return [0, 0, 0];
  if (primitiveId) {
    const match = layout.primitives.find((entry) => entry.id === primitiveId);
    if (match) return [...match.position];
  }
  return partCenter(partId);
}

export function resolveStepOperations(
  stepIndex: number,
  currentStep: number,
  explodeLevel: 0 | 1 | 2
): ResolvedOperation[] {
  const ops = stepOperations[stepIndex] ?? [];
  return ops.map((operation) => {
    const pose = derivePartPose(operation.partId, currentStep, explodeLevel);
    const local = primitivePosition(operation.partId, operation.primitiveId);
    const anchor: Vec3 = [
      local[0] + pose.offset[0],
      local[1] + pose.offset[1],
      local[2] + pose.offset[2]
    ];
    const approachDelta = operation.approach ?? [0.14, 0.08, 0.16];
    const approach: Vec3 = [
      anchor[0] + approachDelta[0],
      anchor[1] + approachDelta[1],
      anchor[2] + approachDelta[2]
    ];
    return {
      operation,
      anchor,
      approach,
      visible: pose.visible && stepIndex === currentStep
    };
  });
}
