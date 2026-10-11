/**
 * Рисунки судов (Next.js): файлы лежат в public/boats/, фон #FF00FF
 * вырезается загрузчиком (boats/sprites.ts).
 */
import type { BoatStyle } from "../../types";

export const BOAT_IMAGES: Record<BoatStyle, string> = {
  row: "/boats/row.jpg",
  kayak: "/boats/kayak.jpg",
  dinghy: "/boats/dinghy.jpg",
  barkas: "/boats/barkas.jpg",
  cutter: "/boats/cutter.jpg",
  yacht: "/boats/yacht.jpg",
  seiner: "/boats/seiner.jpg",
  trawler: "/boats/trawler.jpg",
  research: "/boats/research.jpg",
};
