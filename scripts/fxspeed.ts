/**
 * Диагностика скорости фоновых эффектов: для каждого эффекта/слоя считаем
 * смещение элементов за 1 секунду «сценического» времени (t уже умножен на
 * EVENT_FX_MOTION_SCALE), то есть ровно то, что видит игрок на кадре 1280 px.
 */
import { Atmosphere } from "../src/game/atmosphere";
import { EVENT_FX_MOTION_SCALE, FX_TABLE, type FxScene, type Layer } from "../src/game/render/eventFx";
import type { FxId, FxSpec, VisibleEvent } from "../src/game/events/types";

const LAYERS: Layer[] = ["sky", "horizon", "under", "surface", "front"];
const W = 1280, H = 720, X0 = 2400;

function recorder() {
  const xs: number[] = [];
  let alpha = 1;
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, p: string) {
      if (p === "globalAlpha") return alpha;
      if (p === "canvas") return { width: W, height: H };
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop() {} });
      if (p === "measureText") return () => ({ width: 10 });
      if (p === "getTransform") return () => ({ a: 1, e: 0, f: 0 });
      return (...a: unknown[]) => { for (const n of a) if (typeof n === "number" && Number.isFinite(n)) xs.push(n); };
    },
    set(_t, p: string, v: unknown) { if (p === "globalAlpha") alpha = Number(v); return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, xs };
}

const atmo = new Atmosphere({ climate: "temperate", seed: 7 }).state;
function scene(ctx: CanvasRenderingContext2D, t: number): FxScene {
  return {
    c: ctx, t, W, H, s: 1, q: 2, horizon: 300, surface: 400, seabed: 900,
    visW: W, viewX0: X0, cam: 0, windPx: 12, sAt: () => 400,
    glow: () => {}, sun: { x: X0 + 200, y: 120 }, moon: { x: X0 + 900, y: 90 },
    rocks: [], capeX: X0 + W * 0.82, capeTop: 300,
    rodTip: [X0 + 640, 380], mast: [X0 + 600, 360], lantern: [X0 + 590, 370],
    boatX: X0 + 600, A: atmo, pal: atmo.palette,
  };
}
const ev = (id: FxId): VisibleEvent => ({
  uid: 1, id, phase: "active", omenAt: 0, start: 0, end: 600, seed: 424242,
  k: 1, omen: 0, p: 0.42, endsAt: 600, duration: 600,
} as unknown as VisibleEvent);

const rows: string[] = [];
for (const id of Object.keys(FX_TABLE) as FxId[]) {
  for (const layer of LAYERS) {
    const draw = FX_TABLE[id]?.[layer];
    if (!draw) continue;
    const spec: FxSpec = { id };
    const read = (t: number) => {
      const r = recorder();
      draw(scene(r.ctx, t * EVENT_FX_MOTION_SCALE), { e: ev(id), spec, age: 3.2 });
      return r.xs.filter((v) => v > X0 - 900 && v < X0 + W + 900);
    };
    const a = read(5), b = read(6);
    if (!a.length || a.length !== b.length) continue;
    const d: number[] = [];
    for (let i = 0; i < a.length; i++) {
      const dd = Math.abs(b[i] - a[i]) / EVENT_FX_MOTION_SCALE;
      if (dd < W / 2) d.push(dd);
    }
    if (d.length < 4) continue;
    d.sort((x, y) => x - y);
    const med = d[Math.floor(d.length / 2)];
    const p95 = d[Math.floor(d.length * 0.95)];
    if (med > 12 || p95 > 40) rows.push(`${id}/${layer}: медиана ${med.toFixed(0)} px/с, p95 ${p95.toFixed(0)} px/с`);
  }
}
console.log(rows.length ? rows.join("\n") : "все эффекты медленнее 12 px/с по медиане");
