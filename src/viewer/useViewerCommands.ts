import type { Part } from '../types/assembly';
import manifest from '../data/manifest';
import {
  BACK_Z,
  BOARD_THICKNESS,
  BOOKCASE_DEPTH,
  BOOKCASE_HEIGHT,
  BOOKCASE_WIDTH,
  CENTER_Y,
  FRONT_EDGE_Z,
  INNER_WIDTH,
  SIDE_HARDWARE_X,
  SIDE_X,
  Y_ADJ_SHELVES,
  Y_BACK_FOLD,
  Y_BACK_LOWER,
  Y_BACK_UPPER,
  Y_CAM_LOCK,
  Y_CAM_SCREW,
  Y_DOWEL_PANEL,
  Y_FIXED_SHELF,
  Y_FRONT_RAIL,
  Y_FRONT_RAIL_TOP,
  Y_RAIL_DOWEL_LOWER,
  Y_RAIL_DOWEL_UPPER,
  Y_SHELF_PIN,
  Y_TOP_PANEL,
  Y_WALL,
  Z_BACK_NAIL_ROWS,
  Z_PANEL_EDGE,
  scaleOffset
} from './billyDimensions';
import { hardwareApproachDelta, resolveStepPoseOverride } from './stepPoses';

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
  rotation: Vec3;
  visible: boolean;
}

const sideName = (side: number) => (side < 0 ? 'left' : 'right');

function box(id: string, size: Vec3, position: Vec3, rotation?: Vec3): PartPrimitive {
  return { id, shape: 'box', size, position, rotation };
}

function cylinder(id: string, size: Vec3, position: Vec3, rotation?: Vec3): PartPrimitive {
  return { id, shape: 'cylinder', size, position, rotation };
}

function makeWoodDowels(): PartPrimitive[] {
  const panelLevels = [
    { id: 'bottom', y: Y_DOWEL_PANEL[0] },
    { id: 'fixed', y: Y_DOWEL_PANEL[1] },
    { id: 'top', y: Y_DOWEL_PANEL[2] }
  ];
  const panelEdges = [
    { id: 'front', z: Z_PANEL_EDGE.front },
    { id: 'back', z: Z_PANEL_EDGE.back }
  ];
  const railHoles = [
    { id: 'upper', y: Y_RAIL_DOWEL_UPPER },
    { id: 'lower', y: Y_RAIL_DOWEL_LOWER }
  ];

  return [
    ...panelLevels.flatMap((level) =>
      [-1, 1].flatMap((side) =>
        panelEdges.map((edge) =>
          cylinder(
            `dowel-${level.id}-${sideName(side)}-${edge.id}`,
            [0.008, 0.008, 0.09],
            [side * 0.165, level.y, edge.z],
            [0, 0, 1.57]
          )
        )
      )
    ),
    ...[-1, 1].flatMap((side) =>
      railHoles.map((hole) =>
        cylinder(
          `dowel-rail-${sideName(side)}-${hole.id}`,
          [0.008, 0.008, 0.09],
          [side * 0.17, hole.y, FRONT_EDGE_Z],
          [0, 0, 1.57]
        )
      )
    )
  ];
}

function makeCamScrews(): PartPrimitive[] {
  const levels = [
    { id: 'bottom', y: Y_CAM_SCREW[0] },
    { id: 'fixed', y: Y_CAM_SCREW[1] },
    { id: 'top', y: Y_CAM_SCREW[2] }
  ];
  const edges = [
    { id: 'front', z: Z_PANEL_EDGE.front },
    { id: 'back', z: Z_PANEL_EDGE.back }
  ];

  return [-1, 1].flatMap((side) =>
    levels.flatMap((level) =>
      edges.map((edge) =>
        cylinder(
          `cam-screw-${sideName(side)}-${level.id}-${edge.id}`,
          [0.007, 0.007, 0.08],
          [side * SIDE_HARDWARE_X, level.y, edge.z],
          [0, 0, 1.57]
        )
      )
    )
  );
}

