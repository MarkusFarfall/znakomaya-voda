import type { FishDef, Rarity } from "./types";

/** Общие константы механики и её HUD — без зависимостей от DOM и сохранений. */
export const BITE_WINDOWS: Record<Rarity, number> = {
  common: 1.3, uncommon: 1.15, rare: 1, epic: 0.9, legendary: 0.8,
};
export const SURGE_WARNING_TIME = 0.55;
export const FIGHT_PANEL_HEIGHT = 128;

/** Подход не отнимает время у подсечки. Активная рыба берёт быстрее. */
export function biteApproachSeconds(fish: Pick<FishDef, "strength" | "shape">, roll: number) {
  const quick = fish.strength >= 7 || fish.shape === "billfish" || fish.shape === "shark";
  return (quick ? 0.45 : 0.9) + Math.max(0, Math.min(1, roll)) * (quick ? 0.3 : 0.55);
}
