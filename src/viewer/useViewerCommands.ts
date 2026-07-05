import type { Part } from '../types/assembly';
import manifest from '../data/manifest';

export type Vec3 = [number, number, number];

export interface PartPrimitive {
  id: string;
  shape: 'box' | 'cylinder';
  size: Vec3;
  position: Vec3;
  rotation?: Vec3;
}

export type DetailMaterial = 'edge' | 'shadow' | 'metal' | 'slot' | 'wood';

export interface PartDetailGroup {
  id: string;
  material: DetailMaterial;
  primitives: PartPrimitive[];
}

export interface PartLayout {
  partId: string;
  unlockStep: number;
  visibleFromStep?: number;
  explodedOffset: Vec3;
  role: 'panel' | 'hardware' | 'back' | 'strap';
  stepOffsets?: Record<number, Vec3>;
  primitives: PartPrimitive[];
  details?: PartDetailGroup[];
}

export interface PartPose {
  primitives: PartPrimitive[];
  offset: Vec3;
  visible: boolean;
}

const BOOKCASE_WIDTH = 0.8;
const BOOKCASE_HEIGHT = 4.04;
const BOOKCASE_DEPTH = 0.56;
const BOARD_THICKNESS = 0.055;
const INNER_WIDTH = BOOKCASE_WIDTH - BOARD_THICKNESS * 2;
const SIDE_X = BOOKCASE_WIDTH / 2 - BOARD_THICKNESS / 2;
const CENTER_Y = BOOKCASE_HEIGHT / 2;
const BACK_Z = -BOOKCASE_DEPTH / 2 - 0.018;
const FRONT_EDGE_Z = BOOKCASE_DEPTH / 2 + 0.035;
const SIDE_HARDWARE_X = SIDE_X + 0.035;

const sideName = (side: number) => (side < 0 ? 'left' : 'right');

function box(id: string, size: Vec3, position: Vec3, rotation?: Vec3): PartPrimitive {
  return { id, shape: 'box', size, position, rotation };
}

function cylinder(id: string, size: Vec3, position: Vec3, rotation?: Vec3): PartPrimitive {
  return { id, shape: 'cylinder', size, position, rotation };
}

function makeWoodDowels(): PartPrimitive[] {
  const panelLevels = [
    { id: 'bottom', y: 0.07 },
    { id: 'fixed', y: 2.02 },
    { id: 'top', y: 3.98 }
  ];
  const panelEdges = [
    { id: 'front', z: 0.21 },
    { id: 'back', z: -0.18 }
  ];
  const railHoles = [
    { id: 'upper', y: 0.205 },
    { id: 'lower', y: 0.115 }
  ];

  return [
    ...panelLevels.flatMap((level) =>
      [-1, 1].flatMap((side) =>
        panelEdges.map((edge) =>
          cylinder(
            `dowel-${level.id}-${sideName(side)}-${edge.id}`,
            [0.017, 0.017, 0.18],
            [side * 0.33, level.y, edge.z],
            [0, 0, 1.57]
          )
        )
      )
    ),
    ...[-1, 1].flatMap((side) =>
      railHoles.map((hole) =>
        cylinder(
          `dowel-rail-${sideName(side)}-${hole.id}`,
          [0.017, 0.017, 0.18],
          [side * 0.34, hole.y, FRONT_EDGE_Z],
          [0, 0, 1.57]
        )
      )
    )
  ];
}

function makeCamScrews(): PartPrimitive[] {
  const levels = [
    { id: 'bottom', y: 0.22 },
    { id: 'fixed', y: 2.02 },
    { id: 'top', y: 3.84 }
  ];
  const edges = [
    { id: 'front', z: 0.21 },
    { id: 'back', z: -0.18 }
  ];

  return [-1, 1].flatMap((side) =>
    levels.flatMap((level) =>
      edges.map((edge) =>
        cylinder(
          `cam-screw-${sideName(side)}-${level.id}-${edge.id}`,
          [0.014, 0.014, 0.16],
          [side * SIDE_HARDWARE_X, level.y, edge.z],
          [0, 0, 1.57]
        )
      )
    )
  );
}

