import type { IntentType } from '../types/assembly';

export interface IntentFixture {
  utterance: string;
  currentStep: number;
  expectedType: IntentType;
  expectedPartIds: string[] | undefined;
  expectedViewKey: string | undefined;
  expectedStepNumber: number | undefined;
  expectedLanguage: 'en' | 'fr';
}

export const goldenIntentFixtures: IntentFixture[] = [
  {
    utterance: 'Which one is the screw with the washer?',
    currentStep: 1,
    expectedType: 'which_part',
    expectedPartIds: ['cam-screw-washer'],
    expectedViewKey: 'screw-detail',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Where does this panel go?',
    currentStep: 2,
    expectedType: 'where_does_it_go',
    expectedPartIds: ['bottom-panel'],
    expectedViewKey: 'base-detail',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Show me from the back.',
    currentStep: 7,
    expectedType: 'show_angle',
    expectedPartIds: undefined,
    expectedViewKey: 'back-panel',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: "What's next?",
    currentStep: 3,
    expectedType: 'next_step',
    expectedPartIds: undefined,
    expectedViewKey: undefined,
    expectedStepNumber: 4,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Did people mess this step up before?',
    currentStep: 7,
    expectedType: 'common_mistake',
    expectedPartIds: ['back-panel'],
    expectedViewKey: 'back-panel',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Et cette vis, elle va ou ?',
    currentStep: 1,
    expectedType: 'where_does_it_go',
    expectedPartIds: ['cam-screw-washer'],
    expectedViewKey: 'screw-detail',
    expectedStepNumber: undefined,
    expectedLanguage: 'fr'
  },
  {
    utterance: 'Which part is 117327?',
    currentStep: 1,
    expectedType: 'which_part',
    expectedPartIds: ['cam-screw-washer'],
    expectedViewKey: 'screw-detail',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Show me the washer screw.',
    currentStep: 1,
    expectedType: 'which_part',
    expectedPartIds: ['cam-screw-washer'],
    expectedViewKey: 'screw-detail',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Ou va la vis avec rondelle ?',
    currentStep: 1,
    expectedType: 'where_does_it_go',
    expectedPartIds: ['cam-screw-washer'],
    expectedViewKey: 'screw-detail',
    expectedStepNumber: undefined,
    expectedLanguage: 'fr'
  },
  {
    utterance: 'Where do I put the bottom panel?',
    currentStep: 2,
    expectedType: 'where_does_it_go',
    expectedPartIds: ['bottom-panel'],
    expectedViewKey: 'base-detail',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Where does this panel go?',
    currentStep: 6,
    expectedType: 'unknown',
    expectedPartIds: undefined,
    expectedViewKey: undefined,
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Where does the right side panel fit?',
    currentStep: 4,
    expectedType: 'where_does_it_go',
    expectedPartIds: ['side-panel-right'],
    expectedViewKey: 'front',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Show the rear view.',
    currentStep: 3,
    expectedType: 'show_angle',
    expectedPartIds: undefined,
    expectedViewKey: 'back-panel',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Can I see it from behind?',
    currentStep: 5,
    expectedType: 'show_angle',
    expectedPartIds: undefined,
    expectedViewKey: 'back-panel',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Zoom into the cam lock.',
    currentStep: 2,
    expectedType: 'show_angle',
    expectedPartIds: undefined,
    expectedViewKey: 'cam-lock-detail',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Show me a close up.',
    currentStep: 3,
    expectedType: 'show_angle',
    expectedPartIds: undefined,
    expectedViewKey: 'shelf-detail',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Go to step five.',
    currentStep: 2,
    expectedType: 'goto_step',
    expectedPartIds: undefined,
    expectedViewKey: undefined,
    expectedStepNumber: 5,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Jump to the third step.',
    currentStep: 8,
    expectedType: 'goto_step',
    expectedPartIds: undefined,
    expectedViewKey: undefined,
    expectedStepNumber: 3,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Take me to step two.',
    currentStep: 1,
    expectedType: 'goto_step',
    expectedPartIds: undefined,
    expectedViewKey: undefined,
    expectedStepNumber: 2,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Back one step.',
    currentStep: 4,
    expectedType: 'prev_step',
    expectedPartIds: undefined,
    expectedViewKey: undefined,
    expectedStepNumber: 3,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Previous step.',
    currentStep: 1,
    expectedType: 'prev_step',
    expectedPartIds: undefined,
    expectedViewKey: undefined,
    expectedStepNumber: 1,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Continue.',
    currentStep: 8,
    expectedType: 'next_step',
    expectedPartIds: undefined,
    expectedViewKey: undefined,
    expectedStepNumber: 9,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Repeat that.',
    currentStep: 4,
    expectedType: 'repeat',
    expectedPartIds: ['side-panel-right', 'cam-lock'],
    expectedViewKey: 'front',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'What mistake should I avoid here?',
    currentStep: 4,
    expectedType: 'common_mistake',
    expectedPartIds: ['side-panel-right'],
    expectedViewKey: 'front',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Which one is the shelf pin?',
    currentStep: 8,
    expectedType: 'which_part',
    expectedPartIds: ['shelf-pin'],
    expectedViewKey: 'shelf-pin-detail',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Where do the wood dowels go?',
    currentStep: 3,
    expectedType: 'where_does_it_go',
    expectedPartIds: ['wood-dowel'],
    expectedViewKey: 'shelf-detail',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Is this the short back screw?',
    currentStep: 7,
    expectedType: 'which_part',
    expectedPartIds: ['back-screw'],
    expectedViewKey: 'back-panel',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  },
  {
    utterance: 'Where does the safety strap attach?',
    currentStep: 9,
    expectedType: 'where_does_it_go',
    expectedPartIds: ['safety-strap'],
    expectedViewKey: 'wall-anchor',
    expectedStepNumber: undefined,
    expectedLanguage: 'en'
  }
];
