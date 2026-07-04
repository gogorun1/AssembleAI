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
  type PartLayout,
  type PartPrimitive
} from './useViewerCommands';
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
          camera={{ position: [3.2, 2.1, 5.2], fov: 32, near: 0.1, far: 80 }}
        >
          <Scene
            modelPath={modelPath}
            onCameraSnapshot={showCameraHelper ? setCameraSnapshot : undefined}
            onMappingReport={showMeshHelper ? setMappingReport : undefined}
          />
        </Canvas>
      </WebGLErrorBoundary>
      <div className={styles.caption} aria-hidden>
        <div className={styles.eyebrow}>ASSEMBLY MANIFEST · {manifest.id.toUpperCase()}</div>
        <div className={styles.title}>Voice + 3D assembly copilot</div>
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
      <ContactShadows position={[0, -0.02, 0]} opacity={0.28} scale={5} blur={2.4} far={3} />
      <CameraRig controlsRef={controlsRef} onCameraSnapshot={onCameraSnapshot} />
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
  controlsRef,
  onCameraSnapshot
}: {
  controlsRef: MutableRefObject<any>;
  onCameraSnapshot?: (value: CameraSnapshot) => void;
}) {
  const camera = useThree((state) => state.camera);
  const manifest = useAppStore((state) => state.manifest);
  const activeViewKey = useAppStore((state) => state.activeViewKey);
  const reducedMotion = useReducedMotion();
  const view = manifest.cameraViews[activeViewKey] ?? manifest.cameraViews.front;
  const targetPosition = useMemo(() => new THREE.Vector3(...view.position), [view.position]);
  const targetLookAt = useMemo(() => new THREE.Vector3(...view.target), [view.target]);
  const lastEmitRef = useRef(0);

  useFrame((_, delta) => {
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-delta * 4.4);
    camera.position.lerp(targetPosition, alpha);
    controlsRef.current?.target.lerp(targetLookAt, alpha);
    controlsRef.current?.update();

    if (onCameraSnapshot) {
      const now = performance.now();
      if (now - lastEmitRef.current > 180) {
        const target = controlsRef.current?.target as THREE.Vector3 | undefined;
        onCameraSnapshot({
          viewKey: activeViewKey,
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: target ? [target.x, target.y, target.z] : view.target
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

  useFrame((state, delta) => {
    const alpha = 1 - Math.exp(-delta * 8);
    for (const binding of bindings) {
      const pose = derivePartPose(binding.partId, currentStep, explodeLevel);
      const target = scratch.current.set(
        binding.basePosition.x + pose.offset[0],
        binding.basePosition.y + pose.offset[1],
        binding.basePosition.z + pose.offset[2]
      );
      binding.node.position.lerp(target, alpha);
      binding.node.visible = pose.visible;

      const isSelected = selectedPartId === binding.partId;
      binding.node.rotation.y = isSelected
        ? state.clock.elapsedTime * 0.72
        : THREE.MathUtils.lerp(binding.node.rotation.y, 0, alpha);

      const mentioned = mentionedPartIds.includes(binding.partId);
      const pulse = mentioned ? 1 + Math.sin(state.clock.elapsedTime * 12) * 0.03 : 1;
      binding.node.scale.set(
        binding.baseScale.x * pulse,
        binding.baseScale.y * pulse,
        binding.baseScale.z * pulse
      );

      const highlight = highlightedPartIds.includes(binding.partId) || mentioned;
      for (const mesh of binding.meshes) {
        setMeshHighlight(mesh, highlight, colors.accent);
      }
    }
  });

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const partId = findPartId(event.object);
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
      <primitive object={root} onPointerDown={onPointerDown} />

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
    <mesh castShadow receiveShadow position={primitive.position} rotation={primitive.rotation}>
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
    return colors.paperSunken;
  }
  if (role === 'strap') {
    return colors.ok;
  }
  return colors.paperRaised;
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
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorForRole(role, colors)),
    roughness: 0.72,
    metalness: role === 'hardware' ? 0.2 : 0.02
  });
  mesh.material = material;

  if ((role === 'panel' || role === 'back') && mesh.geometry) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 18),
      new THREE.LineBasicMaterial({ color: new THREE.Color(colors.ink) })
    );
    edges.userData.isOutline = true;
    mesh.add(edges);
  }
}

function setMeshHighlight(mesh: THREE.Mesh, on: boolean, accent: string): void {
  const material = mesh.material as THREE.MeshStandardMaterial | undefined;
  if (!material || material.emissive === undefined) {
    return;
  }
  material.emissive.set(on ? accent : '#000000');
  material.emissiveIntensity = on ? 0.7 : 0;
}

function findPartId(object: THREE.Object3D | null): string | undefined {
  let cursor: THREE.Object3D | null = object;
  while (cursor) {
    if (typeof cursor.userData?.partId === 'string') {
      return cursor.userData.partId as string;
    }
    cursor = cursor.parent;
  }
  return undefined;
}

function getDebugFlag(flag: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return new URLSearchParams(window.location.search).get(flag) === '1';
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
