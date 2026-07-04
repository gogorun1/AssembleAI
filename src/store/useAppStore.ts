import { create } from 'zustand';
import manifestJson from '../data/billy.manifest.json';
import type { AssemblyManifest, Part, Step } from '../data/types';

const manifest = manifestJson as unknown as AssemblyManifest;

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'acting'
  | 'speaking';

export type Language = 'en' | 'fr';

export type HighlightMode = 'pulse' | 'solid';

export interface TranscriptLine {
  id: number;
  role: 'user' | 'agent';
  text: string;
  /** partIds referenced in this line — used for the orange underline (§7.4). */
  mentionedParts: string[];
  timestamp: number; // epoch ms
}

interface ViewerCommandState {
  /** Named camera preset key + a nonce so re-issuing the same view re-fires. */
  cameraViewKey: string;
  cameraAnimateMs: number;
  cameraNonce: number;

  explodeLevel: 0 | 1 | 2;

  highlightPartIds: string[];
  highlightMode: HighlightMode;

  /** Isolated part to slow-spin; nonce retriggers repeats. */
  spinPartId: string | null;
  spinNonce: number;
}

interface AppState {
  // ── data ──────────────────────────────────────────────
  manifest: AssemblyManifest;

  // ── assembly slice ────────────────────────────────────
  currentStepIndex: number; // 1-based
  completedSteps: number[];

  // ── voice slice ───────────────────────────────────────
  voiceState: VoiceState;
  language: Language;
  transcript: TranscriptLine[];

  // ── orange sync (§7.4) ────────────────────────────────
  /** The most recently mentioned part + a nonce so repeats re-fire the flash. */
  mentionedPartId: string | null;
  mentionNonce: number;

  // ── viewer slice ──────────────────────────────────────
  viewer: ViewerCommandState;

  // ── selectors / helpers ───────────────────────────────
  currentStep: () => Step;
  partById: (id: string) => Part | undefined;

  // ── assembly actions ──────────────────────────────────
  setStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  // ── voice actions ─────────────────────────────────────
  setVoiceState: (s: VoiceState) => void;
  setLanguage: (l: Language) => void;
  addTranscriptLine: (line: Omit<TranscriptLine, 'id' | 'timestamp'>) => void;

  // ── orange sync action ────────────────────────────────
  mention: (partId: string) => void;

  // ── viewer command mutations (used by ViewerAPI) ──────
  _setCamera: (viewKey: string, animateMs: number) => void;
  _setExplode: (level: 0 | 1 | 2) => void;
  _setHighlight: (partIds: string[], mode: HighlightMode) => void;
  _clearHighlights: () => void;
  _spinPart: (partId: string) => void;
}

const clampStep = (i: number) => Math.max(1, Math.min(manifest.steps.length, i));

let transcriptId = 0;

export const useAppStore = create<AppState>((set, get) => ({
  manifest,

  currentStepIndex: 1,
  completedSteps: [],

  voiceState: 'idle',
  language: 'en',
  transcript: [],

  mentionedPartId: null,
  mentionNonce: 0,

  viewer: {
    cameraViewKey: manifest.steps[0].cameraView,
    cameraAnimateMs: 0,
    cameraNonce: 0,
    explodeLevel: 0,
    highlightPartIds: [],
    highlightMode: 'pulse',
    spinPartId: null,
    spinNonce: 0,
  },

  currentStep: () =>
    get().manifest.steps.find((s) => s.index === get().currentStepIndex) ??
    get().manifest.steps[0],

  partById: (id) => get().manifest.parts.find((p) => p.id === id),

  setStep: (index) =>
    set((state) => {
      const next = clampStep(index);
      const completed = new Set(state.completedSteps);
      // mark every step before the new one as completed
      for (let i = 1; i < next; i++) completed.add(i);
      return { currentStepIndex: next, completedSteps: [...completed] };
    }),

  nextStep: () => get().setStep(get().currentStepIndex + 1),
  prevStep: () => get().setStep(get().currentStepIndex - 1),

  setVoiceState: (s) => set({ voiceState: s }),
  setLanguage: (l) => set({ language: l }),

  addTranscriptLine: (line) =>
    set((state) => ({
      transcript: [
        ...state.transcript,
        { ...line, id: ++transcriptId, timestamp: Date.now() },
      ],
    })),

  mention: (partId) =>
    set((state) => ({
      mentionedPartId: partId,
      mentionNonce: state.mentionNonce + 1,
    })),

  _setCamera: (viewKey, animateMs) =>
    set((state) => ({
      viewer: {
        ...state.viewer,
        cameraViewKey: viewKey,
        cameraAnimateMs: animateMs,
        cameraNonce: state.viewer.cameraNonce + 1,
      },
    })),

  _setExplode: (level) =>
    set((state) => ({ viewer: { ...state.viewer, explodeLevel: level } })),

  _setHighlight: (partIds, mode) =>
    set((state) => ({
      viewer: { ...state.viewer, highlightPartIds: partIds, highlightMode: mode },
    })),

  _clearHighlights: () =>
    set((state) => ({ viewer: { ...state.viewer, highlightPartIds: [] } })),

  _spinPart: (partId) =>
    set((state) => ({
      viewer: {
        ...state.viewer,
        spinPartId: partId,
        spinNonce: state.viewer.spinNonce + 1,
      },
    })),
}));
