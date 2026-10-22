/**
 * Скалистый мыс: линии породы живут только на камне обрыва.
 *
 * Раньше старт каждой линии считался по линейной доле высоты, хотя кромка
 * обрыва построена через smoothstep. Верхние линии начинались левее силуэта
 * и висели в небе над морем. Тест строит геометрию обрыва и проверяет, что
 * каждая точка текстуры лежит внутри контура скалы.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { LandRenderer } from "../src/game/render/land";
import { LOC_BY_ID, SPOT_BY_ID } from "../src/game/world";
import type { Frame } from "../src/game/render/frame";

function capeFrame(W: number, H: number, spotId: string): Frame {
  const spot = SPOT_BY_ID[spotId];
  const sY = H * 0.46;
  return {
    W,
    H,
    sY,
    hY: sY - H * 0.095,
    spot,
    loc: LOC_BY_ID.cape,
    e: { season: 1 },
    atmo: { snowCover: 0 },
  } as unknown as Frame;
}

function pointInside(pts: number[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

for (const [W, H] of [[1280, 720], [412, 915], [540, 1170]]) {
  for (const spotId of ["cape_arch", "cape_current", "cape_wall"]) {
    test(`страта обрыва внутри камня: ${spotId} ${W}x${H}`, () => {
      const land = new LandRenderer();
      land.build(capeFrame(W, H, spotId));
      const strata = (land as unknown as { strata: { pts: number[] }[] }).strata;
      const cliff = land.layers[(land as unknown as { cliffLayer: number }).cliffLayer];
      assert.ok(cliff, "слой обрыва должен существовать");
      assert.equal(strata.length, 7, "у обрыва семь линий породы");
      for (const [i, s] of strata.entries()) {
        assert.ok(s.pts.length >= 4, `линия ${i} не пустая`);
        for (let k = 0; k < s.pts.length; k += 2) {
          const x = s.pts[k], y = s.pts[k + 1];
          assert.ok(
            pointInside(cliff.pts, x, y),
            `линия ${i}: точка (${x.toFixed(1)}, ${y.toFixed(1)}) вне силуэта скалы`,
          );
        }
      }
    });
  }
}
