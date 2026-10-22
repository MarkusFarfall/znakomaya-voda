/**
 * Guard-тесты «кадр игрока»: эффекты события живут рядом с лодкой и не рисуют
 * за пределами её окрестности. Раньше якоря считались в долях всей акватории
 * (7200 px), поэтому событие могло быть активным, но невидимым.
 *
 * Приём: один и тот же эффект рисуется в двух окнах, сдвинутых на DELTA.
 * Координата, которая сместилась вместе с окном (или лежит в окрестности лодки
 * после переноса по кругу), — это x; неподвижная — y.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { Atmosphere } from "../src/game/atmosphere";
import { EVENT_FX_MOTION_SCALE, FX_TABLE, type FxScene, type Layer } from "../src/game/render/eventFx";
import type { FxId, FxSpec, VisibleEvent } from "../src/game/events/types";
import { ctxFromAtmosphere } from "../src/game/events";

const LAYERS: Layer[] = ["sky", "horizon", "under", "surface", "front"];
const H = 720;
const VIEW_W = 1280;
const X0 = 2400;
const DELTA = 2800;
/** Габарит самого крупного эффекта: кит, водоворот, парус, падающая звезда. */
const PAD = 900;
/**
 * Окрестность лодки, в которой обязаны жить эффекты. События привязаны к
 * мировым координатам и переносятся по кругу вокруг лодки, поэтому «сдвиг на
 * DELTA» ломается на кадре переноса — проверяем близость к центру кадра.
 */
const NEAR = VIEW_W * 1.4;
const VIEW_MID = X0 + VIEW_W / 2;

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

interface Probe { x: number[]; y: number[]; raw: number[] }

/** Уникальный uid на каждый зонд: якорь события кешируется по uid. */
let probeUid = 1;
function probe(id: FxId, layer: Layer, t: number, seed = 424242): Probe | null {
  const draw = FX_TABLE[id][layer];
  if (!draw) return null;
  const a = recorder(), b = recorder();
  const spec: FxSpec = { id };
  const ev = { ...event(id, seed), uid: ++probeUid } as VisibleEvent;
  draw(scene(a.ctx, X0, t, a.xs), { e: ev, spec, age: 3.2 });
  draw(scene(b.ctx, X0 + DELTA, t, b.xs), { e: ev, spec, age: 3.2 });
  if (!a.xs.length || a.xs.length !== b.xs.length) return null;
  const x: number[] = [], y: number[] = [];
  a.xs.forEach((va, i) => {
    const vb = b.xs[i];
    const near =
      Math.abs(va - VIEW_MID) <= NEAR || Math.abs(vb - (VIEW_MID + DELTA)) <= NEAR;
    if (Math.abs(vb - va - DELTA) < 2 || near) x.push(va);
    else y.push(va);
  });
  return { x, y, raw: a.xs };
}

/**
 * События привязаны к воде, а не к камере.
 *
 * Раньше фаза считалась от лодки (`boatX + wrap(...)`) — эффект стоял на месте
 * относительно экрана и казался размазанным по всей акватории. Теперь мировой
 * якорь фиксируется при первом кадре события: при сдвиге окна координата
 * остаётся той же. Эффекты, прикреплённые к лодке (поплавок, снасть), едут
 * вместе с ней — это тоже допустимо, но не для фоновых явлений.
 */
test("background events keep their world anchor instead of riding the camera", () => {
  const anchored: FxId[] = [
    "dolphins", "orcas", "whale", "boil", "jumpers", "flyingfish", "sails",
    "petrels", "current", "bioglow", "jellies", "eels", "ghostship", "wisps",
    "seals", "fins", "turtle", "deeplights", "squid", "spawn",
  ];
  for (const id of anchored) {
    for (const layer of LAYERS) {
      if (!FX_TABLE[id]?.[layer]) continue;
      for (const t of [0.4, 3.1, 11.3]) {
        const draw = FX_TABLE[id][layer]!;
        const spec: FxSpec = { id };
        const a = recorder(), b = recorder();
        const ev = { ...event(id, 424242), uid: 900000 + probeUid++ } as VisibleEvent;
        draw(scene(a.ctx, X0, t, a.xs), { e: ev, spec, age: 3.2 });
        draw(scene(b.ctx, X0 + DELTA, t, b.xs), { e: ev, spec, age: 3.2 });
        if (!a.xs.length || a.xs.length !== b.xs.length) continue;
        let fixed = 0;
        a.xs.forEach((va, i) => {
          const vb = b.xs[i];
          const worldFixed = Math.abs(vb - va) < 1.5;
          const ridesCamera = Math.abs(vb - va - DELTA) < 1.5;
          assert.ok(
            worldFixed || ridesCamera,
            `${id}/${layer} @t=${t}: x=${Math.round(va)} не привязан ни к воде, ни к камере`,
          );
          if (worldFixed) fixed++;
        });
        assert.ok(
          fixed >= a.xs.length * 0.75,
          `${id}/${layer} @t=${t}: ${fixed} из ${a.xs.length} координат привязаны к воде — событие едет вместе с камерой`,
        );
      }
    }
  }
});

