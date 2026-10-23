import test from "node:test";
import assert from "node:assert/strict";
import { Engine, migrateSave, newSave } from "../src/game/engine";
import { nextSonarMode, normalizeSonarMode, scanSonarBands, sonarIsActive } from "../src/game/sonar";
import { sanitizeSave } from "../src/lib/sanitize";
import type { Frame } from "../src/game/render/frame";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test("новый эхолот имеет независимые класс, питание и режим", () => {
  const e = new Engine();
  assert.equal(e.s.sonar, 0);
  assert.equal(e.s.sonarEnabled, true);
  assert.equal(e.s.sonarMode, "full");
  assert.equal(e.sonarActive, false);
  assert.equal(sonarIsActive(1, true), true);
  assert.equal(sonarIsActive(1, false), false);
  assert.equal(sonarIsActive(0, true), false);
});

test("покупка эхолота переживает сохранение и не включается в порту", () => {
  const e = new Engine();
  e.s.atPort = true;
  e.s.port = "home";
  e.s.money = 10_000;
  assert.equal(e.buyGear("sonar"), true);
  assert.equal(e.s.money, 8_500);
  assert.equal(e.s.sonar, 1);
  assert.equal(e.s.sonarEnabled, true);
  assert.equal(e.sonarActive, false);

  const restored = migrateSave(clone(e.s));
  assert.ok(restored);
  assert.equal(restored.sonar, 1);
  assert.equal(restored.sonarEnabled, true);
  assert.equal(restored.sonarMode, "full");
  restored.atPort = false;
  const atSea = new Engine(restored);
  assert.equal(atSea.sonarActive, true);
  assert.equal(atSea.sonarScan().length, 18);
});

test("выключение и режим эхолота сохраняются отдельно от покупки", () => {
  const e = new Engine();
  e.s.sonar = 2;
  assert.equal(e.setSonarEnabled(false), true);
  assert.equal(e.sonarActive, false);
  assert.equal(e.setSonarMode("bottom"), true);
  assert.equal(e.s.sonarMode, "bottom");

  const restored = migrateSave(clone(e.s));
  assert.ok(restored);
  assert.equal(restored.sonar, 2);
  assert.equal(restored.sonarEnabled, false);
  assert.equal(restored.sonarMode, "bottom");
  const atSea = new Engine(restored);
  assert.equal(atSea.sonarActive, false);
  assert.equal(atSea.toggleSonar(), true);
  assert.equal(atSea.sonarActive, true);
});

test("режимы идут по кругу и не меняют питание", () => {
  assert.equal(nextSonarMode("full"), "fish");
  assert.equal(nextSonarMode("fish"), "bottom");
  assert.equal(nextSonarMode("bottom"), "full");
  assert.equal(normalizeSonarMode("неизвестный"), "full");

  const e = new Engine();
  e.s.sonar = 1;
  e.setSonarEnabled(false);
  assert.equal(e.cycleSonarMode(), true);
  assert.equal(e.s.sonarMode, "fish");
  assert.equal(e.s.sonarEnabled, false);
  e.cycleSonarMode();
  e.cycleSonarMode();
  assert.equal(e.s.sonarMode, "full");
});

test("без прибора нельзя включить сканирование или сменить режим", () => {
  const e = new Engine();
  assert.equal(e.toggleSonar(), false);
  assert.equal(e.cycleSonarMode(), false);
  assert.equal(e.s.sonar, 0);
  assert.equal(e.sonarActive, false);
});

test("миграция нормализует повреждённые настройки эхолота", () => {
  const raw = { ...newSave(), sonar: 99, sonarEnabled: "да", sonarMode: "неизвестный" };
  const restored = migrateSave(raw);
  assert.ok(restored);
  assert.equal(restored.sonar, 3);
  assert.equal(restored.sonarEnabled, true);
  assert.equal(restored.sonarMode, "full");
});

test("серверная очистка сохраняет честные настройки и исправляет мусор", () => {
  const honest = sanitizeSave({ ...newSave(), sonar: 2, sonarEnabled: false, sonarMode: "fish" });
  assert.equal(honest.data.sonar, 2);
  assert.equal(honest.data.sonarEnabled, false);
  assert.equal(honest.data.sonarMode, "fish");

  const dirty = sanitizeSave({ ...newSave(), sonar: 99, sonarEnabled: "false", sonarMode: "unknown" });
  assert.equal(dirty.data.sonar, 3);
  assert.equal(dirty.data.sonarEnabled, true);
  assert.equal(dirty.data.sonarMode, "full");
  assert.ok(dirty.clamped.includes("sonar"));
  assert.ok(dirty.clamped.includes("sonarEnabled"));
  assert.ok(dirty.clamped.includes("sonarMode"));
});

test("сканирование сохраняет легендарную редкость, новые виды и силу отметки", () => {
  const bands = scanSonarBands(100, 3, () => [
    { id: "common", rarity: "common", known: false },
    { id: "legend", rarity: "legendary", known: true },
    { id: "rare", rarity: "rare", known: false },
  ]);
  assert.equal(bands.length, 3);
  assert.ok(bands[0].depth < bands[1].depth && bands[1].depth < bands[2].depth);
  for (const band of bands) {
    assert.equal(band.count, 3);
    assert.equal(band.fresh, 2);
    assert.equal(band.best, "legendary");
    assert.equal(band.legend, true);
    assert.equal(band.signal, 0.5);
  }
  assert.equal(scanSonarBands(0, 18, () => []).length, 0);
});

test("рендер режимов использует один профиль дна, а выключенный прибор не сканирует его", async () => {
  const { drawSonar } = await import("../src/game/render/sonar");
  const ctx = new Proxy({}, {
    get: (_, key) => key === "createLinearGradient" ? () => ({ addColorStop() {} }) : () => {},
  }) as CanvasRenderingContext2D;
  const e = new Engine();
  e.s.sonar = 1;
  e.s.sonarEnabled = true;
  const samples: number[] = [];
  const bed = e.bedAt.bind(e);
  e.bedAt = (nx) => { samples.push(nx); return bed(nx); };
  const f = {
    ctx, e, loc: e.loc, spot: e.spot, W: 390, H: 844, t: 0,
    compact: true, land: false, topRes: 118, botRes: 195,
  } as Frame;

  e.s.sonarMode = "full";
  drawSonar(f, e.sonarScan());
  assert.equal(samples.length, 41);

  samples.length = 0;
  e.s.sonarMode = "bottom";
  drawSonar(f, []);
  assert.equal(samples.length, 81);

  samples.length = 0;
  e.setSonarEnabled(false);
  drawSonar(f, e.sonarScan());
  assert.equal(samples.length, 0);
});
