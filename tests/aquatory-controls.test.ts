import test from "node:test";
import assert from "node:assert/strict";
import {
  waterWidth,
  waterRegions,
  waterBedAt,
  regionAt,
  normalizeWaterPosition,
  ChunkWindow,
  streamPlan,
  REGION_WIDTH,
  SEAM_HALF,
} from "../src/game/aquatory";
import { Engine, newSave, migrateSave, type Phase } from "../src/game/engine";
import { BOATS, LOCATIONS, bedFrac, spotsOf } from "../src/game/world";
import { LocalNavigation } from "../src/game/navigation";
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/game/settings";
import { sanitizeSave } from "../src/lib/sanitize";

const active = (x = 0.3) => {
  const s = newSave();
  s.atPort = false;
  s.boat = 2;
  s.boatsOwned = [0, 2];
  s.waterPosition = { location: "bay", x, heading: 1 };
  const e = new Engine(s);
  e.paused = false;
  e.setNavigationMode(true);
  return e;
};
test("all 12 aquatories contain their former regions in one fixed-width world", () => {
  assert.equal(LOCATIONS.length, 12);
  for (const loc of LOCATIONS) {
    const regions = waterRegions(loc.id);
    assert.equal(waterWidth(loc.id), regions.length * 2400);
    for (let i = 0; i < regions.length; i++)
      assert.equal(regionAt(loc.id, (i + 0.5) * 2400).spot.id, regions[i].id);
  }
});
test("canonical seabed preserves region interiors and joins every boundary continuously", () => {
  for (const loc of LOCATIONS) {
    const regions = waterRegions(loc.id);
    for (let i = 0; i < regions.length; i++) {
      for (const u of [0.2, 0.5, 0.8])
        assert.ok(
          Math.abs(
            waterBedAt(loc.id, (i + u) * REGION_WIDTH) -
              regions[i].maxDepth * bedFrac(regions[i], u),
          ) < 1e-8,
        );
      if (i) {
        for (const x of [
          i * REGION_WIDTH - SEAM_HALF,
          i * REGION_WIDTH,
          i * REGION_WIDTH + SEAM_HALF,
        ]) {
          const dx = 0.001,
            a = waterBedAt(loc.id, x - dx),
            b = waterBedAt(loc.id, x),
            c = waterBedAt(loc.id, x + dx);
          assert.ok(
            Math.abs(a - c) < loc.maxDepth * 0.0001,
            `${loc.id} depth seam`,
          );
          assert.ok(
            Math.abs((b - a) / dx - (c - b) / dx) < loc.maxDepth * 0.00001,
            `${loc.id} slope seam`,
          );
        }
      }
    }
  }
});
test("all unified depths are finite and within the aquatory maximum", () => {
  for (const loc of LOCATIONS)
    for (let x = 0; x <= waterWidth(loc.id); x += 7) {
      const d = waterBedAt(loc.id, x);
      assert.ok(
        Number.isFinite(d) && d > 0 && d <= loc.maxDepth,
        `${loc.id}:${x}`,
      );
    }
});
test("old save positions migrate to the same physical point in each former region", () => {
  for (const loc of LOCATIONS)
    for (const [i, sp] of waterRegions(loc.id).entries()) {
      const s = {
        ...newSave(),
        location: loc.id,
        spot: sp.id,
        localPosition: { spot: sp.id, x: 0.72, heading: -1 as const },
      };
      const migrated = migrateSave(s)!;
      assert.ok(
        Math.abs(
          migrated.waterPosition!.x * waterWidth(loc.id) - (i + 0.72) * 2400,
        ) < 1e-8,
      );
      assert.equal(migrated.waterPosition!.heading, -1);
      assert.equal(migrated.spot, sp.id);
      assert.deepEqual(
        migrateSave(migrated)!.waterPosition,
        migrated.waterPosition,
      );
    }
});
test("malformed new positions are normalized on client and server", () => {
  const s = newSave();
  for (const value of [
    null,
    {},
    { location: "bay", x: NaN },
    { location: "bay", x: Infinity },
    { location: "reef", x: 0.9 },
    { location: "bay", x: "0.5" },
  ]) {
    const p = normalizeWaterPosition(value, "bay", s.spot);
    assert.equal(p.x, 0.1);
    const data = sanitizeSave({ ...s, waterPosition: value }).data;
    assert.deepEqual(data.waterPosition, p);
  }
  assert.equal(
    normalizeWaterPosition(
      { location: "bay", x: 20, heading: 3 },
      "bay",
      s.spot,
    ).x,
    1 - 240 / 7200,
  );
});
test("manual drive crosses a former boundary without teleport, fare, reset or fade", () => {
  const e = active(2380 / 7200),
    model = e.navigation,
    money = e.s.money,
    time = e.s.minutes;
  const initialSpot = e.s.spot;
  e.steerNavigation(1);
  let last = e.navigation.x;
  for (let i = 0; i < 240; i++) {
    e.update(1 / 60);
    assert.ok(e.navigation.x - last <= 2);
    last = e.navigation.x;
  }
  assert.notEqual(e.s.spot, initialSpot);
  assert.equal(e.s.spot, spotsOf("bay")[1].id);
  assert.equal(e.navigation, model);
  assert.equal(e.navigation.manual, 1);
  assert.equal(e.s.money, money);
  assert.ok(e.s.minutes - time < 3);
  assert.equal(e.fade, 0);
  assert.equal(e.s.waterPosition!.x, e.navigation.nx);
});
test("held arrows accelerate; release brakes and clears the artificial boundary target", () => {
  const e = active();
  e.steerNavigation(1);
  for (let i = 0; i < 180; i++) e.update(1 / 60);
  const x = e.navigation.x;
  e.steerNavigation(0);
  assert.equal(e.navigation.manual, 0);
  assert.equal(e.navigation.target, null);
  assert.ok(e.navigation.velocity > 0);
  for (let i = 0; i < 300; i++) e.update(1 / 60);
  assert.ok(e.navigation.x > x);
  assert.equal(e.navigation.moving, false);
});
test("pointer/blur cancellation clears manual motion, but not an explicit destination route", () => {
  const e = active();
  e.steerNavigation(-1);
  e.cancelInput();
  assert.equal(e.navigation.manual, 0);
  assert.equal(e.navigation.target, null);
  e.navigateTo(0.8);
  e.cancelInput();
  assert.equal(e.navigation.target, 0.8 * 7200);
});
test("all deployed tackle phases reject held movement", () => {
  for (const phase of [
    "charging",
    "casting",
    "sinking",
    "waiting",
    "bite",
    "fight",
    "caught",
  ] as Phase[]) {
    const e = active();
    e.phase = phase;
    assert.equal(e.steerNavigation(1), false);
    assert.equal(e.navigation.manual, 0);
    assert.equal(e.phase, phase);
  }
});
test("pause and opposite-arrow release cannot produce unexpected continuation after reload", () => {
  const e = active();
  e.steerNavigation(1);
  e.update(0.1);
  e.paused = true;
  e.cancelInput();
  const x = e.navigation.x;
  e.update(1);
  assert.equal(e.navigation.x, x);
  assert.equal(e.steerNavigation(-1), false);
  const restored = new Engine(migrateSave(JSON.parse(JSON.stringify(e.s)))!);
  assert.equal(restored.navigation.manual, 0);
  assert.equal(restored.navigation.moving, false);
  assert.equal(restored.navigationMode, false);
});
test("manual course reverses through braking/turning and stops safely at whole-world edges", () => {
  const n = new LocalNavigation({ x: 0.5, heading: 1 }, 7200);
  n.steer(1);
  for (let i = 0; i < 240; i++) n.step(1 / 60, BOATS[2]);
  n.steer(-1);
  n.step(1 / 60, BOATS[2]);
  assert.ok(n.velocity > 0);
  assert.equal(n.heading, 1);
  for (let i = 0; i < 6000; i++) n.step(1 / 60, BOATS[2]);
  assert.equal(n.x, 240);
  assert.equal(n.moving, false);
});
test("streaming plans only visible terrain plus a nearby neighbor for 320/390/1440 views", () => {
  for (const loc of LOCATIONS)
    for (const width of [320, 390, 1440])
      for (let left = 0; left < waterWidth(loc.id) - width; left += 160) {
        const p = streamPlan(loc.id, left, width, 1);
        assert.ok(p.resident.length <= 2);
        for (const id of p.visible) assert.ok(p.resident.includes(id));
      }
  assert.deepEqual(streamPlan("bay", 500, 390, 1).resident, [0]);
  assert.deepEqual(streamPlan("bay", 1800, 390, 1).resident, [0, 1]);
  assert.deepEqual(streamPlan("bay", 5100, 390, 1).resident, [2]);
});
test("chunk cache releases distant regions and never builds the whole world on entry", () => {
  const c = new ChunkWindow<{ id: number }>(),
    made: number[] = [];
  const sync = (left: number) => {
    const p = streamPlan("bay", left, 390, 1);
    c.sync("bay", p.resident, (id) => {
      made.push(id);
      return { id };
    });
  };
  sync(500);
  assert.deepEqual(made, [0]);
  const first = c.chunks.get(0);
  sync(1800);
  assert.equal(c.chunks.get(0), first);
  assert.deepEqual(made, [0, 1]);
  sync(3000);
  assert.ok(!c.chunks.has(0));
  sync(5100);
  assert.deepEqual([...c.chunks.keys()], [2]);
  c.sync("reef", [0], (id) => ({ id }));
  assert.deepEqual([...c.chunks.keys()], [0]);
});
test("new settings default to arrows and explicit fishing buttons, with independent migration", () => {
  assert.equal(DEFAULT_SETTINGS.controls.sailing, "arrows");
  assert.equal(DEFAULT_SETTINGS.controls.fishing, "buttons");
  assert.deepEqual(
    normalizeSettings({ sound: false }).controls,
    DEFAULT_SETTINGS.controls,
  );
  const c = normalizeSettings({
    controls: {
      sailing: "point",
      fishing: "canvas",
      hand: "left",
      size: 99,
      opacity: -3,
    },
  }).controls;
  assert.deepEqual(c, {
    sailing: "point",
    fishing: "canvas",
    hand: "left",
    size: 1.2,
    opacity: 0.65,
  });
  assert.deepEqual(
    normalizeSettings({ controls: { size: NaN, opacity: Infinity } }).controls,
    DEFAULT_SETTINGS.controls,
  );
});
test("a near-seam cast samples the neighboring habitat and the same world depth", () => {
  const e = active(2350 / 7200);
  e.setNavigationMode(false);
  const nx = e.castNX(1);
  assert.ok(nx * 7200 > 2400);
  assert.equal(e.bedAt(nx), waterBedAt("bay", nx * 7200));
});

