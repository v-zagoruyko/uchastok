import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildCar } from './car';
import { buildDesign } from './designs';
import { buildGate } from './gate';
import { flat, mesh, seeded, tint } from './parts';
import { cylinderUV, pbr, planarUV, scaleBoxUV, swapUV, type TextureId } from './textures';
import type { BoxObj, BuildingObj, GreenhouseObj, PlotObject, TireObj, TreeObj } from './types';

/** Бугристость по координатам вершины: швы у дублированных вершин не расходятся. */
function lumpy(geo: THREE.BufferGeometry, amount: number) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 12.9898 + v.y * 78.233 + v.z * 37.719) * 43758.5453;
    v.multiplyScalar(1 + ((n - Math.floor(n)) - 0.5) * amount);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

let blobGeo: THREE.BufferGeometry | undefined;
function blobGeometry() {
  if (!blobGeo) {
    const ico = new THREE.IcosahedronGeometry(1, 3);
    ico.deleteAttribute('normal');
    ico.deleteAttribute('uv');
    blobGeo = lumpy(mergeVertices(ico), 0.45);
  }
  return blobGeo;
}

function tree(o: TreeObj): THREE.Object3D {
  const rnd = seeded(o.id);
  const g = new THREE.Group();
  const apple = o.species === 'apple';
  const trunkH = o.height * (apple ? 0.38 : 0.16);
  const trunkR = o.crown * (apple ? 0.05 : 0.045);

  const barkMat = pbr('bark_brown_01', { color: apple ? '#cdbba6' : '#a58466' });
  const trunkGeo = new THREE.CylinderGeometry(trunkR * 0.7, trunkR * 1.2, trunkH, 12);
  cylinderUV(trunkGeo, trunkR * 2 * Math.PI, trunkH, 'bark_brown_01');
  const trunk = mesh(trunkGeo, barkMat);
  trunk.position.y = trunkH / 2;
  g.add(trunk);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();

  if (apple) {
    for (let i = 0; i < 5; i++) {
      const len = o.crown * (0.35 + rnd() * 0.15);
      const geo = new THREE.CylinderGeometry(0.02, 0.045, len, 6).translate(0, len / 2, 0);
      cylinderUV(geo, 0.2, len, 'bark_brown_01');
      const branch = mesh(geo, barkMat);
      branch.position.y = trunkH * 0.85;
      branch.rotation.order = 'YZX';
      branch.rotation.set(0, (i / 5) * Math.PI * 2 + rnd(), 0.9);
      g.add(branch);
    }
    const crownH = o.height - trunkH * 0.7;
    const [rx, ry, cy] = [o.crown / 2, crownH / 2, trunkH + crownH * 0.45];
    const blobs = new THREE.InstancedMesh(blobGeometry(), flat('#ffffff', { roughness: 1, envMapIntensity: 0.25 }), 56);
    for (let i = 0; i < 56; i++) {
      const a = rnd() * Math.PI * 2;
      const b = Math.acos(2 * rnd() - 1);
      const r = Math.cbrt(rnd());
      p.set(Math.sin(b) * Math.cos(a) * rx * r, cy + Math.cos(b) * ry * r, Math.sin(b) * Math.sin(a) * rx * r);
      const size = o.crown * (0.12 + rnd() * 0.1);
      s.set(size, size * 0.85, size);
      q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3));
      blobs.setMatrixAt(i, m.compose(p, q, s));
      const t = rnd();
      blobs.setColorAt(i, c.setRGB(0.05 + 0.06 * t, 0.15 + 0.12 * t, 0.02 + 0.03 * t));
    }
    g.add(blobs);
  } else {
    const tiers = Math.max(5, Math.round(o.height * 1.2));
    const per = 8;
    const start = trunkH * 0.8;
    const span = o.height - start;
    const frond = lumpy(new THREE.ConeGeometry(0.5, 1, 7, 1).rotateZ(-Math.PI / 2).translate(0.5, 0, 0), 0.3);
    const fronds = new THREE.InstancedMesh(frond, flat('#ffffff', { roughness: 1, envMapIntensity: 0.2 }), tiers * per);
    let k = 0;
    for (let t = 0; t < tiers; t++) {
      const f = t / (tiers - 1);
      const r = (o.crown / 2) * (1 - f * 0.9);
      for (let j = 0; j < per; j++, k++) {
        const a = (j / per) * Math.PI * 2 + t * 0.7 + rnd() * 0.3;
        const len = r * (0.95 + rnd() * 0.25);
        const thick = Math.max(0.2, r * 0.75);
        p.set(0, start + span * f * 0.93, 0);
        q.setFromEuler(e.set(0, -a, -(0.5 - 0.25 * f) + (rnd() - 0.5) * 0.15, 'YZX'));
        s.set(len, thick, thick);
        fronds.setMatrixAt(k, m.compose(p, q, s));
        const shade = rnd();
        fronds.setColorAt(k, c.setRGB(0.012 + 0.02 * shade, 0.04 + 0.05 * shade, 0.02 + 0.03 * shade));
      }
    }
    g.add(fronds);
    const spireH = o.height * 0.14;
    const spire = mesh(lumpy(new THREE.ConeGeometry(o.crown * 0.07, spireH, 7), 0.2), flat('#1b4a2c', { roughness: 0.92 }));
    spire.position.y = o.height - spireH / 2;
    g.add(spire);
  }
  return g;
}

