import * as THREE from 'three';
import type { DetailMaterial, PartLayout } from './useViewerCommands';
import type { TokenColors } from './colors';

let laminateMap: THREE.CanvasTexture | null = null;
let fiberboardMap: THREE.CanvasTexture | null = null;
let edgeBandMap: THREE.CanvasTexture | null = null;
let woodDiffuse: THREE.Texture | null = null;
let woodNormal: THREE.Texture | null = null;
let metalDiffuse: THREE.Texture | null = null;
let metalRoughness: THREE.Texture | null = null;

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

function loadTexture(path: string, colorSpace: THREE.ColorSpace): THREE.Texture | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const texture = new THREE.TextureLoader().load(path);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = colorSpace;
  texture.anisotropy = 8;
  return texture;
}

function repeatTexture(texture: THREE.Texture, repeat: number): THREE.Texture {
  texture.repeat.set(repeat, repeat);
  return texture;
}

export function getLaminateMap(): THREE.CanvasTexture | null {
  if (laminateMap) {
    return laminateMap;
  }
  laminateMap = makeCanvas(512, (ctx, size) => {
    ctx.fillStyle = '#FCFBF8';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 170; i += 1) {
      const x = Math.random() * size;
      const width = 0.6 + Math.random() * 2.2;
      const warm = Math.random() > 0.5;
      ctx.fillStyle = warm
        ? `rgba(214, 205, 188, ${0.025 + Math.random() * 0.05})`
        : `rgba(190, 192, 190, ${0.02 + Math.random() * 0.04})`;
      ctx.fillRect(x, 0, width, size);
    }

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

function getEdgeBandMap(): THREE.CanvasTexture | null {
  if (edgeBandMap) {
    return edgeBandMap;
  }
  edgeBandMap = makeCanvas(256, (ctx, size) => {
    ctx.fillStyle = '#D8D4CA';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 120; i += 1) {
      ctx.fillStyle = `rgba(150, 142, 128, ${0.04 + Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * size, 0, 1 + Math.random() * 2, size);
    }
  });
  return edgeBandMap;
}

function getWoodDiffuseMap(): THREE.Texture | null {
  if (!woodDiffuse) {
    woodDiffuse = loadTexture('/textures/wood_diff_1k.jpg', THREE.SRGBColorSpace);
    if (woodDiffuse) {
      repeatTexture(woodDiffuse, 3);
    }
  }
  return woodDiffuse;
}

function getWoodNormalMap(): THREE.Texture | null {
  if (!woodNormal) {
    woodNormal = loadTexture('/textures/wood_nrm_1k.jpg', THREE.LinearSRGBColorSpace);
    if (woodNormal) {
      repeatTexture(woodNormal, 3);
    }
  }
  return woodNormal;
}

function getMetalDiffuseMap(): THREE.Texture | null {
  if (!metalDiffuse) {
    metalDiffuse = loadTexture('/textures/metal_diff_1k.jpg', THREE.SRGBColorSpace);
    if (metalDiffuse) {
      repeatTexture(metalDiffuse, 4);
    }
  }
  return metalDiffuse;
}

function getMetalRoughnessMap(): THREE.Texture | null {
  if (!metalRoughness) {
    metalRoughness = loadTexture('/textures/metal_rough_1k.jpg', THREE.LinearSRGBColorSpace);
    if (metalRoughness) {
      repeatTexture(metalRoughness, 4);
    }
  }
  return metalRoughness;
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
  if (material === 'edge') {
    return '#D8D4CA';
  }
  return colors.line;
}

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
      map: getMetalDiffuseMap() ?? undefined,
      roughnessMap: getMetalRoughnessMap() ?? undefined,
      roughness: getMetalRoughnessMap() ? 1 : 0.32,
      metalness: 0.92,
      envMapIntensity: 1.25
    });
  }

  if (detailMaterial === 'wood') {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#E8D4B8'),
      map: getWoodDiffuseMap() ?? undefined,
      normalMap: getWoodNormalMap() ?? undefined,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.58,
      metalness: 0,
      envMapIntensity: 0.45
    });
  }

  if (detailMaterial === 'edge') {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#E6E2D8'),
      map: getEdgeBandMap() ?? undefined,
      roughness: 0.52,
      metalness: 0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.62,
      envMapIntensity: 0.48
    });
  }

  if (detailMaterial === 'slot' || detailMaterial === 'shadow') {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colors.ink),
      roughness: 0.92,
      metalness: 0,
      envMapIntensity: 0.15
    });
  }

  if (role === 'back') {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#F4F2EB'),
      map: getFiberboardMap() ?? undefined,
      roughness: 0.9,
      metalness: 0,
      envMapIntensity: 0.32
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

  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#FBFAF6'),
    map: getLaminateMap() ?? undefined,
    roughness: 0.4,
    metalness: 0,
    clearcoat: 0.38,
    clearcoatRoughness: 0.48,
    envMapIntensity: 0.58
  });
}
