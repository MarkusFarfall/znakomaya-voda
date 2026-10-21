import { TIME_SCALE, type Engine } from "../engine";
import { FISH_BY_ID } from "../fish";
import type { ActiveEvent, HotId } from "../types";
import { ART } from "./boats/art";
import { berthScale } from "./portTerrain";
import { drawBoat } from "./boat";
import { Boat3D } from "./boats3d/boat3d";
import { drawEventFx, EventFxBuffer, type FxCall, type FxScene } from "./eventFx";
import type { Frame } from "./frame";
import type { KitAtmo, PF } from "./portFrame";
import { PortKitScene, type FxLayer } from "./portKitScene";
import { KITS } from "./ports";
import { PrecipitationField } from "./precipitation";
import { clamp, glow, rgbHex, rng } from "./util";
import { drawBolt, drawIce, drawLeaves, drawRainbow, makeBolt, type Bolt } from "./weatherFx";

export type { Building, Hotspot } from "../types";
export const isFairDay = (d = new Date()) => d.getDay() === 0 || d.getDay() === 6;

/** Adapt the release's visual-only scene to the existing game clock and weather. */
export function portAtmosphere(e: Engine): KitAtmo {
  const a = e.atmosphere.state, p = a.palette;
  return {
    sunElev: a.sunElev, sunAz: a.sunAz, sunVis: a.sunVis,
    night: a.night, golden: a.golden, cover: a.cover, fog: a.fog,
    rain: a.rain, snow: a.snow, ice: a.ice, wind: a.wind, windDir: a.windDir,
    waves: a.waves, starVis: a.starVis, aurora: a.aurora,
    moonElev: a.moonElev, moonAz: a.moonAz, moonPhase: a.moonPhase,
    moonVis: a.moonVis, moonIllum: a.moonIllum,
    weather: e.weather, season: e.season, day: e.day, hour: e.hour,
    palette: {
      skyTop: rgbHex(p.skyTop), skyMid: rgbHex(p.skyMid), skyHor: rgbHex(p.skyHor),
      glow: rgbHex(p.glow), sun: rgbHex(p.sun), cloud: rgbHex(p.cloud),
      seaNear: rgbHex(p.seaNear), deep: rgbHex(p.deep), fog: rgbHex(p.fog),
    },
  };
}

/** Public interface used by Game stays unchanged; demo state never enters saves. */
export class PortScene {
  boat3dOn = false;
  precipEnabled = true;
  quality = 1;
  reflectionsEnabled = true;
  hover: HotId | null = null;
  private rain = new PrecipitationField("rain");
  private snowfall = new PrecipitationField("snow");
  private boat3d: Boat3D | null = null;
  private current: Engine | null = null;
  private readonly activeEventScratch: ActiveEvent[] = [];
  private readonly activeEventIds = new Set<string>();
  private fxBuffer = new EventFxBuffer();
  private fxCalls: FxCall[] = [];
  private rodTip: readonly [number, number] = [0, 0];
  private lightningBolt: Bolt = [];
  private boltKey = "";
  private scene = new PortKitScene(KITS, {
    playerBoat: (f, x, _boat, speed) => this.playerBoat(f, x, speed),
    layer: (name, f) => this.layer(name, f),
    weather: f => this.weather(f),
    lightning: f => this.lightning(f),
    ice: f => {
      const a = this.current?.atmosphere.state;
      if (a && a.ice > 0.02) drawIce(f.ctx, f.t, f.W, f.waveY, a.ice, a.wind * a.windDir * 26 * f.sc, f.sc, a.palette.seaNear);
    },
  });

  get hot() { return this.scene.hot; }

