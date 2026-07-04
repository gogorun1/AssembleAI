# Person B: AI Intent, Voice & Speech — Implementation Plan

## Overview
Person B owns the spoken intelligence layer for AssembleAI: turn noisy user utterances into reliable `ResolvedIntent` actions, keep deterministic demo fallbacks for the six critical utterances, add robust part and step disambiguation, and make STT/TTS dependable enough for a live stage demo while preserving the current voice-first, model-moves-first product contract.

The work should preserve the shared contracts in `src/types/assembly.ts`: `AssemblyManifest`, `Part`, `Step`, `CameraView`, `IntentType`, `ResolvedIntent`, `VoiceState`, and `ViewerAPI`. The existing app already routes intent results into viewer behavior, Orange Sync, transcript entries, and TTS, so Person B should improve the service layer behind the current interfaces before changing UI-facing contracts.

## Task Breakdown

### B1 — Lock Intent Contract and Schema
Description: Define the canonical structured-output schema for `ResolvedIntent` and the request/response payloads used by the intent endpoint. The schema must match `IntentType` and `ResolvedIntent` in `src/types/assembly.ts`, constrain `language` to `en | fr`, keep replies to at most two sentences, and validate `partIds` against manifest `Part.id` values and `viewKey` against manifest `cameraViews` keys.

Files to create/modify:
- `src/types/assembly.ts`
- `src/services/intent.ts`
- `src/services/intent.schema.ts`
- `src/services/intent.schema.test.ts`
- Future endpoint files under `api/intent/*` or equivalent serverless path

Dependencies:
- Depends on the existing `ResolvedIntent` and `IntentType` definitions.
- Needs stable `part.id`, `step.index`, and `cameraViews` keys from Person A before final demo freeze.
- Does not need Person C deliverables.

Parallel/serial:
- Must run before B3, B4, B5, and B6.
- Can run in parallel with B2, B8, and B9.

Acceptance criteria:
- A schema or validator rejects invalid `type`, `language`, unknown `partIds`, unknown `viewKey`, out-of-range `stepNumber`, and missing `reply`.
- The schema accepts all current preset outputs from `parsePresetIntent`.
- `npm test` passes with focused tests for valid and invalid `ResolvedIntent` payloads.

Estimated effort: S

### B2 — Expand Golden Utterance Fixtures
Description: Create a golden fixture suite for the six demo-critical utterances plus at least 20 paraphrases. Each case should specify utterance, current step, expected `type`, optional `partIds`, optional `viewKey`, optional `stepNumber`, and expected `language`. Cover English and French phrasing, panel ambiguity, camera synonyms, common mistake wording, step navigation, and washer/cam screw references.

Files to create/modify:
- `src/services/intent.test.ts`
- `src/services/intent.golden.ts` or `src/services/intent.fixtures.ts`
- Optional `src/services/intent.golden.test.ts`

Dependencies:
- Depends on current `src/data/manifest.ts` and `src/data/billy.manifest.json`.
- Does not need Person A unless part ids change.
- Needs Person C final demo script phrasing before final acceptance, but can start now.

Parallel/serial:
- Can run in parallel with B1, B8, and B9.
- Should land before B4 and B5 to protect endpoint and fallback behavior.

Acceptance criteria:
- The six product-spec utterances still pass:
  - `Which one is the screw with the washer?` -> `which_part`, `cam-screw-washer`
  - `Where does this panel go?` -> `where_does_it_go`, current step panel
  - `Show me from the back.` -> `show_angle`, `back-panel`
  - `What's next?` -> `next_step`
  - `Did people mess this step up before?` -> `common_mistake`
  - `Et cette vis, elle va ou ?` -> `where_does_it_go`, French
- At least 20 paraphrases pass offline through the deterministic parser.
- Each fixture asserts action-relevant fields, not only `type`.

Estimated effort: S

