# Person B Feature Branch Review

Reviewed `feature/person-b-intent-voice` against the Person B requirements in `docs/specs/product-spec.md`, `docs/specs/real-demo-roadmap.md`, and `docs/plans/person-b-plan.md`.

Overall assessment: **NEEDS WORK**

The deterministic local path is in good shape: the six demo-critical utterances are covered, the local parser has a broad golden fixture suite, the runtime validator checks manifest-bound fields, and the voice controller has focused tests. The branch is not merge-ready because the remote endpoint/provider paths can bypass the promised deterministic fallback and omit required context, and the optional remote STT/TTS implementations expose browser-side secrets and have cancellation gaps.

## Spec Compliance

| Requirement | Status | Notes |
| --- | --- | --- |
| Preserve `IntentType` / `ResolvedIntent` contract | PASS | `src/types/assembly.ts:43` keeps the product-spec intent union unchanged and `src/types/assembly.ts:65` preserves optional `partIds` and `viewKey`. |
| Schema or validator rejects invalid type, language, unknown `partIds`, unknown `viewKey`, out-of-range `stepNumber`, and missing reply | PASS | `src/services/intent.schema.ts:50` validates those fields, including reply sentence count at `src/services/intent.schema.ts:74` and manifest-bound part/view checks at `src/services/intent.schema.ts:92` and `src/services/intent.schema.ts:107`. |
| JSON schema for structured output matches `ResolvedIntent` | WARN | The exported schema exists at `src/services/intent.schema.ts:17`, but it is not used by the endpoint; the endpoint duplicates a separate schema at `api/intent/index.ts:84`. This creates drift risk. |
| Six demo-critical utterances work offline | PASS | `src/services/intent.fixtures.ts:14` includes all six product-spec utterances, and `src/services/intent.test.ts:6` asserts type, language, parts, view, step, and reply length. |
| At least 20 paraphrases covered | PASS | `src/services/intent.fixtures.ts:69` onward adds more than 20 extra golden cases, including ambiguity, camera synonyms, French, step navigation, and hardware aliases. |
| Deterministic fallback survives endpoint failure | FAIL | The client falls back to local parsing when the configured endpoint returns non-2xx or invalid output (`src/services/intent.ts:111`), but the serverless endpoint catches model failures and returns a 200 `unknown` (`api/intent/index.ts:68`). A known utterance can therefore become `unknown` instead of falling back to the preset parser. |
| Intent endpoint request includes utterance, current step, parts, steps, camera views, recent transcript, and locale | WARN | `src/services/intent.ts:138` sends all fields if supplied, but `src/App.tsx:64` calls `parseIntent` with only `manifest` and `currentStep`, so real app requests always send `recentTranscript: []` and no locale hint. |
| Endpoint validates model output before acting | PASS | `api/intent/index.ts:128` normalizes model output and validates it with `validateResolvedIntent` before returning a response. |
| Part disambiguation / clarification behavior | PASS | Ambiguous local phrases become action-free `unknown` intents via `src/services/intent.ts:241` and `src/services/intent.ts:483`, with tests at `src/services/intent.test.ts:36`. |
| Reply language and max two sentences | PASS | Local replies branch on detected language in `src/services/intent.ts:160`; endpoint/client normalization trims replies at `src/services/intent.ts:327` and `api/intent/index.ts:140`; validator rejects overlong replies at `src/services/intent.schema.ts:76`. |
| Viewer action mapping for intent types | PASS | `src/services/intentActions.ts:17` centralizes side effects, with coverage for `which_part`, `where_does_it_go`, `show_angle`, step navigation, and `common_mistake` in `src/services/intentActions.test.ts:40`. |
| Voice state machine rules | PASS | `src/services/voiceController.ts:66` implements push-to-talk, barge-in cancellation, unavailable STT messaging, and no-speech timeout. Tests cover the spec sequence and failure paths at `src/services/voiceController.test.ts:67`. |
| STT provider abstraction with Web Speech default | PASS | `src/services/stt.ts:30` selects Web Speech by default and remote only by config; unavailable Web Speech returns a no-op service. |
| TTS provider abstraction with Web Speech default | WARN | `src/services/tts.ts:21` selects providers correctly, and Web Speech handles language and cancel, but remote TTS does not cancel/abort in-flight synthesis before playback. |
| Preserve 8-second timeout | PASS | Client intent endpoint timeout is `8000` at `src/services/intent.ts:11` and tested at `src/services/intent.endpoint.test.ts:134`. |

## Code Issues

1. **FAIL: Endpoint model failures block deterministic fallback.**
   - References: `api/intent/index.ts:68`, `api/intent/index.ts:72`, `api/intent/index.ts:73`, `src/services/intent.ts:150`.
   - Why it matters: If the model endpoint is down, invalid, or schema-invalid, `handleIntentRequest` returns HTTP 200 with the fixed `FALLBACK_INTENT`. The browser treats that as a valid endpoint result, so demo-critical prompts like "Which one is the screw with the washer?" become `unknown` instead of falling back to `parsePresetIntent`.
   - Recommendation: Return a non-2xx status for model failures so `parseIntentWithEndpoint` falls back locally, or run the deterministic parser inside the endpoint using the posted manifest. Update `src/services/intent.endpoint.test.ts:228` and related endpoint-handler tests to expect deterministic behavior for the six demo utterances on model failure.

