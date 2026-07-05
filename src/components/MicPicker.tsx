import { Activity, Ear, Glasses, Mic, RefreshCw, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createLevelMeter,
  detectGlasses,
  getMicPermission,
  listAudioInputs,
  requestMicPermission,
  supportsMicSelection,
  type AudioInput,
  type LevelMeter,
  type MicPermission
} from '../services/microphones';
import { useAppStore } from '../store/useAppStore';
import styles from './MicPicker.module.css';

interface MicPickerProps {
  disabled?: boolean;
  onNotify?(message: string): void;
  /** True while a hands-free (auto-stop) listening session is running. */
  handsFreeActive?: boolean;
  /** Start/stop hands-free listening (voice-activity detection). */
  onToggleHandsFree?(): void;
}

// When an STT endpoint is configured, a selected device is captured directly and
// transcribed server-side, so the in-app choice actually drives voice commands.
const STT_ENDPOINT = import.meta.env.VITE_STT_ENDPOINT as string | undefined;

export function MicPicker({
  disabled = false,
  onNotify,
  handsFreeActive = false,
  onToggleHandsFree
}: MicPickerProps) {
  const selectedId = useAppStore((state) => state.selectedMicId);
  const setSelectedMicId = useAppStore((state) => state.setSelectedMicId);

  const [permission, setPermission] = useState<MicPermission>('prompt');
  const [inputs, setInputs] = useState<AudioInput[]>([]);
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);

  const meterRef = useRef<LevelMeter | null>(null);
  const rafRef = useRef<number>();

  const selected = inputs.find((input) => input.deviceId === selectedId);
  const selectedIsGlasses = selected ? selected.isLikelyGlasses : false;
  const recordedModeActive = Boolean(STT_ENDPOINT) && Boolean(selectedId);

  const refreshDevices = useCallback(
    async (autoSelectGlasses: boolean) => {
      const list = await listAudioInputs();
      setInputs(list);
      const current = useAppStore.getState().selectedMicId;
      const stillExists = current && list.some((input) => input.deviceId === current);
      if (!stillExists && autoSelectGlasses) {
        const glasses = detectGlasses(list);
        if (glasses) {
          setSelectedMicId(glasses.deviceId);
        }
      }
    },
    [setSelectedMicId]
  );

  useEffect(() => {
    if (!supportsMicSelection()) {
      setPermission('unsupported');
      return;
    }
    let cancelled = false;
    void getMicPermission().then(async (state) => {
      if (cancelled) {
        return;
      }
      setPermission(state);
      if (state === 'granted') {
        await refreshDevices(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refreshDevices]);

  useEffect(() => {
    if (permission !== 'granted' || !navigator.mediaDevices) {
      return;
    }
    const handler = () => void refreshDevices(false);
    navigator.mediaDevices.addEventListener('devicechange', handler);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handler);
  }, [permission, refreshDevices]);

  const stopMeter = useCallback(() => {
    if (rafRef.current !== undefined) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
    meterRef.current?.stop();
    meterRef.current = null;
    setTesting(false);
    setLevel(0);
  }, []);

  useEffect(() => stopMeter, [stopMeter]);

  const enable = useCallback(async () => {
    const state = await requestMicPermission();
    setPermission(state);
    if (state === 'granted') {
      await refreshDevices(true);
    } else if (state === 'denied') {
      onNotify?.('Microphone permission was blocked - allow it in the browser to pick a device.');
    }
  }, [refreshDevices, onNotify]);

  const onSelect = useCallback(
    (deviceId: string) => {
      setSelectedMicId(deviceId || undefined);
      if (testing) {
        stopMeter();
      }
    },
    [testing, stopMeter, setSelectedMicId]
  );

  const toggleTest = useCallback(async () => {
    if (testing) {
      stopMeter();
      return;
    }
    try {
      const meter = await createLevelMeter(selectedId);
      meterRef.current = meter;
      setTesting(true);
      const tick = () => {
        setLevel(meter.getLevel());
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      onNotify?.('Could not open that microphone - reconnect the glasses and try again.');
      stopMeter();
    }
  }, [testing, selectedId, stopMeter, onNotify]);

  if (permission === 'unsupported') {
    return (
      <section className={styles.panel} aria-label="Microphone input">
        <div className={styles.heading}>Microphone</div>
        <p className={styles.note}>
          This browser can't enumerate microphones. Use Chrome to route voice through your glasses.
        </p>
      </section>
    );
  }

  const meterPercent = Math.round(level * 100);

  return (
    <section className={styles.panel} aria-label="Microphone input">
      <div className={styles.header}>
        <div className={styles.heading}>Microphone</div>
        {permission === 'granted' && (
          <button
            type="button"
            className={styles.iconGhost}
            onClick={() => void refreshDevices(false)}
            disabled={disabled}
            aria-label="Refresh device list"
            title="Refresh device list"
          >
            <RefreshCw size={13} aria-hidden />
          </button>
        )}
      </div>

      {permission !== 'granted' ? (
        <>
          <p className={styles.note}>
            Pair your Ray-Ban Meta glasses to this computer as a Bluetooth headset, then enable the
            mic to select them.
          </p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void enable()}
            disabled={disabled}
            data-testid="mic-enable"
          >
            <Mic size={14} aria-hidden />
            Enable microphone
          </button>
          {permission === 'denied' && (
            <p className={styles.warn}>
              Access is blocked. Allow the microphone for this site in your browser settings.
            </p>
          )}
        </>
      ) : (
        <>
          <label className={styles.selectRow}>
            <span className={styles.selectLabel}>Input device</span>
            <select
              className={styles.select}
              value={selectedId ?? ''}
              disabled={disabled || inputs.length === 0}
              onChange={(event) => onSelect(event.currentTarget.value)}
              data-testid="mic-select"
            >
              <option value="">System default</option>
              {inputs.map((input) => (
                <option key={input.deviceId} value={input.deviceId}>
                  {input.isLikelyGlasses ? 'GLASSES - ' : ''}
                  {input.label}
                </option>
              ))}
            </select>
          </label>

          {selected && (
            <div className={styles.statusRow}>
              {selectedIsGlasses ? (
                <span className={`${styles.badge} ${styles.badgeGlasses}`}>
                  <Glasses size={12} aria-hidden />
                  Meta glasses detected
                </span>
              ) : (
                <span className={styles.badge}>
                  <Mic size={12} aria-hidden />
                  Standard microphone
                </span>
              )}
            </div>
          )}

          <div className={styles.testRow}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void toggleTest()}
              disabled={disabled}
              data-testid="mic-test"
              aria-pressed={testing}
            >
              <Activity size={14} aria-hidden />
              {testing ? 'Stop test' : 'Test mic'}
            </button>
            <div
              className={styles.meterTrack}
              role="meter"
              aria-label="Microphone input level"
              aria-valuenow={meterPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={styles.meterFill}
                data-active={testing}
                style={{ width: `${meterPercent}%` }}
              />
            </div>
          </div>

          {recordedModeActive && onToggleHandsFree && (
            <button
              type="button"
              className={styles.handsFreeButton}
              data-active={handsFreeActive}
              onClick={onToggleHandsFree}
              disabled={disabled && !handsFreeActive}
              data-testid="mic-hands-free"
              aria-pressed={handsFreeActive}
            >
              {handsFreeActive ? (
                <>
                  <Square size={13} aria-hidden />
                  Listening... tap to stop
                </>
              ) : (
                <>
                  <Ear size={14} aria-hidden />
                  Hands-free (Meta)
                </>
              )}
            </button>
          )}

          {recordedModeActive ? (
            <p className={styles.note}>
              {handsFreeActive
                ? 'Speak your command - I will detect when you finish and act automatically.'
                : 'Tap Hands-free and just speak - no need to hold a button. Or hold the voice orb to talk.'}
            </p>
          ) : STT_ENDPOINT ? (
            <p className={styles.note}>
              Select a specific device above to capture commands from it. With "System default", the
              browser recognizer uses your OS default input.
            </p>
          ) : (
            <p className={styles.note}>
              Voice commands use your system's default input. To speak through the glasses, set them
              as the input in your OS sound settings, then confirm the meter reacts to your voice.
            </p>
          )}
        </>
      )}
    </section>
  );
}
