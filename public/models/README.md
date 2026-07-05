# Furniture GLB assets

Runtime 3D assets live here. The viewer loads the path declared in each
manifest under `model.glbPath` (for BILLY: `/models/billy.glb`).

## Current asset

`billy.glb` is generated from the manifest by:

```bash
npm run model:billy
```

The generator (`scripts/model-billy.mjs`) reads `src/data/billy.manifest.json`
and emits one named node per part, so node names always match the manifest.

## Node naming contract

- Each part gets a node whose name equals `part.meshName`
  (e.g. `side_panel_left`, `cam_screw`).
- Sub-meshes may be suffixed (`side_panel_left_0`); the loader walks up to the
  named parent to resolve the owning part.
- The loader also accepts any alias listed in `part.meshNodes` and common
  casing variants (PascalCase, hyphen/underscore swaps).

## Replacing with a real modeled/exported GLB

1. Model the bookcase with one node (or group) per manifest part.
2. Name each node using `meshName` or add the real names to `meshNodes`.
3. Bake transforms and normalize scale to meters.
4. Export a single optimized `.glb` (Draco/meshopt optional) to this folder.
5. Verify mapping in the browser with `?meshDebug=1` (see docs/specs).

If the GLB is missing or fails to load, the viewer automatically falls back to
the built-in three.js primitive bookcase, so the demo never breaks.
