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
const BOOKCASE_WIDTH = 0.8;
const BOOKCASE_HEIGHT = 4.04;
const BOOKCASE_DEPTH = 0.56;
const BOARD_THICKNESS = 0.055;
const INNER_WIDTH = BOOKCASE_WIDTH - BOARD_THICKNESS * 2;
const SIDE_X = BOOKCASE_WIDTH / 2 - BOARD_THICKNESS / 2;
const CENTER_Y = BOOKCASE_HEIGHT / 2;
const BACK_Z = -BOOKCASE_DEPTH / 2 - 0.018;
const FRONT_EDGE_Z = BOOKCASE_DEPTH / 2 + 0.035;
const SIDE_HARDWARE_X = SIDE_X + 0.035;

const sideName = (side) => (side < 0 ? 'left' : 'right');

function box(id, size, position, rotation) {
  return { id, shape: 'box', size, position, rotation };
}

function cylinder(id, size, position, rotation) {
  return { id, shape: 'cylinder', size, position, rotation };
}

function makeWoodDowels() {
  const panelLevels = [
    { id: 'bottom', y: 0.07 },
    { id: 'fixed', y: 2.02 },
    { id: 'top', y: 3.98 }
  ];
  const panelEdges = [
    { id: 'front', z: 0.21 },
    { id: 'back', z: -0.18 }
  ];
  const railHoles = [
    { id: 'upper', y: 0.205 },
    { id: 'lower', y: 0.115 }
  ];

  return [
    ...panelLevels.flatMap((level) =>
      [-1, 1].flatMap((side) =>
        panelEdges.map((edge) =>
          cylinder(
            `dowel-${level.id}-${sideName(side)}-${edge.id}`,
            [0.017, 0.017, 0.18],
            [side * 0.33, level.y, edge.z],
            [0, 0, 1.57]
          )
        )
      )
    ),
    ...[-1, 1].flatMap((side) =>
      railHoles.map((hole) =>
        cylinder(
          `dowel-rail-${sideName(side)}-${hole.id}`,
          [0.017, 0.017, 0.18],
          [side * 0.34, hole.y, FRONT_EDGE_Z],
          [0, 0, 1.57]
        )
      )
    )
  ];
}

function makeCamScrews() {
  const levels = [
    { id: 'bottom', y: 0.22 },
    { id: 'fixed', y: 2.02 },
    { id: 'top', y: 3.84 }
  ];
  const edges = [
    { id: 'front', z: 0.21 },
    { id: 'back', z: -0.18 }
  ];

  return [-1, 1].flatMap((side) =>
    levels.flatMap((level) =>
      edges.map((edge) =>
        cylinder(
          `cam-screw-${sideName(side)}-${level.id}-${edge.id}`,
          [0.014, 0.014, 0.16],
          [side * SIDE_HARDWARE_X, level.y, edge.z],
          [0, 0, 1.57]
        )
      )
    )
  );
}

function makeCamLocks() {
  const levels = [
    { id: 'bottom', y: 0.075 },
    { id: 'fixed', y: 2.02 },
    { id: 'top', y: 3.965 }
  ];
  const edges = [
    { id: 'front', z: 0.23 },
    { id: 'back', z: -0.19 }
  ];

  return levels.flatMap((level) =>
    [-1, 1].flatMap((side) =>
      edges.map((edge) =>
        cylinder(
          `cam-lock-${level.id}-${sideName(side)}-${edge.id}`,
          [0.032, 0.032, 0.018],
          [side * 0.29, level.y, edge.z],
          [1.57, 0, 0]
        )
      )
    )
  );
}

function makeBackNails() {
  const columns = [
    { id: 'left', x: -0.36 },
    { id: 'center', x: 0 },
    { id: 'right', x: 0.36 }
  ];
  const rows = [0.35, 0.95, 1.55, 2.15, 2.75, 3.35];

  return columns.flatMap((column) =>
    rows.map((y, index) =>
      cylinder(
        `back-nail-${column.id}-${index + 1}`,
        [0.011, 0.011, 0.028],
        [column.x, y, BACK_Z - 0.02],
        [1.57, 0, 0]
      )
    )
  );
}

