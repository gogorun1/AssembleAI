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
    expect(resolvePartIdForNode('cam_screw', manifest.parts)).toBe('cam-screw');
    expect(resolvePartIdForNode('back_nail', manifest.parts)).toBe('back-nail');
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

  it('keeps obsolete demo part names out of the viewer map', () => {
    expect(partLayouts['cam-screw-washer']).toBeUndefined();
    expect(partLayouts['assembly-screw']).toBeUndefined();
    expect(partLayouts['back-clip']).toBeUndefined();
  });
});

describe('official hardware quantities', () => {
  it('visualizes the hardware counts from the IKEA parts page', () => {
    expect(partLayouts['wood-dowel'].primitives).toHaveLength(16);
    expect(partLayouts['cam-screw'].primitives).toHaveLength(12);
    expect(partLayouts['cam-lock'].primitives).toHaveLength(12);
    expect(partLayouts['back-nail'].primitives).toHaveLength(18);
    expect(partLayouts['shelf-pin'].primitives).toHaveLength(16);
    expect(partLayouts['bracket-screw'].primitives).toHaveLength(2);
    expect(partLayouts.washer.primitives).toHaveLength(4);
  });

  it('adds realistic detail meshes without changing official item counts', () => {
    expect(partLayouts['side-panel-left'].details?.map((detail) => detail.id)).toEqual(
      expect.arrayContaining(['left-back-groove', 'left-shelf-pin-holes'])
    );
    expect(partLayouts['cam-screw'].details?.map((detail) => detail.id)).toEqual(
      expect.arrayContaining(['cam-screw-heads', 'cam-screw-slots'])
    );
    expect(partLayouts['cam-lock'].details?.map((detail) => detail.id)).toEqual(
      expect.arrayContaining(['cam-lock-slots'])
    );
    expect(partLayouts['back-nail'].details?.map((detail) => detail.id)).toEqual(
      expect.arrayContaining(['back-nail-heads'])
    );
  });
});

describe('step poses', () => {
  it('seats a part at its base once its unlock step is reached without exploding', () => {
    const pose = derivePartPose('side-panel-left', 5, 0);
    expect(pose.offset).toEqual([0, 0, 0]);
    expect(pose.visible).toBe(true);
  });

  it('hides not-yet-installed parts until their unlock step', () => {
    expect(derivePartPose('bottom-panel', 2, 0).visible).toBe(false);
    expect(derivePartPose('bottom-panel', 3, 0).visible).toBe(true);
    expect(derivePartPose('bottom-panel', 3, 0).offset).toEqual([0, 0, 0]);
  });

  it('shows pulled-apart parts only in explode mode', () => {
    const pose = derivePartPose('bottom-panel', 2, 1);
    expect(pose.visible).toBe(true);
    expect(pose.offset).not.toEqual([0, 0, 0]);
  });
});
