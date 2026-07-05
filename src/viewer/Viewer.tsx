import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Edges, Html, OrbitControls, useGLTF } from '@react-three/drei';
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode
} from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import type { Part, ViewerAPI } from '../types/assembly';
import {
  derivePartPose,
  partLayouts,
  resolvePartIdForNode,
  type DetailMaterial,
  type PartLayout,
  type PartPrimitive
} from './useViewerCommands';
import styles from './Viewer.module.css';
import { useTokenColors, type TokenColors } from './colors';
import { binForPart } from './bins';
import { SlotGhosts } from './PartsBench';
import { OperationIndicators } from './OperationIndicators';
import { resolvePickablePartId } from './picking';
import { isTap, markPointerDown } from './pointer';

interface CameraSnapshot {
  viewKey: string;
  position: [number, number, number];
  target: [number, number, number];
}

interface MappingReport {
  modelPath: string;
  totalNodes: number;
  matchedParts: number;
  missingPartIds: string[];
}

interface FlightState {
  seeded: boolean;
  prev: boolean;
  flying: boolean;
  t: number;
  from: THREE.Vector3;
}

const FLIGHT_SECONDS = 1.5;
const FLIGHT_ARC_LIFT = 1.1;

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

interface PartBinding {
  partId: string;
  node: THREE.Object3D;
  meshes: THREE.Mesh[];
  basePosition: THREE.Vector3;
  baseScale: THREE.Vector3;
  center: THREE.Vector3;
}

export function Viewer() {
  const setViewer = useAppStore((state) => state.setViewer);
  const manifest = useAppStore((state) => state.manifest);
  const modelPath = manifest.model?.glbPath;
  const showCameraHelper = useMemo(() => getDebugFlag('camDebug'), []);
  const showMeshHelper = useMemo(() => getDebugFlag('meshDebug'), []);
  const [cameraSnapshot, setCameraSnapshot] = useState<CameraSnapshot>();
  const [mappingReport, setMappingReport] = useState<MappingReport>();

  useEffect(() => {
    if (modelPath) {
      useGLTF.preload(modelPath);
    }
  }, [modelPath]);

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
          camera={{ position: [2.3, 2.5, 7.0], fov: 38, near: 0.1, far: 80 }}
          onPointerDown={(event) => markPointerDown(event.clientX, event.clientY)}
        >
          <Scene
            modelPath={modelPath}
            onCameraSnapshot={showCameraHelper ? setCameraSnapshot : undefined}
            onMappingReport={showMeshHelper ? setMappingReport : undefined}
          />
        </Canvas>
      </WebGLErrorBoundary>
      <div className={styles.caption} aria-hidden>
        <div className={styles.eyebrow}>IKEA ASSEMBLY · {manifest.id.toUpperCase()}</div>
        <div className={styles.title}>{manifest.name}</div>
        {showCameraHelper && cameraSnapshot ? <CameraHelperPanel snapshot={cameraSnapshot} /> : null}
        {showMeshHelper && mappingReport ? <MeshHelperPanel report={mappingReport} /> : null}
      </div>
    </div>
  );
}

class WebGLErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
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

class ModelErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback;
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
        <div className={`${styles.fallbackPart} ${styles.adjustableBottom} ${active.has('adjustable-shelf') ? styles.hot : ''}`} />
        <div className={`${styles.fallbackPart} ${styles.adjustableLow} ${active.has('adjustable-shelf') ? styles.hot : ''}`} />
        <div className={`${styles.fallbackPart} ${styles.adjustableHigh} ${active.has('adjustable-shelf') ? styles.hot : ''}`} />
        <div className={`${styles.fallbackPart} ${styles.adjustableTop} ${active.has('adjustable-shelf') ? styles.hot : ''}`} />
        <div className={`${styles.fallbackPart} ${styles.frontRail} ${active.has('front-rail') ? styles.hot : ''}`} />
        <div className={`${styles.fallbackPart} ${styles.backPanel} ${active.has('back-panel') ? styles.hot : ''}`} />
        <div className={`${styles.hardwareDot} ${styles.dotOne} ${active.has('cam-screw') ? styles.hot : ''}`} />
        <div className={`${styles.hardwareDot} ${styles.dotTwo} ${active.has('back-nail') ? styles.hot : ''}`} />
        <div className={`${styles.hardwareDot} ${styles.dotThree} ${active.has('shelf-pin') ? styles.hot : ''}`} />
        <div className={`${styles.hardwareDot} ${styles.dotFour} ${active.has('wall-bracket') ? styles.hot : ''}`} />
      </div>
    </div>
  );
}

