# Roadmap to a Real AssembleAI Demo

This roadmap upgrades the current hackathon demo into a convincing live demo that can survive judges, cameras, network hiccups, and real user questions. It preserves the current product promise: the model moves first, speech confirms second.

## Current Baseline

Already built:

- React/Vite/TypeScript app.
- Single BILLY-style manifest.
- 9-step walkthrough.
- Manifest-driven GLB viewer with command API.
- Generated `/public/models/billy.glb` asset and `npm run model:billy`.
- Mesh-node mapping, early step offsets, camera debug, and mesh debug helpers.
- Primitive model fallback and WebGL fallback.
- Web Speech STT and browser TTS wrappers.
- Preset intent parser for demo-critical utterances.
- Orange Sync state event.
- Presenter mode, typed command fallback, EN/FR language toggle, reset/rehearsal controls, debug overlay, event log, and demo checklist.
- Photo Check UI shell with manifest-aware offline mock and `VITE_PHOTO_CHECK_ENDPOINT` boundary.
- GitHub Actions CI and Playwright smoke tests.
- Tests for manifest, intent, viewer mapping, step poses, Orange Sync, reset/event logging, and photo-check mock.

Main gap:

The app is now past the primitive-viewer and presenter-safety prototype, but it is not yet a true agentic assembly demo. The included GLB is generated from simple geometry, the intent parser still defaults to deterministic presets, voice still depends on browser APIs, and photo validation is currently a deterministic mock unless a VLM endpoint is configured.

## Remaining Functional Gaps After PR #4

- Real structured-output agent backend with schema validation and part disambiguation.
- Server-side secret boundary for LLM, STT, TTS, VLM, logging, and storage keys.
- Hosted or recorded-audio STT path that works outside Chrome Web Speech.
- Hosted TTS/audio playback path with browser `speechSynthesis` fallback.
- Real VLM-backed "Did I do this right?" validation behind the existing Photo Check boundary.
- Manifest schema validation and visual regression screenshots.
- Production-modeled furniture GLB, full step pose coverage, and bundle/code-splitting polish.
- Manual ingestion, multi-product catalog, persistence, accounts, and analytics.

## Three-Person Parallel Work Plan

The next build can be split into three tracks that run at the same time. Each person owns a different surface area and integrates through stable contracts already present in the codebase.

### Person A: 3D Asset and Viewer Pipeline

Mission: turn the current primitive bookcase into a real 3D assembly experience.

Primary files:

- `src/viewer/Viewer.tsx`
- `src/viewer/useViewerCommands.ts`
- `src/data/billy.manifest.json`
- future `public/models/*`
- future `scripts/model-*`

Responsibilities:

- Source, model, or export a clean GLB/GLTF bookcase.
- Ensure mesh/node names map cleanly to manifest `meshName` values.
- Replace primitive part layouts with GLB node mapping while preserving `ViewerAPI`.
- Author assembled, partial, and exploded poses per step.
- Polish camera presets, part highlighting, and `spinPart`.
- Keep the WebGL fallback working.

First deliverables:

- One optimized GLB in `public/models/`.
- A mesh mapping utility or manifest extension.
- Real mesh highlighting for at least steps 1-3.
- A camera authoring helper or documented camera capture workflow.

Status after PR #3:

- Landed: generated GLB, manifest model path, mesh aliases, GLB loader, mapping helpers, early step offsets, real mesh highlighting, camera helper, mesh helper, and fallback safety.
- Remaining: production-quality modeled asset, full step pose coverage, performance polish, and browser smoke coverage.

Independent until:

- Needs final part ids and step ids from the manifest.
- Needs Person B only for semantic part resolution, not for viewer implementation.

### Person B: AI Intent, Voice, and Speech

Mission: make the assistant understand natural questions reliably and speak well on stage.

Primary files:

- `src/services/intent.ts`
- `src/services/stt.ts`
- `src/services/tts.ts`
- `src/types/assembly.ts`
- `src/services/*.test.ts`
- future `api/intent/*` or serverless endpoint files

Responsibilities:

- Implement a structured-output intent endpoint.
- Keep deterministic preset fallback for demo-critical utterances.
- Add part disambiguation and clarification behavior.
- Add paraphrase tests for the six demo utterances.
- Add optional higher-quality STT and TTS providers behind existing service interfaces.
- Preserve barge-in behavior and 8-second timeouts.

First deliverables:

- JSON schema for `ResolvedIntent`.
- `/intent` endpoint or deployable serverless function.
- Golden test set with at least 20 paraphrases.
- Provider switches for STT/TTS with Web Speech fallback.

Independent until:

- Needs stable manifest shape and part ids.
- Needs Person C for final demo script phrasing and presenter fallback copy.

### Person C: Demo UX, Photo Validation, QA, and Operations

Mission: make the demo presentable, recoverable, and measurable.

Primary files:

- `src/App.tsx`
- `src/components/*`
- `src/styles/*`
- `docs/specs/*`
- future `src/services/photoCheck.ts`
- future browser smoke tests and CI files

Responsibilities:

- Add presenter mode with buttons for all critical utterances.
- Add typed command fallback that reuses the same intent path as voice.
- Add reset/rehearsal controls.
- Add photo upload and VLM result UI for "Did I do this right?"
- Add debug overlay and local event log.
- Add browser smoke tests and CI.
- Own README/demo checklist updates.

First deliverables:

- Presenter mode and reset controls.
- `DemoChecklist.md`.
- Browser smoke test for load, step navigation, part click, and WebGL fallback.
- Photo-check UI shell with mocked structured response.

Status after PR #4:

- Landed: presenter buttons, full/rehearsal reset, event log, debug overlay, copy debug bundle, demo checklist, Photo Check UI shell, offline photo mock, Playwright smoke tests, and CI workflow.
- Rescue branch adds: typed command panel, EN/FR language toggle, shortcut guard while typing, and smoke coverage for both paths.
- Remaining: real VLM endpoint, richer visual regression assets, and integration polish with Person A/B final services.

Independent until:

- Needs Person B for real VLM endpoint.
- Needs Person A for final visual screenshots and real model capture.

### Shared Contracts

The three tracks should not change these contracts casually:

- `src/types/assembly.ts`
- `ViewerAPI`
- `ResolvedIntent`
- manifest `part.id`, `step.index`, and `cameraViews` keys
- Orange Sync behavior via `mentionPart(partId)`

If a contract must change, all three people should agree first and land the contract change in its own PR.

### Merge Order

Recommended remaining merge order:

1. Person B lands the structured intent endpoint behind `VITE_INTENT_ENDPOINT`.
2. Person B or C lands real VLM photo validation behind `VITE_PHOTO_CHECK_ENDPOINT`.
3. Person A lands production asset polish and full step animation coverage.
4. Final integration PR connects real model, real intent endpoint, voice provider settings, VLM settings, and final demo copy.

### Daily Sync Checklist

- Are part ids stable?
- Did any `ResolvedIntent` fields change?
- Did any viewer command semantics change?
- Are all six critical utterances still green?
- Can the demo still run with network off?
- Can the presenter recover without touching code?

## Phase 0: Demo Hardening

Target: 0.5-1 day

Goal: make the existing prototype stable for repeated live demos.

Tasks:

- Add a presenter mode with text buttons for all six critical utterances.
- Add a typed command fallback for no-microphone demos.
- Add a reset button that clears transcript, step, highlights, selected part, and TTS.
- Add browser smoke tests for desktop viewport, fallback viewport, step navigation, and part clicks.
- Add a small `DemoChecklist.md` for rehearsal.
- Add visual regression screenshots for the main viewport and WebGL fallback.
- Add chunk splitting or adjust build warnings so large bundle output does not distract during judging.

Exit criteria:

- Demo can be run ten times in a row without manual browser refresh.
- Presenter can recover from STT failure in one click.
- `npm test`, `npm run build`, and browser smoke test pass.

Status: PR #4 covers the presenter controls, reset paths, debug overlay, checklist, CI, and browser smoke scaffolding. The rescue branch adds typed command and EN/FR fallback coverage. Remaining Phase 0 work is mainly rehearsal evidence and visual regression screenshots.

## Phase 1: Real 3D Asset Pipeline

Target: 1-3 days

Goal: replace primitive geometry with a real optimized BILLY-style model.

Status: PR #3 implements the GLB pipeline, generated model asset, node mapping, debug helpers, and early step offsets. Treat the remaining work as asset-quality and coverage polish rather than a full viewer rewrite.

Tasks:

- Model or source a clean GLTF/GLB bookcase with named nodes matching manifest `meshName`.
- Author step poses and exploded offsets per part.
- Add a loader that maps manifest part ids to mesh nodes.
- Add material overrides for ink/paper/accent styling.
- Add camera authoring helper: capture current camera position/target and export JSON.
- Add model preloading and loading error UI.

Exit criteria:

- Each manifest part maps to a real mesh node.
- `ViewerAPI.goToStep`, `highlight`, `setCamera`, `explode`, and `spinPart` work on the GLB model.
- Model loads under 2 seconds on the demo laptop after first cache.
- Highlight color remains the same token orange as the UI.

## Phase 2: Real Structured Intent Backend

Target: 1-2 days

Goal: replace deterministic parser with an actual structured-output LLM endpoint while keeping demo fallbacks.

Tasks:

- Create an `/api/intent` endpoint or small serverless function.
- Define a strict JSON schema matching `ResolvedIntent`.
- Pass parts, part codes, current step, camera views, and recent transcript to the model.
- Resolve part ambiguity explicitly rather than silently guessing.
- Add timeout, retry, and fallback-to-preset behavior.
- Add golden tests for the six demo utterances plus paraphrases.
- Add language detection and reply constraints: English/French, max two sentences.

