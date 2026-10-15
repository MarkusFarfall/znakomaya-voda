import { fishingRodPose } from "../fishingRod";
/**
 * Адаптер 3D-судов к сцене игры.
 *
 * 3D-модель (VesselStage) рисуется в отдельный прозрачный WebGL-canvas и композитится
 * в 2D-сцену. Позу выставляет адаптер из качки/анимаций игры: высота и дифферент — по
 * волне под лодкой, гребок и обороты — по фазе рейса. Переключение 2D↔3D — коротким
 * кроссфейдом со сдвигом по высоте.
 *
 * Если WebGL недоступен или модель упала — молча остаёмся на 2D.
 */
import type { Frame } from "../frame";
import type { BoatStyle } from "../../types";
import { BOATS } from "../../world";
import type { F } from "./frame3";
import type { SeaSim } from "./hull3";
import { HULLS, VesselBody } from "./hull3";
import { VesselStage } from "./stage";
import { clamp, damp } from "./util3";

let uiPref = true;
/** предпочтение 2D/3D из настроек — читают превью (верфь, друзья, профиль) */
export const setBoat3dPref = (v: boolean) => { uiPref = v; };
export const getBoat3dPref = () => uiPref;

export class Boat3D {
  private body: VesselBody | null = null;
  private on = false;
  /** текущая доля 3D: 0 — только 2D, 1 — только 3D */
  k = 0;

  setEnabled(on: boolean) {
    this.on = on;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    f: Frame,
    bx: number,
    pose: "fish" | "helm" | "moored",
    speed01: number,
    dpr = 1,
  ): { tip: [number, number]; k: number } | null {
    const dt = f.dt;
    this.k = damp(this.k, this.on && !sharedBroken ? 1 : 0, 7, dt);
    if (sharedBroken || (this.k < 0.015 && !this.on)) return null;
    // одна WebGL-сцена на все сцены игры (вода, порт, рейс) — без повторного прогрева
    if (!sharedStage) {
      try {
        sharedStage = new VesselStage();
      } catch {
        sharedBroken = true;
        return null;
      }
    }
    const stage = sharedStage;
    stage.setPixelRatio(Math.abs(dpr));
    const spec = f.e.boat;
    if (!this.body || this.body.spec.id !== spec.id) this.body = new VesselBody(spec);
    const b = this.body;
    const g = HULLS[spec.style];
    const PXM = 28 * f.sc;

    /* ───── посадка из качки игры ───── */
    const wl = f.waveY(bx);
    b.x = 0;
    b.y = (f.sY - wl) / PXM;
    const slope = (f.waveY(bx + 2 * PXM) - f.waveY(bx - 2 * PXM)) / (4 * PXM);
    b.theta = damp(b.theta, clamp(-Math.atan(slope) * (0.55 + 0.5 * (1 - spec.stability)), -0.22, 0.22), 5, dt);
    b.roll = damp(b.roll, Math.sin(f.t * 1.1 + 1.7) * 0.035 * (1.25 - spec.stability) + clamp((f.atmo.wind * f.atmo.windDir) / 40, -0.2, 0.2) * 0.2, 3, dt);
    const rowing = (spec.style === "row" || spec.style === "kayak") && pose === "helm" && speed01 > .015;
    b.stroke += (rowing ? 1.2 + 1.5 * speed01 : 0) * dt;
    b.vw = pose === "moored" ? 0 : speed01 * g.vMax * 0.75;
    b.rpm = g.motor !== "none" && pose !== "moored" ? 0.2 + 0.8 * speed01 : 0;
    b.psi = 0;
    b.lean = clamp(-speed01 * 0.12 - (f.localBoat ? f.e.navigation.acceleration * f.e.navigation.heading * .001 : 0), -0.2, 0.2);

    /* ───── кадр для 3D-сцены ───── */
    const a = f.atmo;
    const f3: F = {
      t: f.t,
      dt,
      dpr: clamp(dpr, 1, 2),
      PXM,
      sY: f.sY,
      night: f.night,
      day: f.day,
      golden: f.golden,
      fog: f.fogK,
      windS: a.wind * a.windDir,
      w: {
        lights: a.lights,
        temp: a.temp,
        rain: a.rain,
        sunElev: a.sunElev,
        sunAz: a.sunAz,
        sunVis: a.sunVis,
        cover: a.cover,
        moonElev: a.moonElev,
        moonAz: a.moonAz,
        moonVis: a.moonVis,
        moonIllum: a.moonIllum,
        daylight: a.daylight,
        night: a.night,
        palette: { skyMid: a.palette.skyMid, seaNear: a.palette.seaNear },
      },
      ocean: { height: (xm: number) => (f.sY - f.waveY(bx + xm * PXM)) / PXM },
      lane: { current: () => 0 },
      X2S: (xm: number) => bx + xm * PXM,
    };
    const sim: SeaSim = { body: b };

    ctx.save();
    ctx.globalAlpha *= clamp(this.k, 0, 1);
    ctx.translate(0, -(1 - this.k) * 8);
    let ok = false;
    try {
      ok = stage.draw(ctx, f3, sim, { smoke: () => {}, bubble: () => {} });
    } catch {
      sharedBroken = true;
    }
    ctx.restore();
    if (!ok) {
      sharedBroken = true;
      return null;
    }
    const handHeld = spec.style === "row" || spec.style === "kayak";
    const grip: [number, number] = [bx + PXM * (handHeld ? -0.45 : 0.35), wl - PXM * (handHeld ? 0.72 : 0.45)];
    const { angle, bend } = fishingRodPose(f.e, f.t);
    const length = PXM * 2.6;
    const tip: [number, number] = [
      grip[0] + Math.cos(angle) * length * (1 - bend * 0.14),
      grip[1] + Math.sin(angle) * length * (1 - bend * 0.28) + bend * length * 0.38,
    ];
    if (pose === "fish") {
      ctx.save(); ctx.globalAlpha *= this.k;
      if (!handHeld) {
        ctx.strokeStyle = "#777a70"; ctx.lineWidth = Math.max(1, PXM * 0.07);
        ctx.beginPath(); ctx.moveTo(grip[0], wl - PXM * 0.05); ctx.lineTo(...grip); ctx.stroke();
      }
      ctx.strokeStyle = "#42372b"; ctx.lineWidth = Math.max(1, PXM * 0.055); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(...grip);
      ctx.quadraticCurveTo(grip[0] + Math.cos(angle) * length * 0.62, grip[1] + Math.sin(angle) * length * 0.62, ...tip);
      ctx.stroke();
      ctx.strokeStyle = "rgba(224,216,185,0.55)"; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.restore();
    }
    return { tip, k: this.k };
  }