function building(o: BuildingObj): THREE.Object3D {
  const g = new THREE.Group();
  const rnd = seeded(o.id);

  const wallMat = pbr('brown_planks_03', { color: tint(o.wallColor, 0.3) });
  const wallGeo = new THREE.BoxGeometry(o.width, o.wallHeight, o.depth);
  scaleBoxUV(wallGeo, o.width, o.wallHeight, o.depth, 'brown_planks_03');
  const walls = mesh(wallGeo, wallMat);
  walls.position.y = o.wallHeight / 2;
  g.add(walls);

  // Фронтоны того же цвета, что стены
  const gableShape = new THREE.Shape([
    new THREE.Vector2(-o.width / 2, 0),
    new THREE.Vector2(o.width / 2, 0),
    new THREE.Vector2(0, o.roofHeight),
  ]);
  for (const side of [1, -1]) {
    const geo = new THREE.ShapeGeometry(gableShape);
    planarUV(geo, 'brown_planks_03');
    const gable = mesh(geo, wallMat);
    gable.position.set(0, o.wallHeight, (side * o.depth) / 2);
    if (side < 0) gable.rotation.y = Math.PI;
    g.add(gable);
  }

  // Низкие крыши (сараи, будки) железные, высокие черепичные
  const metal = o.roofHeight < 1;
  const roofId: TextureId = metal ? (rnd() < 0.5 ? 'corrugated_iron' : 'asbestos_sheet') : 'grey_roof_tiles';
  const roofMat = pbr(roofId, { color: tint(o.roofColor, metal ? 0.45 : 0.55), metalness: metal ? 0.25 : 0 });
  const overhang = 0.25;
  const half = o.width / 2 + overhang;
  const y0 = o.wallHeight - (o.roofHeight / (o.width / 2)) * overhang;
  const y1 = o.wallHeight + o.roofHeight;
  const sheetLen = Math.hypot(half, y1 - y0);
  const angle = Math.atan2(y1 - y0, half);
  for (const side of [1, -1]) {
    const geo = new THREE.BoxGeometry(sheetLen, 0.06, o.depth + overhang * 2);
    scaleBoxUV(geo, sheetLen, 0.06, o.depth + overhang * 2, roofId);
    swapUV(geo);
    const sheet = mesh(geo, roofMat);
    sheet.position.set((side * half) / 2, (y0 + y1) / 2, 0);
    sheet.rotation.z = -side * angle;
    g.add(sheet);
  }

  // Фасад смотрит в +z (на юг при rotationDeg = 0): дверь и окна
  const slots = (o.windows ?? 0) + (o.door ? 1 : 0);
  const trim = flat('#e8e4d8', { roughness: 0.7 });
  const glass = flat('#1d2a36', { roughness: 0.08, metalness: 0.5 });
  for (let i = 0; i < slots; i++) {
    const x = ((i + 1) / (slots + 1) - 0.5) * o.width;
    const z = o.depth / 2;
    if (o.door && i === 0) {
      const h = Math.min(2, o.wallHeight * 0.85);
      const frame = mesh(new THREE.BoxGeometry(1, h + 0.08, 0.07), trim);
      frame.position.set(x, (h + 0.08) / 2, z + 0.02);
      const leafGeo = new THREE.BoxGeometry(0.86, h, 0.05);
      scaleBoxUV(leafGeo, 0.86, h, 0.05, 'brown_planks_03');
      const leaf = mesh(leafGeo, pbr('brown_planks_03', { color: '#8a6a4a' }));
      leaf.position.set(x, h / 2, z + 0.05);
      g.add(frame, leaf);
    } else {
      const y = o.wallHeight * 0.58;
      const frame = mesh(new THREE.BoxGeometry(1, 1.2, 0.07), trim);
      frame.position.set(x, y, z + 0.02);
      const pane = mesh(new THREE.BoxGeometry(0.82, 1.02, 0.04), glass);
      pane.position.set(x, y, z + 0.05);
      const bar = mesh(new THREE.BoxGeometry(0.04, 1.02, 0.05), trim);
      bar.position.set(x, y, z + 0.06);
      const sill = mesh(new THREE.BoxGeometry(1.12, 0.05, 0.14), trim);
      sill.position.set(x, y - 0.62, z + 0.06);
      g.add(frame, pane, bar, sill);
    }
  }

  if (o.windows) {
    const h = o.roofHeight * 0.4 + 0.9;
    const geo = new THREE.BoxGeometry(0.5, h, 0.5);
    scaleBoxUV(geo, 0.5, h, 0.5, 'brick_wall_001');
    const chimney = mesh(geo, pbr('brick_wall_001', { color: '#d9a58c' }));
    chimney.position.set(0, o.wallHeight + o.roofHeight * 0.6 + h / 2, o.depth * 0.2);
    g.add(chimney);
  }
  return g;
}

