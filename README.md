# AssembleAI

Voice-first assembly assistance for furniture builders. AssembleAI turns a hand-authored assembly manifest into a spatial copilot: users can ask what part to use, where a panel goes, what the next step is, or what mistake to avoid, and the app responds by moving/highlighting the model plus speaking a short reply.

This repository currently contains a hackathon-grade single-page demo for a BILLY-style bookcase. It is intentionally honest about scope: the app does not parse PDF manuals at runtime, does not support multiple products, and does not include user accounts.

## Current Demo

The demo is optimized for a laptop or projector in a 16:9 layout:

- 3D viewport with a prebuilt bookcase model made from three.js primitives.
- Nine-step BILLY-style assembly manifest in `src/data/billy.manifest.json`.
- Step engine with next/previous/goto-step actions.
- Part chips with manual-style codes and quantities.
- Conversation transcript and current step card.
- Push-to-talk voice loop using the Web Speech API when available.
- Deterministic preset intent coverage for the hackathon script.
- Optional intent endpoint behind `VITE_INTENT_ENDPOINT`.
- Web Speech TTS through `speechSynthesis`.
- WebGL fallback line drawing so the UI still works when 3D context creation fails.

## Demo Script

Run the app, hold space, and try these prompts:

```text
Which one is the screw with the washer?
Where does this panel go?
Show me from the back.
What's next?
Did people mess this step up before?
Et cette vis, elle va ou ?
```

Every voice action also has a click or keyboard fallback:

- Space: hold to talk
- Left/Right arrows: previous/next step
- 1-9: jump to a step
- Progress ticks: jump to a step
- Part chips: highlight and identify that part
- Warning strip: ask for the common mistake

## Quick Start

```bash
npm install
npm run dev
```

Vite will print a local URL, usually:

```text
http://localhost:5173/
```

For a fixed demo port:

```bash
npm run dev -- --host 127.0.0.1 --port 5323
```

## Verification

```bash
npm test
npm run build
```

Current tests cover:

- Manifest integrity: step count, common mistakes, camera/part references, visible part codes.
- Preset intent coverage for the six critical demo utterances.
- Orange Sync store behavior for the two-second part mention flash.

## Tech Stack

- React 18
- Vite
- TypeScript
- three.js via `@react-three/fiber` and `@react-three/drei`
- Zustand
- Web Speech API for STT
- `speechSynthesis` for TTS
- CSS modules plus custom property design tokens

No router and no CSS framework are used.

## Architecture

```text
src/
  App.tsx                         Main orchestration and voice loop
  components/                     Step card, part chips, transcript, orb, toast
  data/billy.manifest.json        Hand-authored bookcase manifest
  services/intent.ts              Intent parser facade and preset demo parser
  services/stt.ts                 Web Speech STT wrapper
  services/tts.ts                 speechSynthesis wrapper
  store/useAppStore.ts            Zustand state and Orange Sync event
  styles/tokens.css               Product design tokens
  viewer/Viewer.tsx               R3F scene and WebGL fallback
  viewer/useViewerCommands.ts     Part layout and pose derivation
```

High-level flow:

```text
Push-to-talk
  -> STT transcript
  -> intent parser
  -> viewer and step commands
  -> transcript update
  -> TTS reply
```

The model response happens before speech starts. Speech confirms what the model already changed.

## Design Direction

The visual style is "the printed manual, electrified":

- Drafting paper surfaces.
- Blue-black ink linework.
- Mono part codes.
- Squarish cards and controls.
- Safety orange as the single active/highlight color.
- Borders instead of heavy shadows, with the VoiceOrb as the only elevated control.

See `src/styles/tokens.css` for the token source of truth.

## Environment Variables

```bash
VITE_INTENT_ENDPOINT=https://example.com/intent
```

If `VITE_INTENT_ENDPOINT` is present, `src/services/intent.ts` posts the utterance, current step, parts, and steps to that endpoint. The endpoint should return the `ResolvedIntent` shape described in `src/types/assembly.ts`.

If no endpoint is configured, the app uses deterministic local intent handling for the hackathon script.

## Current Limitations

- The "model" is a purpose-built three.js primitive scene, not an imported CAD/GLTF asset.
- Intent parsing is deterministic by default, with optional endpoint support but no production LLM backend included.
- Voice input depends on browser Web Speech support, strongest in Chrome.
- TTS uses browser voices unless replaced by a real provider.
- No photo checking, VLM validation, manual ingestion, catalog, persistence, or analytics.
- The demo is designed for desktop/projector, not mobile.

## Specs

- Product and implementation spec: `docs/specs/product-spec.md`
- Roadmap to a real demo: `docs/specs/real-demo-roadmap.md`

## Roadmap Summary

To make AssembleAI a real demo rather than a convincing hackathon prototype:

1. Replace primitive geometry with a real optimized 3D asset pipeline.
2. Add a real structured-output intent endpoint with part disambiguation.
3. Upgrade voice capture/TTS for reliable live stage use.
4. Add photo-based "did I do this right?" validation.
5. Build an authoring pipeline for manifests, camera views, and step animations.
6. Add observability, QA scripts, and a rehearsed presentation mode.

For parallel execution, split the next build into three workstreams:

- Person A: 3D asset and viewer pipeline.
- Person B: AI intent, voice, and speech providers.
- Person C: demo UX, photo validation, QA, and operations.

The detailed plan is in `docs/specs/real-demo-roadmap.md`.
