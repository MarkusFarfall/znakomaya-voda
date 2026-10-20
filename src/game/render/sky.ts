import { cloudBank } from "./cloudBank";
import type { WeatherId } from "../types";
import { findActiveEvent, hasActiveEvent, type Frame } from "./frame";
import { drawRainbow as drawRainbowFx } from "./weatherFx";
import { clamp, ctx2d, glow, hexA, makeCanvas, mix, rng, smooth, af, rgbHex } from "./util";

/** Small background microtiles; only tiles intersecting the viewport are rasterized. */
export const SKY_TILE_WIDTH = 256;

export function skyTileWindow(worldWidth: number, left: number, width: number, tileWidth = SKY_TILE_WIDTH) {
  const count = Math.max(1, Math.ceil(worldWidth / tileWidth));
  const lo = clamp(left, 0, Math.max(0, worldWidth - 0.001));
  const hi = clamp(left + Math.max(1, width) - 0.001, lo, Math.max(0, worldWidth - 0.001));
  const first = clamp(Math.floor(lo / tileWidth), 0, count - 1);
  const last = clamp(Math.floor(hi / tileWidth), first, count - 1);
  const visible = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  return { visible, resident: visible };
}

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

/** Avoid rerasterizing sky backplates for imperceptible sub-frame color changes. */
function colorCacheKey(color: string) {
  const value = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return color;
  return [0, 2, 4].map((i) => Math.floor(parseInt(value.slice(i, i + 2), 16) / 8)).join(":");
}

interface Cloud {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  seed: number;
  layer: number;
  sprite: HTMLCanvasElement | null;
}
export interface MilkyPoint { x: number; y: number; alpha: number; size: number }
export interface MilkyHole { x: number; gradientY: number; radius: number; ellipseY: number; width: number; height: number }
export interface DeckBlob { x: number; y: number; radius: number; color: string }

