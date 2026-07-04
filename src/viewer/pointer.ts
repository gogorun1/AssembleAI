/**
 * Tiny shared pointer tracker so 3D click handlers can tell a genuine tap from
 * an orbit drag. Without this, starting a camera drag on a part/bin mesh would
 * fire its selection handler and yank the camera to a preset.
 */
const down = { x: 0, y: 0 };

export function markPointerDown(x: number, y: number): void {
  down.x = x;
  down.y = y;
}

export function isTap(x: number, y: number, threshold = 6): boolean {
  return Math.hypot(x - down.x, y - down.y) <= threshold;
}
