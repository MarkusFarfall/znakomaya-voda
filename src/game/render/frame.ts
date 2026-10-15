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
  buttonControls?: boolean;
  /** Camera bounds in the coordinate system used by the current renderer/chunk. */
  viewLeft?: number;
  viewWidth?: number;
  chunkOffset?: number;
  bedDepth?: (x:number)=>number;
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

/** Horizontal draw window; chunks keep world coordinates, so culling must use the local frame bounds. */
export function horizontalRange(f: Pick<Frame, "W" | "viewLeft" | "viewWidth">, padding = 0) {
  const pad = Math.max(0, Number.isFinite(padding) ? padding : 0);
  const left = f.viewLeft ?? 0;
  const right = left + (f.viewWidth ?? f.W);
  return {
    left: Math.min(f.W + pad, Math.max(-pad, left - pad)),
    right: Math.max(-pad, Math.min(f.W + pad, right + pad)),
  };
}

export function overlapsHorizontal(
  f: Pick<Frame, "W" | "viewLeft" | "viewWidth">,
  x0: number,
  x1 = x0,
  padding = 0,
) {
  const range = horizontalRange(f, padding);
  return x1 >= range.left && x0 <= range.right;
}

/** Internal coasts converge to one horizon; physical outer shores remain intact. */
export function shoreEnvelope(f: Frame,x:number) {
  if(f.chunkOffset===undefined)return 1;
  const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n/280));return t*t*(3-2*t);};
  return (f.chunkOffset>0?smooth(x):1)*(f.chunkOffset+f.W<(f.worldWidth??f.W)?smooth(f.W-x):1);
}
