import type { ResolvedIntent } from '../types/assembly';
import type { AppState } from '../store/useAppStore';

export type IntentActionStore = Pick<
  AppState,
  | 'currentStep'
  | 'setVoiceState'
  | 'setActiveView'
  | 'setHighlightedParts'
  | 'mentionPart'
  | 'viewer'
  | 'selectPart'
  | 'goToStep'
  | 'addTranscript'
>;

export function applyResolvedIntentAction(store: IntentActionStore, intent: ResolvedIntent): void {
  const partIds = intent.partIds ?? [];

  store.setVoiceState('acting');

  if (intent.viewKey) {
    store.setActiveView(intent.viewKey);
  }

  if (partIds.length > 0) {
    store.setHighlightedParts(partIds);
    for (const partId of partIds) {
      store.mentionPart(partId);
    }
  }

  switch (intent.type) {
    case 'next_step':
    case 'prev_step':
    case 'goto_step':
      store.goToStep(intent.stepNumber ?? store.currentStep);
      break;
    case 'which_part':
      if (partIds[0]) {
        store.viewer?.spinPart(partIds[0]);
        store.selectPart(partIds[0]);
      }
      break;
    case 'where_does_it_go':
    case 'common_mistake':
    case 'repeat':
      if (partIds[0]) {
        store.selectPart(partIds[0]);
      }
      break;
    case 'show_angle':
    case 'how_many_left':
    case 'help':
    case 'unknown':
      break;
  }

  store.addTranscript({
    speaker: 'agent',
    text: intent.reply,
    mentionedPartIds: partIds,
    language: intent.language
  });
}
