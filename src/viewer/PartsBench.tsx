import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { partBins, slotPositions } from './bins';
import { partLayouts } from './useViewerCommands';
import type { TokenColors } from './colors';

interface GhostProps {
  colors: TokenColors;
}

/**
 * Pulsing markers at the install slots for the currently selected bin's parts
 * that haven't been placed yet — the "highlight the slot" affordance. The bins
 * themselves live in the DOM UI layer (components/PartsBinsPanel), not here.
 */
export function SlotGhosts({ colors }: GhostProps) {
  const selectedBinId = useAppStore((state) => state.selectedBinId);
  const currentStep = useAppStore((state) => state.currentStep);
  const explodeLevel = useAppStore((state) => state.explodeLevel);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const pulse = 0.7 + Math.sin(state.clock.elapsedTime * 6) * 0.3;
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
    // Only show ghosts for parts not yet seated (their unlock step hasn't arrived).
    if (currentStep >= layout.unlockStep) continue;
    for (const pos of slotPositions(partId, currentStep, explodeLevel)) {
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
