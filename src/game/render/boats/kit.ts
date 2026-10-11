/**
 * Набор для рисования лодок в 2D (Canvas).
 *
 * Все размеры — в МЕТРАХ: перед рисованием контекст масштабируется на M·sc пикселей,
 * ось X — вдоль судна (нос справа), ось Y — вниз, ноль Y — спокойная ватерлиния.
 * Всё, что над водой, имеет отрицательный Y.
 */
import type { BoatDef, WeatherId } from "../../types";
import type { EngineView, Frame } from "../frame";
import { af, clamp, ctx2d, glow, hexA, makeCanvas, mix, rng, roundRect } from "../util";

/** Пикселей на метр при sc = 1 */
export const M = 28;
export type P = [number, number];
export type Pose = "fish" | "helm" | "moored";

/** Светлее (k>1) / темнее (k<1) */
export const sh = (c: string, k: number) => (k <= 1 ? mix(c, "#000000", 1 - k) : mix(c, "#ffffff", k - 1));

/* ───────────────────────── контекст рисования ───────────────────────── */

export interface Pen {
  ctx: CanvasRenderingContext2D;
  t: number;
  dt: number;
  night: number;
  golden: number;
  /** свет: dx −1..1 — откуда светит (−1 слева), k — сила 0..1 */
  light: { dx: number; k: number };
  /** цвет с учётом ночи и золотого часа */
  c: (col: string, k?: number) => string;
}

export function makePen(f: Frame): Pen {
  const { night, golden } = f;
  return {
    ctx: f.ctx,
    t: f.t,
    dt: f.dt,
    night,
    golden,
    light: f.light ?? { dx: -0.4, k: clamp(1 - night, 0.12, 1) },
    c: (col, k = 0.72) => mix(golden > 0.05 ? mix(col, "#ffb878", golden * 0.14) : col, "#060a12", night * k),
  };
}

/** Всё, что нужно отдельному судну при рисовании */
export interface R {
  p: Pen;
  ctx: CanvasRenderingContext2D;
  b: BoatDef;
  e: EngineView;
  t: number;
  night: number;
  wind: number;
  weather: WeatherId;
  pose: Pose;
  /** 0..1 — судно идёт */
  speed: number;
  /** 0..1 — паруса поставлены (плавно поднимаются и опускаются) */
  sail: number;
  /** px/с: с какой скоростью вода уходит назад под судном */
  flow: number;
  rainy: boolean;
  cold: boolean;
  /** цвет куртки рыбака по погоде */
  coat: string;
  /** подвесы (фонарь, блок, кранцы) висят вертикально, пока корпус качается, рад */
  swing: number;
  emit: (kind: "smoke" | "bubble" | "spray", x: number, y: number, size?: number) => void;
}

/* ───────────────────────── примитивы ───────────────────────── */

