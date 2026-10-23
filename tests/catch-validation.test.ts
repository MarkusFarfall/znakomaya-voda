import test from "node:test";
import assert from "node:assert/strict";
import { MAX_CATCH_GAME_DAY, validateCatchPayload } from "../src/lib/catchValidation";

test("допустимый улов нормализуется без изменения смысла", () => {
  const result = validateCatchPayload({ fishId: "goby", weight: 0.2, variant: "trophy", locationId: "bay", gameDay: 3 });
  assert.deepEqual(result, { ok: true, value: { fishId: "goby", weight: 0.2, variant: "trophy", locationId: "bay", gameDay: 3 } });
});

test("рыба не принимается в чужую акваторию", () => {
  assert.deepEqual(validateCatchPayload({ fishId: "turbot", weight: 3.2, locationId: "cape" }), { ok: false, error: "bad location" });
  const valid = validateCatchPayload({ fishId: "sea_bass", weight: 3.2, locationId: "cape" });
  assert.equal(valid.ok, true);
});

test("вариант берётся только из собственных ключей каталога", () => {
  for (const variant of ["hacked", "toString", "constructor", "__proto__"]) {
    assert.deepEqual(validateCatchPayload({ fishId: "goby", weight: 0.2, variant, locationId: "bay" }), { ok: false, error: "bad variant" });
  }
  for (const variant of [null, "", undefined]) {
    const result = validateCatchPayload({ fishId: "goby", weight: 0.2, variant, locationId: "bay" });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.variant, null);
  }
});

test("вес должен быть конечным, положительным и возможным для вида", () => {
  for (const weight of [NaN, Infinity, -Infinity, -1, 0, 99]) {
    assert.deepEqual(validateCatchPayload({ fishId: "turbot", weight, locationId: "bay" }), { ok: false, error: "bad catch" });
  }
});

test("день улова ограничен конечным безопасным целым", () => {
  const negative = validateCatchPayload({ fishId: "goby", weight: 0.2, locationId: "bay", gameDay: -10 });
  assert.equal(negative.ok, true);
  if (negative.ok) assert.equal(negative.value.gameDay, 1);

  const fraction = validateCatchPayload({ fishId: "goby", weight: 0.2, locationId: "bay", gameDay: 3.9 });
  assert.equal(fraction.ok, true);
  if (fraction.ok) assert.equal(fraction.value.gameDay, 3);

  const huge = validateCatchPayload({ fishId: "goby", weight: 0.2, locationId: "bay", gameDay: Number.MAX_SAFE_INTEGER });
  assert.equal(huge.ok, true);
  if (huge.ok) assert.equal(huge.value.gameDay, MAX_CATCH_GAME_DAY);

  for (const gameDay of [NaN, Infinity, -Infinity, "3"]) {
    assert.deepEqual(validateCatchPayload({ fishId: "goby", weight: 0.2, locationId: "bay", gameDay }), { ok: false, error: "bad game day" });
  }
});

test("неизвестный вид и пустое тело не проходят", () => {
  assert.deepEqual(validateCatchPayload({ fishId: "unknown", weight: 1, locationId: "bay" }), { ok: false, error: "bad catch" });
  assert.deepEqual(validateCatchPayload(null), { ok: false, error: "bad catch" });
});
