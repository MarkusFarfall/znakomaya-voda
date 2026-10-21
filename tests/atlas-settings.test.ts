import "./path2d-polyfill";
import { MockPath2D } from "./path2d-polyfill";
import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/game/engine";
import { BOATS, LOCATIONS, LOC_POS, PORTS, spotsOf } from "../src/game/world";
import {
  atlasKey,
  atlasRoute,
  atlasTargets,
  clampAtlasView,
  targetPoint,
  zoomAtlas,
} from "../src/game/atlas";
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/game/settings";
import { distantRain } from "../src/game/render/portHorizon";
import { cloudBank } from "../src/game/render/cloudBank";
import type { PF } from "../src/game/render/portFrame";
import type { WeatherId } from "../src/game/types";

test("atlas includes every canonical location and port without duplicate IDs", () => {
  assert.equal(atlasTargets.length, LOCATIONS.length + PORTS.length);
  assert.equal(new Set(atlasTargets.map(atlasKey)).size, atlasTargets.length);
  for (const t of atlasTargets) {
    const canonical =
      t.kind === "loc" ? LOC_POS[t.id] : PORTS.find((p) => p.id === t.id)!.pos;
    assert.deepEqual(targetPoint(t), [canonical[0] * 10, canonical[1] * 6.25]);
  }
});
test("zoom preserves its anchor and panning never leaves the atlas", () => {
  const v = { x: 100, y: 70, zoom: 2 },
    anchor = [340, 225];
  const z = zoomAtlas(v, 2.5, anchor);
  assert.equal((anchor[0] - v.x) * v.zoom, (anchor[0] - z.x) * z.zoom);
  assert.equal((anchor[1] - v.y) * v.zoom, (anchor[1] - z.y) * z.zoom);
  for (const zoom of [-10, 0, 1, 2, 8, NaN, Infinity])
    for (const x of [-100, 0, 600, 9999, NaN]) {
      const a = clampAtlasView({ zoom, x, y: x });
      assert.ok(a.zoom >= 1 && a.zoom <= 3 && a.x >= 0 && a.y >= 0);
      assert.ok(
        a.x + 1000 / a.zoom <= 1000 + 1e-8 && a.y + 625 / a.zoom <= 625 + 1e-8,
      );
    }
  assert.deepEqual(zoomAtlas(v, 1), { x: 0, y: 0, zoom: 1 });
});
test("remembered port is not treated as current while fishing", () => {
  const e = new Engine();
  e.s.port = "home";
  e.s.atPort = false;
  e.s.location = "bay";
  e.s.spot = spotsOf("bay")[0].id;
  assert.equal(atlasRoute(e, { kind: "port", id: "home" }).here, false);
  assert.equal(atlasRoute(e, { kind: "loc", id: "bay" }, e.s.spot).here, true);
  e.s.atPort = true;
  assert.equal(atlasRoute(e, { kind: "port", id: "home" }).here, true);
  assert.equal(
    atlasRoute(e, { kind: "loc", id: "bay" }, e.s.spot).local,
    false,
  );
});
test("atlas previews use engine travel rules, including locks, hull tier and fish in progress", () => {
  const e = new Engine();
  e.s.atPort = true;
  e.s.port = "home";
  e.s.portsKnown = ["home"];
  e.s.unlocked = ["bay"];
  for (const target of atlasTargets) {
    const r = atlasRoute(e, target);
    assert.deepEqual(r.sail, e.tripQuote(r.trip, "sail"));
    assert.deepEqual(r.motor, e.tripQuote(r.trip, "motor"));
    if (!r.here) assert.equal(r.blocked, e.tripBlock(r.trip, "sail"));
  }
  assert.ok(atlasRoute(e, { kind: "port", id: "nordhavn" }).blocked);
  assert.ok(atlasRoute(e, { kind: "loc", id: "abyss" }).blocked);
  e.s.unlocked.push("abyss");
  assert.equal(
    atlasRoute(e, { kind: "loc", id: "abyss" }).blocked,
    "Нужно судно старшего класса",
  );
  for (const phase of ["fight", "bite", "caught"] as const) {
    e.phase = phase;
    assert.equal(
      atlasRoute(e, { kind: "loc", id: "bay" }).blocked,
      "Сначала закончите с рыбой",
    );
  }
});
test("merged aquatory has no separate point journey or charge", () => {
  const e = new Engine();
  e.paused = false;
  e.s.atPort = false;
  e.s.location = "bay";
  const [first, second] = spotsOf("bay");
  e.s.spot = first.id;
  e.s.boat = BOATS.findIndex((b) => b.fuel > 0);
  e.s.money = 1;
  const r = atlasRoute(e, { kind: "loc", id: "bay" }, second.id),
    time = e.s.minutes,
    money = e.s.money;
  assert.equal(r.local, true);
  assert.equal(r.here, true);
  assert.equal(r.blocked, "Вы уже здесь");
  const x = e.navigation.x;
  assert.equal(e.moveSpot(second.id), true);
  assert.equal(e.navigation.x, x);
  assert.ok(e.navigation.target !== null);
  assert.equal(e.s.minutes - time, r.sail.minutes);
  assert.equal(money - e.s.money, r.sail.fuel);
});
test("a zero balance does not block a free own-power inter-location route", () => {
  const e = new Engine();
  e.s.atPort = true;
  e.s.money = 0;
  e.s.boat = BOATS.findIndex((b) => b.fuel > 0);
  const r = atlasRoute(e, { kind: "loc", id: "bay" });
  assert.equal(r.blocked, null);
  assert.equal(r.sail.fuel, 0);
  assert.ok(e.tripBlock(r.trip, "motor"));
});
test("settings migration preserves false and zero, fills missing fields and never mutates defaults", () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(
    normalizeSettings({
      volume: 0,
      zoom: 2,
      sound: false,
      model3d: false,
      gfx: { precip: false },
    }),
    {
      ...DEFAULT_SETTINGS,
      volume: 0,
      zoom: 2,
      sound: false,
      model3d: false,
      gfx: { ...DEFAULT_SETTINGS.gfx, precip: false },
    },
  );
  const a = normalizeSettings({});
  a.gfx.refl = false;
  assert.equal(DEFAULT_SETTINGS.gfx.refl, true);
});
test("corrupted preference types and extreme numeric values are sanitized", () => {
  for (const value of [
    false,
    42,
    "bad",
    [],
    { quality: NaN, zoom: Infinity, volume: "loud", sound: "false", gfx: [] },
    { quality: {}, gfx: { refl: "false", foam: null }, model3d: 0 },
  ])
    assert.deepEqual(normalizeSettings(value), DEFAULT_SETTINGS);
  const a = normalizeSettings({
    quality: 40,
    zoom: -8,
    volume: 2,
    gfx: { shafts: false },
  });
  assert.equal(a.quality, 2);
  assert.equal(a.zoom, 1);
  assert.equal(a.volume, 1);
  assert.equal(a.gfx.shafts, false);
  assert.equal(normalizeSettings({ quality: 1.4 }).quality, 1);
});
function recorder() {
  const calls: string[] = [],
    stops: number[] = [],
    fills: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, key: string) => {
        if (key === "createLinearGradient" || key === "createRadialGradient")
          return (...v: number[]) => {
            assert.ok(v.every(Number.isFinite));
            calls.push(key);
            return {
              addColorStop: (n: number, c: string) => {
                assert.ok(n >= 0 && n <= 1);
                stops.push(n);
                fills.push(c);
              },
            };
          };
        return (...v: unknown[]) => {
          calls.push(key);
          for (const n of v)
            if (typeof n === "number") assert.ok(Number.isFinite(n));
        };
      },
      set: () => true,
    },
  ) as CanvasRenderingContext2D;
  return { ctx, calls, stops, fills };
}
test("distant rain renders nothing in cloudy or dry weather; wet curtain has transparent edges and no solid polygon", () => {
  for (const weather of [
    "clear",
    "cloudy",
    "fog",
    "snow",
    "rain",
    "storm",
  ] as WeatherId[]) {
    const r = recorder();
    const f = {
      ctx: r.ctx,
      W: 390,
      H: 844,
      hY: 430,
      t: 12,
      A: { weather, rain: weather === "rain" || weather === "storm" ? .8 : 0, day: 4, windDir: -1, palette: { skyMid: "#778899" } },
    } as PF;
    distantRain(f);
    if (weather === "rain" || weather === "storm") {
      assert.ok(r.calls.includes("createRadialGradient"));
      assert.ok(r.calls.includes("stroke"));
      assert.ok(!r.calls.includes("fill"));
      assert.ok(r.fills.filter((x) => /[, ]0(?:\.0+)?\)$/.test(x)).length > 30);
      assert.equal(
        r.calls.filter((x) => x === "save").length,
        r.calls.filter((x) => x === "restore").length,
      );
    } else assert.deepEqual(r.calls, []);
  }
});
test("a cloud uses one merged silhouette with clipped soft highlights and a shaded base", () => {
  const r = recorder();
  const before = MockPath2D.instances.length;
  cloudBank(r.ctx, 100, 50, 80, "#ccddee", "#667788");
  const paths = MockPath2D.instances.slice(before);
  assert.equal(paths.length, 1, "all overlapping lobes belong to one Path2D silhouette");
  assert.ok(paths[0].commands.filter((command) => command.name === "arc").length >= 6);
  assert.equal(r.calls.filter((x) => x === "clip").length, 1, "highlights stay inside the silhouette");
  assert.ok(r.calls.filter((x) => x === "createRadialGradient").length >= 6);
  assert.equal(r.calls.filter((x) => x === "createLinearGradient").length, 2);
  assert.equal(
    r.calls.filter((x) => x === "save").length,
    r.calls.filter((x) => x === "restore").length,
  );
});
