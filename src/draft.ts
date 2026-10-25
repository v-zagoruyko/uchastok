import type { PlotData } from './types';

const KEY = 'uchastok:draft';

interface Draft {
  plot: PlotData;
  /** true: расстановка подтверждена записью в data/plot.json. */
  saved: boolean;
}

/** Несохранённая в файл расстановка из прошлой сессии (если запись не удалась). */
export function loadDraft(): PlotData | null {
  // На проде правки живут только до перезагрузки, копия нужна лишь dev-серверу
  if (import.meta.env.PROD) return null;
  try {
    const draft: Draft | null = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return draft && !draft.saved ? draft.plot : null;
  } catch {
    return null;
  }
}

export function storeDraft(plot: PlotData, saved: boolean) {
  if (import.meta.env.PROD) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ plot, saved } satisfies Draft));
  } catch { /* без копии */ }
}
