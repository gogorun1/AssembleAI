import { create } from 'zustand';
import manifest from '../data/manifest';
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
  explodeLevel: 0 | 1 | 2;
  selectedPartId?: string;
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
  addTranscript(line: Omit<TranscriptLine, 'id' | 'timestamp'>): void;
  mentionPart(partId: string): void;
  setHighlightedParts(partIds: string[]): void;
  clearHighlights(): void;
  setActiveView(viewKey: string): void;
  setExplodeLevel(level: 0 | 1 | 2): void;
  selectPart(partId?: string): void;
  showToast(message: string): void;
  clearToast(): void;
  markVoiceInteraction(): void;
  logEvent(event: Omit<DemoEvent, 'id' | 'timestamp'>): void;
  clearEventLog(): void;
}

const mentionTimers = new Map<string, ReturnType<typeof setTimeout>>();

function createWelcomeTranscript(): TranscriptLine {
  return {
    id: 'welcome',
    speaker: 'agent',
    text: 'I have the BILLY bookcase loaded. Hold space and ask which part to use, where it goes, or what is next.',
    timestamp: Date.now(),
    mentionedPartIds: []
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  manifest,
  currentStep: 1,
  voiceState: 'idle',
  transcript: [createWelcomeTranscript()],
  mentionedPartIds: [],
  highlightedPartIds: manifest.steps[0].highlightParts,
  activeViewKey: manifest.steps[0].cameraView,
  explodeLevel: 1,
  firstVoiceInteraction: false,
  eventLog: [],
  resetDemoState() {
    for (const timer of mentionTimers.values()) {
      clearTimeout(timer);
    }
    mentionTimers.clear();
    set({
      currentStep: 1,
      voiceState: 'idle',
      transcript: [createWelcomeTranscript()],
      mentionedPartIds: [],
      highlightedPartIds: manifest.steps[0].highlightParts,
      activeViewKey: manifest.steps[0].cameraView,
      explodeLevel: 1,
      selectedPartId: undefined,
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
    set({
      currentStep: stepIndex,
      activeViewKey: step.cameraView,
      highlightedPartIds: step.highlightParts,
      explodeLevel: stepIndex === manifest.steps.length ? 0 : 1
    });
    get().viewer?.goToStep(stepIndex);
    get().viewer?.setCamera(step.cameraView, 800);
    get().viewer?.highlight(step.highlightParts, 'pulse');
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
    set((state) => ({
      transcript: [
        ...state.transcript,
        {
          ...line,
          id: crypto.randomUUID(),
          timestamp: Date.now()
        }
      ]
    }));
  },
  mentionPart(partId) {
    if (mentionTimers.has(partId)) {
      clearTimeout(mentionTimers.get(partId));
    }

    set((state) => ({
      mentionedPartIds: Array.from(new Set([...state.mentionedPartIds, partId])),
      highlightedPartIds: Array.from(new Set([...state.highlightedPartIds, partId]))
    }));

    get().viewer?.highlight([partId], 'pulse');

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
  setActiveView(viewKey) {
    set({ activeViewKey: viewKey });
    get().viewer?.setCamera(viewKey, 800);
  },
  setExplodeLevel(level) {
    set({ explodeLevel: level });
    get().viewer?.explode(level);
  },
  selectPart(partId) {
    set({ selectedPartId: partId });
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
