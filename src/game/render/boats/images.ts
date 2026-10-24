/**
 * Прозрачные WebP судов: исходники лежат в assets/boats/, а production-файлы
 * заранее собираются через scripts/prepare-boats.py.
 */
import type { BoatStyle } from "../../types";

export const BOAT_IMAGES: Record<BoatStyle, string> = {
  row: "/boats/row.webp",
  kayak: "/boats/kayak.webp",
  dinghy: "/boats/dinghy.webp",
  barkas: "/boats/barkas.webp",
  cutter: "/boats/cutter.webp",
  yacht: "/boats/yacht.webp",
  seiner: "/boats/seiner.webp",
  trawler: "/boats/trawler.webp",
  research: "/boats/research.webp",
};
