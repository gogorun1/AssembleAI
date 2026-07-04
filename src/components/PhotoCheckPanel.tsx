import { Camera, CheckCircle2, HelpCircle, Loader2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkAssemblyPhoto,
  type PhotoCheckResult,
  type PhotoCheckStatus
} from '../services/photoCheck';
import styles from './PhotoCheckPanel.module.css';

interface PhotoCheckPanelProps {
  currentStep: number;
  onMentionParts(partIds: string[]): void;
  onRunUtterance(text: string): void | Promise<void>;
  onResult?(result: PhotoCheckResult): void;
  disabled?: boolean;
}

const statusMeta: Record<
  PhotoCheckStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  pass: { label: 'Looks right', className: styles.badgePass, Icon: CheckCircle2 },
  warning: { label: 'Double-check', className: styles.badgeWarning, Icon: HelpCircle },
  fail: { label: 'Looks wrong', className: styles.badgeFail, Icon: XCircle },
  unknown: { label: 'Unclear', className: styles.badgeUnknown, Icon: HelpCircle }
};

export function PhotoCheckPanel({
  currentStep,
  onMentionParts,
  onRunUtterance,
  onResult,
  disabled = false
}: PhotoCheckPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PhotoCheckResult>();

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const onSelectFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.files?.[0];
      if (!next) {
        return;
      }
      setPreviewUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return URL.createObjectURL(next);
      });
      setFile(next);
      setResult(undefined);
    },
    []
  );

  const onCheck = useCallback(async () => {
    if (!file || loading) {
      return;
    }
    setLoading(true);
    try {
      const next = await checkAssemblyPhoto({ file, currentStep });
      setResult(next);
      onResult?.(next);
    } finally {
      setLoading(false);
    }
  }, [file, loading, currentStep, onResult]);

  const meta = result ? statusMeta[result.status] : undefined;

  return (
    <section className={styles.panel} aria-label="Photo check">
      <div className={styles.heading}>
        <Camera size={13} aria-hidden />
        Photo Check
      </div>
      <p className={styles.hint}>Did I do this right? Upload a photo of the current step.</p>

      <div className={styles.uploadRow}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className={styles.fileInput}
          data-testid="photo-check-input"
          disabled={disabled || loading}
          onChange={onSelectFile}
        />
        <button
          type="button"
          className={styles.selectButton}
          disabled={disabled || loading}
          onClick={() => inputRef.current?.click()}
        >
          {file ? 'Change photo' : 'Choose photo'}
        </button>
        <button
          type="button"
          className={styles.checkButton}
          data-testid="photo-check-run"
          disabled={disabled || loading || !file}
          onClick={() => void onCheck()}
        >
          {loading ? <Loader2 size={14} className={styles.spin} aria-hidden /> : null}
          {loading ? 'Checking…' : 'Check photo'}
        </button>
      </div>

      {previewUrl ? (
        <img className={styles.preview} src={previewUrl} alt="Selected assembly photo preview" />
      ) : null}

      {result && meta ? (
        <div className={styles.result} data-testid="photo-check-result">
          <div className={styles.resultHeader}>
            <span className={`${styles.badge} ${meta.className}`}>
              <meta.Icon size={13} aria-hidden />
              {meta.label}
            </span>
            <span className={styles.confidence}>
              {Math.round(result.confidence * 100)}% confidence
            </span>
          </div>
          <p className={styles.summary}>{result.summary}</p>

          <ul className={styles.findings}>
            {result.findings.map((finding) => (
              <li key={finding.id} className={styles.finding} data-severity={finding.severity}>
                <div className={styles.findingTitle}>{finding.title}</div>
                <div className={styles.findingDetail}>{finding.detail}</div>
                {finding.partIds && finding.partIds.length > 0 ? (
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => onMentionParts(finding.partIds ?? [])}
                  >
                    Highlight parts
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {result.recommendedUtterance ? (
            <button
              type="button"
              className={styles.recommendButton}
              disabled={disabled}
              onClick={() => void onRunUtterance(result.recommendedUtterance ?? '')}
            >
              Ask: “{result.recommendedUtterance}”
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