  dispose() {
    // WebGL-сцена общая на игру — не трогаем её
  }
}

/* ═════════════ превью 3D-судов (верфь, друзья, профиль) ═════════════ */

let sharedStage: VesselStage | null = null;
let sharedBroken = false;
const snaps = new Map<string, HTMLCanvasElement>();

/**
 * Статичный снимок 3D-судна для превью: одна общая WebGL-сцена на все карточки,
 * результат кэшируется по стилю. null — если WebGL недоступен (тогда 2D).
 */
export function boat3dSnapshot(style: BoatStyle, w = 480, h = 240): HTMLCanvasElement | null {
  if (typeof window === "undefined") return null;
  const key = `${style}:${w}x${h}`;
  const hit = snaps.get(key);
  if (hit) return hit;
  if (sharedBroken) return null;
  if (!sharedStage) {
    try {
      sharedStage = new VesselStage();
    } catch {
      sharedBroken = true;
      return null;
    }
  }
  const stage = sharedStage;
  stage.setPixelRatio(2);
  const spec = BOATS.find((b) => b.style === style);
  if (!spec) return null;
  const body = new VesselBody(spec);
  body.stroke = 0.7;
  body.rpm = 0.25;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const g0 = HULLS[style];
  const PXM = Math.min((w * 0.8) / g0.L, (h * 0.6) / (g0.T + g0.fb + 2.4));
  const f3: F = {
    t: 3.2,
    dt: 0.016,
    dpr: 1,
    PXM,
    sY: h * 0.68,
    night: 0,
    day: 1,
    golden: 0,
    fog: 0,
    windS: 2,
    w: {
      lights: 0,
      temp: 16,
      rain: 0,
      sunElev: 38,
      sunAz: 200,
      sunVis: 1,
      cover: 0.1,
      moonElev: -10,
      moonAz: 0,
      moonVis: 0,
      moonIllum: 0,
      daylight: 1,
      night: 0,
      palette: { skyMid: [122, 168, 210], seaNear: [38, 92, 116] },
    },
    ocean: { height: () => 0 },
    lane: { current: () => 0 },
    X2S: (xm: number) => w / 2 + xm * PXM,
  };
  let ok = false;
  try {
    ok = stage.draw(ctx, f3, { body }, { smoke: () => {}, bubble: () => {} });
  } catch {
    sharedBroken = true;
    return null;
  }
  if (!ok) return null;
  snaps.set(key, cv);
  return cv;
}
