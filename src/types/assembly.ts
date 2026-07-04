export interface AssemblyManifest {
  id: string;
  name: string;
  parts: Part[];
  steps: Step[];
  cameraViews: Record<string, CameraView>;
  model?: ModelSource;
}

export interface ModelSource {
  glbPath: string;
}

export interface Part {
  id: string;
  code: string;
  label: string;
  meshName: string;
  meshNodes?: string[];
  quantity: number;
}

export interface Step {
  index: number;
  title: string;
  action: string;
  partsNeeded: Array<{ partId: string; quantity: number }>;
  cameraView: string;
  highlightParts: string[];
  commonMistake?: string;
  toolNeeded?: string;
  estMinutes?: number;
}

export interface CameraView {
  position: [number, number, number];
  target: [number, number, number];
  label: string;
}

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'acting'
  | 'speaking';

export type IntentType =
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

export interface Intent {
  type: IntentType;
  partQuery?: string;
  stepNumber?: number;
  viewQuery?: string;
  language: 'en' | 'fr';
  reply: string;
}

export interface ResolvedIntent extends Intent {
  partIds?: string[];
  viewKey?: string;
}

export interface TranscriptLine {
  id: string;
  speaker: 'user' | 'agent';
  text: string;
  timestamp: number;
  mentionedPartIds?: string[];
  language?: 'en' | 'fr';
}

export interface ViewerAPI {
  goToStep(index: number): void;
  highlight(partIds: string[], mode: 'pulse' | 'solid'): void;
  clearHighlights(): void;
  setCamera(viewKey: string, animateMs?: number): void;
  explode(level: 0 | 1 | 2): void;
  spinPart(partId: string): void;
}