function makeShelfPins() {
  const levels = [
    { id: 'bottom', y: 0.74 },
    { id: 'low', y: 1.36 },
    { id: 'high', y: 2.68 },
    { id: 'top', y: 3.28 }
  ];
  const edges = [
    { id: 'front', z: 0.18 },
    { id: 'back', z: -0.18 }
  ];

  return levels.flatMap((level) =>
    [-1, 1].flatMap((side) =>
      edges.map((edge) =>
        cylinder(
          `pin-${level.id}-${sideName(side)}-${edge.id}`,
          [0.012, 0.012, 0.1],
          [side * 0.34, level.y, edge.z],
          [0, 0, 1.57]
        )
      )
    )
  );
}

function makeSidePanelDetails(side, prefix) {
  const interiorX = side * (SIDE_X - BOARD_THICKNESS / 2 - 0.002);
  const backGrooveX = side * SIDE_X;
  const shelfPinLevels = [0.74, 1.36, 2.68, 3.28];
  const shelfPinDepths = [0.18, -0.18];

  return [
    {
      id: `${prefix}-back-groove`,
      material: 'shadow',
      primitives: [
        box(
          `${prefix}-back-groove-strip`,
          [0.01, BOOKCASE_HEIGHT - 0.18, 0.014],
          [backGrooveX, CENTER_Y, -BOOKCASE_DEPTH / 2 + 0.018]
        )
      ]
    },
    {
      id: `${prefix}-shelf-pin-holes`,
      material: 'shadow',
      primitives: shelfPinLevels.flatMap((y, levelIndex) =>
        shelfPinDepths.map((z, depthIndex) =>
          cylinder(
            `${prefix}-shelf-pin-hole-${levelIndex + 1}-${depthIndex + 1}`,
            [0.014, 0.014, 0.006],
            [interiorX, y, z],
            [0, 0, 1.57]
          )
        )
      )
    }
  ];
}

function makeShelfEdgeDetails(prefix, y, width = INNER_WIDTH) {
  return [
    {
      id: `${prefix}-front-edge-band`,
      material: 'edge',
      primitives: [
        box(`${prefix}-front-edge-band`, [width, 0.012, 0.018], [0, y, FRONT_EDGE_Z - 0.012])
      ]
    }
  ];
}

function makeCamScrewDetails() {
  const screws = makeCamScrews();
  return [
    {
      id: 'cam-screw-heads',
      material: 'metal',
      primitives: screws.map((primitive) => {
        const side = primitive.position[0] < 0 ? -1 : 1;
        return cylinder(
          `${primitive.id}-head`,
          [0.026, 0.026, 0.014],
          [primitive.position[0] + side * 0.085, primitive.position[1], primitive.position[2]],
          primitive.rotation
        );
      })
    },
    {
      id: 'cam-screw-slots',
      material: 'slot',
      primitives: screws.map((primitive) => {
        const side = primitive.position[0] < 0 ? -1 : 1;
        return box(
          `${primitive.id}-slot`,
          [0.006, 0.006, 0.042],
          [primitive.position[0] + side * 0.093, primitive.position[1], primitive.position[2]]
        );
      })
    }
  ];
}

function makeCamLockDetails() {
  return [
    {
      id: 'cam-lock-slots',
      material: 'slot',
      primitives: makeCamLocks().map((primitive) =>
        box(
          `${primitive.id}-slot`,
          [0.044, 0.006, 0.008],
          [primitive.position[0], primitive.position[1], primitive.position[2] + 0.014]
        )
      )
    }
  ];
}

function makeBackNailDetails() {
  return [
    {
      id: 'back-nail-heads',
      material: 'metal',
      primitives: makeBackNails().map((primitive) =>
        cylinder(
          `${primitive.id}-head`,
          [0.018, 0.018, 0.008],
          [primitive.position[0], primitive.position[1], primitive.position[2] - 0.006],
          primitive.rotation
        )
      )
    }
  ];
}

function makeWasherDetails() {
  return [
    {
      id: 'washer-center-holes',
      material: 'slot',
      primitives: [
        cylinder('washer-left-wall-hole', [0.011, 0.011, 0.009], [-0.28, 4.18, BACK_Z - 0.079], [1.57, 0, 0]),
        cylinder('washer-right-wall-hole', [0.011, 0.011, 0.009], [0.28, 4.18, BACK_Z - 0.079], [1.57, 0, 0]),
        cylinder('washer-left-case-hole', [0.009, 0.009, 0.009], [-0.2, 4.08, BACK_Z - 0.057], [1.57, 0, 0]),
        cylinder('washer-right-case-hole', [0.009, 0.009, 0.009], [0.2, 4.08, BACK_Z - 0.057], [1.57, 0, 0])
      ]
    }
  ];
}

