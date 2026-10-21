/**
 * Контракт сборки чанков: тяжёлая работа не сваливается в один кадр.
 *
 * Раньше при пересечении границы региона в одном кадре собирались земля и дно
 * сразу у всех резидентных чанков — это давало заметный рывок. Теперь в кадре
 * собирается не больше одной структуры (земля или дно одного чанка), а уже
 * видимые чанки дорисовываются немедленно, чтобы не было «дырки» в мире.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { Engine, depthToU } from "../src/game/engine";
import { bedFrac, spotsOf } from "../src/game/world";
import { AquatoryStream } from "../src/game/render/aquatoryStream";
import { LandRenderer } from "../src/game/render/land";
import { SeabedRenderer } from "../src/game/render/seabed";
import type { Frame } from "../src/game/render/frame";

function stubCtx(width: number, height: number) {
  return new Proxy({} as Record<string, unknown>, {
    get(_t, p: string) {
      if (p === "canvas") return { width, height };
      if (p === "getTransform") return () => ({ a: 1, e: 0, f: 0 });
      if (p === "createLinearGradient" || p === "createRadialGradient")
        return () => ({ addColorStop() {} });
      return () => {};
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
}

function frame(e: Engine, W: number, H: number): Frame {
  const sY = H * 0.46,
    depthPx = (m: number) => H * 0.42 * depthToU(m);
  const spot = e.spot;
  return {
    ctx: stubCtx(W, H),
    e,
    W,
    H,
    sc: Math.max(0.5, Math.min(H / 900, W / 1150)),
    sY,
    cam: 0,
    loc: e.loc,
    spot,
    atmo: e.atmosphere.state,
    quality: 2,
    t: 13,
    dt: 0.016,
    day: 1,
    night: 0,
    cover: 0,
    sunVis: 1,
    sunX: W * 0.4,
    clarity: e.loc.clarity,
    depthPx,
    bottomFocus: false,
    waveY: () => sY,
    bedDepth: (x: number) => spot.maxDepth * bedFrac(spot, x / W),
    waterBedAt: (x: number) => spot.maxDepth * bedFrac(spot, x / W),
    viewLeft: 0,
    viewWidth: W,
  } as unknown as Frame;
}

function rig(t: { mock: { method: Function } }) {
  const engine = new Engine();
  engine.s.location = "bay";
  engine.s.spot = spotsOf("bay")[0].id;
  const f = frame(engine, 7200, 720);
  const origLand = LandRenderer.prototype.build;
  const origBed = SeabedRenderer.prototype.build;
  const counts = { land: 0, bed: 0 };
  t.mock.method(LandRenderer.prototype, "build", function (this: LandRenderer, fr: Frame) {
    counts.land++;
    return origLand.call(this, fr);
  });
  t.mock.method(SeabedRenderer.prototype, "build", function (this: SeabedRenderer, fr: Frame) {
    counts.bed++;
    return origBed.call(this, fr);
  });
  return { stream: new AquatoryStream(), f, counts };
}

test("поток собирает не больше одной новой структуры за кадр и не повторяет сборку", (t) => {
  const { stream, f, counts } = rig(t);
  // Кадр стоит у левого края региона: соседний регион уже резидентен (предзагрузка),
  // но ещё не виден — именно там сборка должна идти по одной структуре за кадр.
  const step = () => stream.update(f, 1800, 390, 1);

  step(); // холодный старт: один кадр обязан достроить видимый чанк целиком
  const cold = counts.land + counts.bed;
  assert.ok(cold >= 1, "первый кадр что-то собрал");

  for (let i = 0; i < 5; i++) {
    const before = counts.land + counts.bed;
    step();
    const added = counts.land + counts.bed - before;
    assert.ok(added <= 1, `кадр ${i + 1} собрал ${added} структур вместо ≤1`);
  }

  // Ни одна структура не собирается повторно: итог = 2 на каждый резидентный чанк.
  const residents = stream.residentIds.length;
  const before = counts.land + counts.bed;
  for (let i = 0; i < 6; i++) step();
  assert.equal(counts.land + counts.bed, before, "повторная сборка уже готовых чанков");
  assert.equal(counts.land, residents, "на каждый чанк ровно одна земля");
  assert.equal(counts.bed, residents, "на каждый чанк ровно одно дно");
});

test("видимые чанки достраиваются в том же кадре — в мире нет дырок", (t) => {
  const { stream, f, counts } = rig(t);
  let visible = 0;
  stream.update(f, 2300, 1280, 1);
  stream.draw(f, () => {
    visible++;
  });
  assert.ok(visible >= 2, "кадр накрывает два региона");
  assert.equal(counts.land, visible, "у каждого видимого чанка собрана земля");
  assert.equal(counts.bed, visible, "у каждого видимого чанка собрано дно");
});
