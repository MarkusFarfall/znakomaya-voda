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
import { hasActiveEvent, type Frame } from "../frame";
import type { BoatStyle } from "../../types";
import { BOATS } from "../../world";
import type { F } from "./frame3";
import type { SeaSim } from "./hull3";
import { HULLS, VesselBody } from "./hull3";
import { VesselStage, type StageHooks } from "./stage";
import { clamp, damp } from "./util3";
import { currentAt } from "../../waterPhysics";
import { navigationSpeed } from "../../navigation";

const NOOP_STAGE_HOOKS: StageHooks = { smoke: () => {}, bubble: () => {} };

export class Boat3D {
  private body: VesselBody | null = null;
  private on = false;
  /** текущая доля 3D: 0 — только 2D, 1 — только 3D */
  k = 0;
  private frameSource: Frame | null = null;
  private frameBx = 0;
  private framePXM = 1;
  private frameHeading = 1;
  private readonly oceanHeight = (xMeters: number) => {
    const f = this.frameSource;
    return f ? (f.sY - f.waveY(this.frameBx + xMeters * this.framePXM)) / this.framePXM : 0;
  };
  private readonly currentAtFrame = (xMeters: number) => {
    const f = this.frameSource;
    if (!f) return 0;
    const atmo = f.atmo;
    return this.frameHeading * currentAt(f.spot.feature, this.frameBx + xMeters * this.framePXM * this.frameHeading, f.t, f.spot.seed, atmo.wind, atmo.windDir);
  };
  private readonly frameX2S = (xMeters: number) => this.frameBx + xMeters * this.framePXM;
  private readonly frame3: F = {
    t: 0, dt: 0, dpr: 1, PXM: 1, sY: 0, night: 0, day: 0, golden: 0, fog: 0, windS: 0,
    w: {
      lights: 0, temp: 0, rain: 0, sunElev: 0, sunAz: 0, sunVis: 0, cover: 0,
      moonElev: 0, moonAz: 0, moonVis: 0, moonIllum: 0, daylight: 0, night: 0,
      palette: { skyMid: [0, 0, 0], seaNear: [0, 0, 0] },
    },
    ocean: { height: this.oceanHeight },
    lane: { current: this.currentAtFrame },
    X2S: this.frameX2S,
  };
  private readonly sim: SeaSim = { body: null as unknown as VesselBody };
  private readonly rodPose = { angle: 0, bend: 0 };
  private readonly result = { tip: [0, 0] as [number, number], k: 0 };

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
    if (stage.contextLost) return null;
    stage.setQuality(f.quality);
    stage.setPixelRatio(Math.abs(dpr));
    const spec = f.e.boat;
    if (!this.body || this.body.spec.id !== spec.id) this.body = new VesselBody(spec);
    const b = this.body;
    const g = HULLS[spec.style];
    const PXM = 28 * f.sc;
    const localHeading = f.localBoat && Math.cos(f.e.navigation.yaw) < 0 ? -1 : 1;

    /* ───── гидродинамическая посадка: центр корпуса следует среднему гребню под килем ───── */
    const wl = f.waveY(bx);
    const sternX = bx - g.L * 0.42 * PXM;
    const bowX = bx + g.L * 0.42 * PXM;
    const sternWave = f.waveY(sternX);
    const bowWave = f.waveY(bowX);
    const meanWave = (sternWave + 2 * wl + bowWave) / 4;
    const targetHeave = (f.sY - meanWave) / PXM;
    const oldHeave = b.y;
    const oldHeaveVelocity = b.vy;
    b.x = 0;
    b.y = damp(b.y, targetHeave, 14 - spec.stability * 4.2, dt);
    b.vy = clamp((b.y - oldHeave) / Math.max(dt, 1 / 240), -2.4, 2.4);
    b.heaveAcc = clamp((b.vy - oldHeaveVelocity) / Math.max(dt, 1 / 240), -4, 4);
    const slope = (bowWave - sternWave) / Math.max(1, 2 * g.L * 0.42 * PXM);
    const calmSea = hasActiveEvent(f, "calm");
    const seaLoad = clamp(f.atmo.waves * f.loc.waveMult * (f.spot.swell ?? 1) * (calmSea ? 0.34 : 1), 0, 4);
    const speedTrim = pose === "helm" ? -Math.min(0.08, speed01 * speed01 * 0.08) : 0;
    const targetPitch = clamp(-Math.atan(slope) * (0.8 + 0.55 * (1 - spec.stability)) + speedTrim, -0.26, 0.26);
    b.theta = damp(b.theta, targetPitch, 7 + spec.stability * 2, dt);
    const relativeVelocity = f.localBoat ? f.e.navigation.velocity * localHeading : speed01;
    const speedSign = relativeVelocity < -0.05 ? -1 : 1;
    const modelSpeed = pose === "moored" ? 0 : speed01 * g.vMax * 0.75 * speedSign;
    const modelYawRate = f.localBoat ? clamp(f.e.navigation.yawRate * localHeading, -4, 4) : 0;
    const localWind = f.atmo.wind * f.atmo.windDir * localHeading;
    const windHeel = clamp(localWind / 34, -0.3, 0.3) * (0.06 + 0.12 * (1 - spec.stability));
    const beamRoll = Math.sin(f.t * 1.05 + bx * 0.0021 + f.atmo.windDir) * seaLoad * 0.014 * (1.15 - spec.stability);
    const sailHeel = g.sail > 0 ? clamp(localWind / 20, -0.35, 0.35) * b.sailK * 0.14 : 0;
    const turnHeel = clamp(-Math.atan((modelSpeed * modelYawRate) / 9.81) * 0.65, -0.11, 0.11);
    b.roll = damp(b.roll, clamp(windHeel + beamRoll + sailHeel + turnHeel, -0.2, 0.2), 4.5, dt);
    const rowing = (spec.style === "row" || spec.style === "kayak") && pose === "helm" && speed01 > .015;
    b.stroke += (rowing ? 1.2 + 1.5 * speed01 : 0) * dt;
    b.throttle = pose === "helm" ? speed01 : 0;
    const sailWind = clamp(f.atmo.wind / 11, 0, 1);
    const sailTarget = g.sail > 0 && pose === "helm" ? clamp((0.18 + sailWind * 0.82) * (0.35 + speed01 * 0.65), 0, 1) : 0;
    b.sailK = damp(b.sailK, sailTarget, 2.8, dt);
    b.reef = clamp(1 - Math.max(0, f.atmo.wind - 12) * 0.025, 0.48, 1);
    b.vw = modelSpeed;
    b.rpm = g.motor !== "none" && pose === "helm" && speed01 > 0.015 ? 0.12 + 0.88 * speed01 : 0;
    b.yawRate = modelYawRate;
    b.anchored = pose === "moored";
    b.reversing = !!f.localBoat && relativeVelocity < -0.1;
    b.ax = f.localBoat ? clamp(f.e.navigation.acceleration * (g.vMax / Math.max(1, navigationSpeed(f.e.boat))) * localHeading, -3.5, 3.5) : 0;
    const motionDt = clamp(dt, 0, 1 / 15);
    if (motionDt > 0) {
      for (const pend of b.pend) {
        const gravity = clamp(9.81 + b.heaveAcc, 6, 14);
        const angularAccel = -(gravity / pend.len) * Math.sin(pend.phi) - (b.ax / pend.len) * Math.cos(pend.phi) - 0.85 * pend.om;
        pend.om = clamp(pend.om + angularAccel * motionDt, -3.5, 3.5);
        pend.phi = clamp(pend.phi + pend.om * motionDt, -0.85, 0.85);
      }
    }
    b.psi = 0;
    b.lean = clamp(-speed01 * 0.12 - (f.localBoat ? f.e.navigation.acceleration * f.e.navigation.heading * .001 : 0) - b.roll * 0.35, -0.24, 0.24);

