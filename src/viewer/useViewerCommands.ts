import type { Part } from '../types/assembly';

export type Vec3 = [number, number, number];

export interface PartPrimitive {
  id: string;
  shape: 'box' | 'cylinder';
  size: Vec3;
  position: Vec3;
  rotation?: Vec3;
}

export interface PartLayout {
  partId: string;
  unlockStep: number;
  explodedOffset: Vec3;
  role: 'panel' | 'hardware' | 'back' | 'strap';
  stepOffsets?: Record<number, Vec3>;
  primitives: PartPrimitive[];
}

export interface PartPose {
  primitives: PartPrimitive[];
  offset: Vec3;
  visible: boolean;
}

export const partLayouts: Record<string, PartLayout> = {
  'side-panel-left': {
    partId: 'side-panel-left',
    unlockStep: 1,
    explodedOffset: [-0.72, 0.1, 0.5],
    role: 'panel',
    stepOffsets: {
      1: [-0.16, 0.04, 0.12]
    },
    primitives: [
      { id: 'left-panel', shape: 'box', size: [0.08, 2.2, 0.36], position: [-0.72, 1.1, 0] }
    ]
  },
  'side-panel-right': {
    partId: 'side-panel-right',
    unlockStep: 4,
    explodedOffset: [0.82, 0.16, 0.46],
    role: 'panel',
    primitives: [
      { id: 'right-panel', shape: 'box', size: [0.08, 2.2, 0.36], position: [0.72, 1.1, 0] }
    ]
  },
  'bottom-panel': {
    partId: 'bottom-panel',
    unlockStep: 2,
    explodedOffset: [0, -0.38, 0.62],
    role: 'panel',
    stepOffsets: {
      2: [0, -0.08, 0.14]
    },
    primitives: [
      { id: 'bottom', shape: 'box', size: [1.44, 0.08, 0.36], position: [0, 0.08, 0] }
    ]
  },
  'top-panel': {
    partId: 'top-panel',
    unlockStep: 5,
    explodedOffset: [0, 0.72, 0.5],
    role: 'panel',
    primitives: [
      { id: 'top', shape: 'box', size: [1.44, 0.08, 0.36], position: [0, 2.16, 0] }
    ]
  },
  'fixed-shelf': {
    partId: 'fixed-shelf',
    unlockStep: 3,
    explodedOffset: [0, 0.12, 0.74],
    role: 'panel',
    stepOffsets: {
      3: [0, 0.06, 0.18]
    },
    primitives: [
      { id: 'fixed-shelf', shape: 'box', size: [1.34, 0.07, 0.34], position: [0, 1.08, 0] }
    ]
  },
  'adjustable-shelf': {
    partId: 'adjustable-shelf',
    unlockStep: 8,
    explodedOffset: [0, 0.2, 0.86],
    role: 'panel',
    primitives: [
      { id: 'adjustable-low', shape: 'box', size: [1.34, 0.06, 0.34], position: [0, 0.64, 0] },
      { id: 'adjustable-high', shape: 'box', size: [1.34, 0.06, 0.34], position: [0, 1.58, 0] }
    ]
  },
  'back-panel': {
    partId: 'back-panel',
    unlockStep: 7,
    explodedOffset: [0, 0.08, -0.72],
    role: 'back',
    primitives: [
      { id: 'back', shape: 'box', size: [1.5, 2.18, 0.04], position: [0, 1.12, -0.22] }
    ]
  },
  'cam-screw-washer': {
    partId: 'cam-screw-washer',
    unlockStep: 1,
    explodedOffset: [-1.0, 0.42, 0.84],
    role: 'hardware',
    stepOffsets: {
      1: [-0.1, 0.03, 0.09]
    },
    primitives: [
      { id: 'cam-screw-a', shape: 'cylinder', size: [0.035, 0.035, 0.18], position: [-0.78, 0.42, 0.2], rotation: [0, 0, 1.57] },
      { id: 'cam-screw-b', shape: 'cylinder', size: [0.035, 0.035, 0.18], position: [-0.78, 1.05, 0.2], rotation: [0, 0, 1.57] },
      { id: 'cam-screw-c', shape: 'cylinder', size: [0.035, 0.035, 0.18], position: [0.78, 0.42, 0.2], rotation: [0, 0, 1.57] },
      { id: 'cam-screw-d', shape: 'cylinder', size: [0.035, 0.035, 0.18], position: [0.78, 1.05, 0.2], rotation: [0, 0, 1.57] }
    ]
  },
  'cam-lock': {
    partId: 'cam-lock',
    unlockStep: 2,
    explodedOffset: [1.04, 0.28, 0.82],
    role: 'hardware',
    stepOffsets: {
      2: [0.08, 0.04, 0.1]
    },
    primitives: [
      { id: 'cam-lock-a', shape: 'cylinder', size: [0.05, 0.05, 0.035], position: [-0.48, 0.13, 0.22], rotation: [1.57, 0, 0] },
      { id: 'cam-lock-b', shape: 'cylinder', size: [0.05, 0.05, 0.035], position: [0.48, 0.13, 0.22], rotation: [1.57, 0, 0] },
      { id: 'cam-lock-c', shape: 'cylinder', size: [0.05, 0.05, 0.035], position: [-0.48, 2.1, 0.22], rotation: [1.57, 0, 0] },
      { id: 'cam-lock-d', shape: 'cylinder', size: [0.05, 0.05, 0.035], position: [0.48, 2.1, 0.22], rotation: [1.57, 0, 0] }
    ]
  },
  'wood-dowel': {
    partId: 'wood-dowel',
    unlockStep: 3,
    explodedOffset: [0.92, 0.48, 0.62],
    role: 'hardware',
    stepOffsets: {
      3: [0.06, 0.03, 0.08]
    },
    primitives: [
      { id: 'dowel-a', shape: 'cylinder', size: [0.026, 0.026, 0.22], position: [-0.54, 1.08, 0.16], rotation: [0, 0, 1.57] },
      { id: 'dowel-b', shape: 'cylinder', size: [0.026, 0.026, 0.22], position: [0.54, 1.08, 0.16], rotation: [0, 0, 1.57] }
    ]
  },
  'shelf-pin': {
    partId: 'shelf-pin',
    unlockStep: 8,
    explodedOffset: [0.98, 0.12, 0.74],
    role: 'hardware',
    primitives: [
      { id: 'pin-a', shape: 'cylinder', size: [0.025, 0.025, 0.16], position: [-0.66, 0.64, 0.12], rotation: [0, 0, 1.57] },
      { id: 'pin-b', shape: 'cylinder', size: [0.025, 0.025, 0.16], position: [0.66, 0.64, 0.12], rotation: [0, 0, 1.57] },
      { id: 'pin-c', shape: 'cylinder', size: [0.025, 0.025, 0.16], position: [-0.66, 1.58, 0.12], rotation: [0, 0, 1.57] },
      { id: 'pin-d', shape: 'cylinder', size: [0.025, 0.025, 0.16], position: [0.66, 1.58, 0.12], rotation: [0, 0, 1.57] }
    ]
  },
  'back-screw': {
    partId: 'back-screw',
    unlockStep: 7,
    explodedOffset: [-0.9, 0.2, -0.86],
    role: 'hardware',
    primitives: [
      { id: 'back-screw-a', shape: 'cylinder', size: [0.025, 0.025, 0.035], position: [-0.62, 0.34, -0.26], rotation: [1.57, 0, 0] },
      { id: 'back-screw-b', shape: 'cylinder', size: [0.025, 0.025, 0.035], position: [0.62, 0.34, -0.26], rotation: [1.57, 0, 0] },
      { id: 'back-screw-c', shape: 'cylinder', size: [0.025, 0.025, 0.035], position: [-0.62, 1.94, -0.26], rotation: [1.57, 0, 0] },
      { id: 'back-screw-d', shape: 'cylinder', size: [0.025, 0.025, 0.035], position: [0.62, 1.94, -0.26], rotation: [1.57, 0, 0] }
    ]
  },
  'safety-strap': {
    partId: 'safety-strap',
    unlockStep: 9,
    explodedOffset: [0, 0.72, -0.96],
    role: 'strap',
    primitives: [
      { id: 'strap', shape: 'box', size: [0.42, 0.04, 0.025], position: [0, 2.26, -0.32], rotation: [0, 0, 0.18] }
    ]
  }
};

