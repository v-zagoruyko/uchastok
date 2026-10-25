export type Vec2 = [x: number, z: number];

interface Base {
  id: string;
  /** Метры от начала координат участка: x на восток, z на юг (север по -Z). */
  x: number;
  z: number;
  /** Поворот по часовой стрелке при взгляде сверху. */
  rotationDeg?: number;
  /** false: объект не рисуется (хотим убрать). */
  keep?: boolean;
  /** Нельзя выбрать и двигать мышью (дорога). */
  fixed?: boolean;
  /** Чужой объект за забором. */
  neighbor?: boolean;
  note?: string;
}

export interface TreeObj extends Base {
  type: 'tree';
  species: 'apple' | 'conifer';
  height: number;
  crown: number;
}

export interface BuildingObj extends Base {
  type: 'building';
  width: number;
  depth: number;
  wallHeight: number;
  roofHeight: number;
  wallColor: string;
  roofColor: string;
  windows?: number;
  door?: boolean;
}

export interface GreenhouseObj extends Base {
  type: 'greenhouse';
  width: number;
  length: number;
  height: number;
}

export interface TireObj extends Base {
  type: 'tire';
  diameter: number;
  width: number;
}

export interface BoxObj extends Base {
  type: 'box';
  width: number;
  depth: number;
  height: number;
  color: string;
  /** Покрытие вместо плоского цвета: грунтовка, плитка, бетон. */
  surface?: 'dirt' | 'tiles' | 'concrete';
}

/** Ворота в заборе (src/gate.ts): вырезают проём там, где стоят на границе; +z наружу. */
export interface GateObj extends Base {
  type: 'gate';
  width: number;
  height: number;
  /** Угол открытия створок наружу, градусы (0 закрыты). */
  open: number;
  color: string;
}

/** Автомобиль (модель в src/car.ts). Нос смотрит по локальной оси +x. */
export interface CarObj extends Base {
  type: 'car';
  model: string;
  color: string;
}

/** Дом или баня выбранного стиля (список стилей: src/designs.ts). Фасад смотрит в +z. */
export interface DesignObj extends Base {
  type: 'house' | 'bath';
  style: string;
  width: number;
  depth: number;
  /** Полная высота до конька. */
  height: number;
}

export type PlotObject = TreeObj | BuildingObj | GreenhouseObj | TireObj | BoxObj | DesignObj | CarObj | GateObj;

/** Участок соседа: заливка и забор, без построек (они лежат в objects). */
export interface Parcel {
  id: string;
  points: Vec2[];
  note?: string;
}

export interface PlotData {
  location: { lat: number; lon: number };
  /** Смещение местного времени от UTC, часы (часовой пояс участка). */
  utcOffsetHours: number;
  /** На сколько градусов по часовой стрелке направление -Z участка отклонено от севера. */
  northAngleDeg: number;
  boundary: { points: Vec2[]; fenceHeight: number; note?: string };
  objects: PlotObject[];
  parcels?: Parcel[];
}