function Scene({
  modelPath,
  onCameraSnapshot,
  onMappingReport
}: {
  modelPath?: string;
  onCameraSnapshot?: (value: CameraSnapshot) => void;
  onMappingReport?: (value: MappingReport) => void;
}) {
  const controlsRef = useRef(null) as MutableRefObject<any>;
  // Bumped when the user grabs the controls, so an in-flight camera transition
  // yields immediately to manual orbit/zoom.
  const interruptRef = useRef(0);
  const colors = useTokenColors();

  return (
    <>
      <color attach="background" args={[colors.paperSunken]} />
      <ambientLight intensity={0.74} />
      <directionalLight
        castShadow
        position={[3.2, 6.2, 3.8]}
        intensity={1.2}
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-2.8, 3.2, -2.6]} intensity={0.28} />
      {modelPath ? (
        <ModelErrorBoundary fallback={<PrimitiveModel colors={colors} />}>
          <Suspense fallback={<LoadingModel colors={colors} />}>
            <GlbModel colors={colors} modelPath={modelPath} onMappingReport={onMappingReport} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        <PrimitiveModel colors={colors} />
      )}
      <GridPlate colors={colors} />
      <SlotGhosts colors={colors} />
      <OperationIndicators colors={colors} />
      <ContactShadows position={[0, -0.02, 0]} opacity={0.28} scale={5} blur={2.4} far={3} />
      <CameraRig controlsRef={controlsRef} interruptRef={interruptRef} onCameraSnapshot={onCameraSnapshot} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={2.2}
        maxDistance={9}
        maxPolarAngle={Math.PI * 0.5}
        onStart={() => {
          interruptRef.current += 1;
        }}
      />
    </>
  );
}

function CameraRig({
  controlsRef,
  interruptRef,
  onCameraSnapshot
}: {
  controlsRef: MutableRefObject<any>;
  interruptRef: MutableRefObject<number>;
  onCameraSnapshot?: (value: CameraSnapshot) => void;
}) {
  const camera = useThree((state) => state.camera);
  const manifest = useAppStore((state) => state.manifest);
  const activeViewKey = useAppStore((state) => state.activeViewKey);
  const cameraNonce = useAppStore((state) => state.cameraNonce);
  const reducedMotion = useReducedMotion();

  const lastNonce = useRef(-1);
  const lastInterrupt = useRef(0);
  const flying = useRef(false);
  const t = useRef(1);
  const dur = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const endTarget = useRef(new THREE.Vector3());
  const lastEmitRef = useRef(0);

  useFrame((_, delta) => {
    const controls = controlsRef.current;

    // A user grab cancels any in-flight preset transition so orbit/zoom is free.
    if (interruptRef.current !== lastInterrupt.current) {
      lastInterrupt.current = interruptRef.current;
      flying.current = false;
    }

    // A new camera command (view button, step, bin, reset) starts a one-shot flight.
    if (cameraNonce !== lastNonce.current) {
      lastNonce.current = cameraNonce;
      const view = manifest.cameraViews[activeViewKey] ?? manifest.cameraViews.front;
      startPos.current.copy(camera.position);
      startTarget.current.copy(controls?.target ?? startTarget.current.set(0, 1.1, 0));
      endPos.current.set(...view.position);
      endTarget.current.set(...view.target);
      t.current = 0;
      dur.current = reducedMotion ? 0 : 0.85;
      flying.current = true;
    }

    if (flying.current) {
      t.current = dur.current <= 0 ? 1 : Math.min(1, t.current + delta / dur.current);
      const e = easeInOutCubic(t.current);
      camera.position.lerpVectors(startPos.current, endPos.current, e);
      if (controls) controls.target.lerpVectors(startTarget.current, endTarget.current, e);
      if (t.current >= 1) flying.current = false;
    }

    // Always update so OrbitControls damping works during free manual control.
    controls?.update();

    if (onCameraSnapshot) {
      const now = performance.now();
      if (now - lastEmitRef.current > 180) {
        const target = controls?.target as THREE.Vector3 | undefined;
        onCameraSnapshot({
          viewKey: activeViewKey,
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: target ? [target.x, target.y, target.z] : [0, 1.1, 0]
        });
        lastEmitRef.current = now;
      }
    }
  });

  return null;
}

