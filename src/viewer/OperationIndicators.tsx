import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { resolveStepOperations, type ResolvedOperation } from './stepOperations';
import { toolSpecs } from './tools';
import type { ToolKind } from '../types/assembly';
import type { OperationMotion } from '../types/assembly';
import type { TokenColors } from './colors';
import styles from './Viewer.module.css';

interface OperationIndicatorsProps {
  colors: TokenColors;
}

export function OperationIndicators({ colors }: OperationIndicatorsProps) {
  const currentStep = useAppStore((state) => state.currentStep);
  const explodeLevel = useAppStore((state) => state.explodeLevel);
  const selectedBinId = useAppStore((state) => state.selectedBinId);
  if (selectedBinId) return null;

  const resolved = resolveStepOperations(currentStep, currentStep, explodeLevel).filter((entry) => entry.visible);

  if (resolved.length === 0) {
    return null;
  }

  return (
    <group userData={{ isOperationGhost: true }}>
      {resolved.map((entry) => (
        <OperationMarker key={entry.operation.id} entry={entry} colors={colors} />
      ))}
    </group>
  );
}

function OperationMarker({ entry, colors }: { entry: ResolvedOperation; colors: TokenColors }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const { operation, anchor, normal } = entry;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = 0.82 + Math.sin(t * 5) * 0.18;
    if (ringRef.current) {
      ringRef.current.scale.setScalar(pulse);
      ringRef.current.rotation.z = t * 0.6;
    }
  });

  const spec = toolSpecs[operation.tool];
  const labelOffset = labelOffsetFromNormal(normal);

  return (
    <group>
      <mesh ref={ringRef} position={anchor} rotation={[Math.PI / 2, 0, 0]} userData={{ isOperationGhost: true }}>
        <torusGeometry args={[0.07, 0.012, 12, 32]} />
        <meshBasicMaterial color={colors.accent} transparent opacity={0.72} />
      </mesh>
      <mesh position={anchor} userData={{ isOperationGhost: true }}>
        <sphereGeometry args={[0.028, 12, 12]} />
        <meshBasicMaterial color={colors.accent} transparent opacity={0.35} />
      </mesh>
      <group position={anchor} userData={{ isOperationGhost: true }}>
        <Html
          position={labelOffset}
          center
          distanceFactor={4.8}
          className={styles.operationLabel}
          zIndexRange={[40, 0]}
        >
          <div className={styles.operationTag}>
            <div className={styles.operationTagHead}>
              <ToolIcon tool={operation.tool} motion={operation.motion} />
              <span className={styles.operationTool}>{spec.label}</span>
            </div>
            <span className={styles.operationHint}>{operation.label}</span>
          </div>
        </Html>
      </group>
    </group>
  );
}

function labelOffsetFromNormal(normal: [number, number, number]): [number, number, number] {
  const lift = 0.22;
  const side = 0.16;
  return [normal[0] * side + 0.08, lift, normal[2] * side + 0.06];
}

function ToolIcon({ tool, motion }: { tool: ToolKind; motion: OperationMotion }) {
  const motionClass =
    motion === 'turn' ? styles.toolIconTurn : motion === 'strike' ? styles.toolIconStrike : motion === 'press' ? styles.toolIconPress : '';

  return (
    <svg className={`${styles.toolIcon} ${motionClass}`} viewBox="0 0 24 24" aria-hidden="true">
      {toolIconPaths(tool)}
    </svg>
  );
}

function toolIconPaths(tool: ToolKind) {
  const stroke = 'currentColor';
  const sw = 1.8;
  const cap = { stroke, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  switch (tool) {
    case 'hands':
      return (
        <>
          <circle cx="12" cy="12" r="5.5" {...cap} />
          <path d="M12 8.5v7M9 12h6" {...cap} />
        </>
      );
    case 'flat-screwdriver':
      return (
        <>
          <path d="M6 18l8-8" {...cap} />
          <path d="M13 9h3.5v3.5" {...cap} />
        </>
      );
    case 'phillips':
      return (
        <>
          <path d="M6 18l8-8" {...cap} />
          <path d="M12.5 8.5v4M10.5 10.5h4" {...cap} />
        </>
      );
    case 'pencil':
      return (
        <>
          <path d="M5 19l9-9" {...cap} />
          <path d="M13 9l2 2" {...cap} />
          <path d="M15 11l2.5 2.5" {...cap} strokeWidth={1.4} />
        </>
      );
    case 'ruler':
      return (
        <>
          <rect x="4" y="10" width="16" height="5" rx="0.8" {...cap} />
          <path d="M7 10v2M10 10v3M13 10v2M16 10v3M19 10v2" {...cap} strokeWidth={1.4} />
        </>
      );
    case 'hammer':
      return (
        <>
          <path d="M8 18l4-10" {...cap} />
          <path d="M11 7h6.5a1.5 1.5 0 0 0 0-3H11" {...cap} />
        </>
      );
    case 'drill':
      return (
        <>
          <rect x="5" y="9" width="9" height="6" rx="1.2" {...cap} />
          <path d="M14 12h5M19 12l2-1.5v3L19 12z" {...cap} fill="currentColor" stroke="none" />
        </>
      );
  }
}
