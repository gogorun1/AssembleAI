# AssembleAI

Voice-first + 3D copilot for furniture assembly (a BILLY-style bookcase demo).
Ask questions by voice/text; the 3D model answers by moving (camera flights,
part highlights, step animations) plus a short spoken reply.

## Cursor Cloud specific instructions

**Stack / where things live**
- React 18 + Vite + TypeScript single-page app. 3D via `@react-three/fiber` +
  `@react-three/drei`; app state in one `zustand` store (`src/store/useAppStore.ts`).
- The only interface to three.js is the `ViewerAPI` (`src/viewer/useViewerCommands.ts`);
  everything else drives the model through it.
- The bookcase is built procedurally from primitives (`src/viewer/parts.ts`) — there is
  **no GLTF asset**. Part `meshName`s line up with `src/data/billy.manifest.json`, which
  is the single source of truth for parts, steps, and camera presets.

**Run / build / test** (package manager is `pnpm`)
- Dev server: `pnpm dev` → http://localhost:5173 (Vite HMR).
- `pnpm build` (runs `tsc -b` then `vite build`), `pnpm lint`, `pnpm typecheck`.
- There is no automated test suite; verify changes by running the dev server and
  driving the UI.

**Non-obvious gotchas**
- Voice input uses the Web Speech API (`webkitSpeechRecognition`, Chrome-only) and needs
  a real microphone. In the cloud VM / headless Chrome there is no mic, so drive the full
  intent → viewer → reply pipeline through the on-screen **"type a command…"** input, or
  the click paths: progress-rail ticks = go-to-step, part chips = which-part, the ⚠ strip
  on the step card = common-mistake. Keyboard: space = push-to-talk, ←/→ = prev/next step,
  1–9 = go-to-step.
- Intent parsing (`src/services/intent.ts`) uses a deterministic **local parser** when no
  LLM key is set — this is what makes the demo work with zero setup. Set
  `VITE_OPENAI_API_KEY` (and optionally `VITE_INTENT_MODEL`) to use an LLM instead; any
  LLM error/timeout falls back to the local parser automatically.
- TTS uses Web Speech `speechSynthesis`; voices load asynchronously and may be silent in a
  headless VM even though the state machine still advances normally.
- `esbuild`'s install script is enabled via `pnpm.onlyBuiltDependencies` in `package.json`
  (Vite needs it). If you ever wipe `node_modules`, reinstall with `pnpm install`.