  render(ctx: CanvasRenderingContext2D, e: Engine, W: number, H: number, dt: number) {
    if (W <= 0 || H <= 0) return;
    this.current = e;
    const activeEvents = e.activeEventsInto(this.activeEventScratch);
    this.activeEventIds.clear();
    for (const event of activeEvents) this.activeEventIds.add(event.id);
    this.fxCalls = this.fxBuffer.build(e.eventDirector, e.s.minutes, TIME_SCALE);
    ctx.save();
    try {
      this.scene.render(ctx, {
        pid: e.port.id, A: portAtmosphere(e), boat: e.boat, hover: this.hover,
        fair: e.fairBonus > 1,
        // The real market uses a port-specific day offset and undiscovered names stay hidden.
        hotFish: e.hot.map(id => e.s.codex[id] ? FISH_BY_ID[id].name : "Неизвестный вид"),
        serviceHours: false, precipEnabled: this.precipEnabled,
        quality: clamp(Math.round(this.quality), 0, 2) as 0 | 1 | 2,
        reflectionsEnabled: this.reflectionsEnabled,
      }, W, H, dt);
    } finally {
      ctx.restore();
      this.current = null;
    }
  }

  private playerBoat(p: PF, x: number, speed: number) {
    const e = this.current;
    if (!e) return;
    const a = e.atmosphere.state;
    const f: Frame = {
      ctx: p.ctx, e, loc: e.loc, spot: e.spot, atmo: a, weather: e.weather,
      W: p.W, H: p.H, t: p.t, dt: p.dt, sc: berthScale(p.W, x, p.sc * 0.9, ART[e.boat.style].w * 28 * 1.08), sY: p.waterY + 4 * p.sc, hY: p.hY,
      night: p.night, day: a.day, golden: p.golden, cover: a.cover, fogK: a.fog,
      top: p.A.palette.skyTop, mid: p.A.palette.skyMid, hor: p.A.palette.skyHor,
      sunX: p.W * clamp((a.sunAz - 45) / 270, 0, 1), sunY: p.hY - Math.sin(a.sunElev * Math.PI / 180) * p.H * 0.42,
      sunElev: a.sunElev, sunVis: a.sunVis,
      moonX: p.W * clamp((a.moonAz - 45) / 270, 0, 1), moonY: p.hY - Math.sin(a.moonElev * Math.PI / 180) * p.H * 0.32,
      moonUp: a.moonElev > -1, moonVis: a.moonVis, wind: Math.min(1.5, a.wind / 18),
      amp: (1.4 + a.waves * 0.45) * p.sc, clarity: e.loc.clarity, quality: this.quality,
      cam: 0, K: 1, compact: p.W < 820 || p.H < 560, land: p.W >= p.H,
      topRes: 0, botRes: 0, depthPx: () => 0, waveY: p.waveY,
      activeEvents: this.activeEventScratch, activeEventIds: this.activeEventIds,
    };
    if (!this.boat3d && typeof window !== "undefined") this.boat3d = new Boat3D();
    this.boat3d?.setEnabled(this.boat3dOn);
    const r3 = this.boat3d?.draw(p.ctx, f, x, speed > 0 ? "helm" : "moored", speed, p.ctx.getTransform().a || 1) ?? null;
    this.rodTip = r3?.tip ?? [x + 100 * p.sc, p.waterY - 62 * p.sc];
    if (!r3 || r3.k < 0.99) {
      p.ctx.save();
      if (r3) { p.ctx.globalAlpha *= 1 - r3.k; p.ctx.translate(0, r3.k * 10); }
      this.rodTip = drawBoat(f, x, speed > 0 ? "helm" : "moored", speed);
      p.ctx.restore();
    }
  }

