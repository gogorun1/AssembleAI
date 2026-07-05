import * as THREE from 'three';

export function isDecorativePickTarget(object: THREE.Object3D): boolean {
  return Boolean(
    object.userData?.isOutline ||
    object.userData?.isDetail ||
    object.userData?.isSlotGhost ||
    object.userData?.isOperationGhost ||
    object.userData?.binId ||
    object.userData?.pickable === false
  );
}

export function resolvePickablePartId(object: THREE.Object3D | null): string | undefined {
  let cursor: THREE.Object3D | null = object;

  while (cursor) {
    if (isDecorativePickTarget(cursor)) {
      return undefined;
    }

    if (cursor.userData?.pickable === true && typeof cursor.userData.partId === 'string') {
      return cursor.userData.partId as string;
    }

    cursor = cursor.parent;
  }

  return undefined;
}
