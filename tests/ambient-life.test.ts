import test from "node:test";
import assert from "node:assert/strict";
import { ambientPath, AmbientLife } from "../src/game/render/ambient";
import type { Frame } from "../src/game/render/frame";
import { Engine, newSave } from "../src/game/engine";
import { waterWidth } from "../src/game/aquatory";

test("ambient passers are positioned against the viewport and keep relative speed while sailing", () => {
  const right = ambientPath(2200, 390, 1, 80, 100, 42);
  assert.equal(right.x0, 2120);
  assert.equal(right.vx, 142);
  assert.equal(right.duration, 5.5);
  const cameraTravel = 42 * right.duration;
  assert.equal(right.x0 + right.vx * right.duration, 2200 + 390 + 80 + cameraTravel);

  const left = ambientPath(2200, 390, -1, 80, 100, 42);
  assert.equal(left.x0, 2670);
  assert.equal(left.vx, -58);
  assert.equal(left.x0 + left.vx * left.duration, 2200 - 80 + cameraTravel);
});

test("ambient scheduling uses its own random stream, not gameplay Math.random", () => {
  const e = new Engine(newSave());
  const life = new AmbientLife();
  const f = {
    e,
    W: waterWidth(e.s.location),
    H: 844,
    dt: 3.1,
    viewLeft: 1200,
    viewWidth: 390,
    boatX: 1395,
    sc: 1,
    night: 0,
    cover: 0,
    weather: "clear",
  } as unknown as Frame;
  const original = Math.random;
  Math.random = () => { throw new Error("ambient consumed gameplay randomness"); };
  try {
    life.update(f);
  } finally {
    Math.random = original;
  }
});
