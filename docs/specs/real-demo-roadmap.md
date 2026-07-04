# Roadmap to a Real AssembleAI Demo

This roadmap upgrades the current hackathon demo into a convincing live demo that can survive judges, cameras, network hiccups, and real user questions. It preserves the current product promise: the model moves first, speech confirms second.

## Current Baseline

Already built:

- React/Vite/TypeScript app.
- Single BILLY-style manifest.
- 9-step walkthrough.
- 3D primitive viewer with command API.
- Web Speech STT and browser TTS wrappers.
- Preset intent parser for demo-critical utterances.
- Orange Sync state event.
- WebGL fallback.
- Tests for manifest, intent, and Orange Sync.

Main gap:

The app is a strong interactive prototype, not yet a true AI/3D assembly demo. The 3D model, intent parser, voice stack, and validation loop need production-grade replacements.

## Phase 0: Demo Hardening

Target: 0.5-1 day

Goal: make the existing prototype stable for repeated live demos.

Tasks:

- Add a presenter mode with text buttons for all six critical utterances.
- Add a reset button that clears transcript, step, highlights, selected part, and TTS.
- Add browser smoke tests for desktop viewport, fallback viewport, step navigation, and part clicks.
- Add a small `DemoChecklist.md` for rehearsal.
- Add visual regression screenshots for the main viewport and WebGL fallback.
- Add chunk splitting or adjust build warnings so large bundle output does not distract during judging.

Exit criteria:

- Demo can be run ten times in a row without manual browser refresh.
- Presenter can recover from STT failure in one click.
- `npm test`, `npm run build`, and browser smoke test pass.

## Phase 1: Real 3D Asset Pipeline

Target: 1-3 days

Goal: replace primitive geometry with a real optimized BILLY-style model.

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
