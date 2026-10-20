import assert from "node:assert/strict";
import test from "node:test";
import { PrecipitationField, type PrecipitationView } from "../src/game/render/precipitation";

const view: PrecipitationView = {
  x0: 0, x1: 1200, top: -60, bottom: 420, horizon: 350,
  floor: x => 410 + Math.sin(x * 0.02) * 4,
  intensity: 1, wind: 120, s: 1, q: 2, color: [130, 145, 165],
};
function warm(field: PrecipitationField, o = view, seconds = 3) {
  for (let i = 0; i < seconds * 60; i++) field.step(o, 1 / 60);
}

test("rain respects the actual wavy surface and produces impacts across the sea plane", () => {
  const field = new PrecipitationField("rain"); warm(field);
  const s = field.snapshot();
  assert.ok(s.drops.length > 80);
  assert.ok(s.impacts.length > 0);
  assert.ok(s.drops.every(p => p.y <= view.floor(p.x) + 0.001));
  assert.ok(s.impacts.some(p => p.depth < 0.8));
  assert.ok(s.impacts.some(p => p.depth === 1));
});

test("reversing wind at a late simulation time cannot teleport surviving drops", () => {
  const field = new PrecipitationField("rain"); warm(field, view, 15);
  const before = field.snapshot().drops;
  field.step({ ...view, wind: -800 }, 1 / 60);
  const after = field.snapshot().drops;
  let checked = 0;
  before.forEach((p, i) => {
    const q = after[i];
    if (!q || p.phase !== q.phase) return; // Recycled drops have a new identity.
    assert.ok(Math.abs(p.x - q.x) < 8);
    assert.ok(Math.abs(p.vx - q.vx) < 8);
    checked++;
  });
  assert.ok(checked > 40);
});

test("rain and snow own independent deterministic state, without touching gameplay RNG", (t) => {
  t.mock.method(Math, "random", () => { throw new Error("particle RNG must stay isolated"); });
  const rain = new PrecipitationField("rain"), other = new PrecipitationField("rain"), snow = new PrecipitationField("snow");
  warm(rain); warm(other); warm(snow);
  assert.deepEqual(rain.snapshot(), other.snapshot());
  assert.ok(snow.snapshot().drops.every(p => p.vy < 150));
  assert.equal(snow.snapshot().impacts.length, 0);
});

test("zero intensity fades out rain and its existing ripples", () => {
  const rain = new PrecipitationField("rain"); warm(rain);
  warm(rain, { ...view, intensity: 0 }, 6);
  assert.equal(rain.snapshot().drops.length, 0);
  assert.equal(rain.snapshot().impacts.length, 0);
});

test("quality tiers and 4K storm keep strict particle and impact budgets", () => {
  const counts: number[] = [];
  for (const q of [0, 1, 2] as const) {
    const rain = new PrecipitationField("rain");
    warm(rain, { ...view, q, x1: 3840, bottom: 1500, floor: () => 1400, intensity: 1.5, wind: 900 });
    const s = rain.snapshot();
    assert.ok(s.drops.length <= [130, 280, 480][q]);
    assert.ok(s.impacts.length <= (q === 0 ? 22 : 64));
    counts.push(s.drops.length);
  }
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2]);
});

test("drawing preserves canvas state, cannot advance physics and clips in world coordinates", () => {
  const rain = new PrecipitationField("rain"); warm(rain);
  const before = rain.snapshot();
  let saves = 0, restores = 0, clips = 0;
  const vertices: number[][] = [];
  const fake = {
    save() { saves++; }, restore() { restores++; }, beginPath() {}, closePath() {}, clip() { clips++; },
    moveTo(x: number, y: number) { vertices.push([x, y]); }, lineTo(x: number, y: number) { vertices.push([x, y]); },
    arc() {}, ellipse() {}, stroke() {}, fill() {}, globalAlpha: 0.7,
  } as unknown as CanvasRenderingContext2D;
  rain.draw(fake, view);
  assert.equal(saves, restores); assert.ok(clips > 0);
  assert.deepEqual(rain.snapshot(), before);
  assert.ok(vertices.every(v => v.every(Number.isFinite)));
  assert.ok(vertices.some(([x, y]) => Math.abs(y - view.floor(x)) < 0.001));
});

test("camera/zoom changes need no particle resampling: view is world-space only", () => {
  const a = new PrecipitationField("rain"), b = new PrecipitationField("rain");
  warm(a); warm(b);
  // A renderer can translate and scale b's canvas arbitrarily; simulation
  // receives the same world bounds, not camY-dependent wrap ranges.
  for (let i = 0; i < 120; i++) { a.step(view, 1 / 60); b.step(view, 1 / 60); }
  assert.deepEqual(a.snapshot(), b.snapshot());
});
