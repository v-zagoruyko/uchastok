import * as THREE from 'three';

/** Размер плитки в метрах (поле dimensions на Poly Haven). */
const TILE = {
  grass_ground: 2.51,
  brown_mud_dry: 1.3,
  brown_planks_03: 1,
  asbestos_sheet: 2,
  corrugated_iron: 1.12,
  grey_roof_tiles: 3,
  bark_brown_01: 1,
  brushed_concrete: 2.5,
  brick_wall_001: 3,
  checkered_pavement_tiles: 2,
} as const;

export type TextureId = keyof typeof TILE;

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

function load(id: TextureId, file: string, srgb: boolean) {
  const key = `${id}/${file}`;
  let tex = cache.get(key);
  if (!tex) {
    tex = loader.load(`/assets/textures/${key}`);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    cache.set(key, tex);
  }
  return tex;
}

/** PBR-материал из набора Poly Haven. UV геометрии должны быть в долях плитки (функции ниже). */
export function pbr(id: TextureId, params: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({
    map: load(id, 'diff.jpg', true),
    normalMap: load(id, 'nor.jpg', false),
    roughnessMap: load(id, 'rough.jpg', false),
    roughness: 1,
    ...params,
  });
}

/** Плоская геометрия (Plane, Shape): UV из координат вершин в метрах. */
export function planarUV(geo: THREE.BufferGeometry, id: TextureId) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const k = 1 / TILE[id];
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) * k, pos.getY(i) * k);
  uv.needsUpdate = true;
}

/** Коробка: UV по реальным размерам граней, чтобы текстура не растягивалась. */
export function scaleBoxUV(geo: THREE.BoxGeometry, w: number, h: number, d: number, id: TextureId) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const k = 1 / TILE[id];
  // Порядок граней BoxGeometry: +x, -x, +y, -y, +z, -z, по 4 вершины
  const faces: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  faces.forEach(([su, sv], f) => {
    for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * su * k, uv.getY(i) * sv * k);
  });
  uv.needsUpdate = true;
}

/** Геометрия с UV в метрах (Extrude): перевести в доли плитки. */
export function scaleUV(geo: THREE.BufferGeometry, id: TextureId) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const k = 1 / TILE[id];
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
  uv.needsUpdate = true;
}

/** Повернуть текстуру на 90° (рёбра кровли должны идти вдоль ската). */
export function swapUV(geo: THREE.BufferGeometry) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
  uv.needsUpdate = true;
}

export function cylinderUV(geo: THREE.BufferGeometry, circumference: number, height: number, id: TextureId) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const k = 1 / TILE[id];
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circumference * k, uv.getY(i) * height * k);
  uv.needsUpdate = true;
}
