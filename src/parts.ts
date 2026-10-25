import * as THREE from 'three';
import { pbr, planarUV, scaleBoxUV, swapUV, type TextureId } from './textures';

export const flat = (color: THREE.ColorRepresentation, params: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...params });

export const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]) =>
  new THREE.Mesh(geometry, material);

/** Окраска светлее, чтобы цвет из данных читался поверх серой текстуры. */
export const tint = (hex: string, towardWhite: number) => new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), towardWhite);

export function seeded(id: string) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const glassMat = () => flat('#1d2a36', { roughness: 0.08, metalness: 0.5 });

/** Коробка от земли; horizontal: доски лежат горизонтально. */
export function slab(w: number, h: number, d: number, material: THREE.Material, id: TextureId, horizontal = false) {
  const geo = new THREE.BoxGeometry(w, h, d);
  scaleBoxUV(geo, w, h, d, id);
  if (horizontal) swapUV(geo);
  const m = mesh(geo, material);
  m.position.y = h / 2;
  return m;
}

/** Лист кровли: len вдоль x. По умолчанию рёбра идут поперёк len (len лежит вдоль ската), swap: false — вдоль depth. */
export function sheet(len: number, depth: number, id: TextureId, material: THREE.Material, thick = 0.07, swap = true) {
  const geo = new THREE.BoxGeometry(len, thick, depth);
  scaleBoxUV(geo, len, thick, depth, id);
  if (swap) swapUV(geo);
  return mesh(geo, material);
}

export interface Gable {
  /** Ширина по скатам и длина вдоль конька. */
  span: number;
  length: number;
  wallH: number;
  rise: number;
  overhang?: number;
  /** Дополнительный свес спереди (навес над верандой). */
  frontExtra?: number;
}

/** Двускатная кровля и фронтоны: конёк вдоль z, при alongX вдоль x. */
export function gabledTop(
  o: Gable,
  wallMat: THREE.Material,
  wallId: TextureId,
  roofMat: THREE.Material,
  roofId: TextureId,
  alongX = false,
) {
  const g = new THREE.Group();
  const ov = o.overhang ?? 0.25;
  const extra = o.frontExtra ?? 0;
  const half = o.span / 2 + ov;
  const y0 = o.wallH - (o.rise / (o.span / 2)) * ov;
  const y1 = o.wallH + o.rise;
  const len = Math.hypot(half, y1 - y0);
  const angle = Math.atan2(y1 - y0, half);
  for (const side of [1, -1]) {
    const s = sheet(len, o.length + ov * 2 + extra, roofId, roofMat);
    s.position.set((side * half) / 2, (y0 + y1) / 2, extra / 2);
    s.rotation.z = -side * angle;
    g.add(s);
  }
  const shape = new THREE.Shape([
    new THREE.Vector2(-o.span / 2, 0),
    new THREE.Vector2(o.span / 2, 0),
    new THREE.Vector2(0, o.rise),
  ]);
  for (const side of [1, -1]) {
    const geo = new THREE.ShapeGeometry(shape);
    planarUV(geo, wallId);
    const end = mesh(geo, wallMat);
    end.position.set(0, o.wallH, (side * o.length) / 2);
    if (side < 0) end.rotation.y = Math.PI;
    g.add(end);
  }
  if (alongX) g.rotation.y = Math.PI / 2;
  return g;
}

/** Окно: рама, стекло, переплёты. Смотрит в +z, центр в начале координат. */
export function glazing(w: number, h: number, frameColor = '#e8e4d8') {
  const g = new THREE.Group();
  const trim = flat(frameColor, { roughness: 0.7 });
  const frame = mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.08), trim);
  const pane = mesh(new THREE.BoxGeometry(w, h, 0.04), glassMat());
  pane.position.z = 0.04;
  g.add(frame, pane);
  const bars = Math.max(0, Math.round(w / 0.9) - 1);
  for (let i = 0; i < Math.max(bars, w > 0.7 ? 1 : 0); i++) {
    const bar = mesh(new THREE.BoxGeometry(0.04, h, 0.05), trim);
    bar.position.set(((i + 1) / (Math.max(bars, 1) + 1) - 0.5) * w, 0, 0.065);
    g.add(bar);
  }
  return g;
}

/** Дверь: коробка и полотно из досок. Низ на нуле, смотрит в +z. */
export function door(w: number, h: number, color: string) {
  const g = new THREE.Group();
  const frame = mesh(new THREE.BoxGeometry(w + 0.14, h + 0.08, 0.07), flat('#e8e4d8', { roughness: 0.7 }));
  frame.position.y = (h + 0.08) / 2;
  const leafGeo = new THREE.BoxGeometry(w, h, 0.05);
  scaleBoxUV(leafGeo, w, h, 0.05, 'brown_planks_03');
  const leaf = mesh(leafGeo, pbr('brown_planks_03', { color }));
  leaf.position.set(0, h / 2, 0.05);
  g.add(frame, leaf);
  return g;
}

export function brickChimney(h: number) {
  const geo = new THREE.BoxGeometry(0.5, h, 0.5);
  scaleBoxUV(geo, 0.5, h, 0.5, 'brick_wall_001');
  return mesh(geo, pbr('brick_wall_001', { color: '#d9a58c' }));
}

export function steelPipe(h: number) {
  const g = new THREE.Group();
  const metal = flat('#2b2d30', { roughness: 0.45, metalness: 0.7 });
  const pipe = mesh(new THREE.CylinderGeometry(0.085, 0.085, h, 12), metal);
  pipe.position.y = h / 2;
  const cap = mesh(new THREE.ConeGeometry(0.16, 0.14, 12), metal);
  cap.position.y = h + 0.1;
  g.add(pipe, cap);
  return g;
}

/** Настил веранды или террасы: верх на нуле. */
export function deck(w: number, d: number, color: string) {
  const geo = new THREE.BoxGeometry(w, 0.14, d);
  scaleBoxUV(geo, w, 0.14, d, 'wood_floor_deck');
  swapUV(geo);
  const m = mesh(geo, pbr('wood_floor_deck', { color }));
  m.position.y = -0.07;
  return m;
}

export function post(h: number, color = '#5b4129') {
  const m = mesh(new THREE.BoxGeometry(0.13, h, 0.13), flat(color));
  m.position.y = h / 2;
  return m;
}
