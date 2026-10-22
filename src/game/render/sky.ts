import { cloudBank } from "./cloudBank";
import type { WeatherId } from "../types";
import { findActiveEvent, hasActiveEvent, horizontalRange, type Frame } from "./frame";
import { drawRainbow as drawRainbowFx } from "./weatherFx";
import { clamp, ctx2d, glow, hexA, makeCanvas, mix, rng, smooth, af, rgbHex } from "./util";

/** Квантование цвета для ключей кэша: 32 градации на канал — глазу неотличимо, кэш не дёргается. */
const quant = (c: string) => (c.length === 7 ? "#" + c.slice(1).match(/../g)!.map(h => Math.min(255, Math.round(parseInt(h, 16) / 8) * 8).toString(16).padStart(2, "0")).join("") : c);

// [час, зенит, середина, горизонт]
const SKY: [number, string, string, string][] = [
  [0, "#02040c", "#060c20", "#0e1630"],
  [4.2, "#040818", "#0e1636", "#1e2446"],
  [5.2, "#131c48", "#4a3a6e", "#c0706a"],
  [6.1, "#2a5096", "#9a82b0", "#ffb482"],
  [7.4, "#3a76c2", "#80b0e0", "#e6e4dc"],
  [12, "#1f62ba", "#5a9ee4", "#bedcf0"],
  [16.6, "#2e6ab6", "#7eaadc", "#e8dcc6"],
  [18.5, "#2e4288", "#b06a7a", "#ff9c58"],
  [19.6, "#181e50", "#4a3668", "#c0584a"],
  [20.8, "#050a1c", "#0e1638", "#1c2442"],
  [24, "#02040c", "#060c20", "#0e1630"],
];

export function skyAt(h: number): [string, string, string] {
  for (let i = 0; i < SKY.length - 1; i++) {
    const a = SKY[i], b = SKY[i + 1];
    if (h >= a[0] && h <= b[0]) {
      const t = smooth((h - a[0]) / (b[0] - a[0]));
      return [mix(a[1], b[1], t), mix(a[2], b[2], t), mix(a[3], b[3], t)];
    }
  }
  return [SKY[0][1], SKY[0][2], SKY[0][3]];
}

export const WEATHER_TINT: Record<WeatherId, [string, number]> = {
  clear: ["#8098b0", 0],
  cloudy: ["#8c96a0", 0.34],
  rain: ["#5a646e", 0.6],
  storm: ["#262c36", 0.8],
  fog: ["#b4bcc2", 0.62],
  snow: ["#a8b0ba", 0.5],
};
export const CLOUD_COVER: Record<WeatherId, number> = { clear: 0.22, cloudy: 0.75, rain: 1, storm: 1, fog: 0.4, snow: 0.95 };

/** Stable world-space sky tiles: same procedural pattern, only nearby tiles are built. */
const SKY_TILE_WIDTH = 600;
const SKY_TILE_CACHE_LIMIT = 6;
interface MilkyParticle { x: number; y: number; alpha: number; size: number }
interface MilkyHole { x: number; gradientY: number; gradientRadius: number; y: number; rx: number; ry: number }
interface DeckBlob { x: number; y: number; radius: number; shaded: boolean }

interface Cloud {
  /** мировая координата. NaN — ещё не размещено: ставим в кадр при первом кадре. */
  x: number;
  /** стартовая доля окна (0..1), чтобы облака не липли в одну точку. */
  nx0: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  seed: number;
  layer: number;
  sprite: HTMLCanvasElement | null;
  /** доля высоты спрайта, где лежит основание облака */
  anchorY: number;
}

/**
 * Высота опорной точки облака (его нижней кромки) в пикселях кадра.
 *
 * Раньше дальние банки (`layer → 0`) опускались почти к ватерлинии и читались
 * как облака, плывущие по морю. Здесь весь диапазон высот сжимается так, чтобы
 * самая нижняя опора оставалась над горизонтом `horizon`, но сами банки не
 * слипались в одну полосу: масштабируется весь разброс, а не отсекается край.
 */