2. **WARN: Real app remote requests omit transcript and locale context.**
   - References: `src/App.tsx:64`, `src/services/intent.ts:144`, `src/services/intent.ts:145`, `README.md:147`.
   - Why it matters: The roadmap requires recent transcript and locale hints for the structured endpoint. The service supports them, and README claims they are sent, but the only app call site does not pass either field.
   - Recommendation: Pass `recentTranscript: liveStore.transcript.slice(-6)` and a locale hint into `parseIntent`. If locale is inferred from the utterance, expose a small shared helper instead of duplicating language detection.

3. **WARN: Remote STT/TTS use `VITE_OPENAI_API_KEY` in browser code.**
   - References: `src/services/stt.remote.ts:17`, `src/services/stt.remote.ts:36`, `src/services/tts.remote.ts:17`, `src/services/tts.remote.ts:35`.
   - Why it matters: `VITE_*` variables are bundled into the client, so a real OpenAI key would be exposed to users. This is also inconsistent with the endpoint, which correctly reads server-side `OPENAI_API_KEY` at `api/intent/index.ts:83`.
   - Recommendation: Do not call OpenAI directly from browser providers. Route remote STT/TTS through serverless endpoints or keep these providers unavailable placeholders until a server-side provider contract exists.

4. **WARN: Remote TTS cancellation does not cover fetch/synthesis in flight.**
   - References: `src/services/tts.remote.ts:53`, `src/services/tts.remote.ts:74`, `src/services/tts.remote.ts:82`.
   - Why it matters: Barge-in cancellation only pauses `currentAudio` after the audio element exists. If the user barges in while `fetch` is still synthesizing, playback can still start after cancellation. `speak()` also does not cancel a previous active audio before starting a new request.
   - Recommendation: Track an `AbortController` and generation token for remote TTS, call `cancel()` at the start of `speak()`, abort in-flight fetches, and prevent stale synthesized audio from playing after cancel.

5. **WARN: Remote STT can start recording after abort if permission resolves late.**
   - References: `src/services/stt.remote.ts:51`, `src/services/stt.remote.ts:55`, `src/services/stt.remote.ts:74`, `src/services/stt.remote.ts:86`.
   - Why it matters: `abort()` sets `aborted = true`, but if `getUserMedia()` resolves after abort, the code still creates and starts a `MediaRecorder`. This can leave microphone capture active after the voice controller thinks listening has stopped.
   - Recommendation: Check `aborted` immediately after `getUserMedia()` resolves; if true, stop tracks and do not create/start the recorder.

6. **WARN: Structured-output schema is duplicated and partially unused.**
   - References: `src/services/intent.schema.ts:17`, `api/intent/index.ts:84`, `src/services/intent.schema.ts:50`.
   - Why it matters: The exported JSON schema and endpoint model schema can drift. Runtime validation is stricter than both schemas for reply sentence count and manifest-bound fields.
   - Recommendation: Reuse `resolvedIntentJsonSchema` in the endpoint, then layer runtime validation for manifest-specific checks. Add a test that the endpoint schema and exported schema stay equal or are built from the same source.

7. **WARN: Client endpoint retry does not retry aborts/timeouts.**
   - References: `src/services/intent.ts:111`, `src/services/intent.ts:349`.
   - Why it matters: The plan allows one retry for transient failures within the 8-second budget. Current retry logic retries 5xx and `TypeError`, but not `AbortError`. That is acceptable if the timeout consumes the full budget, but it should be explicit and covered.
   - Recommendation: Either document "timeouts do not retry because they exhaust the budget" in code/tests, or treat early abort-like transient errors consistently if they can happen before the budget is exhausted.

8. **WARN: Provider docs and implementation disagree.**
   - References: `README.md:153`, `README.md:155`, `src/services/stt.remote.ts:21`, `src/services/tts.remote.ts:29`.
   - Why it matters: README says current remote STT/TTS placeholders are unavailable/no-op, but the code attempts real OpenAI calls when `VITE_OPENAI_API_KEY` is present.
   - Recommendation: Either update the docs to describe the real browser-side implementation after moving secrets server-side, or keep providers as safe placeholders and remove direct OpenAI calls from client code.

## Test Coverage Notes

Coverage is strong for the deterministic parser, schema validator, client endpoint failure modes, action routing, Web Speech STT/TTS, and voice-controller state transitions.

Missing or weak coverage:

- No integration test proves the real app passes `recentTranscript` and locale into `parseIntent`.
- Endpoint-handler tests currently assert `unknown` on model failure instead of the roadmap fallback behavior.
- Remote STT/TTS providers are mostly untested, including microphone denial timing, late abort, in-flight TTS cancel, and overlapping `speak()` calls.
- No test guards the exported JSON schema against endpoint schema drift.

## Recommended Fixes Before Merge

1. Make endpoint model failures trigger deterministic fallback for demo-critical utterances.
2. Pass recent transcript and locale from `App` into `parseIntent`.
3. Remove browser-exposed OpenAI keys from remote STT/TTS or route those providers through server-side endpoints.
4. Harden remote TTS/STT cancellation paths and add focused tests.
5. Share the structured intent schema between client validation and the endpoint.

After these changes, rerun `npm test` and `npm run build`. I was not able to run commands in this review session because the shell runner was unavailable, so this review is based on static inspection of the branch files.
