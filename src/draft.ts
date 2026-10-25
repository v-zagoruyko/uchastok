import type { PlotData } from './types';

const KEY = 'uchastok:draft';

interface Draft {
  plot: PlotData;
  /** true: расстановка подтверждена записью в data/plot.json (только dev). */
  saved: boolean;
}

/**
 * Расстановка из прошлой сессии. В dev истина в data/plot.json, поэтому копия нужна, только если запись
 * в файл не удалась; на проде файла нет, и копия в браузере остаётся единственным хранилищем.
 */
export function loadDraft(): PlotData | null {
  try {
    const draft: Draft | null = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return draft && !draft.saved ? draft.plot : null;
  } catch {
    return null;
  }
}

export function storeDraft(plot: PlotData, saved: boolean): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ plot, saved } satisfies Draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* нечего чистить */ }
}

const TYPES = ['tree', 'building', 'greenhouse', 'tire', 'box', 'house', 'bath', 'car', 'gate', 'pergola', 'bed', 'model'];
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPoint = (p: unknown) => Array.isArray(p) && p.length === 2 && p.every(finite);

/** Разобрать загруженный пользователем plot.json; при неверной структуре бросает Error с понятным текстом. */
export function parsePlot(text: string): PlotData {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('это не JSON');
  }
  if (!finite(data?.location?.lat) || !finite(data.location.lon)) throw new Error('нет location.lat и lon');
  if (!finite(data.utcOffsetHours) || !finite(data.northAngleDeg)) throw new Error('нет utcOffsetHours или northAngleDeg');
  const boundary = data.boundary?.points;
  if (!Array.isArray(boundary) || boundary.length < 3 || !boundary.every(isPoint)) throw new Error('boundary.points: нужно от 3 точек [x, z]');
  if (!finite(data.boundary.fenceHeight)) throw new Error('нет boundary.fenceHeight');
  if (!Array.isArray(data.objects)) throw new Error('нет массива objects');
  const ids = new Set<string>();
  for (const o of data.objects) {
    if (typeof o?.id !== 'string' || ids.has(o.id)) throw new Error(`объект без id или id повторяется: ${o?.id}`);
    ids.add(o.id);
    if (!TYPES.includes(o.type)) throw new Error(`${o.id}: неизвестный type «${o.type}»`);
    if (!finite(o.x) || !finite(o.z)) throw new Error(`${o.id}: x и z должны быть числами`);
  }
  if (data.parcels !== undefined && !(Array.isArray(data.parcels) && data.parcels.every((p: { points?: unknown[] }) => Array.isArray(p?.points) && p.points.every(isPoint)))) {
    throw new Error('parcels: у каждого участка нужен массив points');
  }
  return data;
}
