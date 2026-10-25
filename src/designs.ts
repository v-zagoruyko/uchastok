import * as THREE from 'three';
import { brickChimney, deck, door, flat, gabledTop, glazing, mesh, post, sheet, slab, steelPipe } from './parts';
import { cylinderUV, pbr, planarUV, scaleUV, type TextureId } from './textures';
import type { DesignObj } from './types';

export type DesignKind = 'house' | 'bath';

/** w: ширина по x, d: длина по z (фасад смотрит в +z), h: полная высота. */
export interface Dims {
  w: number;
  d: number;
  h: number;
}

export interface DesignStyle {
  label: string;
  defaults: Dims;
  build(dims: Dims, kind: DesignKind): THREE.Group;
}

const rad = THREE.MathUtils.degToRad;
const concrete = (color: string) => pbr('brushed_concrete', { color });

const triangle = (halfBase: number, base: number, height: number) =>
  new THREE.Shape([new THREE.Vector2(-halfBase, base), new THREE.Vector2(halfBase, base), new THREE.Vector2(0, base + height)]);

function gableHouse({ w, d, h }: Dims): THREE.Group {
  const g = new THREE.Group();
  const plinth = 0.35;
  const rise = Math.min((d / 2) * Math.tan(rad(32)), h * 0.42);
  const wallH = Math.max(1.8, h - rise - plinth);
  const wallMat = pbr('weathered_plank_siding', { color: '#ffffff' });
  const roofMat = pbr('box_profile_metal_sheet', { color: '#c4cacf', metalness: 0.1 });
  g.add(slab(w + 0.1, plinth, d + 0.1, concrete('#bdbdb6'), 'brushed_concrete'));

  const body = new THREE.Group();
  body.position.y = plinth;
  body.add(slab(w, wallH, d, wallMat, 'weathered_plank_siding', true));
  body.add(gabledTop({ span: d, length: w, wallH, rise, overhang: 0.35 }, wallMat, 'weathered_plank_siding', roofMat, 'box_profile_metal_sheet', true));

  const slots = Math.max(2, Math.round(w / 2.2));
  const doorSlot = slots > 2 ? 1 : 0;
  const winH = Math.min(1.4, wallH * 0.5);
  let doorX = 0;
  for (let i = 0; i < slots; i++) {
    const x = ((i + 0.5) / slots - 0.5) * w;
    if (i === doorSlot) {
      doorX = x;
      const dr = door(1, Math.min(2.1, wallH * 0.85), '#6b4a30');
      dr.position.set(x, 0, d / 2);
      body.add(dr);
    } else {
      const win = glazing(1.2, winH);
      win.position.set(x, wallH * 0.55, d / 2 + 0.02);
      body.add(win);
    }
  }
  for (const side of [1, -1]) {
    const n = Math.max(1, Math.round(d / 3));
    for (let j = 0; j < n; j++) {
      const win = glazing(1.1, winH);
      win.position.set(side * (w / 2 + 0.02), wallH * 0.55, ((j + 0.5) / n - 0.5) * d);
      win.rotation.y = (side * Math.PI) / 2;
      body.add(win);
    }
  }

  const porchD = Math.min(1.8, d * 0.4);
  const porch = deck(2.6, porchD, '#a58a66');
  porch.position.set(doorX, 0, d / 2 + porchD / 2);
  const postH = Math.min(2.4, wallH * 0.85);
  const canopy = sheet(3, porchD + 0.3, 'box_profile_metal_sheet', roofMat, 0.08);
  canopy.position.set(doorX, postH + 0.05, d / 2 + porchD / 2 + 0.1);
  body.add(porch, canopy);
  for (const s of [-1, 1]) {
    const p = post(postH);
    p.position.set(doorX + s * 1.15, 0, d / 2 + porchD - 0.12);
    body.add(p);
  }

  const chimneyH = rise * 0.4 + 0.9;
  const chimney = brickChimney(chimneyH);
  chimney.position.set(w * 0.25, wallH + rise * 0.6 + chimneyH / 2, 0);
  body.add(chimney);
  g.add(body);
  return g;
}