### B3 — Harden Preset Intent Parser
Description: Improve the deterministic parser in `src/services/intent.ts` so the offline demo handles natural phrasing beyond exact keywords. Add resolver helpers for parts, steps, cameras, common mistakes, and language. Preserve deterministic behavior for the demo-critical utterances and return helpful `unknown`/clarification replies instead of overconfident guesses.

Files to create/modify:
- `src/services/intent.ts`
- `src/services/intent.test.ts`
- `src/services/intent.golden.ts` or `src/services/intent.fixtures.ts`

Dependencies:
- Depends on B2 fixtures for coverage.
- Should align with B1 schema but can begin once the intended contract is drafted.
- Needs stable manifest part ids from Person A before final tuning.

Parallel/serial:
- Serial after B2 for test-driven implementation.
- Can run in parallel with B8 and B9.

Acceptance criteria:
- Offline `parseIntent()` passes the golden fixture suite with no `VITE_INTENT_ENDPOINT`.
- `resolvePartIds` recognizes manifest `Part.label`, `Part.code`, `Part.id`, and common aliases such as washer screw, cam screw, back screw, shelf pin, dowel, back panel, side panel, top panel, bottom panel, and safety strap.
- `parseStepNumber` handles numeric and word-based step requests.
- Ambiguous phrases such as "this panel" use the current step when that is unambiguous, otherwise produce a clarification-style `unknown` or future clarification intent behavior.

Estimated effort: M

### B4 — Build Structured Intent Endpoint
Description: Create a deployable `/intent` endpoint or serverless function that accepts the request shape currently sent by `parseIntentWithEndpoint`: raw `utterance`, `currentStep`, `parts`, and `steps`. Extend the payload as needed to include `cameraViews`, recent transcript context, and locale hints. The endpoint should call a structured-output model, validate the response against B1, and return a normalized `ResolvedIntent`.

Files to create/modify:
- `api/intent/index.ts` or equivalent serverless route
- `src/services/intent.ts`
- `src/services/intent.schema.ts`
- `src/services/intent.endpoint.test.ts` or integration test fixture
- Environment docs for `VITE_INTENT_ENDPOINT`

Dependencies:
- Depends on B1.
- Benefits from B2 fixtures for replay tests.
- Does not need Person A implementation, but final prompt context needs stable manifest ids and camera keys.
- Needs Person C only for final presenter script copy and fallback copy.

Parallel/serial:
- Serial after B1.
- Can run in parallel with B3 once schema is stable.

Acceptance criteria:
- The endpoint returns a valid `ResolvedIntent` for all six demo-critical utterances and the golden paraphrases.
- Invalid model output is rejected and converted to a safe fallback response.
- Endpoint prompt includes manifest `parts`, `steps`, current step, and camera view keys.
- Average local/mock integration latency is tracked, and real endpoint target is under 1.5 seconds on demo network.

Estimated effort: M

### B5 — Endpoint Timeout, Retry, and Offline Fallback
Description: Replace the current endpoint failure behavior, which returns `unknown`, with a safer chain: try endpoint with an 8-second hard timeout, optionally retry once for transient failures within the budget, then fall back to deterministic preset parsing. Ensure endpoint failure never breaks click-only or presenter-mode demo paths.

Files to create/modify:
- `src/services/intent.ts`
- `src/services/intent.test.ts`
- `src/services/intent.endpoint.test.ts`

Dependencies:
- Depends on B3 for strong preset fallback.
- Depends on B4 for endpoint integration shape.
- Does not need Person A or C.

Parallel/serial:
- Serial after B3 and B4.

Acceptance criteria:
- If `VITE_INTENT_ENDPOINT` is unset, behavior remains deterministic and local.
- If endpoint returns non-2xx, invalid JSON, schema-invalid intent, or times out, `parseIntent()` falls back to preset parser for known utterances.
- Unknown utterances still return `unknown` with a short helpful reply.
- Tests mock fetch failures, aborts, invalid output, and success.
- Timeout remains compatible with the roadmap requirement to preserve 8-second timeouts.

Estimated effort: S

