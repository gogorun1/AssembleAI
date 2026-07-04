export interface Part {
  id: string; // "side-panel-left"
  code: string; // manual-style code shown in UI: "101532" or "M6×40"
  label: string; // "Side panel (left)"
  meshName: string; // node name inside the GLTF / procedural scene
  quantity: number;
}

export interface StepPartRef {
  partId: string;
  quantity: number;
}

export interface Step {
  index: number; // 1-based
  title: string; // "Attach the base"
  action: string; // one imperative sentence, spoken + shown
  partsNeeded: StepPartRef[];
  cameraView: string; // key into cameraViews
  highlightParts: string[]; // partIds to pulse when step opens
  commonMistake?: string;
  toolNeeded?: string;
  estMinutes?: number;
}

export interface CameraView {
  position: [number, number, number];
  target: [number, number, number];
  label: string;
}

export interface AssemblyManifest {
  id: string; // "billy-bookcase"
  name: string; // "BILLY Bookcase"
  parts: Part[];
  steps: Step[];
  cameraViews: Record<string, CameraView>;
}
