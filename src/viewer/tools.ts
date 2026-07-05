import type { ToolKind } from '../types/assembly';

export interface ToolSpec {
  id: ToolKind;
  label: string;
  /** Short label for 3D billboard. */
  shortLabel: string;
}

export const toolSpecs: Record<ToolKind, ToolSpec> = {
  hands: { id: 'hands', label: 'Hands', shortLabel: 'HAND' },
  'flat-screwdriver': { id: 'flat-screwdriver', label: 'Flat screwdriver', shortLabel: 'FLAT' },
  phillips: { id: 'phillips', label: 'Phillips screwdriver', shortLabel: 'PHILLIPS' },
  pencil: { id: 'pencil', label: 'Pencil', shortLabel: 'PENCIL' },
  ruler: { id: 'ruler', label: 'Ruler', shortLabel: 'RULER' },
  hammer: { id: 'hammer', label: 'Hammer', shortLabel: 'HAMMER' },
  drill: { id: 'drill', label: 'Drill', shortLabel: 'DRILL' }
};

/** Map free-text manifest `toolNeeded` strings to normalized tool ids. */
export function toolKindFromNeeded(toolNeeded?: string): ToolKind {
  if (!toolNeeded) return 'hands';
  const lower = toolNeeded.toLowerCase();
  if (lower.includes('flat')) return 'flat-screwdriver';
  if (lower.includes('phillips') && lower.includes('drill')) return 'drill';
  if (lower.includes('phillips')) return 'phillips';
  if (lower.includes('hammer')) return 'hammer';
  if (lower.includes('ruler')) return 'ruler';
  if (lower.includes('pencil')) return 'pencil';
  return 'hands';
}
