import type { SpotFeature } from './types';

export interface WaveMotion {
  /** Vertical displacement in screen-space pixels. */
  height: number;
  /** dh/dx: pixels per world unit. */
  slope: number;
  /** Vertical surface velocity in pixels per real second. */
  velocity: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : 0));

/** Four coherent, world-anchored wave bands; the last two add visible wind chop. */
const SPECTRUM = [
  { k: 0.0037, omega: 0.43, weight: 0.46, phase: 0.4 },
  { k: 0.0105, omega: 0.98, weight: 0.29, phase: 2.1 },
  { k: 0.0260, omega: 1.82, weight: 0.17, phase: 4.3 },
  { k: 0.0590, omega: 3.05, weight: 0.08, phase: 5.6 },
] as const;

/** A bounded sea-state envelope shared by the surface, hull response and motion cues. */
export function waveAmplitudePx(
  weatherWaves: number,
  locationScale: number,
  localSwell: number,
  windMps: number,
  pixelScale = 1,
  calm = false,
) {
  const state = clamp(weatherWaves, 0, 5) * clamp(locationScale, 0.15, 2.5) * clamp(localSwell, 0.35, 2);
  const chop = clamp(windMps, 0, 32) / 18;
  const calmScale = calm ? 0.34 : 1;
  return clamp((2.8 + 4.6 * Math.sqrt(state) + 1.2 * chop) * clamp(pixelScale, 0.3, 2), 0.8, 38) * calmScale;
}

/**
 * Deterministic surface kinematics. Sampling the same (x, time, amplitude, wind direction)
 * always returns the same height, slope and vertical velocity, including at streamed seams.
 */
export function sampleWave(x: number, time: number, amplitude: number, windDir = 1): WaveMotion {
  const d = windDir < 0 ? -1 : 1;
  const a = clamp(amplitude, 0, 40);
  const t = Number.isFinite(time) ? time : 0;
  let height = 0, slope = 0, velocity = 0;
  for (const band of SPECTRUM) {
    const phase = band.k * x - band.omega * t * d + band.phase;
    const s = Math.sin(phase), c = Math.cos(phase);
    height += band.weight * s;
    slope += band.weight * band.k * c;
    velocity -= band.weight * band.omega * d * c;
  }
  return { height: a * height, slope: a * slope, velocity: a * velocity };
}

const CURRENT_STRENGTH: Partial<Record<SpotFeature, number>> = {
  current: 6.4,
  sound: 4.8,
  channel: 4.2,
  waterfall: 3.8,
  creek: 3.4,
  sargassum: 3.2,
  seamount: 2.8,
  blue: 2.5,
  roots: 1.6,
  sandbar: 1.4,
  pier: 1.2,
  deep: 1.5,
  wall: 1.8,
};

/** Along-world current in world units/second; stronger, legible flows live at habitat features. */
export function currentAt(
  feature: SpotFeature,
  x: number,
  time: number,
  seed = 0,
  windMps = 0,
  windDir = 1,
) {
  const strength = CURRENT_STRENGTH[feature] ?? 0.8;
  const phase = x * 0.00165 + (Number.isFinite(time) ? time : 0) * 0.105 + seed * 2.73;
  const tide = Math.sin(phase) * 0.72 + Math.sin(phase * 0.47 + 1.3) * 0.28;
  const windDrift = clamp(windMps, 0, 32) * 0.045 * (windDir < 0 ? -1 : 1);
  return clamp(strength * tide + windDrift, -8, 8);
}

/** How much of the current changes speed over ground without creating idle drift. */
export function currentSpeedFactor(current: number, travelDirection: -1 | 1) {
  return clamp(1 + clamp(current, -8, 8) * travelDirection / 72, 0.84, 1.16);
}
