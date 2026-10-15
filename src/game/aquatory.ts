import type { LocId } from "./types";
import { bedFrac, spotsOf } from "./world";
import { normalizeLocalPosition, SPOT_WORLD_WIDTH } from "./navigation";

export const REGION_WIDTH = SPOT_WORLD_WIDTH;
export const COAST_MARGIN = 240;
export const SEAM_HALF = 180;
export interface WaterPosition {
  location: LocId;
  x: number;
  heading: 1 | -1;
}
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const regions = new Map<LocId, ReturnType<typeof spotsOf>>();
export function waterRegions(loc: LocId) {
  let list = regions.get(loc);
  if (!list) {
    list = spotsOf(loc);
    regions.set(loc, list);
  }
  return list;
}
export const waterWidth = (loc: LocId) =>
  waterRegions(loc).length * REGION_WIDTH;
export function regionAt(loc: LocId, x: number) {
  const list = waterRegions(loc);
  const index = clamp(Math.floor(x / REGION_WIDTH), 0, list.length - 1);
  return {
    spot: list[index],
    index,
    offset: index * REGION_WIDTH,
    nx: clamp(x / REGION_WIDTH - index, 0, 1),
  };
}
export function regionDestination(loc: LocId, id: string) {
  const index = waterRegions(loc).findIndex((s) => s.id === id);
  return index < 0 ? null : ((index + 0.5) * REGION_WIDTH) / waterWidth(loc);
}
/** Shared metre depth; Hermite seams preserve both depth and incoming/outgoing slope. */
export function waterBedAt(loc: LocId, x: number): number {
  const list = waterRegions(loc),
    width = waterWidth(loc);
  x = clamp(x, 0, width);
  const boundary = Math.round(x / REGION_WIDTH),
    b = boundary * REGION_WIDTH;
  const sample = (i: number, localX: number) =>
    list[i].maxDepth * bedFrac(list[i], clamp(localX / REGION_WIDTH, 0, 1));
  if (boundary > 0 && boundary < list.length && Math.abs(x - b) < SEAM_HALF) {
    const span = SEAM_HALF * 2,
      t = (x - b + SEAM_HALF) / span;
    const a = sample(boundary - 1, REGION_WIDTH - SEAM_HALF),
      z = sample(boundary, SEAM_HALF);
    const ma =
      ((sample(boundary - 1, REGION_WIDTH - SEAM_HALF + 1) -
        sample(boundary - 1, REGION_WIDTH - SEAM_HALF - 1)) *
        span) /
      2;
    const mz =
      ((sample(boundary, SEAM_HALF + 1) - sample(boundary, SEAM_HALF - 1)) *
        span) /
      2;
    const d =
      (2 * t * t * t - 3 * t * t + 1) * a +
      (t * t * t - 2 * t * t + t) * ma +
      (-2 * t * t * t + 3 * t * t) * z +
      (t * t * t - t * t) * mz;
    return clamp(
      d,
      0.1,
      Math.max(list[boundary - 1].maxDepth, list[boundary].maxDepth),
    );
  }
  const r = regionAt(loc, x);
  return sample(r.index, x - r.offset);
}
export function waterSwell(loc: LocId, x: number) {
  const r = regionAt(loc, x),
    list = waterRegions(loc),
    b = Math.round(x / REGION_WIDTH),
    edge = b * REGION_WIDTH;
  if (b > 0 && b < list.length && Math.abs(x - edge) < SEAM_HALF) {
    const t = (x - edge + SEAM_HALF) / (2 * SEAM_HALF),
      k = t * t * (3 - 2 * t);
    return (list[b - 1].swell ?? 1) * (1 - k) + (list[b].swell ?? 1) * k;
  }
  return r.spot.swell ?? 1;
}
export function normalizeWaterPosition(
  raw: unknown,
  location: LocId,
  oldSpot: string,
  oldPosition?: unknown,
): WaterPosition {
  const a =
    raw && typeof raw === "object" ? (raw as Partial<WaterPosition>) : {};
  const width = waterWidth(location);
  if (
    a.location === location &&
    typeof a.x === "number" &&
    Number.isFinite(a.x)
  )
    return {
      location,
      x: clamp(a.x, COAST_MARGIN / width, 1 - COAST_MARGIN / width),
      heading: a.heading === -1 ? -1 : 1,
    };
  const index = Math.max(
    0,
    waterRegions(location).findIndex((s) => s.id === oldSpot),
  );
  const old = normalizeLocalPosition(oldPosition, oldSpot);
  return {
    location,
    x: ((index + old.x) * REGION_WIDTH) / width,
    heading: old.heading,
  };
}
/** Visible sections and at most one approaching neighbour. Definitions are bundled; geometry is lazy. */
export function streamPlan(
  loc: LocId,
  left: number,
  width: number,
  direction: number,
) {
  const n = waterRegions(loc).length;
  const first = clamp(Math.floor(left / REGION_WIDTH), 0, n - 1),
    last = clamp(
      Math.floor((left + Math.max(1, width) - 0.001) / REGION_WIDTH),
      first,
      n - 1,
    );
  const visible = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const ahead = direction < 0 ? first - 1 : last + 1;
  const near =
    direction < 0
      ? left - first * REGION_WIDTH < 520
      : (last + 1) * REGION_WIDTH - left - width < 520;
  const resident = [...visible];
  if (near && ahead >= 0 && ahead < n) resident.push(ahead);
  return { visible, resident };
}
export class ChunkWindow<T> {
  readonly chunks = new Map<number, T>();
  private location: LocId | null = null;
  sync(loc: LocId, ids: number[], create: (id: number) => T) {
    if (this.location !== loc) {
      this.chunks.clear();
      this.location = loc;
    }
    for (const id of this.chunks.keys())
      if (!ids.includes(id)) this.chunks.delete(id);
    for (const id of ids)
      if (!this.chunks.has(id)) this.chunks.set(id, create(id));
  }
}
