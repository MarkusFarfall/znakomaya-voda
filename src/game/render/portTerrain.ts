/** Shared contour math: decorations must use the exact same surface as the painted ground. */
export function hillY(x: number, center: number, halfWidth: number, height: number, horizon: number) {
  const q = (x - center) / halfWidth;
  return horizon - height * Math.max(0, 1 - q * q) * (0.9 + Math.sin(x * 0.03) * 0.08);
}

/** Invert the monotonic x coordinate of a quadratic Bézier, then evaluate its y. */
export function quadraticGroundY(x: number, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) {
  const a = x0 - 2 * x1 + x2, b = 2 * (x1 - x0), delta = Math.max(0, Math.min(x2 - x0, x - x0));
  const t = Math.abs(a) < 1e-8 ? delta / b : 2 * delta / (b + Math.sqrt(Math.max(0, b * b + 4 * a * delta)));
  return (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t * t * y2;
}

/** A flat foundation must touch the lowest point under the whole footprint, not just its centre. */
export function groundedFoot(surface: (x: number) => number, x: number, halfWidth: number, setback = 0) {
  let y = -Infinity;
  for (let i = 0; i <= 8; i++) y = Math.max(y, surface(x - halfWidth + halfWidth * i / 4));
  return y + setback;
}

export const miradorHillY = (W: number, H: number, horizon: number, x: number) =>
  quadraticGroundY(x, W * 0.4, horizon + 2, W * 0.72, horizon - H * 0.26, W * 1.05, horizon - H * 0.05);

export const coralHillY = (W: number, H: number, horizon: number, x: number) => x <= W * 0.9
  ? quadraticGroundY(x, W * 0.5, horizon + 2, W * 0.72, horizon - H * 0.14, W * 0.9, horizon - H * 0.06)
  : quadraticGroundY(x, W * 0.9, horizon - H * 0.06, W * 0.96, horizon - H * 0.03, W * 1.02, horizon - H * 0.08);

/** Keep even research vessels inside the reserved right-hand berth on narrow screens. */
export function berthScale(W: number, x: number, preferred: number, naturalWidth: number) {
  const halfRoom = Math.max(1, Math.min(x - W * .55, W - 12 - x));
  return Math.min(preferred, halfRoom * 2 / naturalWidth);
}