function makeCamLocks(): PartPrimitive[] {
  const levels = [
    { id: 'bottom', y: 0.075 },
    { id: 'fixed', y: 2.02 },
    { id: 'top', y: 3.965 }
  ];
  const edges = [
    { id: 'front', z: 0.23 },
    { id: 'back', z: -0.19 }
  ];

  return levels.flatMap((level) =>
    [-1, 1].flatMap((side) =>
      edges.map((edge) =>
        cylinder(
          `cam-lock-${level.id}-${sideName(side)}-${edge.id}`,
          [0.032, 0.032, 0.018],
          [side * 0.29, level.y, edge.z],
          [1.57, 0, 0]
        )
      )
    )
  );
}

function makeBackNails(): PartPrimitive[] {
  const columns = [
    { id: 'left', x: -0.36 },
    { id: 'center', x: 0 },
    { id: 'right', x: 0.36 }
  ];
  const rows = [0.35, 0.95, 1.55, 2.15, 2.75, 3.35];

  return columns.flatMap((column) =>
    rows.map((y, index) =>
      cylinder(
        `back-nail-${column.id}-${index + 1}`,
        [0.011, 0.011, 0.028],
        [column.x, y, BACK_Z - 0.02],
        [1.57, 0, 0]
      )
    )
  );
}

function makeShelfPins(): PartPrimitive[] {
  const levels = [
    { id: 'bottom', y: 0.74 },
    { id: 'low', y: 1.36 },
    { id: 'high', y: 2.68 },
    { id: 'top', y: 3.28 }
  ];
  const edges = [
    { id: 'front', z: 0.18 },
    { id: 'back', z: -0.18 }
  ];

  return levels.flatMap((level) =>
    [-1, 1].flatMap((side) =>
      edges.map((edge) =>
        cylinder(
          `pin-${level.id}-${sideName(side)}-${edge.id}`,
          [0.012, 0.012, 0.1],
          [side * 0.34, level.y, edge.z],
          [0, 0, 1.57]
        )
      )
    )
  );
}

function makeSidePanelCamHoles(side: -1 | 1, prefix: string): PartDetailGroup[] {
  const levels = [
    { id: 'bottom', y: 0.22 },
    { id: 'fixed', y: 2.02 },
    { id: 'top', y: 3.84 }
  ];
  const edges = [
    { id: 'front', z: 0.21 },
    { id: 'back', z: -0.18 }
  ];
  const faceX = side * (SIDE_X - BOARD_THICKNESS / 2 + 0.008);
  const ringX = side * (SIDE_X - BOARD_THICKNESS / 2 + 0.014);

  const holes = levels.flatMap((level) =>
    edges.map((edge) =>
      cylinder(
        `${prefix}-cam-hole-${level.id}-${edge.id}`,
        [0.018, 0.018, 0.012],
        [faceX, level.y, edge.z],
        [0, 0, 1.57]
      )
    )
  );

  const rings = levels.flatMap((level) =>
    edges.map((edge) =>
      cylinder(
        `${prefix}-cam-ring-${level.id}-${edge.id}`,
        [0.024, 0.024, 0.003],
        [ringX, level.y, edge.z],
        [0, 0, 1.57]
      )
    )
  );

  return [
    { id: `${prefix}-cam-holes`, material: 'shadow', primitives: holes },
    { id: `${prefix}-cam-hole-rings`, material: 'wood', primitives: rings }
  ];
}

