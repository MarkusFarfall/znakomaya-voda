import type { Engine } from "../engine";
import type { AtmosphereState } from "../atmosphere/types";
import type { LocationDef, SpotDef, WeatherId } from "../types";

/** Что drawBoat читает из Engine (все эти поля есть в настоящем engine.ts) */
export interface EngineView {
  boat: import("../types").BoatDef;
  temperature: number;
  phase: string;
  power: number;
  castT: number;
  reeling: boolean;
  pullDir: number;
  hooked: { tension: number; jump: number; motion?: import("../fishingPhysics").FightMotion } | null;
}

export interface Frame {
  ctx: CanvasRenderingContext2D;
  e: Engine;
  loc: LocationDef;
  spot: SpotDef;
  weather: WeatherId;
  atmo: AtmosphereState;
  W: number;
  boatX?: number;
  localBoat?: boolean;
  worldWidth?: number;
  worldToScreenX?: (x: number) => number;
  H: number;
  t: number;
  dt: number;
  /** линия воды (разрез) */
  sY: number;
  /** горизонт */
  hY: number;
  cam: number;
  K: number;
  sc: number;
  night: number;
  day: number;
  golden: number;
  cover: number;
  fogK: number;
  top: string;
  mid: string;
  hor: string;
  sunX: number;
  sunY: number;
  sunElev: number;
  sunVis: number;
  moonX: number;
  moonY: number;
  moonUp: boolean;
  moonVis: number;
  amp: number;
  wind: number;
  clarity: number;
  quality: number;
  /** Visual exposure in the dedicated seabed camera, never a gameplay light source. */
  bottomFocus?: boolean;
  compact: boolean;
  land: boolean;
  /** зарезервировано сверху/снизу под DOM-интерфейс */
  topRes: number;
  botRes: number;
  depthPx: (m: number) => number;
  waveY: (x: number) => number;
  /** откуда светит солнце/луна: dx −1 (слева) … 1 (справа), k — сила 0..1 */
  light?: { dx: number; k: number };
}
