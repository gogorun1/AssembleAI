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
    utterance: 'Which cam screw should I use?',
    description: 'Highlight the correct cam screw.'
  },
  {
    id: 'where-goes',
    label: 'Where does it go?',
    utterance: 'Where does this part go?',
    description: 'Show placement guidance for current step.'
  },
  {
    id: 'front-view',
    label: 'Front view',
    utterance: 'Show me the front.',
    description: 'Move camera to the straight-on front view.'
  },
  {
    id: 'back-view',
    label: 'Back view',
    utterance: 'Show me the back view.',
    description: 'Move camera to rear/back-panel view.'
  },
  {
    id: 'side-view',
    label: 'Side view',
    utterance: 'Show me the side view.',
    description: 'Move camera to the side profile view.'
  },
  {
    id: 'top-view',
    label: 'Top view',
    utterance: 'Show me the top view.',
    description: 'Move camera to the top-down view.'
  },
  {
    id: 'iso-view',
    label: '3D view',
    utterance: 'Give me the 3D view.',
    description: 'Move camera to the isometric 3D angle.'
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
  },
  {
    id: 'fr-screw',
    label: 'Français',
    utterance: 'Et cette vis, elle va où ?',
    description: 'Ask in French where the screw goes (the agent replies in French).'
  }
];
