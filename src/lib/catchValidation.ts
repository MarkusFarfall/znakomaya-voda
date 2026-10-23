import { FISH_BY_ID, VARIANT_INFO } from "@/game/fish";
import type { LocId, Variant } from "@/game/types";

/** Ограничение нужно и для чисел, и для безопасной записи в integer PostgreSQL. */
export const MAX_CATCH_GAME_DAY = 1_000_000;

export interface CatchPayload {
  fishId?: unknown;
  weight?: unknown;
  variant?: unknown;
  locationId?: unknown;
  gameDay?: unknown;
}

export interface ValidCatchPayload {
  fishId: string;
  weight: number;
  variant: Variant | null;
  locationId: LocId;
  gameDay: number;
}

export type CatchValidation =
  | { ok: true; value: ValidCatchPayload }
  | { ok: false; error: "bad catch" | "bad location" | "bad variant" | "bad game day" };

/**
 * Проверка записи улова до обращения к базе. Она не доказывает честность игрового
 * процесса, но отсекает несовместимые с миром и схемой данные.
 */
export function validateCatchPayload(payload: CatchPayload | null | undefined): CatchValidation {
  if (!payload || typeof payload !== "object") return { ok: false, error: "bad catch" };
  const fishId = typeof payload.fishId === "string" ? payload.fishId : "";
  const fish = FISH_BY_ID[fishId];
  const weight = payload.weight;
  if (!fish || typeof weight !== "number" || !Number.isFinite(weight) || !(weight > 0) || weight > fish.weight[1] * 1.05) {
    return { ok: false, error: "bad catch" };
  }

  const locationId = typeof payload.locationId === "string" ? payload.locationId : "";
  if (!fish.loc.includes(locationId as LocId)) return { ok: false, error: "bad location" };

  let variant: Variant | null = null;
  if (payload.variant !== undefined && payload.variant !== null && payload.variant !== "") {
    if (typeof payload.variant !== "string" || !Object.hasOwn(VARIANT_INFO, payload.variant)) return { ok: false, error: "bad variant" };
    variant = payload.variant as Variant;
  }

  let gameDay = 1;
  if (payload.gameDay !== undefined) {
    if (typeof payload.gameDay !== "number" || !Number.isFinite(payload.gameDay)) return { ok: false, error: "bad game day" };
    gameDay = Math.max(1, Math.min(MAX_CATCH_GAME_DAY, Math.floor(payload.gameDay)));
  }

  return { ok: true, value: { fishId, weight, variant, locationId: locationId as LocId, gameDay } };
}
