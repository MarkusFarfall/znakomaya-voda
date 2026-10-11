/** Минимальный кадр, который нужен 3D-сцене судна; собирается адаптером из Frame игры. */
export interface W3 {
  lights: number;
  temp: number;
  rain: number;
  sunElev: number;
  sunAz: number;
  sunVis: number;
  cover: number;
  moonElev: number;
  moonAz: number;
  moonVis: number;
  moonIllum: number;
  daylight: number;
  night: number;
  palette: { skyMid: [number, number, number]; seaNear: [number, number, number] };
}

export interface F {
  t: number;
  dt: number;
  dpr: number;
  /** пикселей в метре */
  PXM: number;
  /** линия спокойной воды (экранная Y) */
  sY: number;
  night: number;
  day: number;
  golden: number;
  fog: number;
  /** ветер со знаком, м/с */
  windS: number;
  w: W3;
  ocean: { height: (xMeters: number) => number };
  lane: { current: (xMeters: number) => number };
  X2S: (xMeters: number) => number;
}
