import assert from "node:assert/strict";
import test from "node:test";
import { Engine } from "../src/game/engine";
import { FISH } from "../src/game/fish";
import { BITE_WINDOWS, SURGE_WARNING_TIME, biteApproachSeconds } from "../src/game/fishing";
import type { FishDef } from "../src/game/types";

const fish: FishDef = { ...FISH[0], id: "goby", rarity: "common", strength: 2, weight: [0.1, 0.4] };
function ready() {
  const e = new Engine();
  e.paused = false;
  e.s.atPort = false;
  e.hookDepth = 4;
  return e;
}
function biting(e = ready(), f = fish) {
  e.phase = "bite";
  e.biteWindow = e.biteWindowMax = 1;
  e.pendingFish = { fish: f, weight: 0.2, variant: null };
  return e;
}
function fighting() {
  const e = biting();
  e.pointerDown();
  const h = e.hooked!;
  assert.ok(h);
  h.jumper = false;
  h.modeTimer = 10;
  return { e, h };
}

test("approach length is bounded and active fish take faster", () => {
  assert.equal(biteApproachSeconds({ strength: 2, shape: "flat" }, 0), 0.9);
  assert.equal(biteApproachSeconds({ strength: 7, shape: "fusiform" }, 0), 0.45);
  assert.equal(biteApproachSeconds({ strength: 2, shape: "shark" }, 1), 0.75);
  assert.equal(biteApproachSeconds(fish, -2), biteApproachSeconds(fish, 0));
  assert.equal(biteApproachSeconds(fish, 2), biteApproachSeconds(fish, 1));
});

test("each rarity keeps its full hook window after the approach", (t) => {
  t.mock.method(Math, "random", () => 0.5); // No find, no rare variant.
  for (const rarity of Object.keys(BITE_WINDOWS) as (keyof typeof BITE_WINDOWS)[]) {
    const e = ready();
    e.phase = "waiting";
    e.biteTimer = 0;
    e.s.perks.hands = 2;
    e.s.mods.line_braid = 1;
    t.mock.method(e, "candidates", () => [{ fish: { ...fish, rarity }, w: 1 }]);
    e.update(0.01);
    assert.equal(e.phase, "waiting");
    assert.equal(e.nibbling, true);
    assert.equal(e.pendingFish?.fish.rarity, rarity);
    assert.ok(e.sfx.includes("nibble"));
    assert.ok(!e.sfx.includes("bite"));
    const window = BITE_WINDOWS[rarity] * (1 + 2 * 0.08 + 0.06);
    e.update(e.nibbleDuration + 0.001);
    assert.equal(e.phase, "bite");
    assert.equal(e.nibbling, false);
    assert.equal(e.biteWindow, window, "approach must not spend the reaction window");
    assert.equal(e.biteProgress, 0);
    assert.ok(e.sfx.includes("bite"));
  }
});

test("early strike clears the candidate without spending bait or catching it", (t) => {
  const e = ready();
  t.mock.method(Math, "random", () => 0.5);
  t.mock.method(e, "candidates", () => [{ fish, w: 1 }]);
  e.s.currentBait = "shrimp";
  e.s.baits.shrimp = 5;
  e.phase = "waiting";
  e.biteTimer = 0;
  e.update(0.01);
  e.pointerDown();
  assert.equal(e.phase, "waiting");
  assert.equal(e.nibbling, false);
  assert.equal(e.pendingFish, null);
  assert.equal(e.pendingFind, null);
  assert.equal(e.hooked, null);
  assert.equal(e.s.baits.shrimp, 5);
  assert.ok(e.biteTimer > 0);
  assert.ok(e.toasts.some((x) => x.text.includes("Рано")));
});

test("missed bite returns to waiting and consumes natural bait just once", (t) => {
  t.mock.method(Math, "random", () => 0.99);
  const e = biting();
  e.s.currentBait = "shrimp";
  e.s.baits.shrimp = 5;
  e.update(1.01);
  assert.equal(e.phase, "waiting");
  assert.equal(e.pendingFish, null);
  assert.equal(e.s.baits.shrimp, 4);
  assert.equal(e.nibbling, false);
  e.update(0.01);
  assert.equal(e.s.baits.shrimp, 4);
});

test("empty fish pool does not produce fake preliminary taps", (t) => {
  const e = ready();
  t.mock.method(Math, "random", () => 0.5);
  t.mock.method(e, "candidates", () => []);
  e.phase = "waiting";
  e.update(0.01);
  assert.equal(e.nibbling, false);
  assert.equal(e.pendingFish, null);
  assert.ok(!e.sfx.includes("nibble"));
});

