import { useEffect, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { VIEWER_UI_SCALE } from './billyDimensions';
import { resolveStepOperations, type ResolvedOperation } from './stepOperations';
import { toolSpecs } from './tools';
import type { ToolKind } from '../types/assembly';
import type { TokenColors } from './colors';
import styles from './Viewer.module.css';

const RING_RADIUS = 0.07 * VIEWER_UI_SCALE;
const RING_TUBE = 0.012 * VIEWER_UI_SCALE;
const ANCHOR_RADIUS = 0.028 * VIEWER_UI_SCALE;
/** Html scales with camera distance; keep labels subtle on the smaller bookcase. */
const LABEL_DISTANCE_FACTOR = 4.8 * VIEWER_UI_SCALE * 0.72;

/** Seconds to keep the label fully visible after a step change. */
export const OPERATION_LABEL_HOLD_S = 2.2;
/** Seconds to fade the label out after the hold window. */
export const OPERATION_LABEL_FADE_S = 2.4;

const HOVER_RADIUS = RING_RADIUS * 3.2;

export function operationLabelOpacityAt(secondsSinceStep: number, hovered: boolean): number {
  if (hovered) return 1;
  if (secondsSinceStep < OPERATION_LABEL_HOLD_S) return 1;
  const fadeT = (secondsSinceStep - OPERATION_LABEL_HOLD_S) / OPERATION_LABEL_FADE_S;
  return Math.max(0, 1 - fadeT);
}

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
        <OperationMarker key={entry.operation.id} entry={entry} colors={colors} currentStep={currentStep} />
      ))}
    </group>
  );
}

export function operationRingScaleAt(elapsedTime: number): number {
  return 1 + Math.sin(elapsedTime * 2.2) * 0.03;
}

export function operationRingRotationAt(_elapsedTime: number): number {
  return 0;
}

