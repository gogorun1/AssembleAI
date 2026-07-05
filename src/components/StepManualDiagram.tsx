import type { Step } from '../types/assembly';
import styles from './StepManualDiagram.module.css';

interface StepManualDiagramProps {
  step: Step;
}

const diagramImages = {
  dowels: '/manual-diagrams/dowels.png',
  'side-screws': '/manual-diagrams/side-screws.png',
  cams: '/manual-diagrams/cams.png',
  back: '/manual-diagrams/back.png',
  finish: '/manual-diagrams/finish.png'
} as const;

type DiagramVariant = keyof typeof diagramImages;

/** Manual-style mini-figure keyed to assembly step groups. */
export function StepManualDiagram({ step }: StepManualDiagramProps) {
  const fig = step.manualFig ?? `Step ${step.index}`;
  const variant = diagramVariant(step.index);

  return (
    <figure className={styles.figure} aria-label={`Manual diagram ${fig}`}>
      <figcaption className={styles.caption}>Manual {fig}</figcaption>
      <img
        className={styles.image}
        src={diagramImages[variant]}
        alt=""
        aria-hidden
        draggable={false}
        decoding="async"
      />
    </figure>
  );
}

function diagramVariant(stepIndex: number): DiagramVariant {
  if (stepIndex <= 1) return 'dowels';
  if (stepIndex === 2) return 'side-screws';
  if (stepIndex <= 7) return 'cams';
  if (stepIndex <= 12) return 'back';
  return 'finish';
}
