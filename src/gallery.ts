import * as THREE from 'three';
import { STYLES, type DesignKind } from './designs';
import { buildObjects } from './objects';
import { createWorld } from './scene';
import { sunState, toInstant } from './sun';
import type { DesignObj, PlotData } from './types';

// Каталог: все стили домов и бань рядом, с размерами по умолчанию. Данные участка не трогает.
const objects: DesignObj[] = [];
const labels: { el: HTMLElement; at: THREE.Vector3 }[] = [];
(['house', 'bath'] as DesignKind[]).forEach((kind, row) => {
  Object.entries(STYLES[kind]).forEach(([style, s], i) => {
    const o: DesignObj = {
      id: `${kind}-${style}`,
      type: kind,
      style,
      x: 8 + i * 14,
      z: 8 + row * 20,
      width: s.defaults.w,
      depth: s.defaults.d,
      height: s.defaults.h,
    };
    objects.push(o);
    const el = Object.assign(document.createElement('div'), {
      className: 'label',
      textContent: `${kind === 'house' ? 'Дом' : 'Баня'}: ${s.label} (${o.width}×${o.depth}×${o.height} м)`,
    });
    document.body.append(el);
    labels.push({ el, at: new THREE.Vector3(o.x, o.height + 1.2, o.z) });
  });
});

const plot: PlotData = {
  location: { lat: 57.06, lon: 65.68 },
  utcOffsetHours: 5,
  northAngleDeg: 0,
  boundary: { points: [[-2, -4], [58, -4], [58, 34], [-2, 34]], fenceHeight: 0.05 },
  objects,
};

const world = createWorld(plot, 'uchastok:gallery-camera');
const { root } = buildObjects(plot.objects);
world.scene.add(root);
world.grass.rebuild(plot.objects);
world.applySun(sunState(toInstant('2026-06-21', 15, plot.utcOffsetHours), plot.location.lat, plot.location.lon, 0));

const v = new THREE.Vector3();
world.renderer.setAnimationLoop(() => {
  world.controls.update();
  world.renderer.render(world.scene, world.camera);
  for (const { el, at } of labels) {
    v.copy(at).project(world.camera);
    const visible = v.z < 1;
    el.style.display = visible ? '' : 'none';
    el.style.transform = `translate(${((v.x + 1) / 2) * window.innerWidth}px, ${((1 - v.y) / 2) * window.innerHeight}px) translate(-50%, -100%)`;
  }
});
