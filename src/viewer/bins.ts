import { partLayouts, type Vec3 } from './useViewerCommands';

/**
 * Fixed workbench "part bins" placed around the model. Each bin holds one
 * category of hardware, is labelled with a number + name, and is the launch
 * point for the fly-into-slot animation when its step is reached.
 */
export interface PartBin {
  id: string;
  index: number; // number stamped on the bin card
  name: string;
  /** Manifest part ids stored in this bin. */
  partIds: string[];
  /**
   * Normalized-device-coordinate anchor (x,y in -1..1) marking roughly where the
   * bin's UI card sits on screen. Used as the launch point for the fly-into-slot
   * animation so parts appear to come from the on-screen bin. The bins are UI
   * (DOM) elements, not objects in the 3D scene.
   */
  anchorNdc: [number, number];
  /** Icon shape shown on the UI card. */
  iconShape: 'screw' | 'lock' | 'dowel' | 'strap';
}

export const partBins: PartBin[] = [
  {
    id: 'bin-cam-screws',
    index: 1,
    name: 'Cam screws',
    partIds: ['cam-screw-washer'],
    anchorNdc: [-0.82, 0.55],
    iconShape: 'screw'
  },
  {
    id: 'bin-cam-locks',
    index: 2,
    name: 'Cam locks',
    partIds: ['cam-lock'],
    anchorNdc: [-0.82, 0.28],
    iconShape: 'lock'
  },
  {
    id: 'bin-dowels-pins',
    index: 3,
    name: 'Dowels & pins',
    partIds: ['wood-dowel', 'shelf-pin'],
    anchorNdc: [-0.82, 0.0],
    iconShape: 'dowel'
  },
  {
    id: 'bin-back-screws',
    index: 4,
    name: 'Back screws',
    partIds: ['back-screw'],
    anchorNdc: [-0.82, -0.28],
    iconShape: 'screw'
  },
  {
    id: 'bin-wall-strap',
    index: 5,
    name: 'Wall strap',
    partIds: ['safety-strap'],
    anchorNdc: [-0.82, -0.55],
    iconShape: 'strap'
  }
];

/** Map every binned part id to the bin that holds it. */
export const binForPart: Record<string, PartBin> = (() => {
  const map: Record<string, PartBin> = {};
  for (const bin of partBins) {
    for (const partId of bin.partIds) {
      map[partId] = bin;
    }
  }
  return map;
})();

/** Representative install-slot positions for a part (from its primitive layout). */
export function slotPositions(partId: string): Vec3[] {
  return partLayouts[partId]?.primitives.map((primitive) => primitive.position) ?? [];
}
