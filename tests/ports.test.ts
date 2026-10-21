import "./path2d-polyfill";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Engine } from "../src/game/engine";
import type { Building, PortId, WeatherId } from "../src/game/types";
import { PORTS, spotsOf } from "../src/game/world";
import { portAtmosphere } from "../src/game/render/port";
import { PortKitScene, eventsAt, isOpen, type SceneState } from "../src/game/render/portKitScene";
import { KITS } from "../src/game/render/ports";

/** Strict geometry/state recorder, no DOM, native bindings or GPU needed in CI. */
function canvas(W: number, H: number, dpr = 1) {
  const texts: string[] = [], saved: Record<string, unknown>[] = [];
  let state: Record<string, unknown> = { globalAlpha: 1, globalCompositeOperation: "source-over", lineWidth: 1 };
  let calls = 0;
  const geometry = new Set(["beginPath", "closePath", "moveTo", "lineTo", "bezierCurveTo", "quadraticCurveTo", "arc", "arcTo", "ellipse", "rect", "roundRect", "fillRect", "strokeRect", "clearRect", "fill", "stroke", "clip", "translate", "rotate", "scale", "transform", "setTransform", "resetTransform", "setLineDash", "drawImage", "fillText", "strokeText"]);
  const finite = (name: string, args: unknown[]) => {
    for (const arg of args.flat()) if (typeof arg === "number") assert.ok(Number.isFinite(arg), `${name}: ${arg}`);
  };
  const gradient = (...args: unknown[]) => { finite("gradient", args); return { addColorStop(offset: number) { assert.ok(offset >= 0 && offset <= 1); } }; };
  const target: Record<string, unknown> = {
    canvas: { width: W * dpr, height: H * dpr },
    save: () => { saved.push({ ...state }); },
    restore: () => { assert.ok(saved.length, "unbalanced restore"); state = saved.pop()!; },
    getTransform: () => ({ a: dpr, b: 0, c: 0, d: dpr, e: 0, f: 0 }),
    createLinearGradient: gradient, createRadialGradient: gradient,
    measureText: (text: string) => ({ width: text.length * 5 }),
  };
  const ctx = new Proxy(target, {
    get: (_, key: string) => {
      if (key in target) return target[key];
      if (geometry.has(key)) return (...args: unknown[]) => {
        calls++; finite(key, args);
        if (key === "arc") assert.ok(Number(args[2]) >= 0, "negative arc radius");
        if (key === "ellipse") assert.ok(Number(args[2]) >= 0 && Number(args[3]) >= 0, "negative ellipse radius");
        if (key === "fillText") texts.push(String(args[0]));
      };
      if (key in state) return state[key];
      throw new Error(`Unexpected canvas property ${key}`);
    },
    set: (_, key: string, value) => { if (typeof value === "number") assert.ok(Number.isFinite(value), key); state[key] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts, count: () => calls, balanced: () => assert.equal(saved.length, 0) };
}
function state(pid: PortId, hour = 13, weather: WeatherId = "clear"): SceneState {
  const e = new Engine(), port = PORTS.find(p => p.id === pid)!;
  e.s.atPort = true; e.s.port = pid; e.s.location = port.serves[0];
  e.s.spot = spotsOf(e.s.location)[0].id; e.s.minutes = hour * 60; e.s.weather = weather;
  e.syncAtmosphere(0);
  const A = portAtmosphere(e);
  A.hour = hour; A.weather = weather; A.night = hour >= 20 || hour < 6 ? 1 : 0;
  A.rain = weather === "rain" || weather === "storm" ? 1 : 0;
  A.snow = weather === "snow" ? 1 : 0;
  A.waves = weather === "storm" ? 3 : 0.4;
  A.fog = weather === "fog" ? 0.85 : 0;
  return { pid, A, boat: e.boat, hover: null, fair: true, hotFish: ["Тестовый улов"], quality: 2 };
}

for (const pid of Object.keys(KITS) as PortId[]) test(`${pid}: finite geometry and five hotspots across viewports, hours and weather`, () => {
  for (const [W, H] of [[360, 640], [390, 844], [844, 390], [1440, 900]]) {
    for (const hour of [6, 13, 19, 23]) for (const weather of ["clear", "rain", "snow", "storm"] as WeatherId[]) {
      const c = canvas(W, H, 2), scene = new PortKitScene(KITS), st = state(pid, hour, weather);
      st.A.season = weather === "snow" ? 3 : 1;
      scene.render(c.ctx, st, W, H, 1 / 60);
      assert.deepEqual(scene.hot.map(h => h.id).sort(), ["dock", "market", "shipyard", "shop", "tavern"]);
      assert.ok(scene.hot.every(h => Number.isFinite(h.y) && h.x >= 0 && h.x <= W));
      assert.ok(c.texts.includes("спрос ×1,8"));
      assert.ok(!c.texts.includes("×2 цена"));
      c.balanced();
    }
  }
});

test("all scheduled scenes render at their active midpoint", () => {
  for (const pid of Object.keys(KITS) as PortId[]) for (const event of KITS[pid].events ?? []) {
    const st = state(pid, ((event.from + event.to) / 2) % 24);
    st.A.season = event.seasons?.[0] ?? 0;
    const c = canvas(1024, 640), scene = new PortKitScene(KITS);
    scene.render(c.ctx, st, 1024, 640, 1 / 60);
    c.balanced(); assert.equal(scene.hot.length, 5);
  }
});

test("release does not overwrite port economy, availability, positions or identity", () => {
  const baseline = JSON.parse(readFileSync(new URL("./fixtures/ports-before-Ysys.json", import.meta.url), "utf8")) as Record<string, unknown>[];
  assert.deepEqual(PORTS.map(p => Object.fromEntries(Object.keys(baseline[0]).map(k => [k, p[k as keyof typeof p]]))), baseline);
  assert.deepEqual(Object.keys(KITS).sort(), PORTS.map(p => p.id).sort());
  for (const p of PORTS) {
    assert.ok(p.tagline && p.ambience && p.dish && p.landmarks?.length && p.rumours?.length);
    for (const b of ["market", "shop", "shipyard", "tavern"] as Building[]) assert.ok(p.buildings?.[b].keeper.line);
  }
});

test("kit renderer randomness cannot consume gameplay RNG or mutate scene input", (t) => {
  const st = state("nordhavn", 13), before = JSON.stringify(st);
  const c = canvas(1024, 640), scene = new PortKitScene(KITS);
  t.mock.method(Math, "random", () => { throw new Error("gameplay RNG was used by port artwork"); });
  for (let i = 0; i < 10; i++) scene.render(c.ctx, st, 1024, 640, 1 / 60);
  assert.equal(JSON.stringify(st), before); c.balanced();
});

test("default service access stays open at night; schedules support midnight correctly", () => {
  const st = state("nordhavn", 3), c = canvas(1024, 640);
  let checked = false;
  const scene = new PortKitScene(KITS, { layer: (name, f) => {
    if (name !== "sky") return;
    for (const b of ["market", "shop", "shipyard", "tavern"] as Building[]) assert.equal(f.open(b), true);
    checked = true;
  } });
  scene.render(c.ctx, st, 1024, 640, 1 / 60); assert.ok(checked);
  assert.equal(isOpen(KITS.nordhavn, "tavern", 0.5), true);
  assert.equal(isOpen(KITS.nordhavn, "tavern", 1.5), false);
  const kit = { ...KITS.home, events: [{ id: "late", label: "Late", from: 22, to: 26, seasons: [1 as const] }] };
  assert.equal(eventsAt(kit, 0, 1).late, 0.5);
  assert.deepEqual(eventsAt(kit, 0, 3), {});
});

test("low quality removes duplicate reflection draws, not interactive buildings", () => {
  const low = canvas(1440, 900), high = canvas(1440, 900), st = state("home");
  new PortKitScene(KITS).render(low.ctx, { ...st, quality: 0 }, 1440, 900, 1 / 60);
  const scene = new PortKitScene(KITS);
  scene.render(high.ctx, { ...st, quality: 2 }, 1440, 900, 1 / 60);
  assert.ok(low.count() < high.count() * 0.9); assert.equal(scene.hot.length, 5);
  low.balanced(); high.balanced();
});

test("wind reversal integrates drift rather than teleporting foreground particles", () => {
  const c = canvas(1024, 640), st = state("home");
  const phases: number[] = [];
  const scene = new PortKitScene(KITS, { layer: (name, f) => { if (name === "sky") phases.push(f.windTravel); } });
  st.A.windDir = 1;
  for (let i = 0; i < 10; i++) scene.render(c.ctx, st, 1024, 640, 0.1);
  st.A.windDir = -1;
  scene.render(c.ctx, st, 1024, 640, 1 / 60);
  assert.ok(Math.abs(phases.at(-1)! - phases.at(-2)!) <= 1 / 60 + 1e-10);
});

test("destination boat is moored on its very first frame, without crossing the fleet", () => {
  for (const [W, H] of [[320, 568], [390, 844], [844, 390], [1440, 900]]) {
    const c = canvas(W, H), st = state("home");
    const positions: { x: number; speed: number }[] = [];
    const scene = new PortKitScene(KITS, { playerBoat: (_f, x, _boat, speed) => { positions.push({ x, speed }); } });
    for (const pid of ["home", "coral", "mirador", "nordhavn", "southcross", "home"] as const) {
      st.pid = pid; positions.length = 0;
      for (let i = 0; i < 65; i++) scene.render(c.ctx, st, W, H, 0.1);
      const dock = scene.hot.find(h => h.id === "dock")!;
      assert.ok(dock.x > 0 && dock.x < W);
      assert.ok(positions.every(p => p.speed === 0 && p.x === dock.x), `${pid} ${W}×${H}: no second approach`);
    }
    c.balanced();
  }
});

test("reflection preference suppresses both port reflection passes without hiding services", () => {
  for (const pid of ["home", "nordhavn", "mirador", "coral", "southcross"] as const) {
    const off = canvas(390, 844), on = canvas(390, 844), st = state(pid);
    const noReflection = new PortKitScene(KITS), withReflection = new PortKitScene(KITS);
    noReflection.render(off.ctx, { ...st, quality: 2, reflectionsEnabled: false }, 390, 844, 1 / 60);
    withReflection.render(on.ctx, { ...st, quality: 2, reflectionsEnabled: true }, 390, 844, 1 / 60);
    assert.ok(off.count() < on.count() * .95, pid);
    assert.deepEqual(noReflection.hot, withReflection.hot);
    off.balanced(); on.balanced();
  }
});
