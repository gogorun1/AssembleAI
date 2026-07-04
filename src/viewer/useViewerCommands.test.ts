import { describe, expect, it } from 'vitest';
import manifest from '../data/manifest';
import { derivePartPose, partLayouts, resolvePartIdForNode } from './useViewerCommands';

describe('mesh node mapping', () => {
  it('maps every manifest part to a layout entry', () => {
    for (const part of manifest.parts) {
      expect(partLayouts[part.id], `layout for ${part.id}`).toBeTruthy();
    }
  });

  it('resolves exact GLB node names to part ids', () => {
    expect(resolvePartIdForNode('side_panel_left', manifest.parts)).toBe('side-panel-left');
    expect(resolvePartIdForNode('cam_screw_washer', manifest.parts)).toBe('cam-screw-washer');
    expect(resolvePartIdForNode('back_panel', manifest.parts)).toBe('back-panel');
  });

  it('resolves suffixed and cased node names', () => {
    expect(resolvePartIdForNode('side_panel_left_0', manifest.parts)).toBe('side-panel-left');
    expect(resolvePartIdForNode('CamLock', manifest.parts)).toBe('cam-lock');
    expect(resolvePartIdForNode('AdjustableShelf', manifest.parts)).toBe('adjustable-shelf');
  });

  it('returns undefined for unrelated node names', () => {
    expect(resolvePartIdForNode('Light', manifest.parts)).toBeUndefined();
    expect(resolvePartIdForNode('', manifest.parts)).toBeUndefined();
  });
});

describe('step poses', () => {
  it('seats a part at its base once its unlock step is reached without exploding', () => {
    const pose = derivePartPose('side-panel-left', 5, 0);
    expect(pose.offset).toEqual([0, 0, 0]);
    expect(pose.visible).toBe(true);
  });

  it('applies an authored step offset during the active assembly step', () => {
    const pose = derivePartPose('bottom-panel', 2, 0);
    expect(pose.offset).not.toEqual([0, 0, 0]);
    expect(pose.visible).toBe(true);
  });
});
