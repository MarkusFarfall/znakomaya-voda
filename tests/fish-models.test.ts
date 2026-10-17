import assert from "node:assert/strict";
import test from "node:test";
import { FISH } from "../src/game/fish";
import { CURATED_FISH_MODEL_IDS, getMorph } from "../src/game/morph";

const fishById = new Map(FISH.map((fish) => [fish.id, fish]));
const morph = (id: string) => {
  const fish = fishById.get(id);
  assert.ok(fish, `missing fish definition: ${id}`);
  return getMorph(fish);
};

test("every codex entry from 1 through 301 has a model profile in catalog order", () => {
  assert.equal(FISH.length, 301);
  assert.equal(CURATED_FISH_MODEL_IDS.length, 301);
  assert.equal(new Set(CURATED_FISH_MODEL_IDS).size, 301, "profile IDs should be unique");
  assert.deepEqual(FISH.map((fish) => fish.id), CURATED_FISH_MODEL_IDS);
});

test("all 301 species have deterministic, finite, bounded morphology", () => {
  for (const fish of FISH) {
    const model = getMorph(fish);
    assert.deepEqual(getMorph(fish), model, `${fish.id} should keep a stable profile`);
    for (const [key, value] of Object.entries(model)) {
      if (typeof value === "number") assert.ok(Number.isFinite(value), `${fish.id}.${key} must be finite`);
    }
    assert.ok(model.depth >= 0.5 && model.depth <= 1.6, `${fish.id} body depth should remain readable`);
    assert.ok(model.dorsalH >= 0.5 && model.dorsalH <= 2, `${fish.id} dorsal fin should remain readable`);
    assert.ok(model.eye >= 0.5 && model.eye <= 1.7, `${fish.id} eye scale should remain readable`);
    assert.ok(model.patDensity >= 0.5 && model.patDensity <= 1.6, `${fish.id} pattern density should remain readable`);
  }
});

test("coastal and northern species retain their distinguishing anatomy", () => {
  assert.equal(morph("goby").pelvicDisc, true);
  assert.equal(morph("black_goby").pelvicDisc, true);
  assert.equal(morph("horse_mackerel").lateralScutes, true);
  assert.equal(morph("red_mullet").barbels, 2);
  assert.equal(morph("blenny").headCirri, true);
  assert.equal(morph("saddled_bream").caudalBand, true);
  assert.equal(morph("bonito").finlets, true);
  assert.equal(morph("bluefish").visibleTeeth, true);
  assert.equal(morph("zander").visibleTeeth, true);
  assert.equal(morph("golden_mullet").opercularSpot, true);
  assert.equal(morph("scorpionfish").dorsal, "spiny");
  assert.equal(morph("stargazer").jaw, "up");
  assert.equal(morph("starry_sturgeon").snoutLen, 0.2);
  assert.ok(morph("starry_sturgeon").snoutLen > morph("sturgeon").snoutLen);
  assert.equal(morph("cod").barbels, 1);
  assert.equal(morph("cod").dorsal, "triple");
  assert.equal(morph("mackerel").finlets, true);
  assert.equal(morph("gurnard").pectoralWing, true);
  assert.equal(morph("garfish_baltic").dorsalSpines, 3);
  assert.equal(morph("sole").jaw, "down");
  assert.equal(morph("lumpfish").pelvicDisc, true);
  assert.equal(morph("grayling").dorsal, "sail");
  assert.equal(morph("john_dory").lateralOcellus, true);
  assert.equal(morph("haddock").shoulderSpot, true);
  assert.equal(morph("spurdog_giant").thresher, true);
  assert.equal(morph("sea_eagle_trout").adipose, true);
});

test("reef, pelagic, deep-sea and polar forms use dedicated profile cues", () => {
  assert.equal(morph("clownfish").tail, "round");
  assert.equal(morph("surgeonfish").tail, "lunate");
  assert.equal(morph("parrotfish").jaw, "beak");
  assert.equal(morph("mudskipper").eye, 1.55);
  assert.equal(morph("hammerhead").hammer, true);
  assert.equal(morph("manta").depth, 1);
  assert.equal(morph("red_drum").caudalOcellus, true);
  assert.equal(morph("flying_fish").pectoralWing, true);
  assert.equal(morph("hatchetfish").depth, 1.38);
  assert.equal(morph("fangtooth").visibleTeeth, true);
  assert.equal(morph("tripodfish").pectoral, 1.32);
  assert.equal(morph("giant_squid").depth < morph("colossal_squid").depth, true);
  assert.equal(morph("abyss_snail").depth, 0.92);
  assert.equal(morph("spiny_plunderfish").dorsal, "spiny");
  assert.equal(morph("toothfish").tail, "truncate");
});