function makeShelfDowelHoles(prefix: string, y: number, width = INNER_WIDTH): PartDetailGroup[] {
  const edges = [
    { id: 'front', z: 0.21 },
    { id: 'back', z: -0.18 }
  ];

  const holes = [-1, 1].flatMap((side) =>
    edges.map((edge) =>
      cylinder(
        `${prefix}-dowel-hole-${sideName(side)}-${edge.id}`,
        [0.011, 0.011, 0.01],
        [side * (width / 2 - 0.02), y, edge.z],
        [0, 0, 1.57]
      )
    )
  );

  const rings = [-1, 1].flatMap((side) =>
    edges.map((edge) =>
      cylinder(
        `${prefix}-dowel-ring-${sideName(side)}-${edge.id}`,
        [0.016, 0.016, 0.003],
        [side * (width / 2 - 0.02), y, edge.z + 0.006],
        [0, 0, 1.57]
      )
    )
  );

  return [
    { id: `${prefix}-dowel-holes`, material: 'shadow', primitives: holes },
    { id: `${prefix}-dowel-rings`, material: 'wood', primitives: rings }
  ];
}

function makeBackPanelNailGuide(): PartDetailGroup {
  return {
    id: 'back-nail-guide',
    material: 'shadow',
    primitives: [
      box('back-nail-guide-line', [BOOKCASE_WIDTH - 0.08, 0.004, 0.004], [0, 2.02, BACK_Z - 0.008]),
      box('back-nail-guide-left', [0.004, 1.9, 0.004], [-0.36, 2.02, BACK_Z - 0.008]),
      box('back-nail-guide-right', [0.004, 1.9, 0.004], [0.36, 2.02, BACK_Z - 0.008])
    ]
  };
}

function makeSidePanelDetails(side: -1 | 1, prefix: string): PartDetailGroup[] {
  const interiorX = side * (SIDE_X - BOARD_THICKNESS / 2 - 0.002);
  const backGrooveX = side * SIDE_X;
  const shelfPinLevels = [0.74, 1.36, 2.68, 3.28];
  const shelfPinDepths = [0.18, -0.18];

  return [
    ...makeSidePanelCamHoles(side, prefix),
    {
      id: `${prefix}-back-groove`,
      material: 'shadow',
      primitives: [
        box(
          `${prefix}-back-groove-strip`,
          [0.01, BOOKCASE_HEIGHT - 0.18, 0.014],
          [backGrooveX, CENTER_Y, -BOOKCASE_DEPTH / 2 + 0.018]
        )
      ]
    },
    {
      id: `${prefix}-shelf-pin-holes`,
      material: 'shadow',
      primitives: shelfPinLevels.flatMap((y, levelIndex) =>
        shelfPinDepths.map((z, depthIndex) =>
          cylinder(
            `${prefix}-shelf-pin-hole-${levelIndex + 1}-${depthIndex + 1}`,
            [0.014, 0.014, 0.006],
            [interiorX, y, z],
            [0, 0, 1.57]
          )
        )
      )
    }
  ];
}

function makeShelfEdgeDetails(prefix: string, y: number, width = INNER_WIDTH): PartDetailGroup[] {
  return [
    {
      id: `${prefix}-front-edge-band`,
      material: 'edge',
      primitives: [
        box(`${prefix}-front-edge-band`, [width, 0.012, 0.018], [0, y, FRONT_EDGE_Z - 0.012])
      ]
    }
  ];
}

function makeCamScrewDetails(): PartDetailGroup[] {
  const screws = makeCamScrews();
  return [
    {
      id: 'cam-screw-heads',
      material: 'metal',
      primitives: screws.map((primitive) => {
        const side = primitive.position[0] < 0 ? -1 : 1;
        return cylinder(
          `${primitive.id}-head`,
          [0.026, 0.026, 0.014],
          [primitive.position[0] + side * 0.085, primitive.position[1], primitive.position[2]],
          primitive.rotation
        );
      })
    },
    {
      id: 'cam-screw-slots',
      material: 'slot',
      primitives: screws.map((primitive) => {
        const side = primitive.position[0] < 0 ? -1 : 1;
        return box(
          `${primitive.id}-slot`,
          [0.006, 0.006, 0.042],
          [primitive.position[0] + side * 0.093, primitive.position[1], primitive.position[2]]
        );
      })
    }
  ];
}

