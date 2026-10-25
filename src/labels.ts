import * as THREE from 'three';
import type { PlotObject } from './types';

/** Площадь основания, м²; null: у объекта её нет (деревья, шина, машина, ворота). */
export function footprintArea(o: PlotObject): number | null {
  switch (o.type) {
    case 'building':
    case 'house':
    case 'bath':
    case 'pergola':
    case 'bed':
    case 'box': return o.width * o.depth;
    case 'greenhouse': return o.width * o.length;
    default: return null;
  }
}

export const formatArea = (m2: number) => `${m2.toLocaleString('ru', { maximumFractionDigits: 1 })} м²`;

const SIZE = 0.03;

/** Подпись над объектом: постоянного размера на экране, поверх геометрии, мышью не берётся. */
export function areaLabel(text: string, y: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(20, 24, 28, 0.82)';
  ctx.beginPath();
  ctx.roundRect(4, 4, 248, 88, 22);
  ctx.fill();
  ctx.fillStyle = '#e6e8ea';
  ctx.font = '600 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 50);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map, sizeAttenuation: false, depthTest: false, transparent: true, toneMapped: false, fog: false });
  material.userData.keepEmissive = true;
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(SIZE * (256 / 96), SIZE, 1);
  sprite.position.y = y;
  sprite.renderOrder = 10;
  sprite.raycast = () => {};
  return sprite;
}

export function disposeLabel(sprite: THREE.Sprite) {
  sprite.removeFromParent();
  sprite.material.map?.dispose();
  sprite.material.dispose();
}