const geometryByPart = {
  'side-panel-left': {
    role: 'panel',
    primitives: [box('left-panel', [BOARD_THICKNESS, BOOKCASE_HEIGHT, BOOKCASE_DEPTH], [-SIDE_X, CENTER_Y, 0])],
    details: makeSidePanelDetails(-1, 'left')
  },
  'side-panel-right': {
    role: 'panel',
    primitives: [box('right-panel', [BOARD_THICKNESS, BOOKCASE_HEIGHT, BOOKCASE_DEPTH], [SIDE_X, CENTER_Y, 0])],
    details: makeSidePanelDetails(1, 'right')
  },
  'bottom-panel': {
    role: 'panel',
    primitives: [box('bottom', [BOOKCASE_WIDTH, BOARD_THICKNESS, BOOKCASE_DEPTH], [0, BOARD_THICKNESS / 2, 0])],
    details: makeShelfEdgeDetails('bottom', BOARD_THICKNESS / 2, BOOKCASE_WIDTH)
  },
  'top-panel': {
    role: 'panel',
    primitives: [box('top', [BOOKCASE_WIDTH, BOARD_THICKNESS, BOOKCASE_DEPTH], [0, BOOKCASE_HEIGHT - BOARD_THICKNESS / 2, 0])],
    details: makeShelfEdgeDetails('top', BOOKCASE_HEIGHT - BOARD_THICKNESS / 2, BOOKCASE_WIDTH)
  },
  'fixed-shelf': {
    role: 'panel',
    primitives: [box('fixed-shelf', [INNER_WIDTH, BOARD_THICKNESS, BOOKCASE_DEPTH - 0.03], [0, 2.02, 0.015])],
    details: makeShelfEdgeDetails('fixed-shelf', 2.02)
  },
  'adjustable-shelf': {
    role: 'panel',
    primitives: [
      box('adjustable-bottom', [INNER_WIDTH, 0.05, BOOKCASE_DEPTH - 0.045], [0, 0.74, 0.02]),
      box('adjustable-low', [INNER_WIDTH, 0.05, BOOKCASE_DEPTH - 0.045], [0, 1.36, 0.02]),
      box('adjustable-high', [INNER_WIDTH, 0.05, BOOKCASE_DEPTH - 0.045], [0, 2.68, 0.02]),
      box('adjustable-top', [INNER_WIDTH, 0.05, BOOKCASE_DEPTH - 0.045], [0, 3.28, 0.02])
    ],
    details: [
      ...makeShelfEdgeDetails('adjustable-bottom', 0.74),
      ...makeShelfEdgeDetails('adjustable-low', 1.36),
      ...makeShelfEdgeDetails('adjustable-high', 2.68),
      ...makeShelfEdgeDetails('adjustable-top', 3.28)
    ]
  },
  'front-rail': {
    role: 'panel',
    primitives: [
      box('front-rail', [BOOKCASE_WIDTH, 0.16, 0.05], [0, 0.16, FRONT_EDGE_Z])
    ],
    details: [
      {
        id: 'front-rail-top-edge',
        material: 'edge',
        primitives: [box('front-rail-top-edge', [BOOKCASE_WIDTH, 0.018, 0.01], [0, 0.24, FRONT_EDGE_Z + 0.006])]
      }
    ]
  },
  'back-panel': {
    role: 'back',
    primitives: [
      box('back-lower', [BOOKCASE_WIDTH - 0.03, 1.96, 0.022], [0, 1.02, BACK_Z]),
      box('back-upper', [BOOKCASE_WIDTH - 0.03, 1.96, 0.022], [0, 3.02, BACK_Z])
    ],
    details: [
      {
        id: 'back-panel-fold-line',
        material: 'shadow',
        primitives: [box('back-panel-fold-line', [BOOKCASE_WIDTH - 0.05, 0.014, 0.006], [0, 2.02, BACK_Z - 0.014])]
      }
    ]
  },
  'cam-screw': {
    role: 'hardware',
    primitives: makeCamScrews(),
    details: makeCamScrewDetails()
  },
  'cam-lock': {
    role: 'hardware',
    primitives: makeCamLocks(),
    details: makeCamLockDetails()
  },
  'wood-dowel': {
    role: 'hardware',
    primitives: makeWoodDowels()
  },
  'back-nail': {
    role: 'hardware',
    primitives: makeBackNails(),
    details: makeBackNailDetails()
  },
  'shelf-pin': {
    role: 'hardware',
    primitives: makeShelfPins()
  },
  'wall-bracket': {
    role: 'hardware',
    primitives: [
      box('wall-bracket-left-flat', [0.17, 0.035, 0.018], [-0.2, 4.08, BACK_Z - 0.03]),
      box('wall-bracket-left-up', [0.035, 0.18, 0.018], [-0.28, 4.15, BACK_Z - 0.03]),
      box('wall-bracket-right-flat', [0.17, 0.035, 0.018], [0.2, 4.08, BACK_Z - 0.03]),
      box('wall-bracket-right-up', [0.035, 0.18, 0.018], [0.28, 4.15, BACK_Z - 0.03])
    ]
  },
  'bracket-screw': {
    role: 'hardware',
    primitives: [
      cylinder('bracket-screw-left', [0.014, 0.014, 0.03], [-0.28, 4.18, BACK_Z - 0.052], [1.57, 0, 0]),
      cylinder('bracket-screw-right', [0.014, 0.014, 0.03], [0.28, 4.18, BACK_Z - 0.052], [1.57, 0, 0])
    ]
  },
  washer: {
    role: 'hardware',
    primitives: [
      cylinder('washer-left-wall', [0.026, 0.026, 0.008], [-0.28, 4.18, BACK_Z - 0.074], [1.57, 0, 0]),
      cylinder('washer-right-wall', [0.026, 0.026, 0.008], [0.28, 4.18, BACK_Z - 0.074], [1.57, 0, 0]),
      cylinder('washer-left-case', [0.02, 0.02, 0.008], [-0.2, 4.08, BACK_Z - 0.052], [1.57, 0, 0]),
      cylinder('washer-right-case', [0.02, 0.02, 0.008], [0.2, 4.08, BACK_Z - 0.052], [1.57, 0, 0])
    ],
    details: makeWasherDetails()
  }
};

