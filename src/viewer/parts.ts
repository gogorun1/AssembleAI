import type { Vec3 } from './partTypes';

/**
 * Procedural layout for the BILLY-style bookcase. Each entry maps a manifest
 * part id to its geometry, assembled "home" transform, an explode offset
 * direction, and the step at which it snaps into place (progressive assembly).
 *
 * We build the model procedurally from primitives instead of shipping a GLTF
 * so the demo has no binary asset dependency; the meshNames still match the
 * manifest so the ViewerAPI stays the only interface to three.js.
 */
export type PieceKind = 'panel' | 'metal' | 'dowel';

export interface Piece {
  size: Vec3;
  pos: Vec3;
  kind: PieceKind;
  rot?: Vec3;
  cyl?: boolean; // render as cylinder (radius = size[0], height = size[1])
}

export interface PartLayout {
  partId: string;
  home: Vec3; // group origin in assembled state
  explode: Vec3; // offset applied at explode factor 1
  installStep: number; // becomes assembled once currentStep >= installStep
  pieces: Piece[]; // child primitives, positions relative to group origin
}

const T = 0.08; // panel thickness
const H = 3.9; // side panel height
const D = 1.0; // depth

const shelfYs = [1.05, 1.95, 2.85];

// small helpers to stamp repeated hardware clusters
const dowelCol = (x: number, z: number): Piece[] =>
  [0.35, 3.55].map((y) => ({
    size: [0.05, 0.22, 0.05] as Vec3,
    pos: [x, y, z] as Vec3,
    kind: 'dowel' as const,
    cyl: true,
  }));

const camCol = (x: number): Piece[] =>
  [0.2, 3.9].map((y) => ({
    size: [0.09, 0.06, 0.09] as Vec3,
    pos: [x, y, 0.25] as Vec3,
    kind: 'metal' as const,
    cyl: true,
  }));

export const PART_LAYOUT: PartLayout[] = [
  {
    partId: 'side-panel-left',
    home: [-0.92, H / 2, 0],
    explode: [-1.6, 0, 0],
    installStep: 1,
    pieces: [{ size: [T, H, D], pos: [0, 0, 0], kind: 'panel' }],
  },
  {
    partId: 'side-panel-right',
    home: [0.92, H / 2, 0],
    explode: [1.6, 0, 0],
    installStep: 1,
    pieces: [{ size: [T, H, D], pos: [0, 0, 0], kind: 'panel' }],
  },
  {
    partId: 'top-panel',
    home: [0, H - T / 2, 0],
    explode: [0, 1.8, 0],
    installStep: 4,
    pieces: [{ size: [1.84, T, D], pos: [0, 0, 0], kind: 'panel' }],
  },
  {
    partId: 'bottom-panel',
    home: [0, 0.2, 0],
    explode: [0, -1.4, 0],
    installStep: 3,
    pieces: [{ size: [1.76, T, D], pos: [0, 0, 0], kind: 'panel' }],
  },
  {
    partId: 'back-panel',
    home: [0, H / 2, -0.47],
    explode: [0, 0, -1.8],
    installStep: 6,
    pieces: [{ size: [1.95, H - 0.05, 0.03], pos: [0, 0, 0], kind: 'panel' }],
  },
  {
    partId: 'shelf',
    home: [0, 0, 0],
    explode: [0, 0, 1.8],
    installStep: 9,
    pieces: shelfYs.map((y) => ({
      size: [1.76, 0.05, 0.9] as Vec3,
      pos: [0, y, 0.02] as Vec3,
      kind: 'panel' as const,
    })),
  },
  {
    partId: 'wood-dowel',
    home: [0, 0, 0],
    explode: [-1.9, 0.6, 1.2],
    installStep: 2,
    pieces: [...dowelCol(-0.86, -0.35), ...dowelCol(-0.86, 0.35)],
  },
  {
    partId: 'cam-lock',
    home: [0, 0, 0],
    explode: [1.9, -0.4, 1.4],
    installStep: 3,
    pieces: [...camCol(-0.86), ...camCol(0.86)],
  },
  {
    partId: 'cam-screw',
    home: [0, 0, 0],
    explode: [1.9, -0.9, 1.6],
    installStep: 5,
    pieces: [0.2, 3.9].flatMap((y) =>
      [-0.86, 0.86].map((x) => ({
        size: [0.035, 0.18, 0.035] as Vec3,
        pos: [x, y, 0.33] as Vec3,
        kind: 'metal' as const,
        cyl: true,
      })),
    ),
  },
  {
    partId: 'shelf-pin',
    home: [0, 0, 0],
    explode: [1.8, 0.2, 1.4],
    installStep: 8,
    pieces: shelfYs.flatMap((y) =>
      [-0.84, 0.84].flatMap((x) =>
        [-0.3, 0.3].map((z) => ({
          size: [0.03, 0.06, 0.03] as Vec3,
          pos: [x, y - 0.03, z] as Vec3,
          kind: 'metal' as const,
          cyl: true,
        })),
      ),
    ),
  },
  {
    partId: 'back-nail',
    home: [0, 0, 0],
    explode: [0, 0.4, -1.9],
    installStep: 6,
    pieces: [0.5, 1.5, 2.5, 3.4].flatMap((y) =>
      [-0.8, 0, 0.8].map((x) => ({
        size: [0.04, 0.04, 0.04] as Vec3,
        pos: [x, y, -0.46] as Vec3,
        kind: 'metal' as const,
        cyl: true,
      })),
    ),
  },
  {
    partId: 'wall-bracket',
    home: [0, H - 0.02, -0.4],
    explode: [0, 1.2, -1.4],
    installStep: 10,
    pieces: [
      { size: [0.5, 0.06, 0.14], pos: [0, 0.04, 0], kind: 'metal' },
      { size: [0.5, 0.14, 0.04], pos: [0, -0.02, -0.06], kind: 'metal' },
    ],
  },
];
