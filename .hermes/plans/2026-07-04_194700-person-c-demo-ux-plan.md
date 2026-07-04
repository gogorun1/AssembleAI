# Person C Demo UX / Photo Validation / QA Implementation Plan

> **For Hermes:** coding tasks should be delegated to Claude Code, then Hermes verifies git diff and test output.

**Goal:** Build the Person C track for AssembleAI: make the live demo presentable, recoverable, testable, and measurable without blocking Person A/B.

**Architecture:** Keep the existing app contracts stable (`ViewerAPI`, `ResolvedIntent`, `src/types/assembly.ts`, manifest part IDs, step indexes, camera view keys). Add Person C features as small UI/service/test layers around the current `App.tsx` + Zustand store. Prefer mockable, local-only scaffolding first; wire real VLM/ops later.

**Tech Stack:** React 18, TypeScript, Vite, Zustand, Vitest, future Playwright smoke tests, existing CSS modules/global CSS.

---

## 1. Current Repo Context

### Key files already present

- `src/App.tsx`
  - Main shell and orchestration point.
  - Already has `runUtterance(text)`, `executeIntent(intent)`, keyboard shortcuts, bottom controls, right rail.
  - Current reset button only calls `store.goToStep(1)`, not a full demo reset.
- `src/store/useAppStore.ts`
  - Zustand store.
  - Already has `resetDemoState()`, but UI is not using it yet.
  - Tracks step, transcript, highlighted/mentioned parts, active view, explode level, selected part, toast.
- `src/services/intent.ts`
  - Local intent parser with optional `VITE_INTENT_ENDPOINT`.
  - Useful for Presenter Mode buttons because they can call `runUtterance(...)` instead of duplicating intent behavior.
- `src/types/assembly.ts`
  - Shared contract types. Should not be casually changed.
- `src/components/*`
  - Existing UI pieces: `PartChip`, `ProgressRail`, `StepCard`, `Toast`, `TranscriptPanel`, `VoiceOrb`.
- `docs/specs/real-demo-roadmap.md`
  - Person C responsibilities and merge order.

### Person C mission from roadmap

Make the demo:

1. **Presentable** — presenter can drive it with buttons, not just voice.
2. **Recoverable** — presenter can reset/rehearse without touching code.
3. **Measurable** — smoke tests, event log, debug overlay, CI.
4. **Extensible** — photo validation UI shell ready for Person B's real VLM endpoint.

---

## 2. Person C Scope and Non-Scope

### In scope

- Presenter mode buttons for all critical utterances.
- Full reset/rehearsal controls.
- `DemoChecklist.md`.
- Browser smoke test scaffold.
- Photo-check UI shell with mocked structured response.
- Debug overlay.
- Local event log.
- CI workflow for build/test/smoke when feasible.

### Out of scope for first PR

- Real VLM endpoint implementation — Person B dependency.
- GLB/model viewer replacement — Person A dependency.
- Changing shared contracts unless absolutely necessary.
- Rewriting app architecture.

---

## 3. Recommended PR / Phase Split

## Phase 0 — Demo Hardening PR

**Purpose:** Land first because roadmap says Person C scaffolding should merge before A/B.

Deliverables:

1. Presenter Mode panel.
2. Full reset / rehearsal controls.
3. Demo checklist doc.
4. Basic smoke-test setup.
5. Minimal event logging hooks.

Acceptance:

- Presenter can run the demo with mouse only.
- Full reset returns to a predictable opening state.
- Existing `npm test` and `npm run build` pass.
- No changes to `ViewerAPI`, `ResolvedIntent`, part IDs, step indexes, or camera view keys.

## Phase 1 — Photo Validation UI Shell PR

Deliverables:

1. `src/services/photoCheck.ts` with mocked response and future endpoint boundary.
2. Photo upload component.
3. Validation result panel.
4. Tests for mock service and UI state.

Acceptance:

- User can choose/upload image.
- UI displays mocked validation result.
- Network-off demo still works.
- Endpoint can later be swapped to real VLM without changing UI contract.

## Phase 2 — QA / Operations PR

Deliverables:

1. Debug overlay.
2. Local event log viewer/copy button.
3. CI workflow.
4. More robust smoke tests.

Acceptance:

