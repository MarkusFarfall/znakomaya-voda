import assert from "node:assert/strict";
import test from "node:test";
import { Atmosphere, type WeatherKind } from "../src/game/atmosphere";
import { Engine, depthToU } from "../src/game/engine";
import { LOCATIONS, bedFrac, spotsOf } from "../src/game/world";
import {
  PrecipitationField,
  type PrecipitationView,
} from "../src/game/render/precipitation";
import { SeabedRenderer } from "../src/game/render/seabed";
import { bedContact, bedFormations } from "../src/game/render/seabedLandscape";
import { clipWaterToBed, drawShafts } from "../src/game/render/water";
import { distantRain } from "../src/game/render/portHorizon";
import { portAtmosphere } from "../src/game/render/port";
import type { Frame } from "../src/game/render/frame";
import type { PF } from "../src/game/render/portFrame";

const dry: WeatherKind[] = ["clear", "fair", "cloudy", "overcast", "fog"];
const wet: WeatherKind[] = [
  "drizzle",
  "rain",
  "downpour",
  "storm",
  "gale",
  "snow",
  "blizzard",
];

test("all wet → dry transitions stop rain, snow and new lightning immediately, even at dt=0", () => {
  for (const from of wet)
    for (const to of dry) {
      const a = new Atmosphere({ seed: 42, climate: "temperate" });
      a.setWeather(from, true);
      a.update(0);
      assert.ok(a.state.precip > 0);
      a.setWeather(to);
      a.update(0);
      assert.equal(a.state.kind, to);
      assert.equal(a.state.precip, 0);
      assert.equal(a.state.rain, 0);
      assert.equal(a.state.snow, 0);
      assert.equal(a.state.lightning, 0);
      for (let i = 0; i < 30; i++) a.update(0.1);
      assert.equal(a.state.precip, 0);
    }
});
test("dry transition does not abruptly replace cloud cover, wind or wetness", () => {
  const a = new Atmosphere({ seed: 42 });
  a.setWeather("downpour", true);
  for (let i = 0; i < 60; i++) a.update(0.1);
  const cloud = a.state.cover,
    wind = a.state.wind,
    wetness = a.state.wetness;
  a.setWeather("clear");
  a.update(0);
  assert.equal(a.state.cover, cloud);
  assert.equal(a.state.wind, wind);
  assert.equal(a.state.wetness, wetness);
  assert.ok(a.state.cover > 0.8);
  assert.equal(a.state.rain, 0);
});
test("squall precipitation is named honestly without rewriting the base gameplay weather", () => {
  const a = new Atmosphere({ seed: 42, climate: "tropic" });
  a.setWeather("overcast", true);
  a.update(20);
  const before = a.weatherId;
  a.mods = { precip: 0.7, wind: 13 };
  a.update(0);
  assert.ok(a.state.rain > 0.4);
  assert.equal(a.summary().weatherName, "Шквал · дождь");
  assert.equal(a.summary().weatherId, "storm");
  assert.equal(a.weatherId, before);
  a.mods = { precip: 0.002 };
  a.update(0);
  assert.match(a.summary().weatherName, /Шквал/);
  a.mods = {};
  a.update(0);
  assert.equal(a.summary().weatherName, "Пасмурно");
  assert.equal(a.state.rain, 0);
});
test("rain at freezing point is labelled honestly: mixed slush, not a snowstorm", () => {
  const a = new Atmosphere({ seed: 42, climate: "temperate" });
  a.setWeather("rain", true);
  a.update(20);
  assert.equal(a.summary().weatherName, "Дождь");
  assert.equal(a.summary().weatherId, "rain");
  // 0 °C: примерно три четверти осадков выпадает снегом — это ещё не «Снегопад»,
  // но и не чистый дождь: HUD обязан сказать «Мокрый снег» и оставить дождевую иконку.
  a.state.temp = 0;
  a.update(0);
  assert.ok(a.state.snow > 0.3 && a.state.rain > 0.05, `snow=${a.state.snow} rain=${a.state.rain}`);
  assert.equal(a.summary().weatherName, "Мокрый снег");
  assert.equal(a.summary().weatherId, "rain");
  // Ниже −1 °C снег уже весь — только тогда честный снегопад, снежная иконка и id snow.
  a.state.temp = -8;
  a.update(0);
  assert.equal(a.state.rain, 0);
  assert.equal(a.summary().weatherName, "Снегопад");
  assert.equal(a.summary().weatherId, "snow");
  assert.equal(a.summary().icon, "🌨️");
});

