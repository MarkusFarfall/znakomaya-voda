import { performance } from "node:perf_hooks";
import { regionAt, waterBedAt, waterWidth } from "../src/game/aquatory";
import { LocalNavigation } from "../src/game/navigation";
import { currentAt, sampleWave, waveAmplitudePx } from "../src/game/waterPhysics";
import { BOATS, LOC_BY_ID } from "../src/game/world";

const WARMUP = 200_000;
const ITERATIONS = 2_000_000;
const RUNS = 7;
let sink = 0;

type BenchCase = { name: string; fn: (i: number) => number };
const cases: BenchCase[] = [
  { name: "sampleWave", fn: (i) => sampleWave((i * 7.13) % 7200, i / 60, 8.5, i % 2 ? 1 : -1).height },
  { name: "currentAt", fn: (i) => currentAt("current", (i * 7.13) % 7200, i / 60, 3.2, 8, i % 2 ? 1 : -1) },
  { name: "waterBedAt", fn: (i) => waterBedAt("bay", (i * 7.13) % 7200) },
  { name: "combinedWave+Current+Bed", fn: (i) => sampleWave(i % 390, i / 60, 8.5).height + currentAt("current", i % 7200, i / 60, 3.2, 8) + waterBedAt("bay", i % 7200) },
];

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

for (const bench of cases) {
  for (let i = 0; i < WARMUP; i++) sink += bench.fn(i);
  const samples: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    const start = performance.now();
    let acc = 0;
    for (let i = 0; i < ITERATIONS; i++) acc += bench.fn(i + run * ITERATIONS);
    sink += acc;
    samples.push(performance.now() - start);
  }
  const median = percentile(samples, 0.5);
  console.log(`${bench.name.padEnd(26)} median ${median.toFixed(2)} ms / ${ITERATIONS.toLocaleString()} calls; P95-run ${percentile(samples, 0.95).toFixed(2)} ms; per call ${(median * 1000 / ITERATIONS).toFixed(4)} µs`);
}

const nav = new LocalNavigation({ x: 0.35, heading: 1 }, waterWidth("bay"));
nav.steer(1);
const boat = BOATS[0];
const loc = LOC_BY_ID.bay;
const waves = waveAmplitudePx(1.1, loc.waveMult, 1, 8, 1);
const runs: number[] = [];
for (let run = 0; run < RUNS; run++) {
  nav.stop(); nav.x = 840; nav.steer(1);
  const start = performance.now();
  for (let i = 0; i < 600_000; i++) {
    const x = nav.x;
    const region = regionAt("bay", x);
    const current = currentAt(region.spot.feature, x, i / 60, region.spot.seed, 8, 1);
    nav.step(1 / 60, boat, waves, () => current);
  }
  runs.push(performance.now() - start);
}
console.log(`navigation.step + currentAt ${percentile(runs, 0.5).toFixed(2)} ms / 600,000 steps (median, ${RUNS} runs)`);
console.log(`sink=${sink.toFixed(2)} (prevents dead-code elimination)`);