### B6 — Part Disambiguation and Clarification Behavior
Description: Add explicit handling for ambiguous part references. The app should not silently choose among multiple plausible panels, screws, shelves, or hardware parts when the current step does not make the answer obvious. Return a clarification response that includes candidate part labels/codes and no destructive step/view action. Because `IntentType` does not currently include `clarify`, implement this either as constrained `unknown` behavior or propose a small contract change for `clarification_required`.

Files to create/modify:
- `src/types/assembly.ts` if adding a new intent type
- `src/services/intent.ts`
- `src/services/intent.schema.ts`
- `src/services/intent.test.ts`
- Potentially `src/App.tsx` or transcript handling if a new intent type is introduced

Dependencies:
- Depends on B1 contract decision.
- Depends on B3 resolver helpers.
- Needs Person A only for final part ids if the GLB manifest changes.
- Needs Person C if clarification copy appears in presenter fallback UI.

Parallel/serial:
- Serial after B1 and B3.
- Can run in parallel with B7 and B10.

Acceptance criteria:
- "Where does this panel go?" on a step with a single highlighted panel resolves to that panel.
- Ambiguous "which screw?" outside a screw-specific step asks a clarification question and includes candidates such as `117327` and `M3.5x16`.
- Clarification responses do not trigger incorrect `spinPart`, `goToStep`, or camera moves.
- Golden tests cover at least five ambiguous utterances.

Estimated effort: M

### B7 — Reply Language and Copy Constraints
Description: Make intent replies stage-safe and language-aware. English and French replies should be short, direct, and tied to the visual action. Remote endpoint replies and local preset replies must stay under two sentences and avoid unsupported claims. French detection currently looks for accents and words like `cette`, `elle`, `ou`, `où`, and `vis`; expand this carefully without breaking English utterances.

Files to create/modify:
- `src/services/intent.ts`
- `src/services/intent.test.ts`
- `src/services/intent.golden.ts` or `src/services/intent.fixtures.ts`
- Endpoint prompt in `api/intent/*`

Dependencies:
- Depends on B2 fixtures.
- Should align with Person C final demo script phrasing.
- Does not need Person A.

Parallel/serial:
- Can run in parallel with B6, B8, and B10 after B2.

Acceptance criteria:
- Replies from `normalizeIntent` and preset parser are at most two sentences.
- French utterances return `language: 'fr'` and French copy.
- English utterances containing words that overlap French aliases do not accidentally switch to French.
- Golden tests verify reply length and language.

Estimated effort: S

### B8 — STT Provider Abstraction
Description: Keep Web Speech as the default implementation in `src/services/stt.ts`, but introduce a provider factory that can select Web Speech or an optional hosted/Whisper-like STT implementation behind the existing `STTService` interface. Preserve `start`, `stop`, `abort`, `onResult`, `onEnd`, and `onError`, and keep no-network behavior available.

Files to create/modify:
- `src/services/stt.ts`
- `src/services/stt.webSpeech.ts`
- `src/services/stt.remote.ts` or `src/services/stt.provider.ts`
- `src/services/stt.test.ts`
- Environment docs for provider selection

Dependencies:
- Depends on current `STTService` interface.
- Does not need Person A.
- May need Person C UI hooks for visible provider/status if exposed beyond service state.

Parallel/serial:
- Can run in parallel with B1, B2, B3, B4, and B9.

Acceptance criteria:
- Default behavior remains Web Speech with `state: 'available' | 'unavailable'`.
- Provider selection is controlled by environment/config, not hardcoded.
- Missing browser APIs still return an unavailable no-op service.
- Tests cover Web Speech availability, unavailable fallback, result callback, end callback, and error callback.

Estimated effort: M

### B9 — TTS Provider Abstraction and Barge-In Guarantees
Description: Keep browser speech synthesis as the default in `src/services/tts.ts`, but introduce a provider factory for optional higher-quality TTS. Preserve `TTSService.speak(intent)`, `cancel()`, and `preload()`. Barge-in must cancel active TTS quickly when push-to-talk begins during `speaking`.