function aFrame({ w, d, h }: Dims, kind: DesignKind): THREE.Group {
  const g = new THREE.Group();
  const plinth = 0.25;
  const rise = h - plinth;
  const half = w / 2;
  const bath = kind === 'bath';
  const wood = pbr('brown_planks_03', { color: bath ? '#6b4d36' : '#8a6a4a' });
  const roofId: TextureId = bath ? 'brown_planks_03' : 'box_profile_metal_sheet';
  const roofMat = bath
    ? pbr('brown_planks_03', { color: '#5a4230' })
    : pbr('box_profile_metal_sheet', { color: '#3f464d', metalness: 0.3 });
  g.add(slab(w - 0.1, plinth, d - 0.1, concrete('#a9a9a2'), 'brushed_concrete'));

  const len = Math.hypot(half, rise);
  const angle = Math.atan2(rise, half);
  for (const side of [1, -1]) {
    const s = sheet(len, d + 0.3, roofId, roofMat, 0.1);
    s.position.set((side * half) / 2, plinth + rise / 2, 0);
    s.rotation.z = -side * angle;
    g.add(s);
  }

  const endGeo = new THREE.ShapeGeometry(triangle(half, plinth, rise));
  planarUV(endGeo, 'brown_planks_03');
  const front = mesh(endGeo, wood);
  front.position.z = d / 2;
  const back = mesh(endGeo.clone(), wood);
  back.position.z = -d / 2;
  back.rotation.y = Math.PI;
  g.add(front, back);

  // Остекление фронтона
  const bw = half * 0.84;
  const hh = rise * 0.84;
  const gy = plinth + 0.12;
  const glass = mesh(new THREE.ShapeGeometry(triangle(bw, gy, hh)), flat('#1d2a36', { roughness: 0.08, metalness: 0.5 }));
  glass.position.z = d / 2 + 0.03;
  g.add(glass);
  const dark = flat('#26221f');
  const bar = (x: number, y: number, bwid: number, bh: number) => {
    const m = mesh(new THREE.BoxGeometry(bwid, bh, 0.06), dark);
    m.position.set(x, y, d / 2 + 0.06);
    g.add(m);
  };
  bar(0, gy + hh / 2, 0.05, hh);
  bar(-bw / 2, gy + hh * 0.25, 0.05, hh * 0.5);
  bar(bw / 2, gy + hh * 0.25, 0.05, hh * 0.5);
  bar(0, gy + hh * 0.4, bw * 1.2, 0.05);
  const dr = door(0.95, Math.min(2, hh * 0.55), '#4a3524');
  dr.position.set(bw * 0.3, gy, d / 2 + 0.05);
  g.add(dr);

  const terrace = deck(w * 0.9, 2.2, '#9a7c58');
  terrace.position.set(0, plinth, d / 2 + 1.25);
  g.add(terrace);

  if (bath) {
    const x = w * 0.12;
    const pipe = steelPipe(1.5);
    pipe.position.set(x, plinth + rise * (1 - Math.abs(x) / half) - 0.2, -d * 0.2);
    g.add(pipe);
  }
  return g;
}

function barnHouse({ w, d, h }: Dims): THREE.Group {
  const g = new THREE.Group();
  const plinth = 0.3;
  const rise = Math.min((w / 2) * Math.tan(rad(48)), h * 0.52);
  const wallH = Math.max(1.8, h - rise - plinth);
  const wallMat = pbr('brown_planks_03', { color: '#3a3430' });
  const roofMat = pbr('box_profile_metal_sheet', { color: '#2c3036', metalness: 0.35 });
  g.add(slab(w + 0.1, plinth, d + 0.1, concrete('#8d8d87'), 'brushed_concrete'));

  const body = new THREE.Group();
  body.position.y = plinth;
  body.add(slab(w, wallH, d, wallMat, 'brown_planks_03'));
  body.add(gabledTop({ span: w, length: d, wallH, rise, overhang: 0.15 }, wallMat, 'brown_planks_03', roofMat, 'box_profile_metal_sheet', false));

  const gw = w * 0.5;
  const gh = wallH + rise * 0.35 - 0.4;
  const big = glazing(gw, gh, '#1d1d1d');
  big.position.set(0, 0.4 + gh / 2, d / 2 + 0.02);
  const dr = door(0.95, Math.min(2.1, wallH * 0.85), '#8a6a4a');
  dr.position.set(w / 2 - 0.7, 0, d / 2);
  const step = deck(2.2, 1, '#8a6a4a');
  step.position.set(w / 2 - 0.7, 0, d / 2 + 0.5);
  body.add(big, dr, step);

  const winH = Math.min(2, wallH * 0.7);
  for (const side of [1, -1]) {
    const n = Math.max(2, Math.round(d / 2.6));
    for (let j = 0; j < n; j++) {
      const win = glazing(0.7, winH, '#1d1d1d');
      win.position.set(side * (w / 2 + 0.02), 0.5 + winH / 2, ((j + 0.5) / n - 0.5) * d);
      win.rotation.y = (side * Math.PI) / 2;
      body.add(win);
    }
  }
  const pipe = steelPipe(1);
  pipe.position.set(0, wallH + rise * 0.8, -d * 0.25);
  body.add(pipe);
  g.add(body);
  return g;
}

