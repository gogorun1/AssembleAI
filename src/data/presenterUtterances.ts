export interface PresenterUtterance {
  id: string;
  label: string;
  utterance: string;
  description: string;
}

export const presenterUtterances: PresenterUtterance[] = [
  {
    id: 'next-step',
    label: 'Next step',
    utterance: "What's next?",
    description: 'Advance to the next assembly step.'
  },
  {
    id: 'which-screw',
    label: 'Which screw?',
    utterance: 'Which screw with the washer should I use?',
    description: 'Highlight the correct screw/washer part.'
  },
  {
    id: 'where-goes',
    label: 'Where does it go?',
    utterance: 'Where does this part go?',
    description: 'Show placement guidance for current step.'
  },
  {
    id: 'back-view',
    label: 'Back view',
    utterance: 'Show me the back view.',
    description: 'Move camera to rear/back-panel view.'
  },
  {
    id: 'common-mistake',
    label: 'Common mistake',
    utterance: 'Did people mess this step up before?',
    description: 'Show common mistake for current step.'
  },
  {
    id: 'repeat',
    label: 'Repeat',
    utterance: 'Repeat that.',
    description: 'Repeat current step instruction.'
  }
];
