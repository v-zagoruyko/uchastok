import * as THREE from 'three';
import type { PlotData, PlotObject, Vec2 } from './types';

export interface Grass {
  mesh: THREE.InstancedMesh;
  /** Пересчитать, где травы нет (под постройками, дорожками, колесом). */
  rebuild(objects: PlotObject[]): void;
}

function bladeGeometry() {
  const w = 0.022;
  const position = [-w, 0, 0, w, 0, 0, -w * 0.7, 0.55, 0.05, w * 0.7, 0.55, 0.05, 0, 1, 0.16];
  const color = [0.45, 0.5, 0.35, 0.45, 0.5, 0.35, 0.8, 0.85, 0.6, 0.8, 0.85, 0.6, 1, 1, 0.8];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  // Нормали вверх: трава освещается мягко с любой стороны; обе обмотки, чтобы не включать DoubleSide
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: 5 }, () => [0, 1, 0]).flat(), 3));
  geo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 0, 2, 1, 1, 2, 3, 2, 4, 3]);
  return geo;
}

const area = (poly: Vec2[]) =>
  Math.abs(poly.reduce((s, p, i) => s + p[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * p[1], 0)) / 2;

function inside(x: number, z: number, poly: Vec2[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

function footprint(o: PlotObject) {
  let w = 0;
  let d = 0;
  let front = 0;
  if (o.type === 'building' || o.type === 'box') [w, d] = [o.width, o.depth];
  else if (o.type === 'greenhouse') [w, d] = [o.width, o.length];
  else if (o.type === 'tire') [w, d] = [o.diameter, o.diameter];
  else if (o.type === 'car') [w, d] = [4.7, 2];
  else if (o.type === 'house' || o.type === 'bath') {
    // Терраса и веранда спереди
    [w, d, front] = [o.width, o.depth + 2.4, 1.2];
  }
  const a = THREE.MathUtils.degToRad(o.rotationDeg ?? 0);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return (x: number, z: number) => {
    const dx = x - o.x;
    const dz = z - o.z;
    return Math.abs(dx * cos + dz * sin) < w / 2 + 0.1 && Math.abs(-dx * sin + dz * cos - front) < d / 2 + 0.1;
  };
}

export function createGrass(plot: PlotData): Grass {
  let seed = 99;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const zones = [
    { poly: plot.boundary.points, density: 90, height: [0.1, 0.22] },
    ...(plot.parcels ?? []).map((p) => ({ poly: p.points, density: 7, height: [0.14, 0.32] })),
  ];
  const blades: { x: number; z: number; yaw: number; tilt: number; width: number; height: number; color: THREE.Color }[] = [];
  for (const { poly, density, height } of zones) {
    const xs = poly.map((p) => p[0]);
    const zs = poly.map((p) => p[1]);
    const [x0, z0] = [Math.min(...xs), Math.min(...zs)];
    const [w, d] = [Math.max(...xs) - x0, Math.max(...zs) - z0];
    const want = Math.round(area(poly) * density);
    for (let n = 0, tries = 0; n < want && tries < want * 4; tries++) {
      const x = x0 + rnd() * w;
      const z = z0 + rnd() * d;
      if (!inside(x, z, poly)) continue;
      n++;
      const t = rnd();
      blades.push({
        x,
        z,
        yaw: rnd() * Math.PI * 2,
        tilt: (rnd() - 0.5) * 0.5,
        width: 0.8 + rnd() * 0.8,
        height: height[0] + rnd() * (height[1] - height[0]),
        color: new THREE.Color().setRGB(0.07 + 0.08 * t, 0.15 + 0.13 * t, 0.025 + 0.03 * t),
      });
    }
  }

  const mesh = new THREE.InstancedMesh(
    bladeGeometry(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    blades.length,
  );
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.count = 0;

  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';

  function rebuild(objects: PlotObject[]) {
    const covered = objects.filter((o) => o.keep !== false && o.type !== 'tree').map(footprint);
    let n = 0;
    for (const b of blades) {
      if (covered.some((inside) => inside(b.x, b.z))) continue;
      dummy.position.set(b.x, 0, b.z);
      dummy.rotation.set(b.tilt, b.yaw, 0);
      dummy.scale.set(b.width, b.height, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      mesh.setColorAt(n, b.color);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  return { mesh, rebuild };
}
