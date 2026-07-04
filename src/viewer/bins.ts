import { partLayouts, type Vec3 } from './useViewerCommands';

/**
 * Parts bins rendered in the DOM UI layer (see components/PartsBinsPanel). Each
 * bin holds one category of hardware, is labelled with a number + name, and is
 * the launch anchor for the fly-into-slot animation when its step is reached.
 */
export interface PartBin {
  id: string;
  index: number; // number stamped on the bin card
  name: string;
  /** Manifest part ids stored in this bin. */
  partIds: string[];
  /**
   * Normalized-device-coordinate anchor (x,y in -1..1) marking roughly where the
   * bin's UI card sits on screen — used as the launch point for the fly-into-slot
   * animation so parts appear to come from the on-screen bin.
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
    partIds: ['cam-screw'],
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
    id: 'bin-back-nails',
    index: 4,
    name: 'Back nails',
    partIds: ['back-nail'],
    anchorNdc: [-0.82, -0.28],
    iconShape: 'screw'
  },
  {
    id: 'bin-wall-hardware',
    index: 5,
    name: 'Wall hardware',
    partIds: ['wall-bracket', 'bracket-screw', 'washer'],
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
