// Generates public/models/billy.glb from the BILLY manifest.
//
// Each manifest part becomes one named node (group) whose name matches
// `part.meshName`, so the runtime loader can map manifest part ids to real
// mesh nodes. The geometry mirrors src/viewer/useViewerCommands.ts so the GLB
// and the primitive fallback stay visually consistent.
//
// Usage: npm run model:billy

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// GLTFExporter targets the browser and expects FileReader when writing GLB.
// Node ships a global Blob but no FileReader, so provide a minimal shim.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob
        .arrayBuffer()
        .then((value) => {
          this.result = value;
          this.onloadend?.();
        })
        .catch((error) => this.onerror?.(error));
    }

    readAsDataURL(blob) {
      blob
        .arrayBuffer()
        .then((value) => {
          const base64 = Buffer.from(value).toString('base64');
          this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
          this.onloadend?.();
        })
        .catch((error) => this.onerror?.(error));
    }
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const manifestPath = resolve(root, 'src/data/billy.manifest.json');
const outPath = resolve(root, 'public/models/billy.glb');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// Geometry per part id. Mirrors partLayouts in src/viewer/useViewerCommands.ts.
// size for box: [x, y, z]; for cylinder: [radiusTop, radiusBottom, height].
const geometryByPart = {
  'side-panel-left': {
    role: 'panel',
    primitives: [{ shape: 'box', size: [0.08, 2.2, 0.36], position: [-0.72, 1.1, 0] }]
  },
  'side-panel-right': {
    role: 'panel',
    primitives: [{ shape: 'box', size: [0.08, 2.2, 0.36], position: [0.72, 1.1, 0] }]
  },
  'bottom-panel': {
    role: 'panel',
    primitives: [{ shape: 'box', size: [1.44, 0.08, 0.36], position: [0, 0.08, 0] }]
  },
  'top-panel': {
    role: 'panel',
    primitives: [{ shape: 'box', size: [1.44, 0.08, 0.36], position: [0, 2.16, 0] }]
  },
  'fixed-shelf': {
    role: 'panel',
    primitives: [{ shape: 'box', size: [1.34, 0.07, 0.34], position: [0, 1.08, 0] }]
  },
  'adjustable-shelf': {
    role: 'panel',
    primitives: [
      { shape: 'box', size: [1.34, 0.06, 0.34], position: [0, 0.64, 0] },
      { shape: 'box', size: [1.34, 0.06, 0.34], position: [0, 1.58, 0] }
    ]
  },
  'back-panel': {
    role: 'back',
    primitives: [{ shape: 'box', size: [1.5, 2.18, 0.04], position: [0, 1.12, -0.22] }]
  },
  'cam-screw-washer': {
    role: 'hardware',
    primitives: [
      { shape: 'cylinder', size: [0.035, 0.035, 0.18], position: [-0.78, 0.42, 0.2], rotation: [0, 0, 1.57] },
      { shape: 'cylinder', size: [0.035, 0.035, 0.18], position: [-0.78, 1.05, 0.2], rotation: [0, 0, 1.57] },
      { shape: 'cylinder', size: [0.035, 0.035, 0.18], position: [0.78, 0.42, 0.2], rotation: [0, 0, 1.57] },
      { shape: 'cylinder', size: [0.035, 0.035, 0.18], position: [0.78, 1.05, 0.2], rotation: [0, 0, 1.57] }
    ]
  },
  'cam-lock': {
    role: 'hardware',
    primitives: [
      { shape: 'cylinder', size: [0.05, 0.05, 0.035], position: [-0.48, 0.13, 0.22], rotation: [1.57, 0, 0] },
      { shape: 'cylinder', size: [0.05, 0.05, 0.035], position: [0.48, 0.13, 0.22], rotation: [1.57, 0, 0] },
      { shape: 'cylinder', size: [0.05, 0.05, 0.035], position: [-0.48, 2.1, 0.22], rotation: [1.57, 0, 0] },
      { shape: 'cylinder', size: [0.05, 0.05, 0.035], position: [0.48, 2.1, 0.22], rotation: [1.57, 0, 0] }
    ]
  },
  'wood-dowel': {
    role: 'hardware',
    primitives: [
      { shape: 'cylinder', size: [0.026, 0.026, 0.22], position: [-0.54, 1.08, 0.16], rotation: [0, 0, 1.57] },
      { shape: 'cylinder', size: [0.026, 0.026, 0.22], position: [0.54, 1.08, 0.16], rotation: [0, 0, 1.57] }
    ]
  },
  'shelf-pin': {
    role: 'hardware',
    primitives: [
      { shape: 'cylinder', size: [0.025, 0.025, 0.16], position: [-0.66, 0.64, 0.12], rotation: [0, 0, 1.57] },
      { shape: 'cylinder', size: [0.025, 0.025, 0.16], position: [0.66, 0.64, 0.12], rotation: [0, 0, 1.57] },
      { shape: 'cylinder', size: [0.025, 0.025, 0.16], position: [-0.66, 1.58, 0.12], rotation: [0, 0, 1.57] },
      { shape: 'cylinder', size: [0.025, 0.025, 0.16], position: [0.66, 1.58, 0.12], rotation: [0, 0, 1.57] }
    ]
  },
  'back-screw': {
    role: 'hardware',
    primitives: [
      { shape: 'cylinder', size: [0.025, 0.025, 0.035], position: [-0.62, 0.34, -0.26], rotation: [1.57, 0, 0] },
      { shape: 'cylinder', size: [0.025, 0.025, 0.035], position: [0.62, 0.34, -0.26], rotation: [1.57, 0, 0] },
      { shape: 'cylinder', size: [0.025, 0.025, 0.035], position: [-0.62, 1.94, -0.26], rotation: [1.57, 0, 0] },
      { shape: 'cylinder', size: [0.025, 0.025, 0.035], position: [0.62, 1.94, -0.26], rotation: [1.57, 0, 0] }
    ]
  },
  'safety-strap': {
    role: 'strap',
    primitives: [{ shape: 'box', size: [0.42, 0.04, 0.025], position: [0, 2.26, -0.32], rotation: [0, 0, 0.18] }]
  }
};