function LoadingModel({ colors }: { colors: TokenColors }) {
  return (
    <Html center>
      <div className={styles.loading}>
        <span className={styles.loadingDot} style={{ background: colors.accent }} />
        Loading model…
      </div>
    </Html>
  );
}

function GlbModel({
  colors,
  modelPath,
  onMappingReport
}: {
  colors: TokenColors;
  modelPath: string;
  onMappingReport?: (value: MappingReport) => void;
}) {
  const gltf = useGLTF(modelPath);
  const manifest = useAppStore((state) => state.manifest);
  const currentStep = useAppStore((state) => state.currentStep);
  const explodeLevel = useAppStore((state) => state.explodeLevel);
  const selectedPartId = useAppStore((state) => state.selectedPartId);
  const highlightedPartIds = useAppStore((state) => state.highlightedPartIds);
  const mentionedPartIds = useAppStore((state) => state.mentionedPartIds);

  const { root, bindings, unmatchedPartIds } = useMemo(
    () => buildBindings(gltf.scene, manifest.parts, colors),
    [gltf.scene, manifest.parts, colors]
  );

  const partsById = useMemo(
    () => new Map(manifest.parts.map((part) => [part.id, part])),
    [manifest.parts]
  );

  useEffect(() => {
    onMappingReport?.({
      modelPath,
      totalNodes: bindings.length + unmatchedPartIds.length,
      matchedParts: bindings.length,
      missingPartIds: unmatchedPartIds
    });
  }, [bindings.length, modelPath, onMappingReport, unmatchedPartIds]);

  const scratch = useRef(new THREE.Vector3());
  const binVec = useRef(new THREE.Vector3());
  const flight = useRef(new Map<string, FlightState>());

  useFrame((state, delta) => {
    const alpha = 1 - Math.exp(-delta * 8);
    for (const binding of bindings) {
      const layout = partLayouts[binding.partId];
      const pose = derivePartPose(binding.partId, currentStep, explodeLevel);
      const slot = scratch.current.set(
        binding.basePosition.x + pose.offset[0],
        binding.basePosition.y + pose.offset[1],
        binding.basePosition.z + pose.offset[2]
      );

      const bin = binForPart[binding.partId];
      const installed = layout ? currentStep >= layout.unlockStep : true;
      let visible = pose.visible;
      let grow = 1;

      if (bin && explodeLevel === 0) {
        // Binned hardware: sits in its tray until its step arrives, then flies
        // into the slot along an arc with a scale-up "install" pop.
        let fs = flight.current.get(binding.partId);
        if (!fs) {
          fs = { seeded: false, prev: installed, flying: false, t: 1, from: new THREE.Vector3() };
          flight.current.set(binding.partId, fs);
        }
        if (!fs.seeded) {
          fs.seeded = true;
          fs.prev = installed;
          fs.t = 1;
          if (installed) binding.node.position.copy(slot);
        } else if (installed && !fs.prev) {
          fs.flying = true;
          fs.t = 0;
          // Launch from the bin's on-screen (UI) position, projected ~4.5 units
          // in front of the camera so the part appears to fly from the UI card.
          binVec.current.set(bin.anchorNdc[0], bin.anchorNdc[1], 0.5).unproject(state.camera);
          binVec.current.sub(state.camera.position).normalize().multiplyScalar(4.5).add(state.camera.position);
          fs.from.copy(binVec.current);
        }
        fs.prev = installed;
        visible = installed || fs.flying;

        if (fs.flying) {
          fs.t = Math.min(1, fs.t + delta / FLIGHT_SECONDS);
          const e = easeInOutCubic(fs.t);
          const inv = 1 - e;
          // quadratic bezier from bin -> lifted control point -> slot
          const cx = (fs.from.x + slot.x) / 2;
          const cy = Math.max(fs.from.y, slot.y) + FLIGHT_ARC_LIFT;
          const cz = (fs.from.z + slot.z) / 2;
          binVec.current.set(
            inv * inv * fs.from.x + 2 * inv * e * cx + e * e * slot.x,
            inv * inv * fs.from.y + 2 * inv * e * cy + e * e * slot.y,
            inv * inv * fs.from.z + 2 * inv * e * cz + e * e * slot.z
          );
          binding.node.position.copy(binVec.current);
          grow = 0.5 + 0.5 * e;
          if (fs.t >= 1) {
            fs.flying = false;
            binding.node.position.copy(slot);
            grow = 1;
          }
        } else {
          binding.node.position.lerp(slot, alpha);
        }
      } else {
        const fs = flight.current.get(binding.partId);
        if (fs) {
          fs.flying = false;
          fs.t = 1;
          fs.prev = installed;
        }
        binding.node.position.lerp(slot, alpha);
        visible = pose.visible;
      }

      binding.node.visible = visible;
      // Selected state is highlight-only — the part stays axis-aligned and does
      // not spin. Any residual rotation eases back to zero.
      binding.node.rotation.y = THREE.MathUtils.lerp(binding.node.rotation.y, 0, alpha);

      const mentioned = mentionedPartIds.includes(binding.partId);
      const pulse = mentioned ? 1 + Math.sin(state.clock.elapsedTime * 12) * 0.03 : 1;
      const s = grow * pulse;
      binding.node.scale.set(
        binding.baseScale.x * s,
        binding.baseScale.y * s,
        binding.baseScale.z * s
      );

      const highlight = highlightedPartIds.includes(binding.partId) || mentioned;
      for (const mesh of binding.meshes) {
        setMeshHighlight(mesh, highlight, colors.accent);
      }
    }
  });

  const onSelect = (event: ThreeEvent<MouseEvent>) => {
    // Ignore selection if the pointer was dragged (an orbit gesture).
    if (!isTap(event.nativeEvent.clientX, event.nativeEvent.clientY)) {
      return;
    }
    event.stopPropagation();
    const partId = resolvePickablePartId(event.object);
    if (!partId) {
      return;
    }
    const part = partsById.get(partId);
    if (!part) {
      return;
    }
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

  const selectedBinding = bindings.find((binding) => binding.partId === selectedPartId);
  const selectedPart = selectedBinding ? partsById.get(selectedBinding.partId) : undefined;

  return (
    <group>
      <primitive object={root} onClick={onSelect} />

      {unmatchedPartIds.map((partId) => {
        const layout = partLayouts[partId];
        const part = partsById.get(partId);
        if (!layout || !part) {
          return null;
        }
        return (
          <PartGroup
            key={`fallback-${partId}`}
            part={part}
            layout={layout}
            currentStep={currentStep}
            explodeLevel={explodeLevel}
            selected={selectedPartId === part.id}
            colors={colors}
          />
        );
      })}

      {selectedBinding && selectedPart ? (
        <Html
          position={[selectedBinding.center.x, selectedBinding.center.y + 0.24, selectedBinding.center.z + 0.28]}
          center
          distanceFactor={5.4}
          className={styles.annotation}
        >
          <div className={styles.annotationCode}>{selectedPart.code}</div>
          <div className={styles.annotationLabel}>{selectedPart.label}</div>
        </Html>
      ) : null}
    </group>
  );
}

function PrimitiveModel({ colors }: { colors: TokenColors }) {
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
    // Selected state is highlight-only — no spin.
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, 0, alpha);
    const pulse = mentioned ? 1 + Math.sin(state.clock.elapsedTime * 12) * 0.035 : 1;
    group.scale.setScalar(pulse);
  });

  const onSelect = (event: ThreeEvent<MouseEvent>) => {
    if (!isTap(event.nativeEvent.clientX, event.nativeEvent.clientY)) {
      return;
    }
    event.stopPropagation();
    const partId = resolvePickablePartId(event.object);
    if (partId !== part.id) {
      return;
    }
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
    <group ref={groupRef} onClick={onSelect}>
      {pose.primitives.map((primitive) => (
        <PrimitiveMesh
          key={primitive.id}
          partId={part.id}
          primitive={primitive}
          layout={layout}
          colors={colors}
          highlighted={highlighted || mentioned}
          pickable
        />
      ))}
      {layout.details?.flatMap((detail) =>
        detail.primitives.map((primitive) => (
          <PrimitiveMesh
            key={`${detail.id}-${primitive.id}`}
            partId={part.id}
            primitive={primitive}
            layout={layout}
            colors={colors}
            highlighted={highlighted || mentioned}
            detailMaterial={detail.material}
            pickable={false}
          />
        ))
      )}
      {selected ? (
        <Html position={annotationPosition(layout)} center distanceFactor={5.4} className={styles.annotation}>
          {part.manualFig ? <div className={styles.annotationManual}>{part.manualFig}</div> : null}
          <div className={styles.annotationCode}>{part.code}</div>
          <div className={styles.annotationLabel}>{part.label}</div>
        </Html>
      ) : null}
    </group>
  );
}