Files to create/modify:
- `src/services/tts.ts`
- `src/services/tts.webSpeech.ts`
- `src/services/tts.remote.ts` or `src/services/tts.provider.ts`
- `src/services/tts.test.ts`
- Potentially caller code that invokes `cancel()` on push-to-talk

Dependencies:
- Depends on current `TTSService` interface and `ResolvedIntent.reply`.
- Does not need Person A.
- May need Person C for visible fallback messages and demo controls.

Parallel/serial:
- Can run in parallel with B1, B2, B3, B4, and B8.

Acceptance criteria:
- `createTTSService()` still works without provider configuration.
- `preload()` remains safe when `window.speechSynthesis` is unavailable.
- `speak()` chooses `fr-FR` for `language: 'fr'` and `en-US` for `language: 'en'`.
- `cancel()` calls through to the active provider and can be tested with fake timers/mocks.
- Barge-in cancellation target is under 150 ms in the browser path.

Estimated effort: M

### B10 — Voice State Machine Tests and Failure Surfacing
Description: Add tests and any small service hooks needed to prove the product-spec voice rules: idle -> listening -> transcribing -> thinking -> acting -> speaking -> idle; push-to-talk during `speaking` cancels TTS; no speech after 5 seconds returns to idle; STT unavailable surfaces a recoverable message instead of throwing.

Files to create/modify:
- `src/types/assembly.ts`
- `src/services/stt.test.ts`
- `src/services/tts.test.ts`
- Store or app tests around voice state, likely `src/store/useAppStore.test.ts` and/or component tests if introduced
- Potentially `src/App.tsx` if current callers need safer error handling

Dependencies:
- Depends on B8 and B9 for provider seams.
- Needs Person C if toast/presenter UI owns visible failure messages.
- Does not need Person A.

Parallel/serial:
- Serial after B8 and B9.
- Can run in parallel with B6 and B7 if those do not touch voice state callers.

Acceptance criteria:
- Unit tests prove no-op unavailable STT does not throw.
- TTS cancel path is test-covered.
- No-speech timeout behavior is test-covered where the state machine lives.
- Errors become user-visible fallback messages or callbacks, not uncaught exceptions.

Estimated effort: M

### B11 — Intent Action Integration Audit
Description: Verify that every `ResolvedIntent` type still maps to the correct app behavior: step navigation, part highlighting, Orange Sync, camera moves, transcript part mentions, and TTS reply. This task is primarily integration validation and small fixes where the service output shape and app behavior diverge.

Files to create/modify:
- `src/App.tsx`
- `src/store/useAppStore.test.ts`
- `src/services/intent.test.ts`
- Potentially component tests if added

Dependencies:
- Depends on B3, B5, B6, and B7.
- Needs Person A once real GLB/viewer changes land, because `partIds` and `viewKey` must still drive `ViewerAPI.highlight`, `spinPart`, and `setCamera`.
- Needs Person C if presenter controls bypass the same intent path.

Parallel/serial:
- Serial after intent behavior is mostly stable.
- Should be repeated after Person A and Person C integration PRs.

Acceptance criteria:
- `which_part` highlights and spins the resolved part.
- `where_does_it_go` highlights parts and uses the current step camera or resolved `viewKey`.
- `show_angle` calls `setCamera(viewKey)`.
- `next_step`, `prev_step`, and `goto_step` update the active step.
- `common_mistake` highlights relevant part ids and preserves Orange Sync behavior through `mentionPart(partId)`.

Estimated effort: S

### B12 — Demo Readiness and Provider Documentation
Description: Document how to run Person B features in local/offline mode and with optional remote providers. Include required environment variables, fallback order, supported browsers, test commands, and rehearsal checks for microphone, TTS voice availability, endpoint latency, and network-off behavior.

