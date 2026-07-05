/**
 * Microphone selection helpers for routing voice control through an external
 * input device such as Ray-Ban Meta glasses paired as a Bluetooth (HFP) headset.
 *
 * Note on scope: the Web Speech API (`SpeechRecognition`) always listens to the
 * operating system's default input device and offers no per-device selection.
 * These helpers therefore focus on what the browser *can* do reliably:
 *  - request microphone permission,
 *  - enumerate available audio inputs,
 *  - heuristically detect connected Meta glasses,
 *  - run a live input-level meter on a chosen device so the user can confirm the
 *    glasses are actually capturing their voice before setting them as the OS
 *    default input.
 */

const STORAGE_KEY = 'assembleai.selectedMicId';

export type MicPermission = 'unsupported' | 'prompt' | 'granted' | 'denied';

export interface AudioInput {
  deviceId: string;
  label: string;
  /** True when the label looks like Ray-Ban Meta glasses / a Bluetooth HFP headset. */
  isLikelyGlasses: boolean;
}

const GLASSES_LABEL_PATTERNS = [
  /ray[\s-]?ban/i,
  /\bmeta\b/i,
  /wayfarer/i,
  /headgear/i,
  /hands[\s-]?free/i,
  /\bhfp\b/i
];

export function labelLooksLikeGlasses(label: string): boolean {
  return GLASSES_LABEL_PATTERNS.some((pattern) => pattern.test(label));
}

export function supportsMicSelection(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof navigator.mediaDevices.enumerateDevices === 'function'
  );
}

export async function getMicPermission(): Promise<MicPermission> {
  if (!supportsMicSelection()) {
    return 'unsupported';
  }
  const permissions = navigator.permissions;
  if (!permissions?.query) {
    return 'prompt';
  }
  try {
    // `microphone` is not in the older PermissionName union, hence the cast.
    const status = await permissions.query({ name: 'microphone' as PermissionName });
    return status.state as MicPermission;
  } catch {
    return 'prompt';
  }
}

/**
 * Prompt for microphone access. Device labels are only exposed by the browser
 * after permission has been granted, so this must run before {@link listAudioInputs}.
 */
export async function requestMicPermission(): Promise<MicPermission> {
  if (!supportsMicSelection()) {
    return 'unsupported';
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return 'granted';
  } catch {
    return 'denied';
  }
}

export async function listAudioInputs(): Promise<AudioInput[]> {
  if (!supportsMicSelection()) {
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'audioinput')
    .map((device, index) => {
      const label = device.label || `Microphone ${index + 1}`;
      return {
        deviceId: device.deviceId,
        label,
        isLikelyGlasses: labelLooksLikeGlasses(label)
      };
    });
}

export function detectGlasses(inputs: AudioInput[]): AudioInput | undefined {
  return inputs.find((input) => input.isLikelyGlasses);
}

function getPreferenceStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined {
  try {
    if (typeof localStorage === 'undefined') {
      return undefined;
    }
    if (
      typeof localStorage.getItem !== 'function' ||
      typeof localStorage.setItem !== 'function' ||
      typeof localStorage.removeItem !== 'function'
    ) {
      return undefined;
    }
    return localStorage;
  } catch {
    return undefined;
  }
}

export function loadSelectedMicId(): string | undefined {
  const storage = getPreferenceStorage();
  if (!storage) {
    return undefined;
  }
  return storage.getItem(STORAGE_KEY) ?? undefined;
}

export function saveSelectedMicId(deviceId: string | undefined): void {
  const storage = getPreferenceStorage();
  if (!storage) {
    return;
  }
  if (deviceId) {
    storage.setItem(STORAGE_KEY, deviceId);
  } else {
    storage.removeItem(STORAGE_KEY);
  }
}

export interface LevelMeter {
  /** Latest input level in the 0..1 range (RMS amplitude, lightly smoothed). */
  getLevel(): number;
  stop(): void;
}

/**
 * Open a live input-level meter on a specific device. Callers poll
 * {@link LevelMeter.getLevel} (e.g. from a requestAnimationFrame loop) and must
 * call {@link LevelMeter.stop} to release the microphone.
 */
export async function createLevelMeter(deviceId?: string): Promise<LevelMeter> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: deviceId ? { deviceId: { exact: deviceId } } : true
  });

  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error('AudioContext is not supported in this browser.');
  }

  const context = new AudioContextCtor();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);

  const buffer = new Uint8Array(analyser.fftSize);
  let smoothed = 0;

  return {
    getLevel() {
      analyser.getByteTimeDomainData(buffer);
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const centered = (buffer[i] - 128) / 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      // Light attack/decay smoothing keeps the meter readable.
      smoothed = Math.max(rms, smoothed * 0.82);
      return Math.min(1, smoothed * 2.2);
    },
    stop() {
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
    }
  };
}