/** Односкатная: высокий южный фасад с остеклением, кровля уходит на север. */
function modernShed({ w, d, h }: Dims, kind: DesignKind): THREE.Group {
  const g = new THREE.Group();
  const plinth = 0.3;
  const house = kind === 'house';
  const hHigh = Math.max(2.4, h - plinth);
  const hLow = Math.min(hHigh - 0.4, Math.max(2.3, hHigh * 0.66));
  const wallId: TextureId = house ? 'brushed_concrete' : 'brown_planks_03';
  const wallMat = house ? concrete('#e6e3dc') : pbr('brown_planks_03', { color: '#2f2925' });
  g.add(slab(w + 0.1, plinth, d + 0.1, concrete('#8d8d87'), 'brushed_concrete'));

  const body = new THREE.Group();
  body.position.y = plinth;
  const shape = new THREE.Shape([
    new THREE.Vector2(-d / 2, 0),
    new THREE.Vector2(d / 2, 0),
    new THREE.Vector2(d / 2, hHigh),
    new THREE.Vector2(-d / 2, hLow),
  ]);
  const wallGeo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  wallGeo.translate(0, 0, -w / 2);
  wallGeo.rotateY(-Math.PI / 2);
  scaleUV(wallGeo, wallId);
  body.add(mesh(wallGeo, wallMat));

  const slope = Math.atan2(hHigh - hLow, d);
  const roofMat = pbr('box_profile_metal_sheet', { color: '#2b2f33', metalness: 0.4 });
  const roof = sheet(w + 0.5, Math.hypot(d, hHigh - hLow) + 0.9, 'box_profile_metal_sheet', roofMat, 0.12, false);
  roof.position.set(0, (hHigh + hLow) / 2 + 0.06, 0.15);
  roof.rotation.x = -slope;
  body.add(roof);

  const glassH = Math.min(2.5, hHigh - 0.5);
  if (house) {
    const accent = slab(w * 0.38, hHigh - 0.1, 0.08, pbr('brown_planks_03', { color: '#b88a5a' }), 'brown_planks_03', true);
    accent.position.set(-w * 0.31, (hHigh - 0.1) / 2, d / 2 + 0.04);
    const big = glazing(w * 0.46, glassH, '#26221f');
    big.position.set(w * 0.22, 0.25 + glassH / 2, d / 2 + 0.02);
    const dr = door(0.95, Math.min(2.1, hHigh - 0.4), '#3b2c20');
    dr.position.set(-w * 0.31, 0, d / 2 + 0.06);
    body.add(accent, big, dr);
    for (const side of [1, -1]) {
      const win = glazing(0.7, 2, '#26221f');
      win.position.set(side * (w / 2 + 0.02), 1.4, d * 0.2);
      win.rotation.y = (side * Math.PI) / 2;
      body.add(win);
    }
  } else {
    const pano = glazing(w * 0.5, 1.3, '#1d1d1d');
    pano.position.set(w * 0.2, 1.5, d / 2 + 0.02);
    const dr = door(0.9, Math.min(2, hHigh - 0.4), '#3b2c20');
    dr.position.set(-w * 0.28, 0, d / 2 + 0.03);
    body.add(pano, dr);
    const pipe = steelPipe(1.4);
    pipe.position.set(-w * 0.2, hLow + (hHigh - hLow) * 0.25 + 0.05, -d * 0.25);
    body.add(pipe);
  }
  const terrace = deck(w * 0.9, 2, '#9a7c58');
  terrace.position.set(0, 0, d / 2 + 1.1);
  body.add(terrace);
  g.add(body);
  return g;
}

function classicBath({ w, d, h }: Dims): THREE.Group {
  const g = new THREE.Group();
  const plinth = 0.25;
  const rise = Math.min((w / 2) * Math.tan(rad(30)), h * 0.4);
  const wallH = Math.max(1.8, h - rise - plinth);
  const porch = Math.min(1.6, d * 0.35);
  const wallMat = pbr('japanese_cedar_planks', { color: '#b89572' });
  const roofMat = pbr('box_profile_metal_sheet', { color: '#a9afb4', metalness: 0.1 });
  g.add(slab(w + 0.1, plinth, d + 0.1, concrete('#a9a9a2'), 'brushed_concrete'));

  const body = new THREE.Group();
  body.position.y = plinth;
  body.add(slab(w, wallH, d, wallMat, 'japanese_cedar_planks', true));
  body.add(gabledTop({ span: w, length: d, wallH, rise, overhang: 0.3, frontExtra: porch }, wallMat, 'japanese_cedar_planks', roofMat, 'box_profile_metal_sheet', false));

  const dr = door(0.85, Math.min(1.9, wallH * 0.85), '#5b4129');
  dr.position.set(-w * 0.2, 0, d / 2);
  const win = glazing(0.6, 0.6);
  win.position.set(w * 0.22, wallH * 0.55, d / 2 + 0.02);
  const floor = deck(w * 0.95, porch, '#a08060');
  floor.position.set(0, 0, d / 2 + porch / 2);
  body.add(dr, win, floor);
  for (const s of [-1, 1]) {
    const p = post(wallH * 0.95);
    p.position.set(s * (w / 2 - 0.15), 0, d / 2 + porch - 0.12);
    body.add(p);
    const side = glazing(0.5, 0.5);
    side.position.set(s * (w / 2 + 0.02), wallH * 0.55, -d * 0.1);
    side.rotation.y = (s * Math.PI) / 2;
    body.add(side);
  }
  const x = w * 0.18;
  const pipe = steelPipe(1.5);
  pipe.position.set(x, wallH + rise * (1 - Math.abs(x) / (w / 2)) - 0.2, -d * 0.25);
  body.add(pipe);
  g.add(body);
  return g;
}

