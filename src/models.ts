import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ModelObj } from './types';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Object3D>>();

function fetchModel(id: string) {
  let p = cache.get(id);
  if (!p) {
    p = loader.loadAsync(`/assets/models/${id}/${id}.gltf`).then((gltf) => gltf.scene);
    cache.set(id, p);
  }
  return p;
}

/** Модель Poly Haven в метрах, низ на земле. Грузится асинхронно: в группу попадает, когда файл готов. */
export function placeModel(parent: THREE.Object3D, id: string, scale = 1, lift = 0) {
  fetchModel(id).then((scene) => {
    const m = scene.clone(true);
    m.scale.setScalar(scale);
    m.position.y = lift;
    m.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    parent.add(m);
  });
}

export function buildModel(o: ModelObj): THREE.Group {
  const g = new THREE.Group();
  placeModel(g, o.model, o.scale ?? 1);
  return g;
}
