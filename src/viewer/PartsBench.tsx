import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { partBins, slotPositions } from './bins';
import { partLayouts } from './useViewerCommands';
import { stepPartIds } from './partWorld';
import type { TokenColors } from './colors';

interface GhostProps {
  colors: TokenColors;
}

/**
 * Pulsing markers at install slots for the selected bin — only for hardware
 * relevant to the current step. Hidden while step operation indicators show.
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

  const stepParts = stepPartIds(currentStep);
  const markers: Array<[number, number, number]> = [];
  for (const partId of bin.partIds) {
    const layout = partLayouts[partId];
    if (!layout) continue;
    if (currentStep > layout.unlockStep) continue;
    if (!stepParts.has(partId)) continue;
    for (const pos of slotPositions(partId, currentStep, explodeLevel)) {
      markers.push(pos);
    }
  }

  if (markers.length === 0) return null;

  return (
    <group ref={groupRef}>
      {markers.map((pos, i) => (
        <mesh key={i} position={pos} userData={{ isSlotGhost: true }}>
          <sphereGeometry args={[0.045, 14, 14]} />
          <meshBasicMaterial color={colors.accent} transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}
