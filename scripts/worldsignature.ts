/**
 * Подпись мира: отпечаток данных мира и композиции дна.
 *
 * Правило проекта — оптимизации и правки рендера не меняют мир. Поэтому любые
 * изменения геометрии, силуэтов, расстановки или поведения должны менять эту
 * подпись осознанно: сравни старое и новое значение и объясни разницу.
 *
 *   npx tsx scripts/worldsignature.ts         # текущая подпись
 *   npx tsx scripts/worldsignature.ts --json  # полный дамп для диффа
 */
import { createHash } from "node:crypto";
import { LOCATIONS, SPOTS, BOATS, RODS, REELS, LINES, BAITS, PORTS } from "../src/game/world";
import { FISH } from "../src/game/fish";
import { bedFormations } from "../src/game/render/seabedLandscape";

const world = {
  locations: LOCATIONS,
  spots: SPOTS,
  ports: PORTS,
  boats: BOATS,
  gear: { RODS, REELS, LINES, BAITS },
  fish: FISH.map((f) => [f.id, f.name, f.rarity, f.weight, f.price, f.depth, f.loc]),
  beds: LOCATIONS.map((l) => bedFormations(1600, 1, (l.id.length * 977 + 31) % 1000)),
};

const json = JSON.stringify(world);
const hash = createHash("sha256").update(json).digest("hex");

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(world, null, 1));
} else {
  console.log(`мир: ${LOCATIONS.length} акваторий, ${SPOTS.length} точек, ${PORTS.length} портов, ${FISH.length} рыб`);
  console.log(`подпись: ${hash.slice(0, 16)}`);
}
