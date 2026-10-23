import type { Rarity } from "./types";
import { SONARS } from "./world";
import { depthToU, uToDepth } from "./depth";

/** Режимы прибора: общий столб воды, только отметки рыбы или только рельеф. */
export type SonarMode = "full" | "fish" | "bottom";
export const SONAR_MODE_ORDER: readonly SonarMode[] = ["full", "fish", "bottom"];
export const SONAR_MODE_LABEL: Record<SonarMode, string> = {
  full: "Обзор",
  fish: "Рыба",
  bottom: "Рельеф",
};

export interface SonarBand {
  depth: number;
  count: number;
  fresh: number;
  best: Rarity | null;
  legend: boolean;
  /** Условная сила отметки для визуализации, не шанс клёва. */
  signal: number;
}

export interface SonarCandidate {
  id: string;
  rarity: Rarity;
  known: boolean;
}

export function normalizeSonarLevel(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.max(0, Math.min(SONARS.length - 1, n));
}

export function normalizeSonarEnabled(value: unknown, fallback = true): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeSonarMode(value: unknown): SonarMode {
  return SONAR_MODE_ORDER.includes(value as SonarMode) ? value as SonarMode : "full";
}

export function nextSonarMode(value: unknown): SonarMode {
  const current = normalizeSonarMode(value);
  return SONAR_MODE_ORDER[(SONAR_MODE_ORDER.indexOf(current) + 1) % SONAR_MODE_ORDER.length];
}

export function sonarIsActive(level: unknown, enabled: unknown): boolean {
  return normalizeSonarLevel(level) > 0 && enabled === true;
}

const RARITY_ORDER: readonly Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/**
 * Строит отметки прибора по кандидатам текущего места. Это визуализация уже
 * существующих условий ловли: шансы и состав кандидатов здесь не меняются.
 */
export function scanSonarBands(
  maxDepth: number,
  bands: number,
  candidatesAt: (depth: number) => Iterable<SonarCandidate>,
): SonarBand[] {
  if (!Number.isFinite(maxDepth) || maxDepth <= 0) return [];
  const count = Math.max(1, Math.min(48, Math.floor(Number.isFinite(bands) ? bands : 18)));
  const maxU = depthToU(maxDepth);
  const out: SonarBand[] = [];
  for (let i = 0; i < count; i++) {
    const depth = uToDepth((maxU * (i + 0.5)) / count);
    let total = 0, fresh = 0, best: Rarity | null = null, legend = false;
    for (const candidate of candidatesAt(depth)) {
      total++;
      if (!candidate.known) fresh++;
      if (!best || RARITY_ORDER.indexOf(candidate.rarity) > RARITY_ORDER.indexOf(best)) best = candidate.rarity;
      if (candidate.rarity === "legendary") legend = true;
    }
    out.push({ depth, count: total, fresh, best, legend, signal: Math.min(1, total / 6) });
  }
  return out;
}
