import assert from "node:assert/strict";
import test from "node:test";
import { drawEventFx, type FxCall, type FxScene } from "../src/game/render/eventFx";

function scene(viewLeft: number, viewRight: number, points: number[]): FxScene {
  const ctx = {
    save() {}, restore() {}, beginPath() {}, closePath() {}, stroke() {}, fill() {},
    moveTo(x: number, y: number) { points.push(x); void y; },
    lineTo(x: number, y: number) { points.push(x); void y; },
    fillRect() {},
    globalAlpha: 1, globalCompositeOperation: "source-over",
    fillStyle: "", strokeStyle: "", lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
  return {
    c: ctx, t: 10, W: 7200, H: 720, s: 1, q: 2, horizon: 260,
    surface: 330, seabed: 800, visW: 7200, viewLeft, viewRight, cam: 0,
    windPx: 0, sAt: x => 330 + Math.sin(x * 0.01),
    glow() {}, sun: { x: 100, y: 50 }, moon: { x: 200, y: 40 },
    rocks: [], capeX: 500, capeTop: 200, rodTip: [0, 0], mast: [0, 0],
    lantern: [0, 0], boatX: 500,
    A: { daylight: 0, night: 1, fog: 0, cover: 0 } as FxScene["A"],
    pal: { cloud: [100, 120, 140], land1: [90, 80, 70], deep: [5, 10, 20] } as FxScene["pal"],
  };
}

test("bioluminescent surface path generates only camera-window samples", () => {
  const points: number[] = [];
  const S = scene(2400, 3600, points);
  const call = {
    e: { k: 1, omen: 0, seed: 123 } as FxCall["e"],
    spec: { id: "bioglow", n: 1 } as FxCall["spec"],
    age: 1,
  } satisfies FxCall;
  drawEventFx(S, "surface", [call]);
  assert.ok(points.length <= 122, `expected viewport-sized path, got ${points.length} vertices`);
  assert.ok(points.every(x => x >= 2400 && x <= 3600));
});
