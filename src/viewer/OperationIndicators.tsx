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
  const actorRef = useRef<THREE.Group>(null);
  const { operation, anchor, approach, normal } = entry;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = 0.82 + Math.sin(t * 5) * 0.18;
    if (ringRef.current) {
      ringRef.current.scale.setScalar(pulse);
      ringRef.current.rotation.z = t * 0.6;
    }
    if (actorRef.current) {
      const motion = motionOffset(operation.motion, t);
      actorRef.current.position.set(
        THREE.MathUtils.lerp(approach[0], anchor[0], motion.amount) + motion.jitter[0],
        THREE.MathUtils.lerp(approach[1], anchor[1], motion.amount) + motion.jitter[1],
        THREE.MathUtils.lerp(approach[2], anchor[2], motion.amount) + motion.jitter[2]
      );
      actorRef.current.rotation.set(
        motion.rotation[0] + Math.atan2(normal[2], normal[0]),
        motion.rotation[1],
        motion.rotation[2]
      );
    }
  });

  const spec = toolSpecs[operation.tool];
  const labelOffset = labelOffsetFromNormal(normal);
  const showHandIcon = operation.tool !== 'hammer' && operation.tool !== 'drill';

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
            <span className={styles.operationTool}>{spec.shortLabel}</span>
            <span className={styles.operationHint}>{operation.label}</span>
          </div>
        </Html>
      </group>
      <group ref={actorRef} position={approach} userData={{ isOperationGhost: true }}>
        {showHandIcon ? (
          <Html position={[-0.06, 0.1, -0.04]} center distanceFactor={5.2} className={styles.handIconWrap} zIndexRange={[35, 0]}>
            <HandIcon />
          </Html>
        ) : null}
        <group rotation={[0, Math.PI * 0.15, 0]}>
          <ToolMesh tool={operation.tool} />
        </group>
      </group>
    </group>
  );
}

function labelOffsetFromNormal(normal: [number, number, number]): [number, number, number] {
  const lift = 0.22;
  const side = 0.16;
  return [normal[0] * side + 0.08, lift, normal[2] * side + 0.06];
}

function HandIcon() {
  return (
    <svg className={styles.handIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#E8BEAC"
        stroke="#C99A86"
        strokeWidth="0.6"
        d="M4.5 11.2c0-1.2.7-2.2 1.8-2.6.2-.8.9-1.4 1.8-1.4.5 0 1 .2 1.3.5.4-.8 1.2-1.3 2.1-1.3 1.2 0 2.2.9 2.4 2.1.9.4 1.5 1.3 1.5 2.4v3.1c0 1.5-1.2 2.7-2.7 2.7H9.8c-1.8 0-3.3-1.5-3.3-3.3v-3.2z"
      />
      <path fill="#F5E6DC" d="M7.2 9.8c.3 1.6.5 3.3.5 5h1.4c.1-1.8.1-3.5-.1-5.2-.6-.1-1-.3-1.4-.6-.2.2-.3.5-.4.8z" />
    </svg>
  );
}

function motionOffset(
  motion: OperationMotion,
  t: number
): { amount: number; jitter: [number, number, number]; rotation: [number, number, number] } {
  const wave = (Math.sin(t * 4) + 1) / 2;
  switch (motion) {
    case 'press':
      return { amount: 0.35 + wave * 0.45, jitter: [0, 0, 0], rotation: [0, 0, 0] };
    case 'turn':
      return { amount: 0.55, jitter: [0, 0, 0], rotation: [0, t * 2.4, 0] };
    case 'slide':
      return { amount: 0.25 + wave * 0.35, jitter: [Math.sin(t * 3) * 0.02, 0, 0], rotation: [0, 0, 0] };
    case 'strike':
      return { amount: 0.4 + (Math.sin(t * 8) > 0.7 ? 0.35 : 0), jitter: [0, Math.max(0, Math.sin(t * 8)) * 0.04, 0], rotation: [0, 0, 0] };
    case 'mark':
      return { amount: 0.5, jitter: [Math.sin(t * 5) * 0.03, 0, Math.cos(t * 5) * 0.02], rotation: [0, 0, Math.sin(t * 3) * 0.15] };
    default:
      return { amount: 0.5, jitter: [0, 0, 0], rotation: [0, 0, 0] };
  }
}

function ToolMesh({ tool }: { tool: ToolKind }) {
  if (tool === 'hands') {
    return (
      <mesh position={[0.04, 0.02, 0.04]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.05, 0.028, 0.04]} />
        <meshStandardMaterial color="#F5E6DC" roughness={0.7} />
      </mesh>
    );
  }
  if (tool === 'flat-screwdriver') {
    return (
      <group position={[0.02, 0, 0.05]} rotation={[0, 0, Math.PI / 2]}>
        <mesh position={[0, 0, -0.05]}>
          <cylinderGeometry args={[0.012, 0.012, 0.1, 12]} />
          <meshStandardMaterial color="#F2C94C" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <boxGeometry args={[0.035, 0.006, 0.02]} />
          <meshStandardMaterial color="#8B9098" metalness={0.55} roughness={0.35} />
        </mesh>
      </group>
    );
  }
  if (tool === 'phillips' || tool === 'drill') {
    return (
      <group position={[0.02, 0, 0.05]} rotation={[0, 0, Math.PI / 2]}>
        <mesh position={[0, 0, -0.05]}>
          <cylinderGeometry args={[0.013, 0.013, 0.11, 12]} />
          <meshStandardMaterial color={tool === 'drill' ? '#3D4654' : '#F2C94C'} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.045]}>
          <cylinderGeometry args={[0.004, 0.004, 0.04, 8]} />
          <meshStandardMaterial color="#8B9098" metalness={0.62} roughness={0.28} />
        </mesh>
        {tool === 'drill' ? (
          <mesh position={[0, 0, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.06, 0.05, 0.08]} />
            <meshStandardMaterial color="#3D4654" roughness={0.45} />
          </mesh>
        ) : null}
      </group>
    );
  }
  if (tool === 'hammer') {
    return (
      <group position={[0, 0.04, 0]} rotation={[0.4, 0, 0]}>
        <mesh position={[0, -0.06, 0]}>
          <cylinderGeometry args={[0.011, 0.011, 0.14, 10]} />
          <meshStandardMaterial color="#B8875A" roughness={0.72} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.05, 0.028, 0.03]} />
          <meshStandardMaterial color="#7A8088" metalness={0.5} roughness={0.38} />
        </mesh>
      </group>
    );
  }
  if (tool === 'pencil') {
    return (
      <group position={[0.03, 0, 0.04]} rotation={[0.3, 0.2, Math.PI / 2]}>
        <mesh position={[0, 0, -0.04]}>
          <cylinderGeometry args={[0.005, 0.005, 0.09, 8]} />
          <meshStandardMaterial color="#E67E22" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <coneGeometry args={[0.006, 0.018, 8]} />
          <meshStandardMaterial color="#4A4A4A" roughness={0.4} />
        </mesh>
      </group>
    );
  }
  // ruler
  return (
    <group position={[0.04, 0, 0.02]} rotation={[0, 0.4, 0]}>
      <mesh>
        <boxGeometry args={[0.16, 0.004, 0.028]} />
        <meshStandardMaterial color="#D4C4A8" roughness={0.65} />
      </mesh>
      {[0, 1, 2, 3, 4].map((tick) => (
        <mesh key={tick} position={[-0.06 + tick * 0.03, 0.004, 0]}>
          <boxGeometry args={[0.002, 0.004, 0.012]} />
          <meshStandardMaterial color="#6F6760" />
        </mesh>
      ))}
    </group>
  );
}