- Presenter can see current app state during rehearsal.
- Debug bundle can be copied/exported.
- CI catches broken build/test/smoke basics.

---

## 4. Detailed Phase 0 Plan — Demo Hardening

### Task 0.1 — Create Person C branch

**Objective:** Keep work isolated.

**Commands:**

```bash
cd ~/AssembleAI
git checkout main
git pull --ff-only
git checkout -b person-c-demo-hardening
```

**Verify:**

```bash
git branch --show-current
# expected: person-c-demo-hardening
```

---

### Task 0.2 — Add a stable list of critical presenter utterances

**Objective:** Centralize demo utterance buttons so UI and tests use the same data.

**Create:** `src/data/presenterUtterances.ts`

**Proposed shape:**

```ts
export interface PresenterUtterance {
  id: string;
  label: string;
  utterance: string;
  description: string;
}

export const presenterUtterances: PresenterUtterance[] = [
  {
    id: 'next-step',
    label: 'Next step',
    utterance: "What's next?",
    description: 'Advance to the next assembly step.'
  },
  {
    id: 'which-screw',
    label: 'Which screw?',
    utterance: 'Which screw should I use?',
    description: 'Highlight the correct screw/washer part.'
  },
  {
    id: 'where-goes',
    label: 'Where does it go?',
    utterance: 'Where does this part go?',
    description: 'Show placement guidance for current step.'
  },
  {
    id: 'back-view',
    label: 'Back view',
    utterance: 'Show me the back view.',
    description: 'Move camera to rear/back-panel view.'
  },
  {
    id: 'common-mistake',
    label: 'Common mistake',
    utterance: 'Did people mess this step up before?',
    description: 'Show common mistake for current step.'
  },
  {
    id: 'repeat',
    label: 'Repeat',
    utterance: 'Repeat that.',
    description: 'Repeat current step instruction.'
  }
];
```

**Tests:** Later use these IDs in smoke tests.

---

### Task 0.3 — Add `PresenterPanel` component

**Objective:** Presenter can trigger critical demo actions by clicking buttons.

**Create:**

- `src/components/PresenterPanel.tsx`
- `src/components/PresenterPanel.module.css`

**Props:**

```ts
interface PresenterPanelProps {
  utterances: PresenterUtterance[];
  onRunUtterance(text: string): void | Promise<void>;
  onFullReset(): void;
  onRehearsalReset(): void;
  disabled?: boolean;
}
```

**Behavior:**

- Renders section title: `Presenter Mode`.
- Renders one button per `presenterUtterances` item.
- Adds `data-testid="presenter-button-${id}"` for tests.
- Adds separate control buttons:
  - `Full reset`
  - `Rehearsal reset`
- Does not parse intents itself; calls `onRunUtterance(utterance)`.

**Integration point:** `src/App.tsx` right rail, likely between `StepCard` and `partRail`.

---

### Task 0.4 — Wire PresenterPanel into `App.tsx`

**Modify:** `src/App.tsx`

**Add imports:**

```ts
import { PresenterPanel } from './components/PresenterPanel';
import { presenterUtterances } from './data/presenterUtterances';
```

**Add callbacks:**

```ts
const fullReset = useCallback(() => {
  ttsRef.current.cancel();
  sttRef.current?.abort();
  clearTimeout(noSpeechTimer.current);
  store.resetDemoState();
  store.showToast('Demo reset to opening state.');
}, [store]);

const rehearsalReset = useCallback(() => {
  ttsRef.current.cancel();
  sttRef.current?.abort();
  clearTimeout(noSpeechTimer.current);
  store.goToStep(1);
  store.clearHighlights();
  store.setExplodeLevel(1);
  store.showToast('Rehearsal reset complete.');
}, [store]);
```

**Note:** Exact reset behavior should be verified against desired UX. `resetDemoState()` currently clears transcript entirely; decide whether opening welcome transcript should return.

**Replace existing reset button:** Current bottom reset button at `App.tsx:272` calls `store.goToStep(1)`. Consider changing it to `fullReset` or explicitly label it as `Go to first step`.

---

### Task 0.5 — Improve reset semantics in store if needed

**Modify:** `src/store/useAppStore.ts`

