import { useAppStore } from '../store/useAppStore';
import { partBins } from '../viewer/bins';
import styles from './PartsBinsPanel.module.css';

/**
 * UI-layer parts bins docked over the left edge of the viewport. Clicking a bin
 * highlights where its parts go on the model (slot markers); the parts then fly
 * from here into place as their assembly step is reached.
 */
export function PartsBinsPanel() {
  const selectedBinId = useAppStore((state) => state.selectedBinId);
  const selectBin = useAppStore((state) => state.selectBin);
  const setHighlightedParts = useAppStore((state) => state.setHighlightedParts);
  const mentionPart = useAppStore((state) => state.mentionPart);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const addTranscript = useAppStore((state) => state.addTranscript);
  const parts = useAppStore((state) => state.manifest.parts);

  const codeFor = (partId: string) => parts.find((part) => part.id === partId)?.code ?? '';

  const onSelect = (binId: string) => {
    const bin = partBins.find((entry) => entry.id === binId);
    if (!bin) return;
    selectBin(bin.id);
    setHighlightedParts(bin.partIds);
    bin.partIds.forEach((partId) => mentionPart(partId));
    setActiveView('front');
    addTranscript({
      speaker: 'agent',
      text: `Bin ${bin.index}, ${bin.name}: highlighted where these go on the model.`,
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
            <span className={styles.badge}>{bin.index}</span>
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
