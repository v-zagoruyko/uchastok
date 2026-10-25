import * as THREE from 'three';
import { flat, mesh } from './parts';
import type { CarObj } from './types';

// Audi A3 седан (8Y): 4,50 × 1,82 × 1,43 м, колёсная база 2,64 м.
// Локально: x вперёд, y вверх, z вбок, центр по длине, колёса стоят на y = 0.
type Pt = [number, number];

function extruded(points: Pt[], width: number, bevel: number) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const depth = width - 2 * bevel;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.6,
    bevelSegments: 4,
    curveSegments: 1,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function quad(a: number[], b: number[], c: number[], d: number[], material: THREE.Material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  geo.computeVertexNormals();
  return mesh(geo, material);
}

export function buildCar(o: CarObj): THREE.Group {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({
    color: o.color,
    metalness: 0.35,
    roughness: 0.45,
    clearcoat: 0.5,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.6,
  });
  const glass = flat('#10161c', { roughness: 0.05, metalness: 0.6, side: THREE.DoubleSide });
  const black = flat('#151515', { roughness: 0.6 });
  const chrome = flat('#d0d3d6', { roughness: 0.2, metalness: 0.9 });
  const tire = flat('#141414', { roughness: 0.95 });
  const tail = flat('#a01010', { roughness: 0.3, emissive: '#ff1a1a', emissiveIntensity: 0.5 });
  tail.userData.keepEmissive = true;

  // Кузов: нижняя часть и салон (greenhouse) с кровлей
  g.add(mesh(extruded([
    [-2.22, 0.3], [-2.25, 0.62], [-2.24, 0.92], [-1.45, 0.98], [0.85, 0.98], [1.55, 0.92], [2.12, 0.8],
    [2.25, 0.62], [2.24, 0.42], [2.16, 0.3], [1.9, 0.25], [-1.9, 0.25],
  ], 1.8, 0.1), paint));
  g.add(mesh(extruded([[-1.48, 0.95], [-1.02, 1.39], [-0.85, 1.43], [0.08, 1.43], [0.86, 0.95]], 1.5, 0.06), paint));

  // Стёкла: боковые, лобовое и заднее
  for (const side of [1, -1]) {
    for (const pts of [
      [[-0.1, 1.01], [-0.1, 1.37], [0.12, 1.37], [0.72, 1.01]],
      [[-0.28, 1.01], [-0.28, 1.37], [-0.88, 1.37], [-1.38, 1.01]],
    ] as Pt[][]) {
      const pane = mesh(new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))), glass);
      pane.position.z = side * 0.757;
      g.add(pane);
    }
  }
  g.add(quad([0.806, 1.0, -0.68], [0.806, 1.0, 0.68], [0.156, 1.405, 0.6], [0.156, 1.405, -0.6], glass));
  g.add(quad([-1.448, 1.0, -0.64], [-1.448, 1.0, 0.64], [-1.048, 1.38, 0.56], [-1.048, 1.38, -0.56], glass));

  // Колёса: шина, диск со спицами, тёмная ниша арки на борту
  const R = 0.33;
  for (const x of [1.4, -1.24]) {
    for (const side of [1, -1]) {
      const wheel = new THREE.Group();
      const tireGeo = new THREE.CylinderGeometry(R, R, 0.22, 28).rotateX(Math.PI / 2);
      const rimGeo = new THREE.CylinderGeometry(R * 0.68, R * 0.68, 0.23, 24).rotateX(Math.PI / 2);
      wheel.add(mesh(tireGeo, tire), mesh(rimGeo, chrome));
      for (let k = 0; k < 5; k++) {
        const spoke = mesh(new THREE.BoxGeometry(R * 1.3, 0.04, 0.012), black);
        spoke.rotation.z = (k * Math.PI) / 5;
        spoke.position.z = 0.118;
        wheel.add(spoke);
      }
      wheel.position.set(x, R, side * 0.8);
      if (side < 0) wheel.rotation.y = Math.PI;
      g.add(wheel);
      const arch = mesh(new THREE.CircleGeometry(R + 0.07, 28), black);
      arch.position.set(x, R, side * 0.905);
      g.add(arch);
    }
  }

  // Оптика, решётка, номера, зеркала
  const head = flat('#e9eef2', { roughness: 0.1, metalness: 0.3 });
  for (const side of [1, -1]) {
    const lamp = mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), head);
    lamp.position.set(2.2, 0.72, side * 0.62);
    const rear = mesh(new THREE.BoxGeometry(0.05, 0.1, 0.46), tail);
    rear.position.set(-2.24, 0.82, side * 0.62);
    const mirror = mesh(new THREE.BoxGeometry(0.12, 0.09, 0.2), paint);
    mirror.position.set(0.62, 1.03, side * 0.93);
    g.add(lamp, rear, mirror);
  }
  const grille = mesh(new THREE.BoxGeometry(0.05, 0.22, 0.95), black);
  grille.position.set(2.26, 0.55, 0);
  const frame = mesh(new THREE.BoxGeometry(0.04, 0.26, 1.03), chrome);
  frame.position.set(2.245, 0.55, 0);
  const intake = mesh(new THREE.BoxGeometry(0.05, 0.1, 1.3), black);
  intake.position.set(2.2, 0.36, 0);
  const plateMat = flat('#e8e8e0', { roughness: 0.5 });
  const plateFront = mesh(new THREE.BoxGeometry(0.02, 0.12, 0.5), plateMat);
  plateFront.position.set(2.27, 0.4, 0);
  const plateRear = mesh(new THREE.BoxGeometry(0.02, 0.12, 0.5), plateMat);
  plateRear.position.set(-2.265, 0.62, 0);
  g.add(frame, grille, intake, plateFront, plateRear);
  return g;
}
