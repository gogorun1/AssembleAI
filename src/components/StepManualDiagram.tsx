import type { Step } from '../types/assembly';
import styles from './StepManualDiagram.module.css';

interface StepManualDiagramProps {
  step: Step;
}

/** Schematic mini-figure keyed to manual illustration numbers. */
export function StepManualDiagram({ step }: StepManualDiagramProps) {
  const fig = step.manualFig ?? `Step ${step.index}`;
  const variant = diagramVariant(step.index);

  return (
    <figure className={styles.figure} aria-label={`Manual diagram ${fig}`}>
      <figcaption className={styles.caption}>Manual {fig}</figcaption>
      <svg className={styles.svg} viewBox="0 0 120 88" role="img" aria-hidden>
        {variant === 'dowels' ? <DowelDiagram /> : null}
        {variant === 'side-screws' ? <SideScrewDiagram /> : null}
        {variant === 'cams' ? <CamDiagram /> : null}
        {variant === 'back' ? <BackDiagram /> : null}
        {variant === 'finish' ? <FinishDiagram /> : null}
      </svg>
    </figure>
  );
}

function diagramVariant(stepIndex: number) {
  if (stepIndex <= 1) return 'dowels';
  if (stepIndex === 2) return 'side-screws';
  if (stepIndex <= 7) return 'cams';
  if (stepIndex <= 12) return 'back';
  return 'finish';
}

function DowelDiagram() {
  return (
    <>
      <rect x="8" y="18" width="104" height="10" rx="2" className={styles.panel} />
      <circle cx="28" cy="23" r="3" className={styles.smallHole} />
      <circle cx="92" cy="23" r="3" className={styles.smallHole} />
      <rect x="18" y="38" width="8" height="28" rx="2" className={styles.dowel} />
      <path d="M26 52h16" className={styles.arrow} />
      <text x="48" y="56" className={styles.label}>
        Press dowel
      </text>
    </>
  );
}

function SideScrewDiagram() {
  return (
    <>
      <rect x="46" y="8" width="12" height="72" rx="2" className={styles.panel} />
      {[24, 44, 64].map((y) => (
        <g key={y}>
          <circle cx="52" cy={y} r="4" className={styles.largeHole} />
          <line x1="68" y1={y} x2="58" y2={y} className={styles.toolLine} />
        </g>
      ))}
      <text x="68" y="82" className={styles.label}>
        Flat screwdriver
      </text>
    </>
  );
}

function CamDiagram() {
  return (
    <>
      <rect x="12" y="24" width="96" height="8" rx="2" className={styles.panel} />
      <rect x="46" y="8" width="12" height="72" rx="2" className={styles.panel} />
      <circle cx="52" cy="28" r="5" className={styles.cam} />
      <path d="M64 28 L78 22 L78 34 Z" className={styles.toolHead} />
      <text x="12" y="82" className={styles.label}>
        Turn cam lock
      </text>
    </>
  );
}

function BackDiagram() {
  return (
    <>
      <rect x="20" y="12" width="80" height="64" rx="2" className={styles.back} />
      <line x1="24" y1="44" x2="96" y2="44" className={styles.guide} />
      {[32, 52, 72].map((x) => (
        <circle key={x} cx={x} cy="44" r="2.5" className={styles.nail} />
      ))}
      <text x="20" y="82" className={styles.label}>
        Nail along guide line
      </text>
    </>
  );
}

function FinishDiagram() {
  return (
    <>
      <rect x="46" y="8" width="12" height="72" rx="2" className={styles.panel} />
      <rect x="24" y="34" width="72" height="6" rx="1" className={styles.shelf} />
      <circle cx="52" cy="37" r="2" className={styles.smallHole} />
      <text x="12" y="82" className={styles.label}>
        Shelf on pins
      </text>
    </>
  );
}
