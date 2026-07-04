import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VoiceState } from '../types/assembly';
import type { STTService } from './stt';
import type { TTSService } from './tts';
import {
  NO_SPEECH_TIMEOUT_MS,
  STT_ERROR_MESSAGE,
  STT_UNAVAILABLE_MESSAGE,
  createVoiceController
} from './voiceController';

function createFakeSTT(state: STTService['state'] = 'available') {
  let resultHandler = (_text: string) => {};
  let endHandler = () => {};
  let errorHandler = (_message: string) => {};
  const service: STTService = {
    state,
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    onResult: vi.fn((callback) => {
      resultHandler = callback;
    }),
    onEnd: vi.fn((callback) => {
      endHandler = callback;
    }),
    onError: vi.fn((callback) => {
      errorHandler = callback;
    })
  };

  return {
    service,
    emitResult: (text: string) => resultHandler(text),
    emitEnd: () => endHandler(),
    emitError: (message: string) => errorHandler(message)
  };
}

function createFakeTTS(): TTSService {
  return {
    speak: vi.fn(async () => {}),
    cancel: vi.fn(),
    preload: vi.fn(async () => {})
  };
}

describe('voice controller', () => {
  let voiceState: VoiceState;
  let states: VoiceState[];

  beforeEach(() => {
    vi.useFakeTimers();
    voiceState = 'idle';
    states = [voiceState];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setVoiceState = (state: VoiceState) => {
    voiceState = state;
    states.push(state);
  };

  it('runs the product voice state sequence from push-to-talk through spoken reply', async () => {
    const stt = createFakeSTT();
    const tts = createFakeTTS();
    const controller = createVoiceController({
      stt: stt.service,
      tts,
      getVoiceState: () => voiceState,
      setVoiceState,
      markVoiceInteraction: vi.fn(),
      showRecoverableMessage: vi.fn(),
      runUtterance: async () => {
        setVoiceState('thinking');
        setVoiceState('acting');
        setVoiceState('speaking');
        setVoiceState('idle');
      }
    });

    controller.beginPushToTalk();
    controller.endPushToTalk();
    stt.emitResult('Where does this panel go?');
    await Promise.resolve();

    expect(states).toEqual([
      'idle',
      'listening',
      'transcribing',
      'thinking',
      'acting',
      'speaking',
      'idle'
    ]);
    expect(stt.service.start).toHaveBeenCalledTimes(1);
    expect(stt.service.stop).toHaveBeenCalledTimes(1);
  });

  it('cancels active TTS when push-to-talk starts during speaking', () => {
    voiceState = 'speaking';
    states = [voiceState];
    const stt = createFakeSTT();
    const tts = createFakeTTS();
    const controller = createVoiceController({
      stt: stt.service,
      tts,
      getVoiceState: () => voiceState,
      setVoiceState,
      markVoiceInteraction: vi.fn(),
      showRecoverableMessage: vi.fn(),
      runUtterance: vi.fn()
    });

    controller.beginPushToTalk();

    expect(tts.cancel).toHaveBeenCalledTimes(1);
    expect(states).toEqual(['speaking', 'idle', 'listening']);
    expect(stt.service.start).toHaveBeenCalledTimes(1);
  });

  it('returns to idle when no speech arrives after five seconds', () => {
    const stt = createFakeSTT();
    const controller = createVoiceController({
      stt: stt.service,
      tts: createFakeTTS(),
      getVoiceState: () => voiceState,
      setVoiceState,
      markVoiceInteraction: vi.fn(),
      showRecoverableMessage: vi.fn(),
      runUtterance: vi.fn()
    });

    controller.beginPushToTalk();
    vi.advanceTimersByTime(NO_SPEECH_TIMEOUT_MS);

    expect(stt.service.abort).toHaveBeenCalledTimes(1);
    expect(voiceState).toBe('idle');
  });

  it('surfaces unavailable STT as a recoverable message without throwing', () => {
    const stt = createFakeSTT('unavailable');
    const showRecoverableMessage = vi.fn();
    const controller = createVoiceController({
      stt: stt.service,
      tts: createFakeTTS(),
      getVoiceState: () => voiceState,
      setVoiceState,
      markVoiceInteraction: vi.fn(),
      showRecoverableMessage,
      runUtterance: vi.fn()
    });

    expect(() => controller.beginPushToTalk()).not.toThrow();
    expect(showRecoverableMessage).toHaveBeenCalledWith(STT_UNAVAILABLE_MESSAGE);
    expect(stt.service.start).not.toHaveBeenCalled();
    expect(voiceState).toBe('idle');
  });

  it('surfaces STT errors as visible fallback messages without throwing', () => {
    const stt = createFakeSTT();
    const showRecoverableMessage = vi.fn();
    createVoiceController({
      stt: stt.service,
      tts: createFakeTTS(),
      getVoiceState: () => voiceState,
      setVoiceState,
      markVoiceInteraction: vi.fn(),
      showRecoverableMessage,
      runUtterance: vi.fn()
    });

    setVoiceState('listening');
    expect(() => stt.emitError('not-allowed')).not.toThrow();

    expect(showRecoverableMessage).toHaveBeenCalledWith(STT_ERROR_MESSAGE);
    expect(voiceState).toBe('idle');
  });
});