function PrimitiveMesh({
  partId,
  primitive,
  layout,
  colors,
  highlighted,
  detailMaterial,
  pickable
}: {
  partId: string;
  primitive: PartPrimitive;
  layout: PartLayout;
  colors: TokenColors;
  highlighted: boolean;
  detailMaterial?: DetailMaterial;
  pickable: boolean;
}) {
  const materialColor = highlighted
    ? colors.accent
    : detailMaterial
      ? colorForDetail(detailMaterial, colors)
      : colorForRole(layout.role, colors);
  const emissive = highlighted ? colors.accent : colors.ink;
  const emissiveIntensity = highlighted ? 0.42 : 0;

  return (
    <mesh
      castShadow
      receiveShadow
      position={primitive.position}
      rotation={primitive.rotation}
      userData={{ partId, pickable, isDetail: !pickable }}
    >
      {primitive.shape === 'box' ? (
        <boxGeometry args={primitive.size} />
      ) : (
        <cylinderGeometry args={[primitive.size[0], primitive.size[1], primitive.size[2], 32]} />
      )}
      <meshStandardMaterial
        color={materialColor}
        roughness={layout.role === 'hardware' ? 0.38 : layout.role === 'back' ? 0.86 : 0.68}
        metalness={layout.role === 'hardware' ? 0.48 : 0.02}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
      {primitive.shape === 'box' ? <Edges color={colors.line} threshold={18} /> : null}
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

function CameraHelperPanel({ snapshot }: { snapshot: CameraSnapshot }) {
  const preset = useMemo(
    () => ({
      [snapshot.viewKey]: {
        position: snapshot.position.map((value) => Number(value.toFixed(3))),
        target: snapshot.target.map((value) => Number(value.toFixed(3))),
        label: `Camera ${snapshot.viewKey}`
      }
    }),
    [snapshot]
  );

  const onCopy = () => {
    void navigator.clipboard?.writeText(JSON.stringify(preset, null, 2));
  };

  return (
    <div className={styles.debugPanel}>
      <div className={styles.debugTitle}>Camera helper</div>
      <div className={styles.debugLine}>view: {snapshot.viewKey}</div>
      <div className={styles.debugLine}>pos: {snapshot.position.map((value) => value.toFixed(3)).join(', ')}</div>
      <div className={styles.debugLine}>target: {snapshot.target.map((value) => value.toFixed(3)).join(', ')}</div>
      <button type="button" className={styles.debugButton} onClick={onCopy}>
        Copy camera preset JSON
      </button>
    </div>
  );
}

function MeshHelperPanel({ report }: { report: MappingReport }) {
  return (
    <div className={styles.debugPanel}>
      <div className={styles.debugTitle}>Mesh mapping</div>
      <div className={styles.debugLine}>model: {report.modelPath}</div>
      <div className={styles.debugLine}>matched parts: {report.matchedParts}</div>
      <div className={styles.debugLine}>missing: {report.missingPartIds.join(', ') || 'none'}</div>
    </div>
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
    return '#ECEBE6';
  }
  if (role === 'strap') {
    return colors.ok;
  }
  return '#FAFAF6';
}

function colorForDetail(material: DetailMaterial, colors: TokenColors): string {
  if (material === 'metal') {
    return '#6F767D';
  }
  if (material === 'slot' || material === 'shadow') {
    return colors.ink;
  }
  if (material === 'wood') {
    return '#C8A97A';
  }
  return colors.line;
}

function isDetailMesh(mesh: THREE.Mesh): boolean {
  return mesh.name.includes('_detail_') || mesh.userData?.isDetail === true;
}

function isDecorativeMesh(mesh: THREE.Mesh): boolean {
  return isDetailMesh(mesh) || mesh.userData?.isOutline === true;
}

function detailMaterialForMesh(mesh: THREE.Mesh): DetailMaterial | undefined {
  if (typeof mesh.userData?.detailMaterial === 'string') {
    return mesh.userData.detailMaterial as DetailMaterial;
  }
  const match = mesh.name.match(/_detail_(edge|shadow|metal|slot|wood)_/);
  return match?.[1] as DetailMaterial | undefined;
}

function buildBindings(
  scene: THREE.Object3D,
  parts: Part[],
  colors: TokenColors
): { root: THREE.Object3D; bindings: PartBinding[]; unmatchedPartIds: string[] } {
  const root = scene.clone(true);
  const bindings = new Map<string, PartBinding>();

  root.traverse((object) => {
    if (!object.name) {
      return;
    }
    const partId = resolvePartIdForNode(object.name, parts);
    if (!partId || bindings.has(partId)) {
      return;
    }

    const meshes: THREE.Mesh[] = [];
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshes.push(child as THREE.Mesh);
      }
    });
    if (meshes.length === 0) {
      return;
    }

    const role = partLayouts[partId]?.role ?? 'panel';
    for (const mesh of meshes) {
      mesh.userData.partId = partId;
      mesh.userData.pickable = !isDecorativeMesh(mesh);
      mesh.userData.isDetail = isDetailMesh(mesh);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      applyRoleMaterial(mesh, role, colors);
    }
    object.userData.partId = partId;

    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());

    bindings.set(partId, {
      partId,
      node: object,
      meshes,
      basePosition: object.position.clone(),
      baseScale: object.scale.clone(),
      center
    });
  });

  const matched = new Set(bindings.keys());
  const unmatchedPartIds = parts.filter((part) => !matched.has(part.id)).map((part) => part.id);

  return { root, bindings: Array.from(bindings.values()), unmatchedPartIds };
}

function applyRoleMaterial(mesh: THREE.Mesh, role: PartLayout['role'], colors: TokenColors): void {
  const detailMaterial = detailMaterialForMesh(mesh);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(detailMaterial ? colorForDetail(detailMaterial, colors) : colorForRole(role, colors)),
    roughness: role === 'hardware' ? 0.38 : role === 'back' ? 0.86 : 0.68,
    metalness: role === 'hardware' ? 0.48 : 0.02
  });
  mesh.material = material;

  if ((role === 'panel' || role === 'back') && mesh.geometry) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 18),
      new THREE.LineBasicMaterial({ color: new THREE.Color(colors.line) })
    );
    edges.userData.isOutline = true;
    edges.userData.pickable = false;
    mesh.add(edges);
  }
}

function setMeshHighlight(mesh: THREE.Mesh, on: boolean, accent: string): void {
  const material = mesh.material as THREE.MeshStandardMaterial | undefined;
  if (!material || material.emissive === undefined) {
    return;
  }
  material.emissive.set(on ? accent : '#000000');
  material.emissiveIntensity = on ? 0.42 : 0;
}

function getDebugFlag(flag: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return new URLSearchParams(window.location.search).get(flag) === '1';
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