function makeCamLocks(): PartPrimitive[] {
  const levels = [
    { id: 'bottom', y: Y_CAM_LOCK[0] },
    { id: 'fixed', y: Y_CAM_LOCK[1] },
    { id: 'top', y: Y_CAM_LOCK[2] }
  ];
  const edges = [
    { id: 'front', z: Z_PANEL_EDGE.front + 0.012 },
    { id: 'back', z: Z_PANEL_EDGE.back - 0.01 }
  ];

  return levels.flatMap((level) =>
    [-1, 1].flatMap((side) =>
      edges.map((edge) =>
        cylinder(
          `cam-lock-${level.id}-${sideName(side)}-${edge.id}`,
          [0.016, 0.016, 0.009],
          [side * 0.145, level.y, edge.z],
          [1.57, 0, 0]
        )
      )
    )
  );
}

function makeBackNails(): PartPrimitive[] {
  const columns = [
    { id: 'left', x: -0.18 },
    { id: 'center', x: 0 },
    { id: 'right', x: 0.18 }
  ];

  return columns.flatMap((column) =>
    Z_BACK_NAIL_ROWS.map((y, index) =>
      cylinder(
        `back-nail-${column.id}-${index + 1}`,
        [0.0055, 0.0055, 0.014],
        [column.x, y, BACK_Z - 0.01],
        [1.57, 0, 0]
      )
    )
  );
}

function makeShelfPins(): PartPrimitive[] {
  const edges = [
    { id: 'front', z: 0.09 },
    { id: 'back', z: -0.09 }
  ];

  return Y_SHELF_PIN.flatMap((y, levelIndex) =>
    [-1, 1].flatMap((side) =>
      edges.map((edge) =>
        cylinder(
          `pin-${['bottom', 'low', 'high', 'top'][levelIndex]}-${sideName(side)}-${edge.id}`,
          [0.006, 0.006, 0.05],
          [side * 0.17, y, edge.z],
          [0, 0, 1.57]
        )
      )
    )
  );
}