test("cold squall reports snow and a dry snow-free label never carries residual flakes", () => {
  const a = new Atmosphere({ seed: 42, climate: "polar" });
  a.setWeather("overcast", true);
  a.update(20);
  a.state.temp = -12;
  a.mods = { precip: 0.7 };
  a.update(0);
  assert.equal(a.summary().weatherName, "Снежный шквал");
  assert.equal(a.summary().weatherId, "snow");
  assert.equal(a.state.rain, 0);
  assert.ok(a.state.snow > 0.5);
  a.mods = {};
  a.update(0);
  assert.equal(a.state.snow, 0);
});
test("real engine weather switch and port adapter agree on dry weather without changing saved forecast", () => {
  const e = new Engine();
  e.s.weather = "rain";
  e.syncAtmosphere(30);
  e.s.weather = "cloudy";
  e.syncAtmosphere(0);
  const p = portAtmosphere(e);
  assert.equal(p.rain, 0);
  assert.equal(p.snow, 0);
  assert.equal(e.s.weather, "cloudy");
  assert.equal(e.atmosphere.summary().weatherId, "cloudy");
});
const view: PrecipitationView = {
  x0: 0,
  x1: 390,
  top: -60,
  bottom: 500,
  floor: () => 490,
  intensity: 1,
  wind: 80,
  s: 1,
  q: 2,
  color: [100, 120, 140],
  active: true,
};
test("graphics disable/dry gate clears both particles and impacts at zero delta; re-enable cannot resurrect rain", () => {
  for (const kind of ["rain", "snow"] as const) {
    const field = new PrecipitationField(kind);
    for (let i = 0; i < 180; i++) field.step(view, 1 / 60);
    assert.ok(field.snapshot().drops.length > 0);
    field.step({ ...view, active: false, intensity: 0 }, 0);
    assert.deepEqual(field.snapshot(), { drops: [], impacts: [] });
    field.step({ ...view, active: true, intensity: 0 }, 1 / 60);
    assert.deepEqual(field.snapshot(), { drops: [], impacts: [] });
  }
});
test("nan frame delta cannot corrupt a precipitation field", () => {
  const field = new PrecipitationField("rain");
  field.step(view, 0.1);
  field.step(view, NaN);
  field.step(view, 0.1);
  assert.ok(
    field
      .snapshot()
      .drops.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
  );
});

