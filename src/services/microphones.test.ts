import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  detectGlasses,
  labelLooksLikeGlasses,
  loadSelectedMicId,
  saveSelectedMicId,
  type AudioInput
} from './microphones';

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

afterEach(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDescriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, 'localStorage');
});

function input(deviceId: string, label: string): AudioInput {
  return { deviceId, label, isLikelyGlasses: labelLooksLikeGlasses(label) };
}

describe('labelLooksLikeGlasses', () => {
  it('matches Ray-Ban Meta glasses labels', () => {
    expect(labelLooksLikeGlasses('Ray-Ban Meta (Hands-Free)')).toBe(true);
    expect(labelLooksLikeGlasses('Ray Ban Wayfarer')).toBe(true);
    expect(labelLooksLikeGlasses('Meta Headset (HFP)')).toBe(true);
  });

  it('does not match built-in or generic microphones', () => {
    expect(labelLooksLikeGlasses('MacBook Pro Microphone')).toBe(false);
    expect(labelLooksLikeGlasses('External USB Mic')).toBe(false);
    expect(labelLooksLikeGlasses('Default')).toBe(false);
  });
});

describe('detectGlasses', () => {
  it('returns the first glasses-like input when present', () => {
    const inputs = [
      input('a', 'MacBook Pro Microphone'),
      input('b', 'Ray-Ban Meta (Hands-Free)'),
      input('c', 'External USB Mic')
    ];
    expect(detectGlasses(inputs)?.deviceId).toBe('b');
  });

  it('returns undefined when no glasses are connected', () => {
    const inputs = [input('a', 'MacBook Pro Microphone'), input('c', 'External USB Mic')];
    expect(detectGlasses(inputs)).toBeUndefined();
  });
});

describe('microphone preference storage', () => {
  it('ignores localStorage globals without storage methods', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {}
    });

    expect(loadSelectedMicId()).toBeUndefined();
    expect(() => saveSelectedMicId('rayban-meta')).not.toThrow();
  });

  it('persists and clears the selected microphone id when storage is available', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        values.delete(key);
      })
    };

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storage
    });

    saveSelectedMicId('rayban-meta');
    expect(loadSelectedMicId()).toBe('rayban-meta');
    expect(storage.setItem).toHaveBeenCalledWith('assembleai.selectedMicId', 'rayban-meta');

    saveSelectedMicId(undefined);
    expect(loadSelectedMicId()).toBeUndefined();
    expect(storage.removeItem).toHaveBeenCalledWith('assembleai.selectedMicId');
  });
});
