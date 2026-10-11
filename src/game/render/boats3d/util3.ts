/** Мелкие общие функции модуля «море». Без зависимостей. */
export type RGB = [number, number, number];

export const G = 9.81;
export const TAU = Math.PI * 2;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Экспоненциальное приближение к цели, не зависит от частоты кадров */
export const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
export const fin = (v: number, fallback = 0) => (Number.isFinite(v) ? v : fallback);

/** Детерминированный генератор (xorshift32) */
export function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** Быстрый хэш → [0,1) */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Гладкий псевдошум 0..1 */
export const nz = (x: number, s: number) => 0.5 + 0.5 * (Math.sin(x + s) * 0.5 + Math.sin(x * 2.3 + s * 1.7) * 0.3 + Math.sin(x * 5.1 + s * 3.1) * 0.2);

/* ───── цвет ───── */
export function hexRgb(hex: string): RGB {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const b2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
export const rgbHex = (c: RGB) => '#' + b2(c[0]) + b2(c[1]) + b2(c[2]);
export const rgbCss = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
export function mix(a: string, b: string, t: number): string {
  const A = hexRgb(a);
  const B = hexRgb(b);
  return rgbHex([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]);
}
export const mixRgb = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export function hexA(hex: string, a: number) {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;
}