export function cloudBaseY(layer: number, H: number, horizon: number, jitter = 0.5) {
  const top = H * 0.16;
  const nominal = H * (1 - layer) * 0.2 + H * jitter * 0.06;
  const room = Math.max(H * 0.04, horizon - H * 0.05 - top);
  const k = Math.min(1, room / (H * 0.26));
  return top + nominal * k;
}

export class SkyRenderer {
  private W = 0;
  private H = 0;
  private stars: [number, number, number, number, string][] = [];
  private milkyParticles: MilkyParticle[] = [];
  private milkyHoles: MilkyHole[] = [];
  private milkyTiles = new Map<number, HTMLCanvasElement>();
  private clouds: Cloud[] = [];
  private deckBlobs: DeckBlob[] = [];
  private deckTiles = new Map<number, HTMLCanvasElement>();
  private deckHeight = 0;
  private milkyHeight = 0;
  private key = "";
  private meteors: [number, number, number][] = [];
  private gulls: [number, number, number, number][] = [];
  private gullsReady = false;

  private setup(W: number, H: number) {
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    this.key = "";
    const r = rng(11);
    const hy = H * 0.39;
    this.milkyHeight = hy;
    this.deckTiles.clear();
    const tints = ["#ffffff", "#ffffff", "#dfe8ff", "#fff2dc", "#ffe0d0"];
    this.stars = Array.from({ length: 320 }, () => [r() * W, Math.pow(r(), 1.4) * hy, r() < 0.06 ? 1.8 : r() * 1.2 + 0.4, r() * 6.28, tints[Math.floor(r() * tints.length)]]);
    // Тот же единый ПСЧ и порядок случайных чисел, что у прежнего полотна 7200 px.
    // Храним мировые координаты частиц, а растеризуем только востребованные тайлы.
    this.milkyTiles.clear();
    const len = W * 0.9;
    this.milkyParticles = Array.from({ length: 2600 }, () => {
      const x = (r() - 0.5) * len * 2;
      const y = (r() + r() + r() - 1.5) * hy * 0.12;
      const alpha = 0.15 + r() * 0.5;
      const size = r() * 1.1 + 0.3;
      return { x, y, alpha, size };
    });
    this.milkyHoles = Array.from({ length: 60 }, () => {
      const x = (r() - 0.5) * len * 2;
      const gradientY = (r() - 0.5) * 8;
      const gradientRadius = 18 + r() * 30;
      const y = (r() - 0.5) * 8;
      const rx = 40 + r() * 40;
      const ry = 6 + r() * 6;
      return { x, gradientY, gradientRadius, y, rx, ry };
    });
    // Облака живут в долях кадра, а не в мировых координатах: раньше они были
    // размазаны по 7200 px и при нарезке на кадр «прыгали» на границах окна.
    this.clouds = Array.from({ length: 14 }, (_, i) => {
      const layer = i / 13;
      const w = (190 + r() * 240) * (0.7 + layer * 0.55) * (H / 720);
      return { x: NaN, nx0: r(), anchorY: 0, y: cloudBaseY(layer, H, hy, r()), w, h: w * (0.3 + r() * 0.16), speed: 3 + layer * 9, seed: r() * 1000, layer, sprite: null };
    });
    this.gulls = Array.from({ length: 7 }, () => [r(), H * (0.1 + r() * 0.2), r() * 6.28, 0.7 + r() * 0.5]);
    this.gullsReady = false;
  }