function makeCamLockDetails(): PartDetailGroup[] {
  return [
    {
      id: 'cam-lock-slots',
      material: 'slot',
      primitives: makeCamLocks().map((primitive) =>
        box(
          `${primitive.id}-slot`,
          [0.044, 0.006, 0.008],
          [primitive.position[0], primitive.position[1], primitive.position[2] + 0.014]
        )
      )
    }
  ];
}

function makeBackNailDetails(): PartDetailGroup[] {
  return [
    {
      id: 'back-nail-heads',
      material: 'metal',
      primitives: makeBackNails().map((primitive) =>
        cylinder(
          `${primitive.id}-head`,
          [0.018, 0.018, 0.008],
          [primitive.position[0], primitive.position[1], primitive.position[2] - 0.006],
          primitive.rotation
        )
      )
    }
  ];
}

function makeWasherDetails(): PartDetailGroup[] {
  return [
    {
      id: 'washer-center-holes',
      material: 'slot',
      primitives: [
        cylinder('washer-left-wall-hole', [0.011, 0.011, 0.009], [-0.28, 4.18, BACK_Z - 0.079], [1.57, 0, 0]),
        cylinder('washer-right-wall-hole', [0.011, 0.011, 0.009], [0.28, 4.18, BACK_Z - 0.079], [1.57, 0, 0]),
        cylinder('washer-left-case-hole', [0.009, 0.009, 0.009], [-0.2, 4.08, BACK_Z - 0.057], [1.57, 0, 0]),
        cylinder('washer-right-case-hole', [0.009, 0.009, 0.009], [0.2, 4.08, BACK_Z - 0.057], [1.57, 0, 0])
      ]
    }
  ];
}

