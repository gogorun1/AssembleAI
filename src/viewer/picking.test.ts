import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resolvePickablePartId } from './picking';

describe('viewer picking', () => {
  it('ignores decorative children even when their parent belongs to a part', () => {
    const partGroup = new THREE.Group();
    partGroup.userData.partId = 'cam-screw';

    const outline = new THREE.LineSegments();
    outline.userData.isOutline = true;
    partGroup.add(outline);

    expect(resolvePickablePartId(outline)).toBeUndefined();
  });

  it('returns the nearest explicit pickable part mesh', () => {
    const partGroup = new THREE.Group();
    partGroup.userData.partId = 'cam-screw';

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.userData.partId = 'cam-screw';
    mesh.userData.pickable = true;
    partGroup.add(mesh);

    expect(resolvePickablePartId(mesh)).toBe('cam-screw');
  });

  it('does not treat tray or ghost markers as part selections', () => {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    tray.userData.binId = 'bin-cam-screws';
    tray.userData.pickable = false;

    const marker = new THREE.Mesh(new THREE.SphereGeometry(1));
    marker.userData.isSlotGhost = true;

    expect(resolvePickablePartId(tray)).toBeUndefined();
    expect(resolvePickablePartId(marker)).toBeUndefined();
  });
});