export function poly(ctx: CanvasRenderingContext2D, pts: P[], close = true) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i) ctx.lineTo(pts[i][0], pts[i][1]);
    else ctx.moveTo(pts[i][0], pts[i][1]);
  }
  if (close) ctx.closePath();
}
export function fillPoly(ctx: CanvasRenderingContext2D, pts: P[], fill: string | CanvasGradient) {
  poly(ctx, pts);
  ctx.fillStyle = fill;
  ctx.fill();
}
export function ln(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, col: string, cap: CanvasLineCap = "round") {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = cap;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
export function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string | CanvasGradient) {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
}
export function rbox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, col: string | CanvasGradient) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = col;
  ctx.fill();
}
export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string | CanvasGradient) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
export function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, col: string | CanvasGradient) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}
export function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
export function hgrad(ctx: CanvasRenderingContext2D, x0: number, x1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
/** Текст в метрах (шрифт рисуется крупно и масштабируется — иначе браузер округляет мелкий кегль) */
export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, col: string, align: CanvasTextAlign = "center", weight = 700) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / 40, 1 / 40);
  ctx.font = `${weight} ${Math.round(size * 40)}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = col;
  ctx.fillText(s, 0, 0);
  ctx.restore();
}
/** Мягкое свечение (аддитивное) в метрах */
export function halo(ctx: CanvasRenderingContext2D, x: number, y: number, rad: number, col: string, a: number) {
  if (a <= 0.01) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, hexA(col, a));
  g.addColorStop(1, hexA(col, 0));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  ctx.restore();
}

/* ───────────────────────── сплайны и корпус ───────────────────────── */

/** Сплайн Катмулла–Рома через точки, n сегментов (n+1 точек) */
export function spline(pts: P[], n: number): P[] {
  const m = pts.length - 1;
  const out: P[] = [];
  for (let i = 0; i <= n; i++) {
    const g = (i / n) * m;
    const k = Math.min(m - 1, Math.floor(g));
    const u = g - k;
    const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(m, k + 2)];
    const u2 = u * u, u3 = u2 * u;
    const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
    out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

export interface HullSpec {
  /** линия борта (планширь / верх фальшборта), корма → нос */
  top: P[];
  /** линия киля, корма → нос (нос — подошва штевня) */
  bot: P[];
  /** выпуклость форштевня */
  stem: P;
  /** закругление кормы (для двухконечных и «крейсерских» кормовых оконечностей); без него — транец */
  sternStem?: P;
}
export interface Hull {
  top: P[];
  bot: P[];
  outline: P[];
  path: Path2D;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  n: number;
}
const hullCache = new Map<string, Hull>();
export function buildHull(key: string, s: HullSpec): Hull {
  const hit = hullCache.get(key);
  if (hit) return hit;
  const n = 64;
  const top = spline(s.top, n);
  const bot = spline(s.bot, n);
  const a = top[n], b = bot[n];
  const mx = (a[0] + b[0]) / 2 + s.stem[0] * 2, my = (a[1] + b[1]) / 2 + s.stem[1] * 2;
  const outline: P[] = [...top];
  for (let i = 1; i < 10; i++) {
    const u = i / 10;
    outline.push([(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * mx + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * my + u * u * b[1]]);
  }
  for (let i = n; i >= 0; i--) outline.push(bot[i]);
  if (s.sternStem) {
    const sa = bot[0], sb = top[0];
    const cx2 = (sa[0] + sb[0]) / 2 + s.sternStem[0] * 2, cy2 = (sa[1] + sb[1]) / 2 + s.sternStem[1] * 2;
    for (let i = 1; i < 10; i++) {
      const u = i / 10;
      outline.push([(1 - u) * (1 - u) * sa[0] + 2 * (1 - u) * u * cx2 + u * u * sb[0], (1 - u) * (1 - u) * sa[1] + 2 * (1 - u) * u * cy2 + u * u * sb[1]]);
    }
  }
  const path = new Path2D();
  outline.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const [x, y] of outline) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const h = { top, bot, outline, path, minX, maxX, minY, maxY, n };
  hullCache.set(key, h);
  return h;
}
/** Кривая между бортом (k = 0) и килем (k = 1) */
export function strake(h: Hull, k: number): P[] {
  return h.top.map((a, i) => [a[0] + (h.bot[i][0] - a[0]) * k, a[1] + (h.bot[i][1] - a[1]) * k] as P);
}
/** y линии по x (линейная интерполяция по массиву, x растёт) */
export function yAt(arr: P[], x: number): number {
  if (x <= arr[0][0]) return arr[0][1];
  for (let i = 1; i < arr.length; i++) {
    if (x <= arr[i][0]) {
      const a = arr[i - 1], b = arr[i];
      const u = (x - a[0]) / Math.max(1e-6, b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * u;
    }
  }
  return arr[arr.length - 1][1];
}
function pr(i: number) {
  const s = Math.sin(i * 12.9898 + 4.1) * 43758.5453;
  return s - Math.floor(s);
}
function strokeCurve(ctx: CanvasRenderingContext2D, pts: P[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}
function studs(ctx: CanvasRenderingContext2D, pts: P[], every: number, r: number, col: string) {
  ctx.fillStyle = col;
  for (let i = 1; i < pts.length - 1; i += every) {
    ctx.beginPath();
    ctx.arc(pts[i][0], pts[i][1], r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface HullPaint {
  hull: string;
  trim: string;
  kind: "lap" | "smooth" | "steel" | "canoe";
  /** цвет под ватерлинией (необязательно) */
  antifoul?: string;
  /** цвет «пояска» у ватерлинии */
  boot?: string;
  strakes?: number;
  /** полоса по линии борта */
  sheerBand?: string;
  sheerK?: number;
  /** шов-стык стальных листов, м */
  seams?: number;
  gloss?: number;
  /** привальный брус */
  rub?: string;
  rubK?: number;
  /** штрих по борту (кормовая полоса и т.п.) */
  stripe?: string;
  stripeK?: number;
  /** износ краски 0..1: сколы, потёртости, ржавчина */
  wear?: number;
  /** обрастание у ватерлинии (деревянные лодки) */
  fouling?: boolean;
  /** материал-наложение; по умолчанию от kind */
  tex?: "wood" | "steel" | "plastic";
  /** линия скулы / ледового пояса (0..1 от борта к килю) */
  knuckle?: number;
  /** осадочные марки на носу и знак грузовой марки */
  marks?: boolean;
}

function paintHullBase(p: Pen, h: Hull, o: HullPaint) {
  const { ctx } = p;
  const c = p.c;
  const g = ctx.createLinearGradient(0, h.minY, 0, h.maxY);
  g.addColorStop(0, c(sh(o.hull, 1.18)));
  g.addColorStop(0.38, c(o.hull));
  g.addColorStop(1, c(sh(o.hull, 0.6)));
  ctx.fillStyle = g;
  ctx.fill(h.path);
  ctx.save();
  ctx.clip(h.path);
  const W = h.maxX - h.minX;
  const nS = o.strakes ?? 6;

  // цвета ниже ватерлинии
  if (o.antifoul) {
    ctx.fillStyle = c(o.antifoul);
    ctx.fillRect(h.minX - 1, 0.1, W + 2, 6);
    const ag = vgrad(ctx, 0.1, h.maxY, [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.35)"]]);
    ctx.fillStyle = ag;
    ctx.fillRect(h.minX - 1, 0.1, W + 2, 6);
  }
  if (o.boot) {
    ctx.fillStyle = c(o.boot);
    ctx.fillRect(h.minX - 1, -0.1, W + 2, 0.24);
  }
  // полосы и пояса
  if (o.sheerBand) {
    const a = h.top, b = strake(h, o.sheerK ?? 0.2);
    fillPoly(ctx, [...a, ...b.slice().reverse()], c(o.sheerBand));
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 0.02;
    strokeCurve(ctx, b);
  }
  if (o.stripe) {
    const k = o.stripeK ?? 0.3;
    const a = strake(h, k), b = strake(h, k + 0.07);
    fillPoly(ctx, [...a, ...b.slice().reverse()], c(o.stripe));
  }
  if (o.rub) {
    const a = strake(h, o.rubK ?? 0.2);
    ctx.strokeStyle = c(o.rub);
    ctx.lineWidth = 0.1;
    ctx.lineCap = "butt";
    strokeCurve(ctx, a);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 0.02;
    strokeCurve(ctx, a.map(([x, y]) => [x, y - 0.035] as P));
  }

  if (o.kind === "lap") {
    // доски внахлёст: тёмная щель + светлый свес, оттенок каждой доски свой
    for (let i = 0; i < nS; i++) {
      const a = strake(h, i / nS), b = strake(h, (i + 1) / nS);
      const r = pr(i * 3 + 1);
      fillPoly(ctx, [...a, ...b.slice().reverse()], r > 0.5 ? `rgba(255,235,200,${0.025 + r * 0.05})` : `rgba(0,0,0,${0.03 + r * 0.06})`);
    }
    for (let i = 1; i < nS; i++) {
      const a = strake(h, i / nS);
      ctx.strokeStyle = "rgba(10,5,0,0.6)";
      ctx.lineWidth = 0.03;
      ctx.lineCap = "butt";
      strokeCurve(ctx, a);
      ctx.strokeStyle = "rgba(255,240,210,0.16)";
      ctx.lineWidth = 0.02;
      strokeCurve(ctx, a.map(([x, y]) => [x, y + 0.03] as P));
      studs(ctx, a.map(([x, y]) => [x, y + 0.075] as P), 3, 0.012, "rgba(20,12,6,0.55)");
    }
    // торцы досок
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 0.015;
    for (let i = 0; i < nS; i++) {
      const a = strake(h, i / nS), b = strake(h, (i + 1) / nS);
      const x0 = h.minX + 0.6 + pr(i) * 2.2;
      for (let x = x0; x < h.maxX - 0.4; x += 2.0 + pr(i + 9) * 1.6) {
        ctx.beginPath();
        ctx.moveTo(x, yAt(a, x));
        ctx.lineTo(x, yAt(b, x));
        ctx.stroke();
      }
    }
  } else if (o.kind === "steel") {
    // стальные листы: сварные пояса, вертикальные стыки, заклёпки, потёки
    const rows = [0.34, 0.68];
    ctx.lineCap = "butt";
    for (const k of rows) {
      const a = strake(h, k);
      ctx.strokeStyle = "rgba(0,0,0,0.38)";
      ctx.lineWidth = 0.035;
      strokeCurve(ctx, a);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 0.02;
      strokeCurve(ctx, a.map(([x, y]) => [x, y + 0.035] as P));
      studs(ctx, a.map(([x, y]) => [x, y - 0.05] as P), 1, 0.011, "rgba(0,0,0,0.3)");
    }
    const sp = o.seams ?? 1.8;
    for (let x = h.minX + 0.9; x < h.maxX - 0.5; x += sp) {
      const ya = yAt(h.top, x), yb = yAt(h.bot, x);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 0.028;
      ctx.beginPath();
      ctx.moveTo(x, ya);
      ctx.lineTo(x + 0.04, yb);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 0.014;
      ctx.beginPath();
      ctx.moveTo(x + 0.03, ya);
      ctx.lineTo(x + 0.07, yb);
      ctx.stroke();
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      for (let y = ya + 0.12; y < yb - 0.1; y += 0.2) {
        ctx.beginPath();
        ctx.arc(x - 0.045, y, 0.011, 0, Math.PI * 2);
        ctx.arc(x + 0.095, y, 0.011, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // ржавые подтёки и вмятины
    for (let i = 0; i < 9; i++) {
      const x = h.minX + 0.8 + pr(i * 5 + 2) * (W - 1.6);
      const ya = yAt(h.top, x);
      const len = 0.35 + pr(i + 4) * 0.8;
      const gr = ctx.createLinearGradient(0, ya, 0, ya + len);
      gr.addColorStop(0, "rgba(120,60,24,0.26)");
      gr.addColorStop(1, "rgba(120,60,24,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(x, ya, 0.05 + pr(i) * 0.06, len);
    }
  } else {
    // глянцевый пластик / стеклопластик / полиэтилен
    const gl = o.gloss ?? 0.5;
    const s1 = strake(h, 0.2);
    ctx.strokeStyle = `rgba(255,255,255,${0.2 * gl * (1 - p.night * 0.7)})`;
    ctx.lineWidth = 0.1;
    ctx.lineCap = "round";
    strokeCurve(ctx, s1.slice(6, h.n - 6));
    ctx.strokeStyle = `rgba(255,255,255,${0.12 * gl * (1 - p.night * 0.7)})`;
    ctx.lineWidth = 0.03;
    strokeCurve(ctx, strake(h, 0.34).slice(10, h.n - 14));
    const sg = hgrad(ctx, h.minX, h.maxX, [[0, "rgba(0,0,0,0.16)"], [0.2, "rgba(0,0,0,0)"], [0.8, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.12)"]]);
    ctx.fillStyle = sg;
    ctx.fillRect(h.minX, h.minY, W, h.maxY - h.minY);
  }
  // блик по борту
  ctx.strokeStyle = `rgba(255,255,255,${0.2 * (1 - p.night)})`;
  ctx.lineWidth = 0.03;
  ctx.lineCap = "round";
  strokeCurve(ctx, h.top.map(([x, y]) => [x, y + 0.025] as P));
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 0.028;
  ctx.lineJoin = "round";
  ctx.stroke(h.path);
}

/** Планширь вдоль борта */
export function gunwale(p: Pen, h: Hull, col: string, w = 0.07, from = 0, to = 1) {
  const { ctx } = p;
  const a = Math.floor(from * h.n), b = Math.ceil(to * h.n);
  const pts = h.top.slice(a, b + 1);
  ctx.lineCap = "round";
  ctx.strokeStyle = p.c(sh(col, 0.7));
  ctx.lineWidth = w;
  strokeCurve(ctx, pts.map(([x, y]) => [x, y - w * 0.15] as P));
  ctx.strokeStyle = p.c(col);
  ctx.lineWidth = w * 0.62;
  strokeCurve(ctx, pts.map(([x, y]) => [x, y - w * 0.22] as P));
  ctx.strokeStyle = `rgba(255,255,255,${0.22 * (1 - p.night)})`;
  ctx.lineWidth = w * 0.18;
  strokeCurve(ctx, pts.map(([x, y]) => [x, y - w * 0.4] as P));
}

/** Вид внутрь открытой лодки: дальний борт чуть выше ближнего, между ними — внутренность */
export function interior(p: Pen, h: Hull, depth: number, inner: string, farRail: string) {
  const { ctx } = p;
  const up = h.top.map(([x, y], i) => [x, y - depth * Math.pow(Math.sin((Math.PI * i) / h.n), 0.55)] as P);
  const g = ctx.createLinearGradient(0, h.minY - depth, 0, h.minY + depth);
  g.addColorStop(0, p.c(sh(inner, 1.1)));
  g.addColorStop(1, p.c(sh(inner, 0.5)));
  fillPoly(ctx, [...up, ...h.top.slice().reverse()], g);
  ctx.strokeStyle = p.c(sh(farRail, 0.62));
  ctx.lineWidth = 0.05;
  ctx.lineCap = "round";
  strokeCurve(ctx, up);
  // шпангоуты дальнего борта
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 0.04;
  ctx.lineCap = "butt";
  for (let i = 5; i < h.n - 4; i += 5) {
    ctx.beginPath();
    ctx.moveTo(up[i][0], up[i][1] + 0.03);
    ctx.lineTo(h.top[i][0], h.top[i][1]);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,230,190,0.1)";
  ctx.lineWidth = 0.014;
  for (let i = 5; i < h.n - 4; i += 5) {
    ctx.beginPath();
    ctx.moveTo(up[i][0] + 0.03, up[i][1] + 0.03);
    ctx.lineTo(h.top[i][0] + 0.03, h.top[i][1]);
    ctx.stroke();
  }
}

/** Привязанная к палубе линия (для лееров, фальшборта) */
export function rail(r: R, y: (x: number) => number, x0: number, x1: number, hgt: number, o: { rails?: number; step?: number; col?: string; w?: number } = {}) {
  const { ctx, p } = r;
  const col = p.c(o.col ?? "#c9cfd4");
  const n = o.rails ?? 2;
  const step = o.step ?? 0.8;
  ctx.lineCap = "round";
  for (let k = 1; k <= n; k++) {
    const hh = (hgt * k) / n;
    ctx.strokeStyle = col;
    ctx.lineWidth = o.w ?? 0.022;
    ctx.beginPath();
    for (let x = x0; x <= x1 + 1e-6; x += 0.1) {
      const yy = y(x) - hh;
      if (x === x0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  for (let x = x0; x <= x1 + 0.01; x += step) ln(ctx, x, y(x), x, y(x) - hgt, (o.w ?? 0.022) * 1.15, col);
}

/* ───────────────────────── детали ───────────────────────── */

export function windowPane(r: R, x: number, y: number, w: number, h: number, o: { frame?: string; rad?: number; mullions?: number } = {}) {
  const { ctx, p } = r;
  const rad = o.rad ?? 0.035;
  roundRect(ctx, x - 0.045, y - 0.045, w + 0.09, h + 0.09, rad + 0.02);
  ctx.fillStyle = p.c(o.frame ?? "#1d2125");
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, p.c("#b4d6ea", 0.55));
  g.addColorStop(0.5, p.c("#6694ae", 0.55));
  g.addColorStop(1, p.c("#30505f", 0.55));
  roundRect(ctx, x, y, w, h, rad);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  roundRect(ctx, x, y, w, h, rad);
  ctx.clip();
  ctx.fillStyle = `rgba(255,255,255,${0.3 * (1 - r.night)})`;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.12, y + h);
  ctx.lineTo(x + w * 0.42, y);
  ctx.lineTo(x + w * 0.58, y);
  ctx.lineTo(x + w * 0.28, y + h);
  ctx.fill();
  const on = clamp((r.night - 0.2) * 1.8, 0, 1);
  if (on > 0) {
    const lg = ctx.createLinearGradient(0, y, 0, y + h);
    lg.addColorStop(0, `rgba(255,214,140,${0.95 * on})`);
    lg.addColorStop(1, `rgba(255,170,80,${0.9 * on})`);
    ctx.fillStyle = lg;
    ctx.fillRect(x, y, w, h);
  }
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(x, y, w, h * 0.14);
  ctx.restore();
  const m = o.mullions ?? 0;
  for (let i = 1; i <= m; i++) ln(ctx, x + (w * i) / (m + 1), y, x + (w * i) / (m + 1), y + h, 0.035, p.c(o.frame ?? "#1d2125"), "butt");
  if (on > 0.3) halo(ctx, x + w / 2, y + h / 2, Math.max(w, h) * 1.3, "#ffb45c", 0.3 * on);
}

export function porthole(r: R, x: number, y: number, rad: number) {
  const { ctx, p } = r;
  dot(ctx, x, y, rad * 1.25, p.c("#b9923e"));
  dot(ctx, x, y, rad * 1.05, p.c("#6d5624"));
  const on = clamp((r.night - 0.2) * 1.8, 0, 1);
  const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
  g.addColorStop(0, on > 0 ? "#ffe2a0" : p.c("#9cc4dc", 0.5));
  g.addColorStop(1, on > 0 ? "#f0a040" : p.c("#2c4858", 0.5));
  dot(ctx, x, y, rad * 0.88, g);
  ln(ctx, x - rad * 0.8, y, x + rad * 0.8, y, 0.012, "rgba(0,0,0,0.3)", "butt");
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 0.014;
  ctx.beginPath();
  ctx.arc(x, y, rad * 0.6, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();
  if (on > 0.3) halo(ctx, x, y, rad * 3.4, "#ffb45c", 0.26 * on);
}

export function lifebuoy(r: R, x: number, y: number, rad: number) {
  const { ctx, p } = r;
  ctx.lineWidth = rad * 0.52;
  ctx.lineCap = "butt";
  ctx.strokeStyle = p.c("#ecebe6");
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = p.c("#d63a2a");
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.arc(x, y, rad, k * (Math.PI / 2) + 0.3, k * (Math.PI / 2) + 0.3 + Math.PI / 4);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.arc(x, y, rad * 1.26, 0, Math.PI * 2);
  ctx.arc(x, y, rad * 0.74, 0, Math.PI * 2);
  ctx.stroke();
}

export function flag(r: R, x: number, y: number, w: number, h: number, col: string) {
  const { ctx, p, t } = r;
  const fl = clamp(0.5 + r.wind * 0.6 + r.speed * 0.5, 0.4, 1.4);
  const wv = Math.sin(t * 6 + x) * 0.07 * fl;
  const wv2 = Math.sin(t * 6.8 + x + 1) * 0.06 * fl;
  ctx.fillStyle = p.c(col);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x - w * 0.3, y + wv, x - w * 0.65, y - wv2, x - w, y + 0.02);
  ctx.lineTo(x - w, y + h + 0.02);
  ctx.bezierCurveTo(x - w * 0.65, y + h - wv, x - w * 0.3, y + h + wv2, x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 0.012;
  ctx.stroke();
}

export function fender(r: R, x: number, y: number, len: number, col: string, rad = 0.09) {
  const { ctx, p } = r;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(r.swing * 0.8 + Math.sin(r.t * 1.7 + x * 3) * 0.03);
  ln(ctx, 0, 0, 0, 0.12, 0.016, p.c("#cdb98a"));
  rbox(ctx, -rad, 0.1, rad * 2, len, rad, p.c(col));
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(-rad * 0.55, 0.16, rad * 0.35, len - 0.12);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(rad * 0.45, 0.14, rad * 0.5, len - 0.08);
  ctx.restore();
}

export function tire(r: R, x: number, y: number, rad: number) {
  const { ctx, p } = r;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(r.swing * 0.5);
  ctx.strokeStyle = p.c("#151517");
  ctx.lineWidth = rad * 0.7;
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = rad * 0.12;
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.8, Math.PI * 1.1, Math.PI * 1.7);
  ctx.stroke();
  ctx.restore();
}

export function anchorShape(r: R, x: number, y: number, s: number, rot: number) {
  const { ctx, p } = r;
  const col = p.c("#3a3d42");
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ln(ctx, 0, -0.55, 0, 0.35, 0.07, col);
  ln(ctx, -0.18, -0.5, 0.18, -0.5, 0.05, col);
  ctx.strokeStyle = col;
  ctx.lineWidth = 0.065;
  ctx.beginPath();
  ctx.arc(0, 0.08, 0.34, 0.1, Math.PI - 0.1);
  ctx.stroke();
  for (const sg of [-1, 1]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(sg * 0.33, 0.22);
    ctx.lineTo(sg * 0.5, 0.18);
    ctx.lineTo(sg * 0.32, 0.38);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 0.014;
  ctx.beginPath();
  ctx.moveTo(-0.02, -0.5);
  ctx.lineTo(-0.02, 0.3);
  ctx.stroke();
  ctx.restore();
}

export function navLight(r: R, x: number, y: number, col: string, size = 0.05) {
  const { ctx, p } = r;
  const on = clamp(r.night * 1.4 + (r.weather === "fog" ? 0.7 : 0), 0, 1);
  dot(ctx, x, y, size, on > 0.1 ? col : p.c("#8a8a8a"));
  if (on > 0.2) {
    glow(ctx, x, y, size * 1.6, col, on);
    halo(ctx, x, y, size * 16, col, 0.2 * on);
  }
}

/** Фонарь на подвесе: качается по физике корпуса */
export function lantern(r: R, x: number, y: number, hang = 0.18) {
  const { ctx, p } = r;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(r.swing * 1.2 + Math.sin(r.t * 1.6) * 0.04);
  ln(ctx, 0, 0, 0, hang * 0.3, 0.012, p.c("#2a2a2a"));
  rbox(ctx, -0.045, hang * 0.3, 0.09, 0.03, 0.01, p.c("#3a3a3c"));
  const lit = r.night > 0.3;
  rbox(ctx, -0.04, hang * 0.3 + 0.03, 0.08, hang * 0.7, 0.012, lit ? "#ffd07c" : p.c("#b8903c"));
  rbox(ctx, -0.05, hang * 0.3 + hang * 0.7 + 0.03, 0.1, 0.025, 0.008, p.c("#3a3a3c"));
  if (lit) {
    glow(ctx, 0, hang * 0.65, 0.07, "#ffc070", r.night);
    halo(ctx, 0, hang * 0.65, 1.7, "#ffb460", 0.34 * r.night);
  }
  ctx.restore();
}

export function rope(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, turns: number, col: string) {
  ctx.strokeStyle = col;
  ctx.lineWidth = 0.03;
  ctx.lineCap = "round";
  for (let i = 0; i < turns; i++) {
    ctx.beginPath();
    ctx.ellipse(x, y - i * 0.028, rx - i * 0.008, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 0.012;
  for (let i = 0; i < turns; i++) {
    ctx.beginPath();
    ctx.ellipse(x, y - i * 0.028 + 0.012, rx - i * 0.008, ry, 0, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
}

export function cleat(ctx: CanvasRenderingContext2D, x: number, y: number, col: string) {
  rbox(ctx, x - 0.11, y - 0.045, 0.22, 0.045, 0.02, col);
  rbox(ctx, x - 0.07, y - 0.012, 0.045, 0.02, 0.005, col);
  rbox(ctx, x + 0.025, y - 0.012, 0.045, 0.02, 0.005, col);
}

export function stainless(p: Pen) {
  return p.c("#cdd2d6");
}

/** Вращающаяся антенна радара */
export function radar(r: R, x: number, y: number, len: number, speed = 2.4) {
  const { ctx, p } = r;
  const a = Math.abs(Math.cos(r.t * speed));
  ln(ctx, x, y, x, y + 0.28, 0.05, p.c("#4a4d50"));
  rbox(ctx, x - (len * a) / 2, y - 0.07, len * a, 0.1, 0.03, p.c("#dde0e2"));
  dot(ctx, x, y - 0.015, 0.05, p.c("#5a5d60"));
}

/** Дальнее свечение и свет окон делают ночью лодку «живой» */
export function deckLight(r: R, x: number, y: number, rad = 2.2) {
  if (r.night < 0.3) return;
  dot(r.ctx, x, y, 0.045, "#fff2cc");
  halo(r.ctx, x, y, rad, "#ffc070", 0.32 * r.night);
}

/** Обрезка «только выше линии борта»: люди и снасти внутри лодки скрыты бортом, а над ним видны */
export function clipAbove(ctx: CanvasRenderingContext2D, h: Hull, down = 0) {
  const t = h.top;
  ctx.beginPath();
  ctx.moveTo(h.minX - 12, t[0][1] + down);
  t.forEach(([x, y]) => ctx.lineTo(x, y + down));
  ctx.lineTo(h.maxX + 12, t[t.length - 1][1] + down);
  ctx.lineTo(h.maxX + 12, h.minY - 40);
  ctx.lineTo(h.minX - 12, h.minY - 40);
  ctx.closePath();
  ctx.clip();
}

export const alphaStr = af;

/* ───────────── материал корпуса: текстуры, свет, ватерлиния, износ ───────────── */

type TexKind = "wood" | "steel" | "plastic";
const patCache = new Map<string, CanvasPattern | null>();

/** Текстура-наложение: цвет берётся из корпуса, здесь только шум, волокна, царапины */
function overlayPattern(ctx: CanvasRenderingContext2D, kind: TexKind): CanvasPattern | null {
  const hit = patCache.get(kind);
  if (hit !== undefined) return hit;
  const S = 256;
  const cv = makeCanvas(S, S);
  const g = ctx2d(cv);
  const r = rng(kind === "wood" ? 11 : kind === "steel" ? 23 : 37);
  if (kind === "wood") {
    for (let i = 0; i < 110; i++) {
      const x = r() * S, y = r() * S, len = 50 + r() * 180;
      const dark = r() > 0.45, a = 0.05 + r() * 0.12, w = 0.5 + r() * 1.7;
      const j1 = (r() - 0.5) * 4, j2 = (r() - 0.5) * 4, j3 = (r() - 0.5) * 2;
      g.strokeStyle = dark ? `rgba(28,12,0,${a})` : `rgba(255,228,184,${a * 0.7})`;
      g.lineWidth = w;
      for (const ox of [0, -S]) {
        g.beginPath();
        g.moveTo(x + ox, y);
        g.bezierCurveTo(x + ox + len * 0.3, y + j1, x + ox + len * 0.7, y + j2, x + ox + len, y + j3);
        g.stroke();
      }
    }
    for (let i = 0; i < 5; i++) {
      const x = r() * S, y = r() * S;
      for (let q = 3; q > 0; q--) {
        g.strokeStyle = `rgba(30,14,2,${0.07 + 0.03 * q})`;
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(x, y, q * 5, q * 2, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
  } else if (kind === "steel") {
    for (let i = 0; i < 700; i++) {
      const light = r() > 0.5, a = 0.03 + r() * 0.07;
      g.fillStyle = light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.2})`;
      g.fillRect(r() * S, r() * S, 1 + r() * 6, 1 + r() * 3);
    }
    for (let i = 0; i < 14; i++) {
      const x = r() * S, y = r() * S, len = 60 + r() * 180;
      const gr = g.createLinearGradient(0, y, 0, y + len);
      gr.addColorStop(0, "rgba(0,0,0,0)");
      gr.addColorStop(0.5, `rgba(0,0,0,${0.03 + r() * 0.05})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(x, y, 2 + r() * 5, len);
    }
    g.strokeStyle = "rgba(255,255,255,0.08)";
    g.lineWidth = 0.7;
    for (let i = 0; i < 18; i++) {
      const x = r() * S, y = r() * S, l = 10 + r() * 40, a = (r() - 0.5) * 0.6;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  } else {
    for (let i = 0; i < 44; i++) {
      const x = r() * S, y = r() * S, rad = 18 + r() * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, r() > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
  let pat: CanvasPattern | null = null;
  try {
    pat = ctx.createPattern(cv, "repeat");
    pat?.setTransform(new DOMMatrix([2.2 / S, 0, 0, 2.2 / S, 0, 0]));
  } catch {
    pat = null;
  }
  patCache.set(kind, pat);
  return pat;
}

/** Покраска корпуса: база + материал + освещение + отражение моря + износ */
export function paintHull(p: Pen, h: Hull, o: HullPaint) {
  paintHullBase(p, h, o);
  const { ctx } = p;
  const dayK = 1 - p.night * 0.6;
  const W = h.maxX - h.minX;
  const kk = p.light.k * (1 - p.night);
  const steel = o.kind === "steel";
  ctx.save();
  ctx.clip(h.path);

  // 1) материал
  const tex: TexKind = o.tex ?? (o.kind === "lap" ? "wood" : steel ? "steel" : "plastic");
  const pat = overlayPattern(ctx, tex);
  if (pat) {
    ctx.globalAlpha = (tex === "wood" ? 0.95 : tex === "steel" ? 0.85 : 0.45) * (0.4 + 0.6 * dayK);
    ctx.fillStyle = pat;
    ctx.fillRect(h.minX - 1, h.minY - 1, W + 2, h.maxY - h.minY + 2);
    ctx.globalAlpha = 1;
  }

  // 2) тень под планширем и свет с солнечной стороны
  fillPoly(ctx, [...h.top, ...strake(h, 0.55).slice().reverse()], vgrad(ctx, h.minY, h.minY + 0.8, [[0, "rgba(0,0,0,0.3)"], [1, "rgba(0,0,0,0)"]]));
  const dx = p.light.dx;
  const la = 0.14 * kk * Math.abs(dx) + 0.03;
  ctx.fillStyle = hgrad(
    ctx,
    h.minX,
    h.maxX,
    dx < 0
      ? [[0, `rgba(255,246,225,${la})`], [0.55, "rgba(255,246,225,0)"], [1, `rgba(0,0,0,${la * 1.1})`]]
      : [[0, `rgba(0,0,0,${la * 1.1})`], [0.45, "rgba(0,0,0,0)"], [1, `rgba(255,246,225,${la})`]]
  );
  ctx.fillRect(h.minX - 1, h.minY - 1, W + 2, h.maxY - h.minY + 2);

  // 3) скула / ледовый пояс
  if (o.knuckle !== undefined) {
    const a = strake(h, o.knuckle);
    ctx.lineCap = "butt";
    ctx.strokeStyle = "rgba(0,0,0,0.42)";
    ctx.lineWidth = 0.05;
    strokeCurve(ctx, a);
    ctx.strokeStyle = `rgba(255,255,255,${0.22 * dayK})`;
    ctx.lineWidth = 0.025;
    strokeCurve(ctx, a.map(([x, y]) => [x, y - 0.045] as P));
  }

  // 4) отражение моря и мокрая полоса у ватерлинии
  const sea = p.c("#4aa4b2", 0.6);
  ctx.fillStyle = vgrad(ctx, -0.6, 0.1, [[0, hexA(sea, 0)], [0.75, hexA(sea, 0.18)], [1, "rgba(6,24,32,0.42)"]]);
  ctx.fillRect(h.minX - 1, -0.6, W + 2, 0.7);
  ctx.strokeStyle = "rgba(10,24,30,0.38)";
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  for (let x = h.minX; x <= h.maxX; x += 0.2) {
    const y = -0.07 + Math.sin(x * 2.6 + p.t * 2.2) * 0.025;
    if (x === h.minX) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  if (o.fouling) {
    ctx.fillStyle = vgrad(ctx, -0.05, 0.35, [[0, "rgba(48,72,38,0)"], [0.25, "rgba(48,72,38,0.5)"], [1, "rgba(30,44,26,0.7)"]]);
    ctx.fillRect(h.minX - 1, -0.05, W + 2, 0.4);
    const rb = rng(41);
    ctx.fillStyle = "rgba(214,208,192,0.5)";
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(h.minX + rb() * W, 0.02 + rb() * 0.22, 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 5) износ: сколы краски, ржавчина, подтёки
  const wear = o.wear ?? 0;
  if (wear > 0) {
    const rr = rng(Math.round(W * 10) + 5);
    const n = Math.round(wear * 46);
    for (let i = 0; i < n; i++) {
      const x = h.minX + 0.3 + rr() * (W - 0.6);
      const y = yAt(h.top, x) + 0.04 + rr() * (steel ? 1.2 : 0.9);
      const w = 0.03 + rr() * 0.12, hh = 0.02 + rr() * 0.05;
      ctx.fillStyle = steel ? (rr() > 0.4 ? `rgba(128,62,26,${0.3 + rr() * 0.3})` : "rgba(60,38,22,0.45)") : `rgba(80,58,34,${0.25 + rr() * 0.35})`;
      ctx.fillRect(x, y, w, hh);
    }
    if (steel) {
      for (let i = 0; i < Math.round(wear * 8); i++) {
        const x = h.minX + 0.6 + rr() * (W - 1.2);
        const y0 = yAt(h.top, x) + 0.1, len = 0.3 + rr() * 0.9;
        ctx.fillStyle = vgrad(ctx, y0, y0 + len, [[0, "rgba(130,64,26,0.35)"], [1, "rgba(130,64,26,0)"]]);
        ctx.fillRect(x, y0, 0.04 + rr() * 0.07, len);
      }
    }
  }

  // 6) осадочные марки на носу и знак грузовой марки
  if (o.marks) {
    const mx = h.maxX - 1.0;
    ["8", "6", "4"].forEach((s, i) => text(ctx, s, mx, -0.12 - i * 0.42, 0.16, `rgba(255,255,255,${0.78 * dayK})`));
    const cx = h.minX + W * 0.43;
    ctx.strokeStyle = `rgba(255,255,255,${0.75 * dayK})`;
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.arc(cx, -0.36, 0.13, 0, Math.PI * 2);
    ctx.moveTo(cx - 0.2, -0.36);
    ctx.lineTo(cx + 0.2, -0.36);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 0.028;
  ctx.lineJoin = "round";
  ctx.stroke(h.path);
}
