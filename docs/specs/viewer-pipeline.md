# Viewer 3D Asset Pipeline (Person A)

How the GLB viewer pipeline works and how to author assets, mesh mappings, and
camera presets. This covers Phase 1 of the roadmap.

## Overview

```
manifest (model.glbPath, parts[].meshNodes)
  -> scripts/model-billy.mjs  ->  public/models/billy.glb
  -> Viewer.tsx GlbModel      ->  node → partId binding
  -> derivePartPose(step)     ->  per-part assembled / step / exploded pose
  -> ViewerAPI                ->  goToStep / highlight / setCamera / explode / spinPart
```

The viewer loads the GLB declared in `manifest.model.glbPath`. If the model is
absent or fails to load, it falls back to the primitive bookcase. If WebGL
itself fails, it falls back to the DOM line drawing. Both fallbacks preserve
highlight state.

## Generating the model

```bash
npm run model:billy
```

This regenerates `public/models/billy.glb` from `src/data/billy.manifest.json`.
Node names are guaranteed to match `part.meshName`. Re-run it whenever part
ids, mesh names, or the geometry map in `scripts/model-billy.mjs` change.

## Mesh mapping

Node → part resolution lives in `resolvePartIdForNode` in
`src/viewer/useViewerCommands.ts` and is unit tested. Matching order:

1. Exact normalized match against `meshName`, `meshNodes`, and id variants.
2. Containment match for grouped/suffixed node names (min length 4).

Inspect mapping live by opening the app with `?meshDebug=1`. The overlay shows
matched part count and any missing part ids (missing parts render as
primitives automatically).

## Step poses

`derivePartPose(partId, currentStep, explodeLevel)` returns an offset and
visibility per part:

- Parts before their `unlockStep` are pushed out along `explodedOffset`.
- `stepOffsets[step]` nudges a part during its active assembly step (authored
  for steps 1-3 today).
- `explodeLevel` (0/1/2) scales the exploded spread for the exploded view.

To author a new step pose, add a `stepOffsets` entry to the part in
`src/viewer/useViewerCommands.ts`.

## Camera authoring

Open the app with `?camDebug=1`. Orbit to the desired framing; the overlay
continuously shows the live `position` and `target` and offers a
**Copy camera preset JSON** button. Paste the copied block into
`cameraViews` in the manifest and point a step's `cameraView` at its key.

## Highlighting

Highlight color is always the token `--accent` orange, applied as material
emissive on the real meshes (and as material color on the primitive fallback).
`mentionPart` drives the two-second Orange Sync pulse; `spinPart` rotates the
selected part's node.

## Checklist for a new furniture GLB

- [ ] One node per manifest part, named by `meshName` (or listed in `meshNodes`).
- [ ] `model.glbPath` set in the manifest.
- [ ] `?meshDebug=1` shows 0 missing parts.
- [ ] `partLayouts` has a layout (role + unlockStep + explodedOffset) per part.
- [ ] Camera presets captured with `?camDebug=1`.
- [ ] `npm run build` and `npm test` pass.