test("finds retain their approach, full window and direct reward flow", (t) => {
  const e = ready();
  t.mock.method(Math, "random", () => 0);
  e.hookDepth = 20;
  e.phase = "waiting";
  e.biteTimer = 0;
  e.update(0.01);
  assert.ok(e.pendingFind, "bay has an eligible find");
  assert.equal(e.pendingFish, null);
  assert.equal(e.nibbling, true);
  e.update(0.66);
  assert.equal(e.biteWindow, e.biteWindowMax);
  e.pointerDown();
  assert.equal(e.phase, "caught");
  assert.ok(e.lastFind);
  assert.equal(e.hooked, null);
});

test("upgraded perfect window is shared by HUD and actual hook result", () => {
  const e = biting();
  e.s.hook = 4;
  e.s.mods.hook_sharpen = 3;
  e.biteWindow = 0.5;
  assert.ok(e.biteProgress > 0.42);
  assert.ok(e.perfectHookThreshold > 0.5);
  assert.equal(e.inPerfectHookWindow, true);
  e.pointerDown();
  assert.equal(e.perfectHook, true);
  assert.equal(e.hooked?.stamina, 78);
  assert.equal(e.s.stats.perfectHooks, 1);
  assert.equal(e.inPerfectHookWindow, false, "perfect cue is only valid during a bite");
});

test("late valid hook starts with full fish stamina", () => {
  const e = biting();
  e.biteWindow = 0.1;
  assert.equal(e.inPerfectHookWindow, false);
  e.pointerDown();
  assert.equal(e.phase, "fight");
  assert.equal(e.perfectHook, false);
  assert.equal(e.hooked?.stamina, 100);
});

test("strong extra surge is telegraphed, not applied instantly", (t) => {
  const { e, h } = fighting();
  t.mock.method(Math, "random", () => 0);
  h.running = true;
  h.intensity = h.targetIntensity = 0.2;
  e.update(0.01);
  assert.equal(h.surgeWarning, SURGE_WARNING_TIME);
  assert.ok(h.surgeBoost > 0);
  assert.equal(h.intensity, 0.2);
  assert.ok(e.sfx.includes("surge"));
  for (let i = 0; i < 20; i++) e.update(0.02);
  assert.ok(h.surgeWarning > 0);
  assert.equal(h.intensity, 0.2);
  assert.equal(e.sfx.filter((x) => x === "surge").length, 1);
});

test("announced surge applies once when its warning ends", (t) => {
  const { e, h } = fighting();
  t.mock.method(Math, "random", () => 0.99);
  h.running = true;
  h.intensity = h.targetIntensity = 0.2;
  h.surgeWarning = 0.01;
  h.surgeBoost = 0.4;
  e.update(0.02);
  assert.equal(h.surgeWarning, 0);
  assert.equal(h.surgeBoost, 0);
  assert.ok(Math.abs(h.intensity - 0.6) < 1e-9);
  e.update(0.02);
  assert.ok(h.intensity < 0.6, "boost cannot be applied twice");
});

test("rest or jump cancels a prepared surge", (t) => {
  t.mock.method(Math, "random", () => 0.99);
  for (const jump of [false, true]) {
    const { e, h } = fighting();
    h.running = jump;
    h.jump = jump ? 0.7 : 0;
    h.surgeWarning = 0.1;
    h.surgeBoost = 0.4;
    e.update(0.02);
    assert.equal(h.surgeWarning, 0);
    assert.equal(h.surgeBoost, 0);
  }
});

test("pausing freezes both preliminary taps and fight warnings", () => {
  const e = ready();
  e.phase = "waiting";
  e.nibbleTimer = 0.8;
  e.paused = true;
  e.update(1);
  assert.equal(e.nibbleTimer, 0.8);
  const { e: fight, h } = fighting();
  h.surgeWarning = 0.3;
  fight.paused = true;
  fight.update(1);
  assert.equal(h.surgeWarning, 0.3);
});

test("risk meters use upgraded gameplay limits and stay within 0..1", () => {
  const { e, h } = fighting();
  e.s.mods.reel_drag = 3;
  e.s.hook = 4;
  assert.equal(e.slackLimit, 5.4);
  assert.ok(e.overloadLimit > 0.38);
  h.overload = e.overloadLimit / 2;
  h.slack = e.slackLimit / 4;
  assert.equal(e.overloadRisk, 0.5);
  assert.equal(e.slackRisk, 0.25);
  h.overload = 10; h.slack = 10;
  assert.equal(e.overloadRisk, 1);
  assert.equal(e.slackRisk, 1);
});

