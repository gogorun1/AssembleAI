# AssembleAI Product Spec

## 1. Product Summary

AssembleAI is a voice and 3D assembly copilot for furniture assembly. The user has occupied hands, so speech is the primary input and spatial feedback is the primary output. The app answers by changing the model first: camera moves, parts highlight, steps advance, and the spoken response confirms the visual answer.

The current implementation is a single-furniture hackathon demo for a BILLY-style bookcase. It is driven by a hand-authored manifest and does not parse PDF manuals at runtime.

## 2. Goals

- Let a user complete the full bookcase walkthrough with voice only.
- Let the same walkthrough work with clicks and keyboard only.
- Keep current step, parts, common mistake, and transcript visible at all times.
- Make part references memorable through Orange Sync: 3D part, PartChip, and transcript mention highlight together.
- Keep the demo robust when Web Speech or WebGL is unavailable.

## 3. Non-Goals

- Runtime PDF manual parsing.
- Multi-furniture catalog.
- Accounts, persistence, teams, or permissions.
- Mobile-first layout.
- Video input.
- Production LLM, TTS, or VLM infrastructure inside this repo.

## 4. Primary User Flow

1. User opens the demo on a laptop or projector.
2. Splash screen clears after voices are preloaded.
3. User sees the 3D bookcase and the right-side agent rail.
4. User holds space or the VoiceOrb and asks a question.
5. STT captures the utterance.
6. Intent service resolves the command.
7. Viewer/step state updates immediately.
8. Transcript logs the user question and agent answer.
9. TTS speaks the answer.
10. User continues by voice, keyboard, or clicking the UI.

## 5. Demo-Critical Utterances

These utterances must resolve deterministically even without a remote LLM endpoint:

| Utterance | Expected intent | Viewer behavior |
| --- | --- | --- |
| `Which one is the screw with the washer?` | `which_part` | Spin/select `cam-screw-washer`, highlight chip/model/transcript |
| `Where does this panel go?` | `where_does_it_go` | Use current step camera and highlight relevant panel |
| `Show me from the back.` | `show_angle` | Move to `back-panel` camera |
| `What's next?` | `next_step` | Advance one step |
| `Did people mess this step up before?` | `common_mistake` | Show common mistake and highlight relevant part |
| `Et cette vis, elle va ou ?` | `where_does_it_go` | Reply in French and show `cam-screw-washer` |

## 6. Data Model

The demo is driven by `src/data/billy.manifest.json`.

Important manifest requirements:

- `id`: stable product id.
- `name`: display name.
- `parts`: part id, code, label, mesh name, quantity.
- `steps`: 1-based ordered assembly steps.
- `cameraViews`: named camera presets.

The current manifest includes:

- 13 part records.
- 9 assembly steps.
- 6 steps with common mistakes.
- Manual-style part codes such as `117327` and `M3.5x16`.

## 7. Intent Contract

The intent contract lives in `src/types/assembly.ts`.

```ts
type IntentType =
  | 'next_step'
  | 'prev_step'
  | 'goto_step'
  | 'which_part'
  | 'where_does_it_go'
  | 'show_angle'
  | 'repeat'
  | 'how_many_left'
  | 'common_mistake'
  | 'help'
  | 'unknown';
```

`ResolvedIntent` adds optional `partIds` and `viewKey` after parsing/resolution.

If `VITE_INTENT_ENDPOINT` is set, `services/intent.ts` posts:

- raw utterance
- current step
- parts list
- steps list

If the endpoint fails or times out, the app returns an `unknown` intent rather than crashing.

## 8. Viewer Command Contract

The app communicates with the 3D viewer only through this API:

```ts
interface ViewerAPI {
  goToStep(index: number): void;
  highlight(partIds: string[], mode: 'pulse' | 'solid'): void;
  clearHighlights(): void;
  setCamera(viewKey: string, animateMs?: number): void;
  explode(level: 0 | 1 | 2): void;
  spinPart(partId: string): void;
}
```

The current viewer uses:

- R3F canvas and drei controls.
- Manifest-driven GLB loading for `/models/billy.glb`.
- Mesh-node mapping from manifest part ids to model nodes.
- Hand-authored primitive part layouts as the model fallback.
- Step-dependent assembled/exploded poses.
- Camera and mesh debug overlays through `?camDebug=1` and `?meshDebug=1`.
- Camera smoothing with reduced-motion fallback.
- WebGL error boundary with a 2D manual-style fallback.

## 9. Voice State Machine

```text
idle
  -> listening
  -> transcribing
  -> thinking
  -> acting
  -> speaking
  -> idle
```

Rules:

- Pressing push-to-talk during `speaking` cancels TTS.
- If STT is unavailable, a toast tells the user to use click/keyboard controls.
- If no speech arrives in 5 seconds, listening returns to idle.
- Visual state is shown by the VoiceOrb.

## 10. UI Components

- `StepCard`: current step, action, tool/time, common mistake strip.
- `PartChip`: part code, label, quantity, mentioned/done/active states.
- `ProgressRail`: step ticks and current fraction.
- `TranscriptPanel`: user/agent log and underlined part mentions.
- `VoiceOrb`: push-to-talk state and first-use hint.
- `Toast`: system fallback messages.
- `Viewer`: 3D scene or WebGL fallback.

## 11. Design System

All colors, spacing, typography, radii, and motion values are tokens in `src/styles/tokens.css`.

Design intent:

- Drafting paper background.
- Blue-black ink.
- Mono part codes.
- Squarish controls.
- One active color: safety orange.
- No decorative gradient/orb backgrounds.
- Borders over heavy shadows.

The only intended prominent shadow is the VoiceOrb.

## 12. Acceptance Criteria

Current demo acceptance:

- `npm test` passes.
- `npm run build` passes.
- Six demo utterances map to the expected intents.
- Full walkthrough works with click/keyboard controls.
- WebGL failure does not blank the UI.
- Part mention triggers store-level Orange Sync.
- Component CSS does not hardcode color hex values outside token definitions.

Real demo acceptance is defined in `docs/specs/real-demo-roadmap.md`.
