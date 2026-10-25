import * as THREE from 'three';
import { STYLES } from './designs';
import { clearDraft, parsePlot, storeDraft } from './draft';
import { areaLabel, disposeLabel, footprintArea, formatArea } from './labels';
import { createObject } from './objects';
import type { World } from './scene';
import type { PlotData, PlotObject } from './types';

const round1 = (n: number) => Math.round(n * 10) / 10;
const HIGHLIGHT = new THREE.Color('#6b5200');

/** Поля объекта, которые редактор показывает как ширину, длину и высоту. */
const DIMS: Partial<Record<PlotObject['type'], { w: string; d?: string; h: string }>> = {
  gate: { w: 'width', h: 'height' },
  house: { w: 'width', d: 'depth', h: 'height' },
  bath: { w: 'width', d: 'depth', h: 'height' },
  building: { w: 'width', d: 'depth', h: 'wallHeight' },
  greenhouse: { w: 'width', d: 'length', h: 'height' },
  box: { w: 'width', d: 'depth', h: 'height' },
};

export function setupEditor(world: World, plot: PlotData, byId: Map<string, THREE.Object3D>, restored: boolean) {
  const entries = new Map(plot.objects.map((o) => [o.id, o]));
  const movable = plot.objects.filter((o) => !o.fixed);
  // В списке и с подписями только наши объекты; чужие можно взять мышью, но в списке их нет
  const listed = movable.filter((o) => !o.neighbor);
  const canvas = world.renderer.domElement;
  const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
  const list = $('#list');
  const fields = $('#fields');
  const status = $('#status');
  const inputs = { x: $<HTMLInputElement>('#f-x'), z: $<HTMLInputElement>('#f-z'), rot: $<HTMLInputElement>('#f-rot') };
  const sizeInputs = { w: $<HTMLInputElement>('#f-w'), d: $<HTMLInputElement>('#f-d'), h: $<HTMLInputElement>('#f-h') };
  const styleRow = $('#style-row');
  const styleSelect = $<HTMLSelectElement>('#f-style');
  const sizes = $('#sizes');
  const resetDims = $<HTMLButtonElement>('#reset-dims');
  const openRow = $('#open-row');
  const openInput = $<HTMLInputElement>('#f-open');
  const areasToggle = $<HTMLInputElement>('#areas');
  const labels = new Map<string, THREE.Sprite>();
  const areaTexts = new Map<string, HTMLElement>();
  let styleKind: string | null = null;

  let selected: string | null = null;
  let drag: { id: string; offset: THREE.Vector3 } | null = null;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3();

  function aim(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, world.camera);
  }

  function pick(): string | null {
    const targets = movable.map((o) => byId.get(o.id)!).filter((o) => o.visible);
    const hit = raycaster.intersectObjects(targets, true)[0];
    let node: THREE.Object3D | null = hit?.object ?? null;
    while (node && !node.userData.id) node = node.parent;
    return node?.userData.id ?? null;
  }

  function tint(id: string, on: boolean) {
    byId.get(id)!.traverse((c) => {
      const mats = ([] as THREE.Material[]).concat((c as THREE.Mesh).material ?? []);
      for (const m of mats) {
        if (!m.userData.keepEmissive) (m as THREE.MeshStandardMaterial).emissive?.set(on ? HIGHLIGHT : '#000000');
      }
    });
  }

  function refreshFields() {
    fields.hidden = !selected;
    if (!selected) return;
    const o = entries.get(selected)!;
    $('#sel-name').textContent = o.id + (o.note ? ` · ${o.note}` : '');
    inputs.x.value = String(o.x);
    inputs.z.value = String(o.z);
    inputs.rot.value = String(o.rotationDeg ?? 0);

    const dims = DIMS[o.type];
    sizes.hidden = !dims;
    if (dims) {
      const rec = o as unknown as Record<string, number>;
      sizeInputs.w.value = String(rec[dims.w]);
      sizeInputs.d.value = dims.d ? String(rec[dims.d]) : '';
      sizeInputs.h.value = String(rec[dims.h]);
      sizeInputs.d.parentElement!.hidden = !dims.d;
    }
    openRow.hidden = o.type !== 'gate';
    if (o.type === 'gate') openInput.value = String(o.open);
    const design = o.type === 'house' || o.type === 'bath';
    styleRow.hidden = resetDims.hidden = !design;
    if (design) {
      if (styleKind !== o.type) {
        styleKind = o.type;
        styleSelect.replaceChildren(
          ...Object.entries(STYLES[o.type]).map(([key, s]) => Object.assign(document.createElement('option'), { value: key, textContent: s.label })),
        );
      }
      styleSelect.value = o.style;
    }
  }

  // Пересоздать модель после смены стиля или размеров
  function rebuild(id: string) {
    const old = byId.get(id)!;
    const next = createObject(entries.get(id)!);
    old.parent?.add(next);
    old.parent?.remove(old);
    old.traverse((c) => {
      const m = c as THREE.Mesh;
      m.geometry?.dispose();
      for (const mat of ([] as THREE.Material[]).concat(m.material ?? [])) mat.dispose();
    });
    byId.set(id, next);
    updateArea(id);
    if (selected === id) tint(id, true);
  }

  // Площадь основания: в списке и подписью над объектом (пересоздаётся вместе с моделью)
  function updateArea(id: string) {
    const text = areaTexts.get(id);
    const area = footprintArea(entries.get(id)!);
    if (!text || area === null) return;
    text.textContent = formatArea(area);
    const obj = byId.get(id)!;
    const old = labels.get(id);
    if (old) disposeLabel(old);
    const label = areaLabel(formatArea(area), new THREE.Box3().setFromObject(obj).max.y + 0.4);
    label.visible = areasToggle.checked;
    obj.add(label);
    labels.set(id, label);
  }

  function select(id: string | null) {
    if (selected) tint(selected, false);
    selected = id;
    if (selected) tint(selected, true);
    for (const row of list.querySelectorAll<HTMLElement>('.row')) row.classList.toggle('on', row.dataset.id === selected);
    refreshFields();
  }

  let timer: number | undefined;
  let version = 0;
  function save() {
    const mine = ++version;
    const stored = storeDraft(plot, false);
    world.grass.rebuild(plot.objects);
    world.setGates(plot.objects);
    if (import.meta.env.PROD) {
      // Файл plot.json пишет только dev-сервер; на проде расстановка живёт в браузере, скачать её можно кнопкой ⬇
      status.textContent = stored ? 'в браузере' : 'браузер не сохраняет';
      status.className = stored ? 'ok' : 'err';
      return;
    }
    status.textContent = '…';
    status.className = '';
    clearTimeout(timer);
    timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/__plot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(plot),
        });
        if (res.ok && mine === version) storeDraft(plot, true);
        status.textContent = res.ok ? 'сохранено' : `ошибка ${res.status}, копия в браузере`;
        status.className = res.ok ? 'ok' : 'err';
      } catch {
        status.textContent = 'не сохранено, копия в браузере';
        status.className = 'err';
      }
    }, 300);
  }

  $('#download').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(plot, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: 'plot.json' }).click();
    URL.revokeObjectURL(url);
  });

  // Загрузка своего JSON: кладём в копию браузера и перезагружаем страницу, мир строится из plot целиком
  const uploadFile = $<HTMLInputElement>('#upload-file');
  $('#upload').addEventListener('click', () => uploadFile.click());
  uploadFile.addEventListener('change', async () => {
    const file = uploadFile.files?.[0];
    uploadFile.value = '';
    if (!file) return;
    try {
      const next = parsePlot(await file.text());
      if (!storeDraft(next, false)) throw new Error('браузер не дал сохранить');
      location.reload();
    } catch (err) {
      status.textContent = `не загружено: ${(err as Error).message}`;
      status.className = 'err';
    }
  });

  // На проде копия в браузере перекрывает данные сайта: сброс возвращает исходные
  const reset = $<HTMLButtonElement>('#reset');
  reset.hidden = !import.meta.env.PROD;
  reset.addEventListener('click', () => {
    if (!confirm('Сбросить расстановку к исходной? Правки в браузере пропадут.')) return;
    clearDraft();
    location.reload();
  });

  areasToggle.addEventListener('change', () => {
    for (const label of labels.values()) label.visible = areasToggle.checked;
  });

  function place(id: string, x: number, z: number) {
    const o = entries.get(id)!;
    o.x = round1(x);
    o.z = round1(z);
    byId.get(id)!.position.set(o.x, 0, o.z);
  }

  function rotate(id: string, deg: number) {
    const o = entries.get(id)!;
    const d = round1(((deg % 360) + 360) % 360);
    if (d === 0) delete o.rotationDeg;
    else o.rotationDeg = d;
    byId.get(id)!.rotation.y = -THREE.MathUtils.degToRad(d);
  }

  function setKeep(id: string, keep: boolean) {
    const o = entries.get(id)!;
    if (keep) delete o.keep;
    else o.keep = false;
    byId.get(id)!.visible = keep;
  }

  // Список объектов
  for (const o of listed) {
    const row = document.createElement('label');
    row.className = 'row';
    row.dataset.id = o.id;
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = o.keep !== false;
    box.title = 'оставить';
    box.addEventListener('change', () => {
      setKeep(o.id, box.checked);
      save();
    });
    const name = document.createElement('span');
    name.textContent = o.id;
    const area = document.createElement('span');
    area.className = 'area';
    areaTexts.set(o.id, area);
    for (const part of [name, area]) {
      part.addEventListener('click', (e) => {
        e.preventDefault();
        select(o.id);
      });
    }
    row.append(box, name, area);
    list.append(row);
    updateArea(o.id);
  }

  // Перетаскивание: перехватываем нажатие раньше OrbitControls
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    aim(e);
    const id = pick();
    if (!id) return;
    select(id);
    raycaster.ray.intersectPlane(ground, point);
    drag = { id, offset: byId.get(id)!.position.clone().sub(point) };
    world.controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  }, { capture: true });

  canvas.addEventListener('pointermove', (e) => {
    aim(e);
    if (!drag) {
      canvas.style.cursor = pick() ? 'grab' : '';
      return;
    }
    if (!raycaster.ray.intersectPlane(ground, point)) return;
    place(drag.id, point.x + drag.offset.x, point.z + drag.offset.z);
    refreshFields();
  });

  const endDrag = () => {
    if (!drag) return;
    drag = null;
    world.controls.enabled = true;
    canvas.style.cursor = '';
    save();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // Точные значения
  const applyFields = () => {
    if (!selected) return;
    const x = parseFloat(inputs.x.value);
    const z = parseFloat(inputs.z.value);
    const rot = parseFloat(inputs.rot.value);
    if ([x, z, rot].some(Number.isNaN)) return;
    place(selected, x, z);
    rotate(selected, rot);
    save();
  };
  for (const input of Object.values(inputs)) input.addEventListener('change', applyFields);

  const applySize = () => {
    if (!selected) return;
    const o = entries.get(selected)!;
    const dims = DIMS[o.type];
    if (!dims) return;
    const [w, d, h] = [sizeInputs.w, sizeInputs.d, sizeInputs.h].map((i) => parseFloat(i.value));
    if ([w, h, dims.d ? d : 1].some((v) => Number.isNaN(v) || v <= 0)) return;
    const rec = o as unknown as Record<string, number>;
    rec[dims.w] = round1(Math.max(0.5, w));
    rec[dims.h] = round1(Math.max(0.5, h));
    if (dims.d) rec[dims.d] = round1(Math.max(0.5, d));
    rebuild(selected);
    refreshFields();
    save();
  };
  for (const input of Object.values(sizeInputs)) input.addEventListener('change', applySize);

  openInput.addEventListener('change', () => {
    const o = selected && entries.get(selected);
    const open = parseFloat(openInput.value);
    if (!o || o.type !== 'gate' || Number.isNaN(open)) return;
    o.open = Math.min(110, Math.max(0, Math.round(open)));
    rebuild(o.id);
    refreshFields();
    save();
  });

  styleSelect.addEventListener('change', () => {
    const o = selected && entries.get(selected);
    if (!o || (o.type !== 'house' && o.type !== 'bath')) return;
    o.style = styleSelect.value;
    rebuild(o.id);
    save();
  });

  resetDims.addEventListener('click', () => {
    const o = selected && entries.get(selected);
    if (!o || (o.type !== 'house' && o.type !== 'bath')) return;
    const { w, d, h } = (STYLES[o.type][o.style] ?? Object.values(STYLES[o.type])[0]).defaults;
    [o.width, o.depth, o.height] = [w, d, h];
    rebuild(o.id);
    refreshFields();
    save();
  });

  // Прошлая запись не удалась: расстановка из копии браузера, пробуем записать снова
  if (restored) save();

  // e.code, чтобы работало на русской раскладке
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.code === 'Escape') select(null);
    if (!selected || (e.code !== 'KeyQ' && e.code !== 'KeyE')) return;
    const step = (e.shiftKey ? 1 : 5) * (e.code === 'KeyE' ? 1 : -1);
    rotate(selected, (entries.get(selected)!.rotationDeg ?? 0) + step);
    refreshFields();
    save();
  });
}
