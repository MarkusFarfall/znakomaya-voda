import type { Atmosphere } from '../atmosphere';
import type { CtxInput } from './director';

export * from './types';
export { EVENTS, TIER_INFO, effectChips } from './catalog';
export { EventDirector, type CtxInput, type ActiveInfo, type DirectorOptions } from './director';

/** Контекст событий из состояния атмосферы (+ данные игры, если есть) */
export function ctxFromAtmosphere(
  atm: Atmosphere,
  extra: { loc?: string | null; deep?: boolean; feature?: string | null; localDepth?: number } = {},
  out?: CtxInput,
): CtxInput {
  const s = atm.state;
  const ctx = out ?? {} as CtxInput;
  ctx.day = s.day;
  ctx.hour = s.hour;
  ctx.season = s.season;
  ctx.climate = atm.climate;
  ctx.kind = s.kind;
  ctx.weather = atm.weatherId;
  ctx.daylight = s.daylight;
  ctx.night = s.night;
  ctx.golden = s.golden;
  ctx.sunElev = s.sunElev;
  ctx.temp = s.temp;
  ctx.wind = s.wind;
  ctx.fog = s.fog;
  ctx.rain = s.rain;
  ctx.snow = s.snow;
  ctx.cover = s.cover;
  ctx.dark = s.dark;
  ctx.waves = s.waves;
  ctx.moonPhase = s.moonPhase;
  ctx.moonIllum = s.moonIllum;
  ctx.starVis = s.starVis;
  ctx.aurora = s.aurora;
  ctx.wetness = s.wetness;
  ctx.loc = extra.loc ?? null;
  ctx.deep = extra.deep ?? false;
  ctx.feature = extra.feature ?? null;
  ctx.localDepth = extra.localDepth ?? 0;
  return ctx;
}