test("a fresh event starts inside the player's viewport", () => {
  const ids: FxId[] = ["dolphins", "orcas", "whale", "ghostship", "jellies", "deeplights", "wisps", "boil", "sails", "boat", "fallenstar", "current"];
  for (const id of ids) {
    let seen = false;
    for (let seed = 1; seed <= 25 && !seen; seed++) {
      for (const layer of LAYERS) {
        if (!FX_TABLE[id]?.[layer]) continue;
        const draw = FX_TABLE[id][layer]!;
        const spec: FxSpec = { id };
        const r = recorder();
        const ev = { ...event(id, seed * 7919), uid: 800000 + seed } as VisibleEvent;
        draw(scene(r.ctx, X0, 0.35, r.xs), { e: ev, spec, age: 0.5 });
        if (r.xs.some((v) => v >= X0 - 40 && v <= X0 + VIEW_W + 40)) seen = true;
      }
    }
    assert.ok(seen, `${id} не появляется в кадре игрока`);
  }
});

/**
 * Эффект не «размазан по всей акватории»: при рождении он занимает не больше
 * половины кадра по ширине — локальное пятно воды, а не вся видимая вода.
 */
test("a fresh event is a local patch of water, not the whole aquatory", () => {
  const ids: FxId[] = ["jellies", "bioglow", "current", "petrels", "sails", "wisps", "eels"];
  for (const id of ids) {
    for (const layer of LAYERS) {
      const p = probe(id, layer, 0.35);
      if (!p || p.x.length < 2) continue;
      const span = Math.max(...p.x) - Math.min(...p.x);
      assert.ok(
        span <= VIEW_W * 0.5,
        `${id}/${layer}: событие растянуто на ${Math.round(span)} px при кадре ${VIEW_W} — это «на всю воду сразу»`,
      );
    }
  }
});

test("floating event FX render after the opaque sea-band pass", () => {
  const waterline: FxId[] = [
    "boil", "birds", "dolphins", "whale", "orcas", "fins", "seals",
    "bioglow", "tint", "waterspout", "ghostship", "flyingfish", "jumpers",
    "petrels", "current", "wisps",
  ];
  for (const id of waterline) {
    assert.ok(FX_TABLE[id].surface, `${id} must draw above the sea band`);
  }
});

test("event context carries the player's actual spot, not the whole aquatory", () => {
  const atm = new Atmosphere({ climate: "ocean", seed: 11 });
  // Акватория «Бездна» целиком глубокая, но контекст обязан отражать точку под лодкой.
  const ctx = ctxFromAtmosphere(atm, { loc: "abyss", deep: true, feature: "sandbar", localDepth: 9 });
  assert.equal(ctx.loc, "abyss");
  assert.equal(ctx.deep, true);
  assert.equal(ctx.feature, "sandbar");
  assert.equal(ctx.localDepth, 9);
  // Без географических данных контекст не врёт: пусто, а не «где-то в акватории».
  const bare = ctxFromAtmosphere(atm, { loc: "bay" });
  assert.equal(bare.feature, null);
  assert.equal(bare.localDepth, 0);
});

test("background effects drift at a believable pace instead of racing across the viewport", () => {
  // Дрейф элементов события идёт по «сценическим» часам (`t` уже умножен на
  // EVENT_FX_MOTION_SCALE`). Проверяем именно фоновые явления: парусники,
  // буревестники, течение, свечение и призрачный корабль. Прыжки рыб и плавники
  // сюда не входят — у них своя, живая анимация.
  const ids: FxId[] = ["sails", "petrels", "current", "bioglow", "ghostship", "waterspout"];
  // Порог — уже в «экранных» px/с, то есть с учётом EVENT_FX_MOTION_SCALE.
  const MAX_MEDIAN = 26;
  const MAX_P95 = 42;
  for (const id of ids) {
    for (const layer of LAYERS) {
      const draw = FX_TABLE[id]?.[layer];
      if (!draw) continue;
      const spec: FxSpec = { id };
      const read = (t: number) => {
        const r = recorder();
        draw(scene(r.ctx, X0, t * EVENT_FX_MOTION_SCALE), { e: event(id, 424242), spec, age: 3.2 });
        return r.xs.filter((v) => v > X0 - PAD && v < X0 + VIEW_W + PAD);
      };
      const a = read(5);
      const b = read(6);
      if (!a.length || a.length !== b.length) continue;
      const d: number[] = [];
      for (let i = 0; i < a.length; i++) {
        const dd = Math.abs(b[i] - a[i]) / EVENT_FX_MOTION_SCALE;
        // перескок через wrap — не скорость, а телепорт на другой край
        if (dd < VIEW_W / 2) d.push(dd);
      }
      if (d.length < 4) continue;
      d.sort((x, y) => x - y);
      const med = d[Math.floor(d.length / 2)] * EVENT_FX_MOTION_SCALE;
      const p95 = d[Math.floor(d.length * 0.95)] * EVENT_FX_MOTION_SCALE;
      assert.ok(
        med <= MAX_MEDIAN && p95 <= MAX_P95,
        `${id}/${layer}: ${med.toFixed(0)} px/с по медиане, ${p95.toFixed(0)} px/с по p95`,
      );
    }
  }
});