Files to create/modify:
- `docs/plans/person-b-plan.md` if updating this plan
- `README.md` or `docs/demo-checklist.md` if Person C creates it
- Endpoint deployment notes under `docs/specs/*` or `docs/ops/*`

Dependencies:
- Depends on B4, B5, B8, and B9.
- Needs Person C final checklist location and presenter fallback copy.
- Does not need Person A except final part/camera freeze notes.

Parallel/serial:
- Mostly serial near the end, but notes can be drafted throughout.

Acceptance criteria:
- A new developer can run `npm test`, `npm run build`, and local offline demo mode without remote credentials.
- Remote intent/STT/TTS configuration is documented without committing secrets.
- Demo fallback order is explicit: click/keyboard and presenter controls first, deterministic intent fallback second, remote providers optional.

Estimated effort: S

## Dependency Graph
Critical path:

```text
B1 Lock Intent Contract and Schema
  -> B4 Build Structured Intent Endpoint
  -> B5 Endpoint Timeout, Retry, and Offline Fallback
  -> B11 Intent Action Integration Audit
  -> B12 Demo Readiness and Provider Documentation

B2 Expand Golden Utterance Fixtures
  -> B3 Harden Preset Intent Parser
  -> B5 Endpoint Timeout, Retry, and Offline Fallback
  -> B11 Intent Action Integration Audit

B8 STT Provider Abstraction
  -> B10 Voice State Machine Tests and Failure Surfacing
  -> B12 Demo Readiness and Provider Documentation

B9 TTS Provider Abstraction and Barge-In Guarantees
  -> B10 Voice State Machine Tests and Failure Surfacing
  -> B12 Demo Readiness and Provider Documentation
```

Additional blockers and cross-person dependencies:
- B6 depends on the B1 contract decision and B3 resolver helpers.
- B7 depends on B2 and should use Person C's final demo wording before freeze.
- B11 should be rerun after Person A lands real GLB/viewer changes, because the same `partIds` and `viewKey` values must drive `ViewerAPI`.
- B12 should align with Person C's demo checklist and operations docs.

Critical path summary:
- Intent reliability critical path: B1 -> B2 -> B3 -> B4 -> B5 -> B11.
- Voice reliability critical path: B8 + B9 -> B10.
- Final demo critical path: B11 + B10 -> B12.

## Parallel Workstreams

### Workstream 1 — Intent Contract and Endpoint
Tasks: B1, B4, B5

This stream defines the structured-output contract, builds the remote endpoint, and makes endpoint failure safe. It should be owned by one person or tightly coordinated because schema, prompt, validation, and fallback behavior need to evolve together.

### Workstream 2 — Golden Tests and Local Parser
Tasks: B2, B3, B6, B7

This stream protects the no-network demo. It can begin immediately with fixtures based on `docs/specs/product-spec.md`, `src/data/billy.manifest.json`, and current `src/services/intent.test.ts`. It should feed discoveries back into the endpoint prompt and schema.

### Workstream 3 — STT/TTS Providers
Tasks: B8, B9, B10

This stream can run independently from intent parsing. It should preserve the simple service interfaces in `src/services/stt.ts` and `src/services/tts.ts`, with Web Speech remaining the default low-setup mode.

### Workstream 4 — Integration and Demo Ops
Tasks: B11, B12

This stream comes last and validates the full path from utterance to `ResolvedIntent` to viewer action to transcript and speech. It should coordinate with Person A for final part/camera identifiers and Person C for presenter mode, fallback UI, and checklist placement.

## Testing Strategy

### Intent Unit Tests
Use Vitest tests around `parseIntent()` and resolver helpers in `src/services/intent.ts`.

Coverage:
- All current cases in `src/services/intent.test.ts`.
- At least 20 paraphrases from B2.
- Step navigation: next, previous, goto numeric, goto word-based, lower/upper clamp behavior.
- Camera requests: back/rear/behind, close-up/zoom, current-step camera fallback.
- Part references: `Part.id`, `Part.code`, `Part.label`, hardware aliases, panel aliases, French screw phrasing.
- Unknown and clarification behavior.
- Reply language and reply length constraints.