test("cast and sonar HUD sample actual boat/cast positions, including left-facing seam casts", async () => {
  const { drawPower, drawSonar } = await import("../src/game/render/hud");
  const ctx = new Proxy(
    {},
    {
      get: (_, key) =>
        key === "createLinearGradient"
          ? () => ({ addColorStop() {} })
          : () => {},
    },
  ) as CanvasRenderingContext2D;
  for (const heading of [-1, 1] as const) {
    const e = active(2450 / 7200);
    e.setNavigationMode(false);
    e.navigation.heading = heading;
    e.s.sonar = 1;
    const samples: number[] = [];
    const bed = e.bedAt.bind(e);
    e.bedAt = (nx) => {
      samples.push(nx);
      return bed(nx);
    };
    const f = {
      ctx,
      e,
      loc: e.loc,
      spot: e.spot,
      W: 390,
      H: 844,
      t: 0,
      compact: true,
      land: false,
      topRes: 118,
      botRes: 195,
    } as import("../src/game/render/frame").Frame;
    e.phase = "charging";
    drawPower(f);
    assert.equal(samples.length, 52);
    for (const nx of samples) assert.ok(Math.abs(nx - e.navigation.nx) < 0.08);
    samples.length = 0;
    e.phase = "idle";
    drawSonar(f, e.sonarScan());
    assert.equal(samples.length, 41);
    assert.ok(
      Math.abs(samples[0] - Math.min(e.navigation.nx, e.castNX(1))) < 1e-10,
    );
    assert.ok(
      Math.abs(samples.at(-1)! - Math.max(e.navigation.nx, e.castNX(1))) <
        1e-10,
    );
  }
});

