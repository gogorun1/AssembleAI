import { describe, expect, it } from 'vitest';
import manifest from '../data/manifest';
import { parseIntent } from './intent';

describe('parseIntent demo utterances', () => {
  it('resolves the washer screw question to a which_part action', async () => {
    const intent = await parseIntent('Which cam screw should I use?', {
      manifest,
      currentStep: 1
    });

    expect(intent.type).toBe('which_part');
    expect(intent.partIds).toEqual(['cam-screw']);
    expect(intent.language).toBe('en');
    expect(intent.reply).toMatch(/118331/);
  });

  it('shows where the current panel goes', async () => {
    const intent = await parseIntent('Where does this panel go?', {
      manifest,
      currentStep: 3
    });

    expect(intent.type).toBe('where_does_it_go');
    expect(intent.partIds).toContain('bottom-panel');
    expect(intent.viewKey).toBe('first-side-assembly');
  });

  it('maps the back view request to the back camera preset', async () => {
    const intent = await parseIntent('Show me from the back.', {
      manifest,
      currentStep: 7
    });

    expect(intent.type).toBe('show_angle');
    expect(intent.viewKey).toBe('back-panel');
  });

  it('maps the front view request to the front camera preset', async () => {
    const intent = await parseIntent('Show me the front.', {
      manifest,
      currentStep: 7
    });

    expect(intent.type).toBe('show_angle');
    expect(intent.viewKey).toBe('front');
  });

  it('maps a side view request to the side camera preset', async () => {
    const intent = await parseIntent('Can I see it from the side?', {
      manifest,
      currentStep: 3
    });

    expect(intent.type).toBe('show_angle');
    expect(intent.viewKey).toBe('side');
  });

  it('maps a top view request to the top camera preset', async () => {
    const intent = await parseIntent('Show me the top view.', {
      manifest,
      currentStep: 3
    });

    expect(intent.type).toBe('show_angle');
    expect(intent.viewKey).toBe('top');
  });

  it('maps a 3D request to the isometric camera preset', async () => {
    const intent = await parseIntent('Give me the 3D view.', {
      manifest,
      currentStep: 3
    });

    expect(intent.type).toBe('show_angle');
    expect(intent.viewKey).toBe('iso');
  });

  it('maps a zoom-out request to the full overview', async () => {
    const intent = await parseIntent('Zoom out so I can see the whole thing.', {
      manifest,
      currentStep: 3
    });

    expect(intent.type).toBe('show_angle');
    expect(intent.viewKey).toBe('complete');
  });

  it('keeps a zoom-in request framed on the current step', async () => {
    const intent = await parseIntent('Can you zoom in closer?', {
      manifest,
      currentStep: 4
    });

    expect(intent.type).toBe('show_angle');
    expect(intent.viewKey).toBe(manifest.steps[3].cameraView);
  });

  it('does not treat a placement question as a view command', async () => {
    const intent = await parseIntent('Where does the back panel go?', {
      manifest,
      currentStep: 9
    });

    expect(intent.type).toBe('where_does_it_go');
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
      currentStep: 9
    });

    expect(intent.type).toBe('common_mistake');
    expect(intent.partIds).toEqual(['back-panel']);
    expect(intent.reply).toMatch(/smooth face/i);
  });

  it('jumps to a two-digit step by word', async () => {
    const intent = await parseIntent('Go to step fourteen.', {
      manifest,
      currentStep: 1
    });

    expect(intent.type).toBe('goto_step');
    expect(intent.stepNumber).toBe(14);
  });

  it('answers the French screw placement question in French', async () => {
    const intent = await parseIntent('Et cette vis, elle va où ?', {
      manifest,
      currentStep: 1
    });

    expect(intent.type).toBe('where_does_it_go');
    expect(intent.language).toBe('fr');
    expect(intent.partIds).toEqual(['cam-screw']);
    expect(intent.reply).toMatch(/va/i);
  });
});
