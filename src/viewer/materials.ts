import * as THREE from 'three';
import type { DetailMaterial, PartLayout } from './useViewerCommands';
import type { TokenColors } from './colors';

/**
 * Shared, lazily-built canvas textures so every panel reuses one GPU upload.
 * The laminate map is a near-white sheet with faint vertical grain streaks —
 * enough surface variation for light to catch without reading as "wood".
 */
let laminateMap: THREE.CanvasTexture | null = null;
let fiberboardMap: THREE.CanvasTexture | null = null;

function makeCanvas(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function getLaminateMap(): THREE.CanvasTexture | null {
  if (laminateMap) {
    return laminateMap;
  }
  laminateMap = makeCanvas(512, (ctx, size) => {
    ctx.fillStyle = '#FCFBF8';
    ctx.fillRect(0, 0, size, size);

    // Faint vertical grain streaks.
    for (let i = 0; i < 170; i += 1) {
      const x = Math.random() * size;
      const width = 0.6 + Math.random() * 2.2;
      const warm = Math.random() > 0.5;
      ctx.fillStyle = warm
        ? `rgba(214, 205, 188, ${0.025 + Math.random() * 0.05})`
        : `rgba(190, 192, 190, ${0.02 + Math.random() * 0.04})`;
      ctx.fillRect(x, 0, width, size);
    }

    // Sparse fine speckle so the sheet is not optically dead.
    for (let i = 0; i < 900; i += 1) {
      ctx.fillStyle = `rgba(160, 155, 142, ${0.015 + Math.random() * 0.03})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1 + Math.random() * 2);
    }
  });
  return laminateMap;
}

export function getFiberboardMap(): THREE.CanvasTexture | null {
  if (fiberboardMap) {
    return fiberboardMap;
  }
  fiberboardMap = makeCanvas(256, (ctx, size) => {
    ctx.fillStyle = '#EFEDE6';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2600; i += 1) {
      const tone = 205 + Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgba(${tone}, ${tone - 4}, ${tone - 12}, ${0.05 + Math.random() * 0.08})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1);
    }
  });
  return fiberboardMap;
}

export function colorForRole(role: PartLayout['role'], colors: TokenColors): string {
  if (role === 'hardware') {
    return '#8C9298';
  }
  if (role === 'back') {
    return '#EFEDE6';
  }
  if (role === 'strap') {
    return colors.ok;
  }
  return '#FBFAF6';
}

export function colorForDetail(material: DetailMaterial, colors: TokenColors): string {
  if (material === 'metal') {
    return '#7D848B';
  }
  if (material === 'slot' || material === 'shadow') {
    return colors.ink;
  }
  if (material === 'wood') {
    return '#C9A97A';
  }
  return colors.line;
}

/**
 * Build the PBR material for a mesh given its role / detail kind.
 * Panels get a clearcoated laminate finish, hardware gets brushed zinc,
 * the back panel gets matte fiberboard.
 */
export function createRoleMaterial(
  role: PartLayout['role'],
  colors: TokenColors,
  detailMaterial?: DetailMaterial
): THREE.MeshPhysicalMaterial {
  if (detailMaterial === 'metal' || (!detailMaterial && role === 'hardware')) {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(
        detailMaterial === 'metal' ? colorForDetail('metal', colors) : colorForRole('hardware', colors)
      ),
      roughness: 0.3,
      metalness: 0.88,
      envMapIntensity: 1.15
    });
  }

  if (detailMaterial === 'wood') {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colorForDetail('wood', colors)),
      roughness: 0.62,
      metalness: 0,
      envMapIntensity: 0.5
    });
  }

  if (detailMaterial === 'slot' || detailMaterial === 'shadow') {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colors.ink),
      roughness: 0.9,
      metalness: 0,
      envMapIntensity: 0.2
    });
  }

  if (role === 'back') {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#F4F2EB'),
      map: getFiberboardMap() ?? undefined,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0.35
    });
  }

  if (role === 'strap') {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colors.ok),
      roughness: 0.7,
      metalness: 0,
      envMapIntensity: 0.4
    });
  }

  // White laminate panel: satin sheet with a thin clear coat, like IKEA foil.
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#FBFAF6'),
    map: getLaminateMap() ?? undefined,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.55
  });
}