// Neutral base materials. The runtime applies token colors and accent
// highlight, so these are just sensible defaults for standalone GLB viewers.
const roleMaterial = {
  panel: new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.72, metalness: 0.02 }),
  back: new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.82, metalness: 0.02 }),
  hardware: new THREE.MeshStandardMaterial({ color: 0x8a8f98, roughness: 0.5, metalness: 0.35 }),
  strap: new THREE.MeshStandardMaterial({ color: 0x2f8f5b, roughness: 0.6, metalness: 0.05 })
};

function buildGeometry(primitive) {
  if (primitive.shape === 'box') {
    return new THREE.BoxGeometry(primitive.size[0], primitive.size[1], primitive.size[2]);
  }
  return new THREE.CylinderGeometry(primitive.size[0], primitive.size[1], primitive.size[2], 24);
}

const scene = new THREE.Scene();
scene.name = manifest.id;

let meshCount = 0;
const missing = [];

for (const part of manifest.parts) {
  const spec = geometryByPart[part.id];
  if (!spec) {
    missing.push(part.id);
    continue;
  }

  const group = new THREE.Group();
  group.name = part.meshName;
  group.userData = { partId: part.id, code: part.code, label: part.label };

  spec.primitives.forEach((primitive, index) => {
    const mesh = new THREE.Mesh(buildGeometry(primitive), roleMaterial[spec.role] ?? roleMaterial.panel);
    mesh.name = `${part.meshName}_${index}`;
    mesh.position.set(primitive.position[0], primitive.position[1], primitive.position[2]);
    if (primitive.rotation) {
      mesh.rotation.set(primitive.rotation[0], primitive.rotation[1], primitive.rotation[2]);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    meshCount += 1;
  });

  scene.add(group);
}

if (missing.length > 0) {
  console.warn(`[model-billy] parts without geometry (skipped): ${missing.join(', ')}`);
}

const exporter = new GLTFExporter();

const arrayBuffer = await new Promise((resolvePromise, rejectPromise) => {
  exporter.parse(
    scene,
    (result) => resolvePromise(result),
    (error) => rejectPromise(error),
    { binary: true, onlyVisible: false }
  );
});

const buffer = Buffer.from(arrayBuffer);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, buffer);

console.log(
  `[model-billy] wrote ${outPath} (${(buffer.byteLength / 1024).toFixed(1)} kB, ` +
    `${scene.children.length} named nodes, ${meshCount} meshes)`
);
