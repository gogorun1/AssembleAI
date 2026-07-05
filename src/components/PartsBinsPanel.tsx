import { useAppStore } from '../store/useAppStore';
import { partBins, type PartBin } from '../viewer/bins';
import styles from './PartsBinsPanel.module.css';

function BinIcon({ shape }: { shape: PartBin['iconShape'] }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  };
  if (shape === 'lock') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="7" />
        <path d="M12 5v3M9.5 9.5 12 12" />
      </svg>
    );
  }
  if (shape === 'dowel') {
    return (
      <svg {...common}>
        <rect x="3" y="9.5" width="18" height="5" rx="2.5" />
        <path d="M7 9.5v5M17 9.5v5" />
      </svg>
    );
  }
  if (shape === 'pin') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 14.5v6" />
      </svg>
    );
  }
  if (shape === 'strap') {
    return (
      <svg {...common}>
        <path d="M5 6v9a3 3 0 0 0 3 3h11" />
        <path d="M16 15l3 3-3 3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="5" r="3" />
      <path d="M12 8v12M9.5 11h5M9.5 14h5M9.5 17h5" />
    </svg>
  );
}

/**
 * UI-layer parts bins docked over the left edge of the viewport. Clicking a bin
 * highlights where its parts go on the model (slot markers); the parts then fly
 * from here into place as their assembly step is reached.
 */
export function PartsBinsPanel() {
  const selectedBinId = useAppStore((state) => state.selectedBinId);
  const selectBin = useAppStore((state) => state.selectBin);
  const setHighlightedParts = useAppStore((state) => state.setHighlightedParts);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const addTranscript = useAppStore((state) => state.addTranscript);
  const parts = useAppStore((state) => state.manifest.parts);

  const codeFor = (partId: string) => parts.find((part) => part.id === partId)?.code ?? '';

  const onSelect = (binId: string) => {
    const bin = partBins.find((entry) => entry.id === binId);
    if (!bin) return;
    const nextSelected = selectedBinId === bin.id ? undefined : bin.id;
    selectBin(nextSelected);
    if (!nextSelected) {
      setHighlightedParts([]);
      return;
    }
    setHighlightedParts(bin.partIds);
    setActiveView(bin.focusView, { focus: true });
    addTranscript({
      speaker: 'agent',
      text: `${bin.name}: showing install slots for the current step on the model.`,
      mentionedPartIds: bin.partIds,
      language: 'en'
    });
  };

  return (
    <div className={styles.panel} aria-label="Parts bins">
      <div className={styles.header}>PARTS BINS</div>
      <div className={styles.list}>
        {partBins.map((bin) => (
          <button
            key={bin.id}
            type="button"
            data-testid={`bin-${bin.id}`}
            className={`${styles.card} ${selectedBinId === bin.id ? styles.active : ''}`}
            onClick={() => onSelect(bin.id)}
            title={`Highlight where the ${bin.name.toLowerCase()} go`}
          >
            <span className={styles.icon}>
              <BinIcon shape={bin.iconShape} />
            </span>
            <span className={styles.body}>
              <span className={styles.name}>{bin.name}</span>
              <span className={styles.codes}>{bin.partIds.map(codeFor).filter(Boolean).join(' · ')}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
