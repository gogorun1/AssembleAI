import { create } from 'zustand';
import manifest from '../data/manifest';
import { revokePreviewUrls } from '../services/viewerCapture';
import type {
  AssemblyManifest,
  TranscriptLine,
  ViewerAPI,
  VoiceState
} from '../types/assembly';

interface ToastState {
  id: string;
  message: string;
}

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

interface AppState {
  manifest: AssemblyManifest;
  currentStep: number;
  voiceState: VoiceState;
  transcript: TranscriptLine[];
  mentionedPartIds: string[];
  highlightedPartIds: string[];
  activeViewKey: string;
  /** Bumped whenever a camera preset is (re)requested, so the rig animates once
   *  and then hands control back to the user's orbit/zoom. */
  cameraNonce: number;
  /** Pull camera closer to target for step/detail views (1 = full preset distance). */
  cameraFocusScale: number;
  explodeLevel: 0 | 1 | 2;
  selectedPartId?: string;
  selectedBinId?: string;
  toast?: ToastState;
  viewer?: ViewerAPI;
  firstVoiceInteraction: boolean;
  eventLog: DemoEvent[];
  resetDemoState(): void;
  setViewer(viewer: ViewerAPI): void;
  goToStep(index: number): void;
  nextStep(): void;
  previousStep(): void;
  setVoiceState(state: VoiceState): void;
  addTranscript(line: Omit<TranscriptLine, 'id' | 'timestamp'>): string;
  updateTranscriptLine(id: string, patch: Partial<TranscriptLine>): void;
  mentionPart(partId: string): void;
  setHighlightedParts(partIds: string[]): void;
  clearHighlights(): void;
  setActiveView(viewKey: string, options?: { focus?: boolean }): void;
  setExplodeLevel(level: 0 | 1 | 2): void;
  selectPart(partId?: string): void;
  selectBin(binId?: string): void;
  showToast(message: string): void;
  clearToast(): void;
  markVoiceInteraction(): void;
  logEvent(event: Omit<DemoEvent, 'id' | 'timestamp'>): void;
  clearEventLog(): void;
}

const mentionTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Auto-clears the "selected" part so it stops spinning / hides its annotation
// after a short beat instead of spinning forever.
let selectTimer: ReturnType<typeof setTimeout> | undefined;
const SELECT_DURATION_MS = 3000;

function createWelcomeTranscript(): TranscriptLine {
  return {
    id: 'welcome',
    speaker: 'agent',
    text: 'I have the BILLY 40x28x202 bookcase loaded. Hold space and ask which part to use, where it goes, or what is next.',
    timestamp: Date.now(),
    mentionedPartIds: [],
    skipPreview: true
  };
}

function focusScaleForView(viewKey: string, focus?: boolean): number {
  if (focus === false) {
    return 1;
  }
  if (focus === true) {
    return 0.72;
  }
  if (/(detail|prep|anchor|nails|assembly|rail)/.test(viewKey)) {
    return 0.74;
  }
  return 1;
}

