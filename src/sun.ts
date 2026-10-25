import * as THREE from 'three';
import { getPosition } from 'suncalc';

export interface SunState {
  /** Единичный вектор от участка к солнцу в системе участка (x восток, y вверх, z юг). */
  direction: THREE.Vector3;
  altitudeDeg: number;
  azimuthDeg: number;
}

/** Местное время (дата `YYYY-MM-DD` + часы) в момент UTC. */
export function toInstant(date: string, hours: number, utcOffsetHours: number): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0) + (hours - utcOffsetHours) * 3_600_000);
}

export function sunState(instant: Date, lat: number, lon: number, northAngleDeg: number): SunState {
  const { azimuth, altitude } = getPosition(instant, lat, lon);
  const bearing = THREE.MathUtils.degToRad(azimuth - northAngleDeg);
  const alt = THREE.MathUtils.degToRad(altitude);
  const direction = new THREE.Vector3(
    Math.sin(bearing) * Math.cos(alt),
    Math.sin(alt),
    -Math.cos(bearing) * Math.cos(alt),
  );
  return { direction, altitudeDeg: altitude, azimuthDeg: azimuth };
}
