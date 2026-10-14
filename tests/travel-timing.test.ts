import test from 'node:test';
import assert from 'node:assert/strict';
import { frameDeltaSeconds } from '../src/game/render/util';

test('a stale first RAF after WebGL warm-up cannot reverse particle ages or produce negative radii', () => {
  assert.equal(frameDeltaSeconds(2000, 2400), 0);
  assert.equal(frameDeltaSeconds(2400, 2400), 0);
  assert.equal(frameDeltaSeconds(2416, 2400), .016);
});

test('voyage integration caps background-tab gaps without changing ordinary frame cadence', () => {
  assert.equal(frameDeltaSeconds(100000, 1000), .05);
  assert.ok(Math.abs(frameDeltaSeconds(1000 + 1000/120,1000) - 1/120) < 1e-12);
});
