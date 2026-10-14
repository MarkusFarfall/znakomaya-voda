import assert from "node:assert/strict";
import test from "node:test";
import { Engine, JUMP_TIME } from "../src/game/engine";
import { FISH } from "../src/game/fish";
import { FIGHT_STEP, fishInertia, newFightMotion, stepFightMotion, type FightControls } from "../src/game/fishingPhysics";
import { projectFightFish } from "../src/game/render/fishingGeometry";

function fight(weight = 2, strength = 5) {
  const e = new Engine();
  e.paused = false; e.hookDepth = 5; e.s.rod = 2; e.s.reel = 2;
  e.phase = "bite"; e.biteWindow = e.biteWindowMax = 1;
  e.pendingFish = { fish: { ...FISH[0], weight: [weight, weight * 2], strength }, weight, variant: null };
  e.pointerDown();
  const h = e.hooked!;
  h.jumper = false; h.modeTimer = 20;
  return { e, h };
}
const controls: FightControls = { reeling: false, direction: 0, rodPower: 30, reelSpeed: 4, grip: 0, ratio: 0, hook: 0, bed: 15 };
function step(h: ReturnType<typeof fight>["h"], c = controls, seconds = 1) {
  for (let i = 0; i < Math.round(seconds / FIGHT_STEP); i++) stepFightMotion(h, c, FIGHT_STEP);
}

test("heavier fish accelerate more slowly under the same initial force", () => {
  const light = fight(0.3).h, heavy = fight(80).h;
  for (const h of [light, heavy]) { h.power = 50; h.tension = 0; h.motion.lineOut = h.line + 10; }
  step(light, controls, 0.25); step(heavy, controls, 0.25);
  assert.ok(fishInertia(80, 5) > fishInertia(0.3, 5));
  assert.ok(light.motion.velocity > heavy.motion.velocity);
  assert.ok(heavy.motion.velocity > 0);
});

test("slack line cannot push the fish", () => {
  const { h } = fight();
  h.power = 0; h.tension = 0; h.motion.lineOut = h.line + 6;
  const distance = h.line;
  step(h);
  assert.equal(h.tension, 0);
  assert.equal(h.line, distance);
  assert.equal(h.motion.velocity, 0);
});

test("reeling takes up real paid line while fish motion has inertia", () => {
  const { h } = fight();
  const initial = h.line;
  stepFightMotion(h, { ...controls, reeling: true }, FIGHT_STEP);
  assert.ok(h.motion.reelInput > 0 && h.motion.reelInput < 0.1);
  assert.ok(Math.abs(h.line - initial) < 0.02);
  step(h, { ...controls, reeling: true }, 2);
  assert.ok(h.line < initial - 1);
  assert.ok(h.motion.lineOut < initial - 1);
  assert.ok(h.line > h.motion.lineOut, "taut line has elastic extension");
});

test("letting go opens drag smoothly instead of halving load instantly", () => {
  const { h } = fight();
  h.power = 35;
  step(h, { ...controls, reeling: true }, 0.7);
  const tension = h.tension, velocity = h.motion.velocity;
  stepFightMotion(h, controls, FIGHT_STEP);
  assert.ok(Math.abs(h.tension - tension) < 0.12);
  assert.ok(Math.abs(h.motion.velocity - velocity) < 0.3);
  step(h, controls, 1);
  assert.ok(h.motion.reelInput < 0.01);
  assert.ok(h.motion.payoutRate > 0);
});

test("turns, rod motion and tail animation retain continuity", () => {
  const { h } = fight();
  h.running = true; h.swayV = 1;
  step(h, { ...controls, direction: 1 }, 0.5);
  const before = { side: h.sway, facing: h.motion.facing, rod: h.motion.rodSide, tail: h.motion.swimPhase };
  h.swayV = -1;
  stepFightMotion(h, { ...controls, direction: -1 }, FIGHT_STEP);
  assert.ok(Math.abs(h.sway - before.side) < 0.03);
  assert.ok(Math.abs(h.motion.facing - before.facing) < 0.1);
  assert.ok(Math.abs(h.motion.rodSide - before.rod) < 0.15);
  assert.ok(h.motion.swimPhase > before.tail && h.motion.swimPhase - before.tail < 0.3);
});

test("depth is dynamic, obeys seabed and does not jump to the line ratio", () => {
  const { h } = fight();
  h.running = true; h.intensity = 1;
  const depth = h.motion.depth;
  stepFightMotion(h, { ...controls, bed: 6 }, FIGHT_STEP);
  assert.ok(h.motion.depth > depth && h.motion.depth < depth + 0.03);
  step(h, { ...controls, bed: 6 }, 4);
  assert.ok(h.motion.depth <= 6 && h.motion.depth >= 0.12);
});

