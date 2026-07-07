import manifest from '../data/manifest';
import { derivePartPose, partLayouts, type Vec3 } from './useViewerCommands';

interface LayoutPoint {
  id: string;
  position: Vec3;
}

export interface SurfaceAnchor {
  position: Vec3;
  normal: Vec3;
}

const MAX_SLOT_MARKERS = 8;

/** Part ids needed for the given assembly step. */
export function stepPartIds(stepIndex: number): Set<string> {
  const step = manifest.steps[stepIndex - 1];
  if (!step) return new Set();
  return new Set(step.partsNeeded.map((entry) => entry.partId));
}

/** Collect primitive positions from a part layout, optionally filtered by point id. */
export function collectLayoutPoints(partId: string, filter?: (id: string) => boolean): LayoutPoint[] {
  const layout = partLayouts[partId];
  if (!layout) return [];

  const points: LayoutPoint[] = [];
  for (const primitive of layout.primitives) {
    points.push({ id: primitive.id, position: primitive.position });
  }
  for (const detail of layout.details ?? []) {
    for (const primitive of detail.primitives) {
      points.push({ id: primitive.id, position: primitive.position });
    }
  }

  return filter ? points.filter((point) => filter(point.id)) : points;
}

/** Apply the same step/explode offset used by the 3D part groups. */
export function worldPoint(
  partId: string,
  local: Vec3,
  currentStep: number,
  explodeLevel: 0 | 1 | 2
): Vec3 {
  const pose = derivePartPose(partId, currentStep, explodeLevel);
  return [
    local[0] + pose.offset[0],
    local[1] + pose.offset[1],
    local[2] + pose.offset[2]
  ];
}

/** Whether a host panel is close enough to its assembly pose to show install markers. */
export function isHostAnchored(partId: string, currentStep: number, explodeLevel: 0 | 1 | 2): boolean {
  const layout = partLayouts[partId];
  if (!layout) return false;
  const pose = derivePartPose(partId, currentStep, explodeLevel);
  if (!pose.visible) return false;
  if (explodeLevel > 0) return true;
  if (currentStep >= layout.unlockStep) return true;
  const active = stepPartIds(currentStep).has(partId);
  if (active) return true;
  const magnitude = Math.hypot(pose.offset[0], pose.offset[1], pose.offset[2]);
  return magnitude < 0.12;
}

/** Nudge marker outward along the panel face so rings sit on the surface, not inside the board. */
export function surfaceAnchor(partId: string, pointId: string, local: Vec3): SurfaceAnchor {
  if (pointId.includes('cam-hole') || pointId.includes('shelf-pin-hole')) {
    const side = local[0] < 0 ? -1 : 1;
    return {
      position: [local[0] + side * 0.016, local[1], local[2]],
      normal: [side, 0, 0]
    };
  }
  if (pointId.includes('dowel-hole')) {
    return {
      position: [local[0], local[1], local[2] + 0.014],
      normal: [0, 0, 1]
    };
  }
  if (pointId.includes('slot') || pointId.includes('nail-guide')) {
    return {
      position: [local[0], local[1], local[2] - 0.012],
      normal: [0, 0, -1]
    };
  }
  return { position: local, normal: [0, 1, 0] };
}

export function findSurfaceAnchor(
  partId: string,
  pointId: string,
  currentStep: number,
  explodeLevel: 0 | 1 | 2
): SurfaceAnchor | undefined {
  const match = collectLayoutPoints(partId, (id) => id === pointId)[0];
  if (!match) return undefined;
  const { position, normal } = surfaceAnchor(partId, pointId, match.position);
  return {
    position: worldPoint(partId, position, currentStep, explodeLevel),
    normal
  };
}

const INSTALL_HOSTS: Record<string, string[]> = {
  'cam-screw': ['side-panel-left', 'side-panel-right'],
  'wood-dowel': ['bottom-panel', 'fixed-shelf', 'top-panel', 'front-rail'],
  'shelf-pin': ['side-panel-left', 'side-panel-right'],
  'back-nail': ['back-panel']
};

function installSlotFilter(partId: string): (id: string) => boolean {
  switch (partId) {
    case 'cam-screw':
      return (id) => id.includes('cam-hole');
    case 'cam-lock':
      return (id) => id.includes('slot');
    case 'wood-dowel':
      return (id) => id.includes('dowel-hole');
    case 'shelf-pin':
      return (id) => id.includes('shelf-pin-hole');
    case 'back-nail':
      return (id) => id.includes('nail-guide');
    default:
      return () => true;
  }
}

function isHardwareRelevant(partId: string, currentStep: number, stepParts: Set<string>): boolean {
  if (!stepParts.has(partId)) return false;
  if (partId === 'shelf-pin' && currentStep < 13) return false;
  const layout = partLayouts[partId];
  if (layout && currentStep > layout.unlockStep) return false;
  return true;
}

/**
 * World-space install targets for binned hardware — scoped to the current step,
 * anchored on host panel holes, capped to avoid marker floods.
 */
export function installSlotPositions(
  partId: string,
  currentStep: number,
  explodeLevel: 0 | 1 | 2,
  stepParts: Set<string> = stepPartIds(currentStep)
): Vec3[] {
  if (!isHardwareRelevant(partId, currentStep, stepParts)) {
    return [];
  }

  const hosts = INSTALL_HOSTS[partId];
  const filter = installSlotFilter(partId);
  const positions: Vec3[] = [];

  const pushFromHost = (hostId: string) => {
    if (!isHostAnchored(hostId, currentStep, explodeLevel)) return;
    for (const point of collectLayoutPoints(hostId, filter)) {
      const { position } = surfaceAnchor(hostId, point.id, point.position);
      positions.push(worldPoint(hostId, position, currentStep, explodeLevel));
    }
  };

  if (hosts) {
    for (const hostId of hosts) {
      if (stepParts.has(hostId) || stepParts.has(partId)) {
        pushFromHost(hostId);
      }
    }
  } else {
    if (!isHostAnchored(partId, currentStep, explodeLevel)) {
      return [];
    }
    for (const point of collectLayoutPoints(partId, filter)) {
      const { position } = surfaceAnchor(partId, point.id, point.position);
      positions.push(worldPoint(partId, position, currentStep, explodeLevel));
    }
  }

  if (positions.length <= MAX_SLOT_MARKERS) {
    return positions;
  }

  const stride = Math.ceil(positions.length / MAX_SLOT_MARKERS);
  return positions.filter((_, index) => index % stride === 0).slice(0, MAX_SLOT_MARKERS);
}

/** @deprecated Use findSurfaceAnchor */
export function findWorldPoint(
  partId: string,
  pointId: string,
  currentStep: number,
  explodeLevel: 0 | 1 | 2
): Vec3 | undefined {
  return findSurfaceAnchor(partId, pointId, currentStep, explodeLevel)?.position;
}
