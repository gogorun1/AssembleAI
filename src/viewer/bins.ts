import { installSlotPositions } from './partWorld';
import type { Vec3 } from './useViewerCommands';

/**
 * Parts bins rendered in the DOM UI layer (see components/PartsBinsPanel). Each
 * bin holds one category of hardware and is the launch anchor for the fly-into-slot
 * animation when its step is reached.
 */
export interface PartBin {
  id: string;
  name: string;
  /** Manifest part ids stored in this bin. */
  partIds: string[];
  /** Step-scoped camera preset when the bin is selected. */
  focusView: string;
  /**
   * Normalized-device-coordinate anchor (x,y in -1..1) marking roughly where the
   * bin's UI card sits on screen — used as the launch point for the fly-into-slot
   * animation so parts appear to come from the on-screen bin.
   */
  anchorNdc: [number, number];
  /** Icon shape shown on the UI card. */
  iconShape: 'screw' | 'lock' | 'dowel' | 'pin' | 'strap';
}

export const partBins: PartBin[] = [
  {
    id: 'bin-cam-screws',
    name: 'Cam screws',
    partIds: ['cam-screw'],
    focusView: 'side-screw-detail',
    anchorNdc: [-0.82, 0.62],
    iconShape: 'screw'
  },
  {
    id: 'bin-cam-locks',
    name: 'Cam locks',
    partIds: ['cam-lock'],
    focusView: 'cam-lock-detail',
    anchorNdc: [-0.82, 0.38],
    iconShape: 'lock'
  },
  {
    id: 'bin-wood-dowels',
    name: 'Wood dowels',
    partIds: ['wood-dowel'],
    focusView: 'dowel-prep',
    anchorNdc: [-0.82, 0.14],
    iconShape: 'dowel'
  },
  {
    id: 'bin-shelf-pins',
    name: 'Shelf pins',
    partIds: ['shelf-pin'],
    focusView: 'shelf-pin-detail',
    anchorNdc: [-0.82, -0.1],
    iconShape: 'pin'
  },
  {
    id: 'bin-back-nails',
    name: 'Back nails',
    partIds: ['back-nail'],
    focusView: 'back-nails',
    anchorNdc: [-0.82, -0.34],
    iconShape: 'screw'
  },
  {
    id: 'bin-wall-hardware',
    name: 'Wall hardware',
    partIds: ['wall-bracket', 'bracket-screw', 'washer'],
    focusView: 'wall-anchor',
    anchorNdc: [-0.82, -0.58],
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

/** Representative install-slot positions for a part in world space. */
export function slotPositions(
  partId: string,
  currentStep: number,
  explodeLevel: 0 | 1 | 2
): Vec3[] {
  return installSlotPositions(partId, currentStep, explodeLevel);
}