### Schema and Normalization Tests
Add tests for `src/services/intent.schema.ts` and `normalizeIntent` behavior.

Coverage:
- Reject invalid intent types not in `IntentType`.
- Reject invalid `language`.
- Reject unknown `partIds` and `viewKey`.
- Reject out-of-range `stepNumber`.
- Ensure remote replies are truncated or rejected to meet the two-sentence rule.
- Ensure missing `reply` falls back safely.

### Endpoint Integration Tests
Use mocked model responses and mocked `fetch` for client-side endpoint behavior.

Coverage:
- Endpoint success returns normalized `ResolvedIntent`.
- Non-2xx, abort, timeout, invalid JSON, and schema-invalid responses fall back to preset parser.
- Request payload includes `utterance`, `currentStep`, `parts`, `steps`, and eventually `cameraViews` and transcript context.
- Golden utterances can be replayed against the endpoint prompt/model mock.

### STT Unit Tests
Add `src/services/stt.test.ts` with fake `window.SpeechRecognition`/`webkitSpeechRecognition`.

Coverage:
- Browser API unavailable returns `state: 'unavailable'` and no-op methods.
- Browser API available returns `state: 'available'`.
- `onResult` receives trimmed final transcripts.
- `onEnd` and `onError` callbacks fire.
- Provider factory selects Web Speech by default and optional provider only when configured.

### TTS Unit Tests
Add `src/services/tts.test.ts` with fake `window.speechSynthesis` and `SpeechSynthesisUtterance`.

Coverage:
- `preload()` calls `getVoices()` when available.
- `speak()` cancels prior speech before speaking.
- `speak()` sets `fr-FR` or `en-US` based on `ResolvedIntent.language`.
- `speak()` resolves on end and error.
- `cancel()` forwards to the active provider.
- Barge-in cancel path is covered with fake timers or callback assertions.

### Golden Tests
Golden tests should be data-driven so Person C's final script can add phrases without rewriting test logic.

Fixture fields:
- `utterance`
- `currentStep`
- `expectedType`
- `expectedPartIds`
- `expectedViewKey`
- `expectedStepNumber`
- `expectedLanguage`
- Optional `expectedReplyPattern`

### Integration and Regression Tests
Keep existing manifest and Orange Sync tests:
- `src/data/manifest.test.ts` validates part and camera references.
- `src/store/useAppStore.test.ts` validates `mentionPart(partId)` clears after the flash window.

Add or extend integration tests to ensure intent outputs trigger expected app/store behavior if the current test setup supports it. If browser/component tests are introduced by Person C, add a happy path for each of the six demo utterances.

## Phase Ordering

1. B1 — Lock the intent contract and schema.
2. B2 — Expand golden utterance fixtures.
3. B3 — Harden the deterministic preset parser until the no-network demo is strong.
4. B8 and B9 — Build STT and TTS provider abstractions in parallel with endpoint work.
5. B4 — Build the structured intent endpoint behind `VITE_INTENT_ENDPOINT`.
6. B5 — Add timeout, retry, schema validation, and deterministic fallback.
7. B6 — Add part disambiguation and clarification behavior.
8. B7 — Tighten reply language, length, and demo copy constraints.
9. B10 — Test the voice state machine and failure behavior after STT/TTS seams exist.
10. B11 — Audit intent-to-action integration after Person A and Person C changes are close to stable.
11. B12 — Finalize provider, fallback, and rehearsal documentation.

Recommended first PR:
- B1, B2, and the initial B3 parser improvements. This immediately improves demo safety without waiting for remote infrastructure.

Recommended second PR:
- B8 and B9 provider seams with tests. This keeps voice provider work isolated from intent behavior.

Recommended third PR:
- B4 and B5 endpoint integration with schema validation and fallback.

Recommended final integration PR:
- B6, B7, B10, B11, and B12 after Person A's real viewer and Person C's presenter/rehearsal features are available.