test("fixed-step combat is equivalent at 30, 60 and 120 fps", (t) => {
  t.mock.method(Math, "random", () => 0.99);
  const results = [30, 60, 120].map(fps => {
    const { e, h } = fight(); e.reeling = true;
    for (let i = 0; i < fps * 2; i++) e.update(1 / fps);
    return [h.line, h.tension, h.motion.depth, h.motion.velocity, h.stamina, h.motion.swimPhase];
  });
  for (const result of results.slice(1)) result.forEach((v, i) => assert.ok(Math.abs(v - results[0][i]) < 1e-8));
});

test("a high-tier matched rod/reel does not snap when hauling a small fish", (t) => {
  t.mock.method(Math, "random", () => 0.5);
  const { e } = fight(0.2, 2);
  e.s.rod = 4; e.s.reel = 4; e.reeling = true;
  for (let i = 0; i < 1200 && e.phase === "fight"; i++) e.update(1 / 60);
  assert.equal(e.phase, "caught");
  assert.equal(e.s.stats.linesSnapped, 0);
});

test("a strong fish can still break an underpowered rig held continuously", (t) => {
  t.mock.method(Math, "random", () => 0.99);
  const { e, h } = fight(20, 10);
  e.s.rod = 0; e.s.reel = 0; e.reeling = true;
  h.running = true; h.intensity = h.targetIntensity = 1;
  for (let i = 0; i < 900 && e.phase === "fight"; i++) e.update(1 / 60);
  assert.equal(e.phase, "idle");
  assert.ok(e.s.stats.linesSnapped > 0 || e.s.stats.escaped > 0);
});

test("fish body and mouth share one continuous jump projection", () => {
  const { h } = fight();
  h.motion = newFightMotion(h.line, 0.2);
  const projection = { boatX: 300, castX: 650, scale: 1, waveY: () => 300, depthPx: (d: number) => d * 20 };
  const under = projectFightFish(h, projection);
  h.jump = JUMP_TIME; h.motion.jumpDepth = 0.2;
  const takeoff = projectFightFish(h, projection);
  assert.equal(takeoff.x, under.x); assert.equal(takeoff.y, under.y);
  assert.equal(takeoff.angle, under.angle); assert.deepEqual(takeoff.mouth, under.mouth);
  h.jump = JUMP_TIME / 2;
  const apex = projectFightFish(h, projection);
  assert.ok(apex.y < 300);
  assert.ok(Math.hypot(apex.mouth[0] - apex.x, apex.mouth[1] - apex.y) <= apex.len / 2);
  h.jump = 0.000001;
  const landing = projectFightFish(h, projection);
  h.jump = 0; h.motion.depth = 0.12;
  const submerged = projectFightFish(h, projection);
  assert.ok(Math.abs(landing.y - submerged.y) < 0.001);
  assert.ok(Math.abs(landing.angle - submerged.angle) < 0.001);
  assert.ok(Math.hypot(landing.mouth[0] - submerged.mouth[0], landing.mouth[1] - submerged.mouth[1]) < 0.001);
});

test("long extreme-force simulation stays finite and within geometric bounds", () => {
  const { h } = fight(400, 12);
  h.power = 1500; h.running = true; h.intensity = 1.2;
  for (let i = 0; i < 7200; i++) {
    stepFightMotion(h, { ...controls, reeling: i % 240 < 120, direction: i % 120 < 60 ? -1 : 1 }, FIGHT_STEP);
    assert.ok(Number.isFinite(h.line) && Number.isFinite(h.tension));
    assert.ok(Object.values(h.motion).every(Number.isFinite));
    assert.ok(h.motion.depth <= controls.bed && h.motion.depth >= 0.12);
    assert.ok(h.motion.lineOut >= 0.3 && h.tension >= 0 && h.motion.rodBend >= 0);
  }
});

test("jumpers first swim to the surface rather than teleport from deep water", (t) => {
  t.mock.method(Math, "random", () => 0);
  const { e, h } = fight(1, 3);
  h.jumper = true; h.running = true; h.jumpCD = 0; h.modeTimer = 20;
  h.power = 8; e.reeling = true;
  let jumped = false;
  for (let i = 0; i < 600 && e.phase === "fight"; i++) {
    const previousDepth = h.motion.depth;
    e.update(FIGHT_STEP);
    if (h.jump > 0) {
      assert.ok(previousDepth < 0.7);
      assert.ok(h.motion.jumpDepth < 0.7);
      jumped = true; break;
    }
    assert.ok(Math.abs(h.motion.depth - previousDepth) < 0.1);
  }
  assert.ok(jumped, "a healthy surface-reaching jumper should still jump");
});


test("turning through face-on cannot jump the line attachment or pitch", () => {
  const { h } = fight();
  h.motion.depthVelocity = -2;
  const projection = { boatX: 300, castX: 650, scale: 1, waveY: () => 300, depthPx: (d: number) => d * 20 };
  h.motion.facing = 0.000001;
  const before = projectFightFish(h, projection);
  h.motion.facing = -0.000001;
  const after = projectFightFish(h, projection);
  assert.ok(Math.abs(before.angle - after.angle) < 0.001);
  assert.ok(Math.hypot(before.mouth[0] - after.mouth[0], before.mouth[1] - after.mouth[1]) < 0.001);
});
