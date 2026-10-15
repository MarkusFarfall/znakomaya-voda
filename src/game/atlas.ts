import type { LocId, PortId } from "./types";
import type { Engine } from "./engine";
import { LOCATIONS, LOC_POS, PORTS, spotsOf } from "./world";

export type AtlasTarget =
  { kind: "loc"; id: LocId } | { kind: "port"; id: PortId };
export type AtlasView = { x: number; y: number; zoom: number };
export const atlasKey = (t: AtlasTarget) => `${t.kind}:${t.id}`;
export const atlasPoint = (p: readonly number[]) =>
  [p[0] * 10, p[1] * 6.25] as const;
export const atlasTargets: AtlasTarget[] = [
  ...PORTS.map((p) => ({ kind: "port" as const, id: p.id })),
  ...LOCATIONS.map((l) => ({ kind: "loc" as const, id: l.id })),
];
export const targetPoint = (t: AtlasTarget) =>
  atlasPoint(
    t.kind === "loc" ? LOC_POS[t.id] : PORTS.find((p) => p.id === t.id)!.pos,
  );
export function clampAtlasView(v: AtlasView): AtlasView {
  const zoom = Math.max(1, Math.min(3, Number.isFinite(v.zoom) ? v.zoom : 1));
  return {
    zoom,
    x: Math.max(0, Math.min(1000 - 1000 / zoom, v.x || 0)),
    y: Math.max(0, Math.min(625 - 625 / zoom, v.y || 0)),
  };
}
export function zoomAtlas(
  v: AtlasView,
  zoom: number,
  anchor: readonly number[] = [v.x + 500 / v.zoom, v.y + 312.5 / v.zoom],
) {
  const z = Math.max(1, Math.min(3, zoom));
  return clampAtlasView({
    zoom: z,
    x: anchor[0] - ((anchor[0] - v.x) * v.zoom) / z,
    y: anchor[1] - ((anchor[1] - v.y) * v.zoom) / z,
  });
}
export function atlasRoute(engine: Engine, target: AtlasTarget, spot?: string) {
  const trip =
    target.kind === "port"
      ? { kind: "port" as const, port: target.id }
      : {
          kind: "loc" as const,
          loc: target.id,
          spot: spot ?? spotsOf(target.id)[0].id,
        };
  const local =
    target.kind === "loc" &&
    !engine.s.atPort &&
    engine.s.location === target.id;
  const here =
    target.kind === "port"
      ? engine.s.atPort && engine.s.port === target.id
      : local && trip.kind === "loc" && engine.s.spot === trip.spot;
  const sail = local
    ? {
        minutes: 20,
        fuel: Math.min(engine.s.money, Math.round(engine.boat.fuel / 3)),
      }
    : engine.tripQuote(trip, "sail");
  const motor = local ? sail : engine.tripQuote(trip, "motor");
  const blocked = here
    ? "Вы уже здесь"
    : local
      ? ["fight", "caught", "bite"].includes(engine.phase)
        ? "Сначала закончите с рыбой"
        : null
      : engine.tripBlock(trip, "sail");
  return { trip, local, here, sail, motor, blocked };
}
