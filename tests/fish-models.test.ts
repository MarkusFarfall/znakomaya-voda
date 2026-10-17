import assert from "node:assert/strict";
import test from "node:test";
import { FISH } from "../src/game/fish";
import { CURATED_FISH_MODEL_IDS, getMorph } from "../src/game/morph";

const fishById = new Map(FISH.map((fish) => [fish.id, fish]));

test("the curated model cohort is exactly codex entries 1–50", () => {
  assert.equal(CURATED_FISH_MODEL_IDS.length, 50);
  assert.deepEqual(FISH.slice(0, 50).map((fish) => fish.id), CURATED_FISH_MODEL_IDS);
});

test("the first 50 fish have deterministic, finite morphology", () => {
  for (const id of CURATED_FISH_MODEL_IDS) {
    const fish = fishById.get(id);
    assert.ok(fish, `missing fish definition: ${id}`);
    const morph = getMorph(fish);
    assert.deepEqual(getMorph(fish), morph, `${id} should keep a stable profile`);
    for (const [key, value] of Object.entries(morph)) {
      if (typeof value === "number") assert.ok(Number.isFinite(value), `${id}.${key} must be finite`);
    }
    assert.ok(morph.depth >= 0.5 && morph.depth <= 1.5, `${id} body depth should stay in a readable range`);
    assert.ok(morph.dorsalH >= 0.5 && morph.dorsalH <= 1.6, `${id} dorsal fin should stay in a readable range`);
  }
});

test("recognizable anatomical accents are assigned to the intended species", () => {
  const morph = (id: string) => getMorph(fishById.get(id)!);

  assert.equal(morph("goby").pelvicDisc, true);
  assert.equal(morph("black_goby").pelvicDisc, true);
  assert.equal(morph("horse_mackerel").lateralScutes, true);
  assert.equal(morph("red_mullet").barbels, 2);
  assert.equal(morph("blenny").headCirri, true);
  assert.equal(morph("saddled_bream").caudalBand, true);
  assert.equal(morph("bonito").finlets, true);
  assert.equal(morph("bonito").tail, "lunate");
  assert.equal(morph("bluefish").visibleTeeth, true);
  assert.equal(morph("zander").visibleTeeth, true);
  assert.equal(morph("golden_mullet").opercularSpot, true);
  assert.equal(morph("scorpionfish").dorsal, "spiny");
  assert.equal(morph("stargazer").jaw, "up");
  assert.equal(morph("starry_sturgeon").snoutLen, 0.2);
  assert.ok(morph("starry_sturgeon").snoutLen > morph("sturgeon").snoutLen);
});