    /* ───── переиспользуемый кадр для 3D-сцены ───── */
    const a = f.atmo;
    this.frameSource = f;
    this.frameBx = bx;
    this.framePXM = PXM;
    this.frameHeading = localHeading;
    const f3 = this.frame3;
    f3.t = f.t;
    f3.dt = dt;
    f3.dpr = clamp(dpr, 1, 2);
    f3.PXM = PXM;
    f3.sY = f.sY;
    f3.night = f.night;
    f3.day = f.day;
    f3.golden = f.golden;
    f3.fog = f.fogK;
    f3.windS = a.wind * a.windDir * localHeading;
    const w = f3.w;
    w.lights = a.lights;
    w.temp = a.temp;
    w.rain = a.rain;
    w.sunElev = a.sunElev;
    w.sunAz = a.sunAz;
    w.sunVis = a.sunVis;
    w.cover = a.cover;
    w.moonElev = a.moonElev;
    w.moonAz = a.moonAz;
    w.moonVis = a.moonVis;
    w.moonIllum = a.moonIllum;
    w.daylight = a.daylight;
    w.night = a.night;
    w.palette.skyMid = a.palette.skyMid;
    w.palette.seaNear = a.palette.seaNear;
    this.sim.body = b;

    ctx.save();
    ctx.globalAlpha *= clamp(this.k, 0, 1);
    ctx.translate(0, -(1 - this.k) * 8);
    let ok = false;
    try {
      ok = stage.draw(ctx, f3, this.sim, NOOP_STAGE_HOOKS);
    } catch {
      if (!stage.contextLost) sharedBroken = true;
    }
    ctx.restore();
    if (!ok) {
      if (!stage.contextLost) sharedBroken = true;
      return null;
    }
    const handHeld = spec.style === "row" || spec.style === "kayak";
    const gripX = bx + PXM * (handHeld ? -0.45 : 0.35);
    const gripY = wl - PXM * (handHeld ? 0.72 : 0.45);
    const { angle, bend } = fishingRodPose(f.e, f.t, this.rodPose);
    const length = PXM * 2.6;
    const tip = this.result.tip;
    tip[0] = gripX + Math.cos(angle) * length * (1 - bend * 0.14);
    tip[1] = gripY + Math.sin(angle) * length * (1 - bend * 0.28) + bend * length * 0.38;
    if (pose === "fish") {
      ctx.save(); ctx.globalAlpha *= this.k;
      if (!handHeld) {
        ctx.strokeStyle = "#777a70"; ctx.lineWidth = Math.max(1, PXM * 0.07);
        ctx.beginPath(); ctx.moveTo(gripX, wl - PXM * 0.05); ctx.lineTo(gripX, gripY); ctx.stroke();
      }
      ctx.strokeStyle = "#42372b"; ctx.lineWidth = Math.max(1, PXM * 0.055); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(gripX, gripY);
      ctx.quadraticCurveTo(gripX + Math.cos(angle) * length * 0.62, gripY + Math.sin(angle) * length * 0.62, tip[0], tip[1]);
      ctx.stroke();
      ctx.strokeStyle = "rgba(224,216,185,0.55)"; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.restore();
    }
    this.result.k = this.k;
    return this.result;
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
  stage.setQuality(2);
  stage.setPixelRatio(2);
  const spec = BOATS.find((b) => b.style === style);
  if (!spec) return null;
  const body = new VesselBody(spec);
  body.stroke = 0.7;
  body.rpm = 0.25;
  body.sailK = HULLS[style].sail > 0 ? 0.8 : 0;
  body.throttle = 0.25;
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
