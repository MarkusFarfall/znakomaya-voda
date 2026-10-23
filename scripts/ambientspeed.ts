/**
 * Диагностика фоновой жизни на горизонте: сколько секунд идёт каждая история
 * через кадр 1280 px и с какой скоростью. Скорость и размер берутся из одной
 * PERSP-таблицы, поэтому цифры совпадают с тем, что видит игрок.
 *
 *   npx tsx scripts/ambientspeed.ts [ширина] [масштаб сцены]
 */
import { ambientPath, passerSpeed } from "../src/game/render/ambient";

const W = Number(process.argv[2] ?? 1280);
const sc = Number(process.argv[3] ?? 0.8);
const kinds = ["cargo", "sailboat", "trawler", "canoe", "birds", "plane", "heron", "balloon", "orca", "dolphins"] as const;
const depths = [0.2, 0.45, 0.75];

console.log(`Кадр ${W} px, масштаб сцены ${sc}. Секунды на проход (чем больше — тем медленнее):`);
const head = ["вид", ...depths.map((p) => `p=${p}`)].join("\t");
console.log(head);
for (const kind of kinds) {
  const cells = depths.map((p) => {
    const speed = passerSpeed(kind, p, sc)!;
    const path = ambientPath(0, W, 1, 80 * sc, speed);
    return `${path.duration.toFixed(0)} с (${speed.toFixed(1)} px/с)`;
  });
  console.log([kind, ...cells].join("\t"));
}
