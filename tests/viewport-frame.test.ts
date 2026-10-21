/**
 * Guard-тесты «кадр игрока»: ни один эффект события не имеет права рисовать
 * за пределами видимого окна. Раньше якоря считались в долях всей акватории
 * (7200 px), поэтому событие могло быть активным, но невидимым.
 *
 * Приём: один и тот же эффект рисуется в двух окнах, сдвинутых на DELTA.
 * Координата, которая сместилась вместе с окном, — это x; неподвижная — y.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { Atmosphere } from "../src/game/atmosphere";
import { FX_TABLE, type FxScene, type Layer } from "../src/game/render/eventFx";
import type { FxId, FxSpec, VisibleEvent } from "../src/game/events/types";

const LAYERS: Layer[] = ["sky", "horizon", "under", "surface", "front"];
const H = 720;
const VIEW_W = 1280;
const X0 = 2400;
const DELTA = 2800;
/** Габарит самого крупного эффекта: кит, водоворот, парус, падающая звезда. */
const PAD = 900;

function recorder() {
  const xs: number[] = [];
  let alpha = 1;
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, p: string) {
      if (p === "globalAlpha") return alpha;
      if (p === "canvas") return { width: VIEW_W, height: H };
      if (p === "createLinearGradient" || p === "createRadialGradient")
        return () => ({ addColorStop() {} });
      if (p === "measureText") return () => ({ width: 10 });
      if (p === "getTransform") return () => ({ a: 1, e: 0, f: 0 });
      return (...args: unknown[]) => {
        for (const n of args) if (typeof n === "number" && Number.isFinite(n)) xs.push(n);
      };
    },
    set(_t, p: string, v: unknown) {
      if (p === "globalAlpha") alpha = Number(v);
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, xs };
}

const atmo = new Atmosphere({ climate: "temperate", seed: 7 }).state;

function scene(ctx: CanvasRenderingContext2D, viewX0: number, t: number, glowX: number[] = []): FxScene {
  return {
    c: ctx, t, W: VIEW_W, H, s: 1, q: 2,
    horizon: 300, surface: 400, seabed: 900,
    visW: VIEW_W, viewX0, cam: 0, windPx: 12,
    sAt: () => 400,
    glow: (x, y) => { glowX.push(x, y); },
    sun: { x: viewX0 + 200, y: 120 },
    moon: { x: viewX0 + 900, y: 90 },
    rocks: [[viewX0 + 200, 380]] as [number, number][],
    capeX: viewX0 + VIEW_W * 0.82, capeTop: 300,
    rodTip: [viewX0 + 640, 380],
    mast: [viewX0 + 600, 360],
    lantern: [viewX0 + 590, 370],
    boatX: viewX0 + 600,
    A: atmo, pal: atmo.palette,
  };
}

function event(id: FxId, seed: number): VisibleEvent {
  // Полный набор полей VisibleEvent: иначе эффекты, читающие прогресс, дают NaN.
  return {
    uid: 1, id, phase: "active", omenAt: 0, start: 0, end: 600, seed,
    k: 1, omen: 0, p: 0.42, endsAt: 600, duration: 600,
  } as unknown as VisibleEvent;
}

interface Probe { x: number[]; y: number[] }

function probe(id: FxId, layer: Layer, t: number, seed = 424242): Probe | null {
  const draw = FX_TABLE[id][layer];
  if (!draw) return null;
  const a = recorder(), b = recorder();
  const spec: FxSpec = { id };
  draw(scene(a.ctx, X0, t, a.xs), { e: event(id, seed), spec, age: 3.2 });
  draw(scene(b.ctx, X0 + DELTA, t, b.xs), { e: event(id, seed), spec, age: 3.2 });
  if (!a.xs.length || a.xs.length !== b.xs.length) return null;
  const x: number[] = [], y: number[] = [];
  a.xs.forEach((va, i) => {
    const vb = b.xs[i];
    if (Math.abs(vb - va - DELTA) < 2) x.push(va);
    else y.push(va);
  });
  return { x, y };
}

test("event effects are anchored to the player viewport, not to the world width", () => {
  for (const id of Object.keys(FX_TABLE) as FxId[]) {
    for (const layer of LAYERS) {
      for (const t of [0.7, 3.1, 11.3, 27.5]) {
        const p = probe(id, layer, t);
        if (!p) continue;
        for (const v of p.x) {
          assert.ok(
            v >= X0 - PAD && v <= X0 + VIEW_W + PAD,
            `${id}/${layer} @t=${t}: x=${Math.round(v)} вне кадра [${X0 - PAD}, ${X0 + VIEW_W + PAD}]`,
          );
        }
        // Всё, что не сдвинулось вместе с окном, обязано быть ординатой.
        for (const v of p.y) {
          assert.ok(
            v >= -PAD && v <= H + PAD,
            `${id}/${layer} @t=${t}: «y»=${Math.round(v)} не похоже ни на ординату, ни на x в кадре`,
          );
        }
      }
    }
  }
});

test("movable effects appear inside the strict viewport at some point in their cycle", () => {
  const ids: FxId[] = ["dolphins", "orcas", "ghostship", "jellies", "deeplights", "wisps", "boil", "sails", "boat", "fallenstar"];
  for (const id of ids) {
    let seen = false;
    for (let seed = 1; seed <= 25 && !seen; seed++) {
      for (let t = 0; t < 30 && !seen; t += 0.9) {
        for (const layer of LAYERS) {
          const p = probe(id, layer, t, seed * 7919);
          if (!p) continue;
          if (p.x.some((v) => v >= X0 && v <= X0 + VIEW_W)) { seen = true; break; }
        }
      }
    }
    assert.ok(seen, `${id} никогда не попадает в кадр`);
  }
});