export function normalizeNodeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toPascalCase(value: string): string {
  return value
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join('');
}

/**
 * All node-name spellings a GLB might use for a given manifest part. Combines
 * the explicit `meshNodes` list with derivations from the part id/meshName.
 */
export function partNodeCandidates(part: Pick<Part, 'id' | 'meshName' | 'meshNodes'>): string[] {
  const derived = [
    part.meshName,
    part.id,
    part.id.replace(/-/g, '_'),
    part.id.replace(/-/g, ''),
    part.meshName.replace(/_/g, ''),
    toPascalCase(part.id),
    toPascalCase(part.meshName)
  ];
  return Array.from(new Set([...(part.meshNodes ?? []), ...derived].filter(Boolean)));
}

/**
 * Resolve a GLB node name to a manifest part id. Tries exact normalized match
 * first, then a containment match so grouped/suffixed node names still bind.
 */
export function resolvePartIdForNode(
  nodeName: string,
  parts: Array<Pick<Part, 'id' | 'meshName' | 'meshNodes'>>
): string | undefined {
  const normalizedNode = normalizeNodeName(nodeName);
  if (!normalizedNode) {
    return undefined;
  }

  for (const part of parts) {
    for (const candidate of partNodeCandidates(part)) {
      if (normalizeNodeName(candidate) === normalizedNode) {
        return part.id;
      }
    }
  }

  for (const part of parts) {
    for (const candidate of partNodeCandidates(part)) {
      const normalizedCandidate = normalizeNodeName(candidate);
      if (
        normalizedCandidate.length >= 4 &&
        (normalizedNode.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedNode))
      ) {
        return part.id;
      }
    }
  }

  return undefined;
}

export function derivePartPose(
  partId: string,
  currentStep: number,
  explodeLevel: 0 | 1 | 2
): PartPose {
  const layout = partLayouts[partId];
  if (!layout) {
    return { primitives: [], offset: [0, 0, 0], visible: false };
  }

  const assembled = currentStep >= layout.unlockStep;
  const pendingMultiplier = assembled ? 0 : 1.25;
  const explodedMultiplier = explodeLevel === 0 ? 0 : explodeLevel === 1 ? 0.28 : 0.82;
  const multiplier = pendingMultiplier + explodedMultiplier;
  const stepOffset = layout.stepOffsets?.[currentStep] ?? [0, 0, 0];

  return {
    primitives: layout.primitives,
    offset: [
      layout.explodedOffset[0] * multiplier + stepOffset[0],
      layout.explodedOffset[1] * multiplier + stepOffset[1],
      layout.explodedOffset[2] * multiplier + stepOffset[2]
    ],
    visible: assembled || explodeLevel > 0 || currentStep + 1 >= layout.unlockStep
  };
}