  private rebuild(f: Frame, lit: string, shade: string) {
    for (const c of this.clouds) {
      // Банк рисуется в пределах ±half по горизонтали и ~0.9·half по вертикали.
      // Спрайт берём с запасом, иначе мягкий край обрезается ровной линией.
      // Спрайт с небольшим запасом по краям: силуэт укладывается в width ровно.
      const cw = Math.ceil(c.w * 1.15), ch = Math.ceil(c.w * 0.75);
      const cv = c.sprite && c.sprite.width === cw && c.sprite.height === ch ? c.sprite : makeCanvas(cw, ch);
      const g = ctx2d(cv);
      g.clearRect(0, 0, cw, ch);
      g.save();
      // Мягкие края: размытие считается один раз при пересборке спрайта,
      // а не на каждом кадре. Именно оно убирает «набор кругов».
      const canFilter = typeof g.filter === "string";
      if (canFilter) g.filter = `blur(${Math.min(3.2, Math.max(1.4, c.w * 0.007)).toFixed(2)}px)`;
      // Якорь: центр по горизонтали, основание облака — на 0.78 высоты.
      g.translate(cw * 0.5, ch * 0.82);
      cloudBank(g, 0, 0, c.w, lit, shade, 0.88, c.seed);
      g.restore();
      if (canFilter) g.filter = "none";
      c.sprite = cv;
      c.anchorY = ch * 0.82;
    }
    // Позиции 220 облачных пятен совпадают с прежней декой мира; тайлы создаются
    // лениво только под камерой и кэшируются по абсолютному tileId.
    const dw = Math.ceil(f.W), dh = Math.ceil(f.hY + 10);
    const r = rng(77);
    this.deckBlobs = Array.from({ length: 220 }, () => {
      const x = r() * dw * 1.2 - dw * 0.1;
      const y = Math.pow(r(), 0.8) * dh * 0.95;
      const radius = (40 + r() * 110) * (0.6 + (y / dh) * 0.6);
      return { x, y, radius, shaded: r() < 0.5 };
    });
    this.deckHeight = dh;
    this.deckTiles.clear();
  }

  private tileIds(left: number, right: number) {
    const x0 = clamp(left, 0, this.W);
    const x1 = clamp(right, 0, this.W);
    if (x1 <= x0) return [];
    const first = Math.floor(x0 / SKY_TILE_WIDTH);
    const last = Math.floor(Math.max(x0, x1 - 1e-6) / SKY_TILE_WIDTH);
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }

  private cachedTile(cache: Map<number, HTMLCanvasElement>, id: number, build: () => HTMLCanvasElement) {
    let tile = cache.get(id);
    if (!tile) tile = build();
    cache.delete(id);
    cache.set(id, tile);
    while (cache.size > SKY_TILE_CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
    return tile;
  }

  private buildMilkyTile(id: number) {
    const left = id * SKY_TILE_WIDTH;
    const width = Math.min(SKY_TILE_WIDTH, this.W - left);
    const hy = this.milkyHeight;
    const canvas = makeCanvas(width, hy) as HTMLCanvasElement;
    const m = ctx2d(canvas);
    const theta = -0.42;
    const cos = Math.cos(theta), sin = Math.sin(theta);
    const len = this.W * 0.9;
    m.save();
    m.translate(this.W * 0.55 - left, hy * 0.35);
    m.rotate(theta);
    const band = m.createLinearGradient(0, -hy * 0.18, 0, hy * 0.18);
    band.addColorStop(0, "rgba(160,170,255,0)");
    band.addColorStop(0.5, "rgba(200,205,255,0.22)");
    band.addColorStop(1, "rgba(160,170,255,0)");
    m.fillStyle = band;
    m.fillRect(-len, -hy * 0.18, len * 2, hy * 0.36);
    const right = left + width;
    for (const p of this.milkyParticles) {
      const wx = this.W * 0.55 + cos * p.x - sin * p.y;
      const wy = hy * 0.35 + sin * p.x + cos * p.y;
      const extent = p.size * (Math.abs(cos) + Math.abs(sin));
      if (wx + extent < left || wx - extent > right || wy + extent < 0 || wy - extent > hy) continue;
      m.fillStyle = `rgba(255,255,255,${p.alpha})`;
      m.fillRect(p.x, p.y, p.size, p.size);
    }
    m.globalCompositeOperation = "destination-out";
    for (const hole of this.milkyHoles) {
      const wx = this.W * 0.55 + cos * hole.x - sin * hole.y;
      const wy = hy * 0.35 + sin * hole.x + cos * hole.y;
      const xRadius = Math.sqrt((hole.rx * cos) ** 2 + (hole.ry * sin) ** 2);
      const yRadius = Math.sqrt((hole.rx * sin) ** 2 + (hole.ry * cos) ** 2);
      if (wx + xRadius < left || wx - xRadius > right || wy + yRadius < 0 || wy - yRadius > hy) continue;
      const dg = m.createRadialGradient(hole.x, hole.gradientY, 0, hole.x, 0, hole.gradientRadius);
      dg.addColorStop(0, "rgba(0,0,0,0.5)");
      dg.addColorStop(1, "rgba(0,0,0,0)");
      m.fillStyle = dg;
      m.beginPath();
      m.ellipse(hole.x, hole.y, hole.rx, hole.ry, 0, 0, Math.PI * 2);
      m.fill();
    }
    m.restore();
    return canvas;
  }

  private milkyTile(id: number) {
    return this.cachedTile(this.milkyTiles, id, () => this.buildMilkyTile(id));
  }

  private buildDeckTile(id: number, lit: string, shade: string) {
    const left = id * SKY_TILE_WIDTH;
    const width = Math.min(SKY_TILE_WIDTH, this.W - left);
    const d = ctx2d(makeCanvas(width, this.deckHeight));
    const right = left + width;
    for (const blob of this.deckBlobs) {
      if (blob.x + blob.radius * 1.8 < left || blob.x - blob.radius * 1.8 > right) continue;
      const x = blob.x - left;
      const col = blob.shaded ? shade : mix(shade, lit, 0.35);
      const gr = d.createRadialGradient(x, blob.y, 0, x, blob.y, blob.radius);
      gr.addColorStop(0, hexA(col, 0.55));
      gr.addColorStop(1, hexA(col, 0));
      d.fillStyle = gr;
      d.beginPath();
      d.ellipse(x, blob.y, blob.radius * 1.8, blob.radius * 0.6, 0, 0, Math.PI * 2);
      d.fill();
    }
    return d.canvas as HTMLCanvasElement;
  }

  private deckTile(id: number, lit: string, shade: string) {
    return this.cachedTile(this.deckTiles, id, () => this.buildDeckTile(id, lit, shade));
  }

  draw(f: Frame) {
    const { ctx, W, H, hY, t, e } = f;
    this.setup(W, H);
    // Кадр игрока: всё, что дальше него, не рисуется и не блитится.
    const view = horizontalRange(f, 0);
    const abyssDark = f.loc.land === "abyss" ? 0.25 : 0;

    const g = ctx.createLinearGradient(0, 0, 0, hY);
    g.addColorStop(0, mix(f.top, "#000000", abyssDark));
    g.addColorStop(0.62, f.mid);
    g.addColorStop(1, f.hor);
    ctx.fillStyle = g;
    ctx.fillRect(view.left, -40, view.right - view.left, hY + 42);

    // свечение у горизонта со стороны солнца
    if (f.golden > 0.02) {
      const hg = ctx.createRadialGradient(f.sunX, hY, 0, f.sunX, hY, W * 0.7);
      hg.addColorStop(0, `rgba(255,150,80,${af(0.5 * f.golden * (1 - f.cover * 0.6))})`);
      hg.addColorStop(0.4, `rgba(255,120,90,${af(0.18 * f.golden)})`);
      hg.addColorStop(1, "rgba(255,120,90,0)");
      ctx.fillStyle = hg;
      ctx.fillRect(view.left, 0, view.right - view.left, hY);
    }

    // звёзды
    const starA = f.atmo.starVis;
    if (starA > 0.02) {
      ctx.globalAlpha = starA * 0.9;
      // Полоса Млечного пути строится только в тайлах, пересекающих кадр игрока.
      for (const id of this.tileIds(view.left, view.right)) {
        ctx.drawImage(this.milkyTile(id), id * SKY_TILE_WIDTH, 0);
      }
      for (const [x, y, r, p, c] of this.stars) {
        if (y > hY - 4) continue;
        // Звёзды живут по всей ширине мира; рисуем только попавшие в кадр.
        if (x + r < view.left || x > view.right) continue;
        ctx.globalAlpha = starA * (0.45 + 0.55 * Math.sin(t * (1.5 + (p % 1) * 2) + p)) * clamp(1 - y / hY + 0.25, 0, 1);
        ctx.fillStyle = c;
        ctx.fillRect(x, y, r, r);
        if (r > 1.5) {
          ctx.globalAlpha *= 0.4;
          ctx.fillRect(x - 2, y + r / 2 - 0.3, r + 4, 0.6);
          ctx.fillRect(x + r / 2 - 0.3, y - 2, 0.6, r + 4);
        }
      }
      ctx.globalAlpha = 1;
    }

    // метеоры
    if (hasActiveEvent(f, "meteor")) {
      const meteorView = horizontalRange(f, 320);
      if (Math.random() < f.dt * 1.6) this.meteors.push([meteorView.left + Math.random() * (meteorView.right - meteorView.left), Math.random() * H * 0.2, 0]);
      for (const m of this.meteors) {
        m[2] += f.dt;
        if (m[0] < meteorView.left || m[0] > meteorView.right) continue;
        const k = m[2] / 0.9;
        const x = m[0] + k * 280, y = m[1] + k * 140;
        const gr = ctx.createLinearGradient(x, y, x - 110, y - 55);
        gr.addColorStop(0, `rgba(255,255,235,${af(1 - k)})`);
        gr.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = gr;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 110, y - 55);
        ctx.stroke();
      }
      this.meteors = this.meteors.filter((m) => m[2] < 0.9);
    }

    this.drawSun(f);
    this.drawMoon(f);

    // облака
    let lit = mix(rgbHex(f.atmo.palette.cloud), "#ffc488", f.golden * 0.3);
    lit = mix(lit, "#ff9a88", f.golden * 0.15);
    const wt = f.atmo.kind;
    if (wt === "drizzle" || wt === "rain" || wt === "downpour") lit = mix(lit, "#8c949c", 0.45 + f.atmo.precip * 0.2);
    if (wt === "storm" || wt === "gale" || wt === "blizzard") lit = mix(lit, "#4c525c", 0.58 + f.atmo.dark * 0.2);
    if (wt === "snow" || wt === "overcast" || wt === "cloudy") lit = mix(lit, "#c6ccd4", 0.2);
    if (wt === "fog") lit = mix(lit, rgbHex(f.atmo.palette.fog), 0.3);
    lit = mix(lit, "#1c2232", f.night * 0.88);
    let shade = mix(lit, f.top, 0.4);
    shade = mix(shade, f.golden > 0.1 ? "#7a5a80" : "#46505e", 0.3 + f.golden * 0.2);
    // Ключ перестройки квантуется по цвету: иначе плавно меняющиеся сумерки
    // пересобирали 14 облачных спрайтов и полотно на 220 градиентов каждый кадр.
    const key = `${quant(lit)}|${quant(shade)}|${W}|${H}|${f.sunX < W / 2}`;
    if (key !== this.key) {
      this.key = key;
      this.rebuild(f, lit, shade);
    }
    if (f.cover > 0.7 && f.quality > 0) {
      ctx.globalAlpha = clamp((f.cover - 0.7) * 3.3, 0, 1) * (wt === "fog" ? 0.5 : 1);
      // Дека облачности тоже кэшируется тайлами: внекадровая поверхность не растеризуется.
      for (const id of this.tileIds(view.left, view.right)) {
        ctx.drawImage(this.deckTile(id, lit, shade), id * SKY_TILE_WIDTH, 0);
      }
      ctx.globalAlpha = 1;
    }
    // Перистые: держатся в окне игрока, а не размазаны по всей карте.
    const span = Math.max(1, view.right - view.left);
    if ((wt === "clear" || wt === "fair" || wt === "cloudy") && f.night < 0.8) {
      ctx.strokeStyle = hexA(lit, 0.18 * (1 - f.night));
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const x0 = view.left - 200 + ((i * 260 + view.left + t * 2) % (span + 400)), y0 = H * (0.05 + (i % 3) * 0.04);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(x0 + 60, y0 - 10, x0 + 140, y0 + 6, x0 + 220, y0 - 4);
        ctx.stroke();
      }
    }
    const n = Math.round(clamp(f.cover * 1.25, 0, 1) * this.clouds.length);
    for (let i = 0; i < n; i++) {
      const c = this.clouds[i];
      // Облако живёт в МИРОВЫХ координатах: при движении камеры оно честно проплывает
      // мимо, а не летит вместе с ней (раньше позиция каждый кадр выводилась из view.left).
      if (!Number.isFinite(c.x)) c.x = view.left + ((c.nx0 * span * 1.4) % span) - span * 0.2;
      c.x += (c.speed + f.atmo.wind * 1.5 * f.atmo.windDir) * f.dt * (0.5 + c.layer);
      // Вышло за кадр — переносим на другую сторону. Шаг переноса фиксирован на текущий кадр,
      // поэтому перескоков внутри кадра нет.
      const pad = c.w * 1.2, total = span + pad * 2;
      if (c.x < view.left - pad) c.x += total;
      else if (c.x > view.right + pad) c.x -= total;
      if (!c.sprite) continue;
      if (c.x + c.sprite.width < view.left - 80 || c.x > view.right + 80) continue;
      const big = wt === "storm" || wt === "gale" || wt === "rain" || wt === "downpour" || wt === "blizzard" ? 1.35 : 1;
      ctx.globalAlpha = wt === "fog" ? 0.55 : 0.95;
      const dw = c.sprite.width * big, dh = c.sprite.height * big;
      // c.y — линия основания облака: при смене погоды масштаб не «подпрыгивает».
      // Страховка на кадре: даже если облако «догнало» горизонт при смене
      // масштаба, точка опоры остаётся над водой.
      const baseY = Math.min(c.y, f.hY - f.H * 0.035);
      ctx.drawImage(c.sprite, c.x, baseY - c.anchorY * big, dw, dh);
    }
    ctx.globalAlpha = 1;