test("sustained overload snaps the line and clears all input", () => {
  const { e, h } = fighting();
  h.power = 1000;
  h.tension = 1.3;
  h.overload = e.overloadLimit - 0.005;
  e.reeling = true;
  e.keyDir = e.pullDir = 1;
  e.update(0.01);
  assert.equal(e.phase, "idle");
  assert.equal(e.s.stats.linesSnapped, 1);
  assert.equal(e.hooked, null);
  assert.equal(e.reeling, false);
  assert.equal(e.keyDir, 0);
  assert.equal(e.pullDir, 0);
});

test("slack and distance losses have different truthful explanations", () => {
  for (const cause of ["slack", "distance"]) {
    const { e, h } = fighting();
    h.power = 0;
    h.tension = 0;
    if (cause === "slack") h.slack = e.slackLimit - 0.005;
    else h.line = h.startLine * 1.6 + 16;
    e.update(0.01);
    assert.equal(e.phase, "idle");
    assert.equal(e.s.stats.escaped, 1);
    const notice = e.toasts.find((x) => x.text === "Сход");
    assert.ok(notice?.sub?.includes(cause === "slack" ? "слабина" : "далеко"));
  }
});

test("a safe pause recovers overload instead of snapping immediately", () => {
  const { e, h } = fighting();
  h.power = 0;
  h.tension = 0.4;
  h.overload = 0.2;
  e.reeling = false;
  e.update(0.05);
  assert.equal(e.phase, "fight");
  assert.ok(h.overload < 0.2);
});

test("landing still depends on remaining line, not zero stamina", () => {
  const { e, h } = fighting();
  h.power = 0;
  h.line = 1.1;
  e.reeling = true;
  e.update(0.01);
  assert.equal(e.phase, "caught");
  assert.ok(e.lastCatch);
  assert.ok(h.stamina > 50);
});

test("countersteering reduces tension compared with pulling with a run", (t) => {
  t.mock.method(Math, "random", () => 0.99);
  const run = (dir: -1 | 1) => {
    const { e, h } = fighting();
    h.running = true;
    h.swayV = 1;
    h.intensity = h.targetIntensity = 0.7;
    e.reeling = true;
    e.pullDir = dir;
    e.update(0.05);
    return h.tension;
  };
  assert.ok(run(-1) < run(1));
});

test("cancelled charge does not accidentally cast; cancelled fight releases reel", () => {
  const e = ready();
  e.pointerDown();
  assert.equal(e.phase, "charging");
  e.update(0.1);
  e.cancelInput();
  e.pointerUp(); // A later browser release must not resurrect the cancelled charge.
  assert.equal(e.phase, "idle");
  assert.equal(e.power, 0);
  assert.ok(!e.sfx.includes("cast"));
  const { e: fight } = fighting();
  fight.reeling = true;
  fight.pullDir = fight.keyDir = -1;
  fight.cancelInput();
  assert.equal(fight.phase, "fight");
  assert.equal(fight.reeling, false);
  assert.equal(fight.pullDir, 0);
  assert.equal(fight.keyDir, 0);
});

test("preliminary taps do not release queued banners or tutorial tips", () => {
  const e = ready();
  e.phase = "waiting";
  e.nibbleTimer = 1;
  e.toast("Не мешать поклёвке", "legend");
  e.tip("test_wait_tip", "Отложенная подсказка");
  assert.equal(e.calm, false);
  e.update(0.05);
  assert.equal(e.banner, null);
  assert.equal(e.tipNow, null);
});

test("approach transition preserves a full reaction window at 30, 60 and 120 fps", (t) => {
  t.mock.method(Math, "random", () => 0.5);
  for (const fps of [30, 60, 120]) {
    const e = ready();
    t.mock.method(e, "candidates", () => [{ fish, w: 1 }]);
    e.phase = "waiting";
    e.update(1 / fps);
    const approach = e.nibbleDuration;
    let elapsed = 0;
    while (e.nibbling) { e.update(1 / fps); elapsed += 1 / fps; }
    assert.ok(elapsed >= approach - 1e-9 && elapsed <= approach + 1 / fps + 1e-9);
    assert.equal(e.phase, "bite");
    assert.equal(e.biteWindow, e.biteWindowMax);
  }
});
