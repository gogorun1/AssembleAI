import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './useAppStore';
import manifest from '../data/manifest';

describe('useAppStore Orange Sync event', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.getState().resetDemoState();
  });

  it('marks the part as mentioned and clears it after the flash window', () => {
    useAppStore.getState().mentionPart('cam-screw-washer');

    expect(useAppStore.getState().mentionedPartIds).toContain('cam-screw-washer');

    vi.advanceTimersByTime(1999);
    expect(useAppStore.getState().mentionedPartIds).toContain('cam-screw-washer');

    vi.advanceTimersByTime(1);
    expect(useAppStore.getState().mentionedPartIds).not.toContain('cam-screw-washer');
  });
});

describe('Phase 0B — reset semantics', () => {
  beforeEach(() => {
    useAppStore.getState().resetDemoState();
  });

  it('resets currentStep to 1', () => {
    useAppStore.getState().goToStep(5);
    useAppStore.getState().resetDemoState();
    expect(useAppStore.getState().currentStep).toBe(1);
  });

  it('resets voiceState to idle', () => {
    useAppStore.getState().setVoiceState('listening');
    useAppStore.getState().resetDemoState();
    expect(useAppStore.getState().voiceState).toBe('idle');
  });

  it('resets explodeLevel to 1', () => {
    useAppStore.getState().setExplodeLevel(2);
    useAppStore.getState().resetDemoState();
    expect(useAppStore.getState().explodeLevel).toBe(1);
  });

  it('resets activeViewKey to first step camera view', () => {
    useAppStore.getState().setActiveView('back-panel');
    useAppStore.getState().resetDemoState();
    expect(useAppStore.getState().activeViewKey).toBe(manifest.steps[0].cameraView);
  });

  it('restores the welcome transcript line on reset', () => {
    const beforeReset = useAppStore.getState().transcript.length;
    expect(beforeReset).toBe(1);

    useAppStore.getState().addTranscript({ speaker: 'user', text: 'Hello' });
    useAppStore.getState().resetDemoState();

    const transcript = useAppStore.getState().transcript;
    expect(transcript).toHaveLength(1);
    expect(transcript[0].speaker).toBe('agent');
    expect(transcript[0].id).toBe('welcome');
    expect(transcript[0].text).toContain('BILLY');
  });

  it('clears toast on reset', () => {
    useAppStore.getState().showToast('Some message');
    useAppStore.getState().resetDemoState();
    expect(useAppStore.getState().toast).toBeUndefined();
  });

  it('resets firstVoiceInteraction to false', () => {
    useAppStore.getState().markVoiceInteraction();
    useAppStore.getState().resetDemoState();
    expect(useAppStore.getState().firstVoiceInteraction).toBe(false);
  });
});

describe('Phase 0B — event log', () => {
  beforeEach(() => {
    useAppStore.getState().resetDemoState();
    useAppStore.getState().clearEventLog();
  });

  it('logEvent appends an event with id and timestamp', () => {
    const store = useAppStore.getState();
    store.logEvent({ type: 'utterance', label: 'Which screw?', payload: { text: 'Which screw?' } });

    const log = useAppStore.getState().eventLog;
    expect(log).toHaveLength(1);
    expect(log[0].type).toBe('utterance');
    expect(log[0].label).toBe('Which screw?');
    expect(log[0].id).toBeDefined();
    expect(typeof log[0].id).toBe('string');
    expect(log[0].timestamp).toBeGreaterThan(0);
    expect(log[0].payload).toEqual({ text: 'Which screw?' });
  });

  it('logEvent preserves type discriminations', () => {
    const store = useAppStore.getState();
    store.logEvent({ type: 'intent', label: 'next_step' });
    store.logEvent({ type: 'step_change', label: 'Step 2' });
    store.logEvent({ type: 'reset', label: 'Full reset' });
    store.logEvent({ type: 'error', label: 'TTS failed', payload: { code: 'ERR_1' } });

    const log = useAppStore.getState().eventLog;
    expect(log).toHaveLength(4);
    expect(log[0].type).toBe('intent');
    expect(log[1].type).toBe('step_change');
    expect(log[2].type).toBe('reset');
    expect(log[3].type).toBe('error');
  });

  it('clearEventLog empties the event log', () => {
    const store = useAppStore.getState();
    store.logEvent({ type: 'utterance', label: 'Test' });
    expect(useAppStore.getState().eventLog).not.toHaveLength(0);

    useAppStore.getState().clearEventLog();
    expect(useAppStore.getState().eventLog).toHaveLength(0);
  });

  it('caps event log at 100 entries', () => {
    const store = useAppStore.getState();
    for (let i = 0; i < 110; i++) {
      store.logEvent({ type: 'utterance', label: `Event ${i}` });
    }

    const log = useAppStore.getState().eventLog;
    expect(log).toHaveLength(100);
    expect(log[0].label).toBe('Event 10');
    expect(log[99].label).toBe('Event 109');
  });

  it('resetDemoState clears the event log', () => {
    const store = useAppStore.getState();
    store.logEvent({ type: 'utterance', label: 'Pre-reset' });
    expect(useAppStore.getState().eventLog).toHaveLength(1);

    store.resetDemoState();
    expect(useAppStore.getState().eventLog).toHaveLength(0);
  });
});
