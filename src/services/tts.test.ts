import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedIntent } from '../types/assembly';
import { createTTSService } from './tts';

class FakeSpeechSynthesisUtterance {
  text: string;
  lang = '';
  rate = 0;
  pitch = 0;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

function makeIntent(language: 'en' | 'fr'): ResolvedIntent {
  return {
    type: 'help',
    language,
    reply: language === 'fr' ? 'Je vous aide.' : 'I can help.'
  };
}

function installSpeechSynthesis({ endImmediately = true } = {}) {
  const spoken: FakeSpeechSynthesisUtterance[] = [];
  const synth = {
    getVoices: vi.fn(() => []),
    cancel: vi.fn(),
    speak: vi.fn((utterance: FakeSpeechSynthesisUtterance) => {
      spoken.push(utterance);
      if (endImmediately) {
        utterance.onend?.();
      }
    })
  };

  vi.stubGlobal('SpeechSynthesisUtterance', FakeSpeechSynthesisUtterance);
  vi.stubGlobal('window', { speechSynthesis: synth });

  return { synth, spoken };
}

describe('createTTSService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('preloads browser voices when speech synthesis is available', async () => {
    const { synth } = installSpeechSynthesis();

    await createTTSService().preload();

    expect(synth.getVoices).toHaveBeenCalledTimes(1);
  });

  it('keeps preload safe when speech synthesis is unavailable', async () => {
    vi.stubGlobal('window', {});

    await expect(createTTSService().preload()).resolves.toBeUndefined();
    await expect(createTTSService({ provider: 'remote' }).preload()).resolves.toBeUndefined();
  });

  it('speaks English and French with matching browser locales', async () => {
    const { synth, spoken } = installSpeechSynthesis();
    const service = createTTSService();

    await service.speak(makeIntent('fr'));
    await service.speak(makeIntent('en'));

    expect(synth.cancel).toHaveBeenCalledTimes(2);
    expect(synth.speak).toHaveBeenCalledTimes(2);
    expect(spoken[0].lang).toBe('fr-FR');
    expect(spoken[1].lang).toBe('en-US');
  });

  it('forwards cancel to the active provider', () => {
    const { synth } = installSpeechSynthesis();

    createTTSService().cancel();

    expect(synth.cancel).toHaveBeenCalledTimes(1);
  });

  it('can cancel active speech inside the 150ms barge-in target', () => {
    vi.useFakeTimers();
    const { synth } = installSpeechSynthesis({ endImmediately: false });
    const service = createTTSService();

    void service.speak(makeIntent('en'));
    setTimeout(() => service.cancel(), 149);
    vi.advanceTimersByTime(149);

    expect(synth.cancel).toHaveBeenCalledTimes(2);
  });
});
