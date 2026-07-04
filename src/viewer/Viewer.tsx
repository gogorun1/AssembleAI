import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Edges, Html, OrbitControls } from '@react-three/drei';
import { Component, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import type { Part, ViewerAPI } from '../types/assembly';
import { derivePartPose, partLayouts, type PartLayout, type PartPrimitive } from './useViewerCommands';
import styles from './Viewer.module.css';

interface TokenColors {
  paperRaised: string;
  paperSunken: string;
  ink: string;
  inkSoft: string;
  line: string;
  accent: string;
  ok: string;
}

export function Viewer() {
  const setViewer = useAppStore((state) => state.setViewer);

  useEffect(() => {
    const api: ViewerAPI = {
      goToStep(index) {
        const store = useAppStore.getState();
        const step = store.manifest.steps[Math.max(0, Math.min(index - 1, store.manifest.steps.length - 1))];
        useAppStore.setState({
          currentStep: step.index,
          activeViewKey: step.cameraView,
          highlightedPartIds: step.highlightParts
        });
      },
      highlight(partIds) {
        useAppStore.setState({ highlightedPartIds: partIds });
      },
      clearHighlights() {
        useAppStore.setState({ highlightedPartIds: [] });
      },
      setCamera(viewKey) {
        useAppStore.setState({ activeViewKey: viewKey });
      },
      explode(level) {
        useAppStore.setState({ explodeLevel: level });
      },
      spinPart(partId) {
        useAppStore.setState({ selectedPartId: partId });
      }
    };

    setViewer(api);
  }, [setViewer]);

  return (
    <div className={styles.wrap}>
      <WebGLErrorBoundary>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [3.2, 2.1, 5.2], fov: 32, near: 0.1, far: 80 }}
        >
          <Scene />
        </Canvas>
      </WebGLErrorBoundary>
      <div className={styles.caption} aria-hidden>
        <div className={styles.eyebrow}>ASSEMBLY MANIFEST · BILLY-BOOKCASE</div>
        <div className={styles.title}>Voice + 3D assembly copilot</div>
      </div>
    </div>
  );
}

class WebGLErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <ViewerFallback />;
    }

    return this.props.children;
  }
}

function ViewerFallback() {
  const highlightedPartIds = useAppStore((state) => state.highlightedPartIds);
  const mentionedPartIds = useAppStore((state) => state.mentionedPartIds);
  const active = new Set([...highlightedPartIds, ...mentionedPartIds]);

  return (
    <div className={styles.fallback} aria-label="Assembly model fallback">
      <div className={styles.fallbackModel}>
        <div className={`${styles.fallbackPart} ${styles.sideLeft} ${active.has('side-panel-left') ? styles.hot : ''}`} />
        <div className={`${styles.fallbackPart} ${styles.sideRight} ${active.has('side-panel-right') ? styles.hot : ''}`} />
        <div className={`${styles.fallbackPart} ${styles.topPanel} ${active.has('top-panel') ? styles.hot : ''}`} />
        <div className={`${styles.fallbackPart} ${styles.bottomPanel} ${active.has('bottom-panel') ? styles.hot : ''}`} />
        <div className={`${styles.fallbackPart} ${styles.fixedShelf} ${active.has('fixed-shelf') ? styles.hot : ''}`} />
        <div className={`${styles.fallbackPart} ${styles.adjustableLow} ${active.has('adjustable-shelf') ? styles.hot : ''}`} />
        <div className={`${styles.fallbackPart} ${styles.adjustableHigh} ${active.has('adjustable-shelf') ? styles.hot : ''}`} />
        <div className={`${styles.fallbackPart} ${styles.backPanel} ${active.has('back-panel') ? styles.hot : ''}`} />
        <div className={`${styles.hardwareDot} ${styles.dotOne} ${active.has('cam-screw-washer') ? styles.hot : ''}`} />
        <div className={`${styles.hardwareDot} ${styles.dotTwo} ${active.has('cam-lock') ? styles.hot : ''}`} />
        <div className={`${styles.hardwareDot} ${styles.dotThree} ${active.has('shelf-pin') ? styles.hot : ''}`} />
      </div>
    </div>
  );
}

function Scene() {
  const controlsRef = useRef(null) as MutableRefObject<any>;
  const colors = useTokenColors();

  return (
    <>
      <color attach="background" args={[colors.paperSunken]} />
      <ambientLight intensity={0.62} />
      <directionalLight
        castShadow
        position={[3.4, 5.2, 3.2]}
        intensity={1.35}
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-3, 2.2, -2]} intensity={0.34} />
      <BookcaseModel colors={colors} />
      <ContactShadows
        position={[0, -0.02, 0]}
        opacity={0.28}
        scale={5}
        blur={2.4}
        far={3}
      />
      <CameraRig controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2.2}
        maxDistance={8}
        maxPolarAngle={Math.PI * 0.48}
      />
    </>
  );
}

function CameraRig({
  controlsRef
}: {
  controlsRef: MutableRefObject<any>;
}) {
  const camera = useThree((state) => state.camera);
  const manifest = useAppStore((state) => state.manifest);
  const activeViewKey = useAppStore((state) => state.activeViewKey);
  const reducedMotion = useReducedMotion();
  const view = manifest.cameraViews[activeViewKey] ?? manifest.cameraViews.front;
  const targetPosition = useMemo(() => new THREE.Vector3(...view.position), [view.position]);
  const targetLookAt = useMemo(() => new THREE.Vector3(...view.target), [view.target]);

  useFrame((_, delta) => {
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-delta * 4.4);
    camera.position.lerp(targetPosition, alpha);
    controlsRef.current?.target.lerp(targetLookAt, alpha);
    controlsRef.current?.update();
  });

  return null;
}