**Current issue:** `resetDemoState()` clears transcript to `[]`, while initial state starts with a welcome agent line. For stage demos, full reset should probably restore the welcome line.

**Suggested refactor:**

```ts
const createWelcomeTranscript = (): TranscriptLine => ({
  id: 'welcome',
  speaker: 'agent',
  text: 'I have the BILLY bookcase loaded. Hold space and ask which part to use, where it goes, or what is next.',
  timestamp: Date.now(),
  mentionedPartIds: []
});
```

Then use:

```ts
transcript: [createWelcomeTranscript()]
```

both in initial state and `resetDemoState()`.

**Test:** update/add store test verifying reset returns:

- `currentStep === 1`
- `voiceState === 'idle'`
- `explodeLevel === 1`
- `activeViewKey === manifest.steps[0].cameraView`
- transcript has welcome line, or intentionally empty if team decides so.

---

### Task 0.6 — Add basic event logging API

**Objective:** Establish a local event log without overbuilding the debug UI.

**Modify:** `src/store/useAppStore.ts`

**Add type:**

```ts
export interface DemoEvent {
  id: string;
  type:
    | 'utterance'
    | 'intent'
    | 'step_change'
    | 'reset'
    | 'photo_check'
    | 'viewer_command'
    | 'error';
  label: string;
  timestamp: number;
  payload?: Record<string, unknown>;
}
```

**Add state/actions:**

```ts
eventLog: DemoEvent[];
logEvent(event: Omit<DemoEvent, 'id' | 'timestamp'>): void;
clearEventLog(): void;
```

**Keep bounded:** last 100 or 200 events only.

```ts
logEvent(event) {
  set((state) => ({
    eventLog: [
      ...state.eventLog,
      { ...event, id: crypto.randomUUID(), timestamp: Date.now() }
    ].slice(-100)
  }));
}
```

**Where to log first:**

- `runUtterance(text)` logs `utterance`.
- `executeIntent(intent)` logs `intent`.
- `goToStep(index)` logs `step_change`.
- reset callbacks log `reset`.

---

### Task 0.7 — Add `DemoChecklist.md`

**Create:** `DemoChecklist.md` at repo root.

**Suggested sections:**

1. Pre-demo setup
   - `npm install`
   - `npm run dev`
   - Chrome browser ready
   - Audio/TTS verified
   - Network mode selected
2. Happy path script
   - Step 1: introduce BILLY bookcase
   - Presenter button: Which screw?
   - Presenter button: Back view
   - Presenter button: Common mistake
   - Next step / previous step
3. Recovery plan
   - Full reset button
   - Rehearsal reset button
   - If voice fails: use presenter buttons
   - If 3D/WebGL fails: fallback explanation
4. Photo validation demo placeholder
   - Use mock image
   - Explain real VLM endpoint pending Person B
5. Daily sync checklist copied from roadmap
   - stable part IDs
   - ResolvedIntent changes
   - viewer command semantics
   - six critical utterances
   - network-off demo
   - recover without touching code

---

### Task 0.8 — Add unit tests for store reset/event log

**Modify:** `src/store/useAppStore.test.ts`

**Test cases:**

1. `resetDemoState` returns state to opening state.
2. `logEvent` appends event with `id` and `timestamp`.
3. `clearEventLog` clears events.
4. `logEvent` caps log length to 100 if implemented.

**Command:**

```bash
npm test
```

**Expected:** all Vitest tests pass.

---

### Task 0.9 — Add browser smoke-test scaffold

**Objective:** Prepare QA automation for roadmap requirement.

**Preferred tool:** Playwright.

**Add dependency:**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

**Modify:** `package.json`

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

**Create:**

- `playwright.config.ts`
- `tests/smoke/demo.spec.ts`

**Smoke cases:**

1. App loads and shows viewer stage / right rail.
2. Step navigation works through next/previous controls.
3. Part click or presenter button produces transcript update/highlight.
4. Reset returns to step 1.
5. WebGL fallback path if existing Viewer supports fallback detection; otherwise add `TODO` and test basic render only.

**Important:** This may be Phase 0 or Phase 2 depending time. If dependency install is too much for first PR, create issue/TODO in `DemoChecklist.md` and keep Vitest only.

---

