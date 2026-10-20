import test from "node:test";
import assert from "node:assert/strict";
import { horizontalGridRange, horizontalRange, overlapsHorizontal } from "../src/game/render/frame";
import { geometryTileRange, pixelAlignedChunkClip } from "../src/game/render/aquatoryStream";

test("renderer view windows are local to each streamed chunk and honor safe overdraw padding", () => {
  const current = horizontalRange({ W: 2400, viewLeft: 1800, viewWidth: 390 }, 40);
  assert.deepEqual(current, { left: 1760, right: 2230 });
  assert.equal(overlapsHorizontal({ W: 2400, viewLeft: 1800, viewWidth: 390 }, 2200, 2240, 40), true);
  assert.equal(overlapsHorizontal({ W: 2400, viewLeft: 1800, viewWidth: 390 }, 1200, 1300), false);

  const nextChunk = horizontalRange({ W: 2400, viewLeft: 0, viewWidth: 390 }, 40);
  assert.deepEqual(nextChunk, { left: -40, right: 430 });
});

test("terrain geometry uses fixed microtiles and requests only cells intersecting the camera", () => {
  assert.deepEqual(geometryTileRange(180, 1460), { first: 1, last: 11 });
  assert.deepEqual(geometryTileRange(1824, 2400), { first: 14, last: 18 });
  assert.equal(geometryTileRange(2400, 2400), null);
  assert.deepEqual(geometryTileRange(0, 2400), { first: 0, last: 18 });
});

test("streamed chunk clips remain pixel-aligned under scale and camera translation", () => {
  const clip = pixelAlignedChunkClip(2400, 2400, 1.5, -3599.25);
  assert.equal(Number.isInteger(clip.left * 1.5 + -3599.25), true);
  assert.equal(Number.isInteger(clip.right * 1.5 + -3599.25), true);
  assert.ok(clip.right > clip.left);
  assert.deepEqual(pixelAlignedChunkClip(0, 2400, 1, 0), { left: 0, right: 2400 });
});

test("water sample ranges stay on the world-space grid and cover viewport overdraw", () => {
  assert.deepEqual(horizontalGridRange({ W: 7200, viewLeft: 2390, viewWidth: 390 }, 8, 8), {
    first: 2376,
    last: 2792,
  });
  assert.deepEqual(horizontalGridRange({ W: 1003, viewLeft: 903, viewWidth: 100 }, 8, 8), {
    first: 888,
    last: 1000,
  });
  assert.deepEqual(horizontalGridRange({ W: 7200 }, 5), { first: 0, last: 7200 });
});
