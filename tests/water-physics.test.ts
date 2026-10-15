import assert from 'node:assert/strict';
import test from 'node:test';
import { currentAt, currentSpeedFactor, sampleWave, waveAmplitudePx } from '../src/game/waterPhysics';
import { habitatActivityText, HABITAT_CUES } from '../src/game/exploration';
import { LocalNavigation } from '../src/game/navigation';
import { Engine, newSave } from '../src/game/engine';
import { BOATS, SPOTS } from '../src/game/world';

test('world-anchored wave samples are deterministic and expose bounded kinematics', () => {
  const a = sampleWave(1834.25, 912.75, 22, -1);
  assert.deepEqual(a, sampleWave(1834.25, 912.75, 22, -1));
  assert.ok(Number.isFinite(a.height) && Math.abs(a.height) <= 22);
  assert.ok(Number.isFinite(a.slope) && Number.isFinite(a.velocity));
  assert.notDeepEqual(a, sampleWave(1834.25, 913.25, 22, -1));
  assert.ok(Math.abs(a.velocity) > 0.01);
});

test('sea-state amplitude responds to weather, habitat swell, wind and calm events', () => {
  const calm = waveAmplitudePx(0.3, 0.7, 0.7, 1, 1, true);
  const fair = waveAmplitudePx(0.8, 1, 1, 4, 1, false);
  const storm = waveAmplitudePx(2.5, 1.5, 1.4, 22, 1, false);
  assert.ok(calm < fair && fair < storm);
  assert.ok(calm >= 0.8 && storm <= 38);
  assert.ok(waveAmplitudePx(8, 8, 8, 90, 10) <= 38);
});

test('feature currents are deterministic, spatially variable and always bounded', () => {
  const a = currentAt('current', 800, 42, 17, 8, 1);
  assert.equal(a, currentAt('current', 800, 42, 17, 8, 1));
  assert.notEqual(a, currentAt('current', 1800, 42, 17, 8, 1));
  assert.notEqual(a, currentAt('pier', 800, 42, 17, 8, 1));
  for (const feature of SPOTS.map((spot) => spot.feature)) {
    for (const direction of [-1, 1]) {
      const current = currentAt(feature, 1e8, 1e5, 999, 32, direction);
      assert.ok(Number.isFinite(current) && current >= -8 && current <= 8);
    }
  }
  assert.ok(currentSpeedFactor(-7, -1) > 1);
  assert.ok(currentSpeedFactor(-7, 1) < 1);
  assert.ok(currentSpeedFactor(100, 1) <= 1.16);
});

test('currents change route speed but cannot drift a boat that has no destination', () => {
  const boat = { fuel: 1, tier: 0, style: BOATS[0].style, stability: 0.7 };
  const withCurrent = new LocalNavigation({ x: 0.3, heading: 1 });
  const againstCurrent = new LocalNavigation({ x: 0.3, heading: 1 });
  withCurrent.go(0.85);
  againstCurrent.go(0.85);
  for (let i = 0; i < 600; i++) {
    withCurrent.step(1 / 60, boat, 1, () => 7);
    againstCurrent.step(1 / 60, boat, 1, () => -7);
  }
  assert.ok(withCurrent.x > againstCurrent.x + 8);

  const idle = new LocalNavigation({ x: 0.42, heading: -1 });
  const startingX = idle.x;
  for (let i = 0; i < 600; i++) idle.step(1 / 60, boat, 1, () => 8);
  assert.equal(idle.x, startingX);
  assert.equal(idle.velocity, 0);
});

test('crossing into a new region records the discovery and only announces it once', () => {
  const save = newSave();
  save.atPort = false;
  save.spot = 'bay_pier';
  save.waterPosition = { location: 'bay', x: (2400 - 2) / 7200, heading: 1 };
  save.localPosition = { spot: 'bay_pier', x: (2400 - 2) / 2400, heading: 1 };
  const engine = new Engine(save);
  engine.paused = false;
  engine.navigationMode = true;
  engine.navigation.x = 2398;
  engine.navigation.velocity = 26;
  engine.navigation.target = 3000;
  engine.update(0.1);
  assert.equal(engine.s.spot, 'bay_sand');
  assert.ok(engine.s.flags.includes('explored_spot_bay_sand'));
  assert.ok(engine.toasts.some(({ text }) => text.includes('Новый ориентир')));
  const discovered = engine.s.flags.filter((flag) => flag === 'explored_spot_bay_sand').length;
  engine.navigation.x = 2400;
  engine.update(0.1);
  assert.equal(engine.s.flags.filter((flag) => flag === 'explored_spot_bay_sand').length, discovered);
});

test('every declared habitat has a field cue and activity wording follows Russian plural rules', () => {
  for (const spot of SPOTS) assert.ok(HABITAT_CUES[spot.feature], `missing cue for ${spot.feature}`);
  assert.match(habitatActivityText(0, 12), /тихо/);
  assert.match(habitatActivityText(1, 12), /1 вид$/);
  assert.match(habitatActivityText(2, 12), /2 вида$/);
  assert.match(habitatActivityText(4, 12), /4 вида$/);
  assert.match(habitatActivityText(5, 12), /5 видов$/);
  assert.match(habitatActivityText(21, 12), /21 вид$/);
  assert.match(habitatActivityText(14, 12), /14 видов$/);
});