/** Paint one world-space crop. Shared by production tiles and visual regression tests. */
export function renderMilkyRegion(ctx: CanvasRenderingContext2D, worldWidth: number, height: number, worldLeft: number, points: MilkyPoint[], holes: MilkyHole[]) {
  ctx.save();
  ctx.translate(worldWidth * 0.55 - worldLeft, height * 0.35);
  ctx.rotate(-0.42);
  const band = ctx.createLinearGradient(0, -height * 0.18, 0, height * 0.18);
  band.addColorStop(0, "rgba(160,170,255,0)");
  band.addColorStop(0.5, "rgba(200,205,255,0.22)");
  band.addColorStop(1, "rgba(160,170,255,0)");
  ctx.fillStyle = band;
  ctx.fillRect(-worldWidth * 0.9, -height * 0.18, worldWidth * 1.8, height * 0.36);
  const tileLeft = worldLeft, tileRight = worldLeft + ctx.canvas.width;
  const cos = Math.cos(-0.42), sin = Math.sin(-0.42), centerX = worldWidth * 0.55;
  for (const p of points) {
    const projectedX = centerX + p.x * cos - p.y * sin;
    const extent = p.size * (Math.abs(cos) + Math.abs(sin)) + 2;
    if (projectedX + extent < tileLeft || projectedX - extent > tileRight) continue;
    ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalCompositeOperation = "destination-out";
  for (const h of holes) {
    const projectedX = centerX + h.x * cos - h.ellipseY * sin;
    const extent = h.radius + h.width + h.height + 4;
    if (projectedX + extent < tileLeft || projectedX - extent > tileRight) continue;
    const dg = ctx.createRadialGradient(h.x, h.gradientY, 0, h.x, 0, h.radius);
    dg.addColorStop(0, "rgba(0,0,0,0.5)");
    dg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.ellipse(h.x, h.ellipseY, h.width, h.height, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function renderDeckRegion(ctx: CanvasRenderingContext2D, worldLeft: number, tileWidth: number, blobs: DeckBlob[], alphaColor: (color: string, alpha: number) => string) {
  for (const blob of blobs) {
    const rad = blob.radius;
    if (blob.x + rad * 1.8 < worldLeft || blob.x - rad * 1.8 > worldLeft + tileWidth) continue;
    const x = blob.x - worldLeft;
    const gr = ctx.createRadialGradient(x, blob.y, 0, x, blob.y, rad);
    gr.addColorStop(0, alphaColor(blob.color, 0.55));
    gr.addColorStop(1, alphaColor(blob.color, 0));
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(x, blob.y, rad * 1.8, rad * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class SkyRenderer {
  private W = 0;
  private H = 0;
  private stars: [number, number, number, number, string][] = [];
  private milkyTiles = new Map<number, HTMLCanvasElement>();
  private milkyPoints: MilkyPoint[] = [];
  private milkyHoles: MilkyHole[] = [];
  private clouds: Cloud[] = [];
  private deckTiles = new Map<number, HTMLCanvasElement>();
  private deckBlobs: DeckBlob[] = [];
  private deckHeight = 0;
  private tilePlan = { visible: [0], resident: [0] };
  private key = "";
  private meteors: [number, number, number][] = [];
  private gulls: [number, number, number, number][] = [];

  private setup(W: number, H: number) {
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    this.key = "";
    const r = rng(11);
    const hy = H * 0.39;
    const tints = ["#ffffff", "#ffffff", "#dfe8ff", "#fff2dc", "#ffe0d0"];
    this.stars = Array.from({ length: 320 }, () => [r() * W, Math.pow(r(), 1.4) * hy, r() < 0.06 ? 1.8 : r() * 1.2 + 0.4, r() * 6.28, tints[Math.floor(r() * tints.length)]]);
    // Keep the Milky Way as deterministic world-space geometry, then rasterize
    // only resident sky tiles. This preserves its scale and placement without a
    // 7200px-wide backing store.
    this.milkyTiles.clear();
    this.milkyPoints = [];
    this.milkyHoles = [];
    const len = W * 0.9;
    for (let i = 0; i < 2600; i++) {
      this.milkyPoints.push({
        x: (r() - 0.5) * len * 2,
        y: (r() + r() + r() - 1.5) * hy * 0.12,
        alpha: 0.15 + r() * 0.5,
        size: r() * 1.1 + 0.3,
      });
    }
    for (let i = 0; i < 60; i++) {
      const x = (r() - 0.5) * len * 2;
      this.milkyHoles.push({
        x,
        gradientY: (r() - 0.5) * 8,
        radius: 18 + r() * 30,
        ellipseY: (r() - 0.5) * 8,
        width: 40 + r() * 40,
        height: 6 + r() * 6,
      });
    }
    this.clouds = Array.from({ length: 14 }, (_, i) => {
      const layer = i / 13;
      const w = (120 + r() * 200) * (0.6 + layer * 0.7) * clamp(W / 1280, 0.6, 1.4);
      return { x: r() * W * 1.3 - W * 0.15, y: H * (0.04 + (1 - layer) * 0.22 + r() * 0.05), w, h: w * (0.3 + r() * 0.16), speed: 3 + layer * 9, seed: r() * 1000, layer, sprite: null };
    });
    this.gulls = Array.from({ length: 7 }, () => [r() * W, H * (0.1 + r() * 0.2), r() * 6.28, 0.7 + r() * 0.5]);
  }

  private rebuild(f: Frame, lit: string, shade: string) {
    for (const c of this.clouds) {
      const cw = Math.ceil(c.w * 1.3), ch = Math.ceil(c.h * 1.8);
      const cv = c.sprite && c.sprite.width === cw && c.sprite.height === ch ? c.sprite : makeCanvas(cw, ch);
      const g = ctx2d(cv);
      g.clearRect(0, 0, cw, ch);
      g.save(); g.translate(cw * .5, ch * .55); g.scale(1, Math.min(1.8, ch / cw * 3));
      cloudBank(g, 0, 0, cw * .48, lit, shade, .85, c.seed);
      g.restore();
      c.sprite = cv;
    }
    // Generate the same continuous cloud-bank blobs in world coordinates;
    // rasterization is lazy and limited to resident tiles.
    this.deckHeight = Math.ceil(f.hY + 10);
    this.deckTiles.clear();
    this.deckBlobs = [];
    const r = rng(77);
    for (let i = 0; i < 220; i++) {
      const x = r() * f.W * 1.2 - f.W * 0.1;
      const y = Math.pow(r(), 0.8) * this.deckHeight * 0.95;
      const radius = (40 + r() * 110) * (0.6 + (y / this.deckHeight) * 0.6);
      const color = r() < 0.5 ? shade : mix(shade, lit, 0.35);
      this.deckBlobs.push({ x, y, radius, color });
    }
  }

  private getMilkyTile(id: number): HTMLCanvasElement {
    let tile = this.milkyTiles.get(id);
    if (tile) return tile;
    const width = Math.min(SKY_TILE_WIDTH, this.W - id * SKY_TILE_WIDTH);
    const hy = this.H * 0.39;
    tile = makeCanvas(width, hy);
    renderMilkyRegion(ctx2d(tile), this.W, hy, id * SKY_TILE_WIDTH, this.milkyPoints, this.milkyHoles);
    this.milkyTiles.set(id, tile);
    return tile;
  }

  private getDeckTile(id: number): HTMLCanvasElement {
    let tile = this.deckTiles.get(id);
    if (tile) return tile;
    const width = Math.min(SKY_TILE_WIDTH, this.W - id * SKY_TILE_WIDTH);
    tile = makeCanvas(width, this.deckHeight);
    renderDeckRegion(ctx2d(tile), id * SKY_TILE_WIDTH, width, this.deckBlobs, hexA);
    this.deckTiles.set(id, tile);
    return tile;
  }

  draw(f: Frame) {
    const { ctx, W, H, hY, t, e } = f;
    this.setup(W, H);
    const viewLeft = f.viewLeft ?? 0;
    this.tilePlan = skyTileWindow(W, viewLeft, f.viewWidth ?? W);
    const residents = new Set(this.tilePlan.resident);
    for (const id of this.milkyTiles.keys()) if (!residents.has(id)) this.milkyTiles.delete(id);
    for (const id of this.deckTiles.keys()) if (!residents.has(id)) this.deckTiles.delete(id);
    const abyssDark = f.loc.land === "abyss" ? 0.25 : 0;

    const g = ctx.createLinearGradient(0, 0, 0, hY);
    g.addColorStop(0, mix(f.top, "#000000", abyssDark));
    g.addColorStop(0.62, f.mid);
    g.addColorStop(1, f.hor);
    ctx.fillStyle = g;
    ctx.fillRect(0, -40, W, hY + 42);

    // свечение у горизонта со стороны солнца
    if (f.golden > 0.02) {
      const hg = ctx.createRadialGradient(f.sunX, hY, 0, f.sunX, hY, W * 0.7);
      hg.addColorStop(0, `rgba(255,150,80,${af(0.5 * f.golden * (1 - f.cover * 0.6))})`);
      hg.addColorStop(0.4, `rgba(255,120,90,${af(0.18 * f.golden)})`);
      hg.addColorStop(1, "rgba(255,120,90,0)");
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, W, hY);
    }

    // звёзды
    const starA = f.atmo.starVis;
    if (starA > 0.02) {
      ctx.globalAlpha = starA * 0.9;
      for (const id of this.tilePlan.visible) ctx.drawImage(this.getMilkyTile(id), id * SKY_TILE_WIDTH, 0);

      for (const [x, y, r, p, c] of this.stars) {
        if (y > hY - 4) continue;
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
      if (Math.random() < f.dt * 1.6) this.meteors.push([Math.random() * W, Math.random() * H * 0.2, 0]);
      for (const m of this.meteors) {
        m[2] += f.dt;
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
    const key = `${colorCacheKey(lit)}|${colorCacheKey(shade)}|${W}|${H}|${f.sunX < W / 2}`;
    if (key !== this.key) {
      this.key = key;
      this.rebuild(f, lit, shade);
    }
    if (f.cover > 0.7 && f.quality > 0) {
      ctx.globalAlpha = clamp((f.cover - 0.7) * 3.3, 0, 1) * (wt === "fog" ? 0.5 : 1);
      for (const id of this.tilePlan.visible) ctx.drawImage(this.getDeckTile(id), id * SKY_TILE_WIDTH, 0);
      ctx.globalAlpha = 1;
    }
    // перистые
    if ((wt === "clear" || wt === "fair" || wt === "cloudy") && f.night < 0.8) {
      ctx.strokeStyle = hexA(lit, 0.18 * (1 - f.night));
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const x0 = ((i * 260 + t * 2) % (W + 400)) - 200, y0 = H * (0.05 + (i % 3) * 0.04);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(x0 + 60, y0 - 10, x0 + 140, y0 + 6, x0 + 220, y0 - 4);
        ctx.stroke();
      }
    }
    const n = Math.round(clamp(f.cover * 1.25, 0, 1) * this.clouds.length);
    for (let i = 0; i < n; i++) {
      const c = this.clouds[i];
      c.x += (c.speed + f.atmo.wind * 1.5 * f.atmo.windDir) * f.dt * (0.5 + c.layer);
      if (c.x > W + 40) c.x = -c.w * 1.4;
      if (c.x < -c.w * 1.5) c.x = W + 30;
      if (!c.sprite) continue;
      const big = wt === "storm" || wt === "gale" || wt === "rain" || wt === "downpour" || wt === "blizzard" ? 1.35 : 1;
      ctx.globalAlpha = wt === "fog" ? 0.55 : 0.95;
      ctx.drawImage(c.sprite, c.x, c.y - c.h * (big - 1), c.sprite.width * big, c.sprite.height * big);
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
    ctx.rect(0, 0, W, hY);
    ctx.clip();
    ctx.globalCompositeOperation = "screen";
    drawRainbowFx(ctx, cx, cy, H * 0.42, Math.min(0.7, alpha));
    ctx.restore();
  }

  private drawSun(f: Frame) {
    const { ctx, hY, H } = f;
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
    ctx.fillRect(0, 0, f.W, hY);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, -50, f.W, hY + 50);
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
    const { ctx, e, W, t } = f;
    const gullsEv = hasActiveEvent(f, "gulls");
    if (e.isNight || f.loc.land === "abyss" || f.atmo.wind > 18 || f.atmo.precip > 0.82) return;
    if (!gullsEv && f.loc.land === "open" && f.spot.feature !== "seamount") return;
    const n = gullsEv || f.spot.feature === "seamount" ? 7 : f.atmo.precip < 0.15 && f.atmo.cover < 0.78 ? 3 : 1;
    ctx.strokeStyle = mix("#1c242c", f.hor, 0.25 + f.fogK * 0.5);
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const gg = this.gulls[i];
      gg[0] += f.dt * (18 + i * 6) * (0.6 + f.atmo.wind / 12);
      gg[2] += f.dt * (5 + i * 0.3);
      if (gg[0] > W + 40) gg[0] = -40;
      const s = gg[3];
      const gx = gg[0], gy = gg[1] + Math.sin(t * 0.5 + i * 2) * 18;
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