export const useAppStore = create<AppState>((set, get) => ({
  manifest,
  currentStep: 1,
  voiceState: 'idle',
  transcript: [createWelcomeTranscript()],
  mentionedPartIds: [],
  highlightedPartIds: manifest.steps[0].highlightParts,
  activeViewKey: manifest.steps[0].cameraView,
  cameraNonce: 0,
  cameraFocusScale: 0.76,
  explodeLevel: 0,
  firstVoiceInteraction: false,
  eventLog: [],
  resetDemoState() {
    for (const timer of mentionTimers.values()) {
      clearTimeout(timer);
    }
    mentionTimers.clear();
    if (selectTimer) {
      clearTimeout(selectTimer);
      selectTimer = undefined;
    }
    revokePreviewUrls(get().transcript);
    set({
      currentStep: 1,
      voiceState: 'idle',
      transcript: [createWelcomeTranscript()],
      mentionedPartIds: [],
      highlightedPartIds: manifest.steps[0].highlightParts,
      activeViewKey: manifest.steps[0].cameraView,
      cameraNonce: get().cameraNonce + 1,
      cameraFocusScale: 0.76,
      explodeLevel: 0,
      selectedPartId: undefined,
      selectedBinId: undefined,
      toast: undefined,
      firstVoiceInteraction: false,
      eventLog: []
    });
  },
  setViewer(viewer) {
    set({ viewer });
  },
  goToStep(index) {
    const stepIndex = Math.max(1, Math.min(index, manifest.steps.length));
    const step = manifest.steps[stepIndex - 1];
    // The <Viewer /> subscribes to these fields directly, so a single set()
    // drives the camera + highlights; the imperative ViewerAPI calls were
    // redundant double-writes. Explode level is left to the user's control.
    set((state) => ({
      currentStep: stepIndex,
      activeViewKey: step.cameraView,
      highlightedPartIds: step.highlightParts,
      cameraFocusScale: 0.76,
      cameraNonce: state.cameraNonce + 1
    }));
    get().logEvent({ type: 'step_change', label: `Step ${stepIndex}`, payload: { step: stepIndex } });
  },
  nextStep() {
    get().goToStep(get().currentStep + 1);
  },
  previousStep() {
    get().goToStep(get().currentStep - 1);
  },
  setVoiceState(voiceState) {
    set({ voiceState });
  },
  addTranscript(line) {
    const id = crypto.randomUUID();
    const previewStep = line.previewStep ?? (line.speaker === 'agent' ? get().currentStep : undefined);
    const entry: TranscriptLine = {
      ...line,
      id,
      timestamp: Date.now(),
      previewStep
    };
    set((state) => ({
      transcript: [...state.transcript, entry]
    }));

    if (line.speaker === 'agent' && !line.skipPreview && previewStep) {
      void import('../services/viewerCapture').then(({ attachStepPreviewVideo }) =>
        attachStepPreviewVideo(id, previewStep)
      );
    }

    return id;
  },
  updateTranscriptLine(id, patch) {
    set((state) => ({
      transcript: state.transcript.map((line) => (line.id === id ? { ...line, ...patch } : line))
    }));
  },
  mentionPart(partId) {
    if (mentionTimers.has(partId)) {
      clearTimeout(mentionTimers.get(partId));
    }

    // Only track the ephemeral "mention" flash here. Persistent highlighting is
    // driven separately by highlightedPartIds so mentions don't accumulate.
    set((state) => ({
      mentionedPartIds: Array.from(new Set([...state.mentionedPartIds, partId]))
    }));

    mentionTimers.set(
      partId,
      setTimeout(() => {
        set((state) => ({
          mentionedPartIds: state.mentionedPartIds.filter((id) => id !== partId)
        }));
        mentionTimers.delete(partId);
      }, 2000)
    );
  },
  setHighlightedParts(partIds) {
    set({ highlightedPartIds: partIds });
    get().viewer?.highlight(partIds, 'solid');
  },
  clearHighlights() {
    set({ highlightedPartIds: [] });
    get().viewer?.clearHighlights();
  },
  setActiveView(viewKey, options) {
    set((state) => ({
      activeViewKey: viewKey,
      cameraFocusScale: focusScaleForView(viewKey, options?.focus),
      cameraNonce: state.cameraNonce + 1
    }));
  },
  setExplodeLevel(level) {
    set({ explodeLevel: level });
    get().viewer?.explode(level);
  },
  selectPart(partId) {
    if (selectTimer) {
      clearTimeout(selectTimer);
      selectTimer = undefined;
    }
    set({ selectedPartId: partId });
    if (partId) {
      selectTimer = setTimeout(() => {
        set({ selectedPartId: undefined });
        selectTimer = undefined;
      }, SELECT_DURATION_MS);
    }
  },
  selectBin(binId) {
    set({ selectedBinId: binId });
  },
  showToast(message) {
    set({ toast: { id: crypto.randomUUID(), message } });
  },
  clearToast() {
    set({ toast: undefined });
  },
  markVoiceInteraction() {
    set({ firstVoiceInteraction: true });
  },
  logEvent(event) {
    set((state) => ({
      eventLog: [
        ...state.eventLog,
        { ...event, id: crypto.randomUUID(), timestamp: Date.now() }
      ].slice(-100)
    }));
  },
  clearEventLog() {
    set({ eventLog: [] });
  }
}));
