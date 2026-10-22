'use client';

// Те же пропсы, что у src/components/game/FishIcon.tsx оригинала — заменяется один в один
import { useEffect, useRef } from 'react';
import { drawFish } from '@/game/fishDraw';
import type { FishDef, Variant } from '@/game/types';

type Bounds = { x0: number; y0: number; x1: number; y1: number };

/** Границы силуэта в единицах длины рыбы — считаются один раз на вид. */
const BOUNDS = new Map<string, Bounds>();
let scratch: HTMLCanvasElement | null = null;

/**
 * Реальные габариты рыбы вокруг точки отрисовки (в долях L).
 * Раньше рамка угадывала их формулой по shape — из-за этого плавники
 * и хвосты вылезали за кадр (у высоких тел и веера хвоста особенно).
 * Теперь рисуем силуэт на служебном холсте и меряем альфу: один замер
 * на вид, с запасом на взмах хвоста и сглаживание.
 */
function measureBounds(fish: FishDef): Bounds {
  const key = fish.id;
  const hit = BOUNDS.get(key);
  if (hit) return hit;
  const fallback: Bounds = { x0: -0.62, y0: -0.46, x1: 0.62, y1: 0.46 };
  if (typeof document === "undefined") return fallback;
  const L = 160;
  const cw = 760, ch = 480, cx = cw / 2, cy = ch / 2;
  if (!scratch) scratch = document.createElement("canvas");
  scratch.width = cw;
  scratch.height = ch;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallback;
  drawFish(ctx, fish, cx, cy, L, 1, { wag: 0.5, variant: null });
  const data = ctx.getImageData(0, 0, cw, ch).data;
  let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
  for (let y = 0; y < ch; y += 2) {
    const row = y * cw * 4;
    for (let x = 0; x < cw; x += 2) {
      if (data[row + x * 4 + 3] < 8) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  // +2 % на дискретизацию, +5 % по X на амплитуду взмаха хвоста, +3 % по Y.
  const res: Bounds =
    x1 > x0
      ? {
          x0: (x0 - cx) / L - 0.02 - 0.05,
          y0: (y0 - cy) / L - 0.02,
          x1: (x1 - cx) / L + 0.02 + 0.05,
          y1: (y1 - cy) / L + 0.02,
        }
      : fallback;
  BOUNDS.set(key, res);
  return res;
}

/** Размер и центр рыбы в рамке (общая логика для иконок и аквариума). */
export function fishFrame(fish: FishDef, w: number, h: number) {
  const b = measureBounds(fish);
  const bw = Math.max(0.2, b.x1 - b.x0);
  const bh = Math.max(0.2, b.y1 - b.y0);
  // 4 % по ширине и 3 % по высоте — запас на сглаживание и тень от плавников.
  const L = Math.min((w * 0.96) / bw, (h * 0.94) / bh);
  const cx = w / 2 - ((b.x0 + b.x1) / 2) * L;
  const cy = h / 2 - ((b.y0 + b.y1) / 2) * L;
  return { L, cx, cy };
}

export function FishIcon({
  fish,
  size = 96,
  height,
  known = true,
  variant = null,
  animate = false,
}: {
  fish: FishDef;
  size?: number;
  height?: number;
  known?: boolean;
  variant?: Variant | null;
  animate?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const h = height ?? Math.round(size * 0.62);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = h * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const start = performance.now();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const { L, cx, cy } = fishFrame(fish, size, h);
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, h);
      const t = (performance.now() - start) / 1000;
      drawFish(ctx, fish, cx, cy, L, 1, {
        wag: animate && !motion.matches ? t * 4 : 0.6,
        silhouette: known ? null : 'rgba(150,180,200,0.14)',
        variant,
      });
      if (animate && !motion.matches) raf = requestAnimationFrame(draw);
    };
    const onMotion = () => { cancelAnimationFrame(raf); draw(); };
    draw();
    if (animate) motion.addEventListener("change", onMotion);
    return () => { cancelAnimationFrame(raf); motion.removeEventListener("change", onMotion); };
  }, [fish, size, h, known, variant, animate]);
  return <canvas ref={ref} style={{ width: `min(${size}px, 100%)`, height: 'auto', aspectRatio: `${size} / ${h}` }} className="block max-w-full" aria-hidden="true" />;
}
