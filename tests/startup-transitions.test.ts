import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/game/engine";

function fadeAfter(fps: number, seconds: number) {
  const engine = new Engine();
  engine.paused = true;
  engine.fade = 1.4;
  const presentationDt = 1 / fps;
  const simulationDt = Math.min(0.05, presentationDt);
  const frames = Math.ceil(seconds * fps);
  for (let i = 0; i < frames; i++) engine.update(simulationDt, presentationDt);
  return { fade: engine.fade, time: engine.time, frames };
}

test("затемнение зависит от реального времени, а не от частоты кадров", () => {
  const smooth = fadeAfter(60, 1.8);
  const medium = fadeAfter(15, 1.8);
  const slow = fadeAfter(5, 1.8);
  assert.equal(smooth.fade, 0);
  assert.equal(medium.fade, 0);
  assert.equal(slow.fade, 0);
  assert.equal(slow.frames, 9);
  // Симуляция по-прежнему получает ограниченный шаг 0,05 с.
  assert.ok(Math.abs(slow.time - 0.45) < 1e-9);
});

test("длинный кадр не оставляет переход висеть, а вызов без второго dt совместим", () => {
  const engine = new Engine();
  engine.paused = true;
  engine.fade = 1.4;
  engine.update(0.05, 4);
  assert.equal(engine.fade, 0);

  const legacy = new Engine();
  legacy.paused = true;
  legacy.fade = 1.4;
  for (let i = 0; i < 9; i++) legacy.update(0.05);
  assert.ok(Math.abs(legacy.fade - 1.04) < 1e-9);
});

test("отрицательное и нечисловое presentationDt не ломает затемнение", () => {
  const engine = new Engine();
  engine.paused = true;
  engine.fade = 1;
  engine.update(0.05, -10);
  assert.equal(engine.fade, 1);
  engine.update(0.05, Number.NaN);
  assert.ok(Math.abs(engine.fade - 0.96) < 1e-9);
});

test("dev-стенд разрешён и по localhost, и по 127.0.0.1", async () => {
  const { default: config } = await import("../next.config");
  assert.ok(config.allowedDevOrigins?.includes("localhost"));
  assert.ok(config.allowedDevOrigins?.includes("127.0.0.1"));
  assert.ok(config.allowedDevOrigins?.includes("*.e2b.app"));
});
