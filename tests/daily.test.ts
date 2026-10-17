import assert from "node:assert/strict";
import test from "node:test";
import { Engine, newSave } from "../src/game/engine";
import {
  dailyLevelMultiplier,
  dailyTaskFamily,
  dailyXpMultiplier,
  makeTasks,
  newDaily,
  rollDaily,
  todayKey,
} from "../src/game/daily";
import type { CaughtFish } from "../src/game/types";
import { ACHIEVEMENTS, QUESTS } from "../src/game/progress";

const fish: CaughtFish = {
  uid: "cooler-release-1",
  fishId: "goby",
  weight: 0.24,
  variant: null,
  value: 32,
  day: 4,
  loc: "bay",
  at: 320,
};

test("daily reward multipliers start at baseline and rise with level", () => {
  assert.equal(dailyLevelMultiplier(1), 1);
  assert.equal(dailyXpMultiplier(1), 1);
  assert.ok(dailyLevelMultiplier(10) > dailyLevelMultiplier(1));
  assert.ok(dailyLevelMultiplier(60) >= 8);
  assert.ok(dailyXpMultiplier(60) > dailyXpMultiplier(10));
  assert.equal(dailyLevelMultiplier(Number.NaN), 1);
});

test("daily tasks guarantee different activity families and a challenge slot", () => {
  const tasks = makeTasks(newSave("Ладья"), 12, "2026-10-17");

  assert.equal(tasks.length, 3);
  assert.equal(dailyTaskFamily(tasks[0].tpl), "routine");
  assert.ok(["market", "exploration", "skill", "care"].includes(dailyTaskFamily(tasks[1].tpl)));
  assert.equal(dailyTaskFamily(tasks[2].tpl), "challenge");
  assert.equal(new Set(tasks.map((task) => task.tpl)).size, 3);
});

test("daily template rotates against the previous two days when alternatives exist", () => {
  const save = newSave("Ладья");
  const first = makeTasks(save, 12, "2026-10-17");
  const second = makeTasks(save, 12, "2026-10-18", 0, first.map((task) => task.tpl));
  const third = makeTasks(save, 12, "2026-10-19", 0, [...first, ...second].map((task) => task.tpl));
  const recentlyUsed = new Set([...first, ...second].map((task) => task.tpl));

  assert.equal(second.length, 3);
  assert.equal(third.length, 3);
  assert.ok(second.every((task) => !first.some((previous) => previous.tpl === task.tpl)));
  assert.ok(third.every((task) => !recentlyUsed.has(task.tpl)));
});

test("three-region catch assignment stays unavailable until three regions are unlocked", () => {
  const save = newSave("Ладья");
  save.unlocked = ["bay", "estuary"];
  for (let salt = 0; salt < 24; salt++) {
    const tasks = makeTasks(save, 20, "2026-10-17", salt);
    assert.ok(tasks.every((task) => task.tpl !== "catch_two_locs"));
  }
});

test("higher-level routine tasks pay more for the same deterministic template", () => {
  const save = newSave("Ладья");
  const low = makeTasks(save, 1, "2026-10-17", 9)[0];
  const high = makeTasks(save, 10, "2026-10-17", 9)[0];

  assert.equal(low.tpl, high.tpl);
  assert.ok(high.reward > low.reward);
  assert.ok(high.xp >= low.xp);
});

test("reroll replaces only the chosen daily task and keeps the same task family", () => {
  const engine = new Engine(newSave("Ладья"));
  const date = todayKey();
  engine.s.daily = { ...newDaily(), date, tasks: makeTasks(engine.s, engine.level, date), rerolls: 1 };
  const [target, ...others] = engine.daily.tasks;
  assert.ok(target);
  others[0].progress = Math.max(0.25, Math.min(2, others[0].goal - 0.25));
  const unchanged = structuredClone(others);

  assert.equal(engine.rerollDaily(target.id), true);
  assert.equal(engine.daily.rerolls, 0);
  assert.equal(dailyTaskFamily(engine.daily.tasks[0].tpl), dailyTaskFamily(target.tpl));
  assert.equal(engine.daily.tasks[0].progress, 0);
  assert.deepEqual(engine.daily.tasks.slice(1), unchanged);
});

test("same-day daily refresh keeps task progress intact", () => {
  const save = newSave("Ладья");
  const daily = newDaily();
  const noon = new Date(2026, 9, 17, 12);
  assert.equal(rollDaily(daily, save, 1, noon), true);
  daily.tasks[0].progress = Math.max(0.25, Math.min(0.75, daily.tasks[0].goal / 2));
  const before = structuredClone(daily.tasks);

  assert.equal(rollDaily(daily, save, 20, new Date(2026, 9, 17, 18)), false);
  assert.deepEqual(daily.tasks, before);
});

test("releasing one stored fish updates release progress without deleting other progress", () => {
  const engine = new Engine(newSave("Ладья"));
  engine.s.money = 1234;
  engine.s.xp = 50;
  engine.s.stats.totalCaught = 1;
  engine.s.stats.releases = 2;
  engine.s.achievements = ACHIEVEMENTS.map((achievement) => achievement.id);
  engine.s.quest = QUESTS.length;
  engine.s.codex.goby = { count: 1, maxWeight: fish.weight, firstDay: fish.day, variants: [] };
  engine.s.cooler = [fish];
  engine.s.daily = {
    ...newDaily(),
    date: todayKey(),
    tasks: [{
      id: "release-task",
      tpl: "release",
      title: "Отпустить 3 рыбы",
      goal: 3,
      progress: 0,
      reward: 100,
      xp: 20,
      done: false,
      claimed: false,
    }],
  };
  const moneyBefore = engine.s.money;
  const xpBefore = engine.s.xp;
  const caughtBefore = engine.s.stats.totalCaught;
  const codexBefore = structuredClone(engine.s.codex);

  assert.equal(engine.releaseCoolerFish("missing-fish"), false);
  assert.equal(engine.releaseCoolerFish(fish.uid), true);

  assert.equal(engine.s.cooler.length, 0);
  assert.equal(engine.s.stats.releases, 3);
  assert.equal(engine.s.stats.totalCaught, caughtBefore);
  assert.equal(engine.s.money, moneyBefore);
  assert.equal(engine.s.xp, xpBefore);
  assert.deepEqual(engine.s.codex, codexBefore);
  assert.equal(engine.daily.tasks[0].progress, 1);
  assert.equal(engine.daily.tasks[0].done, false);
});
