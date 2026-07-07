/**
 * Real-world BILLY 40×28×202 cm — single source of truth (metres).
 * Imported by useViewerCommands.ts (Vite) and model-billy.mjs (Node).
 */
export const BOOKCASE_WIDTH = 0.4;
export const BOOKCASE_DEPTH = 0.28;
export const BOOKCASE_HEIGHT = 2.02;
export const BOARD_THICKNESS = 0.018;

export const INNER_WIDTH = BOOKCASE_WIDTH - BOARD_THICKNESS * 2;
export const SIDE_X = BOOKCASE_WIDTH / 2 - BOARD_THICKNESS / 2;
export const CENTER_Y = BOOKCASE_HEIGHT / 2;
export const BACK_Z = -BOOKCASE_DEPTH / 2 - 0.009;
export const FRONT_EDGE_Z = BOOKCASE_DEPTH / 2 + 0.018;
export const SIDE_HARDWARE_X = SIDE_X + 0.018;

export const Y_BOTTOM_PANEL = BOARD_THICKNESS / 2;
export const Y_FIXED_SHELF = 1.01;
export const Y_TOP_PANEL = BOOKCASE_HEIGHT - BOARD_THICKNESS / 2;
export const Y_FRONT_RAIL = 0.08;
export const Y_FRONT_RAIL_TOP = 0.12;
export const Y_RAIL_DOWEL_UPPER = 0.1025;
export const Y_RAIL_DOWEL_LOWER = 0.0575;
export const Y_BACK_LOWER = 0.51;
export const Y_BACK_UPPER = 1.51;
export const Y_BACK_FOLD = 1.01;
export const Y_ADJ_SHELVES = [0.37, 0.68, 1.34, 1.64];
export const Y_SHELF_PIN = [0.37, 0.68, 1.34, 1.64];
export const Y_CAM_SCREW = [0.11, 1.01, 1.92];
export const Y_CAM_LOCK = [0.0375, 1.01, 1.9825];
export const Y_DOWEL_PANEL = [0.035, 1.01, 1.99];
export const Y_WALL = BOOKCASE_HEIGHT - 0.14;
export const Z_PANEL_EDGE = { front: 0.105, back: -0.09 };
export const Z_BACK_NAIL_ROWS = [0.175, 0.475, 0.775, 1.075, 1.375, 1.675];

/** Floor work-mat anchor for pre-assembly staging. */
export const WORK_MAT = [-0.22, 0, 0.18];

/** Drop from assembled centre to floor when a panel lies flat. */
export const FLOOR_DROP_Y = BOARD_THICKNESS / 2 - CENTER_Y;

export function scaleOffset([x, y, z]: [number, number, number], factor = 0.5): [number, number, number] {
  return [x * factor, y * factor, z * factor];
}
