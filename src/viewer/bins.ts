import { partLayouts, type Vec3 } from './useViewerCommands';

/**
 * Fixed workbench "part bins" placed around the model. Each bin holds one
 * category of hardware, is labelled with a number + name, and is the launch
 * point for the fly-into-slot animation when its step is reached.
 */
export interface PartBin {
  id: string;
  index: number; // number stamped on the bin
  name: string;
  /** Manifest part ids stored in this bin. */
  partIds: string[];
  /** World position of the bin (on the workbench floor, around the model). */
  position: Vec3;
  /** How many decorative icons to show resting in the tray. */
  icons: number;
  /** Icon primitive shape for the tray contents. */
  iconShape: 'screw' | 'lock' | 'dowel' | 'strap';
}

export const partBins: PartBin[] = [
  {
    id: 'bin-cam-screws',
    index: 1,
    name: 'Cam screws',
    partIds: ['cam-screw-washer'],
    position: [-1.85, 0.06, 1.15],
    icons: 6,
    iconShape: 'screw'
  },
  {
    id: 'bin-cam-locks',
    index: 2,
    name: 'Cam locks',
    partIds: ['cam-lock'],
    position: [-1.05, 0.06, 1.75],
    icons: 6,
    iconShape: 'lock'
  },
  {
    id: 'bin-dowels-pins',
    index: 3,
    name: 'Dowels & pins',
    partIds: ['wood-dowel', 'shelf-pin'],
    position: [0, 0.06, 2.0],
    icons: 7,
    iconShape: 'dowel'
  },
  {
    id: 'bin-back-screws',
    index: 4,
    name: 'Back screws',
    partIds: ['back-screw'],
    position: [1.05, 0.06, 1.75],
    icons: 6,
    iconShape: 'screw'
  },
  {
    id: 'bin-wall-strap',
    index: 5,
    name: 'Wall strap',
    partIds: ['safety-strap'],
    position: [1.85, 0.06, 1.15],
    icons: 2,
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
