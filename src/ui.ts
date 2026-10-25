import { getTimes } from 'suncalc';
import type { SunState } from './sun';

const fmt = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const quarter = (h: number) => Math.round(h * 4) / 4;

/** Сегодня по времени участка, а не браузера. */
function today(utcOffsetHours: number) {
  return new Date(Date.now() + utcOffsetHours * 3_600_000).toISOString().slice(0, 10);
}

/** Местное время кульминации солнца (солнечный полдень) в выбранный день. */
function zenithHour(date: string, loc: { lat: number; lon: number }, utcOffsetHours: number) {
  const [y, m, d] = date.split('-').map(Number);
  const noon = getTimes(new Date(Date.UTC(y, m - 1, d, 12 - utcOffsetHours)), loc.lat, loc.lon).solarNoon;
  const local = new Date(noon.getTime() + utcOffsetHours * 3_600_000);
  return quarter(local.getUTCHours() + local.getUTCMinutes() / 60);
}

export function setupTimeControls(
  loc: { lat: number; lon: number },
  utcOffsetHours: number,
  onChange: (date: string, hour: number) => void,
) {
  const date = document.querySelector<HTMLInputElement>('#date')!;
  const hour = document.querySelector<HTMLInputElement>('#hour')!;
  const info = document.querySelector<HTMLSpanElement>('#info')!;
  const zenith = document.querySelector<HTMLButtonElement>('#zenith')!;
  const now = document.querySelector<HTMLButtonElement>('#now')!;

  const emit = () => onChange(date.value, Number(hour.value));
  const setZenith = () => {
    hour.value = String(zenithHour(date.value, loc, utcOffsetHours));
  };
  date.addEventListener('input', emit);
  hour.addEventListener('input', emit);
  zenith.addEventListener('click', () => {
    setZenith();
    emit();
  });
  now.addEventListener('click', () => {
    const d = new Date(Date.now() + utcOffsetHours * 3_600_000);
    date.value = d.toISOString().slice(0, 10);
    hour.value = String(quarter(d.getUTCHours() + d.getUTCMinutes() / 60));
    emit();
  });

  // По умолчанию: сегодня, солнце в зените
  date.value = today(utcOffsetHours);
  setZenith();

  const show = (sun: SunState) => {
    const alt = sun.altitudeDeg > 0 ? `высота ${sun.altitudeDeg.toFixed(0)}°` : 'солнце за горизонтом';
    info.textContent = `${fmt(Number(hour.value))} · ${alt} · азимут ${sun.azimuthDeg.toFixed(0)}°`;
  };
  return { show, emit };
}
