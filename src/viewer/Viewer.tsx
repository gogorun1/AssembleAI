import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { PART_LAYOUT } from './parts';
import type { Piece, PartLayout } from './parts';
import { prefersReducedMotion } from './partTypes';

const ACCENT = new THREE.Color('#ee5a0e');

const PANEL_COLOR = '#e9e3d4';
const DOWEL_COLOR = '#c9a96a';
const METAL_COLOR = '#9aa1a6';
const INK = '#22303a';

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function PieceMesh({ piece }: { piece: Piece }) {
  const [sx, sy, sz] = piece.size;
  const color =
    piece.kind === 'panel'
      ? PANEL_COLOR
      : piece.kind === 'dowel'
        ? DOWEL_COLOR
        : METAL_COLOR;
  return (
    <mesh position={piece.pos} rotation={piece.rot} castShadow receiveShadow>
      {piece.cyl ? (
        <cylinderGeometry args={[sx / 2, sx / 2, sy, 14]} />
      ) : (
        <boxGeometry args={[sx, sy, sz]} />
      )}
      <meshStandardMaterial
        color={color}
        roughness={piece.kind === 'metal' ? 0.35 : 0.85}
        metalness={piece.kind === 'metal' ? 0.6 : 0.05}
      />
      {piece.kind === 'panel' && <Edges threshold={20} color={INK} />}
    </mesh>
  );
}

function PartGroup({ layout }: { layout: PartLayout }) {
  const group = useRef<THREE.Group>(null);
  const spinStart = useRef(0);
  const lastSpinNonce = useRef(0);
  const tmp = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const app = useAppStore.getState();
    const v = app.viewer;
    const reduced = prefersReducedMotion();

    // ── progressive assembly + explode offset ─────────────
    const assembled = app.currentStepIndex >= layout.installStep;
    const factor = (assembled ? 0 : 1) + v.explodeLevel * 0.6;
    tmp.current.set(
      layout.home[0] + layout.explode[0] * factor,
      layout.home[1] + layout.explode[1] * factor,
      layout.home[2] + layout.explode[2] * factor,
    );
    if (reduced) {
      g.position.copy(tmp.current);
    } else {
      const k = 1 - Math.pow(0.002, delta);
      g.position.lerp(tmp.current, k);
    }

    // ── isolated spin (§5.2 spinPart) ─────────────────────
    if (v.spinNonce !== lastSpinNonce.current) {
      lastSpinNonce.current = v.spinNonce;
      if (v.spinPartId === layout.partId) spinStart.current = state.clock.elapsedTime;
    }
    const spinElapsed = state.clock.elapsedTime - spinStart.current;
    if (v.spinPartId === layout.partId && spinElapsed < 3) {
      g.rotation.y += delta * 2.2;
    } else if (g.rotation.y !== 0) {
      g.rotation.y = reduced ? 0 : THREE.MathUtils.damp(g.rotation.y, 0, 4, delta);
      if (Math.abs(g.rotation.y) < 0.01) g.rotation.y = 0;
    }

    // ── highlight / orange-sync emissive pulse (§7.4) ─────
    const isMentioned = app.mentionedPartId === layout.partId;
    const highlighted = v.highlightPartIds.includes(layout.partId) || isMentioned;
    let intensity = 0;
    if (highlighted) {
      const solid = reduced || (v.highlightMode === 'solid' && !isMentioned);
      intensity = solid
        ? 0.8
        : 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 8));
    }
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!mat || !mat.emissive) return;
      mat.emissive.copy(ACCENT);
      mat.emissiveIntensity = intensity;
    });
  });

  return (
    <group ref={group} position={layout.home}>
      {layout.pieces.map((piece, i) => (
        <PieceMesh key={i} piece={piece} />
      ))}
    </group>
  );
}

function CameraRig() {
  const { camera } = useThree();
  const startPos = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const startLook = useRef(new THREE.Vector3());
  const endLook = useRef(new THREE.Vector3());
  const curLook = useRef(new THREE.Vector3(0, 2, 0));
  const t = useRef(1);
  const dur = useRef(0);
  const lastNonce = useRef(-1);

  useFrame((_, delta) => {
    const { viewer, manifest } = useAppStore.getState();
    if (viewer.cameraNonce !== lastNonce.current) {
      lastNonce.current = viewer.cameraNonce;
      const view = manifest.cameraViews[viewer.cameraViewKey];
      if (view) {
        startPos.current.copy(camera.position);
        startLook.current.copy(curLook.current);
        endPos.current.set(...view.position);
        endLook.current.set(...view.target);
        dur.current = prefersReducedMotion() ? 0 : viewer.cameraAnimateMs;
        t.current = 0;
      }
    }
    if (t.current < 1) {
      t.current = dur.current <= 0 ? 1 : Math.min(1, t.current + (delta * 1000) / dur.current);
      const e = easeInOutCubic(t.current);
      camera.position.lerpVectors(startPos.current, endPos.current, e);
      curLook.current.lerpVectors(startLook.current, endLook.current, e);
      camera.lookAt(curLook.current);
    }
  });

  return null;
}

export function Viewer() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [5.5, 4.5, 7.5], fov: 42, near: 0.1, far: 100 }}
    >
      <hemisphereLight args={['#ffffff', '#d8d6c8', 0.65]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      {PART_LAYOUT.map((layout) => (
        <PartGroup key={layout.partId} layout={layout} />
      ))}
      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.28}
        scale={12}
        blur={2.2}
        far={6}
        color={INK}
      />
      <CameraRig />
    </Canvas>
  );
}