Exit criteria:

- The six demo utterances and at least 20 paraphrases resolve correctly.
- Ambiguous part queries return a clarification question.
- Endpoint failure never breaks click-only demo.
- Average intent latency is under 1.5 seconds on demo network.

## Phase 3: Production-Ready Voice and Speech

Target: 1-2 days

Goal: make hands-free conversation feel reliable on stage.

Tasks:

- Keep Web Speech as the default low-setup mode.
- Add optional Whisper or hosted STT provider behind `services/stt.ts`.
- Add optional high-quality TTS provider behind `services/tts.ts`.
- Add microphone permission preflight and visible status.
- Add barge-in tests for TTS cancel.
- Add a no-network mode that uses text buttons and preset responses.

Exit criteria:

- Push-to-talk works in Chrome with clear visual state.
- TTS cancel happens within 150 ms after barge-in.
- Failure modes surface as toast messages, not exceptions.
- Presenter can switch to text-button mode instantly.

## Phase 4: Photo-Based "Did I Do This Right?"

Target: 2-4 days

Goal: add the P1 feature that validates one uploaded photo against the expected state.

Status: PR #4 adds the Photo Check panel, offline manifest-aware mock, result UI, part highlighting, event logging, and the `VITE_PHOTO_CHECK_ENDPOINT` integration boundary. Remaining work is the real VLM endpoint and sample photo fixture set.

Tasks:

- Add photo upload UI and camera permission option.
- Capture current step expected state from manifest.
- Create a VLM prompt containing step action, parts, common mistake, and expected visible cues.
- Return structured result: `looksRight`, `issues`, `confidence`, `reply`, `highlightPartIds`.
- Highlight likely incorrect parts in the viewer.
- Add sample photos for correct and incorrect states.

Exit criteria:

- Correct and incorrect sample photos produce different structured outcomes.
- The answer references the current step and common mistake.
- Low-confidence responses ask for another photo rather than inventing certainty.
- The feature is clearly labeled as photo-based, not video-based.

## Phase 5: Manifest Authoring Workflow

Target: 3-7 days

Goal: make it possible to add a second furniture object without editing many code files.

Tasks:

- Create a manifest schema file and validation command.
- Build a small authoring script for parts, steps, camera views, and common mistakes.
- Add a model-node inspector for GLB files.
- Add fixture tests that validate every step reference.
- Add documentation for writing demo-grade common mistakes.

Exit criteria:

- A second simple furniture demo can be added by adding a manifest and GLB.
- Invalid part ids, camera keys, or mesh names fail CI.
- Product copy and spoken replies stay manifest-driven.

## Phase 6: Demo Operations and Observability

Target: 1-2 days

Goal: make the demo diagnosable during rehearsals and resilient during presentations.

Tasks:

- Add debug overlay showing voice state, current intent, current step, and last latency.
- Add local event log for utterance -> intent -> action -> TTS.
- Add a "copy debug bundle" button.
- Add a rehearsal checklist with hardware, browser, mic, network, and fallback steps.
- Add CI workflow for tests and build.

Exit criteria:

- Any failed demo run can be diagnosed from a local log.
- CI blocks broken manifest references and build failures.
- Rehearsal instructions fit on one page.

## Recommended Real-Demo Timeline

For a polished live demo in roughly one week:

1. Day 1: Phase 0 hardening and browser smoke tests.
2. Day 2: Real GLB model import and mesh mapping.
3. Day 3: Camera/step animation polish and Orange Sync on real meshes.
4. Day 4: Structured intent endpoint and paraphrase tests.
5. Day 5: Better STT/TTS provider options and presenter fallback.
6. Day 6: Photo-check prototype with sample images.
7. Day 7: Rehearsal, observability, CI, and demo script freeze.

## Success Metrics

- Cold load to interactive under 4 seconds on the demo laptop.
- Intent resolution under 1.5 seconds for common questions.
- 95 percent pass rate on the fixed demo utterance suite.
- Zero unrecoverable demo failures in ten rehearsal runs.
- Every step has a click path and a voice path.
- Every part reference triggers Orange Sync within one visual frame.

## Biggest Risks

- Web Speech reliability varies by browser and environment.
- A real GLB can become heavy or hard to map if mesh names are poor.
- LLM part resolution can hallucinate unless schema and manifest context are strict.
- VLM photo validation can overstate confidence without carefully bounded prompts.
- Stage Wi-Fi can turn a good cloud demo into a slow demo.

## Risk Mitigations

- Keep deterministic preset fallback forever.
- Keep click-only and presenter modes first-class.
- Use schema validation on every remote model response.
- Cache model assets and avoid runtime manual parsing.
- Rehearse with the exact laptop, browser, microphone, and network used for judging.
