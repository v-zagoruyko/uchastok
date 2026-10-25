import * as THREE from 'three';
import { flat, mesh } from './parts';
import { pbr, scaleBoxUV } from './textures';
import type { GateObj } from './types';

/**
 * Двустворчатые ворота из тонкого металла. Локально: x вдоль забора, +z наружу (на улицу),
 * створки открываются наружу, угол задаёт open (градусы).
 */
export function buildGate(o: GateObj): THREE.Group {
  const g = new THREE.Group();
  const leafW = o.width / 2 - 0.03;
  const clear = 0.12;
  const h = o.height;
  const bodyH = h - clear;
  const metal = pbr('corrugated_iron', { color: o.color, metalness: 0.2 });
  const steel = flat('#2c2f31', { roughness: 0.5, metalness: 0.6 });

  for (const s of [-1, 1]) {
    const post = mesh(new THREE.BoxGeometry(0.12, h + 0.35, 0.12), steel);
    post.position.set(s * (o.width / 2 + 0.06), (h + 0.35) / 2, 0);
    g.add(post);

    // Створка вращается вокруг петель на столбе: слева в минус open, справа в плюс (оба конца уходят на +z)
    const dir = -s;
    const leaf = new THREE.Group();
    leaf.position.set(s * (o.width / 2), 0, 0);
    leaf.rotation.y = s * THREE.MathUtils.degToRad(o.open);

    const sheetGeo = new THREE.BoxGeometry(leafW, bodyH - 0.12, 0.03);
    scaleBoxUV(sheetGeo, leafW, bodyH - 0.12, 0.03, 'corrugated_iron');
    const sheet = mesh(sheetGeo, metal);
    sheet.position.set(dir * (leafW / 2), clear + bodyH / 2, 0);
    leaf.add(sheet);

    const bar = (w: number, hh: number, x: number, y: number) => {
      const b = mesh(new THREE.BoxGeometry(w, hh, 0.06), steel);
      b.position.set(x, y, 0);
      leaf.add(b);
      return b;
    };
    bar(leafW, 0.06, dir * (leafW / 2), h - 0.03);
    bar(leafW, 0.06, dir * (leafW / 2), clear + 0.03);
    bar(0.06, bodyH, 0.03 * dir, clear + bodyH / 2);
    bar(0.06, bodyH, dir * (leafW - 0.03), clear + bodyH / 2);
    const brace = bar(Math.hypot(leafW, bodyH - 0.12), 0.04, dir * (leafW / 2), clear + bodyH / 2);
    brace.rotation.z = dir * Math.atan2(bodyH - 0.12, leafW);
    g.add(leaf);
  }

  const latch = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.1), steel);
  latch.position.set(0, h * 0.5, 0);
  if (o.open < 5) g.add(latch);
  return g;
}
