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
  /** IKEA manual diagram piece number (e.g. 1, 2, 3). */
  manualPiece?: number;
  /** Short manual figure label shown in UI and 3D annotations. */
  manualFig?: string;
}

export type ToolKind =
  | 'hands'
  | 'flat-screwdriver'
  | 'phillips'
  | 'pencil'
  | 'ruler'
  | 'hammer'
  | 'drill';

export type OperationMotion = 'press' | 'turn' | 'slide' | 'strike' | 'mark';

export interface StepOperation {
  id: string;
  label: string;
  partId: string;
  /** Specific hardware instance from partLayouts; omit to use part center. */
  primitiveId?: string;
  tool: ToolKind;
  motion: OperationMotion;
  /** Approach offset from anchor (hand/tool sits here, moves toward anchor). */
  approach?: [number, number, number];
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
  /** Manual illustration reference (e.g. "Fig. 3–4"). */
  manualFig?: string;
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
