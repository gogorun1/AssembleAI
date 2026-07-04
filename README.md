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
- Remote STT/TTS browser providers are placeholders until server-side speech endpoints exist.
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

## Local And Offline Mode

No remote credentials are required for the default demo. Leave `VITE_INTENT_ENDPOINT` unset and the app uses the deterministic local intent parser for the demo script, step navigation, part lookup, camera requests, and common-mistake prompts.

Voice capture and speech output use browser APIs by default. If STT is unavailable, the app surfaces a recoverable message and the click/keyboard controls continue to work.

## Verification

```bash
npm test
npm run build
```

Current tests cover:

- Manifest integrity: step count, common mistakes, camera/part references, visible part codes.
- Preset intent coverage for the six critical demo utterances.
- Orange Sync store behavior for the two-second part mention flash.
- Voice state behavior for push-to-talk, no-speech timeout, STT fallback, and TTS cancel.
- Intent action routing from `ResolvedIntent` to store/viewer behavior.

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
VITE_STT_PROVIDER=web-speech
VITE_TTS_PROVIDER=web-speech
# Server-side only; never expose this as VITE_OPENAI_API_KEY.
OPENAI_API_KEY=sk-...
```

If `VITE_INTENT_ENDPOINT` is present, `src/services/intent.ts` posts the utterance, current step, manifest parts, steps, camera views, recent transcript, and locale hint to that endpoint. The endpoint should return the `ResolvedIntent` shape described in `src/types/assembly.ts`; responses are schema-validated before the app acts on them.

Remote intent calls have an 8-second budget. Network failures and 5xx responses retry once within that budget, and any failure, timeout, non-2xx response, invalid JSON, or schema-invalid intent falls back to the deterministic local parser.

If no endpoint is configured, the app uses deterministic local intent handling for the hackathon script.

`VITE_STT_PROVIDER` defaults to `web-speech`. Set it to `remote` only after wiring a hosted speech-to-text provider through a server-side endpoint behind `src/services/stt.remote.ts`; the current browser placeholder is unavailable so demos fail safely without secrets.

`VITE_TTS_PROVIDER` defaults to `web-speech`. Set it to `remote` only after wiring a hosted text-to-speech provider through a server-side endpoint behind `src/services/tts.remote.ts`; the current browser placeholder is a no-op provider so visual actions still run.

## Fallback Order

The demo is designed to stay usable when network or browser voice features fail:

1. Click, keyboard, and presenter controls are the primary hard fallback.
2. With no `VITE_INTENT_ENDPOINT`, deterministic local intent handling resolves the supported demo utterances.
3. With remote intent configured, failures fall back to local intent behavior; remote STT/TTS stay as safe placeholders until server-side endpoints are added.

## Supported Browsers

Use a current Chromium browser, preferably Chrome, for the full Web Speech STT and `speechSynthesis` path. Safari, Firefox, and other browsers can still run the visual demo, click controls, keyboard controls, deterministic intent parser, and WebGL fallback, but browser speech recognition support may be unavailable.

## Current Limitations

- The "model" is a purpose-built three.js primitive scene, not an imported CAD/GLTF asset.
- Intent parsing is deterministic by default, with optional endpoint support but no production LLM backend included.
- Voice input depends on browser Web Speech support, strongest in Chrome.
- TTS uses browser voices unless replaced by a real server-backed provider.
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
