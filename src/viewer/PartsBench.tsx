import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { partBins, slotPositions, type PartBin } from './bins';
import { partLayouts } from './useViewerCommands';
import type { TokenColors } from './colors';
import styles from './Viewer.module.css';

interface BenchProps {
  colors: TokenColors;
}

const TRAY_W = 0.66;
const TRAY_D = 0.5;
const WALL_H = 0.1;
const WALL_T = 0.03;

function iconColor(shape: PartBin['iconShape'], colors: TokenColors): string {
  if (shape === 'dowel') return '#c8a97a';
  if (shape === 'strap') return colors.ok;
  return colors.inkSoft;
}

function TrayIcons({ bin, colors }: { bin: PartBin; colors: TokenColors }) {
  const color = iconColor(bin.iconShape, colors);
  const cols = Math.min(3, bin.icons);
  const rows = Math.ceil(bin.icons / cols);
  const items = Array.from({ length: bin.icons });
  return (
    <group>
      {items.map((_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = (col - (cols - 1) / 2) * 0.16;
        const z = (row - (rows - 1) / 2) * 0.15;
        const jitter = ((i * 37) % 10) / 400;
        const pos: [number, number, number] = [x + jitter, 0.05, z - jitter];
        if (bin.iconShape === 'dowel') {
          return (
            <mesh key={i} position={pos} rotation={[Math.PI / 2, 0, (i % 2) * 0.5]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 0.16, 12]} />
              <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
            </mesh>
          );
        }
        if (bin.iconShape === 'strap') {
          return (
            <mesh key={i} position={[x, 0.04, z]} castShadow>
              <boxGeometry args={[0.24, 0.03, 0.1]} />
              <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
            </mesh>
          );
        }
        const h = bin.iconShape === 'lock' ? 0.05 : 0.11;
        const r = bin.iconShape === 'lock' ? 0.05 : 0.028;
        return (
          <mesh key={i} position={[pos[0], h / 2 + 0.01, pos[2]]} castShadow>
            <cylinderGeometry args={[r, r, h, 14]} />
            <meshStandardMaterial color={color} roughness={0.4} metalness={0.55} />
          </mesh>
        );
      })}
    </group>
  );
}

function Tray({ bin, colors }: { bin: PartBin; colors: TokenColors }) {
  const selectedBinId = useAppStore((state) => state.selectedBinId);
  const selectBin = useAppStore((state) => state.selectBin);
  const setHighlightedParts = useAppStore((state) => state.setHighlightedParts);
  const mentionPart = useAppStore((state) => state.mentionPart);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const addTranscript = useAppStore((state) => state.addTranscript);
  const selected = selectedBinId === bin.id;

  const onSelect = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
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

  const wallColor = selected ? colors.accent : colors.line;
  const baseColor = selected ? colors.accent : colors.paperRaised;

  return (
    <group position={bin.position} onPointerDown={onSelect}>
      {/* tray floor */}
      <mesh position={[0, 0.015, 0]} receiveShadow castShadow>
        <boxGeometry args={[TRAY_W, 0.03, TRAY_D]} />
        <meshStandardMaterial
          color={baseColor}
          roughness={0.85}
          emissive={selected ? colors.accent : '#000000'}
          emissiveIntensity={selected ? 0.35 : 0}
        />
      </mesh>
      {/* four low walls */}
      <mesh position={[0, WALL_H / 2, TRAY_D / 2]} castShadow>
        <boxGeometry args={[TRAY_W, WALL_H, WALL_T]} />
        <meshStandardMaterial color={wallColor} roughness={0.8} />
      </mesh>
      <mesh position={[0, WALL_H / 2, -TRAY_D / 2]} castShadow>
        <boxGeometry args={[TRAY_W, WALL_H, WALL_T]} />
        <meshStandardMaterial color={wallColor} roughness={0.8} />
      </mesh>
      <mesh position={[TRAY_W / 2, WALL_H / 2, 0]} castShadow>
        <boxGeometry args={[WALL_T, WALL_H, TRAY_D]} />
        <meshStandardMaterial color={wallColor} roughness={0.8} />
      </mesh>
      <mesh position={[-TRAY_W / 2, WALL_H / 2, 0]} castShadow>
        <boxGeometry args={[WALL_T, WALL_H, TRAY_D]} />
        <meshStandardMaterial color={wallColor} roughness={0.8} />
      </mesh>

      <TrayIcons bin={bin} colors={colors} />

      <Html position={[0, 0.42, 0]} center distanceFactor={6} className={styles.binLabel} zIndexRange={[8, 0]}>
        <button
          type="button"
          className={`${styles.binCard} ${selected ? styles.binCardActive : ''}`}
          data-testid={`bin-${bin.id}`}
          onPointerDown={(domEvent) => {
            domEvent.stopPropagation();
            selectBin(bin.id);
            setHighlightedParts(bin.partIds);
            bin.partIds.forEach((partId) => mentionPart(partId));
            setActiveView('front');
          }}
        >
          <span className={styles.binNumber}>{bin.index}</span>
          <span className={styles.binName}>{bin.name}</span>
        </button>
      </Html>
    </group>
  );
}

export function PartsBench({ colors }: BenchProps) {
  return (
    <group>
      {partBins.map((bin) => (
        <Tray key={bin.id} bin={bin} colors={colors} />
      ))}
    </group>
  );
}

/**
 * Pulsing markers at the install slots for the currently selected bin's parts
 * that haven't been placed yet — the "highlight the slot" affordance.
 */
export function SlotGhosts({ colors }: BenchProps) {
  const selectedBinId = useAppStore((state) => state.selectedBinId);
  const currentStep = useAppStore((state) => state.currentStep);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const pulse = 0.7 + Math.sin(state.clock.elapsedTime * 6) * 0.3;
    // Scale each marker in place (parent scale would drag them toward center).
    for (const child of group.children) {
      child.scale.setScalar(pulse);
    }
  });

  const bin = partBins.find((entry) => entry.id === selectedBinId);
  if (!bin) return null;

  const markers: Array<[number, number, number]> = [];
  for (const partId of bin.partIds) {
    const layout = partLayouts[partId];
    if (!layout) continue;
    // Only show ghosts for parts not yet placed (their step hasn't arrived).
    if (currentStep >= layout.unlockStep) continue;
    for (const pos of slotPositions(partId)) {
      markers.push(pos);
    }
  }

  if (markers.length === 0) return null;

  return (
    <group ref={groupRef}>
      {markers.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color={colors.accent} transparent opacity={0.45} />
        </mesh>
      ))}
    </group>
  );
}