test('region choice at the cast endpoint controls fish preference weights',()=>{
  const edge=active(2350/7200);edge.setNavigationMode(false);edge.castDist=1;
  const neighbour=new Engine(migrateSave({...edge.s,waterPosition:{location:'bay',x:2700/7200,heading:1}})!);neighbour.castDist=1;
  assert.notEqual(edge.spot.id,neighbour.spot.id);
  assert.ok(edge.candidates(3).length>0);
  assert.deepEqual(edge.candidates(3),neighbour.candidates(3));
});
test('internal shore envelopes meet at the horizon without tapering outer coastlines',async()=>{
  const {shoreEnvelope}=await import('../src/game/render/frame');
  const frame=(offset:number)=>({W:2400,worldWidth:7200,chunkOffset:offset}) as import('../src/game/render/frame').Frame;
  assert.equal(shoreEnvelope(frame(0),0),1);assert.equal(shoreEnvelope(frame(4800),2400),1);
  for(const offset of [0,2400]){assert.equal(shoreEnvelope(frame(offset),2400),0);assert.equal(shoreEnvelope(frame(offset+2400),0),0);}
  assert.equal(shoreEnvelope(frame(2400),1200),1);
});
test('reverse streaming prefetches behind the camera, while wide screens retain all visible sections',()=>{
  assert.deepEqual(streamPlan('bay',2450,390,-1).resident,[1,0]);
  assert.deepEqual(streamPlan('bay',3000,390,-1).resident,[1]);
  assert.deepEqual(streamPlan('bay',0,7200,1).visible,[0,1,2]);
});
test('wave amplitude is continuous at every regional seam',async()=>{
  const {waterSwell}=await import('../src/game/aquatory');
  for(const loc of LOCATIONS)for(const x of [2400,4800])assert.ok(Math.abs(waterSwell(loc.id,x-.001)-waterSwell(loc.id,x+.001))<.0001);
});
test('physical outer boundary releases manual engine drive rather than leaving a false cruising state',()=>{
  const n=new LocalNavigation({x:6959/7200,heading:1},7200);n.steer(1);
  for(let i=0;i<120;i++)n.step(1/60,BOATS[2]);
  assert.equal(n.moving,false);assert.equal(n.manual,0);assert.equal(n.x,6960);
});