function greenhouse(o: GreenhouseObj): THREE.Object3D {
  const g = new THREE.Group();
  const r = o.width / 2;
  const film = new THREE.MeshStandardMaterial({
    color: '#e9f3ec',
    transparent: true,
    opacity: 0.32,
    roughness: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shell = mesh(new THREE.CylinderGeometry(r, r, o.length, 28, 1, true, Math.PI / 2, Math.PI), film);
  shell.rotation.x = Math.PI / 2;
  shell.userData.noShadow = true;
  g.add(shell);
  for (const s of [-1, 1]) {
    const cap = mesh(new THREE.CircleGeometry(r, 28, 0, Math.PI), film);
    cap.position.z = (s * o.length) / 2;
    if (s < 0) cap.rotation.y = Math.PI;
    cap.userData.noShadow = true;
    g.add(cap);
  }
  // Каркас: дуги и нижние рейки, они и отбрасывают тень
  const frame = flat('#dcdcd4', { roughness: 0.5, metalness: 0.4 });
  const arcs = Math.floor(o.length) + 1;
  for (let i = 0; i < arcs; i++) {
    const arc = mesh(new THREE.TorusGeometry(r, 0.018, 6, 28, Math.PI), frame);
    arc.position.z = -o.length / 2 + (i * o.length) / (arcs - 1);
    g.add(arc);
  }
  for (const s of [-1, 1]) {
    const rail = mesh(new THREE.BoxGeometry(0.05, 0.06, o.length), frame);
    rail.position.x = s * r;
    g.add(rail);
  }
  g.scale.y = o.height / r;
  return g;
}

function tire(o: TireObj): THREE.Object3D {
  const g = new THREE.Group();
  const tube = o.width / 2;
  const ring = mesh(new THREE.TorusGeometry(o.diameter / 2 - tube, tube, 14, 32), flat('#1b1b1b', { roughness: 0.92 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = tube;
  g.add(ring);
  const soilGeo = new THREE.CircleGeometry(o.diameter / 2 - o.width, 28);
  planarUV(soilGeo, 'brown_mud_dry');
  const soil = mesh(soilGeo, pbr('brown_mud_dry', { color: '#8a7358' }));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = o.width * 0.55;
  g.add(soil);
  return g;
}

const SURFACES = {
  dirt: { id: 'brown_mud_dry', color: '#d4c7b2' },
  tiles: { id: 'checkered_pavement_tiles', color: '#ffffff' },
  concrete: { id: 'brushed_concrete', color: '#ffffff' },
} as const;

function box(o: BoxObj): THREE.Object3D {
  const geo = new THREE.BoxGeometry(o.width, o.height, o.depth);
  const surface = o.surface && SURFACES[o.surface];
  if (surface) scaleBoxUV(geo, o.width, o.height, o.depth, surface.id);
  const b = mesh(geo, surface ? pbr(surface.id, { color: surface.color }) : flat(o.color));
  b.position.y = o.height / 2;
  return b;
}

function create(o: PlotObject): THREE.Object3D {
  switch (o.type) {
    case 'tree': return tree(o);
    case 'building': return building(o);
    case 'greenhouse': return greenhouse(o);
    case 'tire': return tire(o);
    case 'box': return box(o);
    case 'house':
    case 'bath': return buildDesign(o);
    case 'car': return buildCar(o);
    case 'gate': return buildGate(o);
  }
}

/** Собрать объект целиком: модель, положение, поворот, тени. Редактор пересоздаёт так же при смене размеров. */
export function createObject(o: PlotObject): THREE.Object3D {
  const obj = create(o);
  obj.name = o.id;
  obj.userData.id = o.id;
  obj.visible = o.keep !== false;
  obj.position.set(o.x, 0, o.z);
  obj.rotation.y = -THREE.MathUtils.degToRad(o.rotationDeg ?? 0);
  obj.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = !c.userData.noShadow;
      c.receiveShadow = true;
    }
  });
  return obj;
}

export function buildObjects(objects: PlotObject[]) {
  const root = new THREE.Group();
  const byId = new Map<string, THREE.Object3D>();
  for (const o of objects) {
    const obj = createObject(o);
    root.add(obj);
    byId.set(o.id, obj);
  }
  return { root, byId };
}
