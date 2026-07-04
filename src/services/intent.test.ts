import { describe, expect, it } from 'vitest';
import manifest from '../data/manifest';
import { parseIntent } from './intent';

describe('parseIntent demo utterances', () => {
  it('resolves the washer screw question to a which_part action', async () => {
    const intent = await parseIntent('Which one is the screw with the washer?', {
      manifest,
      currentStep: 1
    });

    expect(intent.type).toBe('which_part');
    expect(intent.partIds).toEqual(['cam-screw-washer']);
    expect(intent.language).toBe('en');
  });

  it('shows where the current panel goes', async () => {
    const intent = await parseIntent('Where does this panel go?', {
      manifest,
      currentStep: 2
    });

    expect(intent.type).toBe('where_does_it_go');
    expect(intent.partIds).toContain('bottom-panel');
    expect(intent.viewKey).toBe('base-detail');
  });

  it('maps the back view request to the back camera preset', async () => {
    const intent = await parseIntent('Show me from the back.', {
      manifest,
      currentStep: 7
    });

    expect(intent.type).toBe('show_angle');
    expect(intent.viewKey).toBe('back-panel');
  });

  it('moves forward on the next-step utterance', async () => {
    const intent = await parseIntent("What's next?", {
      manifest,
      currentStep: 3
    });

    expect(intent.type).toBe('next_step');
    expect(intent.stepNumber).toBe(4);
  });

  it('surfaces the current common mistake', async () => {
    const intent = await parseIntent('Did people mess this step up before?', {
      manifest,
      currentStep: 7
    });

    expect(intent.type).toBe('common_mistake');
    expect(intent.partIds).toEqual(['back-panel']);
    expect(intent.reply).toMatch(/smooth white face/i);
  });

  it('answers the French screw placement question in French', async () => {
    const intent = await parseIntent('Et cette vis, elle va où ?', {
      manifest,
      currentStep: 1
    });

    expect(intent.type).toBe('where_does_it_go');
    expect(intent.language).toBe('fr');
    expect(intent.partIds).toEqual(['cam-screw-washer']);
    expect(intent.reply).toMatch(/va/i);
  });
});
