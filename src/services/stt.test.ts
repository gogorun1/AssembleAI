import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSTTService } from './stt';

class FakeSpeechRecognition extends EventTarget {
  static instances: FakeSpeechRecognition[] = [];

  continuous = true;
  interimResults = true;
  lang = '';
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    super();
    FakeSpeechRecognition.instances.push(this);
  }
}

describe('createSTTService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeSpeechRecognition.instances = [];
  });

  it('returns unavailable when the browser API is missing', () => {
    vi.stubGlobal('window', {});

    const service = createSTTService();

    expect(service.state).toBe('unavailable');
    expect(() => {
      service.start();
      service.stop();
      service.abort();
    }).not.toThrow();
  });

  it('detects Web Speech availability by default', () => {
    vi.stubGlobal('window', { SpeechRecognition: FakeSpeechRecognition });

    const service = createSTTService('fr-FR');

    expect(service.state).toBe('available');
    expect(FakeSpeechRecognition.instances[0].continuous).toBe(false);
    expect(FakeSpeechRecognition.instances[0].interimResults).toBe(false);
    expect(FakeSpeechRecognition.instances[0].lang).toBe('fr-FR');
  });

  it('forwards start, stop, and abort to Web Speech', () => {
    vi.stubGlobal('window', { SpeechRecognition: FakeSpeechRecognition });

    const service = createSTTService();
    const recognition = FakeSpeechRecognition.instances[0];

    service.start();
    service.stop();
    service.abort();

    expect(recognition.start).toHaveBeenCalledTimes(1);
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(recognition.abort).toHaveBeenCalledTimes(1);
  });

  it('fires result, end, and error callbacks', () => {
    vi.stubGlobal('window', { SpeechRecognition: FakeSpeechRecognition });

    const service = createSTTService();
    const recognition = FakeSpeechRecognition.instances[0];
    const onResult = vi.fn();
    const onEnd = vi.fn();
    const onError = vi.fn();

    service.onResult(onResult);
    service.onEnd(onEnd);
    service.onError(onError);

    recognition.onresult?.({ results: [[{ transcript: '  where does it go  ' }]] });
    recognition.onend?.();
    recognition.onerror?.({ error: 'no-speech' });

    expect(onResult).toHaveBeenCalledWith('where does it go');
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('no-speech');
  });

  it('selects the remote provider only when configured', () => {
    vi.stubGlobal('window', { SpeechRecognition: FakeSpeechRecognition });

    expect(createSTTService().state).toBe('available');
    expect(createSTTService('en-US', { provider: 'remote' }).state).toBe('unavailable');
  });
});