export const partLayouts: Record<string, PartLayout> = {
  'side-panel-left': {
    partId: 'side-panel-left',
    unlockStep: 3,
    visibleFromStep: 2,
    explodedOffset: [-0.64, 0.08, 0.52],
    role: 'panel',
    stepOffsets: {
      3: [-0.08, 0.04, 0.12]
    },
    primitives: [
      box('left-panel', [BOARD_THICKNESS, BOOKCASE_HEIGHT, BOOKCASE_DEPTH], [-SIDE_X, CENTER_Y, 0])
    ],
    details: makeSidePanelDetails(-1, 'left')
  },
  'side-panel-right': {
    partId: 'side-panel-right',
    unlockStep: 6,
    visibleFromStep: 2,
    explodedOffset: [0.7, 0.14, 0.48],
    role: 'panel',
    stepOffsets: {
      6: [0.28, 0.04, 0.18]
    },
    primitives: [
      box('right-panel', [BOARD_THICKNESS, BOOKCASE_HEIGHT, BOOKCASE_DEPTH], [SIDE_X, CENTER_Y, 0])
    ],
    details: makeSidePanelDetails(1, 'right')
  },
  'bottom-panel': {
    partId: 'bottom-panel',
    unlockStep: 3,
    visibleFromStep: 1,
    explodedOffset: [0, -0.42, 0.62],
    role: 'panel',
    stepOffsets: {
      1: [0, -0.08, 0.16],
      3: [0, -0.04, 0.1]
    },
    primitives: [
      box('bottom', [BOOKCASE_WIDTH, BOARD_THICKNESS, BOOKCASE_DEPTH], [0, BOARD_THICKNESS / 2, 0])
    ],
    details: [
      ...makeShelfEdgeDetails('bottom', BOARD_THICKNESS / 2, BOOKCASE_WIDTH),
      ...makeShelfDowelHoles('bottom', BOARD_THICKNESS / 2, BOOKCASE_WIDTH)
    ]
  },
  'top-panel': {
    partId: 'top-panel',
    unlockStep: 3,
    visibleFromStep: 1,
    explodedOffset: [0, 0.82, 0.5],
    role: 'panel',
    stepOffsets: {
      1: [0, 0.08, 0.12],
      3: [0, 0.06, 0.1]
    },
    primitives: [
      box('top', [BOOKCASE_WIDTH, BOARD_THICKNESS, BOOKCASE_DEPTH], [0, BOOKCASE_HEIGHT - BOARD_THICKNESS / 2, 0])
    ],
    details: [
      ...makeShelfEdgeDetails('top', BOOKCASE_HEIGHT - BOARD_THICKNESS / 2, BOOKCASE_WIDTH),
      ...makeShelfDowelHoles('top', BOOKCASE_HEIGHT - BOARD_THICKNESS / 2, BOOKCASE_WIDTH)
    ]
  },
  'fixed-shelf': {
    partId: 'fixed-shelf',
    unlockStep: 3,
    visibleFromStep: 1,
    explodedOffset: [0, 0.12, 0.72],
    role: 'panel',
    stepOffsets: {
      1: [0, 0.03, 0.14],
      3: [0, 0.02, 0.12]
    },
    primitives: [
      box('fixed-shelf', [INNER_WIDTH, BOARD_THICKNESS, BOOKCASE_DEPTH - 0.03], [0, 2.02, 0.015])
    ],
    details: [
      ...makeShelfEdgeDetails('fixed-shelf', 2.02),
      ...makeShelfDowelHoles('fixed-shelf', 2.02)
    ]
  },
  'adjustable-shelf': {
    partId: 'adjustable-shelf',
    unlockStep: 14,
    visibleFromStep: 14,
    explodedOffset: [0, 0.2, 0.86],
    role: 'panel',
    stepOffsets: {
      14: [0, 0.08, 0.16]
    },
    primitives: [
      box('adjustable-bottom', [INNER_WIDTH, 0.05, BOOKCASE_DEPTH - 0.045], [0, 0.74, 0.02]),
      box('adjustable-low', [INNER_WIDTH, 0.05, BOOKCASE_DEPTH - 0.045], [0, 1.36, 0.02]),
      box('adjustable-high', [INNER_WIDTH, 0.05, BOOKCASE_DEPTH - 0.045], [0, 2.68, 0.02]),
      box('adjustable-top', [INNER_WIDTH, 0.05, BOOKCASE_DEPTH - 0.045], [0, 3.28, 0.02])
    ],
    details: [
      ...makeShelfEdgeDetails('adjustable-bottom', 0.74),
      ...makeShelfEdgeDetails('adjustable-low', 1.36),
      ...makeShelfEdgeDetails('adjustable-high', 2.68),
      ...makeShelfEdgeDetails('adjustable-top', 3.28)
    ]
  },
  'front-rail': {
    partId: 'front-rail',
    unlockStep: 5,
    visibleFromStep: 1,
    explodedOffset: [0, -0.24, 0.74],
    role: 'panel',
    stepOffsets: {
      1: [0, -0.04, 0.16],
      5: [0, -0.04, 0.16]
    },
    primitives: [
      box('front-rail', [BOOKCASE_WIDTH, 0.16, 0.05], [0, 0.16, FRONT_EDGE_Z])
    ],
    details: [
      {
        id: 'front-rail-top-edge',
        material: 'edge',
        primitives: [box('front-rail-top-edge', [BOOKCASE_WIDTH, 0.018, 0.01], [0, 0.24, FRONT_EDGE_Z + 0.006])]
      },
      ...makeShelfDowelHoles('front-rail', 0.16, BOOKCASE_WIDTH)
    ]
  },
  'back-panel': {
    partId: 'back-panel',
    unlockStep: 9,
    visibleFromStep: 8,
    explodedOffset: [0, 0.08, -0.78],
    role: 'back',
    stepOffsets: {
      8: [0, 0.03, -0.18],
      9: [0, 0.02, -0.12],
      10: [0, 0.01, -0.04]
    },
    primitives: [
      box('back-lower', [BOOKCASE_WIDTH - 0.03, 1.96, 0.022], [0, 1.02, BACK_Z]),
      box('back-upper', [BOOKCASE_WIDTH - 0.03, 1.96, 0.022], [0, 3.02, BACK_Z])
    ],
    details: [
      {
        id: 'back-panel-fold-line',
        material: 'shadow',
        primitives: [box('back-panel-fold-line', [BOOKCASE_WIDTH - 0.05, 0.014, 0.006], [0, 2.02, BACK_Z - 0.014])]
      },
      makeBackPanelNailGuide()
    ]
  },
  'cam-screw': {
    partId: 'cam-screw',
    unlockStep: 2,
    visibleFromStep: 2,
    explodedOffset: [-0.88, 0.46, 0.82],
    role: 'hardware',
    stepOffsets: {
      2: [-0.08, 0.03, 0.1],
      6: [0.04, 0.03, 0.08]
    },
    primitives: makeCamScrews(),
    details: makeCamScrewDetails()
  },
  'cam-lock': {
    partId: 'cam-lock',
    unlockStep: 4,
    visibleFromStep: 4,
    explodedOffset: [0.92, 0.34, 0.8],
    role: 'hardware',
    stepOffsets: {
      4: [0.04, 0.04, 0.08],
      5: [0.02, 0.02, 0.06],
      7: [0.02, 0.04, 0.08]
    },
    primitives: makeCamLocks(),
    details: makeCamLockDetails()
  },
  'wood-dowel': {
    partId: 'wood-dowel',
    unlockStep: 1,
    visibleFromStep: 1,
    explodedOffset: [0.78, 0.42, 0.62],
    role: 'hardware',
    stepOffsets: {
      1: [0.06, 0.03, 0.08],
      3: [0.03, 0.03, 0.08],
      6: [0.04, 0.04, 0.1]
    },
    primitives: makeWoodDowels()
  },
  'back-nail': {
    partId: 'back-nail',
    unlockStep: 11,
    visibleFromStep: 10,
    explodedOffset: [-0.78, 0.22, -0.92],
    role: 'hardware',
    stepOffsets: {
      10: [0, 0.02, -0.12],
      11: [0, 0.02, -0.08]
    },
    primitives: makeBackNails(),
    details: makeBackNailDetails()
  },
  'shelf-pin': {
    partId: 'shelf-pin',
    unlockStep: 13,
    visibleFromStep: 13,
    explodedOffset: [0.86, 0.12, 0.74],
    role: 'hardware',
    stepOffsets: {
      13: [0.04, 0.02, 0.08]
    },
    primitives: makeShelfPins()
  },
  'wall-bracket': {
    partId: 'wall-bracket',
    unlockStep: 12,
    visibleFromStep: 12,
    explodedOffset: [-0.36, 0.7, -0.92],
    role: 'hardware',
    primitives: [
      box('wall-bracket-left-flat', [0.17, 0.035, 0.018], [-0.2, 4.08, BACK_Z - 0.03]),
      box('wall-bracket-left-up', [0.035, 0.18, 0.018], [-0.28, 4.15, BACK_Z - 0.03]),
      box('wall-bracket-right-flat', [0.17, 0.035, 0.018], [0.2, 4.08, BACK_Z - 0.03]),
      box('wall-bracket-right-up', [0.035, 0.18, 0.018], [0.28, 4.15, BACK_Z - 0.03])
    ]
  },
  'bracket-screw': {
    partId: 'bracket-screw',
    unlockStep: 12,
    visibleFromStep: 12,
    explodedOffset: [0.22, 0.78, -1.0],
    role: 'hardware',
    primitives: [
      cylinder('bracket-screw-left', [0.014, 0.014, 0.03], [-0.28, 4.18, BACK_Z - 0.052], [1.57, 0, 0]),
      cylinder('bracket-screw-right', [0.014, 0.014, 0.03], [0.28, 4.18, BACK_Z - 0.052], [1.57, 0, 0])
    ]
  },
  washer: {
    partId: 'washer',
    unlockStep: 12,
    visibleFromStep: 12,
    explodedOffset: [0.5, 0.68, -0.96],
    role: 'hardware',
    primitives: [
      cylinder('washer-left-wall', [0.026, 0.026, 0.008], [-0.28, 4.18, BACK_Z - 0.074], [1.57, 0, 0]),
      cylinder('washer-right-wall', [0.026, 0.026, 0.008], [0.28, 4.18, BACK_Z - 0.074], [1.57, 0, 0]),
      cylinder('washer-left-case', [0.02, 0.02, 0.008], [-0.2, 4.08, BACK_Z - 0.052], [1.57, 0, 0]),
      cylinder('washer-right-case', [0.02, 0.02, 0.008], [0.2, 4.08, BACK_Z - 0.052], [1.57, 0, 0])
    ],
    details: makeWasherDetails()
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
  const firstVisibleStep = layout.visibleFromStep ?? Math.max(1, layout.unlockStep - 1);
  const stepOffset = layout.stepOffsets?.[currentStep] ?? [0, 0, 0];
  const explodedMultiplier = explodeLevel === 0 ? 0 : explodeLevel === 1 ? 0.45 : 1.0;
  const stepParts = new Set(manifest.steps[currentStep - 1]?.partsNeeded.map((entry) => entry.partId) ?? []);
  const activeThisStep = stepParts.has(partId);

  // Hardware stays in the bin until its install step (GlbModel fly-in handles reveal).
  if (layout.role === 'hardware') {
    if (!assembled && explodeLevel === 0) {
      return { primitives: layout.primitives, offset: [0, 0, 0], visible: false };
    }
    if (assembled) {
      return { primitives: layout.primitives, offset: [0, 0, 0], visible: true };
    }
    const multiplier = explodedMultiplier + 0.85;
    return {
      primitives: layout.primitives,
      offset: [
        layout.explodedOffset[0] * multiplier + stepOffset[0],
        layout.explodedOffset[1] * multiplier + stepOffset[1],
        layout.explodedOffset[2] * multiplier + stepOffset[2]
      ],
      visible: true
    };
  }

  // Progressive view: show installed parts and the current workpiece. Other
  // future panels stay hidden until they are useful or the user explodes the view.
  if (!assembled && !activeThisStep && currentStep < firstVisibleStep && explodeLevel === 0) {
    return { primitives: layout.primitives, offset: [0, 0, 0], visible: false };
  }

  if (assembled && explodeLevel === 0) {
    return { primitives: layout.primitives, offset: [0, 0, 0], visible: true };
  }

  if (explodeLevel > 0) {
    const multiplier = explodedMultiplier + (assembled ? 0 : 0.85);
    return {
      primitives: layout.primitives,
      offset: [
        layout.explodedOffset[0] * multiplier + stepOffset[0],
        layout.explodedOffset[1] * multiplier + stepOffset[1],
        layout.explodedOffset[2] * multiplier + stepOffset[2]
      ],
      visible: true
    };
  }

  // Active work this step: hold at assembly pose (+ small authored nudge).
  if (activeThisStep && !assembled) {
    return { primitives: layout.primitives, offset: stepOffset, visible: true };
  }

  // Waiting off to the side until its step arrives.
  const stagingMultiplier = 0.55;
  return {
    primitives: layout.primitives,
    offset: [
      layout.explodedOffset[0] * stagingMultiplier + stepOffset[0],
      layout.explodedOffset[1] * stagingMultiplier + stepOffset[1],
      layout.explodedOffset[2] * stagingMultiplier + stepOffset[2]
    ],
    visible: true
  };
}