## 5. Detailed Phase 1 Plan — Photo Validation UI Shell

### Task 1.1 — Define photo-check types/service

**Create:** `src/services/photoCheck.ts`

**Types:**

```ts
export type PhotoCheckStatus = 'pass' | 'warning' | 'fail' | 'unknown';

export interface PhotoCheckFinding {
  id: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  detail: string;
  partIds?: string[];
  stepIndex?: number;
}

export interface PhotoCheckResult {
  status: PhotoCheckStatus;
  confidence: number;
  summary: string;
  findings: PhotoCheckFinding[];
  recommendedUtterance?: string;
}
```

**API:**

```ts
export async function checkAssemblyPhoto(input: {
  file: File;
  currentStep: number;
}): Promise<PhotoCheckResult> {
  const endpoint = import.meta.env.VITE_PHOTO_CHECK_ENDPOINT;
  if (!endpoint) {
    return mockPhotoCheck(input);
  }
  // POST FormData to endpoint later.
}
```

**Mock result example:**

- `status: 'warning'`
- summary: `The shelf looks mostly aligned, but check the cam screw orientation before tightening.`
- finding references `cam-screw-washer`.

---

### Task 1.2 — Add `PhotoCheckPanel`

**Create:**

- `src/components/PhotoCheckPanel.tsx`
- `src/components/PhotoCheckPanel.module.css`

**Props:**

```ts
interface PhotoCheckPanelProps {
  currentStep: number;
  onMentionParts(partIds: string[]): void;
  onRunUtterance(text: string): void | Promise<void>;
}
```

**Behavior:**

- File input accepts `image/*`.
- Shows selected image preview.
- Button: `Check photo`.
- Loading state.
- Displays result badge: pass/warning/fail.
- Displays findings list.
- If finding has `partIds`, button to highlight/mention those parts.
- If result has `recommendedUtterance`, button to ask it through `runUtterance`.

---

### Task 1.3 — Integrate photo UI into right rail

**Modify:** `src/App.tsx`

Place `PhotoCheckPanel` below `PresenterPanel` or below parts rail.

**Callbacks:**

```ts
const mentionParts = useCallback((partIds: string[]) => {
  const liveStore = useAppStore.getState();
  liveStore.setHighlightedParts(partIds);
  partIds.forEach((partId) => liveStore.mentionPart(partId));
}, []);
```

Log photo check result through event log if Phase 0 event log exists.

---

### Task 1.4 — Add service tests

**Create:** `src/services/photoCheck.test.ts`

**Cases:**

1. Without endpoint, `checkAssemblyPhoto` returns mock result.
2. Mock result includes status, confidence, summary, findings.
3. Endpoint failure should return graceful `unknown` or mock fallback, depending chosen behavior.

---

## 6. Detailed Phase 2 Plan — Debug / QA / CI

### Task 2.1 — Add `DebugOverlay`

**Create:**

- `src/components/DebugOverlay.tsx`
- `src/components/DebugOverlay.module.css`

**Props:**

```ts
interface DebugOverlayProps {
  enabled: boolean;
  onClose(): void;
}
```

**Reads from store:**

- `currentStep`
- `voiceState`
- `activeViewKey`
- `explodeLevel`
- `selectedPartId`
- `highlightedPartIds`
- `mentionedPartIds`
- `eventLog.length`

**Trigger:**

- Keyboard shortcut: `D` toggles overlay.
- Or presenter panel button: `Debug`.

---

### Task 2.2 — Add `EventLogPanel`

**Create:**

- `src/components/EventLogPanel.tsx`
- `src/components/EventLogPanel.module.css`

**Behavior:**

- Shows newest 20 events.
- Button: `Copy debug bundle`.
- Button: `Clear log`.

**Debug bundle JSON:**

```ts
{
  app: 'AssembleAI',
  generatedAt: new Date().toISOString(),
  currentStep,
  activeViewKey,
  voiceState,
  highlightedPartIds,
  selectedPartId,
  eventLog
}
```

Use `navigator.clipboard.writeText(JSON.stringify(bundle, null, 2))`.

---

### Task 2.3 — CI workflow

**Create:** `.github/workflows/ci.yml`

**Jobs:**