// Neutral base materials. The runtime applies token colors and accent
// highlight, so these are just sensible defaults for standalone GLB viewers.
const roleMaterial = {
  panel: new THREE.MeshStandardMaterial({ color: 0xfafaf6, roughness: 0.68, metalness: 0.02 }),
  back: new THREE.MeshStandardMaterial({ color: 0xecebe6, roughness: 0.86, metalness: 0.02 }),
  hardware: new THREE.MeshStandardMaterial({ color: 0x7d838a, roughness: 0.38, metalness: 0.48 }),
  strap: new THREE.MeshStandardMaterial({ color: 0x2f8f5b, roughness: 0.6, metalness: 0.05 })
};

const detailMaterial = {
  edge: new THREE.MeshStandardMaterial({ color: 0xb9b7ad, roughness: 0.74, metalness: 0.02 }),
  shadow: new THREE.MeshStandardMaterial({ color: 0x20252a, roughness: 0.82, metalness: 0.02 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x6f767d, roughness: 0.36, metalness: 0.56 }),
  slot: new THREE.MeshStandardMaterial({ color: 0x20252a, roughness: 0.5, metalness: 0.1 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xc8a97a, roughness: 0.72, metalness: 0.04 })
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
    mesh.userData = { partId: part.id, pickable: true };
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    meshCount += 1;
  });

  spec.details?.forEach((detailGroup) => {
    detailGroup.primitives.forEach((primitive, index) => {
      const mesh = new THREE.Mesh(
        buildGeometry(primitive),
        detailMaterial[detailGroup.material] ?? roleMaterial[spec.role] ?? roleMaterial.panel
      );
      mesh.name = `${part.meshName}_detail_${detailGroup.material}_${detailGroup.id}_${index}`;
      mesh.userData = {
        partId: part.id,
        pickable: false,
        isDetail: true,
        detailMaterial: detailGroup.material
      };
      mesh.position.set(primitive.position[0], primitive.position[1], primitive.position[2]);
      if (primitive.rotation) {
        mesh.rotation.set(primitive.rotation[0], primitive.rotation[1], primitive.rotation[2]);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      meshCount += 1;
    });
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
