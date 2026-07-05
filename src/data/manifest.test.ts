import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import manifest from './manifest';
import { resolveStepOperations } from '../viewer/stepOperations';

function focusedCameraForView(viewKey: string, focusScale: number): THREE.PerspectiveCamera {
  const view = manifest.cameraViews[viewKey];
  const camera = new THREE.PerspectiveCamera(38, 657 / 449, 0.1, 80);
  const target = new THREE.Vector3(...view.target);
  const position = new THREE.Vector3(...view.position)
    .sub(target)
    .multiplyScalar(focusScale)
    .add(target);

  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function operationLabelAnchor(stepIndex: number): THREE.Vector3 {
  const [operation] = resolveStepOperations(stepIndex, stepIndex, 0);
  const normal = new THREE.Vector3(...operation.normal);
  return new THREE.Vector3(...operation.anchor).add(
    new THREE.Vector3(normal.x * 0.16 + 0.08, 0.22, normal.z * 0.16 + 0.06)
  );
}

describe('billy assembly manifest', () => {
  it('contains the official BILLY AA-1823127-9-2 walkthrough', () => {
    expect(manifest.id).toBe('billy-bookcase');
    expect(manifest.name).toContain('40x28x202');
    expect(manifest.steps).toHaveLength(14);
    expect(manifest.parts.map((part) => part.id)).not.toContain('back-clip');
    expect(manifest.steps.filter((step) => step.commonMistake).length).toBeGreaterThanOrEqual(10);
  });

  it('uses valid part and camera references for every step', () => {
    const partIds = new Set(manifest.parts.map((part) => part.id));
    const viewKeys = new Set(Object.keys(manifest.cameraViews));

    for (const step of manifest.steps) {
      expect(viewKeys.has(step.cameraView), `${step.title} camera`).toBe(true);
      for (const part of step.partsNeeded) {
        expect(partIds.has(part.partId), `${step.title} part ${part.partId}`).toBe(true);
      }
      for (const partId of step.highlightParts) {
        expect(partIds.has(partId), `${step.title} highlight ${partId}`).toBe(true);
      }
    }
  });

  it('matches the official hardware codes and quantities from page 6', () => {
    const expectedHardware = new Map([
      ['118331', { id: 'cam-screw', quantity: 12 }],
      ['101351', { id: 'wood-dowel', quantity: 16 }],
      ['101201', { id: 'back-nail', quantity: 18 }],
      ['119081', { id: 'cam-lock', quantity: 12 }],
      ['131372', { id: 'shelf-pin', quantity: 16 }],
      ['106989', { id: 'wall-bracket', quantity: 2 }],
      ['109041', { id: 'bracket-screw', quantity: 2 }],
      ['100823', { id: 'washer', quantity: 4 }]
    ]);

    for (const [code, expected] of expectedHardware) {
      const part = manifest.parts.find((candidate) => candidate.code === code);
      expect(part?.id, code).toBe(expected.id);
      expect(part?.quantity, code).toBe(expected.quantity);
    }
  });

  it('tracks the official fourteen instruction panels in order', () => {
    expect(manifest.steps.map((step) => step.title)).toEqual([
      'Insert the wood dowels',
      'Install the cam screws',
      'Seat the shelves on the first side',
      'Lock the first four cams',
      'Fit the front rail',
      'Lower the second side panel',
      'Lock the remaining cams',
      'Mark the back panel line',
      'Slide in the folded back panel',
      'Rule the nail guide line',
      'Nail the back panel',
      'Install the wall brackets',
      'Insert the shelf pins',
      'Place the adjustable shelves'
    ]);

    expect(manifest.steps[0].partsNeeded).toEqual(
      expect.arrayContaining([
        { partId: 'wood-dowel', quantity: 16 },
        { partId: 'front-rail', quantity: 1 }
      ])
    );
    expect(manifest.steps[10].partsNeeded).toContainEqual({ partId: 'back-nail', quantity: 18 });
    expect(manifest.steps[11].partsNeeded).toEqual(
      expect.arrayContaining([
        { partId: 'wall-bracket', quantity: 2 },
        { partId: 'bracket-screw', quantity: 2 },
        { partId: 'washer', quantity: 4 }
      ])
    );
  });

  it('keeps the first-step common mistake operation label inside the narrow viewer frame', () => {
    const camera = focusedCameraForView('dowel-prep', 0.76);
    const projected = operationLabelAnchor(1).project(camera);

    expect(projected.y).toBeGreaterThan(-0.35);
  });
});
