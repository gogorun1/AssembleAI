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

interface CameraMoveState {
  viewKey: string;
  requestId: number;
  animateMs: number;
}

export interface AppState {
  manifest: AssemblyManifest;
  currentStep: number;
  voiceState: VoiceState;
  transcript: TranscriptLine[];
  mentionedPartIds: string[];
  highlightedPartIds: string[];
  activeViewKey: string;
  cameraMove: CameraMoveState;
  explodeLevel: 0 | 1 | 2;
  selectedPartId?: string;
  toast?: ToastState;
  viewer?: ViewerAPI;
  firstVoiceInteraction: boolean;
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
}

const mentionTimers = new Map<string, ReturnType<typeof setTimeout>>();
const initialViewKey = manifest.steps[0].cameraView;

function nextCameraMove(state: AppState, viewKey: string, animateMs = 800): CameraMoveState {
  return {
    viewKey,
    requestId: state.cameraMove.requestId + 1,
    animateMs
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  manifest,
  currentStep: 1,
  voiceState: 'idle',
  transcript: [
    {
      id: 'welcome',
      speaker: 'agent',
      text: 'I have the BILLY bookcase loaded. Hold space and ask which part to use, where it goes, or what is next.',
      timestamp: Date.now(),
      mentionedPartIds: []
    }
  ],
  mentionedPartIds: [],
  highlightedPartIds: manifest.steps[0].highlightParts,
  activeViewKey: initialViewKey,
  cameraMove: {
    viewKey: initialViewKey,
    requestId: 0,
    animateMs: 0
  },
  explodeLevel: 1,
  firstVoiceInteraction: false,
  resetDemoState() {
    for (const timer of mentionTimers.values()) {
      clearTimeout(timer);
    }
    mentionTimers.clear();
    set({
      currentStep: 1,
      voiceState: 'idle',
      transcript: [],
      mentionedPartIds: [],
      highlightedPartIds: manifest.steps[0].highlightParts,
      activeViewKey: initialViewKey,
      cameraMove: {
        viewKey: initialViewKey,
        requestId: 0,
        animateMs: 0
      },
      explodeLevel: 1,
      selectedPartId: undefined,
      toast: undefined,
      firstVoiceInteraction: false
    });
  },
  setViewer(viewer) {
    set({ viewer });
  },
  goToStep(index) {
    const stepIndex = Math.max(1, Math.min(index, manifest.steps.length));
    const step = manifest.steps[stepIndex - 1];
    set((state) => ({
      currentStep: stepIndex,
      activeViewKey: step.cameraView,
      cameraMove: nextCameraMove(state, step.cameraView),
      highlightedPartIds: step.highlightParts,
      explodeLevel: stepIndex === manifest.steps.length ? 0 : 1
    }));
    get().viewer?.goToStep(stepIndex);
    get().viewer?.setCamera(step.cameraView, 800);
    get().viewer?.highlight(step.highlightParts, 'pulse');
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
    set((state) => ({
      activeViewKey: viewKey,
      cameraMove: nextCameraMove(state, viewKey)
    }));
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
  }
}));