function makeSidePanelCamHoles(side: -1 | 1, prefix: string): PartDetailGroup[] {
  const levels = [
    { id: 'bottom', y: Y_CAM_SCREW[0] },
    { id: 'fixed', y: Y_CAM_SCREW[1] },
    { id: 'top', y: Y_CAM_SCREW[2] }
  ];
  const edges = [
    { id: 'front', z: Z_PANEL_EDGE.front },
    { id: 'back', z: Z_PANEL_EDGE.back }
  ];
  const faceX = side * (SIDE_X - BOARD_THICKNESS / 2 + 0.004);
  const ringX = side * (SIDE_X - BOARD_THICKNESS / 2 + 0.007);

  const holes = levels.flatMap((level) =>
    edges.map((edge) =>
      cylinder(
        `${prefix}-cam-hole-${level.id}-${edge.id}`,
        [0.009, 0.009, 0.006],
        [faceX, level.y, edge.z],
        [0, 0, 1.57]
      )
    )
  );

  const rings = levels.flatMap((level) =>
    edges.map((edge) =>
      cylinder(
        `${prefix}-cam-ring-${level.id}-${edge.id}`,
        [0.012, 0.012, 0.0015],
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
    { id: 'front', z: Z_PANEL_EDGE.front },
    { id: 'back', z: Z_PANEL_EDGE.back }
  ];

  const holes = [-1, 1].flatMap((side) =>
    edges.map((edge) =>
      cylinder(
        `${prefix}-dowel-hole-${sideName(side)}-${edge.id}`,
        [0.0055, 0.0055, 0.005],
        [side * (width / 2 - 0.01), y, edge.z],
        [0, 0, 1.57]
      )
    )
  );

  const rings = [-1, 1].flatMap((side) =>
    edges.map((edge) =>
      cylinder(
        `${prefix}-dowel-ring-${sideName(side)}-${edge.id}`,
        [0.008, 0.008, 0.0015],
        [side * (width / 2 - 0.01), y, edge.z + 0.003],
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
      box('back-nail-guide-line', [BOOKCASE_WIDTH - 0.04, 0.002, 0.002], [0, Y_BACK_FOLD, BACK_Z - 0.004]),
      box('back-nail-guide-left', [0.002, 0.95, 0.002], [-0.18, Y_BACK_FOLD, BACK_Z - 0.004]),
      box('back-nail-guide-right', [0.002, 0.95, 0.002], [0.18, Y_BACK_FOLD, BACK_Z - 0.004])
    ]
  };
}

function makeSidePanelDetails(side: -1 | 1, prefix: string): PartDetailGroup[] {
  const interiorX = side * (SIDE_X - BOARD_THICKNESS / 2 - 0.001);
  const backGrooveX = side * SIDE_X;
  const shelfPinDepths = [0.09, -0.09];

  return [
    ...makeSidePanelCamHoles(side, prefix),
    {
      id: `${prefix}-back-groove`,
      material: 'shadow',
      primitives: [
        box(
          `${prefix}-back-groove-strip`,
          [0.005, BOOKCASE_HEIGHT - 0.09, 0.007],
          [backGrooveX, CENTER_Y, -BOOKCASE_DEPTH / 2 + 0.009]
        )
      ]
    },
    {
      id: `${prefix}-shelf-pin-holes`,
      material: 'shadow',
      primitives: Y_SHELF_PIN.flatMap((y, levelIndex) =>
        shelfPinDepths.map((z, depthIndex) =>
          cylinder(
            `${prefix}-shelf-pin-hole-${levelIndex + 1}-${depthIndex + 1}`,
            [0.007, 0.007, 0.003],
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
        cylinder('washer-left-wall-hole', [0.0055, 0.0055, 0.0045], [-0.14, Y_WALL, BACK_Z - 0.04], [1.57, 0, 0]),
        cylinder('washer-right-wall-hole', [0.0055, 0.0055, 0.0045], [0.14, Y_WALL, BACK_Z - 0.04], [1.57, 0, 0]),
        cylinder('washer-left-case-hole', [0.0045, 0.0045, 0.0045], [-0.1, Y_WALL - 0.1, BACK_Z - 0.028], [1.57, 0, 0]),
        cylinder('washer-right-case-hole', [0.0045, 0.0045, 0.0045], [0.1, Y_WALL - 0.1, BACK_Z - 0.028], [1.57, 0, 0])
      ]
    }
  ];
}

export const partLayouts: Record<string, PartLayout> = {
  'side-panel-left': {
    partId: 'side-panel-left',
    unlockStep: 3,
    visibleFromStep: 2,
    explodedOffset: [-0.32, 0.04, 0.26],
    role: 'panel',
    stepOffsets: {
      3: [-0.04, 0.02, 0.06]
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
    explodedOffset: [0.35, 0.07, 0.24],
    role: 'panel',
    stepOffsets: {
      6: [0.14, 0.02, 0.09]
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
    explodedOffset: [0, -0.21, 0.31],
    role: 'panel',
    stepOffsets: {
      1: [0, -0.04, 0.08],
      3: [0, -0.02, 0.05]
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
    explodedOffset: [0, 0.41, 0.25],
    role: 'panel',
    stepOffsets: {
      1: [0, 0.04, 0.06],
      3: [0, 0.03, 0.05]
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
    explodedOffset: [0, 0.06, 0.36],
    role: 'panel',
    stepOffsets: {
      1: [0, 0.015, 0.07],
      3: [0, 0.01, 0.06]
    },
    primitives: [
      box('fixed-shelf', [INNER_WIDTH, BOARD_THICKNESS, BOOKCASE_DEPTH - 0.015], [0, Y_FIXED_SHELF, 0.008])
    ],
    details: [
      ...makeShelfEdgeDetails('fixed-shelf', Y_FIXED_SHELF),
      ...makeShelfDowelHoles('fixed-shelf', Y_FIXED_SHELF)
    ]
  },
  'adjustable-shelf': {
    partId: 'adjustable-shelf',
    unlockStep: 14,
    visibleFromStep: 14,
    explodedOffset: [0, 0.1, 0.43],
    role: 'panel',
    stepOffsets: {
      14: [0, 0.04, 0.08]
    },
    primitives: [
      box('adjustable-bottom', [INNER_WIDTH, BOARD_THICKNESS, BOOKCASE_DEPTH - 0.022], [0, Y_ADJ_SHELVES[0], 0.01]),
      box('adjustable-low', [INNER_WIDTH, BOARD_THICKNESS, BOOKCASE_DEPTH - 0.022], [0, Y_ADJ_SHELVES[1], 0.01]),
      box('adjustable-high', [INNER_WIDTH, BOARD_THICKNESS, BOOKCASE_DEPTH - 0.022], [0, Y_ADJ_SHELVES[2], 0.01]),
      box('adjustable-top', [INNER_WIDTH, BOARD_THICKNESS, BOOKCASE_DEPTH - 0.022], [0, Y_ADJ_SHELVES[3], 0.01])
    ],
    details: [
      ...makeShelfEdgeDetails('adjustable-bottom', Y_ADJ_SHELVES[0]),
      ...makeShelfEdgeDetails('adjustable-low', Y_ADJ_SHELVES[1]),
      ...makeShelfEdgeDetails('adjustable-high', Y_ADJ_SHELVES[2]),
      ...makeShelfEdgeDetails('adjustable-top', Y_ADJ_SHELVES[3])
    ]
  },
  'front-rail': {
    partId: 'front-rail',
    unlockStep: 5,
    visibleFromStep: 1,
    explodedOffset: [0, -0.12, 0.37],
    role: 'panel',
    stepOffsets: {
      1: [0, -0.02, 0.08],
      5: [0, -0.02, 0.08]
    },
    primitives: [
      box('front-rail', [BOOKCASE_WIDTH, 0.08, 0.025], [0, Y_FRONT_RAIL, FRONT_EDGE_Z])
    ],
    details: [
      {
        id: 'front-rail-top-edge',
        material: 'edge',
        primitives: [box('front-rail-top-edge', [BOOKCASE_WIDTH, 0.009, 0.005], [0, Y_FRONT_RAIL_TOP, FRONT_EDGE_Z + 0.003])]
      },
      ...makeShelfDowelHoles('front-rail', Y_FRONT_RAIL, BOOKCASE_WIDTH)
    ]
  },
  'back-panel': {
    partId: 'back-panel',
    unlockStep: 9,
    visibleFromStep: 8,
    explodedOffset: [0, 0.04, -0.39],
    role: 'back',
    stepOffsets: {
      8: [0, 0.015, -0.09],
      9: [0, 0.01, -0.06],
      10: [0, 0.005, -0.02]
    },
    primitives: [
      box('back-lower', [BOOKCASE_WIDTH - 0.015, 0.98, 0.011], [0, Y_BACK_LOWER, BACK_Z]),
      box('back-upper', [BOOKCASE_WIDTH - 0.015, 0.98, 0.011], [0, Y_BACK_UPPER, BACK_Z])
    ],
    details: [
      {
        id: 'back-panel-fold-line',
        material: 'shadow',
        primitives: [box('back-panel-fold-line', [BOOKCASE_WIDTH - 0.025, 0.007, 0.003], [0, Y_BACK_FOLD, BACK_Z - 0.007])]
      },
      makeBackPanelNailGuide()
    ]
  },
  'cam-screw': {
    partId: 'cam-screw',
    unlockStep: 2,
    visibleFromStep: 2,
    explodedOffset: [-0.44, 0.23, 0.41],
    role: 'hardware',
    stepOffsets: {
      2: [-0.04, 0.015, 0.05],
      6: [0.02, 0.015, 0.04]
    },
    primitives: makeCamScrews(),
    details: makeCamScrewDetails()
  },
  'cam-lock': {
    partId: 'cam-lock',
    unlockStep: 4,
    visibleFromStep: 4,
    explodedOffset: [0.46, 0.17, 0.4],
    role: 'hardware',
    stepOffsets: {
      4: [0.02, 0.02, 0.04],
      5: [0.01, 0.01, 0.03],
      7: [0.01, 0.02, 0.04]
    },
    primitives: makeCamLocks(),
    details: makeCamLockDetails()
  },
  'wood-dowel': {
    partId: 'wood-dowel',
    unlockStep: 1,
    visibleFromStep: 1,
    explodedOffset: [0.39, 0.21, 0.31],
    role: 'hardware',
    stepOffsets: {
      1: [0.03, 0.015, 0.04],
      3: [0.015, 0.015, 0.04],
      6: [0.02, 0.02, 0.05]
    },
    primitives: makeWoodDowels()
  },
  'back-nail': {
    partId: 'back-nail',
    unlockStep: 11,
    visibleFromStep: 10,
    explodedOffset: [-0.39, 0.11, -0.46],
    role: 'hardware',
    stepOffsets: {
      10: [0, 0.01, -0.06],
      11: [0, 0.01, -0.04]
    },
    primitives: makeBackNails(),
    details: makeBackNailDetails()
  },
  'shelf-pin': {
    partId: 'shelf-pin',
    unlockStep: 13,
    visibleFromStep: 13,
    explodedOffset: [0.43, 0.06, 0.37],
    role: 'hardware',
    stepOffsets: {
      13: [0.02, 0.01, 0.04]
    },
    primitives: makeShelfPins()
  },
  'wall-bracket': {
    partId: 'wall-bracket',
    unlockStep: 12,
    visibleFromStep: 12,
    explodedOffset: [-0.18, 0.35, -0.46],
    role: 'hardware',
    primitives: [
      box('wall-bracket-left-flat', [0.085, 0.019, 0.01], [-0.1, Y_WALL - 0.1, BACK_Z - 0.015]),
      box('wall-bracket-left-up', [0.019, 0.09, 0.01], [-0.14, Y_WALL - 0.03, BACK_Z - 0.015]),
      box('wall-bracket-right-flat', [0.085, 0.019, 0.01], [0.1, Y_WALL - 0.1, BACK_Z - 0.015]),
      box('wall-bracket-right-up', [0.019, 0.09, 0.01], [0.14, Y_WALL - 0.03, BACK_Z - 0.015])
    ]
  },
  'bracket-screw': {
    partId: 'bracket-screw',
    unlockStep: 12,
    visibleFromStep: 12,
    explodedOffset: [0.11, 0.39, -0.5],
    role: 'hardware',
    primitives: [
      cylinder('bracket-screw-left', [0.007, 0.007, 0.015], [-0.14, Y_WALL, BACK_Z - 0.026], [1.57, 0, 0]),
      cylinder('bracket-screw-right', [0.007, 0.007, 0.015], [0.14, Y_WALL, BACK_Z - 0.026], [1.57, 0, 0])
    ]
  },
  washer: {
    partId: 'washer',
    unlockStep: 12,
    visibleFromStep: 12,
    explodedOffset: [0.25, 0.34, -0.48],
    role: 'hardware',
    primitives: [
      cylinder('washer-left-wall', [0.013, 0.013, 0.004], [-0.14, Y_WALL, BACK_Z - 0.037], [1.57, 0, 0]),
      cylinder('washer-right-wall', [0.013, 0.013, 0.004], [0.14, Y_WALL, BACK_Z - 0.037], [1.57, 0, 0]),
      cylinder('washer-left-case', [0.01, 0.01, 0.004], [-0.1, Y_WALL - 0.1, BACK_Z - 0.026], [1.57, 0, 0]),
      cylinder('washer-right-case', [0.01, 0.01, 0.004], [0.1, Y_WALL - 0.1, BACK_Z - 0.026], [1.57, 0, 0])
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
    return { primitives: [], offset: [0, 0, 0], rotation: [0, 0, 0], visible: false };
  }

  const assembled = currentStep >= layout.unlockStep;
  const hardwareSeated = currentStep > layout.unlockStep;
  const firstVisibleStep = layout.visibleFromStep ?? Math.max(1, layout.unlockStep - 1);
  const stepOffset = layout.stepOffsets?.[currentStep] ?? [0, 0, 0];
  const explodedMultiplier = explodeLevel === 0 ? 0 : explodeLevel === 1 ? 0.45 : 1.0;
  const stepParts = new Set(manifest.steps[currentStep - 1]?.partsNeeded.map((entry) => entry.partId) ?? []);
  const activeThisStep = stepParts.has(partId);
  const highlightedThisStep =
    manifest.steps[currentStep - 1]?.highlightParts.includes(partId) ?? false;

  const finalize = (pose: Omit<PartPose, 'rotation'> & { rotation?: Vec3 }): PartPose => {
    const base: PartPose = {
      primitives: pose.primitives,
      offset: pose.offset,
      rotation: pose.rotation ?? [0, 0, 0],
      visible: pose.visible
    };
    const override = resolveStepPoseOverride(partId, currentStep, base.offset);
    if (!override) {
      return base;
    }
    return {
      ...base,
      offset: override.offset ?? base.offset,
      rotation: override.rotation ?? base.rotation
    };
  };

  if (layout.role === 'hardware') {
    if (!hardwareSeated && explodeLevel === 0) {
      // On the install step, keep bulk hardware out of the scene — indicators show targets.
      if (currentStep === layout.unlockStep && activeThisStep) {
        return finalize({ primitives: layout.primitives, offset: [0, 0, 0], visible: false });
      }
      return finalize({ primitives: layout.primitives, offset: [0, 0, 0], visible: false });
    }
    if (hardwareSeated) {
      return finalize({ primitives: layout.primitives, offset: [0, 0, 0], visible: true });
    }
    const multiplier = explodedMultiplier + 0.85;
    return finalize({
      primitives: layout.primitives,
      offset: [
        layout.explodedOffset[0] * multiplier + stepOffset[0],
        layout.explodedOffset[1] * multiplier + stepOffset[1],
        layout.explodedOffset[2] * multiplier + stepOffset[2]
      ],
      visible: true
    });
  }

  if (!assembled && !activeThisStep && currentStep < firstVisibleStep && explodeLevel === 0) {
    return finalize({ primitives: layout.primitives, offset: [0, 0, 0], visible: false });
  }

  if (assembled && explodeLevel === 0) {
    return finalize({ primitives: layout.primitives, offset: [0, 0, 0], visible: true });
  }

  if (explodeLevel > 0) {
    const multiplier = explodedMultiplier + (assembled ? 0 : 0.85);
    return finalize({
      primitives: layout.primitives,
      offset: [
        layout.explodedOffset[0] * multiplier + stepOffset[0],
        layout.explodedOffset[1] * multiplier + stepOffset[1],
        layout.explodedOffset[2] * multiplier + stepOffset[2]
      ],
      visible: true
    });
  }

  if (activeThisStep && !assembled) {
    return finalize({ primitives: layout.primitives, offset: stepOffset, visible: true });
  }

  // Floor staging for panels early in the build — only when relevant to this step
  if (layout.role === 'panel' && currentStep <= 6 && explodeLevel === 0 && (activeThisStep || highlightedThisStep)) {
    return finalize({
      primitives: layout.primitives,
      offset: scaleOffset(layout.explodedOffset, 0.35),
      visible: true
    });
  }

  if (explodeLevel === 0 && !activeThisStep && !highlightedThisStep && currentStep < layout.unlockStep) {
    return finalize({ primitives: layout.primitives, offset: [0, 0, 0], visible: false });
  }

  const stagingMultiplier = 0.45;
  return finalize({
    primitives: layout.primitives,
    offset: [
      layout.explodedOffset[0] * stagingMultiplier + stepOffset[0],
      layout.explodedOffset[1] * stagingMultiplier + stepOffset[1],
      layout.explodedOffset[2] * stagingMultiplier + stepOffset[2]
    ],
    visible: true
  });
}
