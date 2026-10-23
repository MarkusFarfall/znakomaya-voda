import test from "node:test";
import assert from "node:assert/strict";
import { ambientPath, AmbientLife, passerSpeed, perspDepth } from "../src/game/render/ambient";
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

test("background passers keep a plausible pace: ships take minutes, not seconds", () => {
  // p — глубина плана истории (0 у горизонта, 1 у лодки), sc — масштаб сцены.
  const ships = ["cargo", "sailboat", "trawler", "canoe"] as const;
  for (const kind of ships) {
    const speed = passerSpeed(kind, 0.45, 0.8);
    assert.ok(speed !== undefined && speed > 0);
    const path = ambientPath(0, 1280, 1, 80 * 0.8, speed!);
    assert.ok(path.duration >= 60, `${kind} пересекает кадр за ${path.duration.toFixed(1)} с — это рывок, а не ход`);
    assert.ok(speed! <= 25, `${kind} идёт ${speed!.toFixed(1)} px/с — для судна на горизонте это слишком быстро`);
  }
});

test("passer speed follows the same perspective as its drawing", () => {
  for (const kind of ["cargo", "sailboat", "trawler", "canoe", "birds", "plane", "heron", "balloon", "orca", "dolphins"] as const) {
    const far = passerSpeed(kind, 0.1, 0.8)!;
    const near = passerSpeed(kind, 0.9, 0.8)!;
    assert.ok(near > far, `${kind}: ближний план должен идти быстрее дальнего`);
    assert.ok(perspDepth(kind, 0.9) > perspDepth(kind, 0.1));
    // Самая быстрая история у лодки на большом экране всё равно идёт не меньше 15 с на кадр.
    const worst = ambientPath(0, 1280, 1, 80 * 1.25, passerSpeed(kind, 0.9, 1.25)!);
    assert.ok(worst.duration >= 15, `${kind}: ${worst.duration.toFixed(1)} с на кадр — уже мельтешение`);
  }
});