function context() {
  let saves = 0,
    restores = 0,
    calls = 0,
    images = 0,
    clips = 0;
  const vertices: number[][] = [];
  const target: Record<string, unknown> = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    canvas: { width: 1440, height: 900 },
  };
  const finite = (args: unknown[]) => {
    for (const n of args.flat())
      if (typeof n === "number") assert.ok(Number.isFinite(n));
  };
  const gradient = (...args: unknown[]) => {
    finite(args);
    return {
      addColorStop: (n: number, c: string) => {
        assert.ok(n >= 0 && n <= 1);
        assert.ok(!c.includes("NaN"));
      },
    };
  };
  const ctx = new Proxy(target, {
    get: (o, k: string) => {
      if (k in o) return o[k];
      if (k === "createLinearGradient" || k === "createRadialGradient")
        return gradient;
      if (k === "createImageData" || k === "getImageData")
        return (w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h,
        });
      return (...args: unknown[]) => {
        calls++;
        finite(args);
        if (k === "save") saves++;
        if (k === "restore") {
          restores++;
          assert.ok(restores <= saves);
        }
        if (k === "drawImage") images++;
        if (k === "clip") clips++;
        if (k === "moveTo" || k === "lineTo") vertices.push(args as number[]);
        if (k === "arc") assert.ok(Number(args[2]) >= 0);
        if (k === "ellipse")
          assert.ok(Number(args[2]) >= 0 && Number(args[3]) >= 0);
      };
    },
    set: (o, k: string, v) => {
      if (typeof v === "number") assert.ok(Number.isFinite(v));
      if (typeof v === "string") assert.ok(!v.includes("NaN"));
      o[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return {
    ctx,
    vertices,
    stats: () => ({ calls, images, clips }),
    balanced: () => assert.equal(saves, restores),
  };
}
function frame(
  e: Engine,
  ctx: CanvasRenderingContext2D,
  W = 390,
  H = 844,
  quality = 2,
): Frame {
  const sY = H * 0.46,
    depthPx = (m: number) => H * 0.42 * depthToU(m);
  return {
    ctx,
    e,
    W,
    H,
    sc: Math.max(0.5, Math.min(H / 900, W / 1150)),
    sY,
    cam: Math.max(0, sY + depthPx(e.spot.maxDepth * 1.05) - H * 0.73),
    loc: e.loc,
    spot: e.spot,
    atmo: e.atmosphere.state,
    quality,
    t: 13,
    dt: 0.016,
    day: 1,
    night: 0,
    cover: 0,
    sunVis: 1,
    sunX: W * 0.4,
    clarity: e.loc.clarity,
    depthPx,
    bottomFocus: true,
  } as Frame;
}
test("large formations are deterministic, bounded and independent of gameplay randomness", (t) => {
  t.mock.method(Math, "random", () => {
    throw Error("gameplay RNG used");
  });
  for (const W of [320, 390, 1440, 3840]) {
    const a = bedFormations(W, 0.7, 41);
    assert.deepEqual(a, bedFormations(W, 0.7, 41));
    assert.notDeepEqual(a, bedFormations(W, 0.7, 42));
    assert.ok(a.length >= 3 && a.length <= 8);
    assert.ok(
      a.every((o) => o.x >= 0 && o.x <= W && o.height > 0 && o.width > 0),
    );
  }
});
test("contact sampling grounds the complete footprint and detects steep slopes", () => {
  const bed = (x: number) => 100 + x * 0.5;
  assert.deepEqual(bedContact(bed, 100, 20), { foot: 160, relief: 20 });
});
test("every seabed and spot renders finite balanced geometry across mobile/desktop and all quality tiers", () => {
  for (const loc of LOCATIONS)
    for (const spot of spotsOf(loc.id))
      for (const [W, H] of [
        [320, 568],
        [1440, 900],
      ])
        for (const q of [0, 1, 2]) {
          const e = new Engine();
          e.s.location = loc.id;
          e.s.spot = spot.id;
          const before = JSON.stringify(e.s),
            c = context(),
            f = frame(e, c.ctx, W, H, q),
            bed = new SeabedRenderer();
          bed.draw(f, false);
          bed.drawGlow(f);
          c.balanced();
          assert.equal(JSON.stringify(e.s), before);
          assert.ok(c.stats().calls < 24000, `${spot.id} q${q} draw budget`);
          for (const x of [0, 6, 60, W * 0.5, W]) {
            const expected =
              f.sY + f.depthPx(spot.maxDepth * bedFrac(spot, x / W));
            assert.ok(
              Math.abs(bed.bedY(x) - expected) < 2,
              `${spot.id} real depth retained`,
            );
          }
        }
});
test("caustics setting gates the actual seabed pass as well as quality", () => {
  const g = globalThis as unknown as {
    __makeCanvas?: (w: number, h: number) => unknown;
  };
  const old = g.__makeCanvas;
  g.__makeCanvas = (w, h) => ({
    width: w,
    height: h,
    getContext: () => context().ctx,
  });
  try {
    const e = new Engine();
    e.s.location = "reef";
    e.s.spot = spotsOf("reef")[0].id;
    for (const [quality, enabled, expected] of [
      [2, false, false],
      [1, true, false],
      [0, true, false],
      [2, true, true],
    ] as const) {
      const c = context(),
        f = frame(e, c.ctx, 390, 844, quality);
      new SeabedRenderer().draw(f, enabled);
      assert.equal(c.stats().images > 0, expected);
      c.balanced();
    }
  } finally {
    g.__makeCanvas = old;
  }
});
test("light volume clips to canonical ground, not a flat screen boundary", () => {
  const e = new Engine(),
    c = context(),
    f = frame(e, c.ctx);
  clipWaterToBed(f);
  assert.equal(c.stats().clips, 1);
  for (const [x, y] of c.vertices.slice(2, -1))
    assert.ok(
      Math.abs(
        y - (f.sY + f.depthPx(e.spot.maxDepth * bedFrac(e.spot, x / f.W))),
      ) < 1e-6,
    );
});
test("water clipping samples only a padded viewport while retaining the canonical bed profile", () => {
  const e = new Engine(),
    c = context(),
    f = frame(e, c.ctx, 7200, 844);
  f.viewLeft = 2390;
  f.viewWidth = 390;
  clipWaterToBed(f);
  const xs = c.vertices.map(([x]) => x);
  assert.ok(xs.length < 80, "clipped profile should scale with the viewport, not world width");
  assert.ok(Math.min(...xs) >= 2376);
  assert.ok(Math.max(...xs) <= 2792);
  for (const [x, y] of c.vertices.slice(2, -1)) {
    const expected = f.sY + f.depthPx(e.spot.maxDepth * bedFrac(e.spot, x / f.W));
    assert.ok(Math.abs(y - expected) < 1e-6, "viewport culling keeps the canonical seabed depth");
  }
});
test("overcast skies do not produce strong underwater sunbeams", () => {
  const e = new Engine(),
    c = context(),
    f = frame(e, c.ctx);
  f.sunVis = 0.015;
  f.cover = 0.98;
  drawShafts(f);
  assert.equal(c.stats().calls, 0);
});
test("distant rain follows liquid precipitation, including squalls, never a snowstorm label", () => {
  for (const [weather, rain, expected] of [
    ["storm", 0, false],
    ["cloudy", 0.7, true],
    ["cloudy", 0, false],
  ] as const) {
    const c = context();
    distantRain({
      ctx: c.ctx,
      W: 390,
      H: 844,
      hY: 430,
      t: 4,
      A: { weather, rain, day: 1, windDir: 1, palette: { skyMid: "#667788" } },
    } as PF);
    assert.equal(c.stats().calls > 0, expected);
    c.balanced();
  }
});
test("freezing rain is rendered and labelled as snow, never as a snowstorm over a rain forecast", () => {
  const e = new Engine();
  e.s.minutes = 13 * 60;
  e.syncAtmosphere(0);
  // Атмосфера зимой за 58° легко уходит в минус — ставим мороз явно, не полагаясь на дату.
  e.atmosphere.state.temp = -1.2;
  e.s.weather = "rain";
  e.s.weatherQueued = "rain";
  e.syncAtmosphere(0);
  const sm = e.atmosphere.summary();
  assert.equal(sm.weatherName, "Снег", "в мороз «дождь» обязан называться снегом");
  assert.equal(sm.weatherId, "snow");
  assert.equal(sm.icon, "🌨️");
  assert.equal(e.atmosphere.state.kind, "snow", "цель атмосферы — снег, а не дождь");
  // Даём осадкам дойти до цели: тогда в кадре именно снежинки.
  for (let i = 0; i < 20; i++) e.atmosphere.update(0.25);
  assert.equal(e.atmosphere.state.rain, 0);
  assert.ok(e.atmosphere.state.snow > 0.3);
});
test("snow forecast carried into warm weather falls as rain, not as summer snowflakes", () => {
  const a = new Atmosphere({ seed: 42, climate: "temperate" });
  a.setWeather("snow", true);
  a.update(60);
  a.state.temp = 12; // зимняя погода, но на улице тепло
  a.update(0);
  assert.equal(a.state.snow, 0);
  assert.ok(a.state.rain > 0.3);
  assert.equal(a.summary().weatherName, "Дождь");
  assert.equal(a.summary().weatherId, "rain");
  assert.equal(a.summary().icon, "🌧️");
});
test("blizzard keeps its own icon but reports a snow WeatherId, not a storm one", () => {
  const a = new Atmosphere({ seed: 7, climate: "polar" });
  a.setWeather("blizzard" as never, true);
  a.update(30);
  a.state.temp = -14;
  a.update(0);
  const sm = a.summary();
  assert.equal(sm.weatherName, "Метель");
  assert.equal(sm.weatherId, "snow");
  assert.equal(sm.icon, "❄️");
  assert.equal(a.state.rain, 0);
});
