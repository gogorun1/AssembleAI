# Demo Checklist — Person C

> Quick-reference for presenters running the AssembleAI BILLY bookcase demo.
> Keep this open during rehearsal; tick off items as you go.

---

## 1. Pre-Demo Setup

- [ ] `npm install` — dependencies installed (no errors)
- [ ] `npm test` — all unit tests pass (expected: 22+ tests)
- [ ] `npm run build` — production build succeeds
- [ ] `npm run dev` — dev server starts on `http://localhost:5173`
- [ ] Chrome browser ready (required for Web Speech API / voice)
- [ ] Audio output working (TTS reads step instructions aloud)
- [ ] Microphone permitted (if voice demo — Chrome asks for mic permission on first Space-hold)
- [ ] Network mode decided:
  - **Online:** `VITE_INTENT_ENDPOINT` (intent) and `VITE_PHOTO_CHECK_ENDPOINT` (photo VLM) can be set for remote processing; both fall back gracefully.
  - **Offline:** No endpoints needed — local intent parser handles all six critical utterances and photo check uses the built-in mock.

---

## 2. Happy Path Script

### Step 1 — Introduction
- [ ] App loads, splash screen shows "calibrating…" then fades
- [ ] 3D model visible on the viewer stage
- [ ] Right rail shows: progress rail, step card, presenter panel, parts list, transcript
- [ ] Welcome transcript shows: *"I have the BILLY bookcase loaded…"*

### Step 2 — Presenter-Driven Demo (no voice)

| Action | Expected Outcome |
|---|---|
| **Next step** → | Step advances; view/highlights update; transcript shows agent reply |
| **Which screw?** → | Correct cam screw/washer highlighted in model and parts rail |
| **Back view** → | Camera moves to rear/back-panel view |
| **Common mistake** → | Transcript shows common-mistake guidance for current step |
| **Repeat** → | Current step instruction repeated in transcript |
| **Where does it go?** → | Placement guidance shown for current step |

### Step 3 — Voice Demo (optional, Chrome only)
- [ ] Hold **Space** → voice orb pulses (listening state)
- [ ] Say *"Which screw should I use?"* → correct part highlights
- [ ] Say *"Show me the back view"* → camera moves
- [ ] Say *"What's next?"* → step advances
- [ ] Release **Space** → orb returns to idle

### Step 4 — Keyboard Navigation
- [ ] **Arrow Right** → next step
- [ ] **Arrow Left** → previous step
- [ ] **1–9** → jump to step N

---

## 3. Recovery / Reset

### Full Reset (`Presenter Mode > Full reset`)
- [ ] Cancels any active TTS / STT
- [ ] Returns to **Step 1**
- [ ] Voice state: `idle`
- [ ] Explode level: `1`
- [ ] Active view: first step's camera view
- [ ] Transcript restored to welcome line (one entry)
- [ ] Toast shown: *"Demo reset to opening state."*
- [ ] Event log cleared

### Rehearsal Reset (`Presenter Mode > Rehearsal reset`)
- [ ] Cancels any active TTS / STT
- [ ] Goes to **Step 1** (keeps transcript history)
- [ ] Clears highlights
- [ ] Resets explode level to `1`
- [ ] Toast shown: *"Rehearsal reset complete."*

### Presenter Fallback (if voice fails)
- [ ] All critical utterances available as clickable buttons
- [ ] No microphone required — mouse-only demo works end-to-end
- [ ] If Web Speech API unavailable, toast shows: *"Voice needs Chrome — click steps and parts instead."*

### WebGL / 3D Viewer Fallback
- [ ] If 3D viewer fails to load: check browser WebGL support, restart browser, try Chrome
- [ ] Demo can still proceed with step cards, parts list, and transcript — viewer failure does not block the happy path

---

## 4. Photo Validation Demo

> Photo Check is a working UI shell with a manifest-aware mock. It swaps to a real VLM endpoint (Person B track) via `VITE_PHOTO_CHECK_ENDPOINT` with no UI change.

- [ ] `PhotoCheckPanel` is visible in the right rail below Presenter Mode
- [ ] Presenter can:
  1. Click **Choose photo** and pick any image (`image/*`)
  2. See the image preview
  3. Click **Check photo**
  4. See mock validation result badge (Looks right / Double-check / Looks wrong / Unclear) with confidence
  5. Click **Highlight parts** on a finding to flash referenced parts in the viewer and rail
  6. Click the recommended utterance button to ask a follow-up
- [ ] Mock response works without any endpoint configured (network-off safe)
- [ ] Mock alternates outcome by step parity: odd steps with a common mistake return a warning, even steps return a pass
- [ ] Real VLM endpoint can be swapped in later via `VITE_PHOTO_CHECK_ENDPOINT` without changing the UI contract

---

## 5. Debug Overlay & Event Log

### Debug Overlay
- [ ] Press **D** to toggle the debug overlay (top-left)
- [ ] Overlay shows live state: step, voice state, active view, explode level, selected/highlighted/mentioned parts, event count
- [ ] Overlay lists the newest 20 events
- [ ] **Copy debug bundle** copies full state + event log JSON to clipboard
- [ ] **Clear event log** empties the log
- [ ] Overlay is hidden by default so it never appears on stage accidentally

### Event Log
- [ ] Event log records: `utterance`, `intent`, `step_change`, `reset`, `photo_check`
- [ ] Each event has: `id` (UUID), `type`, `label`, `timestamp`, optional `payload`
- [ ] Log is capped at **100 entries** (oldest dropped automatically)
- [ ] `clearEventLog()` empties the log
- [ ] `resetDemoState()` also clears the log
- [ ] Log is in-memory only (not persisted — privacy safe for stage demos)

---

## 6. Daily Sync Checklist

> From the Person C roadmap — items to verify before each demo day or after merging new work.

- [ ] **Stable part IDs** — no part ID renames in manifest (breaks log analysis)
- [ ] **ResolvedIntent semantics** — no new required fields added without updating `executeIntent`
- [ ] **Viewer command compatibility** — `goToStep`, `setCamera`, `highlight`, `clearHighlights`, `explode`, `spinPart` all work
- [ ] **Six critical utterances** present in `presenterUtterances.ts`:
  - [ ] Next step
  - [ ] Which screw
  - [ ] Where does it go
  - [ ] Back view
  - [ ] Common mistake
  - [ ] Repeat
- [ ] **Network-off demo** — `npm run dev` with no endpoints configured; local intent parser + mock photo check must work
- [ ] **Recover without touching code** — Full reset and rehearsal reset buttons work; presenter does not need a terminal or editor

---

## 7. Build & Test Verification

```bash
# Run before any demo
npm test          # All tests pass (vitest)
npm run build     # TypeScript + Vite build succeeds (no errors)
npm run test:e2e  # Playwright smoke tests pass (starts dev server automatically)
```

**Known good configuration:**
- Node 20+
- Chrome (latest)
- Windows / macOS / Linux

---

*Last updated: 2026-07-04 (Person C: photo validation, debug overlay, CI)*
