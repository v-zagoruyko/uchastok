import * as THREE from 'three';
import { placeModel } from './models';
import { flat, mesh, seeded, slab } from './parts';
import { pbr, planarUV } from './textures';
import type { BedObj, PergolaObj } from './types';

const wood = (color: string) => pbr('brown_planks_03', { color });

function chair(): THREE.Group {
  const g = new THREE.Group();
  const frame = flat('#33363a', { roughness: 0.6 });
  const cushion = flat('#8a8a82');
  const seat = mesh(new THREE.BoxGeometry(0.7, 0.14, 0.7), frame);
  seat.position.y = 0.36;
  const pad = mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), cushion);
  pad.position.y = 0.49;
  const back = mesh(new THREE.BoxGeometry(0.7, 0.45, 0.12), frame);
  back.position.set(0, 0.7, -0.29);
  back.rotation.x = -0.18;
  for (const s of [-1, 1]) {
    const arm = mesh(new THREE.BoxGeometry(0.1, 0.1, 0.62), frame);
    arm.position.set(s * 0.4, 0.62, 0);
    g.add(arm);
  }
  g.add(seat, pad, back);
  return g;
}

/** Пергола над двориком: четыре стойки, балки, поперечная решётка; в центре кострище (модель Poly Haven), вокруг два кресла. Входом считается +z. */
export function buildPergola(o: PergolaObj): THREE.Group {
  const g = new THREE.Group();
  const { width: w, depth: d, height: h } = o;
  const color = '#6b4a30';
  const mat = wood(color);
  const px = w / 2 - 0.1;
  const pz = d / 2 - 0.1;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p = slab(0.18, h, 0.18, mat, 'brown_planks_03');
      p.position.set(sx * px, h / 2, sz * pz);
      g.add(p);
    }
  }
  for (const sz of [-1, 1]) {
    const beam = slab(w, 0.22, 0.14, mat, 'brown_planks_03', true);
    beam.position.set(0, h, sz * pz);
    g.add(beam);
  }
  const rafters = Math.max(4, Math.round(w / 0.4));
  for (let i = 0; i < rafters; i++) {
    const rafter = slab(0.08, 0.1, d, mat, 'brown_planks_03');
    rafter.position.set(-w / 2 + (i * w) / (rafters - 1), h + 0.22, 0);
    g.add(rafter);
  }

  placeModel(g, 'stone_fire_pit', 1, 0.19);
  for (const sx of [-1, 1]) {
    const c = chair();
    c.position.set(sx * 1.1, 0, 0.2);
    c.rotation.y = -sx * Math.PI / 2;
    g.add(c);
  }
  return g;
}

/** Приподнятая грядка: обвязка из досок, земля, ряды рассады. Верх обвязки на height. */
export function buildBed(o: BedObj): THREE.Group {
  const g = new THREE.Group();
  const { width: w, depth: d, height: h } = o;
  const t = 0.05;
  const mat = wood('#b5834f');
  for (const sz of [-1, 1]) {
    const board = slab(w, h, t, mat, 'brown_planks_03', true);
    board.position.z = sz * (d / 2 - t / 2);
    g.add(board);
  }
  for (const sx of [-1, 1]) {
    const board = slab(t, h, d - t * 2, mat, 'brown_planks_03', true);
    board.position.x = sx * (w / 2 - t / 2);
    g.add(board);
  }
  const soilGeo = new THREE.PlaneGeometry(w - t * 2, d - t * 2);
  planarUV(soilGeo, 'brown_mud_dry');
  const soil = mesh(soilGeo, pbr('brown_mud_dry', { color: '#6a5642' }));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = h - 0.06;
  g.add(soil);

  const rnd = seeded(o.id);
  const leaf = flat('#5f8f3c', { roughness: 0.85 });
  const along = w >= d;
  const [len, wid] = along ? [w, d] : [d, w];
  const rows = Math.max(1, Math.floor((wid - 0.2) / 0.4));
  const perRow = Math.max(2, Math.floor((len - 0.2) / 0.35));
  const leafGeo = new THREE.IcosahedronGeometry(0.11, 1);
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < perRow; i++) {
      const a = -len / 2 + 0.2 + (i * (len - 0.4)) / Math.max(1, perRow - 1) + (rnd() - 0.5) * 0.06;
      const b = -wid / 2 + 0.2 + (r * (wid - 0.4)) / Math.max(1, rows - 1 || 1) + (rnd() - 0.5) * 0.06;
      const s = 0.8 + rnd() * 0.6;
      const m = mesh(leafGeo, leaf);
      m.scale.set(s, s * 0.8, s);
      m.position.set(along ? a : b, h - 0.06 + 0.07 * s, along ? b : a);
      g.add(m);
    }
  }
  return g;
}
