/**
 * Геометрия корпусов и облегчённое тело судна для 3D-моделей.
 * Профили (keelShape/beamShape/deckHeight) и обмер корпусов — те же, что в физике релиза:
 * подводная часть 3D-модели совпадает с расчётной.
 */
import { G, clamp, smooth } from "./util3";
import type { BoatDef, BoatStyle } from "../../types";

/** судно в терминах 3D-моделей; BoatDef игры структурно совместим */
export type VesselSpec = BoatDef;
export type { BoatStyle };

export interface HullGeo {
  /** длина, м */
  L: number;
  /** ширина, м */
  B: number;
  /** осадка в покое, м */
  T: number;
  /** надводный борт, м */
  fb: number;
  motor: "none" | "outboard" | "inboard" | "aux";
  Tmax: number;
  Rforce: number;
  vMax: number;
  planing: boolean;
  /** площадь парусности, м² */
  sail: number;
  windage: number;
  human: number;
  zp: number;
  wooden: boolean;
}

export const HULLS: Record<BoatStyle, HullGeo> = {
  row: { L: 5.5, B: 1.55, T: 0.16, fb: 0.55, motor: "none", Tmax: 110, Rforce: 82, vMax: 2.4, planing: false, sail: 0, windage: 3, human: 1.7, zp: 0.2, wooden: true },
  kayak: { L: 5.1, B: 0.62, T: 0.11, fb: 0.28, motor: "none", Tmax: 70, Rforce: 52, vMax: 3.1, planing: false, sail: 0, windage: 1.2, human: 1.1, zp: 0.1, wooden: false },
  dinghy: { L: 6.4, B: 2.1, T: 0.2, fb: 0.8, motor: "outboard", Tmax: 1500, Rforce: 1150, vMax: 8.6, planing: true, sail: 0, windage: 6, human: 0, zp: 0.35, wooden: false },
  barkas: { L: 7.6, B: 2.7, T: 0.6, fb: 0.95, motor: "inboard", Tmax: 1500, Rforce: 1200, vMax: 4.8, planing: false, sail: 22, windage: 10, human: 0, zp: 0.5, wooden: true },
  cutter: { L: 8.6, B: 2.9, T: 0.55, fb: 1.0, motor: "inboard", Tmax: 3600, Rforce: 2700, vMax: 7.4, planing: false, sail: 0, windage: 14, human: 0, zp: 0.5, wooden: false },
  yacht: { L: 9.3, B: 2.9, T: 1.35, fb: 0.95, motor: "aux", Tmax: 800, Rforce: 1500, vMax: 6.6, planing: false, sail: 36, windage: 9, human: 0, zp: 0.9, wooden: false },
  seiner: { L: 11.4, B: 3.8, T: 1.5, fb: 1.2, motor: "inboard", Tmax: 7000, Rforce: 5200, vMax: 6.2, planing: false, sail: 0, windage: 22, human: 0, zp: 0.9, wooden: false },
  trawler: { L: 12.5, B: 4.2, T: 1.9, fb: 1.3, motor: "inboard", Tmax: 8500, Rforce: 6400, vMax: 6.4, planing: false, sail: 0, windage: 26, human: 0, zp: 1.0, wooden: false },
  research: { L: 13.2, B: 3.8, T: 1.7, fb: 1.25, motor: "inboard", Tmax: 9500, Rforce: 7200, vMax: 7.4, planing: false, sail: 0, windage: 24, human: 0, zp: 0.9, wooden: false },
};

export const keelShape = (u: number) => 1 - Math.pow(Math.max(0, (u - 0.3) / 0.7), 1.7) * 0.62 - Math.pow(Math.max(0, (-u - 0.65) / 0.35), 1.5) * 0.3;
export const beamShape = (u: number) => Math.pow(Math.max(0.02, 1 - Math.pow(Math.abs(u), u > 0 ? 2.3 : 3.4)), 0.55);
export const deckHeight = (g: HullGeo, u: number) => g.fb * (1 + 0.28 * Math.max(0, u) ** 2 + 0.06 * u * u);

const N = 11;
const RHO = 1000;
function fWave(Fn: number, planing: boolean) {
  if (planing) return 1 + 1.1 * smooth(0.28, 0.46, Fn) - 0.95 * smooth(0.55, 1.0, Fn);
  return 1 + 1.8 * smooth(0.3, 0.5, Fn);
}

interface Pend {
  phi: number;
  om: number;
  len: number;
}

/**
 * Тело судна без шага физики: положение/углы/обороты выставляет адаптер игры
 * из её собственной качки и анимаций, а 3D-модели только читают эти поля.
 */
export class VesselBody {
  readonly geo: HullGeo;
  x = 0;
  /** скорость относительно воды, м/с */
  vw = 0;
  /** осадка/подъём центра тяжести, м (+ вверх) */
  y = 0;
  vy = 0;
  /** дифферент, рад (+ нос вверх) */
  theta = 0;
  omega = 0;
  /** курс: 0 — нос вправо */
  psi = 0;
  yawRate = 0;
  rpm = 0;
  throttle = 0;
  /** фаза гребка, рад */
  stroke = 0;
  sailK = 0;
  anchored = false;
  anchorX = 0;
  grounded = false;
  clearance = 99;
  thrust = 0;
  fuelBurn = 0;
  ax = 0;
  /** наклон экипажа вперёд, рад */
  lean = 0;
  /** крен, рад */
  roll = 0;
  rollW = 0;
  wash = 0;
  heaveAcc = 0;
  wet = 1;
  readonly mass: number;
  readonly cbx: number;
  readonly brakeDecel: number;
  readonly pend: Pend[] = [
    { phi: 0, om: 0, len: 0.7 },
    { phi: 0, om: 0, len: 2.6 },
    { phi: 0, om: 0, len: 0.9 },
  ];
  windRel = 0;
  reef = 1;
  reversing = false;

  constructor(readonly spec: VesselSpec) {
    const g = HULLS[spec.style];
    this.geo = g;
    const dx = g.L / N;
    let f0 = 0;
    let m0 = 0;
    let awp = 0;
    let kth = 0;
    const ss: number[] = [];
    const bb: number[] = [];
    for (let i = 0; i < N; i++) {
      const s = ((i + 0.5) / N) * g.L - g.L / 2;
      const u = (2 * s) / g.L;
      const b = g.B * beamShape(u);
      const yk = -g.T * keelShape(u);
      const d0 = Math.max(0, -yk);
      ss.push(s);
      bb.push(b);
      const F0 = RHO * G * b * dx * d0;
      f0 += F0;
      m0 += F0 * s;
      awp += b * dx;
    }
    this.mass = f0 / G;
    this.cbx = m0 / f0;
    for (let i = 0; i < N; i++) kth += RHO * G * bb[i] * dx * (ss[i] - this.cbx) ** 2;
    const kh = RHO * G * awp;
    const mEff = this.mass * 1.25;
    const Ith = 1.6 * this.mass * (0.26 * g.L) ** 2;
    void kh; void mEff; void Ith;
    const Fn = g.vMax / Math.sqrt(G * g.L);
    const kR = g.Rforce / (g.vMax * g.vMax * fWave(Fn, g.planing));
    this.brakeDecel = clamp((0.45 * g.Tmax + g.Rforce * 0.5) / this.mass, 0.12, 1.6);
    void kR;
  }
}

/** то, что VesselStage читает из «сима» */
export interface SeaSim {
  body: VesselBody;
}
