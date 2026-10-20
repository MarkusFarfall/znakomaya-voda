import test from "node:test";
import assert from "node:assert/strict";
import { skyTileWindow } from "../src/game/render/sky";

test("sky tile window includes every visible tile and one forward prefetch", () => {
  assert.deepEqual(skyTileWindow(7200, 2300, 300, 1), {
    visible: [0, 1], resident: [0, 1],
  });
  assert.deepEqual(skyTileWindow(7200, 4000, 300, 1), {
    visible: [1], resident: [1, 2],
  });
});

test("sky tile window prefetches behind while moving left and clamps world edges", () => {
  assert.deepEqual(skyTileWindow(7200, 2300, 300, -1), {
    visible: [0, 1], resident: [0, 1],
  });
  assert.deepEqual(skyTileWindow(7200, 2900, 300, -1), {
    visible: [1], resident: [1, 0],
  });
  assert.deepEqual(skyTileWindow(700, -100, 300, -1, 2400), {
    visible: [0], resident: [0],
  });
});
