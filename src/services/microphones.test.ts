import { describe, expect, it } from 'vitest';
import { detectGlasses, labelLooksLikeGlasses, type AudioInput } from './microphones';

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
