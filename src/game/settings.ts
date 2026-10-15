export interface Settings {
  controls: {
    sailing: "arrows" | "point";
    fishing: "buttons" | "canvas";
    hand: "left" | "right";
    size: number;
    opacity: number;
  };
  quality: number;
  sound: boolean;
  music: boolean;
  volume: number;
  zoom: number;
  gfx: {
    refl: boolean;
    shafts: boolean;
    caustics: boolean;
    foam: boolean;
    precip: boolean;
  };
  model3d: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  controls: {
    sailing: "arrows",
    fishing: "buttons",
    hand: "right",
    size: 1,
    opacity: 0.95,
  },
  quality: 2,
  sound: true,
  music: true,
  volume: 0.8,
  zoom: 1,
  gfx: { refl: true, shafts: true, caustics: true, foam: true, precip: true },
  model3d: true,
};
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const bool = (v: unknown, fallback: boolean) =>
  typeof v === "boolean" ? v : fallback;
const num = (v: unknown, fallback: number, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.max(lo, Math.min(hi, v))
    : fallback;
/** Old / partially written preferences cannot inject NaN or invalid audio and canvas values. */
export function normalizeSettings(value: unknown): Settings {
  const a = record(value),
    g = record(a.gfx),
    c = record(a.controls),
    d = DEFAULT_SETTINGS;
  return {
    controls: {
      sailing: c.sailing === "point" ? "point" : "arrows",
      fishing: c.fishing === "canvas" ? "canvas" : "buttons",
      hand: c.hand === "left" ? "left" : "right",
      size: num(c.size, 1, 0.85, 1.2),
      opacity: num(c.opacity, 0.95, 0.65, 1),
    },
    quality: Math.round(num(a.quality, d.quality, 0, 2)),
    sound: bool(a.sound, d.sound),
    music: bool(a.music, d.music),
    volume: num(a.volume, d.volume, 0, 1),
    zoom: num(a.zoom, d.zoom, 1, 2),
    model3d: bool(a.model3d, d.model3d),
    gfx: {
      refl: bool(g.refl, true),
      shafts: bool(g.shafts, true),
      caustics: bool(g.caustics, true),
      foam: bool(g.foam, true),
      precip: bool(g.precip, true),
    },
  };
}
