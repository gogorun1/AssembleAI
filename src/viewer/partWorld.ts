import { derivePartPose, partLayouts, type Vec3 } from './useViewerCommands';

interface LayoutPoint {
  id: string;
  position: Vec3;
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

export function findWorldPoint(
  partId: string,
  pointId: string,
  currentStep: number,
  explodeLevel: 0 | 1 | 2
): Vec3 | undefined {
  const match = collectLayoutPoints(partId, (id) => id === pointId)[0];
  if (!match) return undefined;
  return worldPoint(partId, match.position, currentStep, explodeLevel);
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

/**
 * World-space install targets for binned hardware — anchored to host panel holes
 * and slots, not floating hardware primitives.
 */
export function installSlotPositions(
  partId: string,
  currentStep: number,
  explodeLevel: 0 | 1 | 2
): Vec3[] {
  const hosts = INSTALL_HOSTS[partId];
  if (hosts) {
    const filter = installSlotFilter(partId);
    return hosts.flatMap((hostId) =>
      collectLayoutPoints(hostId, filter).map((point) =>
        worldPoint(hostId, point.position, currentStep, explodeLevel)
      )
    );
  }

  return collectLayoutPoints(partId).map((point) =>
    worldPoint(partId, point.position, currentStep, explodeLevel)
  );
}
