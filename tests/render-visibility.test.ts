import test from "node:test";
import assert from "node:assert/strict";
import { horizontalRange, overlapsHorizontal } from "../src/game/render/frame";

test("renderer view windows are local to each streamed chunk and honor safe overdraw padding", () => {
  const current = horizontalRange({ W: 2400, viewLeft: 1800, viewWidth: 390 }, 40);
  assert.deepEqual(current, { left: 1760, right: 2230 });
  assert.equal(overlapsHorizontal({ W: 2400, viewLeft: 1800, viewWidth: 390 }, 2200, 2240, 40), true);
  assert.equal(overlapsHorizontal({ W: 2400, viewLeft: 1800, viewWidth: 390 }, 1200, 1300), false);

  const nextChunk = horizontalRange({ W: 2400, viewLeft: 0, viewWidth: 390 }, 40);
  assert.deepEqual(nextChunk, { left: -40, right: 430 });
});