function barrel({ w, d, h }: Dims): THREE.Group {
  const g = new THREE.Group();
  const lift = 0.18;
  const rx = w / 2;
  const ry = h / 2;
  const cy = lift + ry;
  const wood = pbr('brown_planks_03', { color: '#b08a5e' });

  const bodyGeo = new THREE.CylinderGeometry(1, 1, d, 48, 1, true);
  cylinderUV(bodyGeo, (Math.PI * (w + h)) / 2, d, 'brown_planks_03');
  bodyGeo.rotateX(Math.PI / 2);
  const body = mesh(bodyGeo, wood);
  body.scale.set(rx, ry, 1);
  body.position.y = cy;
  g.add(body);

  const capGeo = new THREE.CircleGeometry(1, 48);
  capGeo.scale(rx, ry, 1);
  planarUV(capGeo, 'brown_planks_03');
  const front = mesh(capGeo, wood);
  front.position.set(0, cy, d / 2);
  const back = mesh(capGeo.clone(), wood);
  back.position.set(0, cy, -d / 2);
  back.rotation.y = Math.PI;
  g.add(front, back);

  const steel = flat('#2b2d30', { roughness: 0.5, metalness: 0.7 });
  for (const k of [-0.4, -0.2, 0.2, 0.4]) {
    const hoop = mesh(new THREE.TorusGeometry(1, 0.02, 6, 48), steel);
    hoop.scale.set(rx * 1.005, ry * 1.005, 1);
    hoop.position.set(0, cy, k * d);
    g.add(hoop);
  }

  const dh = Math.min(1.7, h * 0.65);
  const dr = door(0.8, dh, '#6b4a30');
  dr.position.set(0, lift + 0.05, d / 2);
  const portR = Math.min(0.22, ry * 0.2);
  const port = mesh(new THREE.CircleGeometry(portR, 24), flat('#1d2a36', { roughness: 0.08, metalness: 0.5 }));
  port.position.set(0, lift + h * 0.86, d / 2 + 0.02);
  g.add(dr, port);

  for (const k of [-0.3, 0.3]) {
    const cradle = mesh(new THREE.BoxGeometry(w * 0.8, 0.18, 0.3), flat('#5b4129'));
    cradle.position.set(0, 0.09, k * d);
    g.add(cradle);
  }
  const terrace = deck(w * 0.95, 1.5, '#9a7c58');
  terrace.position.set(0, lift, d / 2 + 0.75);
  g.add(terrace);
  const pipe = steelPipe(1.2);
  pipe.position.set(0, lift + h - 0.08, -d * 0.3);
  g.add(pipe);
  return g;
}

export const STYLES: Record<DesignKind, Record<string, DesignStyle>> = {
  house: {
    gable: { label: 'Двускатный с верандой', defaults: { w: 8, d: 6, h: 5.2 }, build: gableHouse },
    aframe: { label: 'A-frame', defaults: { w: 6, d: 8, h: 5.5 }, build: aFrame },
    barn: { label: 'Барнхаус', defaults: { w: 6, d: 9, h: 6 }, build: barnHouse },
    modern: { label: 'Модерн, односкатная кровля', defaults: { w: 8, d: 6.5, h: 4.2 }, build: modernShed },
  },
  bath: {
    classic: { label: 'Классическая с верандой', defaults: { w: 3.5, d: 5, h: 3.4 }, build: classicBath },
    modern: { label: 'Современная, односкатная', defaults: { w: 3.2, d: 5, h: 3 }, build: modernShed },
    barrel: { label: 'Баня-бочка', defaults: { w: 2.4, d: 5.5, h: 2.6 }, build: barrel },
    aframe: { label: 'A-frame', defaults: { w: 3.6, d: 4.5, h: 3.6 }, build: aFrame },
  },
};

export function buildDesign(o: DesignObj): THREE.Group {
  const styles = STYLES[o.type];
  const style = styles[o.style] ?? Object.values(styles)[0];
  const dims = { w: Math.max(1.5, o.width), d: Math.max(1.5, o.depth), h: Math.max(1.8, o.height) };
  return style.build(dims, o.type);
}
