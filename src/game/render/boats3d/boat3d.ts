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
import type { F } from "./frame3";
import type { SeaSim } from "./hull3";
import { HULLS, VesselBody } from "./hull3";
import { VesselStage } from "./stage";
import { clamp, damp } from "./util3";

export class Boat3D {
  private stage: VesselStage | null = null;
  private broken = false;
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
  ): { tip: [number, number]; k: number } | null {
    const dt = f.dt;
    this.k = damp(this.k, this.on && !this.broken ? 1 : 0, 7, dt);
    if (this.broken || (this.k < 0.015 && !this.on)) return null;
    if (!this.stage) {
      try {
        this.stage = new VesselStage();
      } catch {
        this.broken = true;
        return null;
      }
    }
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
    const rowing = spec.style === "row" && pose === "helm";
    b.stroke += (rowing ? 1.2 + 1.5 * speed01 : 0) * dt;
    b.vw = pose === "moored" ? 0 : speed01 * g.vMax * 0.75;
    b.rpm = g.motor !== "none" && pose !== "moored" ? 0.2 + 0.8 * speed01 : 0;
    b.psi = 0;
    b.lean = clamp(-speed01 * 0.12, -0.2, 0.2);

    /* ───── кадр для 3D-сцены ───── */
    const a = f.atmo;
    const f3: F = {
      t: f.t,
      dt,
      dpr: 1,
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
      ok = this.stage.draw(ctx, f3, sim, { smoke: () => {}, bubble: () => {} });
    } catch {
      this.broken = true;
    }
    ctx.restore();
    if (!ok) {
      this.broken = true;
      return null;
    }
    // носок удочки приблизительно там же, где в 2D-позе рыбака
    const tip: [number, number] = [bx + PXM * 0.55, wl - PXM * 1.35];
    return { tip, k: this.k };
  }

  dispose() {
    this.stage?.dispose();
    this.stage = null;
  }
}