function OperationMarker({
  entry,
  colors,
  currentStep
}: {
  entry: ResolvedOperation;
  colors: TokenColors;
  currentStep: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const anchorRef = useRef<THREE.Mesh>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const hoveredRef = useRef(false);
  const stepStartedAtRef = useRef(performance.now() / 1000);
  const gl = useThree((state) => state.gl);
  const { operation, anchor, normal } = entry;

  useEffect(() => {
    stepStartedAtRef.current = performance.now() / 1000;
    hoveredRef.current = false;
  }, [currentStep, operation.id]);

  useFrame((state) => {
    const secondsSinceStep = performance.now() / 1000 - stepStartedAtRef.current;
    const opacity = operationLabelOpacityAt(secondsSinceStep, hoveredRef.current);
    const t = state.clock.elapsedTime;

    if (ringRef.current) {
      ringRef.current.scale.setScalar(operationRingScaleAt(t));
      ringRef.current.rotation.z = operationRingRotationAt(t);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.72 * opacity;
    }
    if (anchorRef.current) {
      (anchorRef.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * opacity;
    }
    if (tagRef.current) {
      tagRef.current.style.opacity = String(opacity);
      tagRef.current.style.visibility = opacity < 0.04 ? 'hidden' : 'visible';
    }
  });

  const setHovered = (hovered: boolean) => {
    hoveredRef.current = hovered;
    gl.domElement.style.cursor = hovered ? 'pointer' : '';
    if (!hovered) {
      stepStartedAtRef.current = performance.now() / 1000;
    }
  };

  useEffect(() => () => {
    gl.domElement.style.cursor = '';
  }, [gl]);

  const spec = toolSpecs[operation.tool];
  const labelOffset = labelOffsetFromNormal(normal);

  return (
    <group>
      <mesh
        position={anchor}
        userData={{ isOperationGhost: true }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setHovered(false);
        }}
      >
        <sphereGeometry args={[HOVER_RADIUS, 14, 14]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} position={anchor} rotation={[Math.PI / 2, 0, 0]} userData={{ isOperationGhost: true }}>
        <torusGeometry args={[RING_RADIUS, RING_TUBE, 12, 32]} />
        <meshBasicMaterial color={colors.accent} transparent opacity={0.72} />
      </mesh>
      <mesh ref={anchorRef} position={anchor} userData={{ isOperationGhost: true }}>
        <sphereGeometry args={[ANCHOR_RADIUS, 12, 12]} />
        <meshBasicMaterial color={colors.accent} transparent opacity={0.35} />
      </mesh>
      <group position={anchor} userData={{ isOperationGhost: true }}>
        <Html
          position={labelOffset}
          center
          distanceFactor={LABEL_DISTANCE_FACTOR}
          className={styles.operationLabel}
          zIndexRange={[40, 0]}
        >
          <div ref={tagRef} className={styles.operationTag}>
            <div className={styles.operationTagHead}>
              <span className={styles.operationIconBadge}>
                <ToolIcon tool={operation.tool} />
              </span>
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
  const lift = 0.11 * VIEWER_UI_SCALE;
  const side = 0.08 * VIEWER_UI_SCALE;
  return [normal[0] * side + 0.04 * VIEWER_UI_SCALE, lift, normal[2] * side + 0.03 * VIEWER_UI_SCALE];
}

export { labelOffsetFromNormal };

function ToolIcon({ tool }: { tool: ToolKind }) {
  return (
    <svg className={styles.toolIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {toolIconPaths(tool)}
    </svg>
  );
}

function toolIconPaths(tool: ToolKind) {
  const stroke = 'currentColor';
  const sw = 1.6;
  const cap = { stroke, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const soft = { ...cap, className: styles.toolIconSecondary };
  const fill = { className: styles.toolIconFill };

  switch (tool) {
    case 'hands':
      return (
        <>
          <path d="M8.3 17.6V10.2c0-.8.5-1.3 1.1-1.3s1.1.5 1.1 1.3v3.1" {...cap} />
          <path d="M10.5 13.2V8.5c0-.8.5-1.3 1.1-1.3.7 0 1.1.5 1.1 1.3v4.6" {...cap} />
          <path d="M12.7 13.2V9.1c0-.8.5-1.2 1.1-1.2.7 0 1.1.5 1.1 1.2v4.5" {...cap} />
          <path d="M14.9 13.6v-2.7c0-.7.5-1.1 1-1.1.7 0 1.1.5 1.1 1.2v4.2c0 3.1-1.7 5.2-4.5 5.2h-.9c-1.5 0-2.8-.7-3.7-1.9l-1.6-2.2c-.4-.6-.3-1.2.2-1.6.5-.4 1.2-.3 1.7.2l1.1 1.2" {...cap} />
          <path d="M7 6.6c.7-1.4 2-2.4 3.6-2.7M15.7 4.2c1.3.6 2.3 1.8 2.7 3.1" {...soft} />
        </>
      );
    case 'flat-screwdriver':
      return (
        <>
          <path d="M5.3 18.8l6.1-6.1" {...cap} />
          <path d="M10.1 11.4l2.5 2.5" {...soft} />
          <path d="M12.8 11.2l4.1-4.1c.9-.9 2.1-.9 2.9-.1.8.8.8 2 0 2.9l-4.1 4.1-2.9-2.8z" {...cap} />
          <path d="M16.6 6.8l3.1 3.1" {...soft} />
          <path d="M4.4 19.8l2.1.2-.2-2.1" {...cap} />
        </>
      );
    case 'phillips':
      return (
        <>
          <path d="M5.2 18.9l6.1-6.1" {...cap} />
          <path d="M12.8 11.2l4-4c.9-.9 2.1-.9 2.9-.1.8.8.8 2 0 2.9l-4 4-2.9-2.8z" {...cap} />
          <path d="M15 8.6l2.7 2.7M14.6 11.7l3.5-3.5" {...soft} />
          <path d="M4.4 19.8l2.1.2-.2-2.1" {...cap} />
        </>
      );
    case 'pencil':
      return (
        <>
          <path d="M5 19l1.1-4.1L15.8 5.2c.8-.8 2-.8 2.8 0 .8.8.8 2 0 2.8l-9.7 9.7L5 19z" {...cap} />
          <path d="M14.5 6.6l2.9 2.9M6.1 14.9l2.8 2.8" {...soft} />
          <path d="M5 19l2.4-.7" {...cap} />
        </>
      );
    case 'ruler':
      return (
        <>
          <path d="M4.5 15.4l12.8-7.4 2.2 3.8-12.8 7.4-2.2-3.8z" {...cap} />
          <path d="M8.1 13.8l.8 1.4M10.8 12.2l1.1 1.9M13.5 10.6l.8 1.4M16.2 9.1l1.1 1.9" {...soft} />
        </>
      );
    case 'hammer':
      return (
        <>
          <path d="M8.1 19l5.1-8.9 2.4 1.4-5.1 8.9c-.3.6-1 .8-1.6.4-.7-.3-.9-1.1-.8-1.8z" {...cap} />
          <path d="M11.4 7.5l2.4-3.1h5.1c.8 0 1.5.6 1.5 1.4 0 .7-.6 1.3-1.4 1.3h-2.2l-1.9 2.7-3.5-2.3z" {...cap} />
          <path d="M13.8 4.4l3 2.7" {...soft} />
        </>
      );
    case 'drill':
      return (
        <>
          <path d="M4.4 9.3h8.1c1 0 1.7.7 1.7 1.7v2.6H4.4V9.3z" {...cap} />
          <path d="M7.1 13.6h4l.8 5.5H8.4l-1.3-5.5z" {...cap} />
          <path d="M14.2 11.4h4.2l2.2-1.2v3l-2.2-1.2h-4.2" {...cap} />
          <path d="M5.8 10.8h5.5" {...soft} />
          <circle cx="6.3" cy="11.5" r="0.75" {...fill} />
        </>
      );
  }
}