1. Checkout.
2. Setup Node 20 or 22.
3. `npm ci`.
4. `npm test`.
5. `npm run build`.
6. Optional Playwright smoke if dependency added:
   - `npx playwright install --with-deps chromium`
   - `npm run test:e2e`

---

## 7. Validation Matrix

| Area | Command / Action | Expected |
|---|---|---|
| TypeScript/build | `npm run build` | passes |
| Unit tests | `npm test` | passes |
| Dev server | `npm run dev` | app loads locally |
| Presenter next | click `Next step` | step increments and transcript updates |
| Presenter part | click `Which screw?` | correct part highlighted / transcript updates |
| Full reset | click `Full reset` | step 1, idle voice, default highlights/view/explode |
| Rehearsal reset | click `Rehearsal reset` | safe stage-ready state without code changes |
| Photo mock | upload image + check | mock result shown, no endpoint needed |
| Debug overlay | press/toggle debug | state visible |
| Event log | run utterance/reset | events recorded |
| Network-off demo | no endpoints configured | local parser + mock photo check works |

---

## 8. Risks and Mitigations

### Risk: Reset behavior surprises presenter

- **Problem:** `resetDemoState()` currently clears transcript.
- **Mitigation:** Decide whether full reset restores welcome transcript. Document exact behavior in `DemoChecklist.md`.

### Risk: Presenter buttons duplicate intent logic

- **Problem:** UI could drift from voice behavior.
- **Mitigation:** Buttons call `runUtterance(...)`; they do not directly mutate app state except reset/debug.

### Risk: Shared contracts change and block A/B

- **Problem:** Person A/B depend on stable `ViewerAPI`, `ResolvedIntent`, manifest IDs.
- **Mitigation:** Do not change `src/types/assembly.ts` unless agreed. Add photo types in `src/services/photoCheck.ts` first.

### Risk: Playwright adds setup friction

- **Problem:** Installing browser deps can slow team.
- **Mitigation:** Start with unit/build tests; add Playwright in separate commit/PR if needed.

### Risk: Debug overlay clutters demo UI

- **Problem:** Presenter could accidentally show debug overlay on stage.
- **Mitigation:** Hide behind shortcut/presenter-only toggle; default off.

---

## 9. Open Questions

1. Should full reset restore the welcome transcript or leave transcript empty?
2. Should Presenter Mode always be visible, or hidden behind a toggle/query param like `?presenter=1`?
3. What are the exact “six critical utterances” the team wants locked for demo?
4. Should photo-check UI live in the right rail or as a modal/drawer?
5. What should the fake photo-check mock say for the official demo script?
6. Is Playwright acceptable as a new dev dependency now, or should smoke tests be deferred?
7. Should event logs persist to `localStorage`, or remain in-memory for privacy/simplicity?

---

## 10. Suggested Claude Code Execution Order

When ready to implement, delegate to Claude Code in this order:

1. **Phase 0A:** `presenterUtterances` + `PresenterPanel` + App integration.
2. **Phase 0B:** full reset/rehearsal reset semantics + store tests.
3. **Phase 0C:** `DemoChecklist.md`.
4. **Phase 0D:** event log store API + minimal debug log tests.
5. **Phase 1A:** `photoCheck.ts` mock service + tests.
6. **Phase 1B:** `PhotoCheckPanel` + App integration.
7. **Phase 2A:** `DebugOverlay` + `EventLogPanel`.
8. **Phase 2B:** Playwright + CI.

Each Claude Code task should end with:

```bash
npm test
npm run build
```

If Playwright is added:

```bash
npm run test:e2e
```

---

## 11. Definition of Done for Person C Track

Person C is done when:

- [ ] Presenter can run all critical utterances by clicking buttons.
- [ ] Presenter can fully reset/rehearse without touching code.
- [ ] `DemoChecklist.md` documents setup, happy path, recovery, fallback copy.
- [ ] Photo validation UI shell works with mock response.
- [ ] Debug overlay shows current state.
- [ ] Event log records utterances, intents, step changes, reset, photo checks, errors.
- [ ] Unit tests pass.
- [ ] Build passes.
- [ ] Smoke tests exist or are documented as deferred.
- [ ] CI runs the agreed checks.
- [ ] No shared contracts changed without team agreement.