    // сумеречные лучи
    if (f.golden > 0.2 && f.sunVis > 0.2 && f.cover > 0.2 && f.cover < 0.98 && f.sunY < hY + 10) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + 0.15 + (i / 8) * (Math.PI - 0.3) + Math.sin(t * 0.1 + i) * 0.02;
        const w = 0.03 + (i % 3) * 0.015;
        const L = W * 0.9;
        const gr = ctx.createRadialGradient(f.sunX, f.sunY, 0, f.sunX, f.sunY, L);
        gr.addColorStop(0, `rgba(255,200,140,${af(0.045 * f.golden * f.sunVis)})`);
        gr.addColorStop(1, "rgba(255,200,140,0)");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(f.sunX, f.sunY);
        ctx.lineTo(f.sunX + Math.cos(a - w) * L, f.sunY + Math.sin(a - w) * L);
        ctx.lineTo(f.sunX + Math.cos(a + w) * L, f.sunY + Math.sin(a + w) * L);
        ctx.fill();
      }
      ctx.restore();
    }

    this.drawRainbow(f);
    this.drawGulls(f);
  }

  private drawRainbow(f: Frame) {
    const { ctx, e, W, H, hY } = f;
    const view = horizontalRange(f, 0);
    const ev = findActiveEvent(f, "rainbow");
    let alpha = f.atmo.rainbow * 0.72;
    if (ev && f.sunElev > 0.05) {
      const left = (ev.endsAt - e.s.minutes) / 90;
      alpha = Math.max(alpha, Math.min(1, left * 4, (1 - left) * 6 + 0.2) * 0.26 * (1 - f.night));
    }
    if (alpha <= 0.01) return;
    const cx = W - f.sunX + W * 0.05;
    const cy = hY + H * 0.1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(view.left, 0, view.right - view.left, hY);
    ctx.clip();
    ctx.globalCompositeOperation = "screen";
    drawRainbowFx(ctx, cx, cy, H * 0.42, Math.min(0.7, alpha));
    ctx.restore();
  }

  private drawSun(f: Frame) {
    const { ctx, hY, H } = f;
    const view = horizontalRange(f, 0);
    if (f.sunElev < -1) return;
    const low = 1 - clamp(f.sunElev / 18, 0, 1);
    const r = H * 0.028 * (1 + low * 0.25);
    const core = mix(rgbHex(f.atmo.palette.sun), "#ff8a3c", low * 0.6);
    const vis = f.sunVis;
    const halo = ctx.createRadialGradient(f.sunX, f.sunY, 0, f.sunX, f.sunY, H * 0.45);
    halo.addColorStop(0, hexA(mix(rgbHex(f.atmo.palette.sun), rgbHex(f.atmo.palette.glow), 0.35 + low * 0.2), 0.55 * vis));
    halo.addColorStop(0.12, hexA(mix(rgbHex(f.atmo.palette.sun), "#ff9050", low * 0.55), 0.22 * vis));
    halo.addColorStop(1, "rgba(255,180,120,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(view.left, 0, view.right - view.left, hY);
    ctx.save();
    ctx.beginPath();
    ctx.rect(view.left, -50, view.right - view.left, hY + 50);
    ctx.clip();
    ctx.globalAlpha = clamp(vis * 1.4, 0.08, 1);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(f.sunX, f.sunY, r, r * (1 - low * 0.12), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawMoon(f: Frame) {
    if (!f.moonUp) return;
    const { ctx, H } = f;
    const mx = f.moonX, my = f.moonY, r = H * 0.022;
    const phase = f.atmo.moonPhase;
    const lit = f.atmo.moonIllum;
    const vis = f.moonVis;
    if (vis < 0.02) return;
    const mg = ctx.createRadialGradient(mx, my, r, mx, my, r * 10);
    mg.addColorStop(0, `rgba(190,210,255,${af(0.3 * vis * lit)})`);
    mg.addColorStop(1, "rgba(190,210,255,0)");
    ctx.fillStyle = mg;
    ctx.fillRect(mx - r * 10, my - r * 10, r * 20, r * 20);
    ctx.save();
    ctx.globalAlpha = vis;
    // пепельный свет
    ctx.fillStyle = "rgba(90,100,130,0.35)";
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
    const k = Math.cos(phase * Math.PI * 2);
    const waxing = phase <= 0.5;
    if (lit > 0.02) {
      ctx.beginPath();
      ctx.arc(mx, my, r, -Math.PI / 2, Math.PI / 2, !waxing);
      ctx.ellipse(mx, my, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, waxing ? k > 0 : k < 0);
      ctx.closePath();
      const mgr = ctx.createRadialGradient(mx - r * 0.3, my - r * 0.3, 0, mx, my, r);
      mgr.addColorStop(0, "#fbfbf2");
      mgr.addColorStop(1, "#d8dccc");
      ctx.fillStyle = mgr;
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = "rgba(150,150,130,0.35)";
      for (const [cx, cy, cr] of [[-0.3, -0.2, 0.26], [0.35, 0.3, 0.18], [0.1, -0.45, 0.12], [-0.1, 0.45, 0.15], [0.45, -0.1, 0.1]]) {
        ctx.beginPath();
        ctx.arc(mx + cx * r, my + cy * r, cr * r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    if (lit > 0.9) glow(ctx, mx, my, r * 0.6, "#c8d8ff", 0.25 * vis);
  }

  private drawGulls(f: Frame) {
    const { ctx, e, t } = f;
    const view = horizontalRange(f, 0);
    const width = Math.max(1, view.right - view.left);
    const gullsEv = hasActiveEvent(f, "gulls");
    if (e.isNight || f.loc.land === "abyss" || f.atmo.wind > 18 || f.atmo.precip > 0.82) return;
    if (!gullsEv && f.loc.land === "open" && f.spot.feature !== "seamount") return;
    const n = gullsEv || f.spot.feature === "seamount" ? 7 : f.atmo.precip < 0.15 && f.atmo.cover < 0.78 ? 3 : 1;
    if (!this.gullsReady) {
      for (const gull of this.gulls) gull[0] = view.left + gull[0] * width;
      this.gullsReady = true;
    }
    ctx.strokeStyle = mix("#1c242c", f.hor, 0.25 + f.fogK * 0.5);
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const gg = this.gulls[i];
      // Птицы появляются в окне игрока и проходят его медленно, а не летают по всему миру.
      gg[0] += f.dt * (4 + i * 1.5) * (0.6 + f.atmo.wind / 12);
      gg[2] += f.dt * (2 + i * 0.15);
      if (gg[0] > view.right + 40) gg[0] = view.left - 40;
      else if (gg[0] < view.left - 80) gg[0] = view.right + 40;
      const s = gg[3];
      const gx = gg[0], gy = gg[1] + Math.sin(t * 0.21 + i * 2) * 18;
      const fl = Math.sin(gg[2]) * 6 * s;
      ctx.lineWidth = 1.7 * s;
      ctx.beginPath();
      ctx.moveTo(gx - 11 * s, gy - fl);
      ctx.quadraticCurveTo(gx - 5 * s, gy - 5 * s, gx, gy);
      ctx.quadraticCurveTo(gx + 5 * s, gy - 5 * s, gx + 11 * s, gy - fl);
      ctx.stroke();
    }
  }
}