  private layer(name: FxLayer, f: PF) {
    const e = this.current;
    if (!e || !this.fxCalls.length) return;
    const a = e.atmosphere.state, dockX = f.W * KITS[e.port.id].layout.dock;
    const fx: FxScene = {
      c: f.ctx, t: f.t, W: f.W, H: f.H, s: f.sc, q: f.quality,
      horizon: f.hY, surface: f.waterY, seabed: f.H, visW: f.W, viewX0: 0, cam: 0,
      windPx: a.wind * a.windDir * 26 * f.sc, sAt: f.waveY,
      glow: (x, y, r, col, alpha) => glow(f.ctx, x, y, r, rgbHex(col), alpha),
      sun: { x: f.W * clamp((a.sunAz - 45) / 270, 0, 1), y: f.hY - Math.sin(a.sunElev * Math.PI / 180) * f.H * 0.42 },
      moon: { x: f.W * clamp((a.moonAz - 45) / 270, 0, 1), y: f.hY - Math.sin(a.moonElev * Math.PI / 180) * f.H * 0.32 },
      rocks: [], capeX: f.W * 0.78, capeTop: f.hY, rodTip: this.rodTip,
      mast: [dockX + 8 * f.sc, f.waterY - 45 * f.sc], lantern: [dockX, f.quayY - 42 * f.sc],
      boatX: dockX + 40 * f.sc, A: a, pal: a.palette,
    };
    drawEventFx(fx, name, this.fxCalls);
  }

  private weather(f: PF) {
    const a = this.current?.atmosphere.state;
    if (!a) return;
    const windPx = a.wind * a.windDir * 26 * f.sc;
    const view = { x0: 0, x1: f.W, top: -60, bottom: f.H, floor: () => f.H - 4,
      horizon: f.waterY + 20 * f.sc, wind: windPx, s: f.sc, q: f.quality, color: a.palette.cloud };
    const rain = { ...view, active: this.precipEnabled && a.rain > 0.001, intensity: this.precipEnabled ? a.rain : 0 };
    const snow = { ...view, active: this.precipEnabled && a.snow > 0.001, intensity: this.precipEnabled ? a.snow : 0 };
    this.rain.step(rain, f.dt); this.snowfall.step(snow, f.dt);
    if (this.precipEnabled) { this.rain.draw(f.ctx, rain); this.snowfall.draw(f.ctx, snow); }
    // Home kit already draws its local petals/leaves: don't duplicate that layer.
    if (this.current?.port.id !== "home") {
      if (a.leaves > 0.02) drawLeaves(f.ctx, f.t, 0, f.W, 0, f.H, windPx, a.leaves, "leaf", f.sc);
      if (a.petals > 0.02) drawLeaves(f.ctx, f.t, 0, f.W, 0, f.H, windPx * 0.6, a.petals, "petal", f.sc);
    }
    if (a.rainbow > 0.02 && a.sunElev > 0) {
      f.ctx.save(); f.ctx.beginPath(); f.ctx.rect(0, 0, f.W, f.hY); f.ctx.clip();
      f.ctx.globalCompositeOperation = "screen";
      const sunX = f.W * clamp((a.sunAz - 45) / 270, 0, 1);
      drawRainbow(f.ctx, f.W - sunX + f.W * 0.05, f.hY + f.H * 0.08, f.H * 0.4, a.rainbow * 0.68);
      f.ctx.restore();
    }
  }

  private lightning(f: PF) {
    const e = this.current;
    if (!e) return;
    const strike = e.lastLightningStrike;
    const key = `${strike?.seed}|${f.W}|${f.H}`;
    if (strike && key !== this.boltKey) {
      this.boltKey = key;
      const r = rng(strike.seed), x = f.W * strike.x;
      this.lightningBolt = makeBolt(x, 0, x + (r() - 0.5) * f.W * 0.12, f.hY, r);
    }
    if (e.lightning > 0.01) {
      f.ctx.save(); f.ctx.globalCompositeOperation = "screen";
      f.ctx.fillStyle = `rgba(230,235,255,${e.lightning * 0.24})`; f.ctx.fillRect(0, 0, f.W, f.H);
      f.ctx.restore();
      if (this.lightningBolt.length) drawBolt(f.ctx, this.lightningBolt, e.lightning, f.sc);
    }
  }
}
