import test from "node:test";
import assert from "node:assert/strict";
import { SKY_TILE_WIDTH, skyTileWindow } from "../src/game/render/sky";

test("sky renderer retains only microtiles intersecting the camera, regardless of travel direction", () => {
  assert.equal(SKY_TILE_WIDTH, 256);
  assert.deepEqual(skyTileWindow(7200, 2300, 300), {
    visible: [8, 9, 10], resident: [8, 9, 10],
  });
  assert.deepEqual(skyTileWindow(7200, 4000, 300), {
    visible: [15, 16], resident: [15, 16],
  });
  assert.deepEqual(skyTileWindow(7200, 2900, 300), {
    visible: [11, 12], resident: [11, 12],
  });
});

test("sky tile window clamps to world edges without returning off-screen tiles", () => {
  assert.deepEqual(skyTileWindow(700, -100, 300), {
    visible: [0], resident: [0],
  });
  assert.deepEqual(skyTileWindow(700, 600, 300), {
    visible: [2], resident: [2],
  });
});