function BookcaseModel({ colors }: { colors: TokenColors }) {
  const manifest = useAppStore((state) => state.manifest);
  const currentStep = useAppStore((state) => state.currentStep);
  const explodeLevel = useAppStore((state) => state.explodeLevel);
  const selectedPartId = useAppStore((state) => state.selectedPartId);
  const partsById = useMemo(
    () => new Map(manifest.parts.map((part) => [part.id, part])),
    [manifest.parts]
  );

  return (
    <group position={[0, 0, 0]}>
      {Object.values(partLayouts).map((layout) => {
        const part = partsById.get(layout.partId);
        if (!part) {
          return null;
        }
        return (
          <PartGroup
            key={layout.partId}
            part={part}
            layout={layout}
            currentStep={currentStep}
            explodeLevel={explodeLevel}
            selected={selectedPartId === part.id}
            colors={colors}
          />
        );
      })}
      <GridPlate colors={colors} />
    </group>
  );
}

function PartGroup({
  part,
  layout,
  currentStep,
  explodeLevel,
  selected,
  colors
}: {
  part: Part;
  layout: PartLayout;
  currentStep: number;
  explodeLevel: 0 | 1 | 2;
  selected: boolean;
  colors: TokenColors;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const mentioned = useAppStore((state) => state.mentionedPartIds.includes(part.id));
  const highlighted = useAppStore((state) => state.highlightedPartIds.includes(part.id));
  const pose = derivePartPose(part.id, currentStep, explodeLevel);
  const targetOffset = useMemo(() => new THREE.Vector3(...pose.offset), [pose.offset]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    const alpha = 1 - Math.exp(-delta * 8);
    group.position.lerp(targetOffset, alpha);
    group.visible = pose.visible;
    group.rotation.y = selected ? state.clock.elapsedTime * 0.72 : THREE.MathUtils.lerp(group.rotation.y, 0, alpha);
    const pulse = mentioned ? 1 + Math.sin(state.clock.elapsedTime * 12) * 0.035 : 1;
    group.scale.setScalar(pulse);
  });

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const store = useAppStore.getState();
    store.selectPart(part.id);
    store.mentionPart(part.id);
    store.addTranscript({
      speaker: 'agent',
      text: `${part.code} is ${part.label}. I highlighted it in the model and parts rail.`,
      mentionedPartIds: [part.id],
      language: 'en'
    });
  };

  return (
    <group ref={groupRef} onPointerDown={onPointerDown}>
      {pose.primitives.map((primitive) => (
        <PrimitiveMesh
          key={primitive.id}
          primitive={primitive}
          layout={layout}
          colors={colors}
          highlighted={highlighted || mentioned}
        />
      ))}
      {selected ? (
        <Html position={annotationPosition(layout)} center distanceFactor={5.4} className={styles.annotation}>
          <div className={styles.annotationCode}>{part.code}</div>
          <div className={styles.annotationLabel}>{part.label}</div>
        </Html>
      ) : null}
    </group>
  );
}

function PrimitiveMesh({
  primitive,
  layout,
  colors,
  highlighted
}: {
  primitive: PartPrimitive;
  layout: PartLayout;
  colors: TokenColors;
  highlighted: boolean;
}) {
  const materialColor = highlighted ? colors.accent : colorForRole(layout.role, colors);
  const emissive = highlighted ? colors.accent : colors.ink;
  const emissiveIntensity = highlighted ? 0.8 : 0;

  return (
    <mesh
      castShadow
      receiveShadow
      position={primitive.position}
      rotation={primitive.rotation}
    >
      {primitive.shape === 'box' ? (
        <boxGeometry args={primitive.size} />
      ) : (
        <cylinderGeometry args={[primitive.size[0], primitive.size[1], primitive.size[2], 32]} />
      )}
      <meshStandardMaterial
        color={materialColor}
        roughness={0.72}
        metalness={layout.role === 'hardware' ? 0.18 : 0.02}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
      {primitive.shape === 'box' ? <Edges color={colors.ink} threshold={18} /> : null}
    </mesh>
  );
}

function GridPlate({ colors }: { colors: TokenColors }) {
  return (
    <mesh position={[0, -0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[4.6, 4.6, 16, 16]} />
      <meshBasicMaterial color={colors.paperSunken} transparent opacity={0.34} />
    </mesh>
  );
}

function annotationPosition(layout: PartLayout): [number, number, number] {
  const first = layout.primitives[0];
  return [first.position[0], first.position[1] + 0.22, first.position[2] + 0.28];
}

function colorForRole(role: PartLayout['role'], colors: TokenColors): string {
  if (role === 'hardware') {
    return colors.inkSoft;
  }
  if (role === 'back') {
    return colors.paperSunken;
  }
  if (role === 'strap') {
    return colors.ok;
  }
  return colors.paperRaised;
}

function useTokenColors(): TokenColors {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        paperRaised: 'white',
        paperSunken: 'beige',
        ink: 'black',
        inkSoft: 'gray',
        line: 'gray',
        accent: 'orange',
        ok: 'green'
      };
    }

    const style = getComputedStyle(document.documentElement);
    const read = (name: string) => style.getPropertyValue(name).trim();
    return {
      paperRaised: read('--paper-raised'),
      paperSunken: read('--paper-sunken'),
      ink: read('--ink'),
      inkSoft: read('--ink-soft'),
      line: read('--line'),
      accent: read('--accent'),
      ok: read('--ok')
    };
  }, []);
}

function useReducedMotion(): boolean {
  const ref = useRef(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    ref.current = query.matches;
    const update = () => {
      ref.current = query.matches;
    };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return ref.current;
}
