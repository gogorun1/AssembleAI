import { useAppStore } from '../store/useAppStore';

const PREVIEW_SETTLE_MS = 900;
const PREVIEW_DURATION_MS = 2800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function findViewerCanvas(): HTMLCanvasElement | null {
  return document.querySelector('.viewerStage canvas');
}

function pickRecorderMimeType(): string | undefined {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export async function recordViewerClip(
  canvas: HTMLCanvasElement,
  durationMs = PREVIEW_DURATION_MS
): Promise<string> {
  const stream = canvas.captureStream(24);
  const mimeType = pickRecorderMimeType();
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: Blob[] = [];

  return new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    recorder.onerror = () => reject(new Error('Preview capture failed'));
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve(URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || 'video/webm' })));
    };
    recorder.start(250);
    window.setTimeout(() => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, durationMs);
  });
}

export async function attachStepPreviewVideo(lineId: string, stepIndex: number): Promise<void> {
  await sleep(PREVIEW_SETTLE_MS);
  const canvas = findViewerCanvas();
  if (!canvas || typeof MediaRecorder === 'undefined') {
    return;
  }

  try {
    const previewVideoUrl = await recordViewerClip(canvas);
    useAppStore.getState().updateTranscriptLine(lineId, { previewVideoUrl, previewStep: stepIndex });
  } catch {
    // Headless CI / unsupported capture — reply text still renders.
  }
}

export function revokePreviewUrls(lines: Array<{ previewVideoUrl?: string }>): void {
  for (const line of lines) {
    if (line.previewVideoUrl) {
      URL.revokeObjectURL(line.previewVideoUrl);
    }
  }
}
