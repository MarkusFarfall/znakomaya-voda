import type { RGB } from '../atmosphere/types';

/**
 * Дополнительные погодные эффекты для canvas 2D.
 * Дождь и снег живут в отдельных полях частиц: precipitation.ts.
 */

const h1 = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const wrap = (v: number, m: number) => ((v % m) + m) % m;

/* ─────────────── молния ─────────────── */

export type Bolt = [number, number][][];

function subdivide(pts: [number, number][], levels: number, disp: number, rnd: () => number) {
  let arr = pts;
  let d = disp;
  for (let l = 0; l < levels; l++) {
    const out: [number, number][] = [arr[0]];
    for (let i = 0; i < arr.length - 1; i++) {
      const [ax, ay] = arr[i];
      const [bx, by] = arr[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const off = (rnd() - 0.5) * d;
      out.push([(ax + bx) / 2 + (-dy / len) * off, (ay + by) / 2 + (dx / len) * off], arr[i + 1]);
    }
    arr = out;
    d *= 0.55;
  }
  return arr;
}

export function makeBolt(x0: number, y0: number, x1: number, y1: number, rnd: () => number): Bolt {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const main = subdivide(
    [
      [x0, y0],
      [x1, y1],
    ],
    6,
    len * 0.32,
    rnd,
  );
  const out: Bolt = [main];
  const nb = 2 + Math.floor(rnd() * 3);
  for (let b = 0; b < nb; b++) {
    const i = Math.floor(main.length * (0.15 + rnd() * 0.5));
    const [sx, sy] = main[i];
    const ang = Math.PI / 2 + (rnd() - 0.5) * 1.6;
    const bl = len * (0.15 + rnd() * 0.25);
    out.push(
      subdivide(
        [
          [sx, sy],
          [sx + Math.cos(ang) * bl * (rnd() < 0.5 ? -1 : 1), sy + Math.sin(ang) * bl],
        ],
        4,
        bl * 0.35,
        rnd,
      ),
    );
  }
  return out;
}

export function drawBolt(c: CanvasRenderingContext2D, bolt: Bolt, alpha: number, s: number) {
  if (alpha <= 0.01) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.lineJoin = 'round';
  c.lineCap = 'round';
  bolt.forEach((path, i) => {
    const main = i === 0;
    c.beginPath();
    path.forEach(([x, y], j) => (j ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = `rgba(150,170,255,${alpha * (main ? 0.28 : 0.16)})`;
    c.lineWidth = (main ? 9 : 4) * s;
    c.stroke();
    c.strokeStyle = `rgba(235,240,255,${alpha * (main ? 1 : 0.7)})`;
    c.lineWidth = (main ? 1.8 : 0.9) * s;
    c.stroke();
  });
  c.restore();
}

/* ─────────────── радуга ─────────────── */

const SPECTRUM: RGB[] = [
  [255, 70, 60],
  [255, 150, 50],
  [255, 232, 80],
  [90, 220, 110],
  [70, 150, 255],
  [90, 90, 230],
  [150, 80, 220],
];

export function drawRainbow(c: CanvasRenderingContext2D, cx: number, cy: number, R: number, alpha: number) {
  if (alpha <= 0.01) return;
  const w = R * 0.017;
  c.save();
  c.lineWidth = w * 1.2;
  SPECTRUM.forEach((col, i) => {
    c.strokeStyle = css(col, alpha * 0.5);
    c.beginPath();
    c.arc(cx, cy, R - i * w, Math.PI * 1.02, Math.PI * 1.98);
    c.stroke();
  });
  // вторичная, бледная и с обратным порядком цветов
  const R2 = R * 1.32;
  c.lineWidth = w * 1.4;
  SPECTRUM.forEach((col, i) => {
    c.strokeStyle = css(col, alpha * 0.14);
    c.beginPath();
    c.arc(cx, cy, R2 + i * w * 1.2, Math.PI * 1.05, Math.PI * 1.95);
    c.stroke();
  });
  c.restore();
}

/* ─────────────── листопад / лепестки ─────────────── */

const LEAF: RGB[] = [
  [214, 120, 40],
  [190, 70, 40],
  [232, 172, 60],
  [150, 92, 40],
];
const PETAL: RGB[] = [
  [255, 196, 214],
  [255, 236, 242],
  [250, 210, 230],
];

export function drawLeaves(c: CanvasRenderingContext2D, t: number, x0: number, x1: number, top: number, bottom: number, wind: number, density: number, kind: 'leaf' | 'petal', s: number) {
  const n = Math.round(16 * density);
  if (n <= 0) return;
  const pal = kind === 'leaf' ? LEAF : PETAL;
  const span = x1 - x0 + 120;
  const range = bottom - top;
  for (let i = 0; i < n; i++) {
    const sp = 0.5 + h1(i + 40) * 0.8;
    const x = x0 - 60 + wrap(h1(i + 41) * span + t * (wind * 0.9 + 18 * s) * sp, span);
    const y = top + wrap(h1(i + 42) * range + t * 16 * s * sp, range) + Math.sin(t * (0.7 + h1(i + 43)) + i) * 26 * s;
    const flip = Math.cos(t * (2 + h1(i + 44) * 2) + i);
    c.save();
    c.translate(x, y);
    c.rotate(t * (1.2 + h1(i + 45) * 2.4) + i);
    c.scale(flip, 1);
    c.fillStyle = css(pal[i % pal.length], 0.9);
    c.beginPath();
    const l = (kind === 'leaf' ? 4.5 : 3) * s;
    c.ellipse(0, 0, l, l * 0.5, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}

/* ─────────────── льдины ─────────────── */

export function drawIce(c: CanvasRenderingContext2D, t: number, W: number, surfaceAt: (x: number) => number, amount: number, wind: number, s: number, lit: RGB) {
  const n = Math.round(9 * amount);
  if (n <= 0) return;
  const span = W + 300;
  for (let i = 0; i < n; i++) {
    const x = wrap(h1(i + 70) * span + t * wind * 0.12, span) - 150;
    const w = (18 + h1(i + 71) * 44) * s;
    const y = surfaceAt(x);
    const slope = (surfaceAt(x + w / 2) - surfaceAt(x - w / 2)) / w;
    c.save();
    c.translate(x, y);
    c.rotate(Math.atan(slope));
    // подводная часть
    c.fillStyle = 'rgba(150,200,220,0.25)';
    c.beginPath();
    c.moveTo(-w / 2, 0);
    c.lineTo(w / 2, 0);
    c.lineTo(w * 0.38, w * 0.22);
    c.lineTo(-w * 0.42, w * 0.2);
    c.closePath();
    c.fill();
    // надводная
    c.fillStyle = css(lit);
    c.beginPath();
    c.moveTo(-w / 2, 0.5);
    c.lineTo(-w * 0.44, -2.6 * s);
    c.lineTo(w * 0.4, -3 * s);
    c.lineTo(w / 2, 0.5);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.fillRect(-w * 0.44, -3 * s, w * 0.84, 1);
    c.restore();
  }
}
